import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_ROLES = ['ADMIN', 'KITCHEN']

/**
 * Authenticate an admin user from the request.
 *
 * Strategy 1: Look up by session_token in DB (primary — most secure)
 * Strategy 2: Look up by user ID + verify admin role (fallback — handles
 *             cases where session_token column is missing or token wasn't stored)
 */
async function authenticateAdmin(request: NextRequest) {
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extract tokens from request
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim() || request.cookies.get('session_token')?.value
    const userId = request.headers.get('X-User-Id')

    // Strategy 1: session_token DB lookup
    if (token) {
        const { data: requester, error } = await supabase
            .from('users')
            .select('id, role, session_expires_at')
            .eq('session_token', token)
            .maybeSingle()

        if (error) {
            console.error('[Admin Auth] Session token query error:', error.message, error.code)
            // Don't return — fall through to Strategy 2
        }

        if (requester) {
            // Auto-extend expired sessions (sliding window)
            if (requester.session_expires_at && new Date(requester.session_expires_at) < new Date()) {
                const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                await supabase.from('users').update({ session_expires_at: newExpiry }).eq('id', requester.id)
            }

            const role = (requester.role || '').toUpperCase()
            if (ADMIN_ROLES.includes(role)) {
                return { authenticated: true, requester, supabase }
            }
            return { authenticated: false, error: 'Admin privileges required', supabase }
        }
    }

    // Strategy 2: user ID lookup + role verification
    // This handles cases where session_token column doesn't exist or token wasn't stored in DB
    if (userId) {
        const { data: requester, error } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .maybeSingle()

        if (error) {
            console.error('[Admin Auth] User ID lookup error:', error.message, error.code)
        }

        if (requester) {
            const role = (requester.role || '').toUpperCase()
            if (ADMIN_ROLES.includes(role)) {
                return { authenticated: true, requester, supabase }
            }
            return { authenticated: false, error: 'Admin privileges required', supabase }
        }
    }

    if (!token && !userId) {
        return { authenticated: false, error: 'Not authenticated', supabase }
    }

    return { authenticated: false, error: 'Invalid session', supabase }
}

/**
 * GET /api/admin/users — Fetch all users
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const { data: users, error } = await auth.supabase
            .from('users')
            .select('id, phone, email, name, role, parent_name, created_at')
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ success: true, data: users })
    } catch (error: any) {
        console.error('Fetch users error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/users — Create, update, or delete users
 */
export async function POST(request: NextRequest) {
    try {
        const { action, userData } = await request.json()

        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const supabase = auth.supabase

        if (action === 'create') {
            const { name, phone, email, pin, role, parent_name } = userData

            const userEmail = email || (phone ? `${phone}@aicavalli.local` : `user_${Date.now()}@aicavalli.local`)

            const { error: dbError } = await supabase.from('users').insert({
                name,
                phone,
                email: userEmail,
                pin,
                role,
                parent_name: role === 'STUDENT' ? parent_name : null
            })

            if (dbError) throw dbError

            return NextResponse.json({ success: true, message: 'User created successfully' })

        } else if (action === 'update') {
            const { id, name, phone, email, pin, role, parent_name } = userData

            const dbPayload: any = {
                name,
                phone,
                role,
                parent_name: role === 'STUDENT' ? parent_name : null
            }
            if (email) dbPayload.email = email
            if (pin) {
                dbPayload.pin = pin
            }

            const { error: dbError } = await supabase
                .from('users')
                .update(dbPayload)
                .eq('id', id)

            if (dbError) throw dbError

            return NextResponse.json({ success: true, message: 'User updated successfully' })

        } else if (action === 'delete') {
            const { id } = userData

            // Remove related records that reference the user (foreign key constraints)
            await supabase.from('order_items').delete().in(
                'order_id',
                (await supabase.from('orders').select('id').eq('user_id', id)).data?.map((o: any) => o.id) || []
            )
            await supabase.from('orders').delete().eq('user_id', id)
            await supabase.from('guest_sessions').delete().eq('user_id', id)

            const { error: dbError } = await supabase.from('users').delete().eq('id', id)
            if (dbError) throw dbError

            return NextResponse.json({ success: true, message: 'User deleted successfully' })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        console.error('Admin user operation error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
