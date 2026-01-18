'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function KitchenSpecialsPage() {
    const [items, setItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [specials, setSpecials] = useState<any[]>([])

    // Selection state
    const [selectedItem, setSelectedItem] = useState('')
    const [period, setPeriod] = useState<string>('breakfast')

    // Quick create state
    const [isCreatingNew, setIsCreatingNew] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPrice, setNewPrice] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newImageUrl, setNewImageUrl] = useState('')
    const [newCategoryId, setNewCategoryId] = useState('')

    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        const today = new Date().toISOString().split('T')[0]

        // Fetch all menu items + categories
        const [menuRes, catRes, specialRes] = await Promise.all([
            supabase.from('menu_items').select('*').eq('available', true),
            supabase.from('categories').select('*').order('sort_order'),
            supabase.from('daily_specials').select('*, menu_item:menu_items(*)').eq('date', today)
        ])

        if (menuRes.data) setItems(menuRes.data)
        if (catRes.data) {
            setCategories(catRes.data)
            const specialsCat = catRes.data.find((c: any) => c.name === "Today's Specials")
            if (specialsCat) {
                setNewCategoryId(specialsCat.id)
            } else if (catRes.data.length > 0) {
                setNewCategoryId(catRes.data[0].id)
            }
        }
        if (specialRes.data) setSpecials(specialRes.data)
        setLoading(false)
    }

    async function handleQuickCreate(e: React.FormEvent) {
        e.preventDefault()
        if (!newName || !newPrice) return
        setLoading(true)

        // 1. Create Menu Item
        const { data: item, error: itemError } = await supabase
            .from('menu_items')
            .insert({
                name: newName,
                description: newDescription,
                price: parseFloat(newPrice),
                image_url: newImageUrl,
                category_id: newCategoryId,
                available: true
            })
            .select()
            .single()

        if (itemError) {
            alert('Error creating menu item: ' + itemError.message)
            setLoading(false)
            return
        }

        // 2. Add as Special
        const { error: specialError } = await supabase.from('daily_specials').insert({
            menu_item_id: item.id,
            period: period,
            date: new Date().toISOString().split('T')[0]
        })

        if (!specialError) {
            setIsCreatingNew(false)
            setNewName('')
            setNewPrice('')
            setNewDescription('')
            setNewImageUrl('')
            fetchData()
        } else {
            alert('Item created but failed to add as special: ' + specialError.message)
        }
        setLoading(false)
    }

    async function addSpecial() {
        if (!selectedItem) return

        const { error } = await supabase.from('daily_specials').insert({
            menu_item_id: selectedItem,
            period: period
        })

        if (error) {
            alert('Failed to add special (maybe duplicate?)')
        } else {
            fetchData()
        }
    }

    async function removeSpecial(id: string) {
        await supabase.from('daily_specials').delete().eq('id', id)
        fetchData()
    }

    return (
        <div style={{ background: '#fcfcfc', minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <Link href="/kitchen" style={{ color: '#666', display: 'flex', alignItems: 'center' }}>
                        <ArrowLeft size={24} />
                    </Link>
                    <h2 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>Manage Daily Specials</h2>
                </div>

                <div style={{ marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem', display: 'flex', gap: '2rem' }}>
                    <button
                        onClick={() => setIsCreatingNew(false)}
                        style={{
                            background: 'none', border: 'none', padding: '0.5rem 0',
                            borderBottom: !isCreatingNew ? '3px solid var(--primary)' : '3px solid transparent',
                            fontWeight: !isCreatingNew ? 'bold' : 'normal', cursor: 'pointer', color: !isCreatingNew ? 'var(--primary)' : '#888'
                        }}
                    >
                        Pick Existing Item
                    </button>
                    <button
                        onClick={() => setIsCreatingNew(true)}
                        style={{
                            background: 'none', border: 'none', padding: '0.5rem 0',
                            borderBottom: isCreatingNew ? '3px solid var(--primary)' : '3px solid transparent',
                            fontWeight: isCreatingNew ? 'bold' : 'normal', cursor: 'pointer', color: isCreatingNew ? 'var(--primary)' : '#888'
                        }}
                    >
                        Create New Item
                    </button>
                </div>

                {!isCreatingNew ? (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: '#666' }}>Menu Item</label>
                            <select
                                value={selectedItem}
                                onChange={(e) => setSelectedItem(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                            >
                                <option value="">Select an item...</option>
                                {items.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} (₹{item.price})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ width: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: '#666' }}>Period</label>
                            <select
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                            >
                                <option value="breakfast">Breakfast</option>
                                <option value="lunch">Lunch</option>
                            </select>
                        </div>

                        <Button onClick={addSpecial} disabled={!selectedItem}>Add Special</Button>
                    </div>
                ) : (
                    <form onSubmit={handleQuickCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                            <Input label="Dish Name" placeholder="e.g. Eggs Benedict" value={newName} onChange={e => setNewName(e.target.value)} required />
                            <Input label="Price (₹)" type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} required />
                        </div>

                        <Input label="Description" placeholder="Optional details about the dish..." value={newDescription} onChange={e => setNewDescription(e.target.value)} />

                        <Input label="Image URL (Public)" placeholder="https://..." value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} />

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                            <div style={{ width: '150px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: '#666' }}>Period</label>
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                                >
                                    <option value="breakfast">Breakfast</option>
                                    <option value="lunch">Lunch</option>
                                </select>
                            </div>
                            <Button type="submit" isLoading={loading} style={{ flex: 1 }}>Create & Add Special</Button>
                        </div>
                    </form>
                )}

                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Current Specials</h3>

                {loading ? <p>Loading...</p> : specials.length === 0 ? <p>No specials set for today.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {specials.map(special => (
                            <div key={special.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                background: '#f9f9f9',
                                borderRadius: 'var(--radius)'
                            }}>
                                <div>
                                    <span style={{
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        background: special.period === 'breakfast' ? '#e0f2fe' : '#fef3c7',
                                        color: special.period === 'breakfast' ? '#0369a1' : '#d97706',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        marginRight: '0.75rem'
                                    }}>
                                        {special.period}
                                    </span>
                                    <span style={{ fontWeight: 500 }}>{special.menu_item?.name}</span>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => removeSpecial(special.id)} style={{ color: 'red' }}>
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
