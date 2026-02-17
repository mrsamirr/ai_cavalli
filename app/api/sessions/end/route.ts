import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    try {
        const { sessionId, paymentMethod = 'upi' } = await request.json()

        const supabase = createClient(supabaseUrl, supabaseKey)

        // AUTH GUARD: Verify requester
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Authorization header missing' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requester }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !requester) {
            return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 })
        }

        // Fetch requester's role for staff bypass
        const { data: profile } = await supabase.from('users').select('role').eq('id', requester.id).single()
        const isStaff = profile && ['staff', 'admin', 'kitchen_manager'].includes(profile.role)

        // Get session with all orders
        const { data: session, error: sessionError } = await supabase
            .from('guest_sessions')
            .select(`
        *,
        orders (
          id,
          total,
          discount_amount,
          created_at,
          status,
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

        // VERIFY OWNERSHIP: Only owner or staff can end it
        if (!isStaff && session.user_id !== requester.id) {
            console.warn(`Unauthorized session end attempt by user ${requester.id} for session ${sessionId}`)
            return NextResponse.json({ success: false, error: 'Unauthorized to end this session' }, { status: 403 })
        }

        if (session.status !== 'active') {
            return NextResponse.json(
                { success: false, error: 'Session already ended' },
                { status: 400 }
            )
        }

        // Calculate totals from orders
        const orders = session.orders || []

        if (orders.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No orders in this session' },
                { status: 400 }
            )
        }

        const totalAmount = orders.reduce((sum: number, order: any) => {
            return sum + parseFloat(order.total || 0)
        }, 0)

        // Fetch user email if linked
        let userEmail = null;
        if (session.user_id) {
            const { data: userData } = await supabase
                .from('users')
                .select('email')
                .eq('id', session.user_id)
                .single();
            userEmail = userData?.email;
        }

        // Send Email Bill if email available
        let emailResult = { success: false, error: 'No email found for user' };
        if (userEmail) {
            const { sendOrderBillEmail } = require('@/lib/utils/email');

            // Collect all items from all orders
            const allItems: any[] = [];
            orders.forEach((order: any) => {
                if (order.order_items) {
                    order.order_items.forEach((item: any) => {
                        allItems.push({
                            name: item.menu_items?.name || 'Item',
                            quantity: item.quantity,
                            price: item.price
                        });
                    });
                }
            });

            emailResult = await sendOrderBillEmail(userEmail, {
                sessionId: session.id,
                items: allItems,
                totalAmount: totalAmount
            });
        }

        // Update session status
        const { error: updateError } = await supabase
            .from('guest_sessions')
            .update({
                status: 'ended',
                ended_at: new Date().toISOString(),
                total_amount: totalAmount,
                payment_method: paymentMethod,
                whatsapp_sent: false, // Legacy field
                // Add note to metadata or just leave as is since we don't have email_sent column yet
                notes: emailResult.success ? `Bill sent to email: ${userEmail}` : `Email failed: ${emailResult.error}`
            })
            .eq('id', sessionId)

        if (updateError) {
            console.error('Session update error:', updateError)
            return NextResponse.json(
                { success: false, error: 'Failed to update session' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            session: {
                id: sessionId,
                totalAmount,
                orderCount: orders.length,
                emailSent: emailResult.success,
                emailError: emailResult.error
            },
            message: emailResult.success
                ? 'Session ended! Bill sent to your email successfully.'
                : `Session ended. ${emailResult.error}`
        })

    } catch (error) {
        console.error('End session error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
