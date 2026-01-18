'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/database/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/Loading'
import {
    Trash2,
    Edit2,
    Plus,
    Search,
    Image as ImageIcon,
    Check,
    X,
    Filter,
    ArrowLeft,
    Save
} from 'lucide-react'
import Link from 'next/link'

export default function AdminMenuPage() {
    const [items, setItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')
    const [price, setPrice] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [available, setAvailable] = useState(true)
    const [loading, setLoading] = useState(false)
    const [dataLoading, setDataLoading] = useState(true)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        fetchData()

        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    async function fetchData() {
        setDataLoading(true)
        const [catRes, itemRes] = await Promise.all([
            supabase.from('categories').select('*').order('sort_order'),
            supabase.from('menu_items').select('*, category:categories(name)').order('created_at', { ascending: false })
        ])

        if (catRes.data) {
            setCategories(catRes.data)
            if (!categoryId && catRes.data.length > 0) {
                setCategoryId(catRes.data[0].id)
            }
        }
        if (itemRes.data) setItems(itemRes.data)
        setDataLoading(false)
    }

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory
            return matchesSearch && matchesCategory
        })
    }, [items, searchQuery, selectedCategory])

    function resetForm() {
        setEditingId(null)
        setName('')
        setDesc('')
        setPrice('')
        setCategoryId(categories[0]?.id || '')
        setImageUrl('')
        setAvailable(true)
    }

    function handleEdit(item: any) {
        setEditingId(item.id)
        setName(item.name)
        setDesc(item.description || '')
        setPrice(item.price.toString())
        setCategoryId(item.category_id)
        setImageUrl(item.image_url || '')
        setAvailable(item.available !== false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        const finalCategoryId = categoryId || categories[0]?.id

        if (!finalCategoryId) {
            alert('Error: No category selected.')
            setLoading(false)
            return
        }

        const payload = {
            name,
            description: desc,
            price: parseFloat(price),
            category_id: finalCategoryId,
            image_url: imageUrl,
            available: available
        }

        let error
        if (editingId) {
            const result = await supabase.from('menu_items').update(payload).eq('id', editingId)
            error = result.error
        } else {
            const result = await supabase.from('menu_items').insert(payload)
            error = result.error
        }

        if (!error) {
            await fetchData()
            resetForm()
        } else {
            alert(`Error saving item: ${error.message}`)
        }
        setLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this item?')) return
        await supabase.from('menu_items').delete().eq('id', id)
        fetchData()
    }

    if (dataLoading) return <Loading />

    return (
        <div className="container" style={{
            paddingBottom: 'var(--space-12)',
            paddingLeft: 'var(--space-4)',
            paddingRight: 'var(--space-4)',
            maxWidth: '1400px',
            margin: '0 auto'
        }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-10)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', paddingTop: 'var(--space-6)' }}>
                <Link href="/admin">
                    <Button variant="ghost" size="sm" style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}>
                        <ArrowLeft size={20} />
                    </Button>
                </Link>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', margin: 0, color: 'var(--text)' }}>Menu Management</h1>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Configure and manage your menu items</p>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr',
                gap: 'var(--space-8)',
                alignItems: 'start'
            }}>
                {/* Editor Sidebar */}
                <div style={{
                    background: 'var(--surface)',
                    padding: 'var(--space-8)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    position: isMobile ? 'static' : 'sticky',
                    top: 'var(--space-6)',
                    marginBottom: isMobile ? 'var(--space-8)' : 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                        </div>
                        <h3 style={{ margin: 0, fontWeight: 800 }}>{editingId ? 'Edit Item' : 'Create New Item'}</h3>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                        <Input
                            label="Item Name"
                            placeholder="e.g. Wagyu Truffle Burger"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
                            <textarea
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                placeholder="Describe the ingredients and preparation..."
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    minHeight: '100px',
                                    fontSize: '0.9rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            <Input
                                label="Price (₹)"
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                required
                            />
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</label>
                                <select
                                    value={categoryId}
                                    onChange={e => setCategoryId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.85rem',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border)',
                                        background: 'white',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <Input
                            label="Image URL"
                            placeholder="https://images.unsplash.com/..."
                            value={imageUrl}
                            onChange={e => setImageUrl(e.target.value)}
                        />

                        {imageUrl && (
                            <div style={{
                                width: '100%',
                                height: '140px',
                                borderRadius: 'var(--radius)',
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                background: 'rgba(0,0,0,0.02)'
                            }}>
                                <img src={imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'var(--space-4)',
                            background: 'rgba(0,0,0,0.02)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Available for Order</span>
                            <div
                                onClick={() => setAvailable(!available)}
                                style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    background: available ? 'var(--primary)' : 'var(--text-muted)',
                                    transition: 'var(--transition)',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    top: '3px',
                                    left: available ? '23px' : '3px',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    transition: 'var(--transition)'
                                }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                            <Button type="submit" isLoading={loading} style={{ flex: 2, height: '48px' }}>
                                <Save size={18} style={{ marginRight: '8px' }} />
                                {editingId ? 'Update Item' : 'Create Item'}
                            </Button>
                            {editingId && (
                                <Button type="button" variant="outline" onClick={resetForm} style={{ flex: 1 }}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List Section */}
                <div>
                    {/* Filters & Search */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <Search
                                size={18}
                                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                            />
                            <input
                                placeholder="Search menu items..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px 14px 14px 48px',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border)',
                                    fontSize: '1rem',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                            <button
                                onClick={() => setSelectedCategory('all')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    background: selectedCategory === 'all' ? 'var(--primary)' : 'var(--surface)',
                                    color: selectedCategory === 'all' ? 'white' : 'var(--text-muted)',
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)'
                                }}
                            >
                                All Items
                            </button>
                            {categories.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCategory(c.id)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                        background: selectedCategory === c.id ? 'var(--primary)' : 'var(--surface)',
                                        color: selectedCategory === c.id ? 'white' : 'var(--text-muted)',
                                        border: '1px solid var(--border)',
                                        cursor: 'pointer',
                                        transition: 'var(--transition)'
                                    }}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {filteredItems.length === 0 ? (
                            <div style={{ padding: 'var(--space-12)', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                                <div style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                                    <ImageIcon size={48} />
                                </div>
                                <h3 style={{ margin: '0 0 8px 0' }}>No items found</h3>
                                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Try adjusting your search or category filter.</p>
                            </div>
                        ) : (
                            filteredItems.map(item => (
                                <div key={item.id} className="hover-lift" style={{
                                    background: 'var(--surface)',
                                    padding: 'var(--space-4)',
                                    borderRadius: 'var(--radius-lg)',
                                    display: 'flex',
                                    gap: 'var(--space-4)',
                                    alignItems: 'center',
                                    border: item.id === editingId ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    boxShadow: 'var(--shadow-sm)',
                                    opacity: item.available ? 1 : 0.7,
                                    transition: 'var(--transition)'
                                }}>
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                        background: 'rgba(0,0,0,0.05)',
                                        flexShrink: 0
                                    }}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyItems: 'center', color: 'var(--text-muted)' }}>
                                                <ImageIcon size={24} style={{ margin: '0 auto' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>{item.name}</h4>
                                            {!item.available && (
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>Hidden</span>
                                            )}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.category?.name} • <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{item.price.toFixed(2)}</span>
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEdit(item)}
                                            style={{ color: 'var(--primary)', width: '36px', height: '36px', padding: 0 }}
                                        >
                                            <Edit2 size={16} />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(item.id)}
                                            style={{ color: '#EF4444', width: '36px', height: '36px', padding: 0 }}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
