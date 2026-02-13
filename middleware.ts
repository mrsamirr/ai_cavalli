import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/lib/types/auth'
import { routeAccess, canAccess } from '@/lib/types/auth'

/**
 * Pure cookie-based middleware — NO Supabase Auth dependency
 * Reads auth_role cookie set by client on login
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip API routes, static assets, seed page
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/seed') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    // Get auth role from cookie (set by client on login)
    const authRole = request.cookies.get('auth_role')?.value as UserRole | undefined
    const isAuthenticated = Boolean(authRole)

    // Get required roles for this route
    const requiredRoles = routeAccess[pathname] ?? ['ADMIN']
    const isPublicRoute = requiredRoles.length === 0

    const resolveHome = (role?: UserRole) => {
        if (!role) return '/login'
        switch (role) {
            case 'OUTSIDER': return '/guest/home'
            case 'KITCHEN': return '/kitchen'
            case 'ADMIN': return '/kitchen'
            case 'STUDENT':
            default: return '/home'
        }
    }

    // 1. Public routes (login, auth callback)
    if (isPublicRoute) {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL(resolveHome(authRole), request.url))
        }
        return NextResponse.next()
    }

    // 2. Not authenticated → redirect to login
    if (!isAuthenticated) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // 3. Authenticated but wrong role → redirect to their home
    if (authRole && !canAccess(authRole, requiredRoles)) {
        return NextResponse.redirect(new URL(resolveHome(authRole), request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
