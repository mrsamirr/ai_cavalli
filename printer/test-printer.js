// Quick test script to check printer connection
const testPrint = async () => {
    try {
        const response = await fetch('http://localhost:4000/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                billNumber: 'TEST-001',
                items: [{ name: 'Test Item', quantity: 1, price: 100 }],
                itemsTotal: 100,
                finalTotal: 100,
                paymentMethod: 'CASH'
            })
        });
        const result = await response.json();
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
};

testPrint();
