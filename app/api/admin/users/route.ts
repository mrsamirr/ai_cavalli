import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    try {
        const { action, userData } = await request.json()

        const supabase = createClient(supabaseUrl, supabaseKey)

        // AUTH GUARD: Verify requester via session token cookie or Authorization header
        const authHeader = request.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '') || request.cookies.get('session_token')?.value

        if (!token) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
        }

        const { data: requester } = await supabase
            .from('users')
            .select('id, role')
            .eq('session_token', token)
            .maybeSingle()

        if (!requester) {
            return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
        }

        const requesterRole = (requester.role || '').toUpperCase()
        if (!['ADMIN', 'KITCHEN_MANAGER', 'KITCHEN'].includes(requesterRole)) {
            return NextResponse.json({ success: false, error: 'Admin privileges required' }, { status: 403 })
        }

        if (action === 'create') {
            const { name, phone, email, pin, role, parent_name } = userData

            // Hash PIN
            const pinHash = await bcrypt.hash(pin, 10)
            const userEmail = email || (phone ? `${phone}@aicavalli.local` : `user_${Date.now()}@aicavalli.local`)

            const { error: dbError } = await supabase.from('users').insert({
                name,
                phone,
                email: userEmail,
                pin,
                pin_hash: pinHash,
                role,
                parent_name: role === 'student' ? parent_name : null
            })

            if (dbError) throw dbError

            return NextResponse.json({ success: true, message: 'User created successfully' })

        } else if (action === 'update') {
            const { id, name, phone, email, pin, role, parent_name } = userData

            const dbPayload: any = {
                name,
                phone,
                role,
                parent_name: role === 'student' ? parent_name : null
            }
            if (email) dbPayload.email = email
            if (pin) {
                dbPayload.pin = pin
                dbPayload.pin_hash = await bcrypt.hash(pin, 10)
            }

            const { error: dbError } = await supabase
                .from('users')
                .update(dbPayload)
                .eq('id', id)

            if (dbError) throw dbError

            return NextResponse.json({ success: true, message: 'User updated successfully' })

        } else if (action === 'delete') {
            const { id } = userData

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
