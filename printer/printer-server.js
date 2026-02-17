/**
 * ESSAE PR-85 Local Printer Server (Windows Version)
 * 
 * Uses Windows print spooler instead of direct USB access.
 * This is more reliable on Windows as it doesn't require USB drivers.
 * 
 * Usage:
 *   node printer-server.js
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

// Enable CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    methods: ['POST', 'GET'],
    credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', printer: 'ESSAE PR-85', port: PORT });
});

// Print using Windows notepad + print (simple but works!)
app.post('/print', async (req, res) => {
    try {
        const bill = req.body;

        if (!bill) {
            return res.json({ success: false, error: 'No bill data provided' });
        }

        // Format bill data
        const billNumber = bill.billNumber || 'N/A';
        const tableName = bill.sessionDetails?.tableName || bill.tableName || '';
        const guestName = bill.sessionDetails?.guestName || bill.guestName || '';
        const locationType = bill.sessionDetails?.locationType || '';
        const items = bill.items || [];
        const itemsTotal = bill.itemsTotal || 0;
        const discountAmount = bill.discountAmount || 0;
        const finalTotal = bill.finalTotal || 0;
        const paymentMethod = bill.paymentMethod || 'CASH';

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        // Build receipt text (48 chars for 80mm paper)
        const W = 48;
        const line = (char) => char.repeat(W);
        const center = (text) => {
            const pad = Math.floor((W - text.length) / 2);
            return ' '.repeat(Math.max(0, pad)) + text;
        };
        const leftRight = (left, right) => {
            const spaces = W - left.length - right.length;
            return left + ' '.repeat(Math.max(1, spaces)) + right;
        };

        let receipt = '';
        receipt += line('=') + '\n';
        receipt += center('AI CAVALLI') + '\n';
        receipt += center('RESTAURANT') + '\n';
        receipt += line('=') + '\n';
        receipt += '\n';
        receipt += leftRight('Bill No:', billNumber) + '\n';
        receipt += leftRight('Date:', dateStr) + '\n';
        receipt += leftRight('Time:', timeStr) + '\n';
        if (tableName) receipt += leftRight('Table:', tableName) + '\n';
        if (locationType) receipt += leftRight('Location:', locationType.toUpperCase()) + '\n';
        if (guestName) receipt += leftRight('Guest:', guestName) + '\n';
        receipt += '\n';
        receipt += line('-') + '\n';
        receipt += leftRight('ITEM', 'QTY    AMOUNT') + '\n';
        receipt += line('-') + '\n';

        items.forEach((item) => {
            const name = (item.item_name || item.name || 'Item').substring(0, 28);
            const qty = (item.quantity || 1).toString();
            const amt = 'Rs.' + Number(item.subtotal || item.price || 0).toFixed(2);
            receipt += leftRight(name, qty.padStart(3) + '  ' + amt.padStart(10)) + '\n';
        });

        receipt += line('-') + '\n';
        receipt += leftRight('Subtotal:', 'Rs.' + Number(itemsTotal).toFixed(2)) + '\n';
        if (discountAmount > 0) {
            receipt += leftRight('Discount:', '-Rs.' + Number(discountAmount).toFixed(2)) + '\n';
        }
        receipt += line('=') + '\n';
        receipt += leftRight('TOTAL:', 'Rs.' + Number(finalTotal).toFixed(2)) + '\n';
        receipt += line('=') + '\n';
        receipt += '\n';
        receipt += leftRight('Payment:', paymentMethod.toUpperCase()) + '\n';
        receipt += '\n';
        receipt += center('Thank You!') + '\n';
        receipt += center('Visit Again!') + '\n';
        receipt += line('=') + '\n';
        receipt += '\n\n\n';

        // Write to temp file
        const tempFile = path.join(__dirname, 'temp_receipt.txt');
        fs.writeFileSync(tempFile, receipt);

        // Print using Windows print command
        // This sends the file to the default printer
        exec(`print /D:PRN "${tempFile}"`, (error, stdout, stderr) => {
            // Clean up temp file
            try { fs.unlinkSync(tempFile); } catch (e) { }

            if (error) {
                console.error('Print error:', error.message);

                // Try alternative method using notepad
                exec(`notepad /p "${tempFile}"`, (err2) => {
                    if (err2) {
                        return res.json({ success: false, error: error.message });
                    }
                    res.json({ success: true, message: 'Printed via notepad' });
                });
                return;
            }

            console.log(`✅ Bill ${billNumber} printed successfully`);
            res.json({ success: true, message: 'Receipt printed' });
        });

    } catch (error) {
        console.error('Server error:', error);
        res.json({ success: false, error: error.message });
    }
});

// RAW print to specific printer name (if you know the printer name)
app.post('/print-raw', async (req, res) => {
    try {
        const { printerName, bill } = req.body;

        if (!bill) {
            return res.json({ success: false, error: 'No bill data provided' });
        }

        // Build the same receipt format
        const billNumber = bill.billNumber || 'N/A';
        const items = bill.items || [];
        const finalTotal = bill.finalTotal || 0;
        const paymentMethod = bill.paymentMethod || 'CASH';

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });

        // Simple receipt
        let receipt = '';
        receipt += '================================\n';
        receipt += '        AI CAVALLI\n';
        receipt += '        RESTAURANT\n';
        receipt += '================================\n';
        receipt += `Bill: ${billNumber}\n`;
        receipt += `Date: ${dateStr} ${timeStr}\n`;
        receipt += '--------------------------------\n';

        items.forEach((item) => {
            const name = item.item_name || item.name || 'Item';
            const qty = item.quantity || 1;
            const amt = Number(item.subtotal || item.price || 0).toFixed(2);
            receipt += `${name}\n`;
            receipt += `  Qty: ${qty}     Rs.${amt}\n`;
        });

        receipt += '--------------------------------\n';
        receipt += `TOTAL:          Rs.${Number(finalTotal).toFixed(2)}\n`;
        receipt += '================================\n';
        receipt += `Payment: ${paymentMethod}\n`;
        receipt += '\n      Thank You!\n';
        receipt += '================================\n\n\n';

        // Write to temp file  
        const tempFile = path.join(__dirname, 'temp_receipt.txt');
        fs.writeFileSync(tempFile, receipt);

        // Use Windows COPY command to send directly to printer
        const printer = printerName || 'ESSAE';
        exec(`copy /b "${tempFile}" "\\\\%COMPUTERNAME%\\${printer}"`, (error) => {
            try { fs.unlinkSync(tempFile); } catch (e) { }

            if (error) {
                // Fallback to print command
                exec(`print "${tempFile}"`, (err2) => {
                    if (err2) {
                        return res.json({ success: false, error: error.message });
                    }
                    res.json({ success: true, message: 'Printed' });
                });
                return;
            }

            console.log(`✅ Bill ${billNumber} sent to ${printer}`);
            res.json({ success: true, message: 'Receipt printed' });
        });

    } catch (error) {
        console.error('Server error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('🖨️  ========================================');
    console.log('🖨️  ESSAE PR-85 Printer Server (Windows)');
    console.log('🖨️  ========================================');
    console.log(`🖨️  Running on: http://localhost:${PORT}`);
    console.log('🖨️  Health check: http://localhost:4000/health');
    console.log('🖨️  Print endpoint: POST http://localhost:4000/print');
    console.log('🖨️  ========================================');
    console.log('');
    console.log('📝 Important:');
    console.log('   1. Set ESSAE PR-85 as your DEFAULT Windows printer');
    console.log('   2. Go to: Settings > Printers > ESSAE PR-85 > Set as default');
    console.log('   3. Make sure printer is ON and connected');
    console.log('');
});
