import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/utils'

/**
 * Session refresh endpoint
 * Validates session token against DB and returns fresh user data
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ success: false, error: 'No session token' }, { status: 401 })
        }

        const admin = getAdminClient()
        const { data: user, error } = await admin
            .from('users')
            .select('id, email, phone, name, role, parent_name, position, created_at, session_token, session_expires_at')
            .eq('session_token', token)
            .maybeSingle()

        if (error || !user) {
            return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
        }

        // Check expiration
        if (user.session_expires_at && new Date(user.session_expires_at) < new Date()) {
            await admin.from('users').update({ session_token: null, session_expires_at: null }).eq('id', user.id)
            return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 })
        }

        // Return safe user data (role uppercased for consistency)
        // Normalize role (handle old DB values)
        const rawRole = (user.role || '').toUpperCase()
        const normalizedRole = rawRole === 'KITCHEN_MANAGER' ? 'KITCHEN'
            : rawRole === 'STAFF' ? 'KITCHEN'
            : rawRole === 'GUEST' ? 'OUTSIDER'
            : rawRole

        const safeUser = {
            id: user.id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            role: normalizedRole,
            parent_name: user.parent_name,
            position: user.position,
            created_at: user.created_at
        }

        return NextResponse.json({
            success: true,
            user: safeUser,
            session: { session_token: token }
        })
    } catch (error) {
        console.error('Refresh error:', error)
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
    }
}
