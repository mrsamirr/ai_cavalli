import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client that bypasses RLS
function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST - add a special or create menu item + add as special
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { menu_item_id, period, date } = body

        if (!menu_item_id || !period) {
            return NextResponse.json({ error: 'menu_item_id and period are required' }, { status: 400 })
        }

        const admin = getAdminClient()
        const targetDate = date || new Date().toISOString().split('T')[0]

        const { data, error } = await admin
            .from('daily_specials')
            .insert({ menu_item_id, period, date: targetDate })
            .select('*, menu_item:menu_items(*)')
            .single()

        if (error) {
            console.error('Insert special error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (err: any) {
        console.error('POST /api/kitchen/specials error:', err)
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
    }
}

// DELETE - remove a special by id
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const admin = getAdminClient()

        const { error } = await admin
            .from('daily_specials')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Delete special error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('DELETE /api/kitchen/specials error:', err)
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
    }
}
