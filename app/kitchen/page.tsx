'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/database/supabase'
import { useAuth } from '@/lib/auth/context'
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
    ShoppingBag
} from 'lucide-react'
import { Loading } from '@/components/ui/Loading'

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
    items?: any[]
    user?: { role: string, name: string, phone: string } | null
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

    const { signOut } = useAuth()

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
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        playSound()
                        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                            new Notification('New Order Received!', {
                                body: `New order from ${payload.new.table_name}`,
                                icon: '/favicon.ico'
                            })
                        }
                    }
                    fetchOrders()
                }
            )
            .subscribe((status) => {
                setStatus(status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    async function fetchOrders() {
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

    async function fetchCompletedOrders() {
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

    const filteredOrders = useMemo(() => {
        if (filter === 'all') return orders
        return orders.filter(order => {
            if (filter === 'guest') return order.guest_info !== null
            if (filter === 'rider') return order.user_id !== null && order.user?.role === 'student'
            if (filter === 'staff') return order.user_id !== null && order.user?.role === 'staff'
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

    const getOrderTypeBadge = (order: Order) => {
        if (order.guest_info) return { label: 'GUEST', color: '#9333ea', icon: User }
        if (order.user?.role === 'student') return { label: 'RIDER', color: '#2563eb', icon: LayoutDashboard }
        if (order.user?.role === 'staff') return { label: 'STAFF', color: '#059669', icon: Shield }
        return { label: 'UNKNOWN', color: '#6b7280', icon: Info }
    }

    if (loading) return <Loading fullScreen message="Syncing with Kitchen..." />

    return (
        <div className="fade-in" style={{ padding: 'var(--space-4)', background: 'var(--background)', minHeight: '100vh' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                background: 'var(--surface)',
                padding: 'var(--space-4) var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: status === 'SUBSCRIBED' ? '#10B981' : '#EF4444', animation: status === 'SUBSCRIBED' ? 'pulse 2s infinite' : 'none' }} />
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-serif)', color: 'var(--text)' }}>Kitchen Board</h2>
                    </div>
                    <Link href="/kitchen/specials">
                        <Button variant="outline" size="sm" style={{ borderRadius: 'var(--radius-xl)' }}>
                            <Sparkles size={16} style={{ marginRight: '8px' }} />
                            Daily Specials
                        </Button>
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
                            audio.play().then(() => setAudioError(false))
                            if ('Notification' in window) Notification.requestPermission()
                        }}
                    >
                        <Volume2 size={18} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => signOut()} style={{ color: 'var(--text-muted)' }}>
                        <LogOut size={18} style={{ marginRight: '8px' }} />
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
                                        <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{order.table_name}</h3>
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
                                            <div style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--primary)',
                                                background: 'rgba(var(--primary-rgb), 0.1)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <Clock size={10} />
                                                <span>{order.ready_in_minutes} MIN SLOT</span>
                                            </div>
                                        </div>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>ORDER #{order.id.slice(0, 6).toUpperCase()}</p>
                                    </div>
                                </div>

                                <div style={{ padding: 'var(--space-4)', flex: 1 }}>
                                    <div style={{ marginBottom: 'var(--space-4)' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>ORDER ITEMS</p>
                                        <div style={{ background: 'var(--background)', borderRadius: 'var(--radius)', padding: 'var(--space-3)' }}>
                                            {order.items?.map((item: any) => (
                                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 600, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                                    <span>{item.menu_item?.name}</span>
                                                    <span style={{ color: 'var(--primary)' }}>x{item.quantity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {order.notes && (
                                        <div style={{
                                            background: '#FEF2F2',
                                            color: '#DC2626',
                                            padding: 'var(--space-3)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginBottom: 'var(--space-4)',
                                            fontSize: '0.875rem',
                                            borderLeft: '3px solid #EF4444'
                                        }}>
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
                                                <div style={{
                                                    background: order.location_type === 'outdoor' ? '#FEF3C7' : '#DBEAFE',
                                                    color: order.location_type === 'outdoor' ? '#92400E' : '#1E40AF',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontWeight: 800,
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {order.location_type}
                                                </div>
                                            )}
                                            <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>
                                                {order.num_guests || 1} GUESTS
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            <span>Original Amount</span>
                                            <span>₹{order.total.toFixed(2)}</span>
                                        </div>
                                        {order.discount_amount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>
                                                <span>Staff/Rider Discount</span>
                                                <span>-₹{order.discount_amount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', fontWeight: 800, marginTop: '2px' }}>
                                            <span>Final Total</span>
                                            <span style={{ color: 'var(--primary)' }}>₹{(order.total - (order.discount_amount || 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {!showCompleted && (
                                    <div style={{ padding: 'var(--space-4)', background: '#F9FAFB', borderTop: '1px solid var(--border)', display: 'flex', gap: 'var(--space-3)' }}>
                                        {order.status === 'pending' && (
                                            <Button onClick={() => updateStatus(order.id, 'preparing')} size="lg" style={{ flex: 1, height: '48px', fontWeight: 800 }}>
                                                START COOKING
                                            </Button>
                                        )}
                                        {order.status === 'preparing' && (
                                            <Button onClick={() => updateStatus(order.id, 'ready')} size="lg" style={{ flex: 1, height: '48px', fontWeight: 800, background: '#10B981' }}>
                                                MARK AS READY
                                            </Button>
                                        )}
                                        {order.status === 'ready' && (
                                            <Button onClick={() => updateStatus(order.id, 'completed')} size="lg" variant="outline" style={{ flex: 1, height: '48px', fontWeight: 800, color: 'var(--text)' }}>
                                                HAND OVER
                                            </Button>
                                        )}
                                        <button
                                            onClick={() => {
                                                const amount = prompt('Enter discount amount:')
                                                if (amount) updateDiscount(order.id, parseFloat(amount))
                                            }}
                                            style={{ width: '48px', height: '48px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                                            title="Apply Discount"
                                        >
                                            %
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

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
