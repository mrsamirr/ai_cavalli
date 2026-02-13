import { NextRequest, NextResponse } from 'next/server'
import {
    getUserByPhone,
    verifyPin,
    updateSessionToken,
    clearFailedLoginAttempts,
    recordFailedLogin,
    isUserLocked,
    logAuthAction,
    generateSessionToken,
    getAdminClient
} from '@/lib/auth/utils'
import { sanitizePhone } from '@/lib/utils/phone'

/**
 * Unified Login Endpoint
 * - PIN login: login_type = 'student' | 'kitchen' | 'staff'
 * - Guest login: login_type = 'guest'
 * No Supabase Auth dependency — uses direct DB + bcryptjs
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { phone, pin, name, table_name, num_guests, login_type } = body

        if (!phone) {
            return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
        }

        const sanitizedPhone = sanitizePhone(phone)
        if (!sanitizedPhone || sanitizedPhone.length < 10) {
            return NextResponse.json({ success: false, error: 'Valid 10-digit phone number required' }, { status: 400 })
        }

        // Check account lock
        const lockStatus = await isUserLocked(sanitizedPhone)
        if (lockStatus.locked) {
            const minutesLeft = Math.ceil((lockStatus.until!.getTime() - Date.now()) / 60000)
            return NextResponse.json(
                { success: false, error: `Account locked. Try again in ${minutesLeft} minutes.` },
                { status: 429 }
            )
        }

        // ─── FLOW 1: PIN-based login (Student / Kitchen / Admin) ───
        if (login_type === 'student' || login_type === 'kitchen' || login_type === 'staff') {
            if (!pin || pin.length < 6) {
                return NextResponse.json({ success: false, error: 'PIN is required (6 digits)' }, { status: 400 })
            }

            const user = await getUserByPhone(sanitizedPhone)
            if (!user) {
                await recordFailedLogin(sanitizedPhone, 'User not found')
                console.error('LOGIN DEBUG: No user found for phone:', sanitizedPhone)
                return NextResponse.json({ success: false, error: 'Invalid phone or PIN' }, { status: 401 })
            }

            // Normalize role for comparison (handle both old and new DB values)
            const rawRole = (user.role || '').toUpperCase()
            const userRole = rawRole === 'KITCHEN_MANAGER' ? 'KITCHEN'
                : rawRole === 'STAFF' ? 'KITCHEN'
                : rawRole === 'GUEST' ? 'OUTSIDER'
                : rawRole
            
            console.log('LOGIN DEBUG: Found user:', { id: user.id, phone: user.phone, role: user.role, rawRole, userRole, hasPin: !!user.pin, hasPinHash: !!user.pin_hash })

            // Only STUDENT/KITCHEN/ADMIN can use PIN login
            if (!['STUDENT', 'KITCHEN', 'ADMIN'].includes(userRole)) {
                return NextResponse.json(
                    { success: false, error: 'Use guest check-in for this account' },
                    { status: 403 }
                )
            }

            // Verify PIN (supports bcrypt hash, pgcrypto hash, and plaintext fallback)
            const pinValid = await verifyPin(pin, user)
            console.log('LOGIN DEBUG: PIN verification result:', pinValid, 'inputPin:', pin, 'storedPin:', user.pin?.substring(0, 2) + '***', 'storedPinHash:', user.pin_hash?.substring(0, 10))
            if (!pinValid) {
                await recordFailedLogin(sanitizedPhone, 'Invalid PIN')
                return NextResponse.json({ success: false, error: 'Invalid phone or PIN' }, { status: 401 })
            }

            // Success — clear failed attempts, generate session
            await clearFailedLoginAttempts(user.id)
            const sessionToken = generateSessionToken()
            await updateSessionToken(user.id, sessionToken, 24)
            await logAuthAction(user.id, 'login', { method: 'pin', role: userRole })

            // Return safe user object (no pin/pin_hash)
            const safeUser = {
                id: user.id,
                email: user.email,
                phone: user.phone,
                name: user.name,
                role: userRole,
                parent_name: user.parent_name,
                position: user.position,
                created_at: user.created_at
            }

            return NextResponse.json({
                success: true,
                user: safeUser,
                session: { session_token: sessionToken, expires_in: 86400 },
                message: `Welcome back, ${user.name}!`
            })
        }

        // ─── FLOW 2: Guest check-in (no PIN needed) ───
        if (login_type === 'guest' || login_type === 'outsider') {
            if (!name?.trim()) {
                return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
            }
            if (!table_name?.trim()) {
                return NextResponse.json({ success: false, error: 'Table number is required' }, { status: 400 })
            }

            const admin = getAdminClient()

            // Check if phone belongs to staff
            const { data: staffUser } = await admin
                .from('users')
                .select('*')
                .eq('phone', sanitizedPhone)
                .maybeSingle()

            if (staffUser) {
                const staffRole = (staffUser.role || '').toUpperCase()
                if (['STUDENT', 'KITCHEN', 'ADMIN'].includes(staffRole)) {
                    return NextResponse.json(
                        { success: false, error: 'This phone is registered to staff. Use staff login.' },
                        { status: 400 }
                    )
                }
            }

            // Find or create guest user
            let guestUser = staffUser && (staffUser.role || '').toUpperCase() === 'OUTSIDER'
                ? staffUser
                : null

            if (!guestUser) {
                // Look for existing OUTSIDER
                const { data: existingGuest } = await admin
                    .from('users')
                    .select('*')
                    .eq('phone', sanitizedPhone)
                    .maybeSingle()

                if (existingGuest) {
                    guestUser = existingGuest
                    // Update name if different
                    if (existingGuest.name !== name.trim()) {
                        await admin.from('users').update({ name: name.trim() }).eq('id', existingGuest.id)
                    }
                }
            }

            if (!guestUser) {
                // Create new guest user
                const guestEmail = `guest_${sanitizedPhone}@aicavalli.local`
                const { data: newUser, error: createError } = await admin
                    .from('users')
                    .insert({
                        email: guestEmail,
                        phone: sanitizedPhone,
                        name: name.trim(),
                        role: 'OUTSIDER'
                    })
                    .select()
                    .single()

                if (createError || !newUser) {
                    console.error('Guest creation failed:', createError)
                    return NextResponse.json({ success: false, error: 'Registration failed. Try again.' }, { status: 500 })
                }
                guestUser = newUser
            }

            // Create or update guest session
            let session = null
            try {
                const { data: existingSession } = await admin
                    .from('guest_sessions')
                    .select('*')
                    .eq('guest_phone', sanitizedPhone)
                    .eq('status', 'active')
                    .maybeSingle()

                if (existingSession) {
                    const { data: updatedSession } = await admin
                        .from('guest_sessions')
                        .update({
                            table_name: table_name.trim(),
                            num_guests: parseInt(num_guests || '1'),
                            guest_name: name.trim(),
                            user_id: guestUser.id
                        })
                        .eq('id', existingSession.id)
                        .select()
                        .single()
                    session = updatedSession || existingSession
                } else {
                    const { data: newSession } = await admin
                        .from('guest_sessions')
                        .insert({
                            user_id: guestUser.id,
                            guest_name: name.trim(),
                            guest_phone: sanitizedPhone,
                            table_name: table_name.trim(),
                            num_guests: parseInt(num_guests || '1'),
                            status: 'active',
                            total_amount: 0
                        })
                        .select()
                        .single()
                    session = newSession
                }
            } catch (e) {
                console.error('Guest session error (non-fatal):', e)
            }

            // Generate session token
            if (!guestUser) {
                return NextResponse.json({ success: false, error: 'Failed to create guest account' }, { status: 500 })
            }
            const sessionToken = generateSessionToken()
            await updateSessionToken(guestUser.id, sessionToken, 24)
            await logAuthAction(guestUser.id, 'guest_login', { table_name, num_guests })

            const safeUser = {
                id: guestUser.id,
                email: guestUser.email,
                phone: guestUser.phone || sanitizedPhone,
                name: name.trim(),
                role: 'OUTSIDER',
                created_at: guestUser.created_at
            }

            return NextResponse.json({
                success: true,
                user: safeUser,
                session: {
                    ...(session || {}),
                    session_token: sessionToken,
                    expires_in: 86400
                },
                message: session ? 'Welcome back! Session resumed.' : 'Dining session started!'
            })
        }

        return NextResponse.json({ success: false, error: 'Invalid login_type' }, { status: 400 })
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
