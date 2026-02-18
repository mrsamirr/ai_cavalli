import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRoles } from '@/lib/auth/api-middleware'

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

        // AUTH GUARD: Only STAFF, KITCHEN, or ADMIN can print bills
        const { authorized, response: authResponse } = await requireRoles(request, ['STAFF', 'KITCHEN', 'ADMIN'])
        if (!authorized) {
            return authResponse!
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
    // Build bold HTML receipt for browser print (much better thermal output than plain text)
    const itemsHTML = items.map((item: any) => {
        const name = item.item_name || 'Item'
        const qty = item.quantity
        const amount = `₹${item.subtotal.toFixed(2)}`
        return `<tr>
            <td style="text-align:left;padding:6px 0;"><b>${name}</b></td>
            <td style="text-align:center;padding:6px 0;"><b>${qty}</b></td>
            <td style="text-align:right;padding:6px 0;"><b>${amount}</b></td>
        </tr>`
    }).join('')

    const htmlReceipt = `<!DOCTYPE html><html><head><style>
        @page { size: 80mm auto; margin: 2mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Arial Black','Arial Bold',Arial,Helvetica,sans-serif; font-size:16px; font-weight:900;
               width:80mm; max-width:80mm; padding:4mm; background:#fff; color:#000000;
               -webkit-print-color-adjust:exact; print-color-adjust:exact;
               -webkit-text-stroke:0.6px #000000;
               text-shadow:0 0 0 #000,0.5px 0 0 #000,-0.5px 0 0 #000,0 0.5px 0 #000,0 -0.5px 0 #000; }
        b, strong { font-weight:900; }
        .c { text-align:center; }
        .name { font-size:28px; font-weight:900; letter-spacing:3px;
                -webkit-text-stroke:1.5px #000000;
                text-shadow:0 0 1px #000,1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000; }
        .sub { font-size:14px; font-weight:900; letter-spacing:2px; margin-top:4px; }
        hr { border:none; border-top:3px solid #000000; margin:10px 0; }
        .r { display:flex; justify-content:space-between; font-size:15px; font-weight:900; margin-bottom:5px; color:#000000; }
        table { width:100%; border-collapse:collapse; }
        .th { font-size:14px; font-weight:900; text-transform:uppercase; padding-bottom:6px;
              letter-spacing:1px; border-bottom:2px solid #000000; }
        td { font-size:15px; font-weight:900; color:#000000; padding:6px 0; }
        .tr { font-size:16px; font-weight:900; margin:5px 0; display:flex; justify-content:space-between; color:#000000; }
        .gt { display:flex; justify-content:space-between; font-size:22px; font-weight:900;
              padding:8px 0; border-top:3px solid #000000; border-bottom:3px solid #000000;
              -webkit-text-stroke:1.5px #000000;
              text-shadow:0 0 1px #000,1px 0 0 #000,-1px 0 0 #000; }
        .ft { text-align:center; margin-top:12px; font-size:17px; font-weight:900;
              -webkit-text-stroke:0.8px #000000; }
    </style></head><body>
        <div class="c"><div class="name"><b>AI CAVALLI</b></div><div class="sub"><b>RESTAURANT & CAFE</b></div></div>
        <hr>
        <div class="r"><b>Bill No:</b><b>${bill.bill_number}</b></div>
        <div class="r"><b>Date:</b><b>${dateStr} ${timeStr}</b></div>
        <div class="r"><b>Table:</b><b>${order?.table_name || 'N/A'}</b></div>
        <hr>
        <table><thead><tr>
            <th class="th" style="text-align:left;"><b>Item</b></th>
            <th class="th" style="text-align:center;"><b>Qty</b></th>
            <th class="th" style="text-align:right;"><b>Amt</b></th>
        </tr></thead><tbody>${itemsHTML}</tbody></table>
        <hr>
        <div class="tr"><b>Subtotal:</b><b>₹${bill.items_total.toFixed(2)}</b></div>
        ${bill.discount_amount > 0 ? `<div class="tr"><b>Discount:</b><b>-₹${bill.discount_amount.toFixed(2)}</b></div>` : ''}
        <hr>
        <div class="gt"><b>TOTAL:</b><b>₹${bill.final_total.toFixed(2)}</b></div>
        ${bill.payment_method ? `<div class="tr"><b>Payment:</b><b>${bill.payment_method.toUpperCase()}</b></div>` : ''}
        <hr>
        <div class="ft"><b>Thank You! Visit Again!</b></div>
        <div class="c" style="margin-top:4px;font-size:13px;font-weight:900;"><b>Powered by AI Cavalli</b></div>
    </body></html>`

    // Also keep plain text for raw printer fallback
    const lines = [
        '================================',
        '       AI CAVALLI RESTAURANT    ',
        '================================',
        `Bill No: ${bill.bill_number}`,
        `Date: ${dateStr} ${timeStr}`,
        `Table: ${order?.table_name || 'N/A'}`,
        '--------------------------------',
        'ITEM              QTY    AMOUNT',
        '--------------------------------'
    ]

    items.forEach((item: any) => {
        const name = item.item_name.substring(0, 18).padEnd(18)
        const qty = item.quantity.toString().padStart(3)
        const amount = `Rs.${item.subtotal.toFixed(2)}`.padStart(9)
        lines.push(`${name}${qty}${amount}`)
    })

    lines.push('--------------------------------')
    lines.push(`Subtotal:         Rs.${bill.items_total.toFixed(2)}`)

    if (bill.discount_amount > 0) {
        const discountPercent = ((bill.discount_amount / bill.items_total) * 100).toFixed(0)
        lines.push(`Discount (${discountPercent}%):   -Rs.${bill.discount_amount.toFixed(2)}`)
    }

    lines.push('================================')
    lines.push(`TOTAL:            Rs.${bill.final_total.toFixed(2)}`)
    lines.push('================================')

    if (bill.payment_method) {
        lines.push(`Payment: ${bill.payment_method.toUpperCase()}`)
    }

    lines.push('')
    lines.push('      Thank you! Visit again!')
    lines.push('================================')
    lines.push('')
    lines.push('')

    return {
        billNumber: bill.bill_number,
        text: lines.join('\n'),
        html: htmlReceipt,
        lines: lines,
        metadata: {
            billId: bill.id,
            orderId: bill.order_id,
            total: bill.final_total,
            itemCount: items.length
        }
    }
}
