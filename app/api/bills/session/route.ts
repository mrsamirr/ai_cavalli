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
            console.error('Session fetch error:', sessionError)
            return NextResponse.json(
                { success: false, error: 'Session not found' },
                { status: 404 }
            )
        }

        let orders = session.orders || []

        if (orders.length === 0) {
            console.error('No orders found for session:', sessionId, 'Session data:', session)
            
            // Try a direct query as backup
            const { data: directOrders, error: ordersError } = await supabase
                .from('orders')
                .select(`
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
                `)
                .eq('session_id', sessionId)
            
            console.log('Direct orders query result:', directOrders, 'error:', ordersError)
            
            if (directOrders && directOrders.length > 0) {
                // Use the direct query results
                orders = directOrders
            } else {
                return NextResponse.json(
                    { 
                        success: false, 
                        error: 'No orders found in this session. Please ensure orders are placed before requesting a bill.',
                        debug: {
                            sessionId,
                            sessionStatus: session.status,
                            directOrdersCount: directOrders?.length || 0
                        }
                    },
                    { status: 400 }
                )
            }
        }

        // 2. Check if session already has a bill — return full bill data
        const { data: existingBill } = await supabase
            .from('bills')
            .select(`
                *,
                bill_items(*)
            `)
            .eq('session_id', sessionId)
            .single()

        if (existingBill) {
            const billItems = (existingBill.bill_items || []).map((item: any) => ({
                item_name: item.item_name || item.name || 'Item',
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal || (item.quantity * item.price)
            }))

            return NextResponse.json({
                success: true,
                message: 'Bill already exists for this session',
                bill: {
                    id: existingBill.id,
                    billNumber: existingBill.bill_number,
                    itemsTotal: existingBill.items_total,
                    discountAmount: existingBill.discount_amount || 0,
                    finalTotal: existingBill.final_total,
                    paymentMethod: existingBill.payment_method,
                    items: billItems,
                    sessionDetails: existingBill.session_details || {
                        guestName: session.guest_name || 'Guest',
                        tableName: session.table_name || 'N/A',
                        numGuests: session.num_guests || 1,
                        orderCount: orders.length,
                        startedAt: session.started_at
                    }
                }
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
