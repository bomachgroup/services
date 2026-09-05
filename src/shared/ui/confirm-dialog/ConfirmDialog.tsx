import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconAlertOctagon,
  IconX,
} from '@tabler/icons-react'
import { cva } from 'class-variance-authority'
import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/shared/ui/button'

export type ConfirmDialogTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type ConfirmDetailRow = {
  label: string
  value: ReactNode
  highlight?: boolean
}

const iconContainerVariants = cva('grid size-12 shrink-0 place-items-center rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-surface-subtle text-foreground-muted',
      info: 'bg-brand-100 text-brand-700',
      success: 'bg-success-100 text-success-700',
      warning: 'bg-warning-100 text-warning-700',
      danger: 'bg-danger-100 text-danger-700',
    },
  },
})

const icons = {
  neutral: IconInfoCircle,
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  danger: IconAlertOctagon,
} as const

export interface ConfirmDialogProps {
  open: boolean
  title: ReactNode
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  isConfirming?: boolean
  closeOnBackdrop?: boolean
  impact?: ReactNode
  detailsTitle?: string
  detailRows?: ConfirmDetailRow[]
  details?: ReactNode
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'neutral',
  isConfirming = false,
  closeOnBackdrop = true,
  impact,
  detailsTitle = 'Summary',
  detailRows,
  details,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const Icon = icons[tone]

  useEffect(() => {
    if (!open) {
      return
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus()
    })

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocusedElementRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (!firstElement || !lastElement) {
        return
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isConfirming, onCancel, open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && !isConfirming && event.target === event.currentTarget) {
      onCancel()
    }
  }

  const stopReactTreePropagation = (event: ReactMouseEvent) => {
    event.stopPropagation()
  }

  const confirmVariant = tone === 'danger' ? 'danger' : 'primary'
  const hasDetails = Boolean(detailRows?.length || details)

  return createPortal(
    <div
      className="bg-overlay fixed inset-0 z-[120] grid place-items-center overflow-y-auto p-4"
      onMouseDown={(event) => {
        stopReactTreePropagation(event)
        handleBackdropClick(event)
      }}
      onClick={stopReactTreePropagation}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="border-border bg-surface shadow-overlay w-full max-w-lg rounded-2xl border"
        onMouseDown={stopReactTreePropagation}
        onClick={stopReactTreePropagation}
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <span className={iconContainerVariants({ tone })}>
            <Icon size={24} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-foreground text-lg font-black">
                {title}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="-mt-2 -mr-2 size-8 shrink-0"
                aria-label="Close confirmation"
                disabled={isConfirming}
                onClick={onCancel}
              >
                <IconX size={17} />
              </Button>
            </div>

            <div id={descriptionId} className="text-foreground-muted mt-2 text-sm leading-6">
              {description}
            </div>

            {impact ? (
              <p className="border-warning-200 bg-warning-50 text-warning-900 mt-3 rounded-lg border px-3 py-2.5 text-xs leading-5">
                {impact}
              </p>
            ) : null}

            {hasDetails ? (
              <div className="border-border/80 bg-surface-muted/70 mt-4 overflow-hidden rounded-xl border">
                <div className="border-border/60 text-foreground-muted border-b px-4 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase">
                  {detailsTitle}
                </div>
                <div className="px-4 py-3">
                  {detailRows?.length ? (
                    <dl className="grid gap-3">
                      {detailRows.map((row) => (
                        <div
                          key={row.label}
                          className="grid gap-1 sm:grid-cols-[128px_minmax(0,1fr)] sm:items-start sm:gap-3"
                        >
                          <dt className="text-foreground-muted text-[11px] font-semibold tracking-wide uppercase">
                            {row.label}
                          </dt>
                          <dd
                            className={
                              row.highlight
                                ? 'text-foreground text-sm leading-5 font-bold'
                                : 'text-foreground text-sm leading-5'
                            }
                          >
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="text-foreground text-sm leading-5">{details}</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-border bg-surface-muted flex flex-col-reverse gap-2 rounded-b-2xl border-t px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            disabled={isConfirming}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            isLoading={isConfirming}
            onClick={() => {
              void onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
