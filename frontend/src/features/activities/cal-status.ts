export const ACTIVITY_CAL_STATUS_NAMES = {
  imported: 'นำเข้าข้อมูลแล้ว',
  preparing: 'กำลังเตรียมข้อมูล',
  ready: 'พร้อมคำนวณมาตรฐาน',
  standardDone: 'คำนวณแล้ว(มาตรฐาน)',
  cfpDone: 'คำนวณแล้ว(มาตรฐาน,CFP)',
  error: 'คำนวณผิดพลาด',
} as const

type ActivityCalStatusKind =
  | 'imported'
  | 'preparing'
  | 'ready'
  | 'standardDone'
  | 'cfpDone'
  | 'error'
  | 'unknown'

function normalizeStatusText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export function getActivityCalStatusLabel(rawName: string | null | undefined, statusId?: number | null) {
  const normalized = normalizeStatusText(rawName)

  if (normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.imported)) return ACTIVITY_CAL_STATUS_NAMES.imported
  if (normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.preparing)) return ACTIVITY_CAL_STATUS_NAMES.preparing
  if (normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.ready)) return ACTIVITY_CAL_STATUS_NAMES.ready
  if (normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.standardDone)) return ACTIVITY_CAL_STATUS_NAMES.standardDone
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.cfpDone)
    || normalized === 'คำนวณแล้ว(มาตรฐาน+cfp)'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.cfpDone
  }
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.error)
    || normalized === 'ผิดพลาด'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.error
  }

  if (normalized === 'ยังไม่คำนวณ/รอการคำนวณมาตรฐาน' || normalized === 'รอคำนวณค่ามาตรฐาน') {
    return ACTIVITY_CAL_STATUS_NAMES.ready
  }

  if (!normalized && statusId === 1) return ACTIVITY_CAL_STATUS_NAMES.standardDone
  if (!normalized && statusId === 2) return ACTIVITY_CAL_STATUS_NAMES.ready
  if (!normalized && statusId === 3) return ACTIVITY_CAL_STATUS_NAMES.error

  return rawName?.trim() || '—'
}

export function getActivityCalStatusKind(rawName: string | null | undefined, statusId?: number | null): ActivityCalStatusKind {
  const label = getActivityCalStatusLabel(rawName, statusId)

  if (label === ACTIVITY_CAL_STATUS_NAMES.imported) return 'imported'
  if (label === ACTIVITY_CAL_STATUS_NAMES.preparing) return 'preparing'
  if (label === ACTIVITY_CAL_STATUS_NAMES.ready) return 'ready'
  if (label === ACTIVITY_CAL_STATUS_NAMES.standardDone) return 'standardDone'
  if (label === ACTIVITY_CAL_STATUS_NAMES.cfpDone) return 'cfpDone'
  if (label === ACTIVITY_CAL_STATUS_NAMES.error) return 'error'
  if (label === '—') return 'unknown'

  return 'unknown'
}

export function getActivityCalStatusBadgeClass(rawName: string | null | undefined, statusId?: number | null) {
  const kind = getActivityCalStatusKind(rawName, statusId)

  if (kind === 'imported') return 'badge-gray'
  if (kind === 'preparing') return 'badge-blue'
  if (kind === 'ready') return 'badge-amber'
  if (kind === 'standardDone') return 'badge-green'
  if (kind === 'cfpDone') return 'badge-cyan'
  if (kind === 'error') return 'badge-red'

  return 'badge-gray'
}
