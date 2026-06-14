import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, GripVertical, Search, X } from 'lucide-react'

export interface Column<T> {
  key: keyof T | string
  header: ReactNode
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  sortValue?: (row: T) => unknown
  width?: string
  minWidth?: string
  maxWidth?: string
  resizable?: boolean
  headerClassName?: string
  cellClassName?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  isLoading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  pageSizeOptions?: number[]
  defaultPageSize?: number
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  actions?: (row: T) => React.ReactNode
  emptyMessage?: string
}

const PAGE_SIZES = [5, 10, 25, 50, 100]

type ExpandableTextCellProps = {
  text?: string | null
  title?: string
  emptyText?: string
  previewLines?: number
  previewChars?: number
  className?: string
}

function normalizeDisplayText(text?: string | null, emptyText = '—') {
  const normalized = text?.trim()
  return normalized ? normalized : emptyText
}

export function ExpandableTextCell({
  text,
  title = 'รายละเอียด',
  emptyText = '—',
  previewLines = 2,
  previewChars = 88,
  className = '',
}: ExpandableTextCellProps) {
  const [open, setOpen] = useState(false)
  const displayText = normalizeDisplayText(text, emptyText)
  const isEmpty = displayText === emptyText
  const shouldExpand = !isEmpty && displayText.length > previewChars

  return (
    <>
      <div className="min-w-0">
        <div
          className={`break-words whitespace-normal text-sm text-surface-700 ${className}`.trim()}
          style={shouldExpand ? {
            display: '-webkit-box',
            WebkitLineClamp: previewLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } : undefined}
          title={shouldExpand ? displayText : undefined}
        >
          {displayText}
        </div>
        {shouldExpand && (
          <button
            type="button"
            className="mt-1 inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-[11px] font-medium text-surface-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
            onClick={(event) => {
              event.stopPropagation()
              setOpen(true)
            }}
          >
            ดูรายละเอียด
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-surface-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-surface-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-surface-900">{title}</div>
                <div className="text-xs text-surface-500">แสดงข้อความเต็มของช่องนี้</div>
              </div>
              <button
                type="button"
                className="btn-icon btn-ghost btn-sm shrink-0"
                onClick={() => setOpen(false)}
                aria-label="ปิดรายละเอียด"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-surface-700">
                {displayText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function DataTable<T>({
  data,
  columns,
  isLoading,
  searchable = true,
  searchPlaceholder = 'ค้นหา...',
  pageSizeOptions = PAGE_SIZES,
  defaultPageSize = 10,
  rowKey,
  onRowClick,
  actions,
  emptyMessage = 'ไม่พบข้อมูล',
}: DataTableProps<T>) {
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const resizeStateRef = useRef<{
    columnKey: string
    startX: number
    startWidth: number
    minWidth: number
    maxWidth?: number
  } | null>(null)

  const getValue = (row: T, key: string): unknown => {
    return key.split('.').reduce((obj, k) => (obj as Record<string, unknown>)?.[k], row as unknown)
  }

  const getSortValue = (row: T, column: Column<T>) => {
    if (column.sortValue) return column.sortValue(row)
    return getValue(row, String(column.key))
  }

  const parsePixelWidth = (value?: string) => {
    if (!value) return undefined
    const trimmed = value.trim()
    if (!trimmed.endsWith('px')) return undefined
    const parsed = Number(trimmed.replace('px', ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }

  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev }
      let changed = false

      columns.forEach((column) => {
        const key = String(column.key)
        if (next[key] != null) return
        const parsedWidth = parsePixelWidth(column.width)
        if (parsedWidth != null) {
          next[key] = parsedWidth
          changed = true
        }
      })

      Object.keys(next).forEach((key) => {
        if (!columns.some((column) => String(column.key) === key)) {
          delete next[key]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [columns])

  useEffect(() => {
    return () => {
      resizeStateRef.current = null
    }
  }, [])

  const normalizeSortValue = (value: unknown): number | string => {
    if (value == null) return ''
    if (typeof value === 'number') return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return ''

      const numeric = Number(trimmed.replace(/,/g, ''))
      if (!Number.isNaN(numeric) && /^-?[\d,.]+$/.test(trimmed)) return numeric

      const parsedDate = Date.parse(trimmed)
      if (!Number.isNaN(parsedDate)) return parsedDate

      return trimmed.toLocaleLowerCase()
    }

    return String(value).toLocaleLowerCase()
  }

  const compareValues = (left: unknown, right: unknown) => {
    const a = normalizeSortValue(left)
    const b = normalizeSortValue(right)

    if (a === b) return 0
    if (typeof a === 'number' && typeof b === 'number') return a - b

    return String(a).localeCompare(String(b), ['th', 'en'], {
      numeric: true,
      sensitivity: 'base',
    })
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some((v) =>
        String(v ?? '').toLowerCase().includes(q),
      ),
    )
  }, [data, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered

    const column = columns.find((item) => String(item.key) === sortKey)
    if (!column?.sortable) return filtered

    const direction = sortDirection === 'asc' ? 1 : -1

    return [...filtered].sort((left, right) => (
      compareValues(getSortValue(left, column), getSortValue(right, column)) * direction
    ))
  }, [columns, filtered, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const slice      = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const goTo = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))
  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return

    const columnKey = String(column.key)
    if (sortKey === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(columnKey)
      setSortDirection('asc')
    }
    setPage(1)
  }

  const getColumnStyle = (column: Column<T>): CSSProperties => {
    const key = String(column.key)
    const resizedWidth = columnWidths[key]
    return {
      width: resizedWidth != null ? `${resizedWidth}px` : column.width,
      minWidth: column.minWidth ?? column.width,
      maxWidth: column.maxWidth,
    }
  }

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>, column: Column<T>) => {
    event.preventDefault()
    event.stopPropagation()

    const headerCell = event.currentTarget.closest('th')
    if (!headerCell) return

    const key = String(column.key)
    const minWidth = parsePixelWidth(column.minWidth) ?? 140
    const maxWidth = parsePixelWidth(column.maxWidth)
    resizeStateRef.current = {
      columnKey: key,
      startX: event.clientX,
      startWidth: headerCell.getBoundingClientRect().width,
      minWidth,
      maxWidth,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) return

      const delta = moveEvent.clientX - state.startX
      const nextWidth = state.startWidth + delta
      const boundedWidth = Math.max(
        state.minWidth,
        state.maxWidth != null ? Math.min(nextWidth, state.maxWidth) : nextWidth,
      )

      setColumnWidths((prev) => ({
        ...prev,
        [state.columnKey]: Math.round(boundedWidth),
      }))
    }

    const handleMouseUp = () => {
      resizeStateRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="min-w-0 flex flex-col gap-3">
      {/* Toolbar */}
      {searchable && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex w-full items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 sm:max-w-sm">
            <Search size={14} className="text-surface-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={searchPlaceholder}
              className="flex-1 text-sm outline-none placeholder:text-surface-400 bg-transparent"
            />
          </div>
          <div className="flex w-full items-center justify-between gap-2 text-xs text-surface-500 sm:ml-auto sm:w-auto sm:justify-start">
            <span>แสดง</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="select-sm border border-surface-200 rounded-lg px-2 py-1.5 text-xs bg-white"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span>รายการ</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-100 bg-white p-4 shadow-card">
              <div className="space-y-3">
                {Array.from({ length: Math.min(columns.length, 4) }).map((__, idx) => (
                  <div key={idx} className="grid grid-cols-[88px,1fr] gap-3">
                    <div className="h-3 w-16 rounded bg-surface-100 animate-pulse" />
                    <div className="h-4 w-full rounded bg-surface-100 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : slice.length === 0 ? (
          <div className="rounded-xl border border-surface-100 bg-white px-4 py-10 text-center text-sm text-surface-400 shadow-card">
            {emptyMessage}
          </div>
        ) : (
          slice.map((row) => (
            <article
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`rounded-xl border border-surface-100 bg-white p-4 shadow-card ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              <div className="space-y-3">
              {columns.map((col) => (
                  <div key={String(col.key)} className="grid grid-cols-[96px,1fr] gap-3 border-b border-surface-50 pb-3 last:border-b-0 last:pb-0">
                    <span className="text-xs font-medium text-surface-500">{col.header}</span>
                    <div className={`min-w-0 text-sm text-surface-800 break-words ${col.cellClassName ?? ''}`.trim()}>
                      {col.render
                        ? col.render(row)
                        : String(getValue(row, String(col.key)) ?? '-')}
                    </div>
                  </div>
                ))}
                {actions && (
                  <div
                    className="border-t border-surface-100 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap justify-end gap-2">
                      {actions(row)}
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="table-wrapper hidden md:block">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} style={getColumnStyle(col)} className={col.headerClassName}>
                  <div className="group relative flex items-center pr-4">
                    {col.sortable ? (
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center gap-1 text-left"
                        onClick={() => toggleSort(col)}
                      >
                        <span className="truncate">{col.header}</span>
                        {sortKey === String(col.key) ? (
                          sortDirection === 'asc' ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />
                        ) : (
                          <ArrowUpDown size={14} className="shrink-0 text-surface-400" />
                        )}
                      </button>
                    ) : (
                      <div className="min-w-0 truncate">{col.header}</div>
                    )}

                    {col.resizable && (
                      <button
                        type="button"
                        className="absolute inset-y-0 -right-2 hidden w-4 cursor-col-resize items-center justify-center text-surface-300 transition hover:text-primary-500 md:flex"
                        onMouseDown={(event) => startResize(event, col)}
                        aria-label={`ปรับความกว้างคอลัมน์ ${String(col.key)}`}
                        title="ลากเพื่อปรับความกว้างคอลัมน์"
                      >
                        <GripVertical size={13} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="w-24 text-right">การดำเนินการ</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={String(col.key)} style={getColumnStyle(col)} className={col.cellClassName}>
                      <div className="h-4 w-3/4 animate-pulse rounded bg-surface-100" />
                    </td>
                  ))}
                  {actions && <td />}
                </tr>
              ))
            ) : slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-12 text-center text-surface-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              slice.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} style={getColumnStyle(col)} className={col.cellClassName}>
                      {col.render
                        ? col.render(row)
                        : String(getValue(row, String(col.key)) ?? '-')}
                    </td>
                  ))}
                  {actions && (
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 text-xs text-surface-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {sorted.length === 0 ? 'ไม่มีข้อมูล' : `แสดง ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} จาก ${sorted.length} รายการ`}
        </span>
        <div className="pagination flex-wrap">
          <button className="pagination-btn" onClick={() => goTo(1)} disabled={safePage === 1}>
            <ChevronsLeft size={13} />
          </button>
          <button className="pagination-btn" onClick={() => goTo(safePage - 1)} disabled={safePage === 1}>
            <ChevronLeft size={13} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(safePage - 2, totalPages - 4))
            const p = start + i
            return (
              <button key={p} onClick={() => goTo(p)} className={`pagination-btn w-7 h-7 ${p === safePage ? 'active' : ''}`}>
                {p}
              </button>
            )
          })}
          <button className="pagination-btn" onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}>
            <ChevronRight size={13} />
          </button>
          <button className="pagination-btn" onClick={() => goTo(totalPages)} disabled={safePage === totalPages}>
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
