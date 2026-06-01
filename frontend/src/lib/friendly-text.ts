const FRIENDLY_FIELD_LABELS: Record<string, string> = {
  log_activities_detail: 'รายการบันทึกกิจกรรม',
  activities_header_detail_type: 'รายละเอียดกิจกรรมย่อย',
  activities_header_idCode: 'รหัสกิจกรรม',
  activities_header_startDate: 'วันที่กิจกรรม',
  activities_header_update_uid: 'ผู้บันทึกหรือผู้แก้ไข',
  activities_header_curlatitude: 'ละติจูด',
  activities_header_curlongitude: 'ลองจิจูด',
  activities_header_info: 'ข้อมูลเพิ่มเติม',
  activities_header_id: 'หัวข้อกิจกรรม',
  activities_header: 'หัวข้อกิจกรรม',
  act_header_detail_type_update_uid: 'ผู้แก้ไขรายละเอียดกิจกรรมย่อย',
  act_header_detail_type_id: 'รายละเอียดกิจกรรมย่อย',
  act_header_detail_type: 'รายละเอียดกิจกรรมย่อย',
  act_header_typeSugarCane_id: 'ประเภทอ้อย',
  act_header_typeLand_id: 'ประเภทแปลง',
  act_header_type_id: 'ประเภทกิจกรรม',
  act_header_type: 'ประเภทกิจกรรม',
  log_act_detail_calStatus_id: 'สถานะการคำนวณ',
  log_act_detail_create_at: 'วันที่ปฏิบัติกิจกรรม',
  log_act_detail_volumePerUnit: 'ปริมาณต่อหน่วย',
  log_act_detail_volumeAll: 'ปริมาณรวม',
  log_act_detail_areawork: 'พื้นที่ปฏิบัติงาน',
  log_act_detail_quatity: 'จำนวน',
  log_act_detail_id: 'รายการบันทึกกิจกรรม',
  land_weatherStationRec: 'ข้อมูลสภาพอากาศ',
  land_weatherStationRec_id: 'รายการข้อมูลสภาพอากาศ',
  land_weatherStationRec_airTemperature: 'อุณหภูมิอากาศ',
  land_weatherStationRec_relativeHumidity: 'ความชื้นสัมพัทธ์',
  land_weatherStationRec_barometricPressure: 'ความดันบรรยากาศ',
  land_weatherStationRec_windSP: 'ความเร็วลม',
  land_weatherStationRec_rainfall: 'ปริมาณฝน',
  land_weatherStationRec_solarRadiation_UV: 'รังสีแสงอาทิตย์และ UV',
  land_weatherStationRec_soilMoisture_soilTemp: 'ความชื้นและอุณหภูมิดิน',
  land_weatherStationRec_dewPoint: 'จุดน้ำค้าง',
  land_weatherStationRec_evapotranspiration: 'การระเหยคายน้ำ',
  land_size: 'พื้นที่ตามแปลง',
  land_code: 'รหัสแปลง',
  land_camp_name: 'ชื่อแคมป์',
  land_camp_idCode: 'รหัสแคมป์',
  land_camp_id: 'แคมป์',
  land_id: 'แปลง',
  resource_item_name: 'รายการปัจจัยการผลิต',
  resource_used_type_id: 'ประเภทปัจจัย',
  resource_used_type: 'ประเภทปัจจัย',
  act_fertilizer_id: 'ปุ๋ย',
  act_equipment_id: 'อุปกรณ์',
  act_chemiscal_id: 'สารเคมี',
  unit_prefix_value: 'ค่าตัวคูณคำนำหน้าหน่วย',
  unit_prefix_initial: 'ตัวย่อคำนำหน้าหน่วย',
  unit_prefix_name: 'ชื่อคำนำหน้าหน่วย',
  unit_prefix_id: 'คำนำหน้าหน่วย',
  unit_name: 'หน่วยนับ',
  unit_id: 'หน่วยนับ',
  lands_camps: 'ข้อมูลแคมป์',
  lands: 'ข้อมูลแปลง',
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function replaceCaseInsensitive(text: string, search: string, replacement: string) {
  return text.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replacement)
}

export function toFriendlyFieldLabel(key: string, fallback?: string) {
  return FRIENDLY_FIELD_LABELS[key] ?? fallback ?? key
}

function simplifyMessage(message: string): string {
  let next = message.trim()

  next = next.replace(/^Error:\s*/i, '')
  next = next.replace(/^Bad Request Exception:\s*/i, '')

  const uniqueMatch = next.match(/Unique constraint failed on the fields?:\s*\((.+)\)/i)
  if (uniqueMatch) {
    return `ข้อมูลซ้ำในฟิลด์ ${sanitizeFriendlyText(uniqueMatch[1])}`
  }

  const nullConstraintMatch = next.match(/Null constraint violation on the fields?:\s*\((.+)\)/i)
  if (nullConstraintMatch) {
    return `กรอกข้อมูล ${sanitizeFriendlyText(nullConstraintMatch[1])} ให้ครบถ้วน`
  }

  const foreignKeyMatch = next.match(/Foreign key constraint failed on the field:\s*(.+)$/i)
  if (foreignKeyMatch) {
    return `ข้อมูลอ้างอิงไม่ถูกต้องในฟิลด์ ${sanitizeFriendlyText(foreignKeyMatch[1])}`
  }

  const missingArgMatch = next.match(/Argument\s+`?([^`]+?)`?\s+is missing/i)
  if (missingArgMatch) {
    return `กรอกข้อมูล ${sanitizeFriendlyText(missingArgMatch[1])} ให้ครบถ้วน`
  }

  const invalidNumberMatch = next.match(/Invalid number:\s*(.+)$/i)
  if (invalidNumberMatch) {
    return `รูปแบบตัวเลขไม่ถูกต้อง: ${invalidNumberMatch[1]}`
  }

  const invalidDateMatch = next.match(/Invalid date:\s*(.+)$/i)
  if (invalidDateMatch) {
    return `รูปแบบวันที่ไม่ถูกต้อง: ${invalidDateMatch[1]}`
  }

  if (/No rows to import/i.test(next) || /^No rows$/i.test(next)) {
    return 'ไม่พบข้อมูลสำหรับนำเข้า'
  }

  if (/record to (delete|update) does not exist/i.test(next)) {
    return 'ไม่พบข้อมูลที่ต้องการแก้ไขหรือลบ'
  }

  return next
}

export function sanitizeFriendlyText(message: string): string {
  const simplified = simplifyMessage(message)

  return Object.entries(FRIENDLY_FIELD_LABELS)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((text, [rawKey, friendlyLabel]) => replaceCaseInsensitive(text, rawKey, friendlyLabel), simplified)
    .replace(/`/g, '')
}

function collectMessageParts(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => collectMessageParts(item))

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const preferredParts = [
      ...collectMessageParts(obj.message),
      ...collectMessageParts(obj.errors),
    ]

    if (preferredParts.length > 0) return preferredParts

    return [
      ...collectMessageParts(obj.error),
      ...collectMessageParts(obj.detail),
    ]
  }

  return []
}

export function formatFriendlyErrorMessage(payload: unknown, fallback = 'เกิดข้อผิดพลาด') {
  const parts = unique(
    collectMessageParts(payload)
      .map((part) => sanitizeFriendlyText(part))
      .filter(Boolean),
  )

  return parts.length > 0 ? parts.join(' | ') : fallback
}
