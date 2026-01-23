import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabase } from '@/lib/database/supabase'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhone = process.env.TWILIO_PHONE_NUMBER

export async function POST(request: NextRequest) {
    try {
        const { phone } = await request.json()

        if (!phone || phone.length !== 10) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        }

        // Check if user exists
        const { data: user } = await supabase
            .from('users')
            .select('phone, role')
            .eq('phone', phone)
            .single()

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Only allow riders and staff to reset PIN
        if (user.role !== 'student' && user.role !== 'staff') {
            return NextResponse.json({ error: 'PIN reset not available for this user type' }, { status: 403 })
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString()

        // Store OTP in database (expires in 5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

        const { error: dbError } = await supabase
            .from('otp_codes')
            .insert({
                phone,
                otp_code: otpCode,
                expires_at: expiresAt
            })

        if (dbError) {
            console.error('Database error:', dbError)
            return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 })
        }

        // Send OTP via Twilio (only if credentials are configured)
        if (accountSid && authToken && twilioPhone) {
            try {
                const client = twilio(accountSid, authToken)
                await client.messages.create({
                    body: `Your Ai Cavalli PIN reset OTP is: ${otpCode}. Valid for 5 minutes.`,
                    from: twilioPhone,
                    to: `+91${phone}` // Assuming Indian phone numbers
                })
            } catch (twilioError: any) {
                console.error('Twilio error:', twilioError)
                // Don't fail the request if SMS fails, just log it
                // In development, you can still use the OTP from database
            }
        } else {
            console.warn('Twilio credentials not configured. OTP:', otpCode)
        }

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully',
            // Include OTP in response only in development
            ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
        })

    } catch (error: any) {
        console.error('Send OTP error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
