import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Auth Callback Route
 * 
 * This route handles the redirect from Supabase Magic Link authentication.
 * When a guest clicks the magic link in their email, Supabase redirects to
 * this callback with the authentication tokens in the URL hash/query.
 * 
 * The route exchanges the auth code for a session and redirects to /home.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    // Handle errors from Supabase
    if (error) {
        console.error('Auth callback error:', error, errorDescription)
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin))
    }

    // If we have a code, exchange it for a session
    if (code) {
        const supabase = createClient(supabaseUrl, supabaseKey)

        try {
            // Exchange the code for a session
            const { data: authData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
                console.error('Code exchange error:', exchangeError)
                return NextResponse.redirect(new URL('/login?error=Authentication+failed', requestUrl.origin))
            }

            if (authData.user) {
                // Fetch user details from our users table
                const { data: user } = await supabase
                    .from('users')
                    .select('id, email, name, role, phone')
                    .eq('email', authData.user.email)
                    .single()

                if (user) {
                    // Set cookies or create session as needed
                    // The response will include Set-Cookie headers from Supabase
                    const response = NextResponse.redirect(new URL('/home', requestUrl.origin))

                    // Pass user info via URL params for the client to pick up
                    // (Alternatively, trust Supabase session on the client)
                    return response
                }
            }
        } catch (err) {
            console.error('Auth callback exception:', err)
        }
    }

    // Default: redirect to home (session should be available via Supabase client)
    return NextResponse.redirect(new URL('/home', requestUrl.origin))
}
