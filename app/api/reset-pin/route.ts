import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/database/supabase'
import { createClient } from '@supabase/supabase-js'

// Admin client for auth operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function POST(request: NextRequest) {
    try {
        const { phone, newPin, otpId } = await request.json()

        if (!phone || !newPin || !otpId) {
            return NextResponse.json({ error: 'Phone, new PIN, and OTP ID are required' }, { status: 400 })
        }

        if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
            return NextResponse.json({ error: 'PIN must be 6 digits' }, { status: 400 })
        }

        // Verify OTP was verified and not used
        const { data: otpRecord, error: otpError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('id', otpId)
            .eq('phone', phone)
            .eq('verified', true)
            .eq('used', false)
            .single()

        if (otpError || !otpRecord) {
            return NextResponse.json({ error: 'Invalid or expired verification' }, { status: 400 })
        }

        // Get user details
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, phone')
            .eq('phone', phone)
            .single()

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Update PIN in public.users table
        const { error: updatePinError } = await supabase
            .from('users')
            .update({ pin: newPin })
            .eq('id', user.id)

        if (updatePinError) {
            console.error('Update PIN error:', updatePinError)
            return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 })
        }

        // Update password in auth.users (using admin client)
        const email = `${phone}@example.com`
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: newPin }
        )

        if (authError) {
            console.error('Auth update error:', authError)
            // PIN is updated in public.users, but auth password failed
            // This is acceptable as login uses public.users PIN
        }

        // Mark OTP as used
        await supabase
            .from('otp_codes')
            .update({ used: true })
            .eq('id', otpId)

        return NextResponse.json({
            success: true,
            message: 'PIN reset successfully'
        })

    } catch (error: any) {
        console.error('Reset PIN error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
