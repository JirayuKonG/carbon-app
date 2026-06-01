const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

function toValidDate(value?: string | Date | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getBangkokParts(value?: string | Date | null) {
  const date = toValidDate(value)
  if (!date) return null

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
  }
}

export function formatBangkokDate(value?: string | Date | null) {
  const date = toValidDate(value)
  if (!date) return '—'

  return new Intl.DateTimeFormat('th-TH', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatBangkokDateTime(value?: string | Date | null) {
  const parts = getBangkokParts(value)
  if (!parts) return '—'
  return `${formatBangkokDate(value)} ${parts.hour}:${parts.minute}`
}

export function formatBangkokDateKey(value?: string | Date | null) {
  const parts = getBangkokParts(value)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatBangkokDateTimeLocal(value?: string | Date | null) {
  const parts = getBangkokParts(value)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
