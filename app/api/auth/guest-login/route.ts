import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Guest Login API
 * 
 * Simple phone-based guest authentication without email/OTP.
 * Creates or reuses a guest user and starts a dining session.
 * All orders during the session are tracked until final bill.
 */
export async function POST(request: NextRequest) {
    try {
        const { name, phone, tableName, numGuests } = await request.json()

        // Validation
        if (!name?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Name is required.' },
                { status: 400 }
            )
        }

        const sanitizedPhone = phone?.replace(/\D/g, '').slice(0, 10)
        if (!sanitizedPhone || sanitizedPhone.length < 10) {
            return NextResponse.json(
                { success: false, error: 'Valid 10-digit phone number is required.' },
                { status: 400 }
            )
        }

        if (!tableName?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Table number is required.' },
                { status: 400 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Check if this phone belongs to Staff or Rider (prevent overlap)
        const { data: staffOrRider } = await supabase
            .from('users')
            .select('id, role')
            .eq('phone', sanitizedPhone)
            .in('role', ['staff', 'student'])
            .maybeSingle()

        if (staffOrRider) {
            return NextResponse.json(
                { success: false, error: 'This phone number is registered to internal personnel. Please use the Staff/Rider login.' },
                { status: 400 }
            )
        }

        // Find or create guest user by phone
        let { data: user } = await supabase
            .from('users')
            .select('id, name, phone, role')
            .eq('phone', sanitizedPhone)
            .eq('role', 'guest')
            .maybeSingle()

        if (user) {
            // Update name if different
            if (user.name !== name.trim()) {
                await supabase
                    .from('users')
                    .update({ name: name.trim() })
                    .eq('id', user.id)
                user.name = name.trim()
            }
        } else {
            // Create new guest user (no email required)
            const guestEmail = `guest_${sanitizedPhone}@aicavalli.local`
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    name: name.trim(),
                    phone: sanitizedPhone,
                    email: guestEmail, // Internal placeholder email
                    role: 'guest'
                })
                .select('id, name, phone, role')
                .single()

            if (createError) {
                console.error('Guest registration failed:', createError)
                return NextResponse.json(
                    { success: false, error: 'Registration failed. Please try again.' },
                    { status: 500 }
                )
            }
            user = newUser
        }

        // Check for existing active session for this phone
        const { data: existingSession } = await supabase
            .from('guest_sessions')
            .select('*')
            .eq('guest_phone', sanitizedPhone)
            .eq('status', 'active')
            .maybeSingle()

        let session = existingSession

        if (existingSession) {
            // Update table if changed
            if (existingSession.table_name !== tableName.trim() ||
                existingSession.num_guests !== parseInt(numGuests || '1')) {
                const { data: updatedSession } = await supabase
                    .from('guest_sessions')
                    .update({
                        table_name: tableName.trim(),
                        num_guests: parseInt(numGuests || '1'),
                        guest_name: name.trim(),
                        user_id: user.id
                    })
                    .eq('id', existingSession.id)
                    .select()
                    .single()
                session = updatedSession || existingSession
            }
        } else {
            // Create new session
            const { data: newSession, error: sessionError } = await supabase
                .from('guest_sessions')
                .insert({
                    guest_name: name.trim(),
                    guest_phone: sanitizedPhone,
                    table_name: tableName.trim(),
                    num_guests: parseInt(numGuests || '1'),
                    user_id: user.id,
                    status: 'active',
                    total_amount: 0
                })
                .select()
                .single()

            if (sessionError) {
                console.error('Session creation failed:', sessionError)
                return NextResponse.json(
                    { success: false, error: 'Failed to start dining session.' },
                    { status: 500 }
                )
            }
            session = newSession
        }

        // Return user and session data
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role
            },
            session: {
                id: session.id,
                tableName: session.table_name,
                numGuests: session.num_guests,
                totalAmount: session.total_amount,
                startedAt: session.started_at
            },
            message: existingSession ? 'Welcome back! Your session is active.' : 'Session started. Enjoy your meal!'
        })

    } catch (error) {
        console.error('Guest login error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error. Please try again.' },
            { status: 500 }
        )
    }
}
