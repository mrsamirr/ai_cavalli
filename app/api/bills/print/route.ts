import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    try {
        const { billId } = await request.json()

        if (!billId) {
            return NextResponse.json(
                { success: false, error: 'Bill ID is required' },
                { status: 400 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // AUTH GUARD: Only staff, kitchen_manager, or admin can print bills
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

        // Fetch bill with items and order details
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .select(`
        *,
        bill_items (*),
        orders (
          table_name,
          guest_info,
          notes,
          created_at,
          users (name, phone, role)
        )
      `)
            .eq('id', billId)
            .single()

        if (billError || !bill) {
            return NextResponse.json(
                { success: false, error: 'Bill not found' },
                { status: 404 }
            )
        }

        // Format bill data for thermal printer
        const billData = formatBillForPrinting(bill)

        // In a production environment with actual printer:
        // const printResult = await printToThermalPrinter(billData)

        // For now, we'll simulate printing and return the formatted data
        // This allows the frontend to display a preview or send to browser print

        // Update printed_at timestamp
        const { error: updateError } = await supabase
            .from('bills')
            .update({ printed_at: new Date().toISOString() })
            .eq('id', billId)

        if (updateError) {
            console.error('Failed to update printed_at:', updateError)
        }

        return NextResponse.json({
            success: true,
            message: 'Bill formatted for printing',
            printData: billData,
            printedAt: new Date().toISOString()
        })

    } catch (error) {
        console.error('Print error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to print bill' },
            { status: 500 }
        )
    }
}

function formatBillForPrinting(bill: any) {
    const order = bill.orders
    const items = bill.bill_items || []

    // Format date and time
    const billDate = new Date(bill.created_at)
    const dateStr = billDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
    const timeStr = billDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })

    // Build bill text
    const lines = [
        '================================',
        '    AI CAVALLI RESTAURANT',
        '================================',
        `Bill No: ${bill.bill_number}`,
        `Date: ${dateStr} ${timeStr}`,
        `Table: ${order?.table_name || 'N/A'}`,
        '--------------------------------',
        'ITEM              QTY    AMOUNT',
        '--------------------------------'
    ]

    // Add items
    items.forEach((item: any) => {
        const name = item.item_name.substring(0, 18).padEnd(18)
        const qty = item.quantity.toString().padStart(3)
        const amount = `₹${item.subtotal.toFixed(2)}`.padStart(9)
        lines.push(`${name}${qty}${amount}`)
    })

    lines.push('--------------------------------')
    lines.push(`Items Total:           ₹${bill.items_total.toFixed(2)}`.padStart(32))

    if (bill.discount_amount > 0) {
        const discountPercent = ((bill.discount_amount / bill.items_total) * 100).toFixed(0)
        lines.push(`Discount (${discountPercent}%):         ₹${bill.discount_amount.toFixed(2)}`.padStart(32))
    }

    lines.push('--------------------------------')
    lines.push(`FINAL TOTAL:           ₹${bill.final_total.toFixed(2)}`.padStart(32))
    lines.push('================================')

    if (bill.payment_method) {
        lines.push(`Payment: ${bill.payment_method.toUpperCase()}`)
    }

    lines.push('Thank you! Visit again!')
    lines.push('================================')
    lines.push('')
    lines.push('')

    return {
        billNumber: bill.bill_number,
        text: lines.join('\n'),
        lines: lines,
        metadata: {
            billId: bill.id,
            orderId: bill.order_id,
            total: bill.final_total,
            itemCount: items.length
        }
    }
}
