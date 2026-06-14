import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DataTable, Column, ExpandableTextCell } from '@/components/ui/DataTable'
import { CsvMappingWizard, TargetColumn, ColumnMapping, type CsvImportHelpers } from '@/components/ui/CsvMappingWizard'
import { DashboardVisibilityMenu, useDashboardVisibility } from '@/components/ui/DashboardVisibilityMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { getActivityCalStatusBadgeClass, getActivityCalStatusKind, getActivityCalStatusLabel } from '@/features/activities/cal-status'
import { del, get, post, put } from '@/lib/api'
import { formatBangkokDate, formatBangkokDateKey, formatBangkokDateTime, formatBangkokDateTimeLocal } from '@/lib/datetime'
import { ActivitySquare, Upload, Plus, Calculator, Leaf, Edit, Trash2, ChevronDown, ChevronUp, CheckCircle2, Clock3, CircleAlert } from 'lucide-react'

interface ActivityHeader {
  activities_header_id: number
  land_id: number
  farmer_id: number
  activities_header_idCode: string
  activities_header_startDate?: string
  activities_header_curlatitude?: number
  activities_header_curlongitude?: number
  act_header_type_id: number
  act_header_typeLand_id: number
  act_header_typeSugarCane_id: number
  activities_header_info: string
}

interface DetailHeaderLocation {
  activities_header_id: number
  activities_header_idCode?: string
  activities_header_startDate?: string
  land_id?: number
  act_header_typeLand_id?: number
  act_header_typeSugarCane_id?: number
  lands?: {
    land_code?: string
    name?: string
    land_camp_id?: number
    lands_camps?: {
      land_camp_name?: string
    }
  }
  activities_header_typeLand?: {
    act_header_typeLand_name?: string
  }
  activities_header_typeSugarCane?: {
    act_header_typeSugarCane_name?: string
  }
}

interface LogDetail {
  log_act_detail_id: number
  activities_header_id?: number
  act_header_type_id: number
  act_header_detail_type_id?: number
  act_header_detail_type_update_uid?: number
  act_equipment_id?: number
  act_fertilizer_id?: number
  act_chemiscal_id?: number
  act_resourceOther_id?: number
  resource_used_type_id: number
  unit_prefix_id?: number
  unit_id?: number
  log_act_detail_quatity: number
  log_act_detail_volumePerUnit: number
  log_act_detail_volumeAll: number
  log_act_detail_areawork: number
  log_act_detail_calStatus_id: number
  log_act_detail_create_at?: string  // can insert with a Startdate, but not update
  activities_fertilizers?: { act_fertilizer_name?: string }
  activities_equipments?: { act_equipment_name?: string }
  activities_chemiscals?: { act_chemiscal_name?: string }
  activities_resourceOther?: { act_resourceOther_name?: string }
  resource_used_type?: { resc_used_type_name?: string }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  activities_header?: DetailHeaderLocation
}
interface Land       { land_id: number; land_code: string; name: string; land_camp_id?: number; farmer_id?: number; land_size?: number }
interface LandCamp   { land_camp_id: number; land_camp_name: string }
interface Farmer     { farmer_id: number; first_name?: string; last_name?: string; thai_farmer_id?: string }
interface HeaderType { act_header_type_id: number; act_header_type_name_th: string }
interface DetailType { act_header_detail_type_id: number; act_header_detail_type_name_th: string }
interface LandType { act_header_typeLand_id: number; act_header_typeLand_name: string }
interface SugarCaneType { act_header_typeSugarCane_id: number; act_header_typeSugarCane_name: string }
interface ResourceType { resource_used_type_id: number; resc_used_type_name: string }
interface CalStatus { log_act_detail_calStatus_id: number; log_act_detail_calStatus_name: string }
interface Fertilizer { act_fertilizer_id: number; act_fertilizer_name: string }
interface Equipment  { act_equipment_id: number; act_equipment_name: string }
interface Chemical   { act_chemiscal_id: number; act_chemiscal_name: string }
interface ResourceOther { act_resourceOther_id: number; act_resourceOther_name: string }
interface Unit       { unit_id: number; unit_name?: string; unit_initial?: string }
interface UnitPrefix { unit_prefix_id: number; unit_prefix_name?: string; unit_prefix_initial?: string }
interface ActivityImportFile {
  activities_fileNameUse_id: number
  activities_fileNameUse_name?: string
  activities_fileNameUse_rowCount?: number
  activities_fileNameUse_columnCount?: number
  activities_fileNameUse_create_at?: string
  activities_fileNameUse_update_at?: string
  activities_fileNameUse_update_uid?: number
  users?: {
    user_id: number
    username?: string
    first_name?: string
    last_name?: string
  }
}
type ActivityImportPayload = { mappings: ColumnMapping[]; rows: Record<string, string>[] }
type ActivityImportResult = { inserted: number; skipped: number; errors: string[] }
type ActivityImportChunk = { rows: Record<string, string>[]; startIndex: number; sizeBytes: number }

// interface CsvMappingWizardProps {
//   title: string;
//   subtitle: string;
//   targetColumns: any[];
//   file: File | null; // <-- Accept the file prop here
//   onComplete: (mappings: any, rows: any[]) => Promise<void>;
//   onCancel: () => void;
// }

// export const CsvMappingWizard: React.FC<CsvMappingWizardProps> = ({ file, ...props }) => {
//   useEffect(() => {
//     if (file) {
//       console.log("Ready to parse dropped file:", file.name);
//       // Put your Papa.parse(file) or XLSX reading logic here
//     }
//   }, [file]);

//   // ... your wizard mapping UI code ...
// }

type DetailForm = {
  activities_header_id: string
  act_header_type_id: string
  act_header_detail_type_id: string
  act_header_detail_type_update_uid: string
  act_equipment_id: string
  act_fertilizer_id: string
  act_chemiscal_id: string
  act_resourceOther_id: string
  resource_used_type_id: string
  unit_prefix_id: string
  unit_id: string
  log_act_detail_quatity: string
  log_act_detail_volumePerUnit: string
  log_act_detail_volumeAll: string
  log_act_detail_areawork: string
}

type HeaderForm = {
  land_id: string
  farmer_id: string
  activities_header_idCode: string
  activities_header_startDate: string
  activities_header_curlatitude: string
  activities_header_curlongitude: string
  activities_header_update_uid: string
  act_header_type_id: string
  act_header_typeLand_id: string
  act_header_typeSugarCane_id: string
  activities_header_info: string
}

type HeaderFilters = {
  startDateFrom: string
  startDateTo: string
  landCampId: string
  actHeaderTypeId: string
  actHeaderTypeLandId: string
  actHeaderTypeSugarCaneId: string
}

type DetailFilters = {
  activitiesHeaderId: string
  hasActivitiesHeader: string
  campId: string
  landId: string
  actHeaderTypeId: string
  actHeaderDetailTypeId: string
  resourceUsedTypeId: string
  calStatusId: string
}

const emptyDetailForm: DetailForm = {
  activities_header_id: '',
  act_header_type_id: '',
  act_header_detail_type_id: '',
  act_header_detail_type_update_uid: '',
  act_equipment_id: '',
  act_fertilizer_id: '',
  act_chemiscal_id: '',
  act_resourceOther_id: '',
  resource_used_type_id: '',
  unit_prefix_id: '',
  unit_id: '',
  log_act_detail_quatity: '',
  log_act_detail_volumePerUnit: '',
  log_act_detail_volumeAll: '',
  log_act_detail_areawork: '',
}

const emptyHeaderForm: HeaderForm = {
  land_id: '',
  farmer_id: '',
  activities_header_idCode: '',
  activities_header_startDate: '',
  activities_header_curlatitude: '',
  activities_header_curlongitude: '',
  activities_header_update_uid: '',
  act_header_type_id: '',
  act_header_typeLand_id: '',
  act_header_typeSugarCane_id: '',
  activities_header_info: '',
}

const emptyHeaderFilters: HeaderFilters = {
  startDateFrom: '',
  startDateTo: '',
  landCampId: '',
  actHeaderTypeId: '',
  actHeaderTypeLandId: '',
  actHeaderTypeSugarCaneId: '',
}

const emptyDetailFilters: DetailFilters = {
  activitiesHeaderId: '',
  hasActivitiesHeader: '',
  campId: '',
  landId: '',
  actHeaderTypeId: '',
  actHeaderDetailTypeId: '',
  resourceUsedTypeId: '',
  calStatusId: '',
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500 mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {children}
      </div>
    </section>
  )
}

const CAMP_ONLY_LAND_LABEL = 'เบิกเข้าไร่'

function isPlaceholderLand(landCode?: string, landName?: string) {
  return landCode?.trim().toUpperCase().startsWith('AUTO-CAMP-')
    || landName?.trim().toUpperCase().startsWith('[AUTO-CAMP]')
}

function getLandDisplayLabel(landCode?: string, landName?: string) {
  if (isPlaceholderLand(landCode, landName)) return CAMP_ONLY_LAND_LABEL
  if (landCode && landName) return `${landCode} - ${landName}`
  return landCode ?? landName ?? '—'
}

function formatQuantityValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  const digits = Number.isInteger(value) ? 0 : 3
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function getImportFileUpdaterLabel(file: ActivityImportFile) {
  const firstName = file.users?.first_name?.trim()
  const lastName = file.users?.last_name?.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fullName || file.users?.username?.trim() || (file.activities_fileNameUse_update_uid != null ? `#${file.activities_fileNameUse_update_uid}` : '—')
}

// Columns matching actual xlsx (inactive): กิจกรรม | ไร่(camp) | แปลง | รายการปัจจัย | ปริมาณ | math | ปริมาณใช้ | ไร่(area) | รวมเป็นเงิน | ประเภทปัจจัย | หน่วยนับ Farmpro | ประเภทใหม่
// columns matching actual CSV (active): วันที่ปฏิบัติ · หมวดหมู่กิจกรรมหลัก · รายละเอียดกิจกรรมย่อย · ไร่(camps) · แปลง(lands) · พื้นที่ตามแปลง · 
                                      // ประเภทแปลง · ประเภทอ้อย · รายการปัจจัยการผลิต(listEM - ปุ๋ย 23-12-12 Control Release) · ประเภทปัจจัย(UsageType - ปุ๋ย) · ปริมาณรวม · 
                                      // จำนวณ · ปริมาณต่อ1จำนวณ · ประเภทปัจจัย · หน่วยนับ · พื้นที่ปฏิบัติรวม            16 colume

// const ACTIVITY_TARGET_COLUMNS: TargetColumn[] = [  // old 05272026    --------------------------------------------------
//   { key: 'act_header_type',         label: 'กิจกรรม (activity type)',     required: true,  type: 'fk', fkTable: 'activities_header_type' },
//   { key: 'land_camp_name',          label: 'ไร่ / แคมป์',                 required: true,  type: 'fk', fkTable: 'lands_camps' },
//   { key: 'land_code',               label: 'แปลง (land code)',            required: true,  type: 'fk', fkTable: 'lands' },
//   { key: 'resource_item_name',      label: 'รายการปัจจัยการผลิต',         required: true,  type: 'fk', fkTable: 'activities_fertilizers / equipments' },
//   { key: 'log_act_detail_quatity',  label: 'ปริมาณ (จำนวน)',             required: false, type: 'number' },
//   { key: 'log_act_detail_volumePerUnit', label: 'ปริมาณ/หน่วย',          required: false, type: 'number' },
//   { key: 'log_act_detail_volumeAll',label: 'ปริมาณใช้รวม',               required: true,  type: 'number' },
//   { key: 'log_act_detail_areawork', label: 'พื้นที่ทำงาน (ไร่)',          required: false, type: 'number' },
//   { key: 'resource_used_type',      label: 'ประเภทปัจจัย',               required: true,  type: 'fk', fkTable: 'resource_used_type' },
//   { key: 'unit_name',               label: 'หน่วยนับ (Farmpro)',         required: false, type: 'fk', fkTable: 'units' },
//   { key: 'sugarcane_type',          label: 'ประเภทอ้อย (typeSugarCane)',  required: false, type: 'fk', fkTable: 'activities_header_typeSugarCane' },
// ]


// columns matching actual CSV (active): 
          // วันที่ปฏิบัติ · หมวดหมู่กิจกรรมหลัก · รายละเอียดกิจกรรมย่อย · ไร่(camps) · แปลง(lands) · พื้นที่ตามแปลง · 
          // ประเภทแปลง · ประเภทอ้อย · รายการปัจจัยการผลิต(listEM - ปุ๋ย 23-12-12 Control Release) · ประเภทปัจจัย(UsageType - ปุ๋ย) · 
          // ปริมาณรวม · จำนวน · ปริมาณต่อ1จำนวน · หน่วยนับ · พื้นที่ปฏิบัติรวม            15 colume
const ACTIVITY_TARGET_COLUMNS: TargetColumn[] = [  // new 05272026  --------------------------------------------------
  { key: 'log_act_detail_create_at',      label: 'วันที่ปฏิบัติ',           required: true, type: 'date' },
  { key: 'act_header_type',               label: 'หมวดหมู่กิจกรรมหลัก',   required: false, type: 'fk', fkTable: 'activities_header_type' },
  { key: 'act_header_detail_type',        label: 'รายละเอียดกิจกรรมย่อย', required: false, type: 'fk', fkTable: 'activities_detail_type' },
  { key: 'land_camp_name',                label: 'ไร่ / แคมป์',         required: false, type: 'fk', fkTable: 'lands_camps' },
  { key: 'land_code',                     label: 'แปลง',                required: false, type: 'fk', fkTable: 'lands' },
  { key: 'land_size',                     label: 'พื้นที่ตามแปลง',     required: false, type: 'number' },
  { key: 'log_act_detail_areawork',       label: 'พื้นที่ปฏิบัติรวม',        required: false, type: 'number' },

  { key: 'act_header_typeLand_id',        label: 'ประเภทแปลง',        required: false, type: 'fk', fkTable: 'activities_land_type' },
  { key: 'act_header_typeSugarCane_id',   label: 'ประเภทอ้อย',         required: false, type: 'fk', fkTable: 'activities_header_typeSugarCane' },
  { key: 'resource_item_name',            label: 'รายการปัจจัยการผลิต',  required: true, type: 'fk', fkTable: 'activities_fertilizers / equipments / resourceOther' },
  { key: 'resource_used_type',            label: 'ประเภทปัจจัย',        required: true, type: 'fk', fkTable: 'resource_used_type' },
  { key: 'log_act_detail_volumeAll',      label: 'ปริมาณรวม',          required: false, type: 'number' },
  { key: 'log_act_detail_quatity',        label: 'จำนวน',             required: false, type: 'number' },
  { key: 'log_act_detail_volumePerUnit',  label: 'ปริมาณต่อ1จำนวน',    required: false, type: 'number' },
  { key: 'unit_name',                     label: 'หน่วยนับ',            required: true, type: 'fk', fkTable: 'units' },
]

const ACTIVITY_IMPORT_CHUNK_LIMIT_BYTES = 20 * 1024      
// KB -> Bytes, set to 20KB to be safe since JSON string can be ~2x larger than original CSV string, 
// and we want to avoid hitting server limits (25KB for nginx default) or causing OOM on client side 
// when processing large files. Adjust as needed based on testing with typical payload sizes.

// for reference, here are some rough size estimates based on testing with sample data:
function getJsonPayloadSizeBytes(payload: ActivityImportPayload) {
  return new Blob([JSON.stringify(payload)]).size 
  // return  size in bytes of the JSON stringified payload, 
  // which is what we actually send to the server. This accounts for any overhead from JSON formatting.
}

// for each row, we need to adjust the error row numbers returned from the server by adding the startIndex of the chunk,
//  since the server only sees the chunk and not the full file. This way we can show accurate error messages to the user that correspond to 
// the original CSV file.
function createActivityImportChunks(mappings: ColumnMapping[], rows: Record<string, string>[]) {
  const chunks: ActivityImportChunk[] = []
  let currentRows: Record<string, string>[] = []
  let currentStartIndex = 0

  rows.forEach((row, rowIndex) => {
    const candidateRows = [...currentRows, row]
    const candidateSize = getJsonPayloadSizeBytes({ mappings, rows: candidateRows })

    if (currentRows.length > 0 && candidateSize > ACTIVITY_IMPORT_CHUNK_LIMIT_BYTES) {
      chunks.push({
        rows: currentRows,
        startIndex: currentStartIndex,
        sizeBytes: getJsonPayloadSizeBytes({ mappings, rows: currentRows }),
      })
      currentRows = [row]
      currentStartIndex = rowIndex
      return
    }

    currentRows = candidateRows
  })

  if (currentRows.length > 0) {
    chunks.push({
      rows: currentRows,
      startIndex: currentStartIndex,
      sizeBytes: getJsonPayloadSizeBytes({ mappings, rows: currentRows }),
    })
  }

  return chunks
}

function adjustImportErrorRowNumbers(error: string, startIndex: number) {
  return error.replace(/^Row (\d+):/i, (_match, rowNumber: string) => {
    const parsed = Number.parseInt(rowNumber, 10)
    return Number.isFinite(parsed) ? `Row ${startIndex + parsed}:` : `Row ${rowNumber}:`
  })
}

export function ActivitiesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showWizard, setShowWizard]     = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [showHeaderForm, setShowHeaderForm] = useState(false)
  const [showHeaderSection, setShowHeaderSection] = useState(false)
  const [editingHeader, setEditingHeader] = useState<ActivityHeader | null>(null)
  const [deleteHeaderTarget, setDeleteHeaderTarget] = useState<ActivityHeader | null>(null)
  const [editingDetail, setEditingDetail] = useState<LogDetail | null>(null)
  const [deleteDetailTarget, setDeleteDetailTarget] = useState<LogDetail | null>(null)
  const [formPanelOpen, setFormPanelOpen] = useState(false)
  const [selectedHeader, setSelectedHeader] = useState<ActivityHeader | null>(null)
  const [trackMethod, setTrackMethod]   = useState<'direct' | 'cascade'>('cascade')
  const [selectedCampId, setSelectedCampId] = useState<number | null>(null)
  const [selectedLandId, setSelectedLandId] = useState<number | null>(null)
  const [selectedHeaderCampId, setSelectedHeaderCampId] = useState<number | null>(null)
  const [detailForm, setDetailForm] = useState<DetailForm>(emptyDetailForm)
  const [headerForm, setHeaderForm] = useState<HeaderForm>(emptyHeaderForm)
  const [headerFilters, setHeaderFilters] = useState<HeaderFilters>(emptyHeaderFilters)
  const [detailFilters, setDetailFilters] = useState<DetailFilters>(emptyDetailFilters)

  const { data: headers  = [], isLoading: hLoad, error: headersError }  = useQuery({ queryKey: ['activity-headers'],  queryFn: () => get<ActivityHeader[]>('/activities/headers') })
  const { data: details  = [], isLoading: dLoad, error: detailsError }  = useQuery({ queryKey: ['activity-details'],  queryFn: () => get<LogDetail[]>('/activities/details') })
  const { data: lands    = [], error: landsError }                      = useQuery({ queryKey: ['lands'],              queryFn: () => get<Land[]>('/lands') })
  const { data: camps    = [], error: campsError }                      = useQuery({ queryKey: ['camps'],              queryFn: () => get<LandCamp[]>('/lands/camps') })
  const { data: farmers  = [], error: farmersError }                    = useQuery({ queryKey: ['farmers'],            queryFn: () => get<Farmer[]>('/farmers') })
  const { data: hdrTypes = [], error: hdrTypesError }                   = useQuery({ queryKey: ['header-types'],       queryFn: () => get<HeaderType[]>('/activities/header-types') })
  const { data: allDetailTypes = [], error: allDetailTypesError }       = useQuery({ queryKey: ['detail-types-all'],   queryFn: () => get<DetailType[]>('/activities/detail-types') })
  const { data: detailTypes = [], error: detailTypesError }             = useQuery({ queryKey: ['detail-types', detailForm.act_header_type_id], queryFn: () => get<DetailType[]>('/activities/detail-types', detailForm.act_header_type_id ? { header_type_id: Number(detailForm.act_header_type_id) } : undefined) })
  const { data: landTypes = [], error: landTypesError }                 = useQuery({ queryKey: ['activity-land-types'], queryFn: () => get<LandType[]>('/activities/land-types') })
  const { data: sugarCaneTypes = [], error: sugarCaneTypesError }       = useQuery({ queryKey: ['sugarcane-types'],    queryFn: () => get<SugarCaneType[]>('/activities/sugarcane-types') })
  const { data: resTypes = [], error: resTypesError }                   = useQuery({ queryKey: ['resource-types'],     queryFn: () => get<ResourceType[]>('/activities/resource-types') })
  const { data: calStatuses = [], error: calStatusesError }             = useQuery({ queryKey: ['cal-statuses'],       queryFn: () => get<CalStatus[]>('/activities/cal-statuses') })
  const { data: fertilizers = [], error: fertilizersError }             = useQuery({ queryKey: ['fertilizers'],        queryFn: () => get<Fertilizer[]>('/activities/fertilizers') })
  const { data: equipments = [], error: equipmentsError }               = useQuery({ queryKey: ['equipments'],         queryFn: () => get<Equipment[]>('/activities/equipments') })
  const { data: chemicals = [], error: chemicalsError }                 = useQuery({ queryKey: ['chemicals'],          queryFn: () => get<Chemical[]>('/activities/chemicals') })
  const { data: resourceOthers = [], error: resourceOthersError }       = useQuery({ queryKey: ['resource-others'],    queryFn: () => get<ResourceOther[]>('/activities/resource-others') })
  const { data: importFiles = [], isLoading: importFilesLoading, error: importFilesError } = useQuery({ queryKey: ['activity-import-files'], queryFn: () => get<ActivityImportFile[]>('/activities/import-files') })
  const { data: units = [], error: unitsError }                         = useQuery({ queryKey: ['units'],              queryFn: () => get<Unit[]>('/emission-factors/units') })
  const { data: unitPrefixes = [], error: unitPrefixesError }           = useQuery({ queryKey: ['unit-prefixs'],       queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs') })

  const activityQueryItems = [
    { label: 'หัวข้อกิจกรรม', error: headersError },
    { label: 'รายการบันทึกกิจกรรม', error: detailsError },
    { label: 'ข้อมูลแปลง', error: landsError },
    { label: 'ข้อมูลแคมป์', error: campsError },
    { label: 'ข้อมูลเกษตรกร', error: farmersError },
    { label: 'ประเภทกิจกรรม', error: hdrTypesError },
    { label: 'รายละเอียดกิจกรรม', error: allDetailTypesError ?? detailTypesError },
    { label: 'ประเภทแปลง', error: landTypesError },
    { label: 'ประเภทอ้อย', error: sugarCaneTypesError },
    { label: 'ประเภทปัจจัย', error: resTypesError },
    { label: 'สถานะการคำนวณ', error: calStatusesError },
    { label: 'ปุ๋ย', error: fertilizersError },
    { label: 'อุปกรณ์', error: equipmentsError },
    { label: 'สารเคมี', error: chemicalsError },
    { label: 'รายการอื่น ๆ', error: resourceOthersError },
    { label: 'ประวัติไฟล์นำเข้า', error: importFilesError },
    { label: 'หน่วยนับ', error: unitsError },
    { label: 'คำนำหน้าหน่วย', error: unitPrefixesError },
  ]

  async function importActivityCsvInChunks(
    mappings: ColumnMapping[],
    rows: Record<string, string>[],
    helpers?: CsvImportHelpers,
  ) {
    const chunks = createActivityImportChunks(mappings, rows)
    const result: ActivityImportResult = { inserted: 0, skipped: 0, errors: [] }
    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0)
    let uploadedBytes = 0

    const reportProgress = (
      currentChunk: number,
      currentChunkBytes: number,
      message: string,
      includeCurrentChunk = false,
    ) => {
      const progressBytes = includeCurrentChunk
        ? Math.min(totalBytes, uploadedBytes + currentChunkBytes)
        : uploadedBytes

      helpers?.onProgress?.({
        currentChunk,
        totalChunks: chunks.length,
        uploadedBytes: progressBytes,
        totalBytes,
        currentChunkBytes,
        chunkLimitBytes: ACTIVITY_IMPORT_CHUNK_LIMIT_BYTES,
        percent: totalBytes > 0 ? (progressBytes / totalBytes) * 100 : 0,
        message,
      })
    }

    reportProgress(0, chunks[0]?.sizeBytes ?? 0, 'กำลังเตรียมชุดข้อมูลนำเข้า')

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index]
      reportProgress(
        index + 1,
        chunk.sizeBytes,
        `กำลังนำเข้าชุดที่ ${index + 1}/${chunks.length}`,
        true,
      )

      try {
        const chunkResult = await post<ActivityImportResult>(
          '/activities/import',
          { mappings, rows: chunk.rows },
          { timeout: 20 * 60_000 },
        )

        result.inserted += chunkResult.inserted ?? 0
        result.skipped += chunkResult.skipped ?? 0
        result.errors.push(
          ...(chunkResult.errors ?? []).map((error) => adjustImportErrorRowNumbers(error, chunk.startIndex)),
        )
        uploadedBytes += chunk.sizeBytes
        reportProgress(
          index + 1,
          chunk.sizeBytes,
          `นำเข้าชุดที่ ${index + 1}/${chunks.length} แล้ว`,
        )
      } catch (error: any) {
        throw new Error(
          `นำเข้าชุดที่ ${index + 1}/${chunks.length} ไม่สำเร็จ (${Math.ceil(chunk.sizeBytes / 1024)} KB): ${error?.message ?? 'Internal server error'}`,
        )
      }
    }

    if (helpers?.fileName) {
      try {
        await post('/activities/import-files', {
          activities_fileNameUse_name: helpers.fileName,
          activities_fileNameUse_rowCount: helpers.rowCount ?? rows.length,
          activities_fileNameUse_columnCount: helpers.columnCount,
        })
      } catch (error: any) {
        result.errors.push(`บันทึกประวัติไฟล์ไม่สำเร็จ: ${error?.message ?? 'Unknown error'}`)
      }
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ['activity-headers'] }),
      qc.invalidateQueries({ queryKey: ['activity-details'] }),
      qc.invalidateQueries({ queryKey: ['activity-import-files'] }),
    ])

    helpers?.onProgress?.({
      currentChunk: chunks.length,
      totalChunks: chunks.length,
      uploadedBytes: totalBytes,
      totalBytes,
      currentChunkBytes: 0,
      chunkLimitBytes: ACTIVITY_IMPORT_CHUNK_LIMIT_BYTES,
      percent: 100,
      message: 'นำเข้าข้อมูลครบทุกชุดแล้ว',
    })

    return result
  }

  const createDetailMut = useMutation({
    mutationFn: (payload: Record<string, number | string | undefined>) =>
      editingDetail
        ? put(`/activities/details/${editingDetail.log_act_detail_id}`, payload)
        : post('/activities/details', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-details'] })
      qc.invalidateQueries({ queryKey: ['activity-headers'] })
      setShowForm(false)
      setDetailForm(emptyDetailForm)
      setEditingDetail(null)
    },
  })

  const deleteDetailMut = useMutation({
    mutationFn: (id: number) => del(`/activities/details/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-details'] })
      qc.invalidateQueries({ queryKey: ['activity-headers'] })
      setDeleteDetailTarget(null)
    },
  })

  const createHeaderMut = useMutation({
    mutationFn: (payload: Record<string, number | string | undefined>) =>
      editingHeader
        ? put<ActivityHeader>(`/activities/headers/${editingHeader.activities_header_id}`, payload)
        : post<ActivityHeader>('/activities/headers', payload),
    onSuccess: (header) => {
      qc.invalidateQueries({ queryKey: ['activity-headers'] })
      setHeaderForm(emptyHeaderForm)
      setShowHeaderForm(false)
      setEditingHeader(null)
      setSelectedHeader(header)
    },
  })

  const deleteHeaderMut = useMutation({
    mutationFn: (id: number) => del(`/activities/headers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-headers'] })
      qc.invalidateQueries({ queryKey: ['activity-details'] })
      if (selectedHeader?.activities_header_id === deleteHeaderTarget?.activities_header_id) {
        setSelectedHeader(null)
        setFormPanelOpen(false)
      }
      setDeleteHeaderTarget(null)
    },
  })

  const landMap    = Object.fromEntries(lands.map(l => [l.land_id, l.land_code]))
  const campMap    = Object.fromEntries(camps.map(c => [c.land_camp_id, c.land_camp_name]))
  const hdrTypeMap = Object.fromEntries(hdrTypes.map(t => [t.act_header_type_id, t.act_header_type_name_th]))
  const hdrMap = Object.fromEntries(headers.map(h => [h.activities_header_id, h.activities_header_idCode]))

  const farmerMap = Object.fromEntries(farmers.map(f => [f.farmer_id, `${f.first_name ?? ''} ${f.last_name ?? ''} (${f.thai_farmer_id ?? '—'})`]))
  const typeLandMap = Object.fromEntries(landTypes.map(t => [t.act_header_typeLand_id, t.act_header_typeLand_name]))
  const typeSugarCaneMap = Object.fromEntries(sugarCaneTypes.map(t => [t.act_header_typeSugarCane_id, t.act_header_typeSugarCane_name]))
  const detailTypeMap = Object.fromEntries(allDetailTypes.map(t => [t.act_header_detail_type_id, t.act_header_detail_type_name_th]))
  const resourceTypeMap = Object.fromEntries(resTypes.map(t => [t.resource_used_type_id, t.resc_used_type_name]))
  const fertilizerMap = Object.fromEntries(fertilizers.map(f => [f.act_fertilizer_id, f.act_fertilizer_name]))
  const equipmentMap = Object.fromEntries(equipments.map(e => [e.act_equipment_id, e.act_equipment_name]))
  const chemicalMap = Object.fromEntries(chemicals.map(c => [c.act_chemiscal_id, c.act_chemiscal_name]))
  const resourceOtherMap = Object.fromEntries(resourceOthers.map(r => [r.act_resourceOther_id, r.act_resourceOther_name]))
  const unitMap = Object.fromEntries(units.map(u => [u.unit_id, u.unit_name ?? u.unit_initial ?? `#${u.unit_id}`]))
  const unitPrefixMap = Object.fromEntries(unitPrefixes.map(p => [p.unit_prefix_id, p.unit_prefix_name ?? p.unit_prefix_initial ?? `#${p.unit_prefix_id}`]))

  const formatDateForFilter = (value?: string) => formatBangkokDateKey(value)

  const getDetailCampId = (detail: LogDetail) => detail.activities_header?.lands?.land_camp_id
  const getDetailCampName = (detail: LogDetail) =>
    detail.activities_header?.lands?.lands_camps?.land_camp_name
    ?? (getDetailCampId(detail) != null ? campMap[getDetailCampId(detail) ?? 0] : undefined)

  const getDetailLandId = (detail: LogDetail) => detail.activities_header?.land_id
  const getLandLabelById = (landId?: number) => {
    if (landId == null) return '—'
    const land = lands.find((item) => item.land_id === landId)
    if (land) return getLandDisplayLabel(land.land_code, land.name)
    return landMap[landId] ?? `#${landId}`
  }
  const getDetailLandLabel = (detail: LogDetail) => {
    const landCode = detail.activities_header?.lands?.land_code
      ?? (getDetailLandId(detail) != null ? landMap[getDetailLandId(detail) ?? 0] : undefined)
    const landName = detail.activities_header?.lands?.name
    return getLandDisplayLabel(landCode, landName)
  }
  const getDetailLandSize = (detail: LogDetail) => {
    const landId = getDetailLandId(detail)
    if (landId == null) return undefined
    return lands.find((land) => land.land_id === landId)?.land_size
  }

  const getResourceItemName = (detail: LogDetail) =>
    detail.activities_fertilizers?.act_fertilizer_name
    ?? detail.activities_equipments?.act_equipment_name
    ?? detail.activities_chemiscals?.act_chemiscal_name
    ?? detail.activities_resourceOther?.act_resourceOther_name
    ?? fertilizerMap[detail.act_fertilizer_id ?? 0]
    ?? equipmentMap[detail.act_equipment_id ?? 0]
    ?? chemicalMap[detail.act_chemiscal_id ?? 0]
    ?? resourceOtherMap[detail.act_resourceOther_id ?? 0]
    ?? '—'

  const getHeaderCampId = (header: ActivityHeader) =>
    lands.find((land) => land.land_id === header.land_id)?.land_camp_id

  const getHeaderCampName = (header: ActivityHeader) => {
    const campId = getHeaderCampId(header)
    return campId != null ? campMap[campId] ?? `#${campId}` : '—'
  }

  const filteredHeaders = headers.filter(header => {
    const headerDate = formatDateForFilter(header.activities_header_startDate)
    const startDateFromMatches = !headerFilters.startDateFrom || Boolean(headerDate && headerDate >= headerFilters.startDateFrom)
    const startDateToMatches = !headerFilters.startDateTo || Boolean(headerDate && headerDate <= headerFilters.startDateTo)
    const campId = getHeaderCampId(header)

    return startDateFromMatches
      && startDateToMatches
      && (!headerFilters.landCampId || campId === Number(headerFilters.landCampId))
      && (!headerFilters.actHeaderTypeId || header.act_header_type_id === Number(headerFilters.actHeaderTypeId))
      && (!headerFilters.actHeaderTypeLandId || header.act_header_typeLand_id === Number(headerFilters.actHeaderTypeLandId))
      && (!headerFilters.actHeaderTypeSugarCaneId || header.act_header_typeSugarCane_id === Number(headerFilters.actHeaderTypeSugarCaneId))
  })

  const filteredDetails = details.filter(detail =>
    (!detailFilters.activitiesHeaderId || detail.activities_header_id === Number(detailFilters.activitiesHeaderId))
    && (!detailFilters.hasActivitiesHeader || (
      detailFilters.hasActivitiesHeader === 'with'
        ? detail.activities_header_id != null
        : detail.activities_header_id == null
    ))
    && (!detailFilters.campId || getDetailCampId(detail) === Number(detailFilters.campId))
    && (!detailFilters.landId || getDetailLandId(detail) === Number(detailFilters.landId))
    && (!detailFilters.actHeaderTypeId || detail.act_header_type_id === Number(detailFilters.actHeaderTypeId))
    && (!detailFilters.actHeaderDetailTypeId || detail.act_header_detail_type_id === Number(detailFilters.actHeaderDetailTypeId))
    && (!detailFilters.resourceUsedTypeId || detail.resource_used_type_id === Number(detailFilters.resourceUsedTypeId))
    && (!detailFilters.calStatusId || detail.log_act_detail_calStatus_id === Number(detailFilters.calStatusId))
  )

  const visibleLands = selectedCampId ? lands.filter(l => l.land_camp_id === selectedCampId) : lands  // If camp selected, only show lands in that camp. Otherwise show all lands.
  const visibleDetailFilterLands = detailFilters.campId
    ? lands.filter((land) => land.land_camp_id === Number(detailFilters.campId))
    : lands
  const visibleHeaderLands = selectedHeaderCampId ? lands.filter(l => l.land_camp_id === selectedHeaderCampId) : lands
  const visibleHeaders = selectedLandId ? headers.filter(h => h.land_id === selectedLandId) : headers

  const setFormValue = (key: keyof DetailForm, value: string) => {
    setDetailForm(prev => ({ ...prev, [key]: value }))
  }

  const setHeaderFormValue = (key: keyof HeaderForm, value: string) => {
    setHeaderForm(prev => ({ ...prev, [key]: value }))
  }

  const setHeaderFilterValue = (key: keyof HeaderFilters, value: string) => {
    setHeaderFilters(prev => ({ ...prev, [key]: value }))
  }

  const setDetailFilterValue = (key: keyof DetailFilters, value: string) => {
    setDetailFilters((prev) => {
      if (key === 'campId') {
        return {
          ...prev,
          campId: value,
          landId: '',
        }
      }

      return { ...prev, [key]: value }
    })
  }

  const setLandFilter = (landId: number | null) => {
    setSelectedLandId(landId)
    setFormValue('activities_header_id', '')
  }

  const openHeaderForm = () => {
    setHeaderForm(emptyHeaderForm)
    setSelectedHeaderCampId(null)
    setEditingHeader(null)
    setShowHeaderForm(true)
  }

  const closeHeaderForm = () => {
    setShowHeaderForm(false)
    setEditingHeader(null)
    setHeaderForm(emptyHeaderForm)
  }

  const openEditHeaderForm = (header: ActivityHeader) => {
    const land = lands.find(l => l.land_id === header.land_id)
    setEditingHeader(header)
    setSelectedHeaderCampId(land?.land_camp_id ?? null)
    setHeaderForm({
      land_id: header.land_id ? String(header.land_id) : '',
      farmer_id: header.farmer_id ? String(header.farmer_id) : '',
      activities_header_idCode: header.activities_header_idCode ?? '',
      activities_header_startDate: formatBangkokDateTimeLocal(header.activities_header_startDate),
      activities_header_curlatitude: header.activities_header_curlatitude != null ? String(header.activities_header_curlatitude) : '',
      activities_header_curlongitude: header.activities_header_curlongitude != null ? String(header.activities_header_curlongitude) : '',
      activities_header_update_uid: '',
      act_header_type_id: header.act_header_type_id ? String(header.act_header_type_id) : '',
      act_header_typeLand_id: header.act_header_typeLand_id ? String(header.act_header_typeLand_id) : '',
      act_header_typeSugarCane_id: header.act_header_typeSugarCane_id ? String(header.act_header_typeSugarCane_id) : '',
      activities_header_info: header.activities_header_info ?? '',
    })
    setShowHeaderForm(true)
  }

  const openDetailForm = (header?: ActivityHeader) => {
    setEditingDetail(null)
    setDetailForm({
      ...emptyDetailForm,
      activities_header_id: header ? String(header.activities_header_id) : '',
      act_header_type_id: header?.act_header_type_id ? String(header.act_header_type_id) : '',
    })
    setSelectedLandId(header?.land_id ?? null)
    setSelectedHeader(header ?? null)
    setShowForm(true)
  }

  const openEditDetailForm = (detail: LogDetail) => {
    const header = headers.find(h => h.activities_header_id === detail.activities_header_id)
    setEditingDetail(detail)
    setSelectedLandId(header?.land_id ?? null)
    setSelectedHeader(header ?? null)
    setDetailForm({
      activities_header_id: detail.activities_header_id ? String(detail.activities_header_id) : '',
      act_header_type_id: detail.act_header_type_id ? String(detail.act_header_type_id) : '',
      act_header_detail_type_id: detail.act_header_detail_type_id ? String(detail.act_header_detail_type_id) : '',
      act_header_detail_type_update_uid: detail.act_header_detail_type_update_uid ? String(detail.act_header_detail_type_update_uid) : '',
      act_equipment_id: detail.act_equipment_id ? String(detail.act_equipment_id) : '',
      act_fertilizer_id: detail.act_fertilizer_id ? String(detail.act_fertilizer_id) : '',
      act_chemiscal_id: detail.act_chemiscal_id ? String(detail.act_chemiscal_id) : '',
      act_resourceOther_id: detail.act_resourceOther_id ? String(detail.act_resourceOther_id) : '',
      resource_used_type_id: detail.resource_used_type_id ? String(detail.resource_used_type_id) : '',
      unit_prefix_id: detail.unit_prefix_id ? String(detail.unit_prefix_id) : '',
      unit_id: detail.unit_id ? String(detail.unit_id) : '',
      log_act_detail_quatity: detail.log_act_detail_quatity != null ? String(detail.log_act_detail_quatity) : '',
      log_act_detail_volumePerUnit: detail.log_act_detail_volumePerUnit != null ? String(detail.log_act_detail_volumePerUnit) : '',
      log_act_detail_volumeAll: detail.log_act_detail_volumeAll != null ? String(detail.log_act_detail_volumeAll) : '',
      log_act_detail_areawork: detail.log_act_detail_areawork != null ? String(detail.log_act_detail_areawork) : '',
    })
    setShowForm(true)
  }

  const closeDetailForm = () => {
    setShowForm(false)
    setEditingDetail(null)
    setDetailForm(emptyDetailForm)
  }

  const goToAddLogPage = (header: ActivityHeader) => {
    navigate(`/activities/manage?header_id=${header.activities_header_id}`)
  }

  const showSelectedHeaderPanel = Boolean(formPanelOpen && selectedHeader)
  const selectedHeaderLand = selectedHeader ? lands.find(l => l.land_id === selectedHeader.land_id) : undefined
  const selectedHeaderLandLabel = selectedHeaderLand
    ? getLandDisplayLabel(selectedHeaderLand.land_code, selectedHeaderLand.name)
    : '—'
  const selectedHeaderCampName = selectedHeaderLand?.land_camp_id != null
    ? campMap[selectedHeaderLand.land_camp_id]
    : undefined
  const selectedHeaderDetails = selectedHeader
    ? details.filter((detail) => detail.activities_header_id === selectedHeader.activities_header_id)
    : []

  const toNumberOrUndefined = (value: string) => value === '' ? undefined : Number(value)
  const toTextOrUndefined = (value: string) => value.trim() === '' ? undefined : value.trim()

  const submitDetailForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    createDetailMut.mutate({
      activities_header_id: toNumberOrUndefined(detailForm.activities_header_id),
      act_header_type_id: toNumberOrUndefined(detailForm.act_header_type_id),
      act_header_detail_type_id: toNumberOrUndefined(detailForm.act_header_detail_type_id),
      act_header_detail_type_update_uid: toNumberOrUndefined(detailForm.act_header_detail_type_update_uid),
      act_equipment_id: toNumberOrUndefined(detailForm.act_equipment_id),
      act_fertilizer_id: toNumberOrUndefined(detailForm.act_fertilizer_id),
      act_chemiscal_id: toNumberOrUndefined(detailForm.act_chemiscal_id),
      act_resourceOther_id: toNumberOrUndefined(detailForm.act_resourceOther_id),
      resource_used_type_id: toNumberOrUndefined(detailForm.resource_used_type_id),
      unit_prefix_id: toNumberOrUndefined(detailForm.unit_prefix_id),
      unit_id: toNumberOrUndefined(detailForm.unit_id),
      log_act_detail_quatity: toNumberOrUndefined(detailForm.log_act_detail_quatity),
      log_act_detail_volumePerUnit: toNumberOrUndefined(detailForm.log_act_detail_volumePerUnit),
      log_act_detail_volumeAll: toNumberOrUndefined(detailForm.log_act_detail_volumeAll),
      log_act_detail_areawork: toNumberOrUndefined(detailForm.log_act_detail_areawork),
    })
  }

  const submitHeaderForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    createHeaderMut.mutate({
      land_id: toNumberOrUndefined(headerForm.land_id),
      farmer_id: toNumberOrUndefined(headerForm.farmer_id),
      activities_header_idCode: toTextOrUndefined(headerForm.activities_header_idCode),
      activities_header_startDate: headerForm.activities_header_startDate
        ? new Date(headerForm.activities_header_startDate).toISOString()
        : undefined,
      activities_header_curlatitude: toNumberOrUndefined(headerForm.activities_header_curlatitude),
      activities_header_curlongitude: toNumberOrUndefined(headerForm.activities_header_curlongitude),
      activities_header_update_uid: toNumberOrUndefined(headerForm.activities_header_update_uid),
      act_header_type_id: toNumberOrUndefined(headerForm.act_header_type_id),
      act_header_typeLand_id: toNumberOrUndefined(headerForm.act_header_typeLand_id),
      act_header_typeSugarCane_id: toNumberOrUndefined(headerForm.act_header_typeSugarCane_id),
      activities_header_info: toTextOrUndefined(headerForm.activities_header_info),
    })
  }

  useEffect(() => {
    const headerId = searchParams.get('header_id')
    if (!headerId || !headers.length || showForm) return
    const header = headers.find(h => h.activities_header_id === Number(headerId))
    if (!header) return
    openDetailForm(header)
    navigate('/activities/manage', { replace: true })
  }, [headers, navigate, searchParams, showForm])

  useEffect(() => {
    if (!detailFilters.landId) return

    const selectedLand = lands.find((land) => land.land_id === Number(detailFilters.landId))
    const selectedCamp = detailFilters.campId ? Number(detailFilters.campId) : null

    if (selectedCamp != null && selectedLand?.land_camp_id !== selectedCamp) {
      setDetailFilters((prev) => ({ ...prev, landId: '' }))
    }
  }, [detailFilters.campId, detailFilters.landId, lands])

  const getRawCalStatusLabel = (detail: LogDetail) =>
    detail.log_act_detail_calStatus?.log_act_detail_calStatus_name?.trim()
    ?? calStatuses.find((status) => status.log_act_detail_calStatus_id === detail.log_act_detail_calStatus_id)?.log_act_detail_calStatus_name?.trim()
    ?? ''

  const getCalStatusLabel = (detail: LogDetail) =>
    getActivityCalStatusLabel(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id)

  const renderCalStatusBadge = (detail: LogDetail) => {
    const label = getCalStatusLabel(detail)
    return <span className={getActivityCalStatusBadgeClass(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id)}>{label}</span>
  }

  const headerCols: Column<ActivityHeader>[] = [
    { key: 'activities_header_id', header: 'ID', width: '60px', sortable: true },
    { key: 'activities_header_idCode', header: 'รหัสกิจกรรม', sortable: true },
    { key: 'land_camp_id', header: 'แคมป์', sortable: true, sortValue: (row) => getHeaderCampName(row), render: (r) => <span className="badge-blue">{getHeaderCampName(r)}</span> },
    { key: 'land_id', header: 'รหัสแปลง', sortable: true, sortValue: (row) => getLandLabelById(row.land_id), render: (r) => <span className="badge-green">{getLandLabelById(r.land_id)}</span> },
    { key: 'farmer_id', header: 'รหัสเกษตรกร', sortable: true, sortValue: (row) => farmerMap[row.farmer_id] ?? row.farmer_id, render: (r) => <span className="badge-blue">{farmerMap[r.farmer_id] ?? r.farmer_id}</span> },
    { key: 'activities_header_startDate', header: 'วันที่กิจกรรม', sortable: true, render: (r) => formatBangkokDateTime(r.activities_header_startDate) },
    { key: 'activities_header_curlatitude', header: 'ละติจูด', sortable: true },
    { key: 'activities_header_curlongitude', header: 'ลองจิจูด', sortable: true },
    { key: 'act_header_type_id', header: 'ประเภทกิจกรรม', sortable: true, sortValue: (row) => hdrTypeMap[row.act_header_type_id] ?? row.act_header_type_id, render: (r) => hdrTypeMap[r.act_header_type_id] ?? '—' },
    { key: 'act_header_typeLand_id', header: 'ประเภทแปลง', sortable: true, sortValue: (row) => typeLandMap[row.act_header_typeLand_id] ?? row.act_header_typeLand_id, render: (r) => <span className="badge-purple">{typeLandMap[r.act_header_typeLand_id] ?? r.act_header_typeLand_id}</span> },
    { key: 'act_header_typeSugarCane_id', header: 'ประเภทอ้อย', sortable: true, sortValue: (row) => typeSugarCaneMap[row.act_header_typeSugarCane_id] ?? row.act_header_typeSugarCane_id, render: (r) => <span className="badge-pink">{typeSugarCaneMap[r.act_header_typeSugarCane_id] ?? r.act_header_typeSugarCane_id}</span> },
    {
      key: 'activities_header_info',
      header: 'ข้อมูลเพิ่มเติม',
      sortable: true,
      width: '320px',
      minWidth: '220px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.activities_header_info} title="ข้อมูลเพิ่มเติมกิจกรรม" />,
    },
  ]


// interface ActivityHeader {
//   activities_header_id: number   / 
//   land_id: number    / 
//   farmer_id: number
//   activities_header_idCode: string     / 
//   activities_header_startDate?: string   /  
//   activities_header_curlatitude?: number  / 
//   activities_header_curlongitude?: number / 
//   act_header_type_id: number     / 
//   act_header_typeLand_id: number    / 
//   act_header_typeSugarCane_id: number   / 
//   activities_header_info: string  / 
// }


  const detailCols: Column<LogDetail>[] = [
    { key: 'activities_header_id', header: 'หัวข้อกิจกรรม', width: '80px', sortable: true, sortValue: (row) => row.activities_header_id != null ? hdrMap[row.activities_header_id] ?? row.activities_header_id : '—', render: (r) => r.activities_header_id != null ? hdrMap[r.activities_header_id] ?? r.activities_header_id : '—' },
    { key: 'log_act_detail_create_at', header: 'วันที่ปฏิบัติ', sortable: true, sortValue: (row) => row.log_act_detail_create_at ?? row.activities_header?.activities_header_startDate ?? '', render: (r) => formatBangkokDate(r.log_act_detail_create_at ?? r.activities_header?.activities_header_startDate) },
    { key: 'detail_camp', header: 'แคมป์', sortable: true, sortValue: (row) => getDetailCampName(row) ?? '—', render: (r) => getDetailCampName(r) ? <span className="badge-blue">{getDetailCampName(r)}</span> : '—' },
    { key: 'detail_land', header: 'แปลง', sortable: true, sortValue: (row) => getDetailLandLabel(row), render: (r) => getDetailLandId(r) != null ? <span className="badge-green">{getDetailLandLabel(r)}</span> : '—' },
    { key: 'act_header_type_id', header: 'กิจกรรม', sortable: true, sortValue: (row) => hdrTypeMap[row.act_header_type_id] ?? row.act_header_type_id, render: (r) => hdrTypeMap[r.act_header_type_id] ?? r.act_header_type_id ?? '—' },
    { key: 'act_header_detail_type_id', header: 'รายละเอียด', sortable: true, sortValue: (row) => detailTypeMap[row.act_header_detail_type_id ?? 0] ?? row.act_header_detail_type_id ?? '—', render: (r) => detailTypeMap[r.act_header_detail_type_id ?? 0] ?? r.act_header_detail_type_id ?? '—' },
    { key: 'resource_used_type_id', header: 'ประเภทปัจจัย', sortable: true, sortValue: (row) => row.resource_used_type?.resc_used_type_name ?? resourceTypeMap[row.resource_used_type_id] ?? row.resource_used_type_id, render: (r) => r.resource_used_type?.resc_used_type_name ?? resourceTypeMap[r.resource_used_type_id] ?? r.resource_used_type_id ?? '—' },
    {
      key: 'resource_item',
      header: 'รายการปัจจัย',
      sortable: true,
      sortValue: (row) => getResourceItemName(row),
      render: (r) => getResourceItemName(r),
    },
    { key: 'unit_prefix_id', header: 'Prefix', sortable: true, sortValue: (row) => unitPrefixMap[row.unit_prefix_id ?? 0] ?? row.unit_prefix_id ?? '—', render: (r) => unitPrefixMap[r.unit_prefix_id ?? 0] ?? r.unit_prefix_id ?? '—' },
    { key: 'unit_id', header: 'หน่วย', sortable: true, sortValue: (row) => unitMap[row.unit_id ?? 0] ?? row.unit_id ?? '—', render: (r) => unitMap[r.unit_id ?? 0] ?? r.unit_id ?? '—' },
    { key: 'log_act_detail_quatity', header: 'จำนวน', sortable: true, render: (r) => formatQuantityValue(r.log_act_detail_quatity) },
    { key: 'log_act_detail_volumePerUnit', header: 'ปริมาณ/หน่วย', sortable: true, render: (r) => r.log_act_detail_volumePerUnit?.toFixed(3) ?? '—' },
    { key: 'log_act_detail_volumeAll', header: 'ปริมาณรวม', sortable: true, render: (r) => <span className="font-mono">{r.log_act_detail_volumeAll?.toFixed(3)}</span> },
    {
      key: 'detail_land_size',
      header: 'ขนาดพื้นที่แปลง',
      sortable: true,
      sortValue: (row) => getDetailLandSize(row) ?? -1,
      render: (r) => getDetailLandSize(r)?.toFixed(2) ?? '—',
    },
    { key: 'log_act_detail_areawork', header: 'พื้นดำเนินการ', sortable: true, render: (r) => r.log_act_detail_areawork?.toFixed(2) ?? '—' },
    {
      key: 'log_act_detail_calStatus_id',
      header: 'สถานะ CO₂e',
      sortable: true,
      sortValue: (row) => row.log_act_detail_calStatus?.log_act_detail_calStatus_name ?? row.log_act_detail_calStatus_id,
      render: (r) => renderCalStatusBadge(r),
    }, 
  ]

  const importFileCols: Column<ActivityImportFile>[] = [
    { key: 'activities_fileNameUse_id', header: 'ID', width: '70px', sortable: true },
    {
      key: 'activities_fileNameUse_name',
      header: 'ชื่อไฟล์',
      sortable: true,
      render: (row) => row.activities_fileNameUse_name ?? '—',
    },
    {
      key: 'activities_fileNameUse_rowCount',
      header: 'จำนวนแถว',
      sortable: true,
      render: (row) => row.activities_fileNameUse_rowCount?.toLocaleString('th-TH') ?? '—',
    },
    {
      key: 'activities_fileNameUse_columnCount',
      header: 'จำนวนคอลัมน์',
      sortable: true,
      render: (row) => row.activities_fileNameUse_columnCount?.toLocaleString('th-TH') ?? '—',
    },
    {
      key: 'activities_fileNameUse_create_at',
      header: 'เวลานำเข้า',
      sortable: true,
      render: (row) => formatBangkokDateTime(row.activities_fileNameUse_create_at),
    },
    {
      key: 'activities_fileNameUse_update_uid',
      header: 'ผู้บันทึก',
      sortable: true,
      sortValue: (row) => getImportFileUpdaterLabel(row),
      render: (row) => getImportFileUpdaterLabel(row),
    },
  ]

  const selectedHeaderPanel = showSelectedHeaderPanel && selectedHeader ? (
    <div className="card w-full shrink-0 animate-slide-in xl:w-[30rem]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">รายการบันทึกกิจกรรมของหัวข้อ #{selectedHeader.activities_header_id}</h3>
          <p className="mt-1 text-xs text-surface-500">เลือกหัวข้อจากตารางด้านบนเพื่อดูข้อมูลสรุปและรายการบันทึกกิจกรรมของหัวข้อนั้น</p>
        </div>
        <button className="btn-ghost btn-sm shrink-0" onClick={() => setFormPanelOpen(false)}>✕</button>
      </div>
      <div className="mb-4 rounded-lg border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600">
        <p><span className="font-medium text-surface-700">แคมป์:</span> {selectedHeaderCampName ?? '—'}</p>
        <p><span className="font-medium text-surface-700">แปลง:</span> {selectedHeaderLandLabel}</p>
        <p><span className="font-medium text-surface-700">วันที่กิจกรรม:</span> {formatBangkokDateTime(selectedHeader.activities_header_startDate)}</p>
      </div>
      <div className="space-y-3 text-xs">
        <div className="rounded-lg bg-surface-50 p-3">
          <p className="mb-1 font-medium text-surface-700">การคำนวณแยกไปอยู่ที่หน้าคำนวณ Carbon</p>
          <p>นำเข้าข้อมูลหรือแก้ไขรายการในหน้านี้ก่อน แล้วค่อยย้ายสถานะและสั่งคำนวณจากเมนู <span className="font-medium text-primary-700">คำนวณ Carbon</span></p>
        </div>
        <DataTable
          data={selectedHeaderDetails}
          columns={detailCols.filter((column) => !['log_act_detail_id', 'activities_header_id'].includes(String(column.key)))}
          isLoading={dLoad}
          rowKey={(row) => row.log_act_detail_id}
          defaultPageSize={10}
          searchable={false}
          emptyMessage="ยังไม่มีรายการบันทึกกิจกรรมสำหรับหัวข้อนี้"
        />
      </div>
    </div>
  ) : null

  // Summary stats
  const importedCount = details.filter((detail) => getActivityCalStatusKind(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id) === 'imported').length
  const preparingCount = details.filter((detail) => getActivityCalStatusKind(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id) === 'preparing').length
  const readyCount = details.filter((detail) => getActivityCalStatusKind(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id) === 'ready').length
  const standardDoneCount = details.filter((detail) => getActivityCalStatusKind(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id) === 'standardDone').length
  const standardCfpDoneCount = details.filter((detail) => getActivityCalStatusKind(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id) === 'cfpDone').length
  const errorCount = details.filter((detail) => getActivityCalStatusKind(getRawCalStatusLabel(detail), detail.log_act_detail_calStatus_id) === 'error').length
  const totalLogRecords = details.length
  const importedFilesCount = importFiles.length

  const dashboardOptions = [
    { key: 'total', label: 'หัวข้อกิจกรรมทั้งหมด' },
    { key: 'totalLogs', label: 'บันทึกกิจกรรมทั้งหมด' },
    { key: 'importFiles', label: 'ไฟล์ที่นำเข้าแล้ว' },
    { key: 'imported', label: 'นำเข้าข้อมูลแล้ว' },
    { key: 'preparing', label: 'กำลังเตรียมข้อมูล' },
    { key: 'ready', label: 'พร้อมคำนวณมาตรฐาน' },
    { key: 'standardDone', label: 'คำนวณแล้ว(มาตรฐาน)' },
    { key: 'cfpDone', label: 'คำนวณแล้ว(มาตรฐาน,CFP)' },
    { key: 'error', label: 'คำนวณผิดพลาด' },
  ]

  const {
    visibleKeys: visibleDashboardKeys,
    visibleKeySet: visibleDashboardKeySet,
    toggleKey: toggleDashboardKey,
    reset: resetDashboardKeys,
  } = useDashboardVisibility(
    'activities-manage-dashboard-cards',
    dashboardOptions.map((option) => option.key),
    dashboardOptions,
  )

  const dashboardCards = [
    {
      key: 'total',
      label: 'หัวข้อกิจกรรมทั้งหมด',
      icon: <ActivitySquare size={14} className="text-primary-500" />,
      value: headers.length,
      valueClassName: 'stat-value',
    },
    {
      key: 'totalLogs',
      label: 'บันทึกกิจกรรมทั้งหมด',
      icon: <Calculator size={14} className="text-indigo-500" />,
      value: totalLogRecords,
      valueClassName: 'stat-value text-indigo-700',
    },
    {
      key: 'imported',
      label: 'นำเข้าข้อมูลแล้ว',
      icon: <Upload size={14} className="text-surface-500" />,
      value: importedCount,
      valueClassName: 'stat-value text-surface-700',
    },
    {
      key: 'importFiles',
      label: 'ไฟล์ที่นำเข้าแล้ว',
      icon: <Upload size={14} className="text-emerald-500" />,
      value: importedFilesCount,
      valueClassName: 'stat-value text-emerald-700',
    },
    {
      key: 'preparing',
      label: 'กำลังเตรียมข้อมูล',
      icon: <Edit size={14} className="text-blue-500" />,
      value: preparingCount,
      valueClassName: 'stat-value text-blue-700',
    },
    {
      key: 'ready',
      label: 'พร้อมคำนวณมาตรฐาน',
      icon: <Clock3 size={14} className="text-accent-500" />,
      value: readyCount,
      valueClassName: 'stat-value text-accent-600',
    },
    {
      key: 'standardDone',
      label: 'คำนวณแล้ว(มาตรฐาน)',
      icon: <CheckCircle2 size={14} className="text-primary-500" />,
      value: standardDoneCount,
      valueClassName: 'stat-value text-primary-700',
    },
    {
      key: 'cfpDone',
      label: 'คำนวณแล้ว(มาตรฐาน,CFP)',
      icon: <Leaf size={14} className="text-cyan-600" />,
      value: standardCfpDoneCount,
      valueClassName: 'stat-value text-cyan-700',
    },
    {
      key: 'error',
      label: 'คำนวณผิดพลาด',
      icon: <CircleAlert size={14} className="text-red-500" />,
      value: errorCount,
      valueClassName: 'stat-value text-red-700',
    },
  ]


  // // ----------------------------------------------------for dropzone
  // const [showWizard, setShowWizard] = useState(false);
  // const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // This runs when a user drops a file OR browses and selects one
  // const onDrop = useCallback((acceptedFiles: File[]) => {
//   if (acceptedFiles.length > 0) {
//     setDroppedFile(acceptedFiles[0]); // Save the file
//     setShowWizard(true);              // Open the wizard
//   }
// }, []);

  // Configure the dropzone rules (.csv and .xlsx)
  // const { getRootProps, getInputProps, isDragActive } = useDropzone({
  //   onDrop,
  //   accept: {
  //     'text/csv': ['.csv'],
  //     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
  //   },
  //   multiple: false // Only allow one file at a time
  // });



  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><ActivitySquare size={20} className="text-primary-600" /> จัดการกิจกรรม</h1>
          <p className="page-subtitle">หน้าจัดการขั้นสูงสำหรับหัวข้อกิจกรรม รายการบันทึกกิจกรรม และการนำเข้า CSV/XLSX</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary"   onClick={() => setShowWizard(true)}><Upload size={14} /> นำเข้า xlsx/CSV</button>
        </div>
      </div>

      <DatabaseConnectionNotice
        items={activityQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      {/* Stats */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Dashboard</h2>
            <p className="mt-1 text-xs text-surface-500">เลือกการ์ดสรุปที่ต้องการแสดงในส่วนนี้ได้</p>
          </div>
          <DashboardVisibilityMenu
            options={dashboardOptions}
            visibleKeys={visibleDashboardKeys}
            onToggle={toggleDashboardKey}
            onReset={resetDashboardKeys}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {dashboardCards
            .filter((card) => visibleDashboardKeySet.has(card.key))
            .map((card) => (
              <div key={card.key} className="stat-card">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <span className="stat-label">{card.label}</span>
                </div>
                <p className={card.valueClassName}>{card.value}</p>
              </div>
          ))}
        </div>
      </div>

      <div className="card mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">ประวัติไฟล์ที่นำเข้า</h2>
            <p className="mt-1 text-xs text-surface-500">
              เก็บรายชื่อไฟล์ที่ถูกนำเข้าผ่านหน้าจัดการกิจกรรม พร้อมจำนวนแถวและจำนวนคอลัมน์ของไฟล์นั้น
            </p>
          </div>
        </div>
        <DataTable
          data={importFiles}
          columns={importFileCols}
          isLoading={importFilesLoading}
          rowKey={(row) => row.activities_fileNameUse_id}
          searchPlaceholder="ค้นหาชื่อไฟล์นำเข้า..."
          defaultPageSize={5}
          emptyMessage="ยังไม่มีประวัติไฟล์นำเข้า"
        />
      </div>

      {/* Split panel: table left, detail right when selected */}
      <div className="flex flex-col gap-5 transition-all duration-300 xl:flex-row">
        <div className={`card min-w-0 ${showHeaderSection && showSelectedHeaderPanel ? 'xl:flex-1' : 'w-full'}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">หัวข้อกิจกรรม</h2>
              <p className="mt-1 text-xs text-surface-500">
                ส่วนนี้ซ่อนไว้เป็นค่าเริ่มต้น เพื่อลดความสับสนระหว่างหัวข้อกิจกรรมกับรายการบันทึกกิจกรรม
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  setShowHeaderSection((prev) => {
                    const next = !prev
                    if (!next) setFormPanelOpen(false)
                    return next
                  })
                }}
              >
                {showHeaderSection ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showHeaderSection ? 'ซ่อนหัวข้อกิจกรรม' : 'แสดงหัวข้อกิจกรรม'}
              </button>
              {showHeaderSection && (
                <button className="btn-primary btn-sm" onClick={openHeaderForm}>
                  <Plus size={13} /> เพิ่มหัวข้อกิจกรรม
                </button>
              )}
              {showHeaderSection && selectedHeader && !formPanelOpen && (
                <button className="btn-secondary btn-sm" onClick={() => setFormPanelOpen(true)}>
                  <Calculator size={13} /> ดูรายละเอียด CO₂e
                </button>
              )}
            </div>
          </div>
          {showHeaderSection ? (
            <>
              <div className="mb-3 rounded-lg border border-surface-200 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-surface-600">ตัวกรองหัวข้อกิจกรรม</h3>
                  <button className="btn-ghost btn-sm" onClick={() => setHeaderFilters(emptyHeaderFilters)}>
                    ล้างตัวกรอง
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <div>
                    <label className="label">วันที่กิจกรรมตั้งแต่</label>
                    <input
                      type="date"
                      className="input"
                      value={headerFilters.startDateFrom}
                      onChange={(e) => setHeaderFilterValue('startDateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">วันที่กิจกรรมถึง</label>
                    <input
                      type="date"
                      className="input"
                      value={headerFilters.startDateTo}
                      onChange={(e) => setHeaderFilterValue('startDateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">แคมป์</label>
                    <select className="select" value={headerFilters.landCampId} onChange={(e) => setHeaderFilterValue('landCampId', e.target.value)}>
                      <option value="">ทั้งหมด</option>
                      {camps.map(c => <option key={c.land_camp_id} value={c.land_camp_id}>{c.land_camp_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ประเภทกิจกรรม</label>
                    <select className="select" value={headerFilters.actHeaderTypeId} onChange={(e) => setHeaderFilterValue('actHeaderTypeId', e.target.value)}>
                      <option value="">ทั้งหมด</option>
                      {hdrTypes.map(t => <option key={t.act_header_type_id} value={t.act_header_type_id}>{t.act_header_type_name_th}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ประเภทแปลง</label>
                    <select className="select" value={headerFilters.actHeaderTypeLandId} onChange={(e) => setHeaderFilterValue('actHeaderTypeLandId', e.target.value)}>
                      <option value="">ทั้งหมด</option>
                      {landTypes.map(t => <option key={t.act_header_typeLand_id} value={t.act_header_typeLand_id}>{t.act_header_typeLand_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ประเภทอ้อย</label>
                    <select className="select" value={headerFilters.actHeaderTypeSugarCaneId} onChange={(e) => setHeaderFilterValue('actHeaderTypeSugarCaneId', e.target.value)}>
                      <option value="">ทั้งหมด</option>
                      {sugarCaneTypes.map(t => <option key={t.act_header_typeSugarCane_id} value={t.act_header_typeSugarCane_id}>{t.act_header_typeSugarCane_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <DataTable
                data={filteredHeaders} columns={headerCols} isLoading={hLoad}
                rowKey={(r) => r.activities_header_id}
                onRowClick={(r) => { setSelectedHeader(r); setFormPanelOpen(true) }}
                searchPlaceholder="ค้นหากิจกรรม..."
                actions={(r) => (
                  <div className="flex items-center justify-end gap-1">
                    <button className="btn-secondary btn-sm" onClick={() => goToAddLogPage(r)}>
                      <Plus size={13} /> log
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => openEditHeaderForm(r)}>
                      <Edit size={13} />
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => setDeleteHeaderTarget(r)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 px-4 py-5 text-sm text-surface-600">
              ซ่อนส่วนจัดการหัวข้อกิจกรรมไว้ก่อน กด `แสดงหัวข้อกิจกรรม` เมื่อต้องการเปิดตารางและฟอร์มของหัวข้อกิจกรรม
            </div>
          )}
        </div>

        {showHeaderSection ? selectedHeaderPanel : null}
      </div>

      <div className="card mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">รายการบันทึกกิจกรรม</h2>
          <button className="btn-primary btn-sm" onClick={() => openDetailForm(selectedHeader ?? undefined)}>
            <Plus size={13} /> เพิ่มรายการ
          </button>
        </div>
        <div className="mb-3 rounded-lg border border-surface-200 p-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-surface-600">ตัวกรองรายการบันทึกกิจกรรม</h3>
            <button className="btn-ghost btn-sm" onClick={() => setDetailFilters(emptyDetailFilters)}>
              ล้างตัวกรอง
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
            <div>
              <label className="label">หัวข้อกิจกรรม</label>
              <select className="select" value={detailFilters.activitiesHeaderId} onChange={(e) => setDetailFilterValue('activitiesHeaderId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {headers.map(h => (
                  <option key={h.activities_header_id} value={h.activities_header_id}>
                    #{h.activities_header_id} {h.activities_header_idCode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">สถานะหัวข้อกิจกรรม</label>
              <select className="select" value={detailFilters.hasActivitiesHeader} onChange={(e) => setDetailFilterValue('hasActivitiesHeader', e.target.value)}>
                <option value="">ทั้งหมด</option>
                <option value="with">มีหัวข้อกิจกรรม</option>
                <option value="without">ไม่มีหัวข้อกิจกรรม</option>
              </select>
            </div>
            <div>
              <label className="label">แคมป์</label>
              <select className="select" value={detailFilters.campId} onChange={(e) => setDetailFilterValue('campId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {camps.map(c => <option key={c.land_camp_id} value={c.land_camp_id}>{c.land_camp_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">แปลง</label>
              <select className="select" value={detailFilters.landId} onChange={(e) => setDetailFilterValue('landId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {visibleDetailFilterLands.map(l => <option key={l.land_id} value={l.land_id}>{getLandDisplayLabel(l.land_code, l.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภทกิจกรรม</label>
              <select className="select" value={detailFilters.actHeaderTypeId} onChange={(e) => setDetailFilterValue('actHeaderTypeId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {hdrTypes.map(t => <option key={t.act_header_type_id} value={t.act_header_type_id}>{t.act_header_type_name_th}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภทรายละเอียด</label>
              <select className="select" value={detailFilters.actHeaderDetailTypeId} onChange={(e) => setDetailFilterValue('actHeaderDetailTypeId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {allDetailTypes.map(t => <option key={t.act_header_detail_type_id} value={t.act_header_detail_type_id}>{t.act_header_detail_type_name_th}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภทปัจจัย</label>
              <select className="select" value={detailFilters.resourceUsedTypeId} onChange={(e) => setDetailFilterValue('resourceUsedTypeId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {resTypes.map(t => <option key={t.resource_used_type_id} value={t.resource_used_type_id}>{t.resc_used_type_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">สถานะคำนวณ</label>
              <select className="select" value={detailFilters.calStatusId} onChange={(e) => setDetailFilterValue('calStatusId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {calStatuses.map(s => <option key={s.log_act_detail_calStatus_id} value={s.log_act_detail_calStatus_id}>{s.log_act_detail_calStatus_name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <DataTable
          data={filteredDetails}
          columns={detailCols}
          isLoading={dLoad}
          rowKey={(r) => r.log_act_detail_id}
          searchPlaceholder="ค้นหารายการบันทึกกิจกรรม..."
          defaultPageSize={10}
          emptyMessage="ยังไม่มีรายการบันทึกกิจกรรม"
          actions={(r) => (
            <div className="flex items-center justify-end gap-1">
              <button className="btn-secondary btn-sm" onClick={() => openEditDetailForm(r)}>
                <Edit size={13} />
              </button>
              <button className="btn-danger btn-sm" onClick={() => setDeleteDetailTarget(r)}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Manual entry modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetailForm} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <h3 className="font-semibold mb-2">{editingDetail ? 'แก้ไขบันทึกกิจกรรม' : 'เพิ่มบันทึกกิจกรรม'}</h3>
            <p className="text-xs text-surface-500 mb-5">กรอกข้อมูลและระบบจะคำนวณ CO₂e โดยอัตโนมัติ</p>

            <form onSubmit={submitDetailForm} className="space-y-4">
              <FormSection title="หัวข้อกิจกรรมและแปลง">
                <div className="md:col-span-2">
                  <label className="label">วิธีเลือกแปลง</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button type="button" onClick={() => setTrackMethod('direct')}
                      className={`py-1.5 rounded-lg text-xs font-medium border ${trackMethod === 'direct' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-surface-600 border-surface-200'}`}>
                      ระบุ Land ID โดยตรง
                    </button>
                    <button type="button" onClick={() => setTrackMethod('cascade')}
                      className={`py-1.5 rounded-lg text-xs font-medium border ${trackMethod === 'cascade' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-surface-600 border-surface-200'}`}>
                      เลือกจากแคมป์ → แปลง
                    </button>
                  </div>

                  {trackMethod === 'direct' ? (
                    <select className="select" value={selectedLandId ?? ''} onChange={(e) => setLandFilter(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— เลือกแปลง —</option>
                      {lands.map(l => <option key={l.land_id} value={l.land_id}>{getLandDisplayLabel(l.land_code, l.name)}</option>)}
                    </select>
                  ) : (                                           // If cascade method, show camp selector first, then land selector filtered by camp
                    <div className="grid grid-cols-2 gap-2">
                      <select className="select" value={selectedCampId ?? ''} onChange={(e) => {
                        const campId = e.target.value ? Number(e.target.value) : null
                        setSelectedCampId(campId)
                        setLandFilter(null)
                      }}>
                        <option value="">— แคมป์ —</option>
                        {camps.map(c => <option key={c.land_camp_id} value={c.land_camp_id}>{c.land_camp_name}</option>)}
                      </select>
                      <select className="select" value={selectedLandId ?? ''} onChange={(e) => setLandFilter(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— แปลง —</option>
                        {visibleLands.map(l => <option key={l.land_id} value={l.land_id}>{getLandDisplayLabel(l.land_code, l.name)}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="label">หัวข้อกิจกรรม</label>
                  <select
                    className="select"
                    value={detailForm.activities_header_id}
                    onChange={(e) => {
                      const header = headers.find(h => h.activities_header_id === Number(e.target.value))
                      setFormValue('activities_header_id', e.target.value)
                      if (header?.act_header_type_id) setFormValue('act_header_type_id', String(header.act_header_type_id))
                    }}
                  >
                    <option value="">— เลือกหัวข้อกิจกรรม —</option>
                    {visibleHeaders.map(h => (
                      <option key={h.activities_header_id} value={h.activities_header_id}>
                        #{h.activities_header_id} {h.activities_header_idCode} - {getLandLabelById(h.land_id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">ประเภทกิจกรรม *</label>
                  <select className="select" value={detailForm.act_header_type_id} onChange={(e) => {
                    setFormValue('act_header_type_id', e.target.value)
                    setFormValue('act_header_detail_type_id', '')
                  }}>
                    <option value="">— เลือกประเภทกิจกรรม —</option>
                    {hdrTypes.map(t => <option key={t.act_header_type_id} value={t.act_header_type_id}>{t.act_header_type_name_th}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภทรายละเอียด</label>
                  <select className="select" value={detailForm.act_header_detail_type_id} onChange={(e) => setFormValue('act_header_detail_type_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {detailTypes.map(t => <option key={t.act_header_detail_type_id} value={t.act_header_detail_type_id}>{t.act_header_detail_type_name_th}</option>)}
                  </select>
                </div>
              </FormSection>

              <FormSection title="ปัจจัยการผลิต">
                <div>
                  <label className="label">ประเภทปัจจัย *</label>
                  <select className="select" value={detailForm.resource_used_type_id} onChange={(e) => setFormValue('resource_used_type_id', e.target.value)}>
                    <option value="">— เลือกประเภทปัจจัย —</option>
                    {resTypes.map(t => <option key={t.resource_used_type_id} value={t.resource_used_type_id}>{t.resc_used_type_name}</option>)}
                  </select>
                </div>
                {/* <div>
                  <label className="label">ประเภทรายการ</label>
                  <input className="input" value={
                    detailForm.act_fertilizer_id ? 'ปุ๋ย' :
                    detailForm.act_equipment_id ? 'อุปกรณ์' :
                    detailForm.act_chemiscal_id ? 'สารเคมี' :
                    detailForm.act_resourceOther_id ? 'รายการอื่น ๆ' : '—'
                  } readOnly />
                </div> */}
                <div>
                  <label className="label">ปุ๋ย</label>
                  <select className="select" value={detailForm.act_fertilizer_id} onChange={(e) => {
                    setFormValue('act_fertilizer_id', e.target.value)
                    if (e.target.value) {
                      setFormValue('act_equipment_id', '')
                      setFormValue('act_chemiscal_id', '')
                      setFormValue('act_resourceOther_id', '')
                    }
                  }}>
                    <option value="">— ไม่ระบุ —</option>
                    {fertilizers.map(f => <option key={f.act_fertilizer_id} value={f.act_fertilizer_id}>{f.act_fertilizer_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">อุปกรณ์</label>
                  <select className="select" value={detailForm.act_equipment_id} onChange={(e) => {
                    setFormValue('act_equipment_id', e.target.value)
                    if (e.target.value) {
                      setFormValue('act_fertilizer_id', '')
                      setFormValue('act_chemiscal_id', '')
                      setFormValue('act_resourceOther_id', '')
                    }
                  }}>
                    <option value="">— ไม่ระบุ —</option>
                    {equipments.map(eq => <option key={eq.act_equipment_id} value={eq.act_equipment_id}>{eq.act_equipment_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">สารเคมี</label>
                  <select className="select" value={detailForm.act_chemiscal_id} onChange={(e) => {
                    setFormValue('act_chemiscal_id', e.target.value)
                    if (e.target.value) {
                      setFormValue('act_fertilizer_id', '')
                      setFormValue('act_equipment_id', '')
                      setFormValue('act_resourceOther_id', '')
                    }
                  }}>
                    <option value="">— ไม่ระบุ —</option>
                    {chemicals.map(c => <option key={c.act_chemiscal_id} value={c.act_chemiscal_id}>{c.act_chemiscal_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">รายการอื่น ๆ</label>
                  <select className="select" value={detailForm.act_resourceOther_id} onChange={(e) => {
                    setFormValue('act_resourceOther_id', e.target.value)
                    if (e.target.value) {
                      setFormValue('act_fertilizer_id', '')
                      setFormValue('act_equipment_id', '')
                      setFormValue('act_chemiscal_id', '')
                    }
                  }}>
                    <option value="">— ไม่ระบุ —</option>
                    {resourceOthers.map(r => <option key={r.act_resourceOther_id} value={r.act_resourceOther_id}>{r.act_resourceOther_name}</option>)}
                  </select>
                </div>
                {/* <div>
                  <label className="label">ผู้แก้ไข detail type</label>
                  <input type="number" className="input" value={detailForm.act_header_detail_type_update_uid} onChange={(e) => setFormValue('act_header_detail_type_update_uid', e.target.value)} />
                </div> */}
              </FormSection>

              <FormSection title="หน่วยและปริมาณ">
                <div>
                  <label className="label">Prefix หน่วย</label>
                  <select className="select" value={detailForm.unit_prefix_id} onChange={(e) => setFormValue('unit_prefix_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {unitPrefixes.map(p => <option key={p.unit_prefix_id} value={p.unit_prefix_id}>{p.unit_prefix_name ?? p.unit_prefix_initial ?? `#${p.unit_prefix_id}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">หน่วยนับ</label>
                  <select className="select" value={detailForm.unit_id} onChange={(e) => setFormValue('unit_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {units.map(u => <option key={u.unit_id} value={u.unit_id}>{u.unit_name ?? u.unit_initial ?? `#${u.unit_id}`}</option>)}
                  </select>
                </div>
                <div><label className="label">ปริมาณ (จำนวน)</label><input type="number" step="0.001" className="input" value={detailForm.log_act_detail_quatity} onChange={(e) => setFormValue('log_act_detail_quatity', e.target.value)} /></div>
                <div><label className="label">ปริมาณ/หน่วย</label><input type="number" step="0.001" className="input" value={detailForm.log_act_detail_volumePerUnit} onChange={(e) => setFormValue('log_act_detail_volumePerUnit', e.target.value)} /></div>
                <div><label className="label">ปริมาณรวม *</label><input type="number" step="0.001" className="input" required value={detailForm.log_act_detail_volumeAll} onChange={(e) => setFormValue('log_act_detail_volumeAll', e.target.value)} /></div>
                <div><label className="label">พื้นที่ทำงาน (ไร่)</label><input type="number" step="0.01" className="input" value={detailForm.log_act_detail_areawork} onChange={(e) => setFormValue('log_act_detail_areawork', e.target.value)} /></div>
              </FormSection>

              <div className="flex gap-3 mt-5">
                <button type="button" className="btn-secondary flex-1" onClick={closeDetailForm}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={createDetailMut.isPending}>
                  {createDetailMut.isPending ? 'กำลังบันทึก...' : editingDetail ? 'บันทึกการแก้ไข' : 'บันทึกกิจกรรม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activities Header modal */}
      {showHeaderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeHeaderForm} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <h3 className="font-semibold mb-2">{editingHeader ? 'แก้ไขหัวข้อกิจกรรม' : 'เพิ่มหัวข้อกิจกรรม'}</h3>
            <p className="text-xs text-surface-500 mb-5">สร้างหัวข้อกิจกรรมก่อน แล้วค่อยเพิ่มรายการบันทึกกิจกรรมภายใต้หัวข้อนั้น</p>

            <form onSubmit={submitHeaderForm} className="space-y-4">
              <FormSection title="แปลงและเจ้าของ">
                <div>
                  <label className="label">แคมป์</label>
                  <select
                    className="select"
                    value={selectedHeaderCampId ?? ''}
                    onChange={(e) => {
                      const campId = e.target.value ? Number(e.target.value) : null
                      setSelectedHeaderCampId(campId)
                      setHeaderForm(prev => ({ ...prev, land_id: '' }))
                    }}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {camps.map(c => <option key={c.land_camp_id} value={c.land_camp_id}>{c.land_camp_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">แปลง</label>
                  <select
                    className="select"
                    value={headerForm.land_id}
                    onChange={(e) => {
                      const land = lands.find(l => l.land_id === Number(e.target.value))
                      setHeaderForm(prev => ({
                        ...prev,
                        land_id: e.target.value,
                        farmer_id: land?.farmer_id ? String(land.farmer_id) : prev.farmer_id,
                      }))
                    }}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {visibleHeaderLands.map(l => <option key={l.land_id} value={l.land_id}>{getLandDisplayLabel(l.land_code, l.name)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">เกษตรกร</label>
                  <select className="select" value={headerForm.farmer_id} onChange={(e) => setHeaderFormValue('farmer_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {farmers.map(f => (
                      <option key={f.farmer_id} value={f.farmer_id}>
                        #{f.farmer_id} {f.first_name ?? ''} {f.last_name ?? ''} {f.thai_farmer_id ? `(${f.thai_farmer_id})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">รหัสกิจกรรม</label>
                  <input className="input" value={headerForm.activities_header_idCode} onChange={(e) => setHeaderFormValue('activities_header_idCode', e.target.value)} placeholder="ปล่อยว่างเพื่อสร้างอัตโนมัติ" />
                </div>
                <div>
                  <label className="label">วันที่เริ่มกิจกรรม</label>
                  <input type="datetime-local" className="input" value={headerForm.activities_header_startDate} onChange={(e) => setHeaderFormValue('activities_header_startDate', e.target.value)} />
                </div>
              </FormSection>

              <FormSection title="ประเภทกิจกรรม">
                <div>
                  <label className="label">ประเภทกิจกรรม</label>
                  <select className="select" value={headerForm.act_header_type_id} onChange={(e) => setHeaderFormValue('act_header_type_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {hdrTypes.map(t => <option key={t.act_header_type_id} value={t.act_header_type_id}>{t.act_header_type_name_th}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภทแปลง</label>
                  <select className="select" value={headerForm.act_header_typeLand_id} onChange={(e) => setHeaderFormValue('act_header_typeLand_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {landTypes.map(t => <option key={t.act_header_typeLand_id} value={t.act_header_typeLand_id}>{t.act_header_typeLand_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภทอ้อย</label>
                  <select className="select" value={headerForm.act_header_typeSugarCane_id} onChange={(e) => setHeaderFormValue('act_header_typeSugarCane_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {sugarCaneTypes.map(t => <option key={t.act_header_typeSugarCane_id} value={t.act_header_typeSugarCane_id}>{t.act_header_typeSugarCane_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ผู้บันทึก/แก้ไข</label>
                  <input type="number" className="input" value={headerForm.activities_header_update_uid} onChange={(e) => setHeaderFormValue('activities_header_update_uid', e.target.value)} />
                </div>
              </FormSection>

              <FormSection title="ตำแหน่งและหมายเหตุ">
                <div>
                  <label className="label">ละติจูด</label>
                  <input type="number" step="0.00000001" className="input" value={headerForm.activities_header_curlatitude} onChange={(e) => setHeaderFormValue('activities_header_curlatitude', e.target.value)} />
                </div>
                <div>
                  <label className="label">ลองจิจูด</label>
                  <input type="number" step="0.00000001" className="input" value={headerForm.activities_header_curlongitude} onChange={(e) => setHeaderFormValue('activities_header_curlongitude', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea className="input min-h-24" value={headerForm.activities_header_info} onChange={(e) => setHeaderFormValue('activities_header_info', e.target.value)} />
                </div>
              </FormSection>

              <div className="flex gap-3 mt-5">
                <button type="button" className="btn-secondary flex-1" onClick={closeHeaderForm}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={createHeaderMut.isPending}>
                  {createHeaderMut.isPending ? 'กำลังบันทึก...' : editingHeader ? 'บันทึกการแก้ไข' : 'บันทึกหัวข้อกิจกรรม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteHeaderTarget}
        title="ลบหัวข้อกิจกรรม?"
        message={`ต้องการลบหัวข้อกิจกรรม #${deleteHeaderTarget?.activities_header_id ?? ''} ใช่ไหม`}
        confirmLabel="ลบ"
        onConfirm={() => {
          if (deleteHeaderTarget) deleteHeaderMut.mutate(deleteHeaderTarget.activities_header_id)
        }}
        onCancel={() => setDeleteHeaderTarget(null)}
        isLoading={deleteHeaderMut.isPending}
      />

      <ConfirmDialog
        open={!!deleteDetailTarget}
        title="ลบรายการบันทึกกิจกรรม?"
        message={`ต้องการลบรายการบันทึกกิจกรรม #${deleteDetailTarget?.log_act_detail_id ?? ''} ใช่ไหม`}
        confirmLabel="ลบ"
        onConfirm={() => {
          if (deleteDetailTarget) deleteDetailMut.mutate(deleteDetailTarget.log_act_detail_id)
        }}
        onCancel={() => setDeleteDetailTarget(null)}
        isLoading={deleteDetailMut.isPending}
      />

      {/* CSV Import Wizard — using actual xlsx columns */}
      {showWizard && (
        <CsvMappingWizard
          title="นำเข้ากิจกรรมจาก CSV"
          subtitle="รองรับคอลัมน์ เช่น วันที่ปฏิบัติ · หมวดหมู่กิจกรรมหลัก · รายละเอียดกิจกรรมย่อย · ไร่/แคมป์ · แปลง · พื้นที่ตามแปลง · ประเภทแปลง · ประเภทอ้อย · รายการปัจจัยการผลิต · ประเภทปัจจัย · ปริมาณรวม · จำนวน · ปริมาณต่อ 1 จำนวน · หน่วยนับ · พื้นที่ปฏิบัติรวม โดยระบบจะใช้ข้อมูลไร่และแปลงเพื่อเชื่อมโยงข้อมูลกิจกรรมให้โดยอัตโนมัติ"
          targetColumns={ACTIVITY_TARGET_COLUMNS}
          onComplete={importActivityCsvInChunks}
          onCancel={() => setShowWizard(false)}
          showImportTimeConfirmation
          onFinish={() => {
            setShowWizard(false)
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
