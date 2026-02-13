'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/database/supabase'
import { SearchInput } from '@/components/ui/SearchInput'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MenuItemCard, MenuItem } from '@/components/ui/MenuItemCard'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'
import { ChevronLeft, Utensils, X, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { Loading } from '@/components/ui/Loading'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface MenuPageItem extends MenuItem {
    category_id: string;
    special_period?: string;
}

interface Category {
    id: string;
    name: string;
    sort_order: number;
}

export default function MenuPage() {
    const { user, isLoading: authLoading } = useAuth()
    const role = user?.role
    const [categories, setCategories] = useState<Category[]>([])
    const [items, setItems] = useState<MenuPageItem[]>([])
    const [specials, setSpecials] = useState<MenuPageItem[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const { addToCart } = useCart()
    const router = useRouter()
    const [isOrderingMeal, setIsOrderingMeal] = useState(false)
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)

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
            if (cat.name === 'Fixed Menu' && role !== 'STUDENT') {
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

    // Create virtual Regular Meal item for staff
    const regularMealItem: MenuItem | null = useMemo(() => {
        if (role !== 'STUDENT') return null
        return {
            id: 'REGULAR_MEAL_VIRTUAL',
            name: 'Regular Staff Meal',
            description: 'Standard meal for staff members (Free)',
            price: 0,
            image_url: '',
            available: true
        }
    }, [role])

    const handleAddToCart = (item: MenuItem) => {
        addToCart(item)
    }

    if (loading) {
        return <Loading fullScreen message="Preparing the menu..." />
    }
    const ITALIAN_RED = '#A91E22';
    const DEEP_BLACK = '#1A1A1A';
    const PAGE_BG = '#FDFBF7';

    return (
        <>
            <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: '1rem' }}>
                    {/* Header: Editorial Style */}
                    <header className="container" style={{ paddingTop: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', }}>
                            <Link href="/home" style={{ color: ITALIAN_RED, transition: 'transform 0.2s' }} className="hover-scale">
                                <ChevronLeft size={32} strokeWidth={1.5} />
                            </Link>
                            <div>
                                <span style={{ letterSpacing: '0.4em', fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>
                                    Ai Cavalli Ristorante
                                </span>
                                <h1 style={{ margin: 0, fontSize: '3rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
                                    La Carta
                                </h1>
                            </div>
                        </div>
                    </header>

                </div>

                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'rgba(253, 251, 247, 0.9)',
                    backdropFilter: 'blur(8px)',
                    margin: '0 calc(-1 * var(--space-4)) var(--space-6)',
                    padding: 'var(--space-4) var(--space-4) var(--space-4)',
                    borderBottom: '1px solid var(--border)'
                }}>
                    <SearchInput
                        placeholder="What are you craving?"
                        value={searchQuery}
                        onSearch={setSearchQuery}
                    />

                </div>

                {/* Regular Meal Section - Only for Staff */}
                {regularMealItem && (
                    <div style={{ marginBottom: 'var(--space-10)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ width: '8px', height: '24px', background: '#059669', borderRadius: '4px' }} />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Regular Staff Meal</h2>
                        </div>
                        <div className="menu-grid">
                            <MenuItemCard item={regularMealItem} onAdd={handleAddToCart} />
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-8) 0' }} />
                    </div>
                )}

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
                {role === 'STUDENT' && filteredFixedItems.length > 0 && (activeCategory === 'all' || activeCategory === fixedMenuCategoryId) && (
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

            {/* Floating Category Menu Container */}
            <div style={{
                position: 'fixed',
                bottom: '120px', // Lifted slightly from the very bottom
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10001,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                maxWidth: '320px',
                padding: '0 20px'
            }}>
                {/* The Pop-up Menu */}
                {isCategoryMenuOpen && (
                    <div
                        style={{
                            width: '100%',
                            maxHeight: '400px',
                            background: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderRadius: '32px',
                            padding: '1.25rem',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '16px',
                            animation: 'slideUpCenter 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            overflowY: 'auto'
                        }}
                        className="scrollbar-hide"
                    >
                        <div style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: '#999',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            marginBottom: '8px'
                        }}>Select Collection</div>

                        <button
                            onClick={() => { setActiveCategory('all'); setIsCategoryMenuOpen(false); }}
                            style={{
                                textAlign: 'center',
                                padding: '1rem',
                                borderRadius: '20px',
                                border: 'none',
                                background: activeCategory === 'all' ? ITALIAN_RED : 'rgba(0,0,0,0.03)',
                                color: activeCategory === 'all' ? 'white' : DEEP_BLACK,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: '0.95rem'
                            }}
                        >
                            All Dishes
                        </button>

                        {displayedCategories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setIsCategoryMenuOpen(false); }}
                                style={{
                                    textAlign: 'center',
                                    padding: '1rem',
                                    borderRadius: '20px',
                                    border: 'none',
                                    background: activeCategory === cat.id ? ITALIAN_RED : 'rgba(0,0,0,0.03)',
                                    color: activeCategory === cat.id ? 'white' : DEEP_BLACK,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    fontSize: '0.95rem'
                                }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* The Trigger Button - Capsule Style */}
                <button
                    onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                    style={{
                        width: isCategoryMenuOpen ? '72px' : '180px', // Morphing effect
                        height: '64px',
                        borderRadius: '40px',
                        background: isCategoryMenuOpen ? 'white' : ITALIAN_RED,
                        color: isCategoryMenuOpen ? DEEP_BLACK : 'white',
                        border: 'none',
                        boxShadow: '0 12px 30px rgba(169, 30, 34, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        fontWeight: 700,
                        letterSpacing: '0.05em'
                    }}
                >
                    {isCategoryMenuOpen ? (
                        <X size={28} />
                    ) : (
                        <>
                            <LayoutGrid size={22} />
                            <span style={{ fontSize: '0.9rem' }}>CATEGORIES</span>
                        </>
                    )}
                </button>
            </div>

            <style jsx>{`
                @keyframes slideUpCenter {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
            `}</style>
        </>
    )
}
