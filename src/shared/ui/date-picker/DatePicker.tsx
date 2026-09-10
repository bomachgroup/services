import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/cn'

import '../dropdown-select/dropdown-select.css'
import './date-picker.css'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }
  return date
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value)
  if (!date) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function buildMonthCells(viewYear: number, viewMonth: number) {
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: Array<{ date: Date; inMonth: boolean }> = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - startOffset + 1
    const date = new Date(viewYear, viewMonth, dayNumber)
    cells.push({
      date,
      inMonth: dayNumber >= 1 && dayNumber <= daysInMonth,
    })
  }

  return cells
}

function computeMenuStyle(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect()
  const viewportPadding = 8
  const estimatedMenuHeight = 280
  const spaceBelow = window.innerHeight - rect.bottom
  const openUpward = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight
  const width = 280

  return {
    position: 'fixed',
    top: openUpward ? rect.top - estimatedMenuHeight - 4 : rect.bottom + 4,
    left: Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - viewportPadding - width,
    ),
    width,
    zIndex: 200,
  }
}

export type DatePickerProps = {
  id?: string | undefined
  label?: string | undefined
  required?: boolean | undefined
  helpText?: string | undefined
  error?: string | undefined
  placeholder?: string | undefined
  value: string
  onChange: (value: string) => void
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  min?: string | undefined
  max?: string | undefined
  clearable?: boolean | undefined
  className?: string | undefined
  fieldClassName?: string | undefined
  containerRef?: ((node: HTMLDivElement | null) => void) | undefined
}

export function DatePicker({
  id,
  label,
  required = false,
  helpText,
  error,
  placeholder = 'Select date',
  value,
  onChange,
  disabled = false,
  invalid = false,
  min,
  max,
  clearable = false,
  className,
  fieldClassName,
  containerRef,
}: DatePickerProps) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = useMemo(() => parseIsoDate(value), [value])
  const minDate = useMemo(() => parseIsoDate(min), [min])
  const maxDate = useMemo(() => parseIsoDate(max), [max])
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const [viewYear, setViewYear] = useState(() => (selected ?? new Date()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (selected ?? new Date()).getMonth())

  const setRefs = (node: HTMLDivElement | null) => {
    rootRef.current = node
    containerRef?.(node)
  }

  const positionMenu = useCallback(() => {
    const trigger = rootRef.current?.querySelector<HTMLElement>('.ui-dropdown-trigger')
    if (!trigger) return false
    setMenuStyle(computeMenuStyle(trigger))
    return true
  }, [])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setMenuStyle(null)
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    const next = selected ?? new Date()
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
    if (!positionMenu()) return
    setOpen(true)
  }, [disabled, positionMenu, selected])

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const onViewportChange = () => {
      positionMenu()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [closeMenu, open, positionMenu])

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewMonth, viewYear])
  const todayIso = toIsoDate(new Date())
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const start = Math.min(current - 25, viewYear - 5)
    const end = Math.max(current + 15, viewYear + 5)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }, [viewYear])

  const isDisabledDay = (date: Date) => {
    const day = startOfDay(date)
    if (minDate && day < startOfDay(minDate)) return true
    if (maxDate && day > startOfDay(maxDate)) return true
    return false
  }

  const selectDay = (date: Date) => {
    if (isDisabledDay(date)) return
    onChange(toIsoDate(date))
    closeMenu()
  }

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const control = (
    <div
      ref={setRefs}
      className={cn(
        'ui-dropdown ui-date-picker',
        open && 'ui-dropdown--open',
        (invalid || error) && 'ui-dropdown--invalid',
        className,
      )}
    >
      <div
        id={fieldId}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        className="ui-dropdown-trigger"
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (open) closeMenu()
          else openMenu()
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (open) closeMenu()
            else openMenu()
          }
        }}
      >
        <span className="ui-dropdown-trigger-main">
          {value ? (
            <span className="ui-dropdown-value">{formatDisplayDate(value)}</span>
          ) : (
            <span className="ui-dropdown-placeholder">{placeholder}</span>
          )}
        </span>
        <IconCalendar size={15} className="ui-date-picker-icon" aria-hidden="true" />
      </div>

      {typeof document !== 'undefined' && open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label={label || 'Choose date'}
              className="ui-dropdown-menu ui-dropdown-menu--portal ui-date-picker-menu"
              style={menuStyle}
            >
              <div className="ui-date-picker-header">
                <button
                  type="button"
                  className="ui-date-picker-nav"
                  aria-label="Previous month"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => shiftMonth(-1)}
                >
                  <IconChevronLeft size={15} />
                </button>
                <div className="ui-date-picker-selectors">
                  <select
                    className="ui-date-picker-select"
                    aria-label="Month"
                    value={viewMonth}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => setViewMonth(Number(event.target.value))}
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    className="ui-date-picker-select ui-date-picker-select--year"
                    aria-label="Year"
                    value={viewYear}
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => setViewYear(Number(event.target.value))}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="ui-date-picker-nav"
                  aria-label="Next month"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => shiftMonth(1)}
                >
                  <IconChevronRight size={15} />
                </button>
              </div>

              <div className="ui-date-picker-weekdays">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="ui-date-picker-grid">
                {cells.map(({ date, inMonth }) => {
                  const iso = toIsoDate(date)
                  const selectedDay = value === iso
                  const isToday = iso === todayIso
                  const dayDisabled = isDisabledDay(date)
                  return (
                    <button
                      key={iso + String(inMonth)}
                      type="button"
                      disabled={dayDisabled}
                      className={cn(
                        'ui-date-picker-day',
                        !inMonth && 'ui-date-picker-day--muted',
                        selectedDay && 'ui-date-picker-day--selected',
                        isToday && 'ui-date-picker-day--today',
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectDay(date)}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>

              <div className="ui-date-picker-footer">
                <button
                  type="button"
                  className="ui-date-picker-footer-btn"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const today = new Date()
                    if (!isDisabledDay(today)) {
                      onChange(toIsoDate(today))
                      closeMenu()
                    }
                  }}
                >
                  Today
                </button>
                {clearable ? (
                  <button
                    type="button"
                    className="ui-date-picker-footer-btn"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange('')
                      closeMenu()
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )

  if (!label) {
    if (!fieldClassName) return control
    return <div className={cn('ui-dropdown-stack', fieldClassName)}>{control}</div>
  }

  return (
    <label
      className={cn(
        'ui-dropdown-field commercial-field',
        fieldClassName,
      )}
      htmlFor={fieldId}
    >
      <span>
        {label}
        {required ? <em className="commercial-required">*</em> : null}
      </span>
      {control}
      {helpText ? <small>{helpText}</small> : null}
      {error ? (
        <small className="ui-dropdown-field-error commercial-field-error">{error}</small>
      ) : null}
    </label>
  )
}
