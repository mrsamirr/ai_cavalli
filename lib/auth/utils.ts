/**
 * Server-side authentication utilities
 * All operations use service_role client to bypass RLS
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import type { AuthUser } from '@/lib/types/auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Admin client (bypasses RLS) */
export function getAdminClient() {
    return createClient(supabaseUrl, serviceRoleKey)
}

/** Generate a random session token */
export function generateSessionToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 64; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${Date.now().toString(36)}_${result}`
}

/** Get user by phone (returns ALL columns for PIN checking) */
export async function getUserByPhone(phone: string): Promise<any | null> {
    try {
        const admin = getAdminClient()
        const { data, error } = await admin
            .from('users')
            .select('*')
            .eq('phone', phone)
            .maybeSingle()
        if (error || !data) return null
        return data
    } catch (error) {
        console.error('getUserByPhone error:', error)
        return null
    }
}

/** Get user by ID (safe fields only) */
export async function getUserById(id: string): Promise<AuthUser | null> {
    try {
        const admin = getAdminClient()
        const { data, error } = await admin
            .from('users')
            .select('id, email, phone, name, role, parent_name, position, last_login, created_at')
            .eq('id', id)
            .single()
        if (error || !data) return null
        return data as AuthUser
    } catch (error) {
        console.error('getUserById error:', error)
        return null
    }
}

/**
 * Verify PIN against stored hash or plaintext
 * Supports: bcrypt hash (pin_hash), pgcrypto hash (pin_hash), plaintext (pin)
 */
export async function verifyPin(inputPin: string, user: any): Promise<boolean> {
    try {
        // 1. Try bcrypt hash in pin_hash column
        if (user.pin_hash) {
            // Check if it's a bcrypt hash (starts with $2)
            if (user.pin_hash.startsWith('$2')) {
                return await bcrypt.compare(inputPin, user.pin_hash)
            }
            // Could be pgcrypto hash - try via DB function
            try {
                const admin = getAdminClient()
                const { data } = await admin.rpc('verify_pin', {
                    input_pin: inputPin,
                    stored_hash: user.pin_hash
                })
                if (data === true) return true
            } catch {
                // verify_pin function may not exist, continue
            }
        }

        // 2. Fallback: plaintext pin column
        if (user.pin && user.pin === inputPin) {
            // Upgrade to bcrypt hash on successful plaintext match
            try {
                const hash = await bcrypt.hash(inputPin, 10)
                const admin = getAdminClient()
                await admin.from('users').update({ pin_hash: hash }).eq('id', user.id)
            } catch {
                // Non-critical - upgrade failed silently
            }
            return true
        }

        return false
    } catch (error) {
        console.error('verifyPin error:', error)
        return false
    }
}

/** Store session token in DB */
export async function updateSessionToken(
    userId: string,
    sessionToken: string,
    expiresInHours: number = 24
): Promise<boolean> {
    try {
        const admin = getAdminClient()
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        const { error } = await admin
            .from('users')
            .update({
                session_token: sessionToken,
                session_expires_at: expiresAt,
                last_login: new Date().toISOString()
            })
            .eq('id', userId)
        return !error
    } catch (error) {
        console.error('updateSessionToken error:', error)
        return false
    }
}

/** Clear session token on logout */
export async function clearSessionToken(userId: string): Promise<boolean> {
    try {
        const admin = getAdminClient()
        const { error } = await admin
            .from('users')
            .update({ session_token: null, session_expires_at: null })
            .eq('id', userId)
        return !error
    } catch {
        return false
    }
}

/** Validate session token against DB */
export async function validateSessionToken(userId: string, token: string): Promise<boolean> {
    try {
        const admin = getAdminClient()
        const { data, error } = await admin
            .from('users')
            .select('session_token, session_expires_at')
            .eq('id', userId)
            .single()
        if (error || !data) return false
        if (data.session_token !== token) return false
        if (!data.session_expires_at || new Date(data.session_expires_at) < new Date()) return false
        return true
    } catch {
        return false
    }
}

/** Check if user account is locked (by PHONE) */
export async function isUserLocked(phone: string): Promise<{ locked: boolean; until?: Date }> {
    try {
        const admin = getAdminClient()
        const { data: user } = await admin
            .from('users')
            .select('locked_until')
            .eq('phone', phone)
            .maybeSingle()

        if (!user || !user.locked_until) return { locked: false }

        const lockUntil = new Date(user.locked_until)
        if (lockUntil < new Date()) {
            await admin.from('users').update({ locked_until: null, failed_login_attempts: 0 }).eq('phone', phone)
            return { locked: false }
        }
        return { locked: true, until: lockUntil }
    } catch {
        return { locked: false }
    }
}

/** Record failed login attempt (by PHONE). Locks after 5 failures for 30 min */
export async function recordFailedLogin(phone: string, reason: string = 'Invalid credentials'): Promise<void> {
    try {
        const admin = getAdminClient()
        const { data: user } = await admin
            .from('users')
            .select('id, failed_login_attempts')
            .eq('phone', phone)
            .maybeSingle()

        if (!user) {
            await logAuthAction(null, 'failed_login', { phone, reason }, 'failed', reason)
            return
        }

        const attempts = (user.failed_login_attempts || 0) + 1
        const shouldLock = attempts >= 5
        const updates: Record<string, any> = { failed_login_attempts: attempts }
        if (shouldLock) {
            updates.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }

        await admin.from('users').update(updates).eq('id', user.id)
        await logAuthAction(user.id, 'failed_login', { attempts, locked: shouldLock }, 'failed', reason)
    } catch (error) {
        console.error('recordFailedLogin error:', error)
    }
}

/** Clear failed login attempts on successful login */
export async function clearFailedLoginAttempts(userId: string): Promise<void> {
    try {
        const admin = getAdminClient()
        await admin.from('users').update({ failed_login_attempts: 0, locked_until: null }).eq('id', userId)
    } catch (error) {
        console.error('clearFailedLoginAttempts error:', error)
    }
}

/** Log authentication event */
export async function logAuthAction(
    userId: string | null,
    eventType: string,
    details?: Record<string, any>,
    status: 'success' | 'failed' = 'success',
    reason?: string
): Promise<void> {
    try {
        const admin = getAdminClient()
        await admin.from('auth_logs').insert([{
            user_id: userId,
            event_type: eventType,
            status,
            reason,
            details: details || {}
        }])
    } catch {
        // Never let logging break auth flow
    }
}
