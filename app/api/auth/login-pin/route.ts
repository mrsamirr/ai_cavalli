import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase/server'
import { sanitizePhone } from '@/lib/utils/phone'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    try {
        const { phone, pin } = await request.json()

        if (!phone || !pin) {
            return NextResponse.json(
                { success: false, error: 'Phone and PIN are required' },
                { status: 400 }
            )
        }

        const cleanPhone = sanitizePhone(phone)

        // Admin client for DB lookups (bypasses RLS)
        const admin = createClient(supabaseUrl, serviceRoleKey)

        // SSR client for auth (automatically sets session cookies on the response)
        const supabase = await createSSRClient()

        // 1. Find the user by phone to get their email
        const { data: profile, error: profileError } = await admin
            .from('users')
            .select('email, role')
            .eq('phone', cleanPhone)
            .maybeSingle()

        if (profileError || !profile) {
            return NextResponse.json(
                { success: false, error: 'Account not found with this phone number' },
                { status: 404 }
            )
        }

        // 2. Authenticate with Supabase Auth (SSR client sets cookies automatically)
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password: pin
        })

        if (authError) {
            console.error('Login PIN error:', authError)
            return NextResponse.json(
                { success: false, error: 'Invalid PIN' },
                { status: 401 }
            )
        }

        // 3. Fetch User Profile
        const { data: user } = await admin
            .from('users')
            .select('id, email, name, role')
            .eq('id', authData.user.id)
            .single()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User profile not found. Please contact administration.' },
                { status: 404 }
            )
        }

        // Session cookies are set automatically by the SSR client
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            message: 'Login successful'
        })

    } catch (error) {
        console.error('Login PIN catch error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
