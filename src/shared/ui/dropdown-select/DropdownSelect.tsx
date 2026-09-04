import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/cn'

import type { DropdownOption } from './types'

import './dropdown-select.css'

type DropdownSelectBaseProps = {
  id?: string | undefined
  label?: string | undefined
  required?: boolean | undefined
  helpText?: string | undefined
  error?: string | undefined
  placeholder?: string | undefined
  options: DropdownOption[]
  disabled?: boolean | undefined
  loading?: boolean | undefined
  searchable?: boolean | undefined
  searchPlaceholder?: string | undefined
  emptyMessage?: string | undefined
  loadingMessage?: string | undefined
  invalid?: boolean | undefined
  compact?: boolean | undefined
  fullWidth?: boolean | undefined
  className?: string | undefined
  fieldClassName?: string | undefined
  containerRef?: ((node: HTMLDivElement | null) => void) | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

type SingleDropdownSelectProps = DropdownSelectBaseProps & {
  mode?: 'single'
  value: string
  onChange: (value: string) => void
}

type MultipleDropdownSelectProps = DropdownSelectBaseProps & {
  mode: 'multiple'
  value: string[]
  onChange: (value: string[]) => void
}

export type DropdownSelectProps = SingleDropdownSelectProps | MultipleDropdownSelectProps

const SEARCH_THRESHOLD = 6

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function filterOptions(options: DropdownOption[], query: string) {
  const token = normalizeSearch(query)
  if (!token) return options

  return options.filter((option) => {
    const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase()
    return haystack.includes(token)
  })
}

function isMultipleProps(props: DropdownSelectProps): props is MultipleDropdownSelectProps {
  return props.mode === 'multiple'
}

export function DropdownSelect(props: DropdownSelectProps) {
  const {
    id,
    label,
    required = false,
    helpText,
    error,
    placeholder = 'Select an option',
    options,
    disabled = false,
    loading = false,
    searchPlaceholder = 'Search...',
    emptyMessage = 'No options found.',
    loadingMessage = 'Loading options...',
    invalid = false,
    compact = false,
    fullWidth = false,
    className,
    fieldClassName,
    containerRef,
    onOpenChange,
  } = props

  const fallbackId = useId()
  const fieldId = id ?? fallbackId
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const searchable = props.searchable ?? options.length >= SEARCH_THRESHOLD

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current?.querySelector<HTMLElement>('.ui-dropdown-trigger')
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const viewportPadding = 8
    const estimatedMenuHeight = Math.min(280, options.length * 40 + (searchable ? 44 : 0))
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight

    setMenuStyle({
      position: 'fixed',
      top: openUpward ? rect.top - estimatedMenuHeight - 4 : rect.bottom + 4,
      left: Math.max(viewportPadding, rect.left),
      width: rect.width,
      zIndex: 200,
    })
  }, [options.length, searchable])

  const setRefs = (node: HTMLDivElement | null) => {
    rootRef.current = node
    containerRef?.(node)
  }

  const setMenuOpen = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
    if (!next) setSearchQuery('')
  }

  useEffect(() => {
    if (!open) return

    updateMenuPosition()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    const handleReposition = () => updateMenuPosition()

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open || !searchable) return
    const timeoutId = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [open, searchable])

  const filteredOptions = useMemo(
    () => filterOptions(options, searchQuery),
    [options, searchQuery],
  )

  const selectedOptions = useMemo(() => {
    if (isMultipleProps(props)) {
      return options.filter((option) => props.value.includes(option.value))
    }
    return options.filter((option) => option.value === props.value)
  }, [options, props])

  const hasSelection = isMultipleProps(props)
    ? props.value.length > 0
    : selectedOptions.length > 0

  const toggleOption = (option: DropdownOption) => {
    if (option.disabled) return

    if (isMultipleProps(props)) {
      const checked = props.value.includes(option.value)
      props.onChange(
        checked ? props.value.filter((item) => item !== option.value) : [...props.value, option.value],
      )
      return
    }

    props.onChange(option.value)
    setMenuOpen(false)
  }

  const removeChip = (optionValue: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isMultipleProps(props)) return
    props.onChange(props.value.filter((item) => item !== optionValue))
  }

  const toggleMenu = () => {
    if (disabled || loading) return
    setOpen((current) => {
      const next = !current
      onOpenChange?.(next)
      if (!next) setSearchQuery('')
      return next
    })
  }

  const menu = open ? (
    <div
      ref={menuRef}
      className="ui-dropdown-menu ui-dropdown-menu--portal"
      role="listbox"
      aria-multiselectable={isMultipleProps(props)}
      style={menuStyle}
    >
      {searchable ? (
        <div className="ui-dropdown-search">
          <IconSearch size={14} aria-hidden="true" />
          <input
            ref={searchRef}
            value={searchQuery}
            placeholder={searchPlaceholder}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      <div className="ui-dropdown-options">
        {loading ? (
          <div className="ui-dropdown-loading">{loadingMessage}</div>
        ) : filteredOptions.length === 0 ? (
          <div className="ui-dropdown-empty">{emptyMessage}</div>
        ) : (
          filteredOptions.map((option) => {
            const selected = isMultipleProps(props)
              ? props.value.includes(option.value)
              : props.value === option.value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                className={cn('ui-dropdown-option', selected && 'ui-dropdown-option--selected')}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleOption(option)}
              >
                <span className="ui-dropdown-option-check" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
                <span className="ui-dropdown-option-body">
                  <span className="ui-dropdown-option-label">{option.label}</span>
                  {option.description ? (
                    <span className="ui-dropdown-option-description">{option.description}</span>
                  ) : null}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  ) : null

  const control = (
    <div
      ref={setRefs}
      className={cn(
        'ui-dropdown',
        compact && 'ui-dropdown--compact',
        open && 'ui-dropdown--open',
        (invalid || error) && 'ui-dropdown--invalid',
        className,
      )}
    >
      <div
        id={fieldId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || loading}
        tabIndex={disabled || loading ? -1 : 0}
        className="ui-dropdown-trigger"
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          toggleMenu()
        }}
        onKeyDown={(event) => {
          if (disabled || loading) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleMenu()
          }
        }}
      >
        <span className="ui-dropdown-trigger-main">
          {loading ? (
            <span className="ui-dropdown-placeholder">{loadingMessage}</span>
          ) : isMultipleProps(props) ? (
            selectedOptions.length > 0 ? (
              <span className="ui-dropdown-chips">
                {selectedOptions.map((option) => (
                  <span key={option.value} className="ui-dropdown-chip">
                    <span className="ui-dropdown-chip-label">{option.label}</span>
                    <button
                      type="button"
                      className="ui-dropdown-chip-remove"
                      aria-label={`Remove ${option.label}`}
                      onClick={(event) => removeChip(option.value, event)}
                    >
                      <IconX size={12} />
                    </button>
                  </span>
                ))}
              </span>
            ) : (
              <span className="ui-dropdown-placeholder">{placeholder}</span>
            )
          ) : hasSelection ? (
            <span className="ui-dropdown-value">{selectedOptions[0]?.label}</span>
          ) : (
            <span className="ui-dropdown-placeholder">{placeholder}</span>
          )}
        </span>
        <IconChevronDown
          size={14}
          className={cn('ui-dropdown-chevron', open && 'ui-dropdown-chevron--open')}
        />
      </div>

      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </div>
  )

  if (!label) return control

  return (
    <label
      className={cn(
        'ui-dropdown-field commercial-field',
        fullWidth && 'commercial-field--full',
        fieldClassName,
      )}
      htmlFor={fieldId}
    >
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {control}
      {helpText ? <small>{helpText}</small> : null}
      {error ? <small className="ui-dropdown-field-error commercial-field-error">{error}</small> : null}
    </label>
  )
}
