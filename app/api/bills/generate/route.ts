import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    try {
        const { orderId, paymentMethod = 'cash' } = await request.json()

        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'Order ID is required' },
                { status: 400 }
            )
        }

        // Use service role client to bypass RLS for bill generation
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // AUTH GUARD: Only staff, kitchen_manager, or admin can generate bills
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json(
                { success: false, error: 'Authorization required' },
                { status: 401 }
            )
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requester }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !requester) {
            return NextResponse.json(
                { success: false, error: 'Invalid or expired session' },
                { status: 401 }
            )
        }

        // Verify role
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', requester.id)
            .single()

        if (!profile || !['staff', 'kitchen_manager', 'admin'].includes(profile.role)) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized: Staff access required' },
                { status: 403 }
            )
        }

        // 1. Fetch the order with items
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
        *,
        order_items (
          id,
          quantity,
          price,
          menu_item_id,
          menu_items (name)
        )
      `)
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            )
        }

        // 2. Check if bill already exists
        const { data: existingBill } = await supabase
            .from('bills')
            .select('id, bill_number')
            .eq('order_id', orderId)
            .single()

        if (existingBill) {
            return NextResponse.json(
                { success: false, error: 'Bill already exists for this order', billNumber: existingBill.bill_number },
                { status: 400 }
            )
        }

        // 3. Calculate totals
        let itemsTotal = 0
        const items = order.order_items || []

        items.forEach((item: any) => {
            itemsTotal += item.quantity * item.price
        })

        const discountAmount = order.discount_amount || 0
        const finalTotal = itemsTotal - discountAmount

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

        // 5. Create bill record
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert({
                order_id: orderId,
                bill_number: billNumber,
                items_total: itemsTotal,
                discount_amount: discountAmount,
                final_total: finalTotal,
                payment_method: paymentMethod,
                payment_status: 'pending'
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
        const billItems = items.map((item: any) => ({
            bill_id: bill.id,
            item_name: item.menu_items?.name || 'Unknown Item',
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }))

        const { error: billItemsError } = await supabase
            .from('bill_items')
            .insert(billItems)

        if (billItemsError) {
            console.error('Bill items creation error:', billItemsError)
            // Rollback bill creation
            await supabase.from('bills').delete().eq('id', bill.id)
            return NextResponse.json(
                { success: false, error: 'Failed to create bill items' },
                { status: 500 }
            )
        }

        // 7. Mark order as billed
        await supabase
            .from('orders')
            .update({ billed: true })
            .eq('id', orderId)

        // 8. Return bill data
        return NextResponse.json({
            success: true,
            bill: {
                id: bill.id,
                billNumber: bill.bill_number,
                itemsTotal: bill.items_total,
                discountAmount: bill.discount_amount,
                finalTotal: bill.final_total,
                paymentMethod: bill.payment_method,
                items: billItems,
                orderDetails: {
                    tableName: order.table_name,
                    guestInfo: order.guest_info,
                    notes: order.notes,
                    createdAt: order.created_at
                }
            }
        })

    } catch (error) {
        console.error('Bill generation error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
