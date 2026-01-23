import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/database/supabase'

export async function POST(request: NextRequest) {
    try {
        const { phone, otp } = await request.json()

        if (!phone || !otp) {
            return NextResponse.json({ error: 'Phone and OTP are required' }, { status: 400 })
        }

        // Find the most recent unused OTP for this phone
        const { data: otpRecord, error: fetchError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('phone', phone)
            .eq('otp_code', otp)
            .eq('used', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !otpRecord) {
            return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
        }

        // Check if OTP has expired
        const now = new Date()
        const expiresAt = new Date(otpRecord.expires_at)

        if (now > expiresAt) {
            return NextResponse.json({ error: 'OTP has expired' }, { status: 400 })
        }

        // Mark OTP as verified
        const { error: updateError } = await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpRecord.id)

        if (updateError) {
            console.error('Update error:', updateError)
            return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'OTP verified successfully',
            otpId: otpRecord.id // Return ID for use in reset-pin
        })

    } catch (error: any) {
        console.error('Verify OTP error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
