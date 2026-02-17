import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Generate Session Bill API
 * 
 * Creates a SINGLE consolidated bill for all orders in a guest session.
 * Combines items from multiple orders into one bill.
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, paymentMethod = 'cash' } = await request.json()

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID is required' },
                { status: 400 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch session with ALL orders and their items
        const { data: session, error: sessionError } = await supabase
            .from('guest_sessions')
            .select(`
                *,
                orders (
                    id,
                    total,
                    discount_amount,
                    status,
                    created_at,
                    order_items (
                        id,
                        quantity,
                        price,
                        menu_items (name)
                    )
                )
            `)
            .eq('id', sessionId)
            .single()

        if (sessionError || !session) {
            return NextResponse.json(
                { success: false, error: 'Session not found' },
                { status: 404 }
            )
        }

        const orders = session.orders || []

        if (orders.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No orders found in this session' },
                { status: 400 }
            )
        }

        // 2. Check if session already has a bill
        const { data: existingBill } = await supabase
            .from('bills')
            .select('id, bill_number')
            .eq('session_id', sessionId)
            .single()

        if (existingBill) {
            return NextResponse.json({
                success: true,
                message: 'Bill already exists for this session',
                bill: { id: existingBill.id, billNumber: existingBill.bill_number }
            })
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
                const key = `${itemName}_${item.price}` // Group by name AND price

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
        const { data: billNumberData, error: billNumberError } = await supabase
            .rpc('generate_bill_number')

        if (billNumberError) {
            console.error('Bill number generation error:', billNumberError)
            return NextResponse.json(
                { success: false, error: 'Failed to generate bill number' },
                { status: 500 }
            )
        }

        const billNumber = billNumberData as string

        // 5. Create consolidated bill record
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert({
                session_id: sessionId,
                order_id: orders[0].id, // Reference first order for backwards compatibility
                bill_number: billNumber,
                items_total: totalItemsAmount,
                discount_amount: totalDiscount,
                final_total: finalTotal,
                payment_method: paymentMethod,
                payment_status: 'pending',
                guest_name: session.guest_name,
                guest_phone: session.guest_phone,
                table_name: session.table_name
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

        // 6. Create consolidated bill items
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

        // 8. End the session
        await supabase
            .from('guest_sessions')
            .update({
                status: 'ended',
                ended_at: new Date().toISOString(),
                total_amount: finalTotal
            })
            .eq('id', sessionId)

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
                    guestName: session.guest_name,
                    tableName: session.table_name,
                    numGuests: session.num_guests,
                    orderCount: orders.length,
                    startedAt: session.started_at
                }
            }
        })

    } catch (error) {
        console.error('Session bill generation error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
