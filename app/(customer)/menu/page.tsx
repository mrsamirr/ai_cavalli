'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/database/supabase'
import { SearchInput } from '@/components/ui/SearchInput'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MenuItemCard } from '@/components/ui/MenuItemCard'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Loading } from '@/components/ui/Loading'

export default function MenuPage() {
    const { role } = useAuth()
    const [categories, setCategories] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])
    const [specials, setSpecials] = useState<any[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const { addToCart } = useCart()

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

            if (catRes.data) {
                setCategories(catRes.data)
            }
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

    const displayedCategories = useMemo(() => {
        return categories.filter(cat => {
            if (cat.name === 'Fixed Menu' && role !== 'staff') {
                return false
            }
            return true
        })
    }, [categories, role])

    const fixedMenuCategoryId = useMemo(() => {
        return categories.find(c => c.name === 'Fixed Menu')?.id
    }, [categories])

    const fixedMenuItems = useMemo(() => {
        if (!fixedMenuCategoryId) return []
        return items.filter(item => item.category_id === fixedMenuCategoryId)
    }, [items, fixedMenuCategoryId])

    const filteredItems = useMemo(() => {
        // Find if the active category is "Today's Specials"
        const specCat = categories.find(c => c.name === "Today's Specials")
        const isSpecialsActive = activeCategory === 'specials' || (specCat && activeCategory === specCat.id)

        if (isSpecialsActive && specials.length > 0) {
            // Show items from daily_specials table with search filtering
            return specials.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
                return matchesSearch
            })
        }

        return items.filter(item => {
            // Exclude fixed menu items from "All" category
            if (activeCategory === 'all' && item.category_id === fixedMenuCategoryId) return false

            const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            return matchesCategory && matchesSearch
        })
    }, [items, activeCategory, searchQuery, specials, categories, fixedMenuCategoryId])

    const filteredFixedItems = useMemo(() => {
        return fixedMenuItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            return matchesSearch
        })
    }, [fixedMenuItems, searchQuery])

    const handleAddToCart = (item: any) => {
        console.log('Adding to cart:', item)
        addToCart(item)
    }

    if (loading) {
        return <Loading fullScreen message="Preparing the menu..." />
    }

    return (
        <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <Link href="/home" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={32} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)' }}>Menu</h1>
            </div>

            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'rgba(253, 251, 247, 0.9)',
                backdropFilter: 'blur(8px)',
                margin: '0 calc(-1 * var(--space-4)) var(--space-6)',
                padding: 'var(--space-4) var(--space-4) 0',
                borderBottom: '1px solid var(--border)'
            }}>
                <SearchInput
                    placeholder="What are you craving?"
                    value={searchQuery}
                    onSearch={setSearchQuery}
                />

                <div style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    overflowX: 'auto',
                    paddingBottom: 'var(--space-4)',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    paddingTop: 'var(--space-4)'
                }}>
                    <CategoryBadge
                        name="All"
                        isActive={activeCategory === 'all'}
                        onClick={() => setActiveCategory('all')}
                    />
                    {displayedCategories.map(cat => (
                        <CategoryBadge
                            key={cat.id}
                            name={cat.name}
                            isActive={activeCategory === cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Specials Highlight Section */}
            {specials.length > 0 && !searchQuery && (activeCategory === 'all' || activeCategory === 'specials' || (categories.find(c => c.name === "Today's Specials")?.id === activeCategory)) && (
                <div style={{ marginBottom: 'var(--space-10)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ width: '8px', height: '24px', background: 'var(--primary)', borderRadius: '4px' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Today's Specials</h2>
                    </div>
                    <div className="menu-grid">
                        {specials.map(item => (
                            <MenuItemCard key={`special-${item.id}`} item={item} onAdd={handleAddToCart} />
                        ))}
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-8) 0' }} />
                </div>
            )}

            {/* Staff Fixed Menu Section - Only for Staff */}
            {role === 'staff' && filteredFixedItems.length > 0 && (activeCategory === 'all' || activeCategory === fixedMenuCategoryId) && (
                <div style={{ marginBottom: 'var(--space-10)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ width: '8px', height: '24px', background: '#3B82F6', borderRadius: '4px' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Staff Fixed Menu</h2>
                    </div>
                    <div className="menu-grid">
                        {filteredFixedItems.map(item => (
                            <MenuItemCard key={`fixed-${item.id}`} item={item} onAdd={handleAddToCart} />
                        ))}
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-8) 0' }} />
                </div>
            )}

            <div className="menu-grid">
                {filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                        <MenuItemCard key={item.id} item={item} onAdd={handleAddToCart} />
                    ))
                ) : (
                    <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-6)', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '1.25rem', fontWeight: 500 }}>No dishes found</p>
                        <p>Try searching for something else or explore another category.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
