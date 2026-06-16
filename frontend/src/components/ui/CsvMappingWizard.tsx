import { useEffect, useState } from 'react'
import { Upload, ArrowRight, CheckCircle, ChevronRight, XCircle } from 'lucide-react'
import Papa from 'papaparse'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { get } from '@/lib/api'
import { formatFriendlyErrorMessage, toFriendlyFieldLabel } from '@/lib/friendly-text'

export interface TargetColumn {
  key: string
  label: string
  required: boolean
  type: 'string' | 'number' | 'date' | 'fk'
  fkTable?: string
}

export interface ColumnMapping {
  targetKey: string
  sourceKey: string | null
}

export type CsvImportProgress = {
  currentChunk: number
  totalChunks: number
  uploadedBytes: number
  totalBytes: number
  currentChunkBytes: number
  chunkLimitBytes?: number
  percent: number
  message?: string
}

export type CsvImportProgressReporter = (progress: CsvImportProgress) => void

export type CsvImportHelpers = {
  onProgress?: CsvImportProgressReporter
  fileName?: string
  rowCount?: number
  columnCount?: number
}

interface CsvMappingWizardProps {
  title: string
  subtitle?: string
  targetColumns: TargetColumn[]
  onComplete: (
    mappings: ColumnMapping[],
    rows: Record<string, string>[],
    helpers?: CsvImportHelpers,
  ) => Promise<any>
  onCancel: () => void
  onFinish?: () => void
  showImportTimeConfirmation?: boolean
}

type Step = 'upload' | 'preview' | 'map' | 'validate' | 'done'
type ResourceItemCategory = 'fertilizer' | 'equipment' | 'chemical' | 'other' | ''
type DetailTypeResolution = {
  mode: 'existing' | 'new'
  selectedId: string
  newName: string
}

type DetailTypeGroup = {
  name: string
  rawValues: string[]
}

interface ExistingDetailType {
  act_header_detail_type_id: number
  act_header_type_id?: number | null
  act_header_detail_type_name_th?: string | null
}

interface ExistingResourceType {
  resource_used_type_id: number
  resc_used_type_name?: string | null
  resc_used_type_info?: string | null
}

interface ExistingFertilizer {
  act_fertilizer_name?: string | null
  resource_used_type_id?: number | null
}

interface ExistingEquipment {
  act_equipment_name?: string | null
  resource_used_type_id?: number | null
}

interface ExistingChemical {
  act_chemiscal_name?: string | null
  resource_used_type_id?: number | null
}

interface ExistingResourceOther {
  act_resourceOther_name?: string | null
  resource_used_type_id?: number | null
}

function normalizeCsvCell(value: unknown) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
}

function getJsonSizeBytes(value: unknown) {
  return new Blob([JSON.stringify(value)]).size
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const TYPE_LABELS: Record<TargetColumn['type'], string> = {
  string: 'ข้อความ',
  number: 'ตัวเลข',
  date: 'วันที่',
  fk: 'ข้อมูลอ้างอิง',
}

const RESOURCE_CATEGORY_LABELS: Record<Exclude<ResourceItemCategory, ''>, string> = {
  fertilizer: 'ปุ๋ย',
  equipment: 'อุปกรณ์',
  chemical: 'สารเคมี',
  other: 'อื่น ๆ',
}

const AUTO_MAP_ALIASES: Record<string, string[]> = {
  act_productYear_name:        ['ปีการผลิต', 'ปีผลิต', 'productionyear', 'cropyear', 'season', 'seasonyear'],
  log_act_detail_create_at:     ['วันที่ปฏิบัติ', 'วันที่', 'date', 'activitydate', 'startdate'],
  act_header_type:              ['หมวดหมู่กิจกรรมหลัก', 'กิจกรรมหลัก','ประเภทกิจกรรมหลัก','ประเภทกิจกรรม', 'activitytype', 'activity'],
  act_header_detail_type:       ['รายละเอียดกิจกรรมย่อย', 'รายละเอียดกิจกรรม', 'กิจกรรม', 'detailtype', 'operation'],
  land_camp_name:               ['ไร่', 'แคมป์', 'camp', 'campname', 'landcampname'],
  land_code:                    ['แปลง', 'รหัสแปลง', 'land', 'landcode', 'plot'],
  land_size:                    ['พื้นที่ตามแปลง', 'ขนาดแปลง', 'landsize', 'plotsize'],
  log_act_detail_areawork:      ['พื้นที่ปฏิบัติรวม', 'พื้นที่ปฏิบัติ', 'พื้นที่ปฏิบัติงาน', 'areawork', 'workarea'],
  act_header_typeLand_id:       ['ประเภทแปลง', 'landtype' , 'typeland' , 'typeLand'],
  act_header_typeSugarCane_id:  ['ประเภทอ้อย', 'ชนิดอ้อย', 'sugarcanetype'],
  resource_item_name:           ['รายการปัจจัยการผลิต','ปัจจัยการผลิต', 'ปัจจัยผลิต' ,'resourceitem', 'resourceitemname', 'listem' ],
  resource_used_type:           ['ประเภทปัจจัยการผลิต','ประเภทปัจจัย', 'sourceusagetype', 'usagetype', 'resourceusedtype' ],
  log_act_detail_volumeAll:     ['ปริมาณรวม', 'ปริมาณ' , 'totalvolume', 'volumeall'],
  log_act_detail_quatity:       ['จำนวน','จำนวณชิ้น', 'quantity', 'qty', 'math'],
  log_act_detail_volumePerUnit: ['ปริมาณต่อ1จำนวน', 'ปริมาณต่อจำนวน','ปริมาณใช้','ปริมาณต่อหน่วย','ปริมาณ/unit' ,'volumeperunit'],
  unit_name:                    ['หน่วยนับ', 'unit', 'unitname'],
}

type ImportRowAssessment = {
  rowNumber: number
  landCode: string
  campName: string
  status: 'ready' | 'placeholder' | 'blocking'
  message: string
}

type ImportEstimate = {
  durationLabel: string
  variant: 'warning' | 'info'
  warningText: string
}

type ImportErrorSummary = {
  key: string
  label: string
  count: number
  examples: string[]
}

function getImportEstimate(rowCount: number): ImportEstimate {
  if (rowCount >= 500) {
    return {
      durationLabel: 'หลาย นาที',
      variant: 'warning',
      warningText: 'ไฟล์ขนาดใหญ่และรายการที่ต้องสร้างข้อมูลอ้างอิงใหม่อาจใช้เวลานานกว่าปกติ กรุณาเปิดหน้านี้ไว้จนกว่าจะเสร็จ',
    }
  }

  if (rowCount >= 150) {
    return {
      durationLabel: 'ประมาณ 1-3 นาที',
      variant: 'warning',
      warningText: 'ถ้ามีการผูกข้อมูลหลายตารางหรือสร้างข้อมูลอ้างอิงใหม่ เวลาที่ใช้จริงอาจเพิ่มขึ้นเล็กน้อย',
    }
  }

  return {
    durationLabel: 'ไม่เกินประมาณ 1 นาที',
    variant: 'info',
    warningText: 'โดยปกติระบบจะประมวลผลได้ค่อนข้างเร็ว แต่เวลาอาจเพิ่มขึ้นได้หากต้องสร้างหรือผูกข้อมูลอ้างอิงเพิ่ม',
  }
}

function normalizeLookupKey(value: string | undefined | null) {
  return (value ?? '').trim().toLowerCase()
}

function sanitizeDetailTypeName(value: string | undefined | null) {
  return (value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\d+\s*[-–—:]\s*/, '')
    .replace(/\s*[-–—:]\s*(?:น้ำ|นํ้า|water)\s*\d+\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDetailTypeName(value: string | undefined | null) {
  return sanitizeDetailTypeName(value).toLowerCase()
}

function classifyImportError(message: string) {
  const normalized = message.toLowerCase()

  if (
    /ไม่มีทั้งรหัสแปลงและชื่อแคมป์/.test(normalized)
    || /ไม่พบ land_code และไม่มี land_camp_name/.test(normalized)
    || /ไม่พบไร่\/แปลง/.test(normalized)
  ) {
    return { key: 'missing-land', label: 'ไม่พบไร่/แปลง' }
  }

  if (/invalid date/.test(normalized) || /รูปแบบวันที่ไม่ถูกต้อง/.test(normalized) || /วันที่ผิด\/หาย/.test(normalized)) {
    return { key: 'invalid-date', label: 'วันที่ผิด/หาย' }
  }

  if (/invalid number/.test(normalized) || /รูปแบบตัวเลขไม่ถูกต้อง/.test(normalized)) {
    return { key: 'invalid-number', label: 'ตัวเลขผิดรูปแบบ' }
  }

  if (/กรอกข้อมูล.+ให้ครบถ้วน/.test(normalized) || /is required/.test(normalized) || /is missing/.test(normalized)) {
    return { key: 'missing-required', label: 'ข้อมูลสำคัญไม่ครบ' }
  }

  if (/foreign key/.test(normalized) || /ข้อมูลอ้างอิงไม่ถูกต้อง/.test(normalized)) {
    return { key: 'invalid-reference', label: 'ข้อมูลอ้างอิงไม่ถูกต้อง' }
  }

  if (/unique constraint/.test(normalized) || /ข้อมูลซ้ำ/.test(normalized)) {
    return { key: 'duplicate', label: 'ข้อมูลซ้ำ' }
  }

  if (/unit/.test(normalized) || /หน่วย/.test(normalized)) {
    return { key: 'unit-issue', label: 'unit สร้างหรือหาไม่สำเร็จ' }
  }

  if (/resource/.test(normalized) || /ปัจจัย/.test(normalized) || /fertilizer|equipment|chemical|other/.test(normalized)) {
    return { key: 'resource-issue', label: 'resource สร้างหรือหาไม่สำเร็จ' }
  }

  return { key: 'other', label: 'สาเหตุอื่น ๆ' }
}

function summarizeImportErrors(errors: string[]): ImportErrorSummary[] {
  const summaryMap = new Map<string, ImportErrorSummary>()

  errors.forEach((error) => {
    const category = classifyImportError(error)
    const existing = summaryMap.get(category.key)

    if (existing) {
      existing.count += 1
      if (existing.examples.length < 2) {
        existing.examples.push(error)
      }
      return
    }

    summaryMap.set(category.key, {
      key: category.key,
      label: category.label,
      count: 1,
      examples: [error],
    })
  })

  return Array.from(summaryMap.values()).sort((left, right) => right.count - left.count)
}

export function CsvMappingWizard({
  title,
  subtitle,
  targetColumns,
  onComplete,
  onCancel,
  onFinish,
  showImportTimeConfirmation = false,
}: CsvMappingWizardProps) {
  const [step, setStep] = useState<Step>('upload')
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows]     = useState<Record<string, string>[]>([])
  const [allRows, setAllRows]             = useState<Record<string, string>[]>([])
  const [mappings, setMappings]           = useState<ColumnMapping[]>(
    targetColumns.map((c) => ({ targetKey: c.key, sourceKey: null })),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null)
  const [importProgress, setImportProgress] = useState<CsvImportProgress | null>(null)
  const [fileName, setFileName]         = useState('')
  const [resourceItemCategories, setResourceItemCategories] = useState<Record<string, ResourceItemCategory>>({})
  const [resourceItemResourceTypes, setResourceItemResourceTypes] = useState<Record<string, string>>({})
  const [detailTypeSelections, setDetailTypeSelections] = useState<Record<string, DetailTypeResolution>>({})
  const [existingDetailTypes, setExistingDetailTypes] = useState<ExistingDetailType[]>([])
  const [existingResourceTypes, setExistingResourceTypes] = useState<ExistingResourceType[]>([])
  const [existingFertilizers, setExistingFertilizers] = useState<ExistingFertilizer[]>([])
  const [existingEquipments, setExistingEquipments] = useState<ExistingEquipment[]>([])
  const [existingChemicals, setExistingChemicals] = useState<ExistingChemical[]>([])
  const [existingResourceOthers, setExistingResourceOthers] = useState<ExistingResourceOther[]>([])
  const [showImportConfirm, setShowImportConfirm] = useState(false)

  const STEPS: Step[] = ['upload', 'preview', 'map', 'validate', 'done']
  const stepLabels: Record<Step, string> = {
    upload:   'อัพโหลดไฟล์',
    preview:  'ตรวจสอบ headers',
    map:      'จับคู่ column',
    validate: 'ตรวจสอบข้อมูล',
    done:     'เสร็จสิ้น',
  }

  function inferResourceCategory(value: string | null | undefined) {
    const normalized = (value ?? '').trim().toLowerCase()
    if (!normalized) return ''
    if (/อุปกรณ์|equipment/.test(normalized)) return 'equipment'
    if (/เคมี|chemical/.test(normalized)) return 'chemical'
    if (/ปุ๋ย|fertilizer/.test(normalized)) return 'fertilizer'
    if (/อื่น|other|resourceother|resource_other|พันธุ์|variety|sugarcane|อ้อย/.test(normalized)) return 'other'
    return ''
  }

  function inferResourceCategoryFromTypeId(typeId: string | undefined) {
    const parsedId = Number.parseInt(typeId ?? '', 10)
    if (!Number.isFinite(parsedId)) return ''

    const matchedByMaster = existingFertilizers.some((item) => item.resource_used_type_id === parsedId)
      ? 'fertilizer'
      : existingEquipments.some((item) => item.resource_used_type_id === parsedId)
        ? 'equipment'
        : existingChemicals.some((item) => item.resource_used_type_id === parsedId)
          ? 'chemical'
          : existingResourceOthers.some((item) => item.resource_used_type_id === parsedId)
            ? 'other'
            : ''

    if (matchedByMaster) return matchedByMaster

    const matchedTypeName = existingResourceTypes.find((item) => item.resource_used_type_id === parsedId)?.resc_used_type_name
    return inferResourceCategory(matchedTypeName)
  }

  function normalizeHeaderName(value: string | undefined) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/["']/g, '')
      .replace(/[()]/g, ' ')
      .replace(/[\/\\_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function normalizeCompactName(value: string | undefined) {
    return normalizeHeaderName(value).replace(/[^a-z0-9ก-๙]/g, '')
  }

  function getAutoMapCandidates(target: TargetColumn) {
    return Array.from(
      new Set([
        target.key,
        target.label,
        ...(AUTO_MAP_ALIASES[target.key] ?? []),
      ]),
    )
  }

  function findAutoMappedHeader(target: TargetColumn, headers: string[], usedHeaders: Set<string>) {
    const availableHeaders = headers.filter((header) => !usedHeaders.has(header))
    const candidates = getAutoMapCandidates(target)
    const candidateCompactNames = candidates.map(normalizeCompactName).filter(Boolean)

    const exactCompactMatch = availableHeaders.find((header) => {
      const normalizedHeader = normalizeCompactName(header)
      return candidateCompactNames.includes(normalizedHeader)
    })
    if (exactCompactMatch) return exactCompactMatch

    const includesMatch = availableHeaders.find((header) => {
      const normalizedHeader = normalizeCompactName(header)
      return candidateCompactNames.some((candidate) =>
        normalizedHeader.includes(candidate) || candidate.includes(normalizedHeader),
      )
    })
    if (includesMatch) return includesMatch

    return null
  }

  function getMatchingDetailTypes(detailType: string) {
    const normalized = normalizeDetailTypeName(detailType)
    if (!normalized) return []
    return existingDetailTypes.filter((item) => normalizeDetailTypeName(item.act_header_detail_type_name_th ?? '') === normalized)
  }

  function handleFile(file: File) {
    setFileName(file.name)
    setSubmitError(null)
    setSourceHeaders([])
    setPreviewRows([])
    setAllRows([])
    setImportResult(null)
    setImportProgress(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = Papa.parse<string[]>(text, {
        skipEmptyLines: 'greedy',
      })

      if (parsed.errors.length > 0) {
        setSubmitError(`อ่านไฟล์ CSV ไม่สำเร็จ: ${parsed.errors[0].message}`)
        return
      }

      const parsedRows = parsed.data.map((row) => row.map((value) => normalizeCsvCell(value)))
      if (parsedRows.length < 2) {
        setSubmitError('ไฟล์ CSV ต้องมีอย่างน้อย 1 header และ 1 แถวข้อมูล')
        return
      }

      const headers = parsedRows[0]
      const rows = parsedRows.slice(1).map((values) =>
        Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
      )
      setSourceHeaders(headers)
      setPreviewRows(rows.slice(0, 5))
      setAllRows(rows)
      const usedHeaders = new Set<string>()

      setMappings(targetColumns.map((tc) => {
        const auto = findAutoMappedHeader(tc, headers, usedHeaders)
        if (auto) usedHeaders.add(auto)
        return { targetKey: tc.key, sourceKey: auto }
      }))
      setStep('preview')
    }
    reader.onerror = () => {
      setSubmitError('ไม่สามารถอ่านไฟล์ CSV ได้ กรุณาลองอัปโหลดใหม่อีกครั้ง')
    }
    reader.readAsText(file)
  }

  function setMapping(targetKey: string, sourceKey: string | null) {
    setMappings((prev) =>
      prev.map((m) => (m.targetKey === targetKey ? { ...m, sourceKey } : m)),
    )
  }

  const requiredMapped = targetColumns
    .filter((c) => c.required)
    .every((c) => mappings.find((m) => m.targetKey === c.key)?.sourceKey)

  const mapIdx = Object.fromEntries(mappings.filter((m) => m.sourceKey).map((m) => [m.targetKey, m.sourceKey!]))
  const resourceItemNameKey = mapIdx['resource_item_name']
  const resourceUsageTypeKey = mapIdx['resource_used_type']
  const detailTypeKey = mapIdx['act_header_detail_type']
  const landCodeKey = mapIdx['land_code']
  const campNameKey = mapIdx['land_camp_name']
  const shouldAssessLandRows = targetColumns.some((column) => column.key === 'land_code' || column.key === 'land_camp_name')
  const uniqueResourceItems = resourceItemNameKey
    ? Array.from(new Set(allRows.map((row) => row[resourceItemNameKey]?.trim() ?? '').filter(Boolean)))
    : []
  const detailTypeGroups = detailTypeKey
    ? Array.from(
        allRows.reduce((map, row) => {
          const rawValue = row[detailTypeKey]?.trim() ?? ''
          const canonicalName = sanitizeDetailTypeName(rawValue)
          const key = normalizeDetailTypeName(canonicalName)
          if (!key || !canonicalName) return map

          const group = map.get(key) ?? { name: canonicalName, rawValues: [] }
          if (rawValue && !group.rawValues.includes(rawValue)) group.rawValues.push(rawValue)
          map.set(key, group)
          return map
        }, new Map<string, DetailTypeGroup>()).values(),
      )
    : []
  const uniqueDetailTypes = detailTypeGroups.map((group) => group.name)
  const detailTypeRawValuesByName = Object.fromEntries(
    detailTypeGroups.map((group) => [group.name, group.rawValues]),
  ) as Record<string, string[]>
  const resourceTypeNameToId = Object.fromEntries(
    existingResourceTypes
      .map((item) => [normalizeLookupKey(item.resc_used_type_name), item.resource_used_type_id] as const)
      .filter(([key]) => Boolean(key)),
  )
  const resourceTypeIdToName = Object.fromEntries(
    existingResourceTypes.map((item) => [item.resource_used_type_id, item.resc_used_type_name?.trim() ?? `#${item.resource_used_type_id}`]),
  )
  const resourceTypeValuesByItem = Object.fromEntries(
    uniqueResourceItems.map((item) => {
      const values = resourceUsageTypeKey
        ? Array.from(
            new Set(
              allRows
                .filter((row) => (row[resourceItemNameKey]?.trim() ?? '') === item)
                .map((row) => row[resourceUsageTypeKey]?.trim() ?? '')
                .filter(Boolean),
            ),
          )
        : []
      return [item, values]
    }),
  ) as Record<string, string[]>

  const rowAssessments: ImportRowAssessment[] = shouldAssessLandRows ? allRows.map((row, index) => {
    const landCode = landCodeKey ? row[landCodeKey]?.trim() ?? '' : ''
    const campName = campNameKey ? row[campNameKey]?.trim() ?? '' : ''

    if (landCode) {
      return {
        rowNumber: index + 2,
        landCode,
        campName,
        status: 'ready',
        message: `Row ${index + 2}: ใช้แปลง "${landCode}"${campName ? ` ในแคมป์ "${campName}"` : ''}`,
      }
    }

    if (campName) {
      return {
        rowNumber: index + 2,
        landCode,
        campName,
        status: 'placeholder',
        message: `Row ${index + 2}: ไม่มีรหัสแปลง จึงจะบันทึกเป็น "เบิกเข้าไร่" ของแคมป์ "${campName}"`,
      }
    }

    return {
      rowNumber: index + 2,
      landCode,
      campName,
      status: 'blocking',
      message: `Row ${index + 2}: ไม่มีทั้งรหัสแปลงและชื่อแคมป์`,
    }
  }) : []

  const readyRows = rowAssessments.filter((row) => row.status === 'ready')
  const placeholderRows = rowAssessments.filter((row) => row.status === 'placeholder')
  const blockingRows = rowAssessments.filter((row) => row.status === 'blocking')
  const importErrorSummaries = summarizeImportErrors(importResult?.errors ?? [])

  const unresolvedDetailTypes = detailTypeKey
    ? uniqueDetailTypes.filter((detailType) => {
        const resolution = detailTypeSelections[detailType]
        const hasMatches = getMatchingDetailTypes(detailType).length > 0

        if (hasMatches && resolution?.mode !== 'new') {
          return !resolution?.selectedId
        }

        return !(resolution?.newName?.trim())
      })
    : []
  const isImportBlocked = isSubmitting || unresolvedDetailTypes.length > 0 || blockingRows.length > 0
  const importEstimate = getImportEstimate(allRows.length)
  const importConfirmationMessage = `ข้อมูล ${allRows.length} แถว คาดว่าใช้เวลาประมวลผล${importEstimate.durationLabel}. ${importEstimate.warningText}`

  useEffect(() => {
    let active = true

    Promise.allSettled([
      get<ExistingDetailType[]>('/activities/detail-types'),
      get<ExistingResourceType[]>('/activities/resource-types'),
      get<ExistingFertilizer[]>('/activities/fertilizers'),
      get<ExistingEquipment[]>('/activities/equipments'),
      get<ExistingChemical[]>('/activities/chemicals'),
      get<ExistingResourceOther[]>('/activities/resource-others'),
    ]).then((results) => {
      if (!active) return

      setExistingDetailTypes(results[0].status === 'fulfilled' ? results[0].value : [])
      setExistingResourceTypes(results[1].status === 'fulfilled' ? results[1].value : [])
      setExistingFertilizers(results[2].status === 'fulfilled' ? results[2].value : [])
      setExistingEquipments(results[3].status === 'fulfilled' ? results[3].value : [])
      setExistingChemicals(results[4].status === 'fulfilled' ? results[4].value : [])
      setExistingResourceOthers(results[5].status === 'fulfilled' ? results[5].value : [])
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!resourceItemNameKey) return

    setResourceItemCategories((prev) => {
      const next = { ...prev }
      let changed = false

      for (const item of Object.keys(next)) {
        if (!uniqueResourceItems.includes(item)) {
          delete next[item]
          changed = true
        }
      }

      for (const item of uniqueResourceItems) {
        if (next[item]) continue

        const normalizedItem = normalizeLookupKey(item)
        const matchedExistingItem =
          existingFertilizers.find((row) => normalizeLookupKey(row.act_fertilizer_name) === normalizedItem)
            ? 'fertilizer'
            : existingEquipments.find((row) => normalizeLookupKey(row.act_equipment_name) === normalizedItem)
              ? 'equipment'
            : existingChemicals.find((row) => normalizeLookupKey(row.act_chemiscal_name) === normalizedItem)
              ? 'chemical'
              : existingResourceOthers.find((row) => normalizeLookupKey(row.act_resourceOther_name) === normalizedItem)
                ? 'other'
                : ''

        const inferredFromCsv = resourceTypeValuesByItem[item]
          ?.map((value) => inferResourceCategory(value))
          .find((category) => Boolean(category))

        const inferred = matchedExistingItem
          || inferredFromCsv
          || inferResourceCategoryFromTypeId(resourceItemResourceTypes[item])

        if (inferred) {
          next[item] = inferred
          changed = true
        }
      }

      return changed ? next : prev
    })

    setResourceItemResourceTypes((prev) => {
      const next = { ...prev }
      let changed = false

      for (const item of Object.keys(next)) {
        if (!uniqueResourceItems.includes(item)) {
          delete next[item]
          changed = true
        }
      }

      for (const item of uniqueResourceItems) {
        if (next[item]) continue

        const normalizedItem = normalizeLookupKey(item)
        const matchedResourceTypeId =
          existingFertilizers.find((row) => normalizeLookupKey(row.act_fertilizer_name) === normalizedItem)?.resource_used_type_id
          ?? existingEquipments.find((row) => normalizeLookupKey(row.act_equipment_name) === normalizedItem)?.resource_used_type_id
          ?? existingChemicals.find((row) => normalizeLookupKey(row.act_chemiscal_name) === normalizedItem)?.resource_used_type_id
          ?? existingResourceOthers.find((row) => normalizeLookupKey(row.act_resourceOther_name) === normalizedItem)?.resource_used_type_id

        const inferredFromCsv = resourceTypeValuesByItem[item]
          ?.map((value) => resourceTypeNameToId[normalizeLookupKey(value)])
          .find((value) => Number.isFinite(value))

        const resolvedId = matchedResourceTypeId ?? inferredFromCsv

        if (resolvedId) {
          next[item] = String(resolvedId)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [
    allRows,
    existingChemicals,
    existingEquipments,
    existingFertilizers,
    existingResourceOthers,
    resourceItemNameKey,
    resourceItemResourceTypes,
    resourceTypeNameToId,
    resourceTypeValuesByItem,
    uniqueResourceItems,
  ])

  useEffect(() => {
    if (!detailTypeKey) return

    setDetailTypeSelections((prev) => {
      const next = { ...prev }
      let changed = false

      for (const detailType of uniqueDetailTypes) {
        const matches = getMatchingDetailTypes(detailType)
        const current = next[detailType]
        const canKeepExistingSelection = Boolean(
          current?.selectedId && matches.some((item) => String(item.act_header_detail_type_id) === current.selectedId),
        )

        const resolved: DetailTypeResolution = matches.length > 0
          ? {
              mode: current?.mode === 'new' ? 'new' : 'existing',
              selectedId: canKeepExistingSelection ? current!.selectedId : String(matches[0].act_header_detail_type_id),
              newName: current?.newName ?? detailType,
            }
          : {
              mode: 'new',
              selectedId: '',
              newName: current?.newName ?? detailType,
            }

        if (
          !current
          || current.mode !== resolved.mode
          || current.selectedId !== resolved.selectedId
          || current.newName !== resolved.newName
        ) {
          next[detailType] = resolved
          changed = true
        }
      }

      for (const detailType of Object.keys(next)) {
        if (!uniqueDetailTypes.includes(detailType)) {
          delete next[detailType]
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [detailTypeKey, existingDetailTypes, uniqueDetailTypes])

  function setResourceItemCategory(item: string, category: ResourceItemCategory) {
    setResourceItemCategories((prev) => ({ ...prev, [item]: category }))
  }

  function setResourceItemResourceType(item: string, resourceTypeId: string) {
    setResourceItemResourceTypes((prev) => ({ ...prev, [item]: resourceTypeId }))

    if (!resourceTypeId) return

    const inferredCategory = inferResourceCategoryFromTypeId(resourceTypeId)
    if (!inferredCategory) return

    setResourceItemCategories((prev) => (
      prev[item] && inferredCategory !== 'other'
        ? prev
        : { ...prev, [item]: inferredCategory }
    ))
  }

  function setDetailTypeSelection(detailType: string, value: string) {
    const matches = getMatchingDetailTypes(detailType)

    setDetailTypeSelections((prev) => ({
      ...prev,
      [detailType]: value === '__new__'
        ? {
            mode: 'new',
            selectedId: '',
            newName: prev[detailType]?.newName ?? detailType,
          }
        : {
            mode: matches.length > 0 ? 'existing' : 'new',
            selectedId: matches.length > 0 ? value : '',
            newName: prev[detailType]?.newName ?? detailType,
          },
    }))
  }

  function setDetailTypeText(detailType: string, value: string) {
    setDetailTypeSelections((prev) => ({
      ...prev,
      [detailType]: {
        mode: 'new',
        selectedId: '',
        newName: value,
      },
    }))
  }

  function toNumber(value: string | undefined) {
    const parsed = Number.parseFloat((value ?? '').trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }

  function getFriendlySubmitError(message: string) {
    const friendlyMessage = formatFriendlyErrorMessage(message)

    if (/timeout/i.test(message)) {
      return 'การนำเข้าใช้เวลานานกว่าที่ระบบรอไหว กรุณาอย่ากดปุ่มนำเข้าซ้ำทันที และตรวจสอบว่าข้อมูลมีจำนวนมากหรือมีแถวที่ต้องสร้างข้อมูลอ้างอิงหลายรายการ'
    }

    if (/land_code|land_camp_name|รหัสแปลง|ชื่อแคมป์/i.test(message)) {
      return `ไม่สามารถนำเข้าบางแถวได้เพราะข้อมูลแปลงหรือแคมป์ไม่ครบ: ${friendlyMessage}`
    }

    return `ระบบนำเข้าไม่สำเร็จ: ${friendlyMessage}`
  }

  async function handleSubmit() {
    setShowImportConfirm(false)
    setSubmitError(null)
    setImportProgress(null)
    setIsSubmitting(true)
    try {
      const volumeAllKey = mappings.find((m) => m.targetKey === 'log_act_detail_volumeAll')?.sourceKey ?? null
      const volumePerUnitKey = mappings.find((m) => m.targetKey === 'log_act_detail_volumePerUnit')?.sourceKey ?? null
      const quantityKey = mappings.find((m) => m.targetKey === 'log_act_detail_quatity')?.sourceKey ?? null

      const enhancedRows = allRows.map((row) => {
        let nextRow = row

        if (volumeAllKey && !nextRow[volumeAllKey]?.trim()) {
          const volumePerUnit = toNumber(nextRow[volumePerUnitKey ?? ''])
          const quantity = Number.parseFloat((nextRow[quantityKey ?? ''] ?? '').trim())

          if (Number.isFinite(quantity) && volumePerUnit !== undefined) {
            nextRow = { ...nextRow, [volumeAllKey]: String(quantity * volumePerUnit) }
          }
        }

        if (detailTypeKey) {
          const originalDetailType = row[detailTypeKey]?.trim() ?? ''
          const canonicalDetailType = sanitizeDetailTypeName(originalDetailType)
          const selection = detailTypeSelections[canonicalDetailType]
          const selectedValue = selection?.newName?.trim()

          if (selection?.mode === 'existing' && selection.selectedId) {
            nextRow = { ...nextRow, resolved_act_header_detail_type_id: selection.selectedId }
          }

          if (selection?.mode === 'new' && selectedValue && selectedValue !== originalDetailType) {
            nextRow = { ...nextRow, [detailTypeKey]: selectedValue }
          }
        }

        if (resourceItemNameKey) {
          const item = nextRow[resourceItemNameKey]?.trim() ?? ''
          const category = item ? resourceItemCategories[item] : ''
          const resourceTypeId = item ? resourceItemResourceTypes[item] : ''
          if (category) {
            nextRow = { ...nextRow, resource_item_category: category }
          }
          if (resourceTypeId) {
            nextRow = {
              ...nextRow,
              resolved_resource_used_type_id: resourceTypeId,
              resolved_resource_used_type_name: resourceTypeIdToName[Number(resourceTypeId)] ?? '',
            }
          }
        }

        return nextRow
      })

      const estimatedTotalBytes = getJsonSizeBytes({ mappings, rows: enhancedRows })
      setImportProgress({
        currentChunk: 0,
        totalChunks: 0,
        uploadedBytes: 0,
        totalBytes: estimatedTotalBytes,
        currentChunkBytes: 0,
        percent: 0,
        message: 'กำลังเตรียมข้อมูลนำเข้า',
      })

      const res = await onComplete(mappings, enhancedRows, {
        onProgress: (progress) => setImportProgress(progress),
        fileName,
        rowCount: allRows.length,
        columnCount: sourceHeaders.length,
      })
      if (res) setImportResult(res as any)
      setImportProgress((prev) => (
        prev
          ? {
              ...prev,
              uploadedBytes: prev.totalBytes,
              currentChunkBytes: 0,
              percent: 100,
              message: 'นำเข้าข้อมูลครบทุกชุดแล้ว',
            }
          : prev
      ))
      setStep('done')
    } catch (error: any) {
      setSubmitError(getFriendlySubmitError(error?.message || 'เกิดข้อผิดพลาดระหว่างนำเข้าข้อมูล'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleValidateSubmitClick() {
    if (isImportBlocked) return
    if (!showImportTimeConfirmation) {
      void handleSubmit()
      return
    }
    setShowImportConfirm(true)
  }

  const currentStepIdx = STEPS.indexOf(step)
  const isLocked = isSubmitting
  const importProgressPercent = importProgress
    ? Math.min(100, Math.max(0, Math.round(importProgress.percent)))
    : 0
  const getSelectStateClass = (hasValue: boolean) =>
    hasValue
      ? 'border-primary-300 bg-primary-50 text-primary-900 shadow-sm'
      : 'border-surface-200 bg-white text-surface-500'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-auto">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => {
          if (!isLocked) onCancel()
        }}
      />
      {/* <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-2xl animate-slide-up"> */}
      {/* <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-5xl animate-slide-up"> */}
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-5xl max-h-[90vh] flex flex-col animate-slide-up">
      {/* <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-5xl max-h-[90vh] overflow-auto  animate-slide-up"> */}
        {/* Header */}
        <div className={`px-6 py-5 border-b border-surface-100 shrink-0 ${isLocked ? 'pointer-events-none select-none' : ''}`}>
          <h2 className="font-semibold text-surface-900">{title}</h2>
          {subtitle && <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>}
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`wizard-step-dot ${
                  i < currentStepIdx ? 'done' : i === currentStepIdx ? 'active' : 'pending'
                }`}>
                  {i < currentStepIdx ? <CheckCircle size={12} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === currentStepIdx ? 'text-primary-700 font-medium' : 'text-surface-400'}`}>
                  {stepLabels[s]}
                </span>
                {i < STEPS.length - 1 && <ChevronRight size={12} className="text-surface-300 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className={`p-6 overflow-y-auto flex-1 min-h-0 ${isLocked ? 'pointer-events-none select-none' : ''}`}>
          {submitError && step !== 'validate' && (
            <div className="alert-error mb-4">
              <div>
                <p className="text-sm font-medium text-red-700">ระบบนำเข้าไม่สำเร็จ</p>
                <p className="text-xs mt-1 text-red-700">{submitError}</p>
              </div>
              <XCircle size={16} className="text-red-500 shrink-0" />
            </div>
          )}

          {/* Step: upload */}
          {step === 'upload' && (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-surface-200 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors group">
              <Upload size={28} className="text-surface-300 group-hover:text-primary-500 mb-3" />
              <p className="text-sm font-medium text-surface-600">คลิก CSV มาที่นี่</p>
              <p className="text-xs text-surface-400 mt-1">รองรับ .csv เท่านั้น</p>
              <input type="file" accept=".csv" className="hidden" disabled={isLocked} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          )}

          {/* Step: preview */}
          {step === 'preview' && (
            <div>
              <p className="text-sm text-surface-600 mb-3">พบ <strong>{sourceHeaders.length} column</strong>, <strong>{allRows.length} แถว</strong> จากไฟล์ <em>{fileName}</em></p>
              <div className="table-wrapper overflow-auto max-h-48">
                <table className="table text-xs">
                  <thead><tr>{sourceHeaders.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>{sourceHeaders.map((h) => <td key={h}>{row[h]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-5">
                <button className="btn-secondary flex-1" onClick={() => setStep('upload')} disabled={isLocked}>กลับ</button>
                <button className="btn-primary flex-1" onClick={() => setStep('map')} disabled={isLocked}>ต่อไป <ArrowRight size={14} /></button>
              </div>
            </div>
          )}

          {/* Step: map */}
          {step === 'map' && (
            <div>
              <p className="text-sm text-surface-500 mb-4">จับคู่ column จากไฟล์ CSV กับ field ในฐานข้อมูล</p>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {targetColumns.map((tc) => {
                  const mapping = mappings.find((m) => m.targetKey === tc.key)
                  const isMapped = Boolean(mapping?.sourceKey)
                  return (
                    <div
                      key={tc.key}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isMapped
                          ? 'border-primary-200 bg-primary-50/70'
                          : 'border-surface-200 bg-surface-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isMapped ? 'text-primary-900' : 'text-surface-700'}`}>
                          {tc.label}
                          {tc.required && <span className="text-red-500 ml-0.5">*</span>}
                        </p>
                        <p className="text-[10px] text-surface-400">
                          ชนิดข้อมูล: {TYPE_LABELS[tc.type]}
                          {tc.fkTable ? ` · ใช้ข้อมูลอ้างอิงจาก ${toFriendlyFieldLabel(tc.key, tc.label)}` : ''}
                        </p>
                      </div>
                      <span className={isMapped ? 'badge-green shrink-0' : 'badge-gray shrink-0'}>
                        {isMapped ? 'จับคู่แล้ว' : 'ยังไม่เลือก'}
                      </span>
                      <ArrowRight size={14} className="text-surface-300 shrink-0" />
                      <select
                        value={mapping?.sourceKey ?? ''}
                        onChange={(e) => setMapping(tc.key, e.target.value || null)}
                        disabled={isLocked}
                        className={`select text-xs w-44 shrink-0 transition-colors ${getSelectStateClass(isMapped)}`}
                      >
                        <option value="">— ไม่จับคู่ —</option>
                        {sourceHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
              {!requiredMapped && (
                <p className="text-xs text-red-500 mt-3">* กรุณาจับคู่ข้อมูลที่จำเป็นให้ครบถ้วน</p>
              )}
              <div className="flex gap-3 mt-5">
                <button className="btn-secondary flex-1" onClick={() => setStep('preview')} disabled={isLocked}>กลับ</button>
                <button className="btn-primary flex-1" onClick={() => setStep('validate')} disabled={!requiredMapped || isLocked}>
                  ตรวจสอบ <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step: validate */} 
          {/* คิดว่าต้องเพิ่มการตรวจสอบอีก maybe will more process */}
          {step === 'validate' && (
            <div>
              {submitError && (
                <div className="alert-error mb-4">
                  <div>
                    <p className="text-sm font-medium text-red-700">ระบบนำเข้าไม่สำเร็จ</p>
                    <p className="text-xs mt-1 text-red-700">{submitError}</p>
                    <p className="text-xs mt-2 text-red-600">คำแนะนำ: ตรวจสอบแถวที่ไม่มี land/camp, ตรวจสอบชื่อประเภทกิจกรรมย่อย, และรอให้การประมวลผลเดิมจบก่อนลองใหม่</p>
                  </div>
                </div>
              )}
              {importProgress && (
                <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-primary-900">
                        {importProgress.message ?? 'กำลังนำเข้าข้อมูล'}
                      </p>
                      <p className="mt-0.5 text-xs text-primary-700">
                        {importProgress.totalChunks > 0
                          ? `ชุดที่ ${Math.max(importProgress.currentChunk, 1)} / ${importProgress.totalChunks}`
                          : 'กำลังคำนวณขนาดชุดข้อมูล'}
                        {' · '}
                        {formatBytes(importProgress.uploadedBytes)} / {formatBytes(importProgress.totalBytes)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-800 shadow-sm">
                      {importProgressPercent}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${importProgressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-primary-700">
                    คิด progress จากขนาดข้อมูลที่แบ่งส่งเข้า API:
                    {' '}ชุดปัจจุบันประมาณ {formatBytes(importProgress.currentChunkBytes)}
                    {importProgress.chunkLimitBytes ? ` จากขนาดชุดมาตรฐาน ${formatBytes(importProgress.chunkLimitBytes)}` : ''}
                  </p>
                </div>
              )}
              <div className="grid gap-4 mb-4 md:grid-cols-3">
                <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
                  <p className="text-sm font-medium text-primary-800">พร้อมนำเข้า</p>
                  <p className="text-2xl font-semibold text-primary-700 mt-1">{readyRows.length}</p>
                  <p className="text-xs text-primary-700 mt-2">แถวที่มีรหัสแปลง พร้อมใช้แปลงจริง</p>
                  {readyRows.slice(0, 5).length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-primary-800">
                      {readyRows.slice(0, 5).map((row) => (
                        <li key={`ready-${row.rowNumber}`}>{row.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-800">จะใช้แปลงอัตโนมัติของแคมป์</p>
                  <p className="text-2xl font-semibold text-blue-700 mt-1">{placeholderRows.length}</p>
                  <p className="text-xs text-blue-700 mt-2">แถวที่ไม่มีรหัสแปลง แต่มีชื่อแคมป์ และระบบจะผูกกับแปลงอัตโนมัติของแคมป์</p>
                  {placeholderRows.slice(0, 5).length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-blue-800">
                      {placeholderRows.slice(0, 5).map((row) => (
                        <li key={`placeholder-${row.rowNumber}`}>{row.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">ต้องแก้ก่อนนำเข้า</p>
                  <p className="text-2xl font-semibold text-red-700 mt-1">{blockingRows.length}</p>
                  <p className="text-xs text-red-700 mt-2">แถวที่ไม่มีทั้งรหัสแปลงและชื่อแคมป์ จึงยังบันทึกกิจกรรมไม่ได้</p>
                  {blockingRows.slice(0, 5).length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-red-800">
                      {blockingRows.slice(0, 5).map((row) => (
                        <li key={`blocking-${row.rowNumber}`}>{row.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {resourceItemNameKey && uniqueResourceItems.length > 0 && (
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 mb-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">กำหนดรายการปัจจัยและประเภทการใช้งาน</p>
                    <p className="text-xs text-surface-500">
                      แยกความหมายให้ชัดเจน: `รายการปัจจัย` คือจะบันทึกเป็น ปุ๋ย / อุปกรณ์ / สารเคมี และ `ประเภทการใช้งาน`
                      คือ `resource_used_type` ที่อ้างอิงจากข้อมูลในหน้าจัดการประเภทปัจจัย
                    </p>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {uniqueResourceItems.map((item) => {
                      const csvResourceTypes = resourceTypeValuesByItem[item] ?? []
                      const selectedTypeId = resourceItemResourceTypes[item] ?? ''
                      const selectedCategory = resourceItemCategories[item] ?? ''
                      const hasResolvedSelection = Boolean(selectedCategory || selectedTypeId)

                      return (
                        <div key={item} className="rounded-lg border border-surface-200 bg-white p-3">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-surface-800 truncate">{item}</p>
                              <p className="mt-1 text-[11px] text-surface-500">
                                {csvResourceTypes.length > 0
                                  ? `ค่าประเภทการใช้งานจากไฟล์: ${csvResourceTypes.join(', ')}`
                                  : 'ไฟล์นี้ไม่มีค่าประเภทการใช้งานที่อ่านได้สำหรับรายการนี้'}
                              </p>
                            </div>
                            <span className={hasResolvedSelection ? 'badge-green shrink-0' : 'badge-gray shrink-0'}>
                              {hasResolvedSelection ? 'กำหนดแล้ว' : 'ใช้ค่าอัตโนมัติ'}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-surface-600">
                                รายการปัจจัยจะถูกบันทึกเป็น
                              </label>
                              <select
                                value={selectedCategory}
                                onChange={(e) => setResourceItemCategory(item, e.target.value as ResourceItemCategory)}
                                disabled={isLocked}
                                className={`select text-xs w-full transition-colors ${getSelectStateClass(Boolean(selectedCategory))}`}
                              >
                                <option value="">เลือกกลุ่มอัตโนมัติ</option>
                                <option value="fertilizer">ปุ๋ย</option>
                                <option value="equipment">อุปกรณ์</option>
                                <option value="chemical">สารเคมี</option>
                                <option value="other">อื่น ๆ</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-surface-600">
                                ประเภทการใช้งาน (`resource_used_type`)
                              </label>
                              <select
                                value={selectedTypeId}
                                onChange={(e) => setResourceItemResourceType(item, e.target.value)}
                                disabled={isLocked}
                                className={`select text-xs w-full transition-colors ${getSelectStateClass(Boolean(selectedTypeId))}`}
                              >
                                <option value="">ใช้ค่าจากไฟล์ CSV</option>
                                {existingResourceTypes.map((type) => (
                                  <option key={type.resource_used_type_id} value={type.resource_used_type_id}>
                                    {type.resc_used_type_name?.trim() || `#${type.resource_used_type_id}`}
                                  </option>
                                ))}
                              </select>
                              {selectedTypeId && (
                                <p className="mt-1 text-[11px] text-surface-500">
                                  เลือกไว้: {resourceTypeIdToName[Number(selectedTypeId)] ?? `#${selectedTypeId}`}
                                </p>
                              )}
                            </div>
                          </div>

                          {(selectedCategory || selectedTypeId) && (
                            <p className="mt-2 text-[11px] text-surface-500">
                              สรุป: {selectedCategory ? RESOURCE_CATEGORY_LABELS[selectedCategory as Exclude<ResourceItemCategory, ''>] : 'ใช้กลุ่มอัตโนมัติ'}
                              {' -> '}
                              {selectedTypeId ? (resourceTypeIdToName[Number(selectedTypeId)] ?? `#${selectedTypeId}`) : 'ใช้ประเภทจากไฟล์ CSV'}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {detailTypeKey && uniqueDetailTypes.length > 0 && (
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 mb-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">ยืนยันประเภทกิจกรรมย่อย</p>
                    <p className="text-xs text-surface-500">ถ้ามีชื่อเดิมในฐานข้อมูลให้เลือก row เดิมเพื่อกันข้อมูลซ้ำ; ถ้าเป็นชื่อใหม่ให้จัดการข้อความก่อนสร้าง</p>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {uniqueDetailTypes.map((detailType) => {
                      const matches = getMatchingDetailTypes(detailType)
                      const resolution = detailTypeSelections[detailType]
                      const rawValues = detailTypeRawValuesByName[detailType] ?? []
                      const hasExistingSelection = resolution?.mode !== 'new' && Boolean(resolution?.selectedId)
                      const hasNewSelection = resolution?.mode === 'new' && Boolean(resolution?.newName?.trim())
                      const hasResolvedSelection = hasExistingSelection || hasNewSelection

                      return (
                        <div key={detailType} className="flex flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1 text-xs text-surface-700">
                            <div className="truncate font-medium">{detailType}</div>
                            {rawValues.length > 1 && (
                              <p className="mt-1 text-[11px] text-surface-500">
                                รวม {rawValues.length} รูปแบบจาก CSV
                              </p>
                            )}
                          </div>
                          <div className="w-full sm:w-80 space-y-2">
                            <span className={hasResolvedSelection ? 'badge-green' : 'badge-gray'}>
                              {hasResolvedSelection ? 'เลือกแล้ว' : 'ยังไม่เลือก'}
                            </span>
                            {matches.length > 0 ? (
                              <>
                                <select
                                  value={resolution?.mode === 'new' ? '__new__' : (resolution?.selectedId ?? '')}
                                  onChange={(e) => setDetailTypeSelection(detailType, e.target.value)}
                                  disabled={isLocked}
                                  className={`select text-xs w-full transition-colors ${getSelectStateClass(hasResolvedSelection)}`}
                                >
                                  {matches.map((item) => (
                                    <option key={item.act_header_detail_type_id} value={item.act_header_detail_type_id}>
                                      #{item.act_header_detail_type_id} · {item.act_header_detail_type_name_th ?? '—'}
                                    </option>
                                  ))}
                                  <option value="__new__">สร้างชื่อใหม่ / แก้ชื่อเอง</option>
                                </select>
                                {resolution?.mode === 'new' && (
                                  <textarea
                                    value={resolution.newName}
                                    onChange={(e) => setDetailTypeText(detailType, e.target.value)}
                                    disabled={isLocked}
                                    className="input text-xs min-h-20 w-full"
                                    placeholder="ตั้งชื่อรายละเอียดกิจกรรมย่อยใหม่"
                                  />
                                )}
                              </>
                            ) : (
                              <textarea
                                value={resolution?.newName ?? detailType}
                                onChange={(e) => setDetailTypeText(detailType, e.target.value)}
                                disabled={isLocked}
                                className="input text-xs min-h-20 w-full"
                                placeholder="ตั้งชื่อรายละเอียดกิจกรรมย่อยใหม่"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="alert-success mb-4">
                <CheckCircle size={16} className="text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">พร้อมนำเข้าข้อมูล</p>
                  <p className="text-xs mt-0.5">พบ {allRows.length} แถว · {mappings.filter((m) => m.sourceKey).length} column ที่จับคู่แล้ว</p>
                  <p className="text-xs mt-1 text-surface-500">คอลัมน์แคมป์และแปลงใช้ระบุตำแหน่งของหัวข้อกิจกรรม ถ้าไม่มีข้อมูลแปลงแต่มีแคมป์ ระบบจะสร้างหรือใช้แปลงอัตโนมัติของแคมป์นั้นแทน</p>
                </div>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {mappings.filter((m) => m.sourceKey).map((m) => {
                  const tc = targetColumns.find((c) => c.key === m.targetKey)!
                  return (
                    <div key={m.targetKey} className="flex items-center justify-between text-xs px-3 py-1.5 bg-surface-50 rounded-lg">
                      <span className="text-surface-600">{m.sourceKey}</span>
                      <ArrowRight size={12} className="text-surface-300" />
                      <span className="font-medium text-surface-800">{tc.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-3 mt-5">
                <button className="btn-secondary flex-1" onClick={() => setStep('map')} disabled={isLocked}>กลับ</button>
                <button className="btn-primary flex-1" onClick={handleValidateSubmitClick} disabled={isImportBlocked}>
                  {isSubmitting ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
                </button>
              </div>
              {unresolvedDetailTypes.length > 0 && (
                <p className="text-xs text-red-500 mt-3">กรุณาเลือกหรือกำหนดชื่อประเภทกิจกรรมย่อยให้ครบก่อนนำเข้า</p>
              )}
              {blockingRows.length > 0 && (
                <p className="text-xs text-red-500 mt-2">กรุณาแก้แถวที่ไม่มีทั้ง land และ camp ก่อน จึงจะกดนำเข้าข้อมูลได้</p>
              )}
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                {importResult?.errors?.length ? (
                  <XCircle size={28} className="text-red-600" />
                ) : (
                  <CheckCircle size={28} className="text-primary-600" />
                )}
              </div>
              <h3 className="font-semibold text-surface-900 mb-1">
                {/* {importResult?.errors?.length ? 'นำเข้าบางส่วนสำเร็จ แต่มีข้อผิดพลาด' : 'นำเข้าสำเร็จ!'} */}
                {importResult?.errors?.length ? 'มีข้อผิดพลาด' : 'นำเข้าสำเร็จ!'}
              </h3>
              <p className="text-sm text-surface-500 mb-2">
                {importResult
                  ? `นำเข้า ${importResult.inserted} แถว สำเร็จ · ข้าม ${importResult.skipped} แถว`
                  : `นำเข้าข้อมูล ${allRows.length} แถวเรียบร้อยแล้ว`}
              </p>
              {importResult?.errors?.length ? (
                <p className="text-xs text-red-600 mb-3">บางแถวถูกข้ามเพราะข้อมูลสำคัญไม่ครบหรืออ้างอิงไม่ได้ กรุณาดูรายการด้านล่างเพื่อแก้ไขไฟล์ CSV</p>
              ) : (
                <p className="text-xs text-surface-500 mb-3">ระบบบันทึกข้อมูลเสร็จแล้ว รวมทั้งแถวที่ระบุเฉพาะแคมป์ซึ่งจะถูกผูกกับแปลงอัตโนมัติของแคมป์</p>
              )}
              {importErrorSummaries.length > 0 && (
                <div className="mb-4 w-full rounded-xl border border-amber-100 bg-amber-50 p-4 text-left text-xs text-amber-800 overflow-hidden">
                  <div className="font-medium">สรุปสาเหตุแถวที่ถูก skip:</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {importErrorSummaries.map((item) => (
                      <div key={item.key} className="rounded-lg border border-amber-200 bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{item.label}</span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            {item.count} แถว
                          </span>
                        </div>
                        {item.examples.length > 0 && (
                          <div className="mt-2 space-y-1 text-[11px] text-amber-900/90">
                            {item.examples.map((example, index) => (
                              <div key={`${item.key}-${index}`} className="break-words">
                                {example}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {importResult && importResult.errors?.length > 0 && (
                <div className="w-full rounded-xl border border-red-100 bg-red-50 p-4 text-left text-xs text-red-700 overflow-hidden">
                  <div className="font-medium">รายละเอียดแถวที่ต้องตรวจสอบ:</div>
                  <ul className="list-disc pl-4 mt-2 space-y-1 overflow-auto max-h-40">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="break-words">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="btn-primary mt-4" onClick={onFinish ?? onCancel}>เสร็จสิ้น</button>
            </div>
          )}
        </div>

        {isLocked && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-white/45 backdrop-blur-md">
            <div className="mx-6 w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-7 text-center shadow-card-lg animate-slide-up">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 via-white to-primary-50 shadow-inner">
                <div className="loading-orbit">
                  <div className="loading-orbit-ring" />
                  <div className="loading-orbit-core" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-surface-900">กำลังนำเข้าข้อมูล</h3>
              <p className="mt-2 text-sm text-surface-500">
                {importProgress?.message ?? 'กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูลและผูกความสัมพันธ์ให้ครบถ้วน'}
              </p>
              {importProgress && (
                <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/80 p-4 text-left">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary-900">
                        {importProgress.totalChunks > 0
                          ? `ชุดที่ ${Math.max(importProgress.currentChunk, 1)} / ${importProgress.totalChunks}`
                          : 'กำลังคำนวณขนาดข้อมูล'}
                      </p>
                      <p className="mt-1 text-[11px] text-primary-700">
                        {formatBytes(importProgress.uploadedBytes)} / {formatBytes(importProgress.totalBytes)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-800 shadow-sm">
                      {importProgressPercent}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${importProgressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-primary-700">
                    ประมาณจาก chunk ที่ส่งเข้า API:
                    {' '}ชุดนี้ {formatBytes(importProgress.currentChunkBytes)}
                    {importProgress.chunkLimitBytes ? ` จากขนาดมาตรฐาน ${formatBytes(importProgress.chunkLimitBytes)}` : ''}
                  </p>
                </div>
              )}
              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
              <p className="mt-4 text-xs font-medium tracking-wide text-primary-700">Processing import safely...</p>
            </div>
          </div>
        )}
      </div>

      {showImportTimeConfirmation && (
        <ConfirmDialog
          open={showImportConfirm}
          title="ยืนยันการนำเข้าข้อมูล?"
          message={importConfirmationMessage}
          confirmLabel="ดำเนินการต่อ"
          cancelLabel="กลับไปตรวจสอบ"
          variant={importEstimate.variant}
          onConfirm={() => { void handleSubmit() }}
          onCancel={() => setShowImportConfirm(false)}
          isLoading={isSubmitting}
        />
      )}
    </div>
  )
}
