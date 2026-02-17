import { NextRequest, NextResponse } from 'next/server'

// Note: escpos-usb requires native USB access which only works in Node.js environments
// This API route handles thermal printing for ESSAE PR-85 POS printers

export async function POST(request: NextRequest) {
    try {
        const { billData } = await request.json()

        if (!billData) {
            return NextResponse.json(
                { success: false, error: 'No bill data provided' },
                { status: 400 }
            )
        }

        // Import escpos dynamically to avoid issues during build
        const escpos = await import('escpos')
        const escposUSB = await import('escpos-usb')

        // Register USB adapter
        escpos.USB = escposUSB.default

        try {
            // Auto-detect USB thermal printer
            const device = new escpos.USB()
            const printer = new escpos.Printer(device)

            // Format bill data
            const billNumber = billData?.billNumber || 'N/A'
            const tableName = billData?.sessionDetails?.tableName || billData?.tableName || ''
            const guestName = billData?.sessionDetails?.guestName || billData?.guestName || ''
            const locationType = billData?.sessionDetails?.locationType || ''
            const items = billData?.items || []
            const itemsTotal = billData?.itemsTotal || 0
            const discountAmount = billData?.discountAmount || 0
            const finalTotal = billData?.finalTotal || 0
            const paymentMethod = billData?.paymentMethod || 'CASH'

            const now = new Date()
            const dateStr = now.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            })
            const timeStr = now.toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true
            })

            // Open device and print
            await new Promise<void>((resolve, reject) => {
                device.open((err: Error | null) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    try {
                        // Header
                        printer
                            .align('CT')
                            .style('B')
                            .size(1, 1)
                            .text('AI CAVALLI')
                            .style('NORMAL')
                            .text('RESTAURANT')
                            .text('================================')
                            .feed(1)

                        // Bill Info
                        printer
                            .align('LT')
                            .text(`Bill No: ${billNumber}`)
                            .text(`Date: ${dateStr}`)
                            .text(`Time: ${timeStr}`)

                        if (tableName) printer.text(`Table: ${tableName}`)
                        if (locationType) printer.text(`Location: ${locationType.toUpperCase()}`)
                        if (guestName) printer.text(`Guest: ${guestName}`)

                        printer
                            .text('--------------------------------')
                            .style('B')
                            .text('ITEMS:')
                            .style('NORMAL')
                            .text('--------------------------------')

                        // Items
                        items.forEach((item: any) => {
                            const name = item.item_name || item.name || 'Item'
                            const qty = item.quantity || 1
                            const amt = Number(item.subtotal || item.price || 0).toFixed(2)
                            printer.text(name)
                            printer.text(`  Qty: ${qty}     Rs.${amt}`)
                        })

                        printer.text('--------------------------------')

                        // Totals
                        printer.text(`Subtotal:          Rs.${Number(itemsTotal).toFixed(2)}`)

                        if (discountAmount > 0) {
                            printer.text(`Discount:         -Rs.${Number(discountAmount).toFixed(2)}`)
                        }

                        printer
                            .text('================================')
                            .style('B')
                            .size(1, 1)
                            .text(`TOTAL:             Rs.${Number(finalTotal).toFixed(2)}`)
                            .size(0, 0)
                            .style('NORMAL')
                            .text('================================')
                            .feed(1)
                            .text(`Payment: ${paymentMethod.toUpperCase()}`)
                            .feed(1)

                        // Footer
                        printer
                            .align('CT')
                            .style('B')
                            .text('Thank You!')
                            .style('NORMAL')
                            .text('Visit Again!')
                            .text('================================')
                            .feed(3)
                            .cut()
                            .close(() => {
                                resolve()
                            })

                    } catch (printError) {
                        reject(printError)
                    }
                })
            })

            return NextResponse.json({ success: true, message: 'Receipt printed successfully' })

        } catch (printerError: any) {
            console.error('Printer error:', printerError)

            // Return specific error for USB not found
            if (printerError.message?.includes('No devices found') ||
                printerError.message?.includes('USB')) {
                return NextResponse.json({
                    success: false,
                    error: 'USB printer not found. Make sure the printer is connected and powered on.',
                    fallback: true
                }, { status: 503 })
            }

            return NextResponse.json({
                success: false,
                error: printerError.message || 'Failed to print',
                fallback: true
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Thermal print API error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error', fallback: true },
            { status: 500 }
        )
    }
}
