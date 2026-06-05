import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

export interface DashboardVisibilityOption {
  key: string
  label: string
}

export function useDashboardVisibility(
  storageKey: string,
  defaultKeys: string[],
  options: DashboardVisibilityOption[],
) {
  const optionKeySet = new Set(options.map((option) => option.key))

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultKeys

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return defaultKeys

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return defaultKeys

      const filtered = parsed.filter((key): key is string => typeof key === 'string' && optionKeySet.has(key))
      return filtered.length ? filtered : defaultKeys
    } catch {
      return defaultKeys
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify(visibleKeys))
  }, [storageKey, visibleKeys])

  const toggleKey = (key: string) => {
    setVisibleKeys((prev) => {
      if (prev.includes(key)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== key)
      }

      return [...prev, key].filter((item) => optionKeySet.has(item))
    })
  }

  const reset = () => setVisibleKeys(defaultKeys)

  return {
    visibleKeys,
    visibleKeySet: new Set(visibleKeys),
    toggleKey,
    reset,
  }
}

interface DashboardVisibilityMenuProps {
  options: DashboardVisibilityOption[]
  visibleKeys: string[]
  onToggle: (key: string) => void
  onReset: () => void
  buttonLabel?: string
}

export function DashboardVisibilityMenu({
  options,
  visibleKeys,
  onToggle,
  onReset,
  buttonLabel = 'ปรับ Dashboard',
}: DashboardVisibilityMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        <SlidersHorizontal size={14} /> {buttonLabel}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-surface-200 bg-white p-3 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-surface-800">เลือกการ์ดที่ต้องการแสดง</p>
              <p className="text-xs text-surface-500">ซ่อนหรือแสดงการ์ดสรุปบนหน้าได้ทันที</p>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={onReset}>
              รีเซ็ต
            </button>
          </div>

          <div className="space-y-1.5">
            {options.map((option) => {
              const checked = visibleKeys.includes(option.key)

              return (
                <label
                  key={option.key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-surface-200 px-3 py-2 text-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="text-surface-700">{option.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(option.key)}
                    disabled={checked && visibleKeys.length === 1}
                    className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
