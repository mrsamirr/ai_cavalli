import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Generate User Bill API
 *
 * Creates a consolidated bill from all unbilled orders for a user.
 * Works for ALL roles (STUDENT, STAFF, OUTSIDER, etc.) without
 * requiring a guest_session.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, paymentMethod = 'cash' } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch user profile
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, name, phone, email, role')
            .eq('id', userId)
            .single()

        if (userError || !userData) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            )
        }

        // 2. Fetch all unbilled orders for this user
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id,
                total,
                discount_amount,
                status,
                created_at,
                table_name,
                billed,
                order_items (
                    id,
                    quantity,
                    price,
                    menu_items (name)
                )
            `)
            .eq('user_id', userId)
            .or('billed.is.null,billed.eq.false')
            .order('created_at', { ascending: true })

        if (ordersError) {
            console.error('Orders fetch error:', ordersError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch orders' },
                { status: 500 }
            )
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No unbilled orders found' },
                { status: 400 }
            )
        }

        // 3. Consolidate all items from all orders
        const consolidatedItems: { [key: string]: { name: string, quantity: number, price: number } } = {}
        let totalItemsAmount = 0
        let totalDiscount = 0

        orders.forEach((order: any) => {
            totalDiscount += order.discount_amount || 0

            const orderItems = order.order_items || []
            orderItems.forEach((item: any) => {
                const itemName = item.menu_items?.name || 'Unknown Item'
                const key = `${itemName}_${item.price}`

                if (consolidatedItems[key]) {
                    consolidatedItems[key].quantity += item.quantity
                } else {
                    consolidatedItems[key] = {
                        name: itemName,
                        quantity: item.quantity,
                        price: item.price
                    }
                }
                totalItemsAmount += item.quantity * item.price
            })
        })

        const finalTotal = totalItemsAmount - totalDiscount

        // 4. Generate bill number
        let billNumber: string
        try {
            const { data: billNumberData, error: billNumberError } = await supabase
                .rpc('generate_bill_number')

            if (billNumberError) throw billNumberError
            billNumber = billNumberData as string
        } catch (e) {
            // Fallback bill number if RPC doesn't exist
            billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`
        }

        // 5. Create bill record
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert({
                order_id: orders[0].id,
                bill_number: billNumber,
                items_total: totalItemsAmount,
                discount_amount: totalDiscount,
                final_total: finalTotal,
                payment_method: paymentMethod,
                payment_status: 'pending',
                guest_name: userData.name || 'Guest',
                guest_phone: userData.phone || '',
                table_name: orders[0].table_name || userData.name || 'N/A'
            })
            .select()
            .single()

        if (billError) {
            console.error('Bill creation error:', billError)
            return NextResponse.json(
                { success: false, error: 'Failed to create bill' },
                { status: 500 }
            )
        }

        // 6. Create bill items
        const billItems = Object.values(consolidatedItems).map(item => ({
            bill_id: bill.id,
            item_name: item.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }))

        const { error: billItemsError } = await supabase
            .from('bill_items')
            .insert(billItems)

        if (billItemsError) {
            console.error('Bill items creation error:', billItemsError)
            await supabase.from('bills').delete().eq('id', bill.id)
            return NextResponse.json(
                { success: false, error: 'Failed to create bill items' },
                { status: 500 }
            )
        }

        // 7. Mark all orders as billed
        const orderIds = orders.map((o: any) => o.id)
        await supabase
            .from('orders')
            .update({ billed: true })
            .in('id', orderIds)

        return NextResponse.json({
            success: true,
            bill: {
                id: bill.id,
                billNumber: bill.bill_number,
                itemsTotal: totalItemsAmount,
                discountAmount: totalDiscount,
                finalTotal: finalTotal,
                paymentMethod: paymentMethod,
                items: billItems,
                sessionDetails: {
                    guestName: userData.name || 'Guest',
                    tableName: orders[0].table_name || userData.name || 'N/A',
                    numGuests: 1,
                    orderCount: orders.length,
                    startedAt: orders[0].created_at
                }
            }
        })

    } catch (error) {
        console.error('User bill generation error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
