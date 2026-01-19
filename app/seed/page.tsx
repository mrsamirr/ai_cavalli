'use client'

import { useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SeedPage() {
    const [status, setStatus] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    // Manual User Form State
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [pin, setPin] = useState('123456')
    const [name, setName] = useState('')
    const [role, setRole] = useState('student')

    const addLog = (msg: string) => setStatus(prev => [...prev, msg])

    const checkConfig = async () => {
        addLog('=== CONFIGURATION CHECK ===')
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        addLog(`URL: ${url || 'MISSING'}`)
        addLog(`Key: ${key ? key.substring(0, 20) + '...' : 'MISSING'}`)

        if (!url || url.includes('placeholder')) {
            addLog('❌ Invalid Supabase URL')
        } else if (!key || key.startsWith('sb_publishable')) {
            addLog('❌ CRITICAL: Invalid anon key format!')
            addLog('   Expected: JWT token starting with "eyJ"')
            addLog('   Got: ' + (key?.substring(0, 20) || 'nothing'))
            addLog('   → Go to Supabase Dashboard → Settings → API')
            addLog('   → Copy the "anon public" key (200+ chars)')
        } else {
            addLog('✅ Configuration looks good')

            // Test connection
            try {
                const { data, error } = await supabase.from('users').select('count').limit(1)
                if (error) {
                    addLog(`⚠️ Database query failed: ${error.message}`)
                    addLog('   Hint: Did you run schema.sql in Supabase?')
                } else {
                    addLog('✅ Database connection successful')
                }
            } catch (e: any) {
                addLog(`❌ Connection test failed: ${e.message}`)
            }
        }
    }

    const createUser = async (u: { phone: string, email: string, pin: string, name: string, role: string }) => {
        addLog(`\n=== CREATING USER: ${u.name} ===`)
        addLog(`Phone: ${u.phone}`)
        addLog(`Email: ${u.email}`)
        addLog(`PIN: ${u.pin}`)

        // 1. Sign Up (Create Auth User)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: u.email,
            password: u.pin,
            options: {
                emailRedirectTo: undefined,
                data: {
                    full_name: u.name,
                }
            }
        })

        if (authError) {
            addLog(`❌ Auth Error: ${authError.message}`)
            if (authError.status) addLog(`   Status Code: ${authError.status}`)
            return
        }

        if (!authData.user) {
            addLog(`⚠️ No user returned from signUp`)
            return
        }

        addLog(`✅ Auth User Created`)
        addLog(`   User ID: ${authData.user.id}`)
        addLog(`   Email: ${authData.user.email}`)

        // 2. Insert into public.users
        const { error: dbError } = await supabase.from('users').upsert({
            id: authData.user.id,
            phone: u.phone,
            pin: u.pin,
            name: u.name,
            role: u.role,
            parent_name: null
        })

        if (dbError) {
            addLog(`❌ Database Error: ${dbError.message}`)
            addLog(`   Code: ${dbError.code}`)
            addLog(`   Hint: Run schema.sql in Supabase SQL Editor`)
        } else {
            addLog(`✅ SUCCESS! User fully registered`)
            addLog(`\n👉 LOGIN CREDENTIALS:`)
            addLog(`   Phone: ${u.phone}`)
            addLog(`   PIN: ${u.pin}`)
        }
    }

    const handleManualAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // Sanitize phone
        const numeric = phone.replace(/\D/g, '')
        const sanitizedPhone = numeric.startsWith('0') ? numeric.slice(1) : numeric
        const finalPhone = sanitizedPhone.slice(0, 10)

        // Auto-generate email if not provided
        const finalEmail = email.trim() || `${finalPhone}@example.com`

        await createUser({ phone: finalPhone, email: finalEmail, pin, name, role })
        setLoading(false)
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛠️ Database Seeder & Debugger</h1>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>Create users and test Supabase connection</p>

            <Button onClick={checkConfig} variant="secondary" size="sm" style={{ marginBottom: '2rem' }}>
                🔍 Run Diagnostics
            </Button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* MANUAL ADD USER */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>➕ Add User</h2>
                    <form onSubmit={handleManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name *</label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone *</label>
                            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="1234567890" required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
                            <Input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="user@example.com (optional - auto-generated from phone)"
                            />
                            <small style={{ color: '#666', fontSize: '0.85rem' }}>
                                Leave blank to auto-generate: {phone ? `${phone}@example.com` : 'phone@example.com'}
                            </small>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PIN (6+ chars) *</label>
                            <Input value={pin} onChange={e => setPin(e.target.value)} placeholder="123456" required minLength={6} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Role *</label>
                            <select
                                value={role}
                                onChange={e => setRole(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                            >
                                <option value="student">Rider</option>
                                <option value="staff">Staff</option>
                                <option value="kitchen_manager">Kitchen Manager</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <Button type="submit" isLoading={loading} style={{ marginTop: '0.5rem' }}>
                            Create User
                        </Button>
                    </form>
                </div>

                {/* LOGS */}
                <div style={{
                    background: '#1a1a1a',
                    color: '#00ff00',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '0.85rem',
                    height: '600px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ marginBottom: '0.5rem', color: '#888', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                        === DEBUG CONSOLE ===
                    </div>
                    {status.length === 0 ? (
                        <div style={{ color: '#666' }}>Waiting for actions...</div>
                    ) : (
                        status.map((msg, i) => <div key={i} style={{ marginBottom: '2px' }}>{msg}</div>)
                    )}
                </div>
            </div>
        </div>
    )
}
