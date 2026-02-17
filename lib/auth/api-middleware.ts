/**
 * API Route Protection Utilities
 * Middleware for checking authorization in API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types/auth'
import { RBAC, hasPermission as checkPermission } from '@/lib/types/auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return { user: null, error: 'Authorization header missing' }
        }

        const token = authHeader.replace('Bearer ', '')
        const admin = createClient(supabaseUrl, serviceRoleKey)

        // Look up user by session token
        const { data: profile, error: profileError } = await admin
            .from('users')
            .select('id, email, phone, name, role, parent_name, position, created_at, session_token, session_expires_at')
            .eq('session_token', token)
            .maybeSingle()

        if (profileError || !profile) {
            return { user: null, error: 'Invalid session token' }
        }

        // Check expiry
        if (profile.session_expires_at && new Date(profile.session_expires_at) < new Date()) {
            return { user: null, error: 'Session expired' }
        }

        return { user: { ...profile, role: (profile.role || '').toUpperCase() }, error: undefined }
    } catch (error) {
        console.error('Auth user fetch error:', error)
        return { user: null, error: 'Authentication failed' }
    }
}

/**
 * Require specific roles for API endpoint
 */
export async function requireRoles(
    request: NextRequest,
    allowedRoles: UserRole[]
): Promise<{ authorized: boolean; user: any; error?: string; response?: NextResponse }> {
    const { user, error } = await getAuthUser(request)

    if (error || !user) {
        const response = NextResponse.json(
            { success: false, error: error || 'Unauthorized' },
            { status: 401 }
        )
        return { authorized: false, user: null, error, response }
    }

    if (!allowedRoles.includes(user.role)) {
        const response = NextResponse.json(
            { success: false, error: 'Forbidden: Insufficient permissions' },
            { status: 403 }
        )
        return { authorized: false, user, error: 'Role not allowed', response }
    }

    return { authorized: true, user }
}

/**
 * Require specific permission for API endpoint
 */
export async function requirePermission(
    request: NextRequest,
    permission: string
): Promise<{ authorized: boolean; user: any; error?: string; response?: NextResponse }> {
    const { user, error } = await getAuthUser(request)

    if (error || !user) {
        const response = NextResponse.json(
            { success: false, error: error || 'Unauthorized' },
            { status: 401 }
        )
        return { authorized: false, user: null, error, response }
    }

    if (!checkPermission(user.role, permission)) {
        const response = NextResponse.json(
            { success: false, error: 'Forbidden: Missing required permission' },
            { status: 403 }
        )
        return { authorized: false, user, error: 'Permission denied', response }
    }

    return { authorized: true, user }
}

/**
 * Check if user can access resource
 */
export function canAccessResource(
    userRole: UserRole,
    resourceOwnerId: string,
    currentUserId: string,
    allowOwnerAccess = true
): boolean {
    // Admin can access everything
    if (userRole === 'ADMIN') {
        return true
    }

    // Owner can access their own resources
    if (allowOwnerAccess && currentUserId === resourceOwnerId) {
        return true
    }

    return false
}

/**
 * Audit log helper
 */
export async function logAudit(
    userId: string,
    action: string,
    details?: Record<string, any>,
    status: 'success' | 'failed' = 'success'
) {
    try {
        const admin = createClient(supabaseUrl, serviceRoleKey)
        await admin.from('auth_audit_log').insert([
            {
                user_id: userId,
                action,
                details: details || {},
                success: status === 'success'
            }
        ])
    } catch (error) {
        console.error('Audit log error:', error)
    }
}

/**
 * Create API response
 */
export function apiResponse<T>(
    success: boolean,
    data?: T,
    error?: string,
    statusCode: number = success ? 200 : 400
): [T extends any ? ApiResponse<T> : never, number] {
    return [
        {
            success,
            ...(data && { data }),
            ...(error && { error })
        } as any,
        statusCode
    ]
}
