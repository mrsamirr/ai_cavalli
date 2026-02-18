'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react'
import styles from './Popup.module.css'

type PopupType = 'success' | 'error' | 'warning' | 'info' | 'confirm'

interface PopupState {
    type: PopupType
    title: string
    message: string
    onConfirm?: () => void
    onCancel?: () => void
    confirmText?: string
    cancelText?: string
}

// Singleton listeners
let showPopupFn: ((state: PopupState) => void) | null = null

/**
 * Show a centered popup message. Use instead of alert() / confirm().
 */
export function showPopup(opts: PopupState) {
    if (showPopupFn) showPopupFn(opts)
}

/** Shortcut: show error popup */
export function showError(title: string, message: string) {
    showPopup({ type: 'error', title, message })
}

/** Shortcut: show success popup */
export function showSuccess(title: string, message: string) {
    showPopup({ type: 'success', title, message })
}

/** Shortcut: show info popup */
export function showInfo(title: string, message: string) {
    showPopup({ type: 'info', title, message })
}

/** Shortcut: show confirm popup returning a promise */
export function showConfirm(
    title: string,
    message: string,
    confirmText = 'Yes',
    cancelText = 'Cancel'
): Promise<boolean> {
    return new Promise((resolve) => {
        showPopup({
            type: 'confirm',
            title,
            message,
            confirmText,
            cancelText,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
        })
    })
}

const icons: Record<PopupType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
    confirm: HelpCircle,
}

/**
 * Mount this once in your root layout. It renders the popup when triggered.
 */
export function PopupProvider() {
    const [popup, setPopup] = useState<PopupState | null>(null)

    useEffect(() => {
        showPopupFn = (state) => setPopup(state)
        return () => { showPopupFn = null }
    }, [])

    const close = useCallback(() => setPopup(null), [])

    const handleConfirm = useCallback(() => {
        popup?.onConfirm?.()
        close()
    }, [popup, close])

    const handleCancel = useCallback(() => {
        popup?.onCancel?.()
        close()
    }, [popup, close])

    if (!popup) return null

    const Icon = icons[popup.type]
    const isConfirm = popup.type === 'confirm'

    return (
        <div className={styles.popupOverlay} onClick={isConfirm ? undefined : close}>
            <div className={styles.popupBox} onClick={(e) => e.stopPropagation()}>
                <div className={styles.iconWrap}>
                    <div className={`${styles.iconCircle} ${styles[popup.type]}`}>
                        <Icon size={28} />
                    </div>
                </div>

                <div className={styles.popupContent}>
                    <h3 className={styles.popupTitle}>{popup.title}</h3>
                    <p className={styles.popupMessage}>{popup.message}</p>
                </div>

                <div className={`${styles.popupActions} ${isConfirm ? '' : styles.single}`}>
                    {isConfirm ? (
                        <>
                            <button
                                className={`${styles.popupBtn} ${styles.btnSecondary}`}
                                onClick={handleCancel}
                            >
                                {popup.cancelText || 'Cancel'}
                            </button>
                            <button
                                className={`${styles.popupBtn} ${styles.btnPrimary}`}
                                onClick={handleConfirm}
                            >
                                {popup.confirmText || 'Confirm'}
                            </button>
                        </>
                    ) : (
                        <button
                            className={`${styles.popupBtn} ${styles.btnPrimary} ${popup.type === 'success' ? styles.success : ''}`}
                            onClick={close}
                        >
                            OK
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
