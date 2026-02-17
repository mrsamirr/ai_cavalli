/**
 * PIN Hashing Utility for Test User Setup
 * 
 * This is a Node.js script to help set up test users with hashed PINs.
 * Run with: npx ts-node lib/utils/setup-test-users.ts
 * 
 * Or copy the SQL output and paste directly into Supabase SQL Editor.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface TestUser {
    email: string
    phone: string
    name: string
    role: 'STUDENT' | 'KITCHEN' | 'ADMIN'
    pin: string
    position?: string
}

// Test users to create
const testUsers: TestUser[] = [
    {
        email: 'student@test.com',
        phone: '9876543210',
        name: 'Test Student',
        role: 'STUDENT',
        pin: '123456'
    },
    {
        email: 'chef@test.com',
        phone: '9876543211',
        name: 'Test Chef',
        role: 'KITCHEN',
        pin: '123456',
        position: 'Head Chef'
    },
    {
        email: 'admin@test.com',
        phone: '9876543212',
        name: 'Test Admin',
        role: 'ADMIN',
        pin: '123456'
    }
]

async function setupTestUsers() {
    try {
        console.log('🔧 Setting up test users...\n')

        const admin = createClient(supabaseUrl, serviceRoleKey)

        for (const testUser of testUsers) {
            console.log(`Creating ${testUser.role} user: ${testUser.name}`)

            // Generate PIN hash using bcrypt
            // Note: The SQL migration file handles hashing, this is just for reference
            const pinHashPlaceholder = `bcrypt(${testUser.pin})`

            // Actually, let's use a simpler approach - just insert and let the trigger handle it
            // Or we can use the Supabase dashboard to create users

            const userId = crypto.randomUUID()

            // Create user in users table with pin_hash
            const { data, error } = await admin
                .from('users')
                .upsert({
                    email: testUser.email,
                    phone: testUser.phone,
                    name: testUser.name,
                    role: testUser.role,
                    position: testUser.position,
                    // PIN will be hashed using: crypt(PIN, gen_salt('bf', 8))
                    // For now, we'll set it via SQL
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) {
                console.error(`  ❌ Error: ${error.message}`)
            } else {
                console.log(`  ✅ User created: ${data.id}`)
            }
        }

        console.log('\n📋 SQL to set PIN hashes (run in Supabase SQL Editor):\n')

        const sql = testUsers
            .map(
                (user) =>
                    `UPDATE public.users SET pin_hash = crypt('${user.pin}', gen_salt('bf', 8)) WHERE email = '${user.email}';`
            )
            .join('\n')

        console.log(sql)
        console.log('\n✅ Copy and paste the SQL above into Supabase SQL Editor to complete setup.')
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

setupTestUsers()
