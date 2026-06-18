export function normalizeProductionYearValue(year: number) {
  return year >= 2400 ? year : year + 543
}

function padShortYear(value: number) {
  return String(((value % 100) + 100) % 100).padStart(2, '0')
}

export function buildProductionYearLabelFromYear(year: number) {
  const buddhistYear = normalizeProductionYearValue(year)
  const shortYear = buddhistYear % 100
  return `${padShortYear(shortYear)}/${padShortYear(shortYear + 1)}`
}

export function buildProductionYearLabelFromDate(value?: Date | string | null) {
  if (!value) return undefined
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return buildProductionYearLabelFromYear(parsed.getFullYear())
}

export function parseProductionYearSortYear(value?: string | null) {
  const text = value?.trim()
  if (!text) return null

  const fullYearMatch = text.match(/\b(24\d{2}|25\d{2}|26\d{2}|19\d{2}|20\d{2}|21\d{2})\b/)
  if (fullYearMatch) {
    return normalizeProductionYearValue(Number(fullYearMatch[1]))
  }

  const shortYearMatch = text.match(/\b(\d{2})(?:\s*\/\s*\d{2})?\b/)
  if (shortYearMatch) {
    const shortYear = Number(shortYearMatch[1])
    if (Number.isFinite(shortYear)) return shortYear + 2500
  }

  return null
}

export function resolveProductionYearLabel(label?: string | null, fallbackDate?: Date | string | null) {
  const trimmedLabel = label?.trim()
  if (trimmedLabel) return trimmedLabel
  return buildProductionYearLabelFromDate(fallbackDate) ?? null
}

export function resolveProductionYearSortYear(label?: string | null, fallbackDate?: Date | string | null) {
  const parsed = parseProductionYearSortYear(label)
  if (parsed != null) return parsed

  if (!fallbackDate) return null
  const date = fallbackDate instanceof Date ? fallbackDate : new Date(fallbackDate)
  if (Number.isNaN(date.getTime())) return null
  return normalizeProductionYearValue(date.getFullYear())
}
