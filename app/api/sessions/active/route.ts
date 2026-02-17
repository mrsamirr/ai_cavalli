import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Get Active Session API
 * 
 * Retrieves the active dining session for a guest by phone number.
 * Includes all orders placed during the session for billing.
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const phone = searchParams.get('phone')
        const userId = searchParams.get('userId')

        if (!phone && !userId) {
            return NextResponse.json(
                { success: false, error: 'Phone or userId is required' },
                { status: 400 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        const sanitizedPhone = phone?.replace(/\D/g, '').slice(0, 10)

        // Build query based on provided params
        let query = supabase
            .from('guest_sessions')
            .select(`
                *,
                orders (
                    id,
                    total,
                    discount_amount,
                    created_at,
                    status,
                    order_items (
                        id,
                        quantity,
                        price,
                        menu_items (name)
                    )
                )
            `)
            .eq('status', 'active')

        if (sanitizedPhone) {
            query = query.eq('guest_phone', sanitizedPhone)
        } else if (userId) {
            query = query.eq('user_id', userId)
        }

        const { data: session, error } = await query.maybeSingle()

        if (error) {
            console.error('Active session query error:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch session' },
                { status: 500 }
            )
        }

        if (!session) {
            return NextResponse.json({
                success: true,
                session: null
            })
        }

        // Calculate totals from orders
        const orders = session.orders || []
        const orderCount = orders.length
        const totalFromOrders = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)

        return NextResponse.json({
            success: true,
            session: {
                ...session,
                orderCount,
                calculatedTotal: totalFromOrders
            }
        })

    } catch (error) {
        console.error('Active session error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
