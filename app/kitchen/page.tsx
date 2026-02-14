'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/database/supabase'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    ChevronRight,
    LogOut,
    Sparkles,
    Volume2,
    History,
    LayoutDashboard,
    User,
    Shield,
    Info,
    Download,
    Settings,
    Users,
    Bell,
    CheckCircle2,
    Clock,
    ShoppingBag,
    Utensils,
    Printer,
    Pencil,
    Percent,
    XIcon,
    Receipt,
    BellRing,
    Plus
} from 'lucide-react'
import { Loading } from '@/components/ui/Loading'
import { MenuItemSelector } from '@/components/kitchen/MenuItemSelector'

interface OrderItem {
    id: string
    name: string
    quantity: number
    notes?: string
    price: number
}

interface Order {
    id: string
    user_id: string | null
    table_name: string
    guest_info: { name: string, phone: string } | null
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
    total: number
    discount_amount: number
    ready_in_minutes: number
    num_guests: number | null
    notes: string | null
    location_type: 'indoor' | 'outdoor' | null
    created_at: string
    items?: OrderItem[]
    user?: { role: string, name: string, phone: string } | null
    billed?: boolean
}

type FilterType = 'all' | 'rider' | 'staff' | 'guest'

export default function KitchenPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [completedOrders, setCompletedOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [showCompleted, setShowCompleted] = useState(false)
    const [status, setStatus] = useState<string>('initializing')
    const [audioError, setAudioError] = useState(false)
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
    const [menuItems, setMenuItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [generatingBill, setGeneratingBill] = useState<string | null>(null)
    const [printingBill, setPrintingBill] = useState<string | null>(null)
    const [billData, setBillData] = useState<any>(null)
    const [billRequests, setBillRequests] = useState<any[]>([])
    const [showMenuSelector, setShowMenuSelector] = useState(false)
    const [selectedOrderForMenu, setSelectedOrderForMenu] = useState<string | null>(null)

    const { user, logout, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                user:users(role, name, phone),
                items:order_items(
                    *,
                    menu_item:menu_items(name)
                )
            `)
            .in('status', ['pending', 'preparing', 'ready'])
            .order('created_at', { ascending: true })

        if (data) setOrders(data)
        setLoading(false)
    }

    const fetchCompletedOrders = async () => {
        const { data } = await supabase
            .from('orders')
            .select(`
                *,
                user:users(role, name, phone),
                items:order_items(
                    *,
                    menu_item:menu_items(name)
                )
            `)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(20)

        if (data) setCompletedOrders(data)
    }

    const fetchSingleOrder = async (orderId: string) => {
        const { data } = await supabase
            .from('orders')
            .select(`
                    *,
                    user:users(role, name, phone),
                    items:order_items(
                        *,
                        menu_item:menu_items(name)
                    )
                `)
            .eq('id', orderId)
            .single()
        return data
    }

    // Auth Guard - Allow staff, kitchen_manager, and admin
    useEffect(() => {
        if (!authLoading && (!user || (user.role !== 'KITCHEN' && user.role !== 'ADMIN'))) {
            router.push('/home')
        }
    }, [user, authLoading, router])

    // Subscription & Init
    useEffect(() => {
        fetchOrders()

        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
        audio.load()

        const playSound = () => {
            audio.currentTime = 0
            audio.play().catch(e => {
                console.error('Audio play failed:', e)
                setAudioError(true)
            })
        }

        const channel = supabase
            .channel('kitchen-orders')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        playSound()
                        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                            new Notification('New Order Received!', {
                                body: `New order from ${payload.new.table_name}`,
                                icon: '/favicon.ico'
                            })
                        }
                        const newOrder = await fetchSingleOrder(payload.new.id)
                        if (newOrder && ['pending', 'preparing', 'ready'].includes(newOrder.status)) {
                            setOrders(prev => [newOrder, ...prev])
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = await fetchSingleOrder(payload.new.id)
                        if (updated) {
                            if (['completed', 'cancelled'].includes(updated.status)) {
                                setOrders(prev => prev.filter(o => o.id !== updated.id))
                                setCompletedOrders(prev => [updated, ...prev.slice(0, 19)])
                            } else {
                                setOrders(prev => {
                                    const exists = prev.find(o => o.id === updated.id)
                                    if (exists) {
                                        return prev.map(o => o.id === updated.id ? updated : o)
                                    } else if (['pending', 'preparing', 'ready'].includes(updated.status)) {
                                        return [updated, ...prev]
                                    }
                                    return prev
                                })
                            }
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setOrders(prev => prev.filter(o => o.id !== payload.old.id))
                    }
                }
            )
            .subscribe((status) => {
                setStatus(status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Fetch menu items and categories
    useEffect(() => {
        async function fetchMenuData() {
            const [itemsRes, categoriesRes] = await Promise.all([
                supabase
                    .from('menu_items')
                    .select('*')
                    .eq('available', true)
                    .order('name'),
                supabase
                    .from('categories')
                    .select('*')
                    .order('sort_order')
            ])
            setMenuItems(itemsRes.data || [])
            setCategories(categoriesRes.data || [])
        }
        fetchMenuData()
    }, [])

    // Fetch and subscribe to bill requests
    useEffect(() => {
        async function fetchBillRequests() {
            const { data } = await supabase
                .from('guest_sessions')
                .select('*')
                .eq('status', 'active')
                .eq('bill_requested', true)
                .order('bill_requested_at', { ascending: true })
            setBillRequests(data || [])
        }

        fetchBillRequests()

        // Subscribe to guest_sessions changes for bill requests
        const billChannel = supabase
            .channel('bill-requests')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'guest_sessions' },
                async (payload) => {
                    if (payload.eventType === 'UPDATE' && payload.new.bill_requested) {
                        // New bill request
                        setBillRequests(prev => {
                            const exists = prev.find(r => r.id === payload.new.id)
                            if (!exists) {
                                // Play notification sound
                                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3')
                                audio.play().catch(console.error)
                                return [...prev, payload.new]
                            }
                            return prev.map(r => r.id === payload.new.id ? payload.new : r)
                        })
                    } else if (payload.eventType === 'UPDATE' && payload.new.status === 'ended') {
                        // Session ended, remove from bill requests
                        setBillRequests(prev => prev.filter(r => r.id !== payload.new.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(billChannel)
        }
    }, [])

    // Handle generate session bill
    const handleGenerateSessionBill = async (sessionId: string) => {
        setGeneratingBill(sessionId)
        try {
            const response = await fetch('/api/bills/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, paymentMethod: 'cash' })
            })
            const data = await response.json()
            if (data.success) {
                setBillData(data.bill)
                setBillRequests(prev => prev.filter(r => r.id !== sessionId))
                alert(`Bill ${data.bill.billNumber} generated! Total: ₹${data.bill.finalTotal}`)
            } else {
                alert(`Failed: ${data.error}`)
            }
        } catch (err) {
            alert('Failed to generate bill')
        } finally {
            setGeneratingBill(null)
        }
    }

    // Dismiss bill request (mark as handled without generating bill)
    const dismissBillRequest = (sessionId: string) => {
        setBillRequests(prev => prev.filter(r => r.id !== sessionId))
    }

    const filteredOrders = useMemo(() => {
        if (filter === 'all') return orders
        return orders.filter(order => {
            if (filter === 'guest') return order.guest_info !== null || order.user?.role === 'OUTSIDER'
            if (filter === 'rider') return order.user_id !== null && order.user?.role === 'STUDENT'
            if (filter === 'staff') return order.user_id !== null && order.user?.role === 'STUDENT'
            return true
        })
    }, [orders, filter])

    async function updateStatus(orderId: string, newStatus: string) {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId)

        if (error) {
            alert('Failed to update status')
        } else {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o))
        }
    }

    async function updateDiscount(orderId: string, amount: number) {
        const { error } = await supabase
            .from('orders')
            .update({ discount_amount: amount })
            .eq('id', orderId)

        if (error) {
            alert('Failed to apply discount')
        } else {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, discount_amount: amount } : o))
        }
    }

    async function updateItemQuantity(orderItemId: string, orderId: string, newQuantity: number) {
        if (newQuantity < 1) return
        const { error } = await supabase
            .from('order_items')
            .update({ quantity: newQuantity })
            .eq('id', orderItemId)
        if (error) alert(`Failed to update quantity: ${error.message}`)
        else await fetchOrders()
    }

    async function deleteOrderItem(orderItemId: string, orderId: string) {
        if (!confirm('Delete this item from the order?')) return
        const { error } = await supabase
            .from('order_items')
            .delete()
            .eq('id', orderItemId)
        if (error) alert(`Failed to delete item: ${error.message}`)
        else await fetchOrders()
    }

    async function handleGenerateBill(orderId: string, paymentMethod: string = 'cash') {
        const order = [...orders, ...completedOrders].find(o => o.id === orderId)
        if (!order || !order.items?.length || order.billed) return
        setGeneratingBill(orderId)
        try {
            const response = await fetch('/api/bills/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, paymentMethod })
            })
            const data = await response.json()
            if (data.success) {
                setBillData(data.bill)
                await fetchOrders()
                await fetchCompletedOrders()
                await handlePrintBill(data.bill.id)
            }
        } catch (error) { console.error(error) } finally { setGeneratingBill(null) }
    }

    async function handlePrintBill(billId: string) {
        setPrintingBill(billId)
        try {
            const response = await fetch('/api/bills/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ billId })
            })
            const data = await response.json()
            if (data.success) {
                const printWindow = window.open('', '_blank', 'width=400,height=600')
                if (printWindow) {
                    printWindow.document.write(`<html><body>${data.printData.text}</body></html>`)
                    printWindow.document.close()
                }
            }
        } catch (error) { console.error(error) } finally { setPrintingBill(null) }
    }

    async function addItemToOrder(orderId: string, menuItemId: string) {
        const menuItem = menuItems.find(m => m.id === menuItemId)
        if (!menuItem) return
        const { error } = await supabase.from('order_items').insert({ order_id: orderId, menu_item_id: menuItemId, quantity: 1, price: menuItem.price })
        if (error) alert(error.message)
        else await fetchOrders()
    }

    const getOrderTypeBadge = (order: Order) => {
        if (order.guest_info || order.user?.role === 'OUTSIDER') return { label: 'GUEST', color: '#9333ea', icon: User }
        if (order.user?.role === 'STUDENT') return { label: 'RIDER', color: '#2563eb', icon: LayoutDashboard }
        if (order.user?.role === 'KITCHEN') {
            if (order.notes === 'REGULAR_STAFF_MEAL') return { label: 'REGULAR MEAL', color: '#3B82F6', icon: Shield }
            return { label: 'STAFF', color: '#059669', icon: Shield }
        }
        return { label: 'UNKNOWN', color: '#6b7280', icon: Info }
    }

    if (authLoading || loading) return <Loading fullScreen message="Syncing with Kitchen..." />
    if (!user || (user.role !== 'KITCHEN' && user.role !== 'ADMIN')) return null

    return (
        <div className="fade-in" style={{ padding: 'var(--space-4)', background: 'var(--background)', minHeight: '100vh' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                background: 'white',
                padding: '1.25rem 2rem',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
                border: '1px solid rgba(var(--primary-rgb), 0.1)',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: status === 'SUBSCRIBED' ? '#10B981' : '#EF4444',
                            boxShadow: status === 'SUBSCRIBED' ? '0 0 10px #10B981' : 'none',
                            animation: status === 'SUBSCRIBED' ? 'pulse 2s infinite' : 'none'
                        }} />
                        <h2 style={{
                            margin: 0,
                            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
                            fontWeight: '800',
                            color: 'var(--text)',
                            letterSpacing: '-0.02em'
                        }}>Kitchen Board</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href="/kitchen/specials">
                            <Button variant="outline" size="sm" style={{
                                borderRadius: '12px',
                                fontWeight: '700',
                                border: '1px solid rgba(var(--primary-rgb), 0.2)',
                                background: 'white'
                            }}>
                                <Sparkles size={16} style={{ marginRight: '8px', color: 'var(--primary)' }} />
                                Specials
                            </Button>
                        </Link>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
                            audio.play().then(() => setAudioError(false))
                            if ('Notification' in window) Notification.requestPermission()
                        }}
                        style={{
                            width: '44px',
                            height: '44px',
                            padding: 0,
                            borderRadius: '50%',
                            background: 'rgba(var(--primary-rgb), 0.05)',
                            color: 'var(--primary)'
                        }}
                    >
                        <Volume2 size={20} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => logout()}
                        style={{
                            color: '#64748b',
                            fontWeight: '700',
                            gap: '8px',
                            padding: '0 1.25rem',
                            height: '44px',
                            borderRadius: '12px',
                            background: '#f8fafc'
                        }}
                    >
                        <LogOut size={18} />
                        Exit
                    </Button>
                </div>
            </div>

            {audioError && (
                <div style={{
                    background: '#FFF7ED',
                    color: '#C2410C',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #FFEDD5',
                    marginBottom: 'var(--space-4)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <Info size={16} />
                    <strong>Alert:</strong> Audio notifications are muted. Click the speaker icon to enable.
                </div>
            )}

            {/* Bill Requests Notification Panel */}
            {billRequests.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    padding: 'var(--space-4)',
                    borderRadius: '16px',
                    marginBottom: 'var(--space-4)',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <BellRing size={24} color="white" />
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: 800 }}>
                            BILL REQUESTS ({billRequests.length})
                        </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {billRequests.map((req) => (
                            <div key={req.id} style={{
                                background: 'white',
                                padding: '16px',
                                borderRadius: '12px',
                                minWidth: '250px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                                            {req.table_name}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {req.guest_name} • {req.num_guests} guests
                                        </p>
                                    </div>
                                    <Receipt size={20} color="#10B981" />
                                </div>
                                <p style={{ margin: '8px 0', fontSize: '0.8rem', color: '#666' }}>
                                    Requested {req.bill_requested_at ? new Date(req.bill_requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                                </p>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <Button
                                        onClick={() => handleGenerateSessionBill(req.id)}
                                        disabled={generatingBill === req.id}
                                        size="sm"
                                        style={{
                                            flex: 1,
                                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                            border: 'none',
                                            color: 'white',
                                            fontWeight: 700
                                        }}
                                    >
                                        <Printer size={14} style={{ marginRight: '6px' }} />
                                        {generatingBill === req.id ? 'Generating...' : 'Generate Bill'}
                                    </Button>
                                    <Button
                                        onClick={() => dismissBillRequest(req.id)}
                                        variant="outline"
                                        size="sm"
                                        style={{ borderColor: '#ccc' }}
                                    >
                                        <XIcon size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{
                    display: 'flex',
                    background: 'var(--surface)',
                    padding: '4px',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <button
                        onClick={() => setShowCompleted(false)}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 'var(--radius-xl)',
                            border: 'none',
                            background: !showCompleted ? 'var(--primary)' : 'transparent',
                            color: !showCompleted ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Active <span style={{ opacity: 0.8, fontSize: '0.8em', background: !showCompleted ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '10px' }}>{orders.length}</span>
                    </button>
                    <button
                        onClick={() => {
                            setShowCompleted(true)
                            fetchCompletedOrders()
                        }}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 'var(--radius-xl)',
                            border: 'none',
                            background: showCompleted ? 'var(--primary)' : 'transparent',
                            color: showCompleted ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        History <History size={16} />
                    </button>
                </div>

                {!showCompleted && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {(['all', 'rider', 'staff', 'guest'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid var(--border)',
                                    background: filter === f ? 'var(--text)' : 'var(--surface)',
                                    color: filter === f ? 'white' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)',
                                    textTransform: 'capitalize',
                                    boxShadow: filter === f ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 'var(--space-6)',
                alignItems: 'start'
            }}>
                {(showCompleted ? completedOrders : filteredOrders).length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-12)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>No orders found in this category.</p>
                    </div>
                ) : (
                    (showCompleted ? completedOrders : filteredOrders).map(order => {
                        const badge = getOrderTypeBadge(order)
                        const TypeIcon = badge.icon

                        const statusColors: any = {
                            pending: { color: '#F59E0B', label: 'NEW ORDER', pulse: true },
                            preparing: { color: '#3B82F6', label: 'PREPARING', pulse: false },
                            ready: { color: '#10B981', label: 'READY', pulse: false },
                            completed: { color: 'var(--text-muted)', label: 'COMPLETED', pulse: false }
                        }
                        const sc = statusColors[order.status] || statusColors.pending

                        return (
                            <div key={order.id} className="fade-in" style={{
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-md)',
                                overflow: 'hidden',
                                border: `1px solid var(--border)`,
                                borderTop: `4px solid ${sc.color}`,
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'var(--transition)'
                            }}>
                                <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: sc.color, letterSpacing: '0.05em' }}>{sc.label}</span>
                                            {sc.pulse && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.color, animation: 'pulse 1.5s infinite' }} />}
                                        </div>
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
                                            {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                                <span style={{ color: '#3B82F6' }}>{order.user?.name || 'Staff'}<br /><span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Regular Meal Order</span></span>
                                            ) : order.table_name}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: badge.color }}>
                                            <TypeIcon size={14} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{badge.label}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>ORDER #{order.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                </div>

                                <div style={{ padding: 'var(--space-4)', flex: 1 }}>
                                    <div style={{ marginBottom: 'var(--space-4)' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>ORDER ITEMS</p>
                                        <div style={{ background: 'var(--background)', borderRadius: 'var(--radius)', padding: 'var(--space-3)' }}>
                                            {editingOrderId === order.id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {order.notes === 'REGULAR_STAFF_MEAL' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px dashed rgba(59, 130, 246, 0.3)', marginBottom: '4px' }}>
                                                            <Utensils size={20} color="#3B82F6" />
                                                            <div>
                                                                <div style={{ fontWeight: 800, color: '#3B82F6', fontSize: '1rem' }}>Standard Regular Meal</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Base meal + additional items below</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {order.items?.map((item: any) => (
                                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                            <span style={{ flex: 1, fontWeight: 600 }}>{item.menu_item?.name}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <button onClick={() => updateItemQuantity(item.id, order.id, item.quantity - 1)} disabled={item.quantity <= 1} style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontWeight: 700 }}>-</button>
                                                                <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                                                                <button onClick={() => updateItemQuantity(item.id, order.id, item.quantity + 1)} style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontWeight: 700 }}>+</button>
                                                                <button onClick={() => deleteOrderItem(item.id, order.id)} style={{ width: '28px', height: '28px', borderRadius: '4px', border: '1px solid #DC2626', background: 'white', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedOrderForMenu(order.id)
                                                            setShowMenuSelector(true)
                                                        }}
                                                        style={{ 
                                                            padding: '8px 12px', 
                                                            borderRadius: '8px', 
                                                            border: '1px solid var(--border)', 
                                                            background: 'white', 
                                                            fontWeight: 600, 
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            color: 'var(--primary)',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = '#f5f5f5'
                                                            e.currentTarget.style.borderColor = 'var(--primary)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'white'
                                                            e.currentTarget.style.borderColor = 'var(--border)'
                                                        }}
                                                    >
                                                        <Plus size={18} />
                                                        Add Item
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {order.notes === 'REGULAR_STAFF_MEAL' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px dashed rgba(59, 130, 246, 0.3)', marginBottom: '8px' }}>
                                                            <Utensils size={20} color="#3B82F6" />
                                                            <div>
                                                                <div style={{ fontWeight: 800, color: '#3B82F6', fontSize: '1rem' }}>Standard Regular Meal</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Base meal + additional items below</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {order.items?.map((item: any) => (
                                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 600, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                                            <span>{item.menu_item?.name}</span>
                                                            <span style={{ color: 'var(--primary)' }}>x{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {order.notes && order.notes !== 'REGULAR_STAFF_MEAL' && (
                                        <div style={{ background: '#FEF2F2', color: '#DC2626', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)', fontSize: '0.875rem', borderLeft: '3px solid #EF4444' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.7rem', marginBottom: '2px', textTransform: 'uppercase' }}>Attention: Special Note</div>
                                            {order.notes}
                                        </div>
                                    )}

                                    <div style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)' }}>Order for: </span>
                                            <span style={{ fontWeight: 700 }}>{order.guest_info?.name || order.user?.name || 'Walk-in'}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            {order.location_type && (
                                                <div style={{ background: order.location_type === 'outdoor' ? '#FEF3C7' : '#DBEAFE', color: order.location_type === 'outdoor' ? '#92400E' : '#1E40AF', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase' }}>{order.location_type}</div>
                                            )}
                                            <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>{order.num_guests || 1} GUESTS</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-3)' }}>
                                        {(() => {
                                            const itemsTotal = order.items?.reduce((sum, item: any) => sum + (item.price * item.quantity), 0) || 0
                                            const discountAmount = order.discount_amount > 0 ? itemsTotal * (order.discount_amount / 100) : 0
                                            const finalTotal = itemsTotal - discountAmount
                                            return (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        <span>Items Total</span>
                                                        <span>₹{itemsTotal.toFixed(2)}</span>
                                                    </div>
                                                    {order.discount_amount > 0 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>
                                                            <span>Staff/Rider Discount ({order.discount_amount}%)</span>
                                                            <span>-₹{discountAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>
                                                        <span>Final Total</span>
                                                        <span style={{ color: 'var(--primary)' }}>₹{finalTotal.toFixed(2)}</span>
                                                    </div>
                                                </>
                                            )
                                        })()}
                                    </div>
                                </div>

                                {!showCompleted && (
                                    <div style={{ padding: 'var(--space-4)', background: '#F9FAFB', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        <div style={{ width: '100%' }}>
                                            {order.status === 'pending' && <Button onClick={() => updateStatus(order.id, 'preparing')} size="lg" style={{ width: '100%', height: '56px', fontWeight: 800 }}>START COOKING</Button>}
                                            {order.status === 'preparing' && <Button onClick={() => updateStatus(order.id, 'ready')} size="lg" style={{ width: '100%', height: '56px', fontWeight: 800, background: '#10B981', border: 'none', color: 'white' }}>MARK AS READY</Button>}
                                            {order.status === 'ready' && <Button onClick={() => updateStatus(order.id, 'completed')} size="lg" variant="outline" style={{ width: '100%', height: '56px', fontWeight: 800, color: 'var(--text)', border: '2px solid var(--border)' }}>HAND OVER</Button>}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr', gap: 'var(--space-2)' }}>
                                            <button onClick={() => { const p = prompt('Enter discount %:'); if (p) updateDiscount(order.id, parseFloat(p)) }} style={{ height: '48px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Percent size={18} /></button>
                                            <button onClick={() => setEditingOrderId(editingOrderId === order.id ? null : order.id)} style={{ height: '48px', borderRadius: 'var(--radius)', border: `1px solid ${editingOrderId === order.id ? '#DC2626' : 'var(--border)'}`, background: editingOrderId === order.id ? '#FEE2E2' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: editingOrderId === order.id ? '#DC2626' : 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>{editingOrderId === order.id ? <><XIcon size={16} /> Cancel</> : <><Pencil size={16} /> Edit</>}</button>
                                            {order.billed ? <div style={{ height: '48px', borderRadius: 'var(--radius)', border: '1px solid #10B981', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#059669', fontWeight: 600, fontSize: '0.875rem' }}><CheckCircle2 size={16} /> Billed</div> : <button onClick={() => handleGenerateBill(order.id, 'cash')} disabled={generatingBill === order.id || printingBill !== null} style={{ height: '48px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}><Printer size={16} /> {generatingBill === order.id ? '...' : 'Bill'}</button>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {showMenuSelector && selectedOrderForMenu && (
                <MenuItemSelector
                    items={menuItems}
                    categories={categories}
                    onSelect={(item) => {
                        addItemToOrder(selectedOrderForMenu, item.id)
                    }}
                    onClose={() => {
                        setShowMenuSelector(false)
                        setSelectedOrderForMenu(null)
                    }}
                />
            )}

            <style jsx global>{`
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
            `}</style>
        </div>
    )
}
