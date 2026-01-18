'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/database/supabase'
import { SearchInput } from '@/components/ui/SearchInput'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MenuItemCard } from '@/components/ui/MenuItemCard'
import { useCart } from '@/lib/context/CartContext'

export default function GuestMenuPage() {
    const [categories, setCategories] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [specials, setSpecials] = useState<any[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const { addToCart, items: cartItems } = useCart()

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const today = new Date().toISOString().split('T')[0]

            const [catRes, itemRes, specialRes] = await Promise.all([
                supabase.from('categories').select('*').order('sort_order'),
                supabase.from('menu_items').select('*').eq('available', true),
                supabase.from('daily_specials')
                    .select('*, menu_item:menu_items(*)')
                    .eq('date', today)
            ])

            if (catRes.data) setCategories(catRes.data)
            if (itemRes.data) setItems(itemRes.data)
            if (specialRes.data) {
                const specialItems = specialRes.data.map((s: any) => ({
                    ...s.menu_item,
                    special_period: s.period
                }))
                setSpecials(specialItems)
            }
            setLoading(false)
        }
        fetchData()
    }, [])

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            return matchesCategory && matchesSearch
        })
    }, [items, activeCategory, searchQuery])

    const handleAddToCart = (item: any) => {
        addToCart(item)
    }

    return (
        <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)', margin: 0 }}>Menu</h1>
                </div>
                {cartItems.length > 0 && (
                    <Link href="/guest/cart" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold' }}>
                        <ShoppingCart size={20} />
                        <span>{cartItems.length}</span>
                    </Link>
                )}
            </div>

            <SearchInput
                placeholder="Search for food..."
                value={searchQuery}
                onSearch={setSearchQuery}
            />

            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1rem', scrollbarWidth: 'none', paddingTop: '1rem' }}>
                <CategoryBadge name="All" isActive={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
                {categories.map(cat => (
                    <CategoryBadge key={cat.id} name={cat.name} isActive={activeCategory === cat.id} onClick={() => setActiveCategory(cat.id)} />
                ))}
            </div>

            {specials.length > 0 && !searchQuery && (
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--secondary)' }}>Today's Specials</h2>
                    {specials.map(item => (
                        <MenuItemCard
                            key={`special-${item.id}`}
                            item={item}
                            onAdd={handleAddToCart}
                        />
                    ))}
                    <div style={{ height: '1px', background: 'var(--border)', margin: '1.5rem 0' }} />
                </div>
            )}

            <div className="menu-grid">
                {loading ? (
                    <p>Loading menu...</p>
                ) : filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                        <MenuItemCard key={item.id} item={item} onAdd={handleAddToCart} />
                    ))
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        <p>No items found.</p>
                    </div>
                )}
            </div>

            {/* Floating Cart Button for Mobile */}
            {cartItems.length > 0 && (
                <Link href="/guest/cart">
                    <div style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '2rem',
                        background: 'var(--primary)',
                        color: 'white',
                        width: '3.5rem',
                        height: '3.5rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(192, 39, 45, 0.4)',
                        zIndex: 100
                    }}>
                        <ShoppingCart size={24} />
                        <span style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            background: 'var(--secondary)',
                            color: 'black',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            width: '1.25rem',
                            height: '1.25rem',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>{cartItems.length}</span>
                    </div>
                </Link>
            )}
        </div>
    )
}
