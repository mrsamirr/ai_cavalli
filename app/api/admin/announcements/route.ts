import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_ROLES = ['ADMIN', 'KITCHEN']

/**
 * Authenticate an admin user from the request.
 *
 * Strategy 1: Look up by session_token in DB (primary)
 * Strategy 2: Look up by user ID + verify admin role (fallback)
 */
async function authenticateAdmin(request: NextRequest) {
    const supabase = createClient(supabaseUrl, supabaseKey)

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
            console.error('[Admin Announcements Auth] Session token query error:', error.message, error.code)
        }

        if (requester) {
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
    if (userId) {
        const { data: requester, error } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .maybeSingle()

        if (error) {
            console.error('[Admin Announcements Auth] User ID lookup error:', error.message, error.code)
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

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const { data, error } = await auth.supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('Fetch announcements error:', error)
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const { action, payload } = await request.json()
        const supabase = auth.supabase

        if (action === 'create') {
            const { title, description, link, image_url, active = true } = payload || {}

            if (!title || !String(title).trim()) {
                return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
            }

            const { error } = await supabase.from('announcements').insert({
                title: String(title).trim(),
                description: description || null,
                link: link || null,
                image_url: image_url || null,
                active: Boolean(active)
            })

            if (error) throw error

            return NextResponse.json({ success: true, message: 'Announcement created successfully' })
        }

        if (action === 'delete') {
            const { id } = payload || {}
            if (!id) {
                return NextResponse.json({ success: false, error: 'Announcement id is required' }, { status: 400 })
            }

            const { error } = await supabase.from('announcements').delete().eq('id', id)
            if (error) throw error

            return NextResponse.json({ success: true, message: 'Announcement deleted successfully' })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('Admin announcements operation error:', error)
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        )
    }
}
