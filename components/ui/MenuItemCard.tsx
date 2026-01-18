import { Plus } from 'lucide-react'
import { Button } from './button'
import styles from './MenuItemCard.module.css'
import { useCart } from '@/lib/context/CartContext'

interface MenuItem {
    id: string
    name: string
    description: string | null
    price: number
    image_url: string | null
    available: boolean
}

interface MenuItemCardProps {
    item: MenuItem
    onAdd: (item: MenuItem) => void
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
    const { items: cartItems } = useCart()
    const cartItem = cartItems.find(i => i.itemId === item.id)
    const quantity = cartItem?.quantity || 0

    return (
        <div className={`${styles.card} fade-in`}>
            <div className={styles.imageContainer}>
                {item.image_url ? (
                    <div
                        className={styles.image}
                        style={{ backgroundImage: `url(${item.image_url})` }}
                    />
                ) : (
                    <div className={styles.placeholderImage} />
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <h3 className={styles.name}>{item.name}</h3>
                    <span className={styles.price}>₹{item.price.toFixed(2)}</span>
                </div>

                <p className={styles.description}>{item.description}</p>

                <div className={styles.actions}>
                    <Button
                        size="sm"
                        onClick={() => onAdd(item)}
                        disabled={!item.available}
                        className={styles.addButton}
                    >
                        <Plus size={16} style={{ marginRight: '4px' }} />
                        Add {quantity > 0 && `(${quantity})`}
                    </Button>
                </div>
            </div>
        </div>
    )
}
