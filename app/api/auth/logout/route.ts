import { NextRequest, NextResponse } from 'next/server'
import { clearSessionToken, logAuthAction, getAdminClient } from '@/lib/auth/utils'

/**
 * Logout endpoint - clears session token from DB
 * Works with custom session tokens (no Supabase Auth dependency)
 */
export async function POST(request: NextRequest) {
    try {
        // Get user ID from request body or session token
        const body = await request.json().catch(() => ({}))
        const userId = body.userId

        if (userId) {
            await clearSessionToken(userId)
            await logAuthAction(userId, 'logout')
        }

        return NextResponse.json({ success: true, message: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error:', error)
        return NextResponse.json({ success: true, message: 'Logged out' })
    }
}

/** Also support GET for simple redirects */
export async function GET() {
    return NextResponse.json({ success: true, message: 'Logged out' })
}
