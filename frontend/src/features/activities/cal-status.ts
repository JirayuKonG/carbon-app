export const ACTIVITY_CAL_STATUS_NAMES = {
  imported: 'นำเข้าข้อมูลแล้ว',
  preparing: 'กำลังเตรียมข้อมูล',
  ready: 'พร้อมคำนวณ',
  standardDone: 'คำนวณแล้ว(CFP)',
  creditDone: 'คำนวณแล้ว(C-credit)',
  cfpDone: 'คำนวณแล้ว(CFP,C-credit)',
  error: 'คำนวณผิดพลาด',
} as const

type ActivityCalStatusKind =
  | 'imported'
  | 'preparing'
  | 'ready'
  | 'standardDone'
  | 'creditDone'
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
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.ready)
    || normalized === 'พร้อมคำนวณมาตรฐาน'
    || normalized === 'ยังไม่คำนวณ/รอการคำนวณมาตรฐาน'
    || normalized === 'รอคำนวณค่ามาตรฐาน'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.ready
  }
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.standardDone)
    || normalized === 'คำนวณแล้ว(มาตรฐาน)'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.standardDone
  }
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.creditDone)
    || normalized === 'คำนวณแล้ว(มาตรฐาน,cfp)'
    || normalized === 'คำนวณแล้ว(มาตรฐาน+cfp)'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.creditDone
  }
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.cfpDone)
    || normalized === 'คำนวณแล้ว(มาตรฐาน,c-credit)'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.cfpDone
  }
  if (
    normalized === normalizeStatusText(ACTIVITY_CAL_STATUS_NAMES.error)
    || normalized === 'คำนวณผิดผลาด'
    || normalized === 'ผิดพลาด'
  ) {
    return ACTIVITY_CAL_STATUS_NAMES.error
  }

  if (!normalized && statusId === 1) return ACTIVITY_CAL_STATUS_NAMES.standardDone
  if (!normalized && statusId === 2) return ACTIVITY_CAL_STATUS_NAMES.ready
  if (!normalized && statusId === 3) return ACTIVITY_CAL_STATUS_NAMES.cfpDone
  if (!normalized && statusId === 4) return ACTIVITY_CAL_STATUS_NAMES.imported
  if (!normalized && statusId === 5) return ACTIVITY_CAL_STATUS_NAMES.preparing
  if (!normalized && statusId === 6) return ACTIVITY_CAL_STATUS_NAMES.error
  if (!normalized && statusId === 7) return ACTIVITY_CAL_STATUS_NAMES.creditDone

  return rawName?.trim() || '—'
}

export function getActivityCalStatusKind(rawName: string | null | undefined, statusId?: number | null): ActivityCalStatusKind {
  const label = getActivityCalStatusLabel(rawName, statusId)

  if (label === ACTIVITY_CAL_STATUS_NAMES.imported) return 'imported'
  if (label === ACTIVITY_CAL_STATUS_NAMES.preparing) return 'preparing'
  if (label === ACTIVITY_CAL_STATUS_NAMES.ready) return 'ready'
  if (label === ACTIVITY_CAL_STATUS_NAMES.standardDone) return 'standardDone'
  if (label === ACTIVITY_CAL_STATUS_NAMES.creditDone) return 'creditDone'
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
  if (kind === 'creditDone') return 'badge-purple'
  if (kind === 'cfpDone') return 'badge-cyan'
  if (kind === 'error') return 'badge-red'

  return 'badge-gray'
}
