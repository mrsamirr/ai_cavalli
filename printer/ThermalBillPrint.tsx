'use client'

import { useRef } from 'react'

interface BillItem {
    item_name: string
    quantity: number
    price: number
    subtotal: number
}

interface BillData {
    billNumber: string
    guestName?: string
    tableName?: string
    items: BillItem[]
    itemsTotal: number
    discountAmount?: number
    finalTotal: number
    paymentMethod?: string
    createdAt?: string
}

interface ThermalBillPrintProps {
    bill: BillData
    onPrintComplete?: () => void
}

export function ThermalBillPrint({ bill, onPrintComplete }: ThermalBillPrintProps) {
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        const printContent = printRef.current
        if (!printContent) return

        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'width=300,height=600')
        if (!printWindow) {
            alert('Please allow popups to print bills')
            return
        }

        // Format date
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

        // Build thermal print HTML
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bill ${bill.billNumber}</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        width: 80mm;
                        padding: 5mm;
                        background: white;
                        color: black;
                    }
                    .header {
                        text-align: center;
                        font-weight: bold;
                        font-size: 14px;
                        margin-bottom: 5px;
                    }
                    .subheader {
                        text-align: center;
                        font-size: 10px;
                        margin-bottom: 10px;
                    }
                    .divider {
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        margin-bottom: 3px;
                    }
                    .items-header {
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                        font-size: 11px;
                        margin-bottom: 5px;
                    }
                    .item-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        margin-bottom: 3px;
                    }
                    .item-name {
                        flex: 1;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        max-width: 35mm;
                    }
                    .item-qty {
                        width: 15mm;
                        text-align: center;
                    }
                    .item-price {
                        width: 20mm;
                        text-align: right;
                    }
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        margin-bottom: 3px;
                    }
                    .grand-total {
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .footer {
                        text-align: center;
                        font-size: 11px;
                        margin-top: 10px;
                    }
                    .thank-you {
                        text-align: center;
                        font-weight: bold;
                        font-size: 12px;
                        margin-top: 10px;
                    }
                    @media print {
                        body { width: 80mm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">AI CAVALLI</div>
                <div class="subheader">RESTAURANT & CAFE</div>
                
                <div class="divider"></div>
                
                <div class="info-row">
                    <span>Bill No:</span>
                    <span>${bill.billNumber}</span>
                </div>
                <div class="info-row">
                    <span>Date:</span>
                    <span>${dateStr}</span>
                </div>
                <div class="info-row">
                    <span>Time:</span>
                    <span>${timeStr}</span>
                </div>
                ${bill.tableName ? `
                <div class="info-row">
                    <span>Table:</span>
                    <span>${bill.tableName}</span>
                </div>
                ` : ''}
                ${bill.guestName ? `
                <div class="info-row">
                    <span>Guest:</span>
                    <span>${bill.guestName}</span>
                </div>
                ` : ''}
                
                <div class="divider"></div>
                
                <div class="items-header">
                    <span class="item-name">ITEM</span>
                    <span class="item-qty">QTY</span>
                    <span class="item-price">AMT</span>
                </div>
                
                ${bill.items.map(item => `
                    <div class="item-row">
                        <span class="item-name">${item.item_name}</span>
                        <span class="item-qty">${item.quantity}</span>
                        <span class="item-price">₹${item.subtotal.toFixed(0)}</span>
                    </div>
                `).join('')}
                
                <div class="divider"></div>
                
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>₹${bill.itemsTotal.toFixed(2)}</span>
                </div>
                
                ${bill.discountAmount && bill.discountAmount > 0 ? `
                <div class="total-row">
                    <span>Discount:</span>
                    <span>-₹${bill.discountAmount.toFixed(2)}</span>
                </div>
                ` : ''}
                
                <div class="divider"></div>
                
                <div class="total-row grand-total">
                    <span>TOTAL:</span>
                    <span>₹${bill.finalTotal.toFixed(2)}</span>
                </div>
                
                ${bill.paymentMethod ? `
                <div class="total-row">
                    <span>Payment:</span>
                    <span>${bill.paymentMethod.toUpperCase()}</span>
                </div>
                ` : ''}
                
                <div class="divider"></div>
                
                <div class="thank-you">Thank You! Visit Again!</div>
                <div class="footer">
                    <br>
                    Powered by AI Cavalli
                </div>
            </body>
            </html>
        `)

        printWindow.document.close()

        // Wait for content to load then print
        printWindow.onload = () => {
            printWindow.focus()
            printWindow.print()
            printWindow.onafterprint = () => {
                printWindow.close()
                onPrintComplete?.()
            }
        }

        // Fallback for browsers that don't support onafterprint
        setTimeout(() => {
            if (!printWindow.closed) {
                printWindow.print()
            }
        }, 500)
    }

    return { handlePrint }
}

// Utility function to print bill directly
export function printThermalBill(bill: BillData): Promise<void> {
    return new Promise((resolve) => {
        const { handlePrint } = ThermalBillPrint({ bill, onPrintComplete: resolve })
        handlePrint()
    })
}
