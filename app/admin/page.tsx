'use client'

import { useEffect, useState } from 'react'
import {
    TrendingUp,
    ShoppingBag,
    Clock,
    Download,
    Settings,
    Users,
    FileText,
    ArrowUpRight,
    ArrowDownRight,
    Menu as MenuIcon,
    PieChart as PieChartIcon,
    BarChart2,
    Sparkles,
    Activity,
    DollarSign,
    Package
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    LineChart,
    Line
} from 'recharts'
import { supabase } from '@/lib/database/supabase'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/Loading'
import Link from 'next/link'

interface Order {
    id: string
    total: number
    status: string
    created_at: string
    table_name: string
    num_guests: number | null
    discount_amount: number
    user?: { role: string }
    guest_info?: any
    items?: any[]
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        growth: 12.5,
        avgOrderValue: 0,
        todayRevenue: 0
    })

    const [recentOrders, setRecentOrders] = useState<Order[]>([])
    const [revenueData, setRevenueData] = useState<any[]>([])
    const [categoryData, setCategoryData] = useState<any[]>([])
    const [demographicData, setDemographicData] = useState<any[]>([])
    const [hourlyData, setHourlyData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                *,
                user:users(role),
                items:order_items(
                    *,
                    menu_item:menu_items(
                        category:categories(name)
                    )
                )
            `)
            .order('created_at', { ascending: false })

        if (orders) {
            const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0)
            const today = new Date().toLocaleDateString()
            const todayRevenue = orders
                .filter(o => new Date(o.created_at).toLocaleDateString() === today)
                .reduce((sum, o) => sum + (o.total || 0), 0)

            const pending = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length
            const avgVal = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0'

            setStats({
                totalOrders: orders.length,
                totalRevenue,
                pendingOrders: pending,
                growth: 12.5,
                avgOrderValue: parseFloat(avgVal),
                todayRevenue
            })
            setRecentOrders(orders.slice(0, 5))

            // 1. Process Revenue Data
            const dailyRevenue: { [key: string]: { date: string, amount: number, orders: number } } = {}
            orders.slice(0, 50).forEach(o => {
                const date = new Date(o.created_at).toLocaleDateString('en-US', { weekday: 'short' })
                if (!dailyRevenue[date]) dailyRevenue[date] = { date, amount: 0, orders: 0 }
                dailyRevenue[date].amount += (o.total || 0)
                dailyRevenue[date].orders++
            })
            setRevenueData(Object.values(dailyRevenue).reverse().slice(-7))

            // 2. Process Demographic Data (User role: student -> UI label: Rider)
            const demographics = { rider: 0, staff: 0, guest: 0 }
            orders.forEach(o => {
                const role = o.user?.role || 'guest'
                if (role === 'student') demographics.rider++
                else if (role === 'staff') demographics.staff++
                else demographics.guest++
            })
            setDemographicData([
                { name: 'Riders', value: demographics.rider, color: '#C0272D' },
                { name: 'Staff', value: demographics.staff, color: '#3B82F6' },
                { name: 'Guests', value: demographics.guest, color: '#10B981' }
            ])

            // 3. Process Category Data
            const categories: { [key: string]: number } = {}
            orders.forEach(o => {
                o.items?.forEach((item: any) => {
                    const catName = item.menu_item?.category?.name || 'Other'
                    categories[catName] = (categories[catName] || 0) + item.quantity
                })
            })
            const catChart = Object.entries(categories)
                .map(([name, count], idx) => ({
                    name,
                    count,
                    color: ['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#3B82F6'][idx % 5]
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
            setCategoryData(catChart)

            // 4. Process Hourly Activity
            const hourly: { [key: string]: number } = {}
            orders.filter(o => new Date(o.created_at).toLocaleDateString() === today).forEach(o => {
                const hour = new Date(o.created_at).toLocaleTimeString([], { hour: 'numeric' })
                hourly[hour] = (hourly[hour] || 0) + 1
            })
            const hourlyChart = Object.entries(hourly).map(([hour, orders]) => ({ hour, orders }))
            setHourlyData(hourlyChart.length > 0 ? hourlyChart : [{ hour: 'Now', orders: 0 }])
        }
        setLoading(false)
    }

    function downloadCSV() {
        supabase.from('orders')
            .select(`
                *,
                user:users(*),
                items:order_items(
                    *,
                    menu_item:menu_items(name)
                )
            `)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                if (!data) return
                const headers = ['Customer Name', 'Parent Name', 'Phone Number', 'Role', 'Guests', 'Items Ordered', 'Money Spent (₹)', 'Timestamp']
                const rows = data.map(o => {
                    const role = o.user?.role || (o.guest_info ? 'guest' : 'unknown')
                    const name = o.user?.name || o.guest_info?.name || 'Guest'
                    const parentName = o.user?.role === 'student' ? (o.user?.parent_name || 'N/A') : ''
                    const phone = o.user?.phone || o.guest_info?.phone || 'N/A'
                    const guests = o.num_guests || 1
                    const itemSummary = o.items ? o.items.map((i: any) => `${i.menu_item?.name} (x${i.quantity})`).join('; ') : 'No items'
                    const finalTotal = (o.total - (o.discount_amount || 0)).toFixed(2)
                    const timestamp = new Date(o.created_at).toLocaleString()
                    return [`"${name}"`, `"${parentName}"`, `"${phone}"`, role === 'student' ? 'RIDER' : role.toUpperCase(), guests, `"${itemSummary}"`, finalTotal, `"${timestamp}"`]
                })
                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `detailed_orders_report_${new Date().toISOString().split('T')[0]}.csv`
                a.click()
                window.URL.revokeObjectURL(url)
            })
    }

    if (loading) return <Loading />

    return (
        <div style={{
            minHeight: '100vh',
            background: 'rgb(245, 245, 245)',
            padding: 'clamp(1rem, 3vw, 2rem)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Animated Background Elements */}
            <div style={{ position: 'fixed', top: '10%', left: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(192,39,45,0.08) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '10%', right: '5%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(192,39,45,0.06) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

            <div style={{ maxWidth: '1600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #C0272D 0%, #EF4444 100%)',
                                    padding: '12px',
                                    borderRadius: '16px',
                                    boxShadow: '0 8px 16px rgba(192,39,45,0.3)'
                                }}>
                                    <Activity size={28} color="white" />
                                </div>
                                <h1 style={{
                                    fontSize: '3rem',
                                    fontWeight: '900',
                                    margin: 0,
                                    background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    letterSpacing: '-0.03em'
                                }}>
                                    Command Center
                                </h1>
                            </div>
                            <p style={{ color: '#6b7280', margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                                Real-time system analytics and control
                            </p>
                        </div>
                        <button onClick={downloadCSV} style={{
                            background: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#1f2937',
                            padding: '14px 28px',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                        }}>
                            <Download size={18} />
                            Export Data
                        </button>
                    </div>

                    {/* Live Status Bar */}
                    <div style={{
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#10B981',
                            boxShadow: '0 0 12px #10B981',
                            animation: 'pulse 2s infinite'
                        }} />
                        <span style={{ color: '#10B981', fontWeight: '700', fontSize: '0.9rem' }}>
                            System Active • Last updated: {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <StatCard
                        label="Total Revenue"
                        value={`₹${stats.totalRevenue.toLocaleString()}`}
                        icon={<DollarSign size={24} />}
                        color="#10B981"
                        trend="+12.5%"
                        subtitle="vs last month"
                        sparkline={[40, 45, 42, 48, 52, 55, 58]}
                    />
                    <StatCard
                        label="Total Orders"
                        value={stats.totalOrders.toString()}
                        icon={<ShoppingBag size={24} />}
                        color="#3B82F6"
                        trend="+8.2%"
                        subtitle="growth rate"
                        sparkline={[30, 35, 32, 40, 45, 48, 50]}
                    />
                    <StatCard
                        label="Active Orders"
                        value={stats.pendingOrders.toString()}
                        icon={<Clock size={24} />}
                        color="#F59E0B"
                        trend="-2"
                        subtitle="since last hour"
                        sparkline={[15, 12, 14, 10, 12, 9, 8]}
                    />
                    <StatCard
                        label="Avg Order Value"
                        value={`₹${stats.avgOrderValue}`}
                        icon={<TrendingUp size={24} />}
                        color="#8B5CF6"
                        trend="+5.3%"
                        subtitle="per transaction"
                        sparkline={[32, 34, 33, 35, 36, 37, 36]}
                    />
                </div>

                {/* Main Charts Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Revenue Chart */}
                    <ChartCard title="Revenue Analytics" icon={<TrendingUp size={20} />} color="#10B981">
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    style={{ fontSize: '12px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    style={{ fontSize: '12px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        backdropFilter: 'blur(10px)',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#10B981"
                                    strokeWidth={3}
                                    fill="url(#revenueGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* Hourly Activity */}
                    <ChartCard title="Today's Activity" icon={<Activity size={20} />} color="#3B82F6">
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="hour"
                                    stroke="#64748b"
                                    style={{ fontSize: '11px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    style={{ fontSize: '11px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="orders"
                                    stroke="#3B82F6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3B82F6', r: 5 }}
                                    activeDot={{ r: 7 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                {/* Secondary Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Demographics Donut */}
                    <ChartCard title="Order Demographics" icon={<PieChartIcon size={20} />} color="#8B5CF6">
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={demographicData}
                                    innerRadius={60}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {demographicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                            {demographicData.map((d, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: d.color }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#cbd5e1' }}>{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </ChartCard>

                    {/* Category Performance */}
                    <ChartCard title="Top Categories" icon={<Package size={20} />} color="#F59E0B">
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={categoryData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={80}
                                    style={{ fontSize: '11px', fontWeight: '700', fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                />
                                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={18}>
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* Quick Actions */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(192,39,45,0.1) 0%, rgba(192,39,45,0.05) 100%)',
                        border: '1px solid rgba(192,39,45,0.2)',
                        borderRadius: '20px',
                        padding: '24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Sparkles size={20} color="#C0272D" />
                            <h3 style={{ margin: 0, fontWeight: '800', color: '#1f2937', fontSize: '1.1rem' }}>Quick Actions</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <ActionButton icon={<MenuIcon size={16} />} label="Menu Management" href="/admin/menu" />
                            <ActionButton icon={<FileText size={16} />} label="Announcements" href="/admin/cms" />
                            <ActionButton icon={<Users size={16} />} label="User Control" href="/admin/users" />
                            <ActionButton icon={<Settings size={16} />} label="Settings" />
                        </div>
                    </div>
                </div>

                {/* Recent Orders Table */}
                <div style={{
                    background: 'rgba(15,23,42,0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}>
                    <div style={{
                        padding: '24px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{ margin: 0, fontWeight: '800', color: 'white', fontSize: '1.2rem' }}>
                            Recent Transactions
                        </h3>
                        <button style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#94a3b8',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}>
                            View All
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb' }}>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Table</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Guests</th>
                                    <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                                    <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order, idx) => (
                                    <tr key={order.id} style={{
                                        borderTop: '1px solid #f1f5f9',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.85rem',
                                                fontWeight: '700',
                                                color: '#64748b'
                                            }}>
                                                #{order.id.slice(0, 8).toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{ fontWeight: '700', color: '#1f2937' }}>{order.table_name}</span>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '800' }}>
                                                {order.num_guests || 1}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                            <span style={{ fontWeight: '800', color: '#10B981', fontSize: '1rem' }}>
                                                ₹{order.total.toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                /* Responsive table on mobile */
                @media (max-width: 768px) {
                    table {
                        font-size: 0.85rem;
                    }
                    th, td {
                        padding: 12px 16px !important;
                    }
                }
                
                @media (max-width: 640px) {
                    /* Stack stat cards on mobile */
                    [style*="gridTemplateColumns"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    )
}

function StatCard({ label, value, icon, color, trend, subtitle, sparkline }) {
    return (
        <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
        }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`, filter: 'blur(20px)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                    background: `${color}20`,
                    border: `1px solid ${color}40`,
                    padding: '12px',
                    borderRadius: '14px',
                    boxShadow: `0 4px 12px ${color}30`
                }}>
                    <div style={{ color }}>{icon}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        color: trend.startsWith('+') ? '#10B981' : '#EF4444',
                        background: trend.startsWith('+') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        {trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {trend}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {label}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1f2937', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                {value}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>
                {subtitle}
            </div>

            {/* Mini Sparkline */}
            <svg width="100%" height="40" style={{ marginTop: '16px' }}>
                <polyline
                    points={sparkline.map((val, idx) => `${(idx / (sparkline.length - 1)) * 100}%,${40 - (val / Math.max(...sparkline)) * 35}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.6"
                />
            </svg>
        </div>
    )
}

function ChartCard({ title, icon, color, children }) {
    return (
        <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    background: `${color}20`,
                    border: `1px solid ${color}40`,
                    padding: '10px',
                    borderRadius: '12px'
                }}>
                    <div style={{ color }}>{icon}</div>
                </div>
                <h3 style={{ margin: 0, fontWeight: '800', color: '#1f2937', fontSize: '1.1rem' }}>{title}</h3>
            </div>
            {children}
        </div>
    )
}

function ActionButton({ icon, label, href }: { icon: any, label: string, href?: string }) {
    const Component = href ? Link : 'button'
    return (
        <Component href={href as any} style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: '#1f2937',
            fontWeight: '600',
            fontSize: '0.9rem',
            width: '100%',
            textAlign: 'left',
            textDecoration: 'none'
        }}>
            {icon}
            <span>{label}</span>
        </Component>
    )
}

function StatusBadge({ status }) {
    const statusConfig = {
        pending: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#F59E0B', label: 'Pending' },
        preparing: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#3B82F6', label: 'Preparing' },
        ready: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', color: '#10B981', label: 'Ready' },
        completed: { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)', color: '#64748b', label: 'Completed' }
    }

    const config = statusConfig[status] || statusConfig.completed

    return (
        <span style={{
            background: config.bg,
            border: `1px solid ${config.border}`,
            color: config.color,
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-block'
        }}>
            {config.label}
        </span>
    )
}