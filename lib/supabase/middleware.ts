import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make your app
    // insecure.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Public routes - always allow
    const publicRoutes = ['/login', '/api', '/seed']
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return supabaseResponse
    }

    // Root path redirect
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // If no authenticated user and trying to access protected route
    if (!user) {
        // Allow guest routes if guest_session_active cookie exists
        const hasGuestSession = request.cookies.get('guest_session_active')?.value === 'true'

        if (pathname.startsWith('/guest') && hasGuestSession) {
            return supabaseResponse
        }

        // Redirect to login for all other protected routes
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // User is authenticated - fetch their role from the database
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    const userRole = profile?.role

    // Set auth_role cookie for client-side use
    supabaseResponse.cookies.set('auth_role', userRole || '', {
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
        sameSite: 'lax',
    })

    // Role-based route protection

    // Guest routes - only for guests
    if (pathname.startsWith('/guest')) {
        if (userRole !== 'guest') {
            // Redirect non-guests to appropriate portal
            if (userRole === 'admin' || userRole === 'kitchen_manager' || userRole === 'staff') {
                return NextResponse.redirect(new URL('/kitchen', request.url))
            }
            return NextResponse.redirect(new URL('/home', request.url))
        }
        return supabaseResponse
    }

    // Admin routes - only for admin
    if (pathname.startsWith('/admin')) {
        if (userRole !== 'admin') {
            return NextResponse.redirect(new URL('/home', request.url))
        }
        return supabaseResponse
    }

    // Kitchen routes - for staff, kitchen_manager, admin
    if (pathname.startsWith('/kitchen')) {
        const kitchenRoles = ['staff', 'kitchen_manager', 'admin']
        if (!kitchenRoles.includes(userRole || '')) {
            return NextResponse.redirect(new URL('/home', request.url))
        }
        return supabaseResponse
    }

    // Customer routes (/home, /menu, /cart, /orders, /profile)
    const customerRoutes = ['/home', '/menu', '/cart', '/orders', '/profile']
    if (customerRoutes.some(route => pathname.startsWith(route))) {
        // Guests should use /guest routes
        if (userRole === 'guest') {
            return NextResponse.redirect(new URL('/guest/home', request.url))
        }
        // Kitchen/admin users should use their portals
        if (userRole === 'kitchen_manager' || userRole === 'admin') {
            return NextResponse.redirect(new URL('/kitchen', request.url))
        }
        return supabaseResponse
    }

    return supabaseResponse
}
