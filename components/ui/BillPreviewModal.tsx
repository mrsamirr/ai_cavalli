'use client'

import { useRef, useCallback } from 'react'
import { X, Printer, Download, Receipt } from 'lucide-react'
import styles from './BillPreviewModal.module.css'

export interface BillItem {
    item_name: string
    quantity: number
    price: number
    subtotal: number
}

export interface BillData {
    id?: string
    billNumber: string
    guestName?: string
    tableName?: string
    items: BillItem[]
    itemsTotal: number
    discountAmount?: number
    finalTotal: number
    paymentMethod?: string
    createdAt?: string
    sessionDetails?: {
        guestName?: string
        tableName?: string
        numGuests?: number
        orderCount?: number
        startedAt?: string
    }
}

interface BillPreviewModalProps {
    bill: BillData
    onClose: () => void
    onPrintComplete?: () => void
}

export function BillPreviewModal({ bill, onClose, onPrintComplete }: BillPreviewModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null)

    const now = bill.createdAt ? new Date(bill.createdAt) : new Date()
    const dateStr = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
    const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })

    const guestName = bill.sessionDetails?.guestName || bill.guestName || ''
    const tableName = bill.sessionDetails?.tableName || bill.tableName || ''
    const orderCount = bill.sessionDetails?.orderCount
    const numGuests = bill.sessionDetails?.numGuests

    // Build the receipt HTML for print/PDF
    const buildPrintHTML = useCallback(() => {
        const itemsHTML = bill.items.map(item => `
            <tr>
                <td style="text-align:left;padding:3px 0;font-size:12px;">${item.item_name}</td>
                <td style="text-align:center;padding:3px 0;font-size:12px;color:#666;">${item.quantity}</td>
                <td style="text-align:right;padding:3px 0;font-size:12px;font-weight:600;">₹${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('')

        return `
<!DOCTYPE html>
<html>
<head>
    <title>Bill ${bill.billNumber} - AI Cavalli</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 2mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            width: 80mm;
            max-width: 80mm;
            padding: 4mm;
            background: white;
            color: #1a1a1a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .restaurant-name { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
        .subtitle { font-size: 10px; color: #666; margin-top: 2px; }
        hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
        .info { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
        .info .label { color: #666; }
        .info .value { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        .items-header th {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #444;
            padding-bottom: 4px;
            font-weight: 700;
        }
        .total-row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
        .discount { color: #10B981; }
        .grand-total {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 900;
            padding: 6px 0;
        }
        .footer { text-align: center; margin-top: 10px; font-size: 11px; color: #666; }
        .thank-you { font-weight: 700; font-size: 12px; color: #1a1a1a; }
    </style>
</head>
<body>
    <div class="center">
        <div class="restaurant-name">AI CAVALLI</div>
        <div class="subtitle">RESTAURANT & CAFE</div>
    </div>
    <hr>
    <div class="info"><span class="label">Bill No:</span><span class="value">${bill.billNumber}</span></div>
    <div class="info"><span class="label">Date:</span><span class="value">${dateStr}</span></div>
    <div class="info"><span class="label">Time:</span><span class="value">${timeStr}</span></div>
    ${tableName ? `<div class="info"><span class="label">Table:</span><span class="value">${tableName}</span></div>` : ''}
    ${guestName ? `<div class="info"><span class="label">Guest:</span><span class="value">${guestName}</span></div>` : ''}
    ${numGuests ? `<div class="info"><span class="label">Guests:</span><span class="value">${numGuests}</span></div>` : ''}
    ${orderCount ? `<div class="info"><span class="label">Orders:</span><span class="value">${orderCount}</span></div>` : ''}
    <hr>
    <table>
        <thead>
            <tr class="items-header">
                <th style="text-align:left;">Item</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Amt</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>
    <hr>
    <div class="total-row"><span>Subtotal:</span><span>₹${bill.itemsTotal.toFixed(2)}</span></div>
    ${bill.discountAmount && bill.discountAmount > 0 ? `<div class="total-row discount"><span>Discount:</span><span>-₹${bill.discountAmount.toFixed(2)}</span></div>` : ''}
    <hr>
    <div class="grand-total"><span>TOTAL:</span><span>₹${bill.finalTotal.toFixed(2)}</span></div>
    ${bill.paymentMethod ? `<div class="total-row"><span>Payment:</span><span>${bill.paymentMethod.toUpperCase()}</span></div>` : ''}
    <hr>
    <div class="footer">
        <div class="thank-you">Thank You! Visit Again!</div>
        <div style="margin-top:4px;">Powered by AI Cavalli</div>
    </div>
</body>
</html>`
    }, [bill, dateStr, timeStr, guestName, tableName, numGuests, orderCount])

    // Open browser print dialog (works for both printing and saving as PDF via browser)
    const handlePrint = useCallback(() => {
        const printWindow = window.open('', '_blank', 'width=350,height=700')
        if (!printWindow) {
            alert('Please allow popups to print the bill')
            return
        }

        printWindow.document.write(buildPrintHTML())
        printWindow.document.close()

        printWindow.onload = () => {
            printWindow.focus()
            printWindow.print()
            printWindow.onafterprint = () => {
                printWindow.close()
                onPrintComplete?.()
            }
        }

        // Fallback for browsers without onafterprint
        setTimeout(() => {
            if (!printWindow.closed) {
                printWindow.focus()
                printWindow.print()
            }
        }, 600)
    }, [buildPrintHTML, onPrintComplete])

    // Save as PDF: Opens print dialog with instructions to select "Save as PDF"
    const handleSavePDF = useCallback(() => {
        const printWindow = window.open('', '_blank', 'width=350,height=700')
        if (!printWindow) {
            alert('Please allow popups to save the bill as PDF')
            return
        }

        // Add a hint banner for Save as PDF
        const htmlContent = buildPrintHTML().replace(
            '</body>',
            `<div id="pdf-hint" style="
                position:fixed;top:0;left:0;right:0;
                background:#C0272D;color:white;
                text-align:center;padding:8px;
                font-family:sans-serif;font-size:12px;font-weight:600;
                z-index:9999;
            ">
                Select "Save as PDF" as the destination in the print dialog
            </div>
            <script>
                window.onafterprint = function() {
                    var hint = document.getElementById('pdf-hint');
                    if (hint) hint.remove();
                };
            </script>
            </body>`
        )

        printWindow.document.write(htmlContent)
        printWindow.document.close()

        printWindow.onload = () => {
            printWindow.focus()
            printWindow.print()
            printWindow.onafterprint = () => {
                printWindow.close()
            }
        }

        setTimeout(() => {
            if (!printWindow.closed) {
                printWindow.focus()
                printWindow.print()
            }
        }, 600)
    }, [buildPrintHTML])

    // Send to thermal printer via local print server
    const handleThermalPrint = useCallback(async () => {
        try {
            // Try local printer server first (for ESSAE PR-85 or similar)
            const response = await fetch('http://localhost:4000/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billNumber: bill.billNumber,
                    tableName,
                    guestName,
                    items: bill.items,
                    itemsTotal: bill.itemsTotal,
                    discountAmount: bill.discountAmount || 0,
                    finalTotal: bill.finalTotal,
                    paymentMethod: bill.paymentMethod || 'CASH',
                    sessionDetails: bill.sessionDetails
                })
            })

            const data = await response.json()
            if (data.success) {
                alert('Bill sent to thermal printer!')
                onPrintComplete?.()
            } else {
                throw new Error(data.error || 'Printer error')
            }
        } catch (error: any) {
            // Fallback to browser print if printer server isn't running
            const useBrowserPrint = confirm(
                'Thermal printer not available.\n\n' +
                `${error.message || 'Could not connect to printer server.'}\n\n` +
                'Would you like to use browser print instead?'
            )
            if (useBrowserPrint) {
                handlePrint()
            }
        }
    }, [bill, tableName, guestName, handlePrint, onPrintComplete])

    // Close on overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
    }

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modal}>
                {/* Header */}
                <div className={styles.header}>
                    <h2>
                        <Receipt size={20} />
                        Bill Preview
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                {/* Receipt Preview */}
                <div className={styles.billContent}>
                    <div className={styles.receipt} ref={receiptRef}>
                        {/* Restaurant Header */}
                        <div className={styles.receiptHeader}>
                            <h3>AI CAVALLI</h3>
                            <p>RESTAURANT & CAFE</p>
                        </div>

                        <hr className={styles.divider} />

                        {/* Bill Info */}
                        <div className={styles.infoRow}>
                            <span>Bill No:</span>
                            <span>{bill.billNumber}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span>Date:</span>
                            <span>{dateStr}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span>Time:</span>
                            <span>{timeStr}</span>
                        </div>
                        {tableName && (
                            <div className={styles.infoRow}>
                                <span>Table:</span>
                                <span>{tableName}</span>
                            </div>
                        )}
                        {guestName && (
                            <div className={styles.infoRow}>
                                <span>Guest:</span>
                                <span>{guestName}</span>
                            </div>
                        )}
                        {numGuests && (
                            <div className={styles.infoRow}>
                                <span>Guests:</span>
                                <span>{numGuests}</span>
                            </div>
                        )}
                        {orderCount && (
                            <div className={styles.infoRow}>
                                <span>Orders:</span>
                                <span>{orderCount}</span>
                            </div>
                        )}

                        <hr className={styles.divider} />

                        {/* Items Header */}
                        <div className={styles.itemsHeader}>
                            <span>Item</span>
                            <span>Qty</span>
                            <span>Amt</span>
                        </div>

                        {/* Items */}
                        {bill.items.map((item, index) => (
                            <div key={index} className={styles.itemRow}>
                                <span>{item.item_name}</span>
                                <span>{item.quantity}</span>
                                <span>₹{item.subtotal.toFixed(2)}</span>
                            </div>
                        ))}

                        <hr className={styles.divider} />

                        {/* Totals */}
                        <div className={styles.totalSection}>
                            <div className={styles.totalRow}>
                                <span>Subtotal:</span>
                                <span>₹{bill.itemsTotal.toFixed(2)}</span>
                            </div>
                            {bill.discountAmount && bill.discountAmount > 0 && (
                                <div className={`${styles.totalRow} ${styles.discount}`}>
                                    <span>Discount:</span>
                                    <span>-₹{bill.discountAmount.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <hr className={styles.divider} />

                        <div className={styles.grandTotal}>
                            <span>TOTAL:</span>
                            <span>₹{bill.finalTotal.toFixed(2)}</span>
                        </div>

                        {bill.paymentMethod && (
                            <div className={styles.infoRow}>
                                <span>Payment:</span>
                                <span>{bill.paymentMethod.toUpperCase()}</span>
                            </div>
                        )}

                        <hr className={styles.divider} />

                        {/* Footer */}
                        <div className={styles.receiptFooter}>
                            <p className={styles.thankYou}>Thank You! Visit Again!</p>
                            <p>Powered by AI Cavalli</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button className={styles.printBtn} onClick={handlePrint}>
                        <Printer size={20} />
                        Print Bill
                    </button>
                    <div className={styles.secondaryActions}>
                        <button className={styles.savePdfBtn} onClick={handleSavePDF}>
                            <Download size={18} />
                            Save as PDF
                        </button>
                        <button className={styles.thermalPrintBtn} onClick={handleThermalPrint}>
                            <Receipt size={18} />
                            Thermal Print
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
