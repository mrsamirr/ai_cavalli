import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 🚨 Never touch auth on public routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/seed') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const hasGuestSession =
    request.cookies.get('guest_session_active')?.value === 'true'
  const authRole = request.cookies.get('auth_role')?.value
  const hasAuthRole = Boolean(authRole)

  const applyAuthCookies = (targetResponse: NextResponse) => {
    response.cookies.getAll().forEach(cookie => {
      targetResponse.cookies.set(cookie)
    })

    return targetResponse
  }

  const resolveHomeForRole = () => {
    if (authRole === 'guest' || hasGuestSession) return '/guest/home'
    if (authRole === 'kitchen_manager' || authRole === 'admin' || authRole === 'staff') {
      return '/kitchen'
    }
    return '/home'
  }

  // ✅ Logged-in user hitting login page
  if (pathname.startsWith('/login')) {
    if (user || hasAuthRole || hasGuestSession) {
      return applyAuthCookies(
        NextResponse.redirect(new URL(resolveHomeForRole(), request.url))
      )
    }

    return response
  }

  // ❌ No session & no guest
  if (!user && !hasGuestSession && !hasAuthRole) {
    return applyAuthCookies(
      NextResponse.redirect(new URL('/login', request.url))
    )
  }

  // 👤 Guest accessing protected routes
  if (!user && (hasGuestSession || authRole === 'guest') && !pathname.startsWith('/guest')) {
    return applyAuthCookies(
      NextResponse.redirect(new URL('/guest/home', request.url))
    )
  }

  if (authRole === 'student' && pathname.startsWith('/kitchen')) {
    return applyAuthCookies(
      NextResponse.redirect(new URL('/home', request.url))
    )
  }

  // ✅ Logged-in user hitting root
  if (user && pathname === '/') {
    return applyAuthCookies(
      NextResponse.redirect(new URL('/kitchen', request.url))
    )
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
