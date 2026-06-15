import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calculator, CheckCircle2, CircleAlert, Code2, Edit3, LoaderCircle, Plus, Wand2, X } from 'lucide-react'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, type Column } from '@/components/ui/DataTable'
import {
  ACTIVITY_CAL_STATUS_NAMES,
  getActivityCalStatusBadgeClass,
  getActivityCalStatusKind,
  getActivityCalStatusLabel,
} from '@/features/activities/cal-status'
import { get, post, put } from '@/lib/api'
import { formatBangkokDate, formatBangkokDateTime } from '@/lib/datetime'
import '../cf-dashboard.css'

type QueuePageMode = 'preparation' | 'footprint'

interface Unit {
  unit_id?: number
  unit_name?: string
  unit_initial?: string
}

interface UnitPrefix {
  unit_prefix_id?: number
  unit_prefix_name?: string
  unit_prefix_initial?: string
  unit_prefix_value?: number
}

interface Ef {
  coefficient_emission_factor_id: number
  coef_em_factor_idCode?: string | null
  coef_em_factor_name?: string | null
  coef_em_factor_info?: string | null
  carbonfootprint_type_id?: number | null
  group_emission_factor_id?: number | null
  unit_id?: number | null
  unit_prefix_id?: number | null
  coef_em_factor_value_total?: number | null
  unit_prefix_id_total?: number | null
  unit_id_total?: number | null
  coef_em_factor_value_co2?: number | null
  unit_prefix_id_co2?: number | null
  unit_id_co2?: number | null
  unit_prefix_id_ch4foss?: number | null
  unit_id_ch4foss?: number | null
  coef_em_factor_value_ch4?: number | null
  unit_prefix_id_ch4?: number | null
  unit_id_ch4?: number | null
  coef_em_factor_value_ch4foss?: number | null
  coef_em_factor_value_n2o?: number | null
  unit_prefix_id_n2o?: number | null
  unit_id_n2o?: number | null
}

interface Gwp {
  coefficients_emissions_factors_gwp_id: number
  coef_em_factor_gwp_name?: string | null
  coef_em_factor_gwp_name_en?: string | null
  coef_em_factor_gwp_value?: number | null
  coef_em_factor_gwp_info?: string | null
}

interface CfType {
  carbonfootprint_type_id: number
  cf_type_name_short?: string | null
  cf_type_name_th?: string | null
}

interface EfGroup {
  group_emission_factor_id: number
  carbonfootprint_type_id?: number | null
  group_emission_factor_idCode?: string | null
  group_emission_factor_name_short?: string | null
  group_emission_factor_name?: string | null
}

interface HeaderType {
  act_header_type_id: number
  act_header_type_name_th: string
}

interface DetailType {
  act_header_detail_type_id: number
  act_header_detail_type_name_th: string
}

interface QueueLogDetail {
  log_act_detail_id: number
  activities_header_id?: number
  act_header_type_id?: number
  act_header_detail_type_id?: number
  act_equipment_id?: number
  act_fertilizer_id?: number
  act_chemiscal_id?: number
  act_resourceOther_id?: number
  resource_used_type_id?: number
  unit_prefix_id?: number
  unit_id?: number
  log_act_detail_quatity?: number
  log_act_detail_volumePerUnit?: number
  log_act_detail_volumeAll?: number
  log_act_detail_areawork?: number
  log_act_detail_calStatus_id?: number
  log_act_detail_create_at?: string
  activities_fertilizers?: { act_fertilizer_name?: string }
  activities_equipments?: { act_equipment_name?: string }
  activities_chemiscals?: { act_chemiscal_name?: string }
  activities_resourceOther?: { act_resourceOther_name?: string }
  resource_used_type?: { resc_used_type_name?: string }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  units?: { unit_name?: string; unit_initial?: string }
  units_prefixs?: { unit_prefix_name?: string; unit_prefix_initial?: string; unit_prefix_value?: number }
  activities_header?: {
    activities_header_id: number
    activities_header_idCode?: string
    activities_header_startDate?: string
    land_id?: number
    lands?: {
      land_code?: string
      name?: string
      land_camp_id?: number
      lands_camps?: { land_camp_name?: string }
    }
  }
}

interface CarbonProcessQueueItem {
  carbon_process_queue_id: number
  log_act_detail_id?: number
  log_act_detail_calStatus_id?: number
  land_id?: number
  land_camp_id?: number
  carbon_process_queue_dateWork?: string
  N?: number
  carbon_process_queue_info?: string
  carbon_process_queue_resultValue?: number | string
  unit_prefix_id_resultValue?: number
  unit_id_resultValue?: number
  carbon_process_queue_retry_count?: number
  carbon_process_queue_error_message?: string
  carbon_process_queue_create_at?: string
  carbon_process_queue_started_at?: string
  carbon_process_queue_ended_at?: string
  carbon_process_queue_updated_at?: string
  lands?: { land_code?: string; name?: string }
  lands_camps?: { land_camp_name?: string }
  units?: { unit_name?: string; unit_initial?: string }
  units_prefixs?: { unit_prefix_name?: string; unit_prefix_initial?: string; unit_prefix_value?: number }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  log_activities_detail?: QueueLogDetail
}

type CarbonPreparationInfo = {
  sourceUnitId?: number
  sourceUnitPrefixId?: number
  sourceVolumePerUnit?: number
  sourceVolumeAll?: number
  preparedUnitId?: number
  preparedUnitPrefixId?: number
  preparedVolumePerUnit?: number
  preparedVolumeAll?: number
  conversionFactor?: number
  fertilizerBagWeightKg?: number
  fertilizerPrepareType?: string
  soilSampleDate?: string
  soilN?: number
  soilSocBaseline?: number
  soilSocProject?: number
  note?: string
  preparedAt?: string
}

type PreparationForm = {
  preparedUnitId: string
  preparedUnitName: string
  preparedUnitInitial: string
  preparedUnitPrefixId: string
  preparedVolumeAll: string
  preparedVolumePerUnit: string
  conversionFactor: string
  fertilizerBagWeightKg: string
  fertilizerPrepareType: string
  soilSampleDate: string
  soilN: string
  soilSocBaseline: string
  soilSocProject: string
  note: string
}

type QueueRow = {
  id: number
  checked?: boolean
  detailId: number
  dateLabel: string
  headerLabel: string
  activityTypeName: string
  detailTypeName: string
  campId: string
  campLabel: string
  landLabel: string
  resourceTypeId: string
  resourceTypeName: string
  resourceItemName: string
  formulaMode: FootprintFormulaMode
  formulaModeLabel: string
  inputStatusKind: FootprintInputStatusKind
  inputStatusLabel: string
  calculationAmount?: number
  calculationAmountLabel: string
  nValue?: number | null
  nValueLabel: string
  resultValueLabel: string
  resultUnitIdLabel: string
  resultUnitLabel: string
  retryCountLabel: string
  errorMessageLabel: string
  createAtLabel: string
  startedAtLabel: string
  endedAtLabel: string
  quantityUnitLabel: string
  quantityLabel: string
  sourceAmountLabel: string
  sourceUnitLabel: string
  preparedAmountLabel: string
  preparedUnitLabel: string
  preparationStateLabel: string
  preparedAtLabel: string
  hasPreparedChange: boolean
  statusLabel: string
  statusRawName: string
  statusKind: string
  rowType: PreparationRowType
  preparationType: string
  isPrepared: boolean
  hasSoilData: boolean
  preparationInfo: CarbonPreparationInfo
  original: CarbonProcessQueueItem
}

type PreparationRowType = 'fertilizer' | 'fuel' | 'other'
type FootprintFormulaMode = 'generic_ef' | 'fertilizer_n2o' | 'fnfix_group' | 'soc_removal'
type FootprintInputStatusKind = 'ready' | 'warning' | 'blocked'
type BulkOtherMode = 'keep' | 'factor'

const FOOTPRINT_SUPPORTED_FORMULA_MODES: FootprintFormulaMode[] = ['generic_ef', 'fertilizer_n2o']
const FOOTPRINT_UNSUPPORTED_FORMULA_MODES: FootprintFormulaMode[] = ['fnfix_group', 'soc_removal']
const FOOTPRINT_FORMULA_MODES: FootprintFormulaMode[] = [
  ...FOOTPRINT_SUPPORTED_FORMULA_MODES,
  ...FOOTPRINT_UNSUPPORTED_FORMULA_MODES,
]

const FERTILIZER_CFP_SIMPLE_CONSTANTS = {
  EF_UREA_AS_N: 3.3036,
  EF_DAP_AS_P2O5: 1.5716,
  EF_KCL_AS_K2O: 0.4974,
  EF_FILLER: 0,
  EF_N_TO_N2O_N_SIMPLE: 0.01,
  GWP_N2O: 298,
  MW_RATIO_N2O_N: 44 / 28,
} as const

const FOOTPRINT_CALC_REQUEST_TIMEOUT_MS = 20 * 60_000

type FootprintResultUnitKind = 'kgco2e' | 'tco2e'
type FertilizerFactorKey = 'ureaAsN' | 'dapAsP2O5' | 'kclAsK2O'

type FertilizerFactorSelections = {
  ureaAsNEfId: string
  dapAsP2O5EfId: string
  kclAsK2OEfId: string
  gwpN2OId: string
}

type ManualFertilizerFormulaInput = {
  nPercent: string
  p2o5Percent: string
  k2oPercent: string
}

type ParsedManualFertilizerFormulaInput = {
  nPercent: number
  p2o5Percent: number
  k2oPercent: number
  fillerPercent: number
  formulaLabel: string
}

type ResolvedFertilizerFactorValues = {
  ureaAsNValue: number
  dapAsP2O5Value: number
  kclAsK2OValue: number
  gwpN2OValue: number
  ureaAsNEf?: Ef
  dapAsP2O5Ef?: Ef
  kclAsK2OEf?: Ef
  gwpN2O?: Gwp
}

type FertilizerFactorFieldConfig = {
  key: FertilizerFactorKey
  selectionKey: keyof FertilizerFactorSelections
  label: string
  placeholder: string
  defaultValue: number
  keywords: string[]
}

type BulkPreparationPopupState =
  | { kind: 'hidden' }
  | { kind: 'loading'; current: number; total: number; currentLabel: string }
  | { kind: 'success'; itemCount: number; countdown: number; movedToReadyCount?: number }

type StatusTransitionPopupState =
  | { kind: 'hidden' }
  | { kind: 'loading'; itemCount: number; fromStatusLabel: string; toStatusLabel: string }
  | { kind: 'success'; itemCount: number; countdown: number; fromStatusLabel: string; toStatusLabel: string }

type FootprintCalculationSource = 'single' | 'selected' | 'all'

type FootprintCalculationRunResult = {
  row: QueueRow
  resultValue?: number | string
  resultUnitLabel?: string
  error?: string
}

type FootprintPreviewStatusKind = 'ready' | 'info' | 'blocked' | 'unsupported'

type FootprintRowPreview = {
  rowId: number
  formulaLabel: string
  inputSummary: string
  previewResultValue?: number
  previewResultLabel: string
  previewResultUnitLabel: string
  previewStatusLabel: string
  previewStatusKind: FootprintPreviewStatusKind
  previewFormulaText: string
  note?: string
}

const EMPTY_FERTILIZER_FACTOR_SELECTIONS: FertilizerFactorSelections = {
  ureaAsNEfId: '',
  dapAsP2O5EfId: '',
  kclAsK2OEfId: '',
  gwpN2OId: '',
}

const EMPTY_MANUAL_FERTILIZER_FORMULA_INPUT: ManualFertilizerFormulaInput = {
  nPercent: '',
  p2o5Percent: '',
  k2oPercent: '',
}

const FERTILIZER_FACTOR_FIELD_CONFIGS: FertilizerFactorFieldConfig[] = [
  {
    key: 'ureaAsN',
    selectionKey: 'ureaAsNEfId',
    label: 'EF ยูเรีย as N',
    placeholder: 'ค้นหา EF_total สำหรับยูเรีย as N',
    defaultValue: FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_UREA_AS_N,
    keywords: ['urea', 'ยูเรีย', ' as n', ' asn', 'nitrogen'],
  },
  {
    key: 'dapAsP2O5',
    selectionKey: 'dapAsP2O5EfId',
    label: 'EF DAP as P2O5',
    placeholder: 'ค้นหา EF_total สำหรับ DAP as P2O5',
    defaultValue: FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_DAP_AS_P2O5,
    keywords: ['dap', 'diammonium', 'p2o5'],
  },
  {
    key: 'kclAsK2O',
    selectionKey: 'kclAsK2OEfId',
    label: 'EF โพแทสเซียมคลอไรด์ as K2O',
    placeholder: 'ค้นหา EF_total สำหรับ KCl as K2O',
    defaultValue: FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_KCL_AS_K2O,
    keywords: ['kcl', 'potassium chloride', 'โพแทสเซียมคลอไรด์', 'k2o'],
  },
]

type FootprintCalculationModalState =
  | { kind: 'hidden' }
  | { kind: 'preview'; source: FootprintCalculationSource; rows: QueueRow[] }
  | {
      kind: 'running'
      source: FootprintCalculationSource
      rows: QueueRow[]
      currentIndex: number
      currentLabel: string
      successRows: FootprintCalculationRunResult[]
      failedRows: FootprintCalculationRunResult[]
    }
  | {
      kind: 'complete'
      source: FootprintCalculationSource
      rows: QueueRow[]
      successRows: FootprintCalculationRunResult[]
      failedRows: FootprintCalculationRunResult[]
      countdown?: number
    }

type BulkConversionPreview = {
  row: QueueRow
  rowType: PreparationRowType
  ruleLabel: string
  currentUnitLabel: string
  formulaText: string
  preparedUnitLabel: string
  preparedVolumeAll: number
  payload: Record<string, unknown>
}

type FertilizerNitrogenProfile = {
  kind: 'chemical' | 'organic' | 'unknown'
  detectedN: number | null
  detectedP2O5?: number | null
  detectedK2O?: number | null
  fillerPercent?: number | null
  formulaLabel?: string | null
  label: string
  reason: string
}

type OtherGroupConfig = {
  mode: BulkOtherMode
  conversionFactor: string
  preparedUnitId: string
  preparedUnitPrefixId: string
  preparedUnitName: string
  preparedUnitInitial: string
}

const DEFAULT_OTHER_GROUP_CONFIG: OtherGroupConfig = {
  mode: 'keep',
  conversionFactor: '1',
  preparedUnitId: '',
  preparedUnitPrefixId: '',
  preparedUnitName: '',
  preparedUnitInitial: '',
}

const emptyForm: PreparationForm = {
  preparedUnitId: '',
  preparedUnitName: '',
  preparedUnitInitial: '',
  preparedUnitPrefixId: '',
  preparedVolumeAll: '',
  preparedVolumePerUnit: '',
  conversionFactor: '',
  fertilizerBagWeightKg: '',
  fertilizerPrepareType: '',
  soilSampleDate: '',
  soilN: '',
  soilSocBaseline: '',
  soilSocProject: '',
  note: '',
}

function formatNumber(value?: number | null, digits = 3) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function formatFormNumber(value: number) {
  if (!Number.isFinite(value)) return ''
  return String(Math.round(value * 1_000_000) / 1_000_000)
}

function formatNumberish(value?: number | string | null, digits = 4) {
  if (value == null || value === '') return '—'
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return String(value)
  return parsed.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'เกิดข้อผิดพลาดระหว่างทำรายการ'
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function calculatePreparedVolumePerUnit(quantity?: number | null, preparedVolumeAll?: number | null) {
  if (quantity == null || preparedVolumeAll == null || !Number.isFinite(quantity) || !Number.isFinite(preparedVolumeAll) || quantity === 0) {
    return undefined
  }
  return preparedVolumeAll / quantity
}

function toNumberOrUndefined(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeUnitText(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function unitLabel(unit?: Unit | null) {
  if (!unit) return '—'
  return unit.unit_initial || unit.unit_name || `#${unit.unit_id}`
}

function prefixLabel(prefix?: UnitPrefix | null) {
  if (!prefix) return '—'
  return prefix.unit_prefix_initial || prefix.unit_prefix_name || `#${prefix.unit_prefix_id}`
}

function getEfInputUnitId(ef: Ef) {
  return ef.unit_id
    ?? ef.unit_id_total
    ?? ef.unit_id_co2
    ?? ef.unit_id_ch4foss
    ?? ef.unit_id_ch4
    ?? ef.unit_id_n2o
}

function getEfTotalResultUnitId(ef: Ef) {
  return ef.unit_id_total ?? null
}

function getFuelEfOptionLabel(ef: Ef, unitById: Record<number, Unit>) {
  const inputUnitId = getEfInputUnitId(ef)
  const resultUnitId = getEfTotalResultUnitId(ef)
  const inputUnitLabel = inputUnitId != null
    ? (unitById[inputUnitId] ? unitLabel(unitById[inputUnitId]) : `#${inputUnitId}`)
    : '—'
  const resultUnitLabel = resultUnitId != null
    ? (unitById[resultUnitId] ? unitLabel(unitById[resultUnitId]) : `#${resultUnitId}`)
    : '—'

  return [
    ef.coef_em_factor_idCode?.trim() || `EF #${ef.coefficient_emission_factor_id}`,
    ef.coef_em_factor_name?.trim() || 'ไม่ระบุชื่อ',
    `EF_total ${formatNumberish(ef.coef_em_factor_value_total, 6)}`,
    `input ${inputUnitLabel}`,
    `result ${resultUnitLabel}`,
  ].join(' | ')
}

function getGwpOptionLabel(gwp: Gwp) {
  return [
    gwp.coef_em_factor_gwp_name?.trim() || `GWP #${gwp.coefficients_emissions_factors_gwp_id}`,
    gwp.coef_em_factor_gwp_name_en?.trim() || undefined,
    `value ${formatNumberish(gwp.coef_em_factor_gwp_value, 6)}`,
  ].filter(Boolean).join(' | ')
}

function parseManualFertilizerFormulaInput(input?: ManualFertilizerFormulaInput | null): ParsedManualFertilizerFormulaInput | null {
  if (!input) return null

  const rawValues = [input.nPercent, input.p2o5Percent, input.k2oPercent].map((value) => value.trim())
  if (!rawValues.some(Boolean)) return null
  if (rawValues.some((value) => !value)) return null

  const [nPercent, p2o5Percent, k2oPercent] = rawValues.map((value) => Number(value))
  if (![nPercent, p2o5Percent, k2oPercent].every((value) => Number.isFinite(value))) return null
  if ([nPercent, p2o5Percent, k2oPercent].some((value) => value < 0)) return null

  const totalPercent = nPercent + p2o5Percent + k2oPercent
  if (totalPercent > 100) return null

  return {
    nPercent,
    p2o5Percent,
    k2oPercent,
    fillerPercent: 100 - totalPercent,
    formulaLabel: `${nPercent.toFixed(4)}-${p2o5Percent.toFixed(4)}-${k2oPercent.toFixed(4)}`,
  }
}

function getManualFertilizerFormulaInputError(input?: ManualFertilizerFormulaInput | null) {
  if (!input) return null

  const rawValues = [input.nPercent, input.p2o5Percent, input.k2oPercent].map((value) => value.trim())
  if (!rawValues.some(Boolean)) return null
  if (rawValues.some((value) => !value)) return 'กรอก N, P2O5 และ K2O ให้ครบ'

  const [nPercent, p2o5Percent, k2oPercent] = rawValues.map((value) => Number(value))
  if (![nPercent, p2o5Percent, k2oPercent].every((value) => Number.isFinite(value))) {
    return 'ค่า N, P2O5 และ K2O ต้องเป็นตัวเลข'
  }

  if ([nPercent, p2o5Percent, k2oPercent].some((value) => value < 0)) {
    return 'ค่า N, P2O5 และ K2O ต้องไม่ติดลบ'
  }

  if ((nPercent + p2o5Percent + k2oPercent) > 100) {
    return 'ผลรวม N + P2O5 + K2O ต้องไม่เกิน 100'
  }

  return null
}

function getGenericEfPreviewResultDigits(unitKind: FootprintResultUnitKind | null) {
  if (unitKind === 'tco2e') return 6
  if (unitKind === 'kgco2e') return 3
  return 4
}

function getFootprintResultUnitKindLabel(kind: FootprintResultUnitKind | null) {
  if (kind === 'tco2e') return 'tCO2e'
  if (kind === 'kgco2e') return 'kgCO2e'
  return 'หน่วยที่ยังไม่รองรับ'
}

function dateInputValue(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function parsePreparationInfo(value?: string | null): CarbonPreparationInfo {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CarbonPreparationInfo
    }
  } catch {
    return { note: value }
  }
  return {}
}

function getResourceItemName(detail?: QueueLogDetail) {
  return detail?.activities_fertilizers?.act_fertilizer_name
    ?? detail?.activities_equipments?.act_equipment_name
    ?? detail?.activities_chemiscals?.act_chemiscal_name
    ?? detail?.activities_resourceOther?.act_resourceOther_name
    ?? '—'
}

function getQueueStatusName(item: CarbonProcessQueueItem) {
  return item.log_act_detail_calStatus?.log_act_detail_calStatus_name
    ?? item.log_activities_detail?.log_act_detail_calStatus?.log_act_detail_calStatus_name
    ?? ''
}

function getPreparationTypeLabel(value?: string | null) {
  if (value === 'fertilizer') return 'ปุ๋ย'
  if (value === 'chemical') return 'ปุ๋ยเคมี'
  if (value === 'organic') return 'ปุ๋ยอินทรีย์'
  if (value === 'fuel') return 'น้ำมัน'
  if (value === 'soil') return 'ตรวจดิน / SOC'
  if (value === 'other') return 'อื่น ๆ'
  return 'ยังไม่ระบุ'
}

function getFertilizerNitrogenProfile(name?: string | null): FertilizerNitrogenProfile {
  const rawName = (name ?? '').trim()
  const normalized = rawName.toLowerCase()

  const chemicalFormulaMatch = rawName.match(/(\d+(?:\.\d+)?)\s*[-xX]\s*(\d+(?:\.\d+)?)\s*[-xX]\s*(\d+(?:\.\d+)?)/)
  if (chemicalFormulaMatch) {
    const detectedN = Number(chemicalFormulaMatch[1])
    const detectedP2O5 = Number(chemicalFormulaMatch[2])
    const detectedK2O = Number(chemicalFormulaMatch[3])
    const fillerPercent = Math.max(0, 100 - detectedN - detectedP2O5 - detectedK2O)
    return {
      kind: 'chemical',
      detectedN,
      detectedP2O5,
      detectedK2O,
      fillerPercent,
      formulaLabel: chemicalFormulaMatch[0],
      label: 'ปุ๋ยเคมี',
      reason: `พบสูตรปุ๋ย ${chemicalFormulaMatch[0]}`,
    }
  }

  const organicKeywords = [
    'อินทรีย์',
    'organic',
    'pellet',
    'pellets',
    'compost',
    'manure',
    'soilmate',
    'ชีวภาพ',
    'มูล',
  ]
  if (organicKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      kind: 'organic',
      detectedN: null,
      detectedP2O5: null,
      detectedK2O: null,
      fillerPercent: null,
      formulaLabel: null,
      label: 'ปุ๋ยอินทรีย์',
      reason: 'พบคำที่สื่อว่าเป็นปุ๋ยอินทรีย์',
    }
  }

  return {
    kind: 'unknown',
    detectedN: null,
    detectedP2O5: null,
    detectedK2O: null,
    fillerPercent: null,
    formulaLabel: null,
    label: 'ปุ๋ยประเภทอื่น',
    reason: rawName ? 'ยังไม่พบสูตรหรือคำสำคัญที่ใช้ระบุ N อัตโนมัติ' : 'ยังไม่มีชื่อปุ๋ยสำหรับวิเคราะห์',
  }
}

function getPreparationStateBadgeClass(row: QueueRow) {
  if (!row.isPrepared) return 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700'
  if (row.hasPreparedChange) return 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
  return 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700'
}

function getDefaultPreparationType(rowType: PreparationRowType) {
  if (rowType === 'fertilizer') return 'fertilizer'
  if (rowType === 'fuel') return 'fuel'
  return 'other'
}

function isKgUnitLabel(value: string) {
  const normalized = normalizeUnitText(value)
  return ['kg', 'kilogram', 'kilograms', 'กิโลกรัม'].some((alias) => normalized.includes(alias))
}

function getFootprintFormulaMode(rowType: PreparationRowType, resourceText: string): FootprintFormulaMode {
  if (rowType === 'fertilizer' || /ปุ๋ย|fertilizer/.test(resourceText)) return 'fertilizer_n2o'
  if (/soc|soil|ดิน|ตรวจดิน|carbon stock/.test(resourceText)) return 'soc_removal'
  if (/fnfix|ปอเทือง|ถั่วเขียว|ถั่วเหลือง|ถั่วลิสง|legume/.test(resourceText)) return 'fnfix_group'
  return 'generic_ef'
}

function getFootprintFormulaModeLabel(mode: FootprintFormulaMode) {
  if (mode === 'fertilizer_n2o') return 'ปุ๋ย / CFP Simple'
  if (mode === 'generic_ef') return 'EF ทั่วไป'
  if (mode === 'fnfix_group') return 'Fnfix'
  return 'SOC'
}

function getFootprintExpectedResultUnitLabel(mode: FootprintFormulaMode) {
  if (mode === 'fertilizer_n2o') return 'kgCO2e'
  if (mode === 'generic_ef') return 'kgCO2e'
  return 'ยังไม่กำหนด'
}

function getFootprintResultUnitAliases(mode: FootprintFormulaMode) {
  if (mode === 'fertilizer_n2o') {
    return ['kgco2e', 'kilogramco2e', 'กิโลกรัมco2e']
  }
  if (mode === 'generic_ef') {
    return ['kgco2e', 'kilogramco2e', 'กิโลกรัมco2e']
  }
  return []
}

function getDefaultFootprintResultUnitKind(mode: FootprintFormulaMode): FootprintResultUnitKind | null {
  if (mode === 'generic_ef') return 'kgco2e'
  if (mode === 'fertilizer_n2o') return 'kgco2e'
  return null
}

function getGenericEfPreviewFormulaText(sourceKind: FootprintResultUnitKind | null, targetKind: FootprintResultUnitKind | null) {
  if (sourceKind === 'kgco2e' && targetKind === 'tco2e') {
    return '(activityAmount * selectedEfTotal) / 1000'
  }

  if (sourceKind === 'tco2e' && targetKind === 'kgco2e') {
    return '(activityAmount * selectedEfTotal) * 1000'
  }

  return 'activityAmount * selectedEfTotal'
}

function resolveFootprintResultUnitKindFromNames(names: Array<string | null | undefined>): FootprintResultUnitKind | null {
  const normalized = names
    .map((value) => normalizeUnitText(value))
    .filter(Boolean)

  if (normalized.some((value) => ['kgco2e', 'kilogramco2e', 'กิโลกรัมco2e'].includes(value))) return 'kgco2e'
  if (normalized.some((value) => ['tco2e', 'tonco2e', 'tonneco2e', 'ตันco2e'].includes(value))) return 'tco2e'
  return null
}

function convertFootprintResultUnitValue(value: number, from: FootprintResultUnitKind, to: FootprintResultUnitKind) {
  if (from === to) return value
  if (from === 'kgco2e' && to === 'tco2e') return value / 1000
  if (from === 'tco2e' && to === 'kgco2e') return value * 1000
  return value
}

function getFertilizerPreviewResultDigits(unitKind: FootprintResultUnitKind | null) {
  if (unitKind === 'tco2e') return 6
  if (unitKind === 'kgco2e') return 4
  return 4
}

function resolveFertilizerFactorValues(
  selections: FertilizerFactorSelections | undefined,
  efById: Record<number, Ef>,
  gwpById: Record<number, Gwp>,
): ResolvedFertilizerFactorValues {
  const ureaAsNEf = selections?.ureaAsNEfId ? efById[Number(selections.ureaAsNEfId)] : undefined
  const dapAsP2O5Ef = selections?.dapAsP2O5EfId ? efById[Number(selections.dapAsP2O5EfId)] : undefined
  const kclAsK2OEf = selections?.kclAsK2OEfId ? efById[Number(selections.kclAsK2OEfId)] : undefined
  const gwpN2O = selections?.gwpN2OId ? gwpById[Number(selections.gwpN2OId)] : undefined

  return {
    ureaAsNValue: ureaAsNEf?.coef_em_factor_value_total != null ? Number(ureaAsNEf.coef_em_factor_value_total) : FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_UREA_AS_N,
    dapAsP2O5Value: dapAsP2O5Ef?.coef_em_factor_value_total != null ? Number(dapAsP2O5Ef.coef_em_factor_value_total) : FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_DAP_AS_P2O5,
    kclAsK2OValue: kclAsK2OEf?.coef_em_factor_value_total != null ? Number(kclAsK2OEf.coef_em_factor_value_total) : FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_KCL_AS_K2O,
    gwpN2OValue: gwpN2O?.coef_em_factor_gwp_value != null ? Number(gwpN2O.coef_em_factor_gwp_value) : FERTILIZER_CFP_SIMPLE_CONSTANTS.GWP_N2O,
    ureaAsNEf,
    dapAsP2O5Ef,
    kclAsK2OEf,
    gwpN2O,
  }
}

function calculateFertilizerCfpSimplePreview({
  fertilizerKg,
  fertilizerProfile,
  factorValues,
  manualFormulaInput,
}: {
  fertilizerKg: number
  fertilizerProfile: FertilizerNitrogenProfile
  factorValues: ResolvedFertilizerFactorValues
  manualFormulaInput?: ManualFertilizerFormulaInput | null
}) {
  const manualFormula = parseManualFertilizerFormulaInput(manualFormulaInput)
  const hasDetectedFormula = (
    fertilizerProfile.kind === 'chemical'
    && fertilizerProfile.detectedN != null
    && fertilizerProfile.detectedP2O5 != null
    && fertilizerProfile.detectedK2O != null
    && fertilizerProfile.fillerPercent != null
  )

  if (!hasDetectedFormula && !manualFormula) {
    return null
  }

  const nPercent = manualFormula?.nPercent ?? fertilizerProfile.detectedN ?? 0
  const p2o5Percent = manualFormula?.p2o5Percent ?? fertilizerProfile.detectedP2O5 ?? 0
  const k2oPercent = manualFormula?.k2oPercent ?? fertilizerProfile.detectedK2O ?? 0
  const fillerPercent = manualFormula?.fillerPercent ?? fertilizerProfile.fillerPercent ?? 0
  const nFraction = nPercent / 100
  const p2o5Fraction = p2o5Percent / 100
  const k2oFraction = k2oPercent / 100
  const fillerFraction = fillerPercent / 100
  const upstreamPerKg = (
    (nFraction * factorValues.ureaAsNValue)
    + (p2o5Fraction * factorValues.dapAsP2O5Value)
    + (k2oFraction * factorValues.kclAsK2OValue)
    + (fillerFraction * FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_FILLER)
  )
  const upstreamKgco2e = fertilizerKg * upstreamPerKg
  const nAppliedKg = fertilizerKg * nFraction
  const n2oKg = nAppliedKg * FERTILIZER_CFP_SIMPLE_CONSTANTS.EF_N_TO_N2O_N_SIMPLE * FERTILIZER_CFP_SIMPLE_CONSTANTS.MW_RATIO_N2O_N
  const usePhaseKgco2e = n2oKg * factorValues.gwpN2OValue
  const totalKgco2e = upstreamKgco2e + usePhaseKgco2e

  return {
    formulaLabel: manualFormula?.formulaLabel ?? fertilizerProfile.formulaLabel ?? `${nPercent}-${p2o5Percent}-${k2oPercent}`,
    formulaSource: manualFormula ? 'manual' : 'parsed',
    nPercent,
    p2o5Percent,
    k2oPercent,
    fillerPercent,
    nFraction,
    p2o5Fraction,
    k2oFraction,
    fillerFraction,
    upstreamPerKg,
    upstreamKgco2e,
    nAppliedKg,
    n2oKg,
    usePhaseKgco2e,
    totalKgco2e,
    factorValues,
  }
}

function getFootprintPreviewStatusClass(kind: FootprintPreviewStatusKind) {
  if (kind === 'ready') return 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
  if (kind === 'info') return 'inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700'
  if (kind === 'unsupported') return 'inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700'
  return 'inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700'
}

function getCarbonQueueResultUnitLabel(item?: CarbonProcessQueueItem | null) {
  const prefix = item?.units_prefixs?.unit_prefix_initial || item?.units_prefixs?.unit_prefix_name || ''
  const unit = item?.units?.unit_initial || item?.units?.unit_name || '—'
  return [prefix, unit].filter(Boolean).join(' ') || '—'
}

function getFootprintInputStatus({
  formulaMode,
  rowType,
  resourceItemName,
  amount,
  unitLabelText,
  nValue: _nValue,
}: {
  formulaMode: FootprintFormulaMode
  rowType: PreparationRowType
  resourceItemName: string
  amount?: number
  unitLabelText: string
  nValue?: number | null
}): { kind: FootprintInputStatusKind; label: string } {
  if (formulaMode === 'fnfix_group' || formulaMode === 'soc_removal') {
    return { kind: 'blocked', label: 'สูตรนี้ยังไม่เปิดคำนวณ' }
  }

  if (amount == null || !Number.isFinite(amount)) {
    return { kind: 'blocked', label: 'ขาดปริมาณที่ใช้คำนวณ' }
  }

  if (!unitLabelText || unitLabelText === '—') {
    return { kind: 'blocked', label: 'ขาดหน่วยหลังเตรียม' }
  }

  if (formulaMode === 'fertilizer_n2o') {
    const profile = getFertilizerNitrogenProfile(resourceItemName)
    if (!isKgUnitLabel(unitLabelText)) {
      return { kind: 'blocked', label: 'ต้องเตรียมปุ๋ยเป็น kg' }
    }
    if (profile.kind !== 'chemical' || profile.detectedP2O5 == null || profile.detectedK2O == null) {
      return { kind: 'blocked', label: 'ต้องมีสูตรปุ๋ย N-P2O5-K2O เช่น 15-15-15' }
    }
    return { kind: 'ready', label: rowType === 'fertilizer' ? 'พร้อมคำนวณ Carbon Footprint ปุ๋ย' : 'พร้อมคำนวณ' }
  }

  return { kind: 'warning', label: 'พร้อมตรวจ EF' }
}

function getFootprintInputStatusClass(kind: FootprintInputStatusKind) {
  if (kind === 'ready') return 'inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
  if (kind === 'warning') return 'inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700'
  return 'inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700'
}

function isSupportedFootprintFormula(row: Pick<QueueRow, 'formulaMode'>) {
  return FOOTPRINT_SUPPORTED_FORMULA_MODES.includes(row.formulaMode)
}

function canRunFootprintCalculation(row: Pick<QueueRow, 'formulaMode' | 'inputStatusKind' | 'statusKind'>) {
  return (
    isSupportedFootprintFormula(row)
    && row.inputStatusKind !== 'blocked'
    && ['ready', 'error'].includes(row.statusKind)
  )
}

function getFootprintBlockedReason(row: QueueRow) {
  if (!['ready', 'error'].includes(row.statusKind)) return `สถานะปัจจุบัน: ${row.statusLabel}`
  return row.inputStatusLabel
}

function buildFootprintRowPreview({
  row,
  selectedResultUnit,
  selectedEf,
  fertilizerFactorValues,
  manualFertilizerFormulaInput,
  unitById,
}: {
  row: QueueRow
  selectedResultUnit?: Unit
  selectedEf?: Ef
  fertilizerFactorValues: ResolvedFertilizerFactorValues
  manualFertilizerFormulaInput?: ManualFertilizerFormulaInput | null
  unitById: Record<number, Unit>
}): FootprintRowPreview {
  const defaultUnitLabel = getFootprintExpectedResultUnitLabel(row.formulaMode)
  const selectedUnitLabel = selectedResultUnit ? unitLabel(selectedResultUnit) : defaultUnitLabel
  const targetKind = selectedResultUnit
    ? resolveFootprintResultUnitKindFromNames([selectedResultUnit.unit_name, selectedResultUnit.unit_initial])
    : getDefaultFootprintResultUnitKind(row.formulaMode)

  if (row.formulaMode === 'fnfix_group' || row.formulaMode === 'soc_removal') {
    return {
      rowId: row.id,
      formulaLabel: row.formulaModeLabel,
      inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
      previewResultLabel: 'ยังไม่รองรับ',
      previewResultUnitLabel: '—',
      previewStatusLabel: 'สูตรนี้ยังไม่เปิดคำนวณ',
      previewStatusKind: 'unsupported',
      previewFormulaText: row.formulaMode === 'fnfix_group' ? 'Fnfix preview ยังไม่เปิดใช้' : 'SOC preview ยังไม่เปิดใช้',
    }
  }

  if (!['ready', 'error'].includes(row.statusKind)) {
    return {
      rowId: row.id,
      formulaLabel: row.formulaModeLabel,
      inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
      previewResultLabel: '—',
      previewResultUnitLabel: selectedUnitLabel,
      previewStatusLabel: `สถานะปัจจุบัน: ${row.statusLabel}`,
      previewStatusKind: 'blocked',
      previewFormulaText: 'รอให้รายการอยู่ในสถานะพร้อมคำนวณก่อน',
    }
  }

  const manualFertilizerFormula = row.formulaMode === 'fertilizer_n2o'
    ? parseManualFertilizerFormulaInput(manualFertilizerFormulaInput)
    : null
  const canBypassFertilizerFormulaBlock = (
    row.formulaMode === 'fertilizer_n2o'
    && Boolean(manualFertilizerFormula)
    && row.calculationAmount != null
    && Number.isFinite(row.calculationAmount)
    && Boolean(row.preparedUnitLabel)
    && row.preparedUnitLabel !== '—'
    && isKgUnitLabel(row.preparedUnitLabel)
  )

  if (row.inputStatusKind === 'blocked' && !canBypassFertilizerFormulaBlock) {
    return {
      rowId: row.id,
      formulaLabel: row.formulaModeLabel,
      inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
      previewResultLabel: '—',
      previewResultUnitLabel: selectedUnitLabel,
      previewStatusLabel: row.inputStatusLabel,
      previewStatusKind: 'blocked',
      previewFormulaText: row.formulaMode === 'fertilizer_n2o'
        ? 'ปุ๋ยต้องมี kg และสูตร N-P2O5-K2O เช่น 15-15-15'
        : 'ข้อมูลที่ใช้คำนวณยังไม่ครบ',
    }
  }

  if (row.formulaMode === 'fertilizer_n2o') {
    const amount = row.calculationAmount
    const fertilizerProfile = getFertilizerNitrogenProfile(row.resourceItemName)
    const sourceKind = getDefaultFootprintResultUnitKind(row.formulaMode)
    if (amount == null || !Number.isFinite(amount)) {
      return {
        rowId: row.id,
        formulaLabel: row.formulaModeLabel,
        inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
        previewResultLabel: '—',
        previewResultUnitLabel: selectedUnitLabel,
        previewStatusLabel: 'ขาดปริมาณที่ใช้คำนวณปุ๋ย',
        previewStatusKind: 'blocked',
        previewFormulaText: 'fertilizerKg x fertilizerTotalKgCO2ePerKg',
      }
    }

    const fertilizerBreakdown = calculateFertilizerCfpSimplePreview({
      fertilizerKg: amount,
      fertilizerProfile,
      factorValues: fertilizerFactorValues,
      manualFormulaInput: manualFertilizerFormulaInput,
    })
    if (!fertilizerBreakdown) {
      return {
        rowId: row.id,
        formulaLabel: row.formulaModeLabel,
        inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
        previewResultLabel: '—',
        previewResultUnitLabel: selectedUnitLabel,
        previewStatusLabel: 'ต้องมีสูตรปุ๋ย N-P2O5-K2O หรือกรอกค่าแทนทางซ้าย',
        previewStatusKind: 'blocked',
        previewFormulaText: 'fertilizerKg x [upstream + use phase]',
      }
    }

    const convertedResult = sourceKind && targetKind
      ? convertFootprintResultUnitValue(fertilizerBreakdown.totalKgco2e, sourceKind, targetKind)
      : fertilizerBreakdown.totalKgco2e
    const previewUnitLabel = targetKind ? selectedUnitLabel : defaultUnitLabel
    const previewUnitKind = targetKind ?? sourceKind
    const previewDigits = getFertilizerPreviewResultDigits(previewUnitKind)
    const baseFormulaText = `fertilizerKg * [((N/100)*${formatNumberish(fertilizerFactorValues.ureaAsNValue, 6)}) + ((P2O5/100)*${formatNumberish(fertilizerFactorValues.dapAsP2O5Value, 6)}) + ((K2O/100)*${formatNumberish(fertilizerFactorValues.kclAsK2OValue, 6)}) + ((N/100)*0.01*(44/28)*${formatNumberish(fertilizerFactorValues.gwpN2OValue, 6)})]`

    return {
      rowId: row.id,
      formulaLabel: row.formulaModeLabel,
      inputSummary: `${formatNumberish(amount, 4)} ${row.preparedUnitLabel} · สูตร ${fertilizerBreakdown.formulaLabel}`,
      previewResultValue: convertedResult,
      previewResultLabel: formatNumberish(convertedResult, previewDigits),
      previewResultUnitLabel: previewUnitLabel,
      previewStatusLabel: targetKind
        ? `Frontend preview · สูตรปุ๋ย CFP simple${fertilizerBreakdown.formulaSource === 'manual' ? ' · ใช้ค่า manual' : ''}`
        : `Frontend preview · ใช้หน่วย default ${defaultUnitLabel}${fertilizerBreakdown.formulaSource === 'manual' ? ' · ใช้ค่า manual' : ''}`,
      previewStatusKind: 'ready',
      previewFormulaText: previewUnitKind === 'tco2e' ? `(${baseFormulaText}) / 1000` : baseFormulaText,
      note: `${fertilizerBreakdown.formulaSource === 'manual' ? 'ใช้ค่า N-P2O5-K2O ที่กรอกเอง' : `สูตร ${fertilizerBreakdown.formulaLabel}`} · Urea as N ${formatNumberish(fertilizerFactorValues.ureaAsNValue, 6)} + DAP as P2O5 ${formatNumberish(fertilizerFactorValues.dapAsP2O5Value, 6)} + KCl as K2O ${formatNumberish(fertilizerFactorValues.kclAsK2OValue, 6)} + GWP N2O ${formatNumberish(fertilizerFactorValues.gwpN2OValue, 6)} · upstream ${formatNumberish(fertilizerBreakdown.upstreamKgco2e, 4)} kgCO2e + use phase ${formatNumberish(fertilizerBreakdown.usePhaseKgco2e, 4)} kgCO2e`,
    }
  }

  if (row.rowType === 'fuel') {
    if (!selectedEf || selectedEf.coef_em_factor_value_total == null) {
      return {
        rowId: row.id,
        formulaLabel: row.formulaModeLabel,
        inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
        previewResultLabel: 'รอเลือก EF',
        previewResultUnitLabel: selectedUnitLabel,
        previewStatusLabel: 'ต้องเลือก EF_total ก่อนคำนวณ',
        previewStatusKind: 'blocked',
        previewFormulaText: 'activityAmount x EF_total',
      }
    }

    const amount = row.calculationAmount
    if (amount == null || !Number.isFinite(amount)) {
      return {
        rowId: row.id,
        formulaLabel: row.formulaModeLabel,
        inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
        previewResultLabel: '—',
        previewResultUnitLabel: selectedUnitLabel,
        previewStatusLabel: 'ขาดปริมาณที่ใช้คำนวณ',
        previewStatusKind: 'blocked',
        previewFormulaText: 'activityAmount x EF_total',
      }
    }

    const baseResult = amount * Number(selectedEf.coef_em_factor_value_total)
    const efResultUnit = getEfTotalResultUnitId(selectedEf) != null
      ? unitById[getEfTotalResultUnitId(selectedEf) ?? 0]
      : undefined
    const sourceKind = getDefaultFootprintResultUnitKind(row.formulaMode)
    const convertedResult = sourceKind && targetKind
      ? convertFootprintResultUnitValue(baseResult, sourceKind, targetKind)
      : baseResult
    const previewUnitKind = targetKind ?? sourceKind
    const previewDigits = getGenericEfPreviewResultDigits(previewUnitKind)
    const previewUnitLabel = targetKind
      ? selectedUnitLabel
      : (efResultUnit ? unitLabel(efResultUnit) : defaultUnitLabel)

    return {
      rowId: row.id,
      formulaLabel: row.formulaModeLabel,
      inputSummary: `${formatNumberish(amount, 4)} ${row.preparedUnitLabel}`,
      previewResultValue: convertedResult,
      previewResultLabel: formatNumberish(convertedResult, previewDigits),
      previewResultUnitLabel: previewUnitLabel,
      previewStatusLabel: targetKind ? 'Frontend preview' : `Frontend preview · ใช้หน่วย EF/default`,
      previewStatusKind: 'ready',
      previewFormulaText: getGenericEfPreviewFormulaText(sourceKind, targetKind),
      note: (() => {
        const selectedEfLabel = selectedEf.coef_em_factor_name?.trim() || selectedEf.coef_em_factor_idCode?.trim() || `EF #${selectedEf.coefficient_emission_factor_id}`
        if (sourceKind && targetKind && sourceKind !== targetKind) {
          return `${selectedEfLabel} · preview นี้ใช้ EF_total ฐาน ${getFootprintResultUnitKindLabel(sourceKind)} แล้วแปลงเป็น ${getFootprintResultUnitKindLabel(targetKind)}`
        }
        if (sourceKind && targetKind === sourceKind && targetKind === 'kgco2e') {
          return `${selectedEfLabel} · EF_total ที่เลือกมีหน่วยผลลัพธ์ต้นทางเป็น kgCO2e อยู่แล้ว จึงใช้ค่า activityAmount x selectedEfTotal ได้ตรง ๆ`
        }
        if (efResultUnit) {
          return `${selectedEfLabel} · ระบบ preview ใช้สูตร frontend ฐาน kgCO2e แม้ EF จะแสดง result unit เป็น ${unitLabel(efResultUnit)}`
        }
        return selectedEfLabel
      })(),
    }
  }

  return {
    rowId: row.id,
    formulaLabel: row.formulaModeLabel,
    inputSummary: `${row.calculationAmountLabel} ${row.preparedUnitLabel}`,
    previewResultLabel: 'รอคำนวณจริง',
    previewResultUnitLabel: selectedUnitLabel,
    previewStatusLabel: 'จะจับคู่ EF จากฐานข้อมูลตอนคำนวณจริง',
    previewStatusKind: 'info',
    previewFormulaText: 'activityAmount x EF_total',
    note: 'แสดงหน่วยผลลัพธ์ล่วงหน้าได้ แต่ค่า EF จริงจะถูก resolve ตอนยิง calculate',
  }
}

export function CarbonFootprintQueuePage({
  mode = 'footprint',
  embedded = false,
}: {
  mode?: QueuePageMode
  embedded?: boolean
}) {
  const isPreparationMode = mode === 'preparation'
  const isEmbeddedPreparationSection = embedded && isPreparationMode
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState(isPreparationMode ? 'preparing' : 'ready')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [fertilizerKindFilter, setFertilizerKindFilter] = useState('')
  const [campFilter, setCampFilter] = useState('')
  const [preparationFilter, setPreparationFilter] = useState('')
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>([])
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFertilizerBagWeightKg, setBulkFertilizerBagWeightKg] = useState('50')
  const [bulkFertilizerUnitFactor, setBulkFertilizerUnitFactor] = useState('1')
  const [bulkUnknownFertilizerN, setBulkUnknownFertilizerN] = useState('')
  const [bulkFertilizerPreparedUnitId, setBulkFertilizerPreparedUnitId] = useState('')
  const [bulkFertilizerTargetUnitName, setBulkFertilizerTargetUnitName] = useState('kg')
  const [bulkFertilizerTargetUnitInitial, setBulkFertilizerTargetUnitInitial] = useState('kg')
  const [bulkFuelValuePerUnit, setBulkFuelValuePerUnit] = useState('1')
  const [bulkFuelPreparedUnitId, setBulkFuelPreparedUnitId] = useState('')
  const [bulkFuelPreparedUnitName, setBulkFuelPreparedUnitName] = useState('')
  const [bulkFuelPreparedUnitInitial, setBulkFuelPreparedUnitInitial] = useState('')
  const [bulkMovePreparedToReady, setBulkMovePreparedToReady] = useState(false)
  const [bulkOtherConfigs, setBulkOtherConfigs] = useState<Record<string, OtherGroupConfig>>({})
  const [bulkModalError, setBulkModalError] = useState<string | null>(null)
  const [bulkPreparationPopup, setBulkPreparationPopup] = useState<BulkPreparationPopupState>({ kind: 'hidden' })
  const [statusPopup, setStatusPopup] = useState<StatusTransitionPopupState>({ kind: 'hidden' })
  const [footprintCalculationModal, setFootprintCalculationModal] = useState<FootprintCalculationModalState>({ kind: 'hidden' })
  const [footprintResultUnitSelections, setFootprintResultUnitSelections] = useState<Partial<Record<FootprintFormulaMode, string>>>({})
  const [footprintSelectedEfIds, setFootprintSelectedEfIds] = useState<Record<number, string>>({})
  const [footprintFertilizerFactorSelections, setFootprintFertilizerFactorSelections] = useState<FertilizerFactorSelections>(EMPTY_FERTILIZER_FACTOR_SELECTIONS)
  const [footprintManualFertilizerFormulaInputs, setFootprintManualFertilizerFormulaInputs] = useState<Record<number, ManualFertilizerFormulaInput>>({})
  const [footprintFuelEfSearchInputs, setFootprintFuelEfSearchInputs] = useState<Record<number, string>>({})
  const [footprintFuelEfFocusedRowId, setFootprintFuelEfFocusedRowId] = useState<number | null>(null)
  const [footprintFertilizerFactorSearchInputs, setFootprintFertilizerFactorSearchInputs] = useState<Record<string, string>>({})
  const [footprintFertilizerFactorFocusedKey, setFootprintFertilizerFactorFocusedKey] = useState<string | null>(null)
  const [footprintModalLeftPaneWidth, setFootprintModalLeftPaneWidth] = useState(42)
  const [isFootprintModalResizing, setIsFootprintModalResizing] = useState(false)
  const [isFootprintPreviewWide, setIsFootprintPreviewWide] = useState(false)
  const [footprintEfFilterCfTypeId, setFootprintEfFilterCfTypeId] = useState('')
  const [footprintEfFilterGroupId, setFootprintEfFilterGroupId] = useState('')
  const [footprintEfFilterUnitId, setFootprintEfFilterUnitId] = useState('')
  const [footprintEfFilterSearch, setFootprintEfFilterSearch] = useState('')
  const [footprintUnitCreateMode, setFootprintUnitCreateMode] = useState<FootprintFormulaMode | null>(null)
  const [footprintNewUnitName, setFootprintNewUnitName] = useState('')
  const [footprintNewUnitInitial, setFootprintNewUnitInitial] = useState('')
  const [footprintUnitCreateError, setFootprintUnitCreateError] = useState<string | null>(null)
  const [form, setForm] = useState<PreparationForm>(emptyForm)
  const footprintPreviewLayoutRef = useRef<HTMLDivElement | null>(null)

  const { data: queue = [], isLoading, error: queueError } = useQuery({
    queryKey: ['carbon-process-queue'],
    queryFn: () => get<CarbonProcessQueueItem[]>('/activities/carbon-process-queue'),
  })
  const { data: units = [], error: unitsError } = useQuery({
    queryKey: ['units-carbon-footprint'],
    queryFn: () => get<Unit[]>('/emission-factors/units'),
  })
  const { data: headerTypes = [], error: headerTypesError } = useQuery({
    queryKey: ['header-types-carbon-footprint'],
    queryFn: () => get<HeaderType[]>('/activities/header-types'),
  })
  const { data: detailTypes = [], error: detailTypesError } = useQuery({
    queryKey: ['detail-types-carbon-footprint'],
    queryFn: () => get<DetailType[]>('/activities/detail-types'),
  })
  const { data: unitPrefixes = [], error: unitPrefixesError } = useQuery({
    queryKey: ['unit-prefixs-carbon-footprint'],
    queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs'),
  })
  const { data: efs = [], error: efsError } = useQuery({
    queryKey: ['efs-carbon-footprint'],
    queryFn: () => get<Ef[]>('/emission-factors/coefficients'),
  })
  const { data: cfTypes = [], error: cfTypesError } = useQuery({
    queryKey: ['cf-types-carbon-footprint'],
    queryFn: () => get<CfType[]>('/emission-factors/cf-types'),
  })
  const { data: gwps = [], error: gwpsError } = useQuery({
    queryKey: ['gwps-carbon-footprint'],
    queryFn: () => get<Gwp[]>('/emission-factors/gwp'),
  })
  const { data: efGroups = [], error: efGroupsError } = useQuery({
    queryKey: ['ef-groups-carbon-footprint'],
    queryFn: () => get<EfGroup[]>('/emission-factors/groups'),
  })

  const unitById = useMemo(() => Object.fromEntries(units.map((unit) => [unit.unit_id, unit])), [units])
  const prefixById = useMemo(() => Object.fromEntries(unitPrefixes.map((prefix) => [prefix.unit_prefix_id, prefix])), [unitPrefixes])
  const headerTypeMap = useMemo(
    () => Object.fromEntries(headerTypes.map((item) => [item.act_header_type_id, item.act_header_type_name_th])),
    [headerTypes],
  )
  const detailTypeMap = useMemo(
    () => Object.fromEntries(detailTypes.map((item) => [item.act_header_detail_type_id, item.act_header_detail_type_name_th])),
    [detailTypes],
  )
  const cfTypeMap = useMemo(
    () => Object.fromEntries(
      cfTypes.map((item) => [
        item.carbonfootprint_type_id,
        item.cf_type_name_short?.trim() || item.cf_type_name_th?.trim() || `#${item.carbonfootprint_type_id}`,
      ]),
    ),
    [cfTypes],
  )
  const efGroupMap = useMemo(
    () => Object.fromEntries(
      efGroups.map((item) => [
        item.group_emission_factor_id,
        item.group_emission_factor_name_short?.trim() || item.group_emission_factor_name?.trim() || `#${item.group_emission_factor_id}`,
      ]),
    ),
    [efGroups],
  )
  const efById = useMemo(
    () => Object.fromEntries(efs.map((item) => [item.coefficient_emission_factor_id, item])),
    [efs],
  )
  const gwpById = useMemo(
    () => Object.fromEntries(gwps.map((item) => [item.coefficients_emissions_factors_gwp_id, item])),
    [gwps],
  )

  const findUnit = (aliases: string[]) => units.find((unit) => {
    const names = [unit.unit_name, unit.unit_initial].map(normalizeUnitText)
    return names.some((name) => aliases.includes(name))
  })

  const kgUnit = findUnit(['kg', 'กิโลกรัม', 'kilogram', 'kilograms'])
  const literUnit = findUnit(['l', 'lit', 'liter', 'litre', 'litter', 'ลิตร'])
  const cubicMeterUnit = findUnit(['m3', 'm^3', 'm³', 'cubicmeter', 'cubicmetre', 'ลูกบาศก์เมตร'])
  const milliliterUnit = findUnit(['ml', 'milliliter', 'millilitre', 'มิลลิลิตร'])

  const getDetailUnitText = (detail?: QueueLogDetail) => (
    [detail?.units?.unit_name, detail?.units?.unit_initial, detail?.units_prefixs?.unit_prefix_name, detail?.units_prefixs?.unit_prefix_initial]
      .map(normalizeUnitText)
      .filter(Boolean)
      .join(' ')
  )

  const getDetailResourceText = (detail?: QueueLogDetail) => (
    [
      detail?.resource_used_type?.resc_used_type_name,
      getResourceItemName(detail),
      detail?.activities_fertilizers?.act_fertilizer_name,
      detail?.activities_equipments?.act_equipment_name,
      detail?.activities_chemiscals?.act_chemiscal_name,
      detail?.activities_resourceOther?.act_resourceOther_name,
      detail?.units?.unit_name,
      detail?.units?.unit_initial,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  )

  const isBagUnitText = (value: string) => /sck|sack|bag|กระสอบ/.test(value)
  const isLiterUnitText = (value: string) => /(^|\s)(l|lit|liter|litre|litter|ลิตร)(\s|$)/.test(value)
  const isCubicMeterUnitText = (value: string) => /m3|m\^3|m³|cubicmeter|cubicmetre|ลูกบาศก์เมตร/.test(value)
  const isFuelText = (value: string) => /น้ำมัน|fuel|diesel|gasohol|benzene|เบนซิน|lit|liter|litre|litter|ลิตร|m3|m\^3|m³|ลูกบาศก์เมตร/.test(value)

  const getRowTypeFromDetail = (detail?: QueueLogDetail): PreparationRowType => {
    const unitText = getDetailUnitText(detail)
    const resourceText = getDetailResourceText(detail)

    if (detail?.act_fertilizer_id != null || /ปุ๋ย|fertilizer/.test(resourceText) || isBagUnitText(unitText)) {
      return 'fertilizer'
    }

    if (isFuelText(resourceText)) {
      return 'fuel'
    }

    return 'other'
  }

  const rows = useMemo<QueueRow[]>(() => queue.map((item) => {
    const detail = item.log_activities_detail
    const preparationInfo = parsePreparationInfo(item.carbon_process_queue_info)
    const statusRawName = getQueueStatusName(item)
    const statusId = item.log_act_detail_calStatus_id ?? detail?.log_act_detail_calStatus_id
    const campId = item.land_camp_id ?? detail?.activities_header?.lands?.land_camp_id
    const landLabel = detail?.activities_header?.lands?.land_code
      ?? detail?.activities_header?.lands?.name
      ?? (item.land_id != null ? `#${item.land_id}` : '—')
    const sourceUnit = unitById[preparationInfo.sourceUnitId ?? detail?.unit_id ?? 0]
    const preparedUnitId = detail?.unit_id
    const preparedPrefixId = detail?.unit_prefix_id
    const preparedUnit = unitById[preparedUnitId ?? 0]
    const sourcePrefix = prefixById[preparationInfo.sourceUnitPrefixId ?? detail?.unit_prefix_id ?? 0]
    const preparedPrefix = prefixById[preparedPrefixId ?? 0]
    const sourceVolumeAll = preparationInfo.sourceVolumeAll ?? detail?.log_act_detail_volumeAll
    const preparedVolumeAll = detail?.log_act_detail_volumeAll
    const quantityUnitLabel = [
      prefixLabel(detail?.units_prefixs),
      unitLabel(detail?.units),
    ].filter((value) => value && value !== '—').join(' ') || '—'
    const sourceUnitLabel = [
      prefixLabel(sourcePrefix) !== '—' ? prefixLabel(sourcePrefix) : '',
      unitLabel(sourceUnit),
    ].filter(Boolean).join(' ')
    const preparedUnitLabel = [
      prefixLabel(preparedPrefix) !== '—' ? prefixLabel(preparedPrefix) : '',
      unitLabel(preparedUnit),
    ].filter(Boolean).join(' ')
    const rowType = getRowTypeFromDetail(detail)
    const formulaMode = getFootprintFormulaMode(rowType, getDetailResourceText(detail))
    const calculationAmount = preparedVolumeAll ?? sourceVolumeAll
    const normalizedNValue = item.N ?? preparationInfo.soilN ?? null
    const inputStatus = getFootprintInputStatus({
      formulaMode,
      rowType,
      resourceItemName: getResourceItemName(detail),
      amount: calculationAmount,
      unitLabelText: preparedUnitLabel,
      nValue: normalizedNValue,
    })
    const resultUnitLabel = getCarbonQueueResultUnitLabel(item)
    const isPrepared = Boolean(
      preparationInfo.preparedAt
      || preparationInfo.conversionFactor != null
      || preparationInfo.fertilizerBagWeightKg != null
      || preparationInfo.fertilizerPrepareType
      || preparationInfo.soilN != null
      || preparationInfo.soilSocBaseline != null
      || preparationInfo.soilSocProject != null
      || preparationInfo.soilSampleDate
      || preparationInfo.note,
    )
    const hasPreparedChange = Boolean(
      (preparationInfo.sourceUnitId != null && preparationInfo.sourceUnitId !== detail?.unit_id)
      || (preparationInfo.sourceUnitPrefixId != null && preparationInfo.sourceUnitPrefixId !== detail?.unit_prefix_id)
      || (preparationInfo.sourceVolumeAll != null && preparationInfo.sourceVolumeAll !== detail?.log_act_detail_volumeAll)
    )
    const hasSoilData = item.N != null || preparationInfo.soilSocBaseline != null || preparationInfo.soilSocProject != null || Boolean(preparationInfo.soilSampleDate)
    const preparationStateLabel = !isPrepared
      ? 'รอเตรียมข้อมูล'
      : hasPreparedChange
        ? 'แปลงหน่วยแล้ว'
        : 'เตรียมข้อมูลแล้ว'
    const preparedAtLabel = preparationInfo.preparedAt ? formatBangkokDateTime(preparationInfo.preparedAt) : '—'

    return {
      id: item.carbon_process_queue_id,
      checked: selectedQueueIds.includes(item.carbon_process_queue_id),
      detailId: detail?.log_act_detail_id ?? item.log_act_detail_id ?? 0,
      dateLabel: formatBangkokDate(item.carbon_process_queue_dateWork ?? detail?.log_act_detail_create_at ?? detail?.activities_header?.activities_header_startDate),
      headerLabel: detail?.activities_header?.activities_header_idCode ?? (detail?.activities_header_id != null ? `#${detail.activities_header_id}` : '—'),
      activityTypeName: headerTypeMap[detail?.act_header_type_id ?? 0] ?? (detail?.act_header_type_id != null ? String(detail.act_header_type_id) : '—'),
      detailTypeName: detailTypeMap[detail?.act_header_detail_type_id ?? 0] ?? (detail?.act_header_detail_type_id != null ? String(detail.act_header_detail_type_id) : '—'),
      campId: campId != null ? String(campId) : '',
      campLabel: item.lands_camps?.land_camp_name ?? detail?.activities_header?.lands?.lands_camps?.land_camp_name ?? '—',
      landLabel,
      resourceTypeId: detail?.resource_used_type_id != null ? String(detail.resource_used_type_id) : '',
      resourceTypeName: detail?.resource_used_type?.resc_used_type_name ?? '—',
      resourceItemName: getResourceItemName(detail),
      formulaMode,
      formulaModeLabel: getFootprintFormulaModeLabel(formulaMode),
      inputStatusKind: inputStatus.kind,
      inputStatusLabel: inputStatus.label,
      calculationAmount,
      calculationAmountLabel: formatNumber(calculationAmount),
      nValue: normalizedNValue,
      nValueLabel: normalizedNValue != null ? formatNumber(normalizedNValue, 3) : 'null',
      resultValueLabel: formatNumberish(item.carbon_process_queue_resultValue, 4),
      resultUnitIdLabel: item.unit_id_resultValue != null ? String(item.unit_id_resultValue) : '—',
      resultUnitLabel,
      retryCountLabel: item.carbon_process_queue_retry_count != null ? String(item.carbon_process_queue_retry_count) : '—',
      errorMessageLabel: item.carbon_process_queue_error_message?.trim() || '—',
      createAtLabel: item.carbon_process_queue_create_at ? formatBangkokDateTime(item.carbon_process_queue_create_at) : '—',
      startedAtLabel: item.carbon_process_queue_started_at ? formatBangkokDateTime(item.carbon_process_queue_started_at) : '—',
      endedAtLabel: item.carbon_process_queue_ended_at ? formatBangkokDateTime(item.carbon_process_queue_ended_at) : '—',
      quantityUnitLabel,
      quantityLabel: formatNumber(detail?.log_act_detail_quatity),
      sourceAmountLabel: formatNumber(sourceVolumeAll),
      sourceUnitLabel,
      preparedAmountLabel: isPrepared ? formatNumber(preparedVolumeAll) : '—',
      preparedUnitLabel: isPrepared ? preparedUnitLabel : '—',
      preparationStateLabel,
      preparedAtLabel,
      hasPreparedChange,
      statusLabel: getActivityCalStatusLabel(statusRawName, statusId),
      statusRawName,
      statusKind: getActivityCalStatusKind(statusRawName, statusId),
      rowType,
      preparationType: preparationInfo.fertilizerPrepareType ?? '',
      isPrepared,
      hasSoilData,
      preparationInfo,
      original: item,
    }
  }), [detailTypeMap, headerTypeMap, prefixById, queue, selectedQueueIds, unitById])

  const scopedRows = isPreparationMode
    ? rows
    : rows.filter((row) => ['ready', 'standardDone', 'cfpDone', 'error'].includes(row.statusKind))

  const selectedResourceTypeRows = resourceTypeFilter
    ? scopedRows.filter((row) => row.resourceTypeId === resourceTypeFilter)
    : []
  const showFertilizerKindFilter = selectedResourceTypeRows.some((row) => row.rowType === 'fertilizer')

  const filteredRows = scopedRows.filter((row) =>
    (!statusFilter || row.statusKind === statusFilter)
    && (!resourceTypeFilter || row.resourceTypeId === resourceTypeFilter)
    && (!fertilizerKindFilter || (
      row.rowType === 'fertilizer'
      && getFertilizerNitrogenProfile(row.resourceItemName).kind === fertilizerKindFilter
    ))
    && (!campFilter || row.campId === campFilter)
    && (!preparationFilter || (
      preparationFilter === 'prepared'
        ? row.isPrepared
        : preparationFilter === 'pending'
          ? !row.isPrepared
          : row.preparationType === preparationFilter
    )),
  )

  const resourceTypeOptions = Array.from(new Map(scopedRows.filter((row) => row.resourceTypeId).map((row) => [row.resourceTypeId, row.resourceTypeName])).entries())
  const campOptions = Array.from(new Map(scopedRows.filter((row) => row.campId).map((row) => [row.campId, row.campLabel])).entries())
  const selectedQueueRows = filteredRows.filter((row) => selectedQueueIds.includes(row.id))
  const readyEligibleRows = selectedQueueRows.filter((row) => row.statusKind === 'preparing' && row.isPrepared)
  const readyEligibleDetailIds = readyEligibleRows.map((row) => row.detailId)
  const bulkReadyTransitionDetailIds = Array.from(new Set(
    selectedQueueRows
      .filter((row) => row.statusKind === 'preparing' && row.detailId > 0)
      .map((row) => row.detailId),
  ))
  const importedEligibleRows = selectedQueueRows.filter((row) => row.statusKind !== 'imported')
  const importedEligibleDetailIds = importedEligibleRows.map((row) => row.detailId)
  const footprintCalculateRows = selectedQueueRows.filter(canRunFootprintCalculation)
  const footprintAllCandidateRows = filteredRows.filter((row) => row.statusKind === 'ready')
  const footprintCalculateAllRows = footprintAllCandidateRows.filter(canRunFootprintCalculation)
  const footprintBlockedSelectedCount = selectedQueueRows.filter((row) => row.inputStatusKind === 'blocked').length
  const selectedUnitSummary = Array.from(
    selectedQueueRows.reduce((summary, row) => {
      summary.set(row.quantityUnitLabel, (summary.get(row.quantityUnitLabel) ?? 0) + 1)
      return summary
    }, new Map<string, number>()).entries(),
  )

  const pendingCount = scopedRows.filter((row) => !row.isPrepared).length
  const preparedCount = scopedRows.filter((row) => row.isPrepared).length
  const changedCount = scopedRows.filter((row) => row.hasPreparedChange).length
  const isFootprintCalculating = footprintCalculationModal.kind === 'running'
  const footprintModalRows = footprintCalculationModal.kind === 'hidden' ? [] : footprintCalculationModal.rows
  const fertilizerModalRows = footprintModalRows.filter((row) => row.formulaMode === 'fertilizer_n2o')
  const fertilizerRowsMissingDetectedFormula = fertilizerModalRows.filter((row) => {
    const profile = getFertilizerNitrogenProfile(row.resourceItemName)
    return !(
      profile.kind === 'chemical'
      && profile.detectedN != null
      && profile.detectedP2O5 != null
      && profile.detectedK2O != null
      && profile.fillerPercent != null
    )
  })
  const fertilizerFactorSelectableEfs = useMemo(
    () => efs.filter((item) => item.coef_em_factor_value_total != null),
    [efs],
  )
  const resolvedFertilizerFactorValues = useMemo(
    () => resolveFertilizerFactorValues(footprintFertilizerFactorSelections, efById, gwpById),
    [efById, footprintFertilizerFactorSelections, gwpById],
  )
  const footprintModalRowPreviewById = useMemo<Record<number, FootprintRowPreview>>(() => (
    Object.fromEntries(footprintModalRows.map((row) => {
      const selectedResultUnitId = footprintResultUnitSelections[row.formulaMode]
      const selectedResultUnit = selectedResultUnitId ? unitById[Number(selectedResultUnitId)] : undefined
      const selectedEfId = footprintSelectedEfIds[row.id]
      const selectedEf = selectedEfId ? efById[Number(selectedEfId)] : undefined
      return [
        row.id,
        buildFootprintRowPreview({
          row,
          selectedResultUnit,
          selectedEf,
          fertilizerFactorValues: resolvedFertilizerFactorValues,
          manualFertilizerFormulaInput: footprintManualFertilizerFormulaInputs[row.id],
          unitById,
        }),
      ]
    }))
  ), [efById, footprintManualFertilizerFormulaInputs, footprintModalRows, footprintResultUnitSelections, footprintSelectedEfIds, resolvedFertilizerFactorValues, unitById])
  const {
    readyRows: footprintModalReadyRows,
    blockedRows: footprintModalBlockedRows,
    unsupportedRows: footprintModalUnsupportedRows,
  } = useMemo(() => {
    const unsupportedRows = footprintModalRows.filter((row) => footprintModalRowPreviewById[row.id]?.previewStatusKind === 'unsupported')
    const blockedRows = footprintModalRows.filter((row) => {
      if (unsupportedRows.includes(row)) return false
      const preview = footprintModalRowPreviewById[row.id]
      return preview?.previewStatusKind === 'blocked'
    })
    const readyRows = footprintModalRows.filter((row) => !unsupportedRows.includes(row) && !blockedRows.includes(row))
    return { readyRows, blockedRows, unsupportedRows }
  }, [footprintModalRowPreviewById, footprintModalRows])
  const footprintModalFuelRows = footprintModalRows.filter((row) => row.rowType === 'fuel' && row.formulaMode === 'generic_ef' && ['ready', 'error'].includes(row.statusKind))
  const footprintModalFormulaSummary = FOOTPRINT_FORMULA_MODES.map((mode) => ({
    mode,
    label: getFootprintFormulaModeLabel(mode),
    count: footprintModalRows.filter((row) => row.formulaMode === mode).length,
    readyCount: footprintModalReadyRows.filter((row) => row.formulaMode === mode).length,
  }))
  const filteredFuelEfGroups = useMemo(() => {
    if (!footprintEfFilterCfTypeId) return efGroups
    return efGroups.filter((item) => item.carbonfootprint_type_id === Number(footprintEfFilterCfTypeId))
  }, [efGroups, footprintEfFilterCfTypeId])
  const filteredFuelEfs = useMemo(() => {
    const search = footprintEfFilterSearch.trim().toLowerCase()

    return efs.filter((item) => {
      const matchesCfType = !footprintEfFilterCfTypeId || item.carbonfootprint_type_id === Number(footprintEfFilterCfTypeId)
      const matchesGroup = !footprintEfFilterGroupId || item.group_emission_factor_id === Number(footprintEfFilterGroupId)
      const matchesUnit = !footprintEfFilterUnitId || getEfInputUnitId(item) === Number(footprintEfFilterUnitId)
      const inputUnit = unitById[getEfInputUnitId(item) ?? 0]
      const resultUnit = unitById[getEfTotalResultUnitId(item) ?? 0]
      const matchesSearch = !search || [
        item.coef_em_factor_idCode,
        item.coef_em_factor_name,
        item.coef_em_factor_info,
        item.carbonfootprint_type_id != null ? cfTypeMap[item.carbonfootprint_type_id] : undefined,
        item.group_emission_factor_id != null ? efGroupMap[item.group_emission_factor_id] : undefined,
        inputUnit?.unit_name,
        inputUnit?.unit_initial,
        resultUnit?.unit_name,
        resultUnit?.unit_initial,
      ].some((value) => value?.toLowerCase().includes(search))

      return matchesCfType && matchesGroup && matchesUnit && matchesSearch
    })
  }, [efs, footprintEfFilterCfTypeId, footprintEfFilterGroupId, footprintEfFilterUnitId, footprintEfFilterSearch, cfTypeMap, efGroupMap, unitById])
  const selectableFuelEfs = filteredFuelEfs.filter((item) => item.coef_em_factor_value_total != null)
  const supportedFootprintResultUnits = useMemo(() => (
    units.filter((unit) => Boolean(resolveFootprintResultUnitKindFromNames([unit.unit_name, unit.unit_initial])))
  ), [units])
  const footprintModalFuelRowsMissingEf = footprintModalFuelRows.filter((row) => !footprintSelectedEfIds[row.id])
  const footprintManualFertilizerFormulaRowsMissingInput = fertilizerRowsMissingDetectedFormula.filter((row) => {
    const preview = footprintModalRowPreviewById[row.id]
    return preview?.previewStatusKind === 'blocked'
  })
  const footprintPreviewCodeGroups = useMemo(() => (
    FOOTPRINT_FORMULA_MODES.map((mode) => {
      const modeRows = footprintModalRows.filter((row) => row.formulaMode === mode)
      if (!modeRows.length) return null

      return {
        mode,
        label: getFootprintFormulaModeLabel(mode),
        rows: modeRows.slice(0, 2).map((row) => {
          const preview = footprintModalRowPreviewById[row.id]
          const selectedEfId = footprintSelectedEfIds[row.id]
          const selectedEf = selectedEfId ? efById[Number(selectedEfId)] : undefined
          const manualFormulaInput = footprintManualFertilizerFormulaInputs[row.id]
          return { row, preview, selectedEf, fertilizerFactorValues: resolvedFertilizerFactorValues, manualFormulaInput }
        }),
        hiddenCount: Math.max(modeRows.length - 2, 0),
      }
    }).filter(Boolean)
  ), [efById, footprintManualFertilizerFormulaInputs, footprintModalRowPreviewById, footprintModalRows, footprintSelectedEfIds, resolvedFertilizerFactorValues])

  const pageQueryItems = [
    { label: 'Carbon process queue', error: queueError },
    { label: 'Emission Factors', error: efsError },
    { label: 'GWP', error: gwpsError },
    { label: 'CF Types', error: cfTypesError },
    { label: 'กลุ่ม EF', error: efGroupsError },
    { label: 'หน่วยนับ', error: unitsError },
    { label: 'ประเภทกิจกรรม', error: headerTypesError },
    { label: 'รายละเอียดกิจกรรม', error: detailTypesError },
    { label: 'Prefix หน่วย', error: unitPrefixesError },
  ]

  const setFormValue = (key: keyof PreparationForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const getOtherGroupKey = (row: Pick<QueueRow, 'resourceTypeId' | 'resourceTypeName'>) => (
    row.resourceTypeId || `other:${row.resourceTypeName || 'uncategorized'}`
  )

  const getOtherGroupLabel = (row: Pick<QueueRow, 'resourceTypeName'>) => {
    const label = row.resourceTypeName?.trim()
    return label && label !== '—' ? label : 'ประเภทอื่น'
  }

  const getOtherGroupConfig = (row: Pick<QueueRow, 'resourceTypeId' | 'resourceTypeName'>): OtherGroupConfig => (
    bulkOtherConfigs[getOtherGroupKey(row)] ?? DEFAULT_OTHER_GROUP_CONFIG
  )

  const updateOtherGroupConfig = (groupKey: string, patch: Partial<OtherGroupConfig>) => {
    setBulkOtherConfigs((prev) => ({
      ...prev,
      [groupKey]: {
        ...DEFAULT_OTHER_GROUP_CONFIG,
        ...(prev[groupKey] ?? {}),
        ...patch,
      },
    }))
  }

  const resolveBulkPreparedUnit = ({
    preparedUnitId,
    preparedUnitName,
    preparedUnitInitial,
    fallbackUnit,
    fallbackLabel,
  }: {
    preparedUnitId?: string
    preparedUnitName?: string
    preparedUnitInitial?: string
    fallbackUnit?: Unit
    fallbackLabel: string
  }) => {
    const selectedUnit = preparedUnitId ? unitById[Number(preparedUnitId)] : undefined
    if (selectedUnit) {
      return {
        preparedUnitId: selectedUnit.unit_id,
        preparedUnitName: undefined,
        preparedUnitInitial: undefined,
        preparedUnitLabel: unitLabel(selectedUnit),
      }
    }

    const customName = preparedUnitName?.trim() ?? ''
    const customInitial = preparedUnitInitial?.trim() ?? ''
    if (customName || customInitial) {
      return {
        preparedUnitId: undefined,
        preparedUnitName: customName || customInitial,
        preparedUnitInitial: customInitial || customName,
        preparedUnitLabel: customInitial || customName,
      }
    }

    if (fallbackUnit?.unit_id != null) {
      return {
        preparedUnitId: fallbackUnit.unit_id,
        preparedUnitName: undefined,
        preparedUnitInitial: undefined,
        preparedUnitLabel: unitLabel(fallbackUnit),
      }
    }

    return {
      preparedUnitId: undefined,
      preparedUnitName: undefined,
      preparedUnitInitial: undefined,
      preparedUnitLabel: fallbackLabel,
    }
  }

  const toggleSelectedQueueRow = (id: number, checked: boolean) => {
    setSelectedQueueIds((prev) => (
      checked
        ? Array.from(new Set([...prev, id]))
        : prev.filter((item) => item !== id)
    ))
  }

  const selectVisibleQueueRows = () => {
    setSelectedQueueIds((prev) => Array.from(new Set([...prev, ...filteredRows.map((row) => row.id)])))
  }

  const clearSelectedQueueRows = () => setSelectedQueueIds([])
  const closeBulkModal = () => {
    if (bulkPreparationPopup.kind === 'loading') return
    setBulkModalOpen(false)
    setBulkModalError(null)
    setBulkPreparationPopup({ kind: 'hidden' })
    setBulkMovePreparedToReady(false)
  }

  const getRowUnitText = (row: QueueRow) => {
    const detail = row.original.log_activities_detail
    return [detail?.units?.unit_name, detail?.units?.unit_initial, row.sourceUnitLabel, row.quantityUnitLabel]
      .map(normalizeUnitText)
      .filter(Boolean)
      .join(' ')
  }

  const getRowCalculationUnitId = (row: QueueRow) => (
    row.preparationInfo.preparedUnitId
    ?? row.original.log_activities_detail?.unit_id
  )

  const getRowResourceText = (row: QueueRow) => (
    `${row.resourceTypeName} ${row.resourceItemName} ${row.quantityUnitLabel}`.toLowerCase()
  )

  const isFuelRow = (row: QueueRow) => row.rowType === 'fuel' || /น้ำมัน|fuel|diesel|gasohol|benzene|เบนซิน|lit|liter|litre|litter|ลิตร|m3|m\^3|m³|ลูกบาศก์เมตร/.test(getRowResourceText(row))
  const isLiterRow = (row: QueueRow) => isLiterUnitText(getRowUnitText(row))
  const isCubicMeterRow = (row: QueueRow) => isCubicMeterUnitText(getRowUnitText(row))

  const buildBulkConversionPreview = (row: QueueRow): BulkConversionPreview => {
    const detail = row.original.log_activities_detail
    const quantity = detail?.log_act_detail_quatity ?? 0
    const sourceVolumeAll = row.preparationInfo.sourceVolumeAll ?? detail?.log_act_detail_volumeAll ?? 0
    const bagWeightKg = toNumberOrUndefined(bulkFertilizerBagWeightKg) ?? 50
    const currentUnitLabel = row.quantityUnitLabel
    const preparedVolumePerUnit = calculatePreparedVolumePerUnit(quantity, sourceVolumeAll)

    if (row.rowType === 'fertilizer') {
      const fertilizerUnitFactor = toNumberOrUndefined(bulkFertilizerUnitFactor) ?? 1
      const fertilizerBaseKg = quantity * bagWeightKg
      const fertilizerPreparedVolumeAll = fertilizerBaseKg * fertilizerUnitFactor
      const fertilizerPreparedVolumePerUnit = bagWeightKg * fertilizerUnitFactor
      const fertilizerNitrogenProfile = getFertilizerNitrogenProfile(row.resourceItemName)
      const unknownFertilizerN = toNumberOrUndefined(bulkUnknownFertilizerN)
      const resolvedFertilizerN = fertilizerNitrogenProfile.kind === 'chemical'
        ? fertilizerNitrogenProfile.detectedN
        : fertilizerNitrogenProfile.kind === 'organic'
          ? null
          : unknownFertilizerN
      const fertilizerTarget = resolveBulkPreparedUnit({
        preparedUnitId: bulkFertilizerPreparedUnitId,
        preparedUnitName: bulkFertilizerTargetUnitName,
        preparedUnitInitial: bulkFertilizerTargetUnitInitial,
        fallbackUnit: kgUnit,
        fallbackLabel: bulkFertilizerTargetUnitInitial.trim() || bulkFertilizerTargetUnitName.trim() || 'kg',
      })

      return {
        row,
        rowType: 'fertilizer',
        ruleLabel: `ปุ๋ย: จำนวน x ปริมาณต่อจำนวน x ตัวคูณแปลงหน่วย -> ${fertilizerTarget.preparedUnitLabel}`,
        currentUnitLabel,
        formulaText: `(${formatNumber(quantity)} * ${formatNumber(bagWeightKg)}) * ${formatNumber(fertilizerUnitFactor, 6)} = ${formatNumber(fertilizerPreparedVolumeAll)} ${fertilizerTarget.preparedUnitLabel}`,
        preparedUnitLabel: fertilizerTarget.preparedUnitLabel,
        preparedVolumeAll: fertilizerPreparedVolumeAll,
        payload: {
          preparedUnitId: fertilizerTarget.preparedUnitId,
          preparedUnitName: fertilizerTarget.preparedUnitName,
          preparedUnitInitial: fertilizerTarget.preparedUnitInitial,
          preparedVolumePerUnit: fertilizerPreparedVolumePerUnit,
          preparedVolumeAll: fertilizerPreparedVolumeAll,
          conversionFactor: fertilizerUnitFactor,
          fertilizerBagWeightKg: bagWeightKg,
          fertilizerPrepareType: 'fertilizer',
          soilN: resolvedFertilizerN,
          note: `Bulk fertilizer conversion: (${quantity} x ${bagWeightKg}) x ${fertilizerUnitFactor} = ${fertilizerPreparedVolumeAll} ${fertilizerTarget.preparedUnitLabel}`,
        },
      }
    }

    if (row.rowType === 'fuel' || isFuelRow(row)) {
      const fuelTarget = resolveBulkPreparedUnit({
        preparedUnitId: bulkFuelPreparedUnitId,
        preparedUnitName: bulkFuelPreparedUnitName,
        preparedUnitInitial: bulkFuelPreparedUnitInitial,
        fallbackUnit: detail?.unit_id != null ? unitById[detail.unit_id] : undefined,
        fallbackLabel: currentUnitLabel,
      })
      const fuelValuePerUnit = toNumberOrUndefined(bulkFuelValuePerUnit) ?? detail?.log_act_detail_volumePerUnit ?? 1
      const preparedVolumeAll = quantity * fuelValuePerUnit

      return {
        row,
        rowType: 'fuel',
        ruleLabel: `น้ำมัน: จำนวน x ค่าหลังแปลงต่อจำนวน -> ${fuelTarget.preparedUnitLabel}`,
        currentUnitLabel,
        formulaText: `${formatNumber(quantity)} * ${formatNumber(fuelValuePerUnit, 6)} = ${formatNumber(preparedVolumeAll)} ${fuelTarget.preparedUnitLabel}`,
        preparedUnitLabel: fuelTarget.preparedUnitLabel,
        preparedVolumeAll,
        payload: {
          preparedUnitId: fuelTarget.preparedUnitId,
          preparedUnitName: fuelTarget.preparedUnitName,
          preparedUnitInitial: fuelTarget.preparedUnitInitial,
          preparedVolumePerUnit: fuelValuePerUnit,
          preparedVolumeAll,
          conversionFactor: fuelValuePerUnit,
          fertilizerPrepareType: 'fuel',
          note: `Bulk fuel conversion: ${quantity} x ${fuelValuePerUnit} = ${preparedVolumeAll} ${fuelTarget.preparedUnitLabel}`,
        },
      }
    }

    const otherConfig = getOtherGroupConfig(row)
    const otherFactor = otherConfig.mode === 'factor'
      ? (toNumberOrUndefined(otherConfig.conversionFactor) ?? 1)
      : 1
    const otherPreparedVolumeAll = sourceVolumeAll * otherFactor
    const targetPrefix = otherConfig.preparedUnitPrefixId ? prefixById[Number(otherConfig.preparedUnitPrefixId)] : undefined
    const otherTarget = resolveBulkPreparedUnit({
      preparedUnitId: otherConfig.preparedUnitId,
      preparedUnitName: otherConfig.preparedUnitName,
      preparedUnitInitial: otherConfig.preparedUnitInitial,
      fallbackUnit: detail?.unit_id != null ? unitById[detail.unit_id] : undefined,
      fallbackLabel: currentUnitLabel,
    })
    const targetUnitLabel = [
      targetPrefix ? prefixLabel(targetPrefix) : '',
      otherTarget.preparedUnitLabel,
    ].filter(Boolean).join(' ')

    return {
      row,
      rowType: 'other',
      ruleLabel: otherConfig.mode === 'factor'
        ? `${getOtherGroupLabel(row)}: แปลงด้วยตัวคูณ`
        : `${getOtherGroupLabel(row)}: คงหน่วยเดิม`,
      currentUnitLabel,
      formulaText: `${formatNumber(sourceVolumeAll)} * ${formatNumber(otherFactor, 6)} = ${formatNumber(otherPreparedVolumeAll)} ${targetUnitLabel}`,
      preparedUnitLabel: targetUnitLabel,
      preparedVolumeAll: otherPreparedVolumeAll,
      payload: {
        preparedUnitId: otherTarget.preparedUnitId ?? detail?.unit_id,
        preparedUnitName: otherTarget.preparedUnitName,
        preparedUnitInitial: otherTarget.preparedUnitInitial,
        preparedUnitPrefixId: targetPrefix?.unit_prefix_id ?? detail?.unit_prefix_id,
        preparedVolumePerUnit: otherConfig.mode === 'factor' ? calculatePreparedVolumePerUnit(quantity, otherPreparedVolumeAll) ?? preparedVolumePerUnit : undefined,
        preparedVolumeAll: otherPreparedVolumeAll,
        conversionFactor: otherFactor,
        fertilizerPrepareType: 'other',
        note: otherConfig.mode === 'factor'
          ? `Bulk other conversion: ${sourceVolumeAll} ${currentUnitLabel} * ${otherFactor} = ${otherPreparedVolumeAll} ${targetUnitLabel}`
          : `Bulk keep unit: ${sourceVolumeAll} ${currentUnitLabel}`,
      },
    }
  }

  const bulkConversionPreview = selectedQueueRows.map(buildBulkConversionPreview)
  const selectedFertilizerRows = selectedQueueRows.filter((row) => row.rowType === 'fertilizer')
  const selectedFuelRows = selectedQueueRows.filter((row) => row.rowType === 'fuel')
  const selectedOtherRows = selectedQueueRows.filter((row) => row.rowType === 'other')
  const fertilizerNitrogenProfiles = selectedFertilizerRows.map((row) => ({
    row,
    profile: getFertilizerNitrogenProfile(row.resourceItemName),
  }))
  const chemicalFertilizerCount = fertilizerNitrogenProfiles.filter((item) => item.profile.kind === 'chemical').length
  const organicFertilizerCount = fertilizerNitrogenProfiles.filter((item) => item.profile.kind === 'organic').length
  const unknownFertilizerCount = fertilizerNitrogenProfiles.filter((item) => item.profile.kind === 'unknown').length
  const otherGroupEntries = Array.from(
    selectedOtherRows.reduce((groups, row) => {
      const groupKey = getOtherGroupKey(row)
      const existing = groups.get(groupKey)
      if (existing) {
        existing.rows.push(row)
        return groups
      }

      groups.set(groupKey, {
        key: groupKey,
        label: getOtherGroupLabel(row),
        rows: [row],
      })
      return groups
    }, new Map<string, { key: string; label: string; rows: QueueRow[] }>()),
  ).map(([, value]) => value)
  const bulkFertilizerPreview = bulkConversionPreview.filter((item) => item.rowType === 'fertilizer')
  const bulkFuelPreview = bulkConversionPreview.filter((item) => item.rowType === 'fuel')
  const bulkOtherPreview = bulkConversionPreview.filter((item) => item.rowType === 'other')
  const bulkOtherPreviewGroups = otherGroupEntries.map((group) => ({
    ...group,
    items: bulkOtherPreview.filter((item) => getOtherGroupKey(item.row) === group.key),
  }))
  const getBulkFertilizerPreviewNLabel = (row: QueueRow) => {
    const profile = getFertilizerNitrogenProfile(row.resourceItemName)
    if (profile.kind === 'chemical') {
      return profile.detectedN != null ? formatNumber(profile.detectedN, 3) : 'null'
    }
    if (profile.kind === 'organic') {
      return 'null'
    }

    const manualN = toNumberOrUndefined(bulkUnknownFertilizerN)
    return manualN != null ? formatNumber(manualN, 3) : 'null'
  }
  const getBulkFuelPresetValue = (target: 'liter' | 'milliliter') => {
    const hasLiter = selectedFuelRows.some(isLiterRow)
    const hasCubicMeter = selectedFuelRows.some(isCubicMeterRow)
    if (target === 'milliliter') return '0.001'
    return hasCubicMeter && !hasLiter ? '1000' : '1'
  }

  const applyBulkFuelPreset = (target: 'liter' | 'milliliter') => {
    const targetUnit = target === 'liter' ? literUnit : milliliterUnit
    setBulkFuelValuePerUnit(getBulkFuelPresetValue(target))
    setBulkFuelPreparedUnitId(targetUnit?.unit_id != null ? String(targetUnit.unit_id) : '')
    if (target === 'milliliter' && !targetUnit?.unit_id) {
      setBulkFuelPreparedUnitName('milliliter')
      setBulkFuelPreparedUnitInitial('ml')
      return
    }
    setBulkFuelPreparedUnitName('')
    setBulkFuelPreparedUnitInitial('')
  }

  useEffect(() => {
    if (bulkPreparationPopup.kind !== 'success') return undefined

    const timer = window.setTimeout(() => {
      setBulkPreparationPopup((prev) => {
        if (prev.kind !== 'success') return prev
        if (prev.countdown <= 1) {
          setBulkModalOpen(false)
          setSelectedQueueIds([])
          return { kind: 'hidden' }
        }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [bulkPreparationPopup])

  useEffect(() => {
    if (!kgUnit?.unit_id || bulkFertilizerPreparedUnitId) return
    setBulkFertilizerPreparedUnitId(String(kgUnit.unit_id))
  }, [bulkFertilizerPreparedUnitId, kgUnit])

  useEffect(() => {
    if (statusPopup.kind !== 'success') return undefined

    const timer = window.setTimeout(() => {
      setStatusPopup((prev) => {
        if (prev.kind !== 'success') return prev
        if (prev.countdown <= 1) return { kind: 'hidden' }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [statusPopup])

  useEffect(() => {
    if (footprintCalculationModal.kind !== 'complete' || footprintCalculationModal.countdown == null) return undefined

    const timer = window.setTimeout(() => {
      setFootprintCalculationModal((prev) => {
        if (prev.kind !== 'complete' || prev.countdown == null) return prev
        if (prev.countdown <= 1) return { kind: 'hidden' }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [footprintCalculationModal])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    const applyViewportMode = () => {
      setIsFootprintPreviewWide(media.matches)
      if (!media.matches) {
        setIsFootprintModalResizing(false)
      }
    }

    applyViewportMode()
    media.addEventListener('change', applyViewportMode)
    return () => media.removeEventListener('change', applyViewportMode)
  }, [])

  useEffect(() => {
    if (!isFootprintModalResizing || !isFootprintPreviewWide) return undefined

    const handlePointerMove = (event: MouseEvent) => {
      const container = footprintPreviewLayoutRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      if (!rect.width) return

      const nextWidthPercent = ((event.clientX - rect.left) / rect.width) * 100
      const clampedWidthPercent = Math.min(62, Math.max(32, nextWidthPercent))
      setFootprintModalLeftPaneWidth(clampedWidthPercent)
    }

    const handlePointerUp = () => {
      setIsFootprintModalResizing(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [isFootprintModalResizing, isFootprintPreviewWide])

  useEffect(() => {
    if (isPreparationMode || footprintCalculationModal.kind === 'hidden' || !units.length) return

    setFootprintResultUnitSelections((prev) => {
      let changed = false
      const next = { ...prev }

      FOOTPRINT_SUPPORTED_FORMULA_MODES.forEach((mode) => {
        const modeRows = footprintModalRows.filter((row) => row.formulaMode === mode)
        if (!modeRows.length || next[mode]) return

        const existingUnitId = modeRows.find((row) => {
          const unitId = row.original.unit_id_resultValue
          if (unitId == null) return false
          const unit = units.find((item) => item.unit_id === unitId)
          return Boolean(unit && resolveFootprintResultUnitKindFromNames([unit.unit_name, unit.unit_initial]))
        })?.original.unit_id_resultValue
        const fallbackUnit = units.find((unit) => {
          const names = [unit.unit_name, unit.unit_initial].map(normalizeUnitText)
          return names.some((name) => getFootprintResultUnitAliases(mode).includes(name))
        })
        const resolvedUnitId = existingUnitId ?? fallbackUnit?.unit_id
        if (resolvedUnitId != null) {
          next[mode] = String(resolvedUnitId)
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [footprintCalculationModal.kind, footprintModalRows, isPreparationMode, units])

  useEffect(() => {
    if (!supportedFootprintResultUnits.length) return

    setFootprintResultUnitSelections((prev) => {
      let changed = false
      const next = { ...prev }

      Object.entries(prev).forEach(([mode, unitId]) => {
        if (!unitId) return
        const isSupported = supportedFootprintResultUnits.some((unit) => String(unit.unit_id) === unitId)
        if (!isSupported) {
          next[mode as FootprintFormulaMode] = ''
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [supportedFootprintResultUnits])

  useEffect(() => {
    if (isPreparationMode || footprintCalculationModal.kind === 'hidden' || !fertilizerModalRows.length) return

    setFootprintFertilizerFactorSelections((prev) => {
      const next = { ...prev }
      let changed = false

      FERTILIZER_FACTOR_FIELD_CONFIGS.forEach((config) => {
        if (next[config.selectionKey]) return
        const bestEf = fertilizerFactorSelectableEfs
          .map((ef) => ({ ef, score: scoreFertilizerFactorEfCandidate(config, ef) }))
          .sort((left, right) => right.score - left.score)[0]

        if (bestEf?.score > 0) {
          next[config.selectionKey] = String(bestEf.ef.coefficient_emission_factor_id)
          changed = true
        }
      })

      if (!next.gwpN2OId) {
        const bestGwp = gwps
          .map((gwp) => ({ gwp, score: scoreGwpCandidate(gwp) }))
          .sort((left, right) => right.score - left.score)[0]

        if (bestGwp?.score > 0) {
          next.gwpN2OId = String(bestGwp.gwp.coefficients_emissions_factors_gwp_id)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [fertilizerFactorSelectableEfs, footprintCalculationModal.kind, fertilizerModalRows.length, gwps, isPreparationMode])

  useEffect(() => {
    if (showFertilizerKindFilter) return
    if (fertilizerKindFilter) {
      setFertilizerKindFilter('')
    }
  }, [fertilizerKindFilter, showFertilizerKindFilter])

  useEffect(() => {
    if (!footprintEfFilterGroupId) return
    const exists = filteredFuelEfGroups.some((item) => String(item.group_emission_factor_id) === footprintEfFilterGroupId)
    if (!exists) {
      setFootprintEfFilterGroupId('')
    }
  }, [filteredFuelEfGroups, footprintEfFilterGroupId])

  const sourceVolume = selectedRow
    ? selectedRow.preparationInfo.sourceVolumeAll ?? selectedRow.original.log_activities_detail?.log_act_detail_volumeAll ?? 0
    : 0
  const sourceQuantity = selectedRow?.original.log_activities_detail?.log_act_detail_quatity ?? 0
  const sourceUnit = selectedRow
    ? unitById[selectedRow.preparationInfo.sourceUnitId ?? selectedRow.original.log_activities_detail?.unit_id ?? 0]
    : undefined
  const normalizedSourceUnit = [sourceUnit?.unit_name, sourceUnit?.unit_initial].map(normalizeUnitText)
  const sourceIsLiter = normalizedSourceUnit.some((value) => ['l', 'lit', 'liter', 'litre', 'litter', 'ลิตร'].includes(value))
  const sourceIsCubicMeter = normalizedSourceUnit.some((value) => ['m3', 'm^3', 'm³', 'cubicmeter', 'cubicmetre', 'ลูกบาศก์เมตร'].includes(value))

  const openPreparationForm = (row: QueueRow) => {
    const item = row.original
    const detail = item.log_activities_detail
    const preparationInfo = row.preparationInfo
    const defaultPreparationType = preparationInfo.fertilizerPrepareType ?? getDefaultPreparationType(row.rowType)
    const fertilizerProfile = row.rowType === 'fertilizer'
      ? getFertilizerNitrogenProfile(row.resourceItemName)
      : null
    setSelectedRow(row)
    setForm({
      preparedUnitId: detail?.unit_id != null ? String(detail.unit_id) : '',
      preparedUnitName: '',
      preparedUnitInitial: '',
      preparedUnitPrefixId: detail?.unit_prefix_id != null ? String(detail.unit_prefix_id) : '',
      preparedVolumeAll: detail?.log_act_detail_volumeAll != null ? String(detail.log_act_detail_volumeAll) : '',
      preparedVolumePerUnit: detail?.log_act_detail_volumePerUnit != null ? String(detail.log_act_detail_volumePerUnit) : '',
      conversionFactor: preparationInfo.conversionFactor != null ? String(preparationInfo.conversionFactor) : '',
      fertilizerBagWeightKg: preparationInfo.fertilizerBagWeightKg != null ? String(preparationInfo.fertilizerBagWeightKg) : '',
      fertilizerPrepareType: defaultPreparationType,
      soilSampleDate: dateInputValue(preparationInfo.soilSampleDate),
      soilN: item.N != null
        ? String(item.N)
        : (preparationInfo.soilN != null
            ? String(preparationInfo.soilN)
            : (fertilizerProfile?.kind === 'chemical' && fertilizerProfile.detectedN != null
                ? String(fertilizerProfile.detectedN)
                : '')),
      soilSocBaseline: preparationInfo.soilSocBaseline != null ? String(preparationInfo.soilSocBaseline) : '',
      soilSocProject: preparationInfo.soilSocProject != null ? String(preparationInfo.soilSocProject) : '',
      note: preparationInfo.note ?? '',
    })
  }

  const closePreparationForm = () => {
    setSelectedRow(null)
    setForm(emptyForm)
  }

  const applyFertilizerBag = (weightKg: number) => {
    const result = sourceQuantity * weightKg
    setForm((prev) => ({
      ...prev,
      fertilizerPrepareType: 'fertilizer',
      fertilizerBagWeightKg: String(weightKg),
      preparedUnitId: kgUnit ? String(kgUnit.unit_id) : '',
      preparedUnitName: kgUnit ? '' : (prev.preparedUnitName || 'kg'),
      preparedUnitInitial: kgUnit ? '' : (prev.preparedUnitInitial || 'kg'),
      preparedVolumePerUnit: String(weightKg),
      conversionFactor: String(weightKg),
      preparedVolumeAll: formatFormNumber(result),
    }))
  }

  const applyFuelLiter = () => {
    const factor = sourceIsCubicMeter ? 1000 : 1
    const preparedVolumeAll = sourceVolume * factor
    const preparedVolumePerUnit = calculatePreparedVolumePerUnit(sourceQuantity, preparedVolumeAll)
    setForm((prev) => ({
      ...prev,
      fertilizerPrepareType: 'fuel',
      preparedUnitId: literUnit ? String(literUnit.unit_id) : prev.preparedUnitId,
      conversionFactor: String(factor),
      preparedVolumePerUnit: preparedVolumePerUnit != null ? formatFormNumber(preparedVolumePerUnit) : prev.preparedVolumePerUnit,
      preparedVolumeAll: formatFormNumber(preparedVolumeAll),
    }))
  }

  const applyFuelCubicMeter = () => {
    const factor = sourceIsLiter ? 0.001 : 1
    const preparedVolumeAll = sourceVolume * factor
    const preparedVolumePerUnit = calculatePreparedVolumePerUnit(sourceQuantity, preparedVolumeAll)
    setForm((prev) => ({
      ...prev,
      fertilizerPrepareType: 'fuel',
      preparedUnitId: cubicMeterUnit ? String(cubicMeterUnit.unit_id) : prev.preparedUnitId,
      conversionFactor: String(factor),
      preparedVolumePerUnit: preparedVolumePerUnit != null ? formatFormNumber(preparedVolumePerUnit) : prev.preparedVolumePerUnit,
      preparedVolumeAll: formatFormNumber(preparedVolumeAll),
    }))
  }

  const preparationMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      put(`/activities/carbon-process-queue/${id}/preparation`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['carbon-process-queue'] })
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
      void qc.invalidateQueries({ queryKey: ['units-carbon-footprint'] })
      void qc.invalidateQueries({ queryKey: ['units'] })
      closePreparationForm()
    },
  })

  const bulkPreparationMut = useMutation({
    mutationFn: async ({
      items,
      moveToReady,
      detailIds,
    }: {
      items: BulkConversionPreview[]
      moveToReady: boolean
      detailIds: number[]
    }) => {
      const updated = []
      setBulkModalError(null)
      setBulkPreparationPopup({
        kind: 'loading',
        current: 0,
        total: items.length,
        currentLabel: '',
      })

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        setBulkPreparationPopup({
          kind: 'loading',
          current: index + 1,
          total: items.length,
          currentLabel: `${item.row.headerLabel} · ${item.row.resourceItemName}`,
        })

        try {
          updated.push(await put(`/activities/carbon-process-queue/${item.row.id}/preparation`, item.payload))
          if (index < items.length - 1) {
            await wait(120)
          }
        } catch (error) {
          throw new Error(`รายการที่ ${index + 1}/${items.length}: ${item.row.headerLabel} · ${item.row.resourceItemName} - ${getErrorMessage(error)}`)
        }
      }

      if (moveToReady && detailIds.length > 0) {
        setBulkPreparationPopup({
          kind: 'loading',
          current: items.length,
          total: items.length,
          currentLabel: 'กำลังย้ายสถานะเป็น พร้อมคำนวณมาตรฐาน',
        })

        try {
          await (
            detailIds.length === 1
              ? post(`/activities/details/${detailIds[0]}/manual-status`, { statusName: ACTIVITY_CAL_STATUS_NAMES.ready }, { timeout: 2 * 60_000 })
              : post('/activities/details/manual-status/bulk', { ids: detailIds, statusName: ACTIVITY_CAL_STATUS_NAMES.ready }, { timeout: 10 * 60_000 })
          )
        } catch (error) {
          throw new Error(`บันทึกการเตรียมข้อมูลสำเร็จแล้ว แต่ย้ายสถานะเป็น พร้อมคำนวณมาตรฐาน ไม่สำเร็จ - ${getErrorMessage(error)}`)
        }
      }

      return updated
    },
    onSuccess: async (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['carbon-process-queue'] })
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
      void qc.invalidateQueries({ queryKey: ['units-carbon-footprint'] })
      void qc.invalidateQueries({ queryKey: ['units'] })
      setBulkModalError(null)
      setBulkPreparationPopup({
        kind: 'success',
        itemCount: variables.items.length,
        countdown: 4,
        movedToReadyCount: variables.moveToReady ? variables.detailIds.length : 0,
      })
    },
    onError: (error) => {
      setBulkPreparationPopup({ kind: 'hidden' })
      setBulkModalError(getErrorMessage(error))
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ detailIds, statusName }: { detailIds: number[]; statusName: string; fromStatusLabel?: string; toStatusLabel?: string }) => (
      detailIds.length === 1
        ? post(`/activities/details/${detailIds[0]}/manual-status`, { statusName }, { timeout: 2 * 60_000 })
        : post('/activities/details/manual-status/bulk', { ids: detailIds, statusName }, { timeout: 10 * 60_000 })
    ),
    onMutate: ({ detailIds, statusName, fromStatusLabel, toStatusLabel }) => {
      setStatusPopup({
        kind: 'loading',
        itemCount: detailIds.length,
        fromStatusLabel: fromStatusLabel ?? 'สถานะที่เลือก',
        toStatusLabel: toStatusLabel ?? statusName,
      })
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['carbon-process-queue'] }),
        qc.invalidateQueries({ queryKey: ['activity-details-calculate'] }),
        qc.invalidateQueries({ queryKey: ['activity-details'] }),
      ])
      setSelectedQueueIds([])
      setStatusPopup({
        kind: 'success',
        itemCount: variables.detailIds.length,
        countdown: 4,
        fromStatusLabel: variables.fromStatusLabel ?? 'สถานะที่เลือก',
        toStatusLabel: variables.toStatusLabel ?? variables.statusName,
      })
    },
    onError: () => {
      setStatusPopup({ kind: 'hidden' })
    },
  })

  const saveFootprintUnitMut = useMutation({
    mutationFn: ({ payload }: { mode: FootprintFormulaMode; payload: { unit_name?: string; unit_initial?: string } }) => (
      post<Unit>('/emission-factors/units', payload)
    ),
    onSuccess: async (created, variables) => {
      await qc.invalidateQueries({ queryKey: ['units'] })
      if (created.unit_id != null) {
        setFootprintResultUnitSelections((prev) => ({
          ...prev,
          [variables.mode]: String(created.unit_id),
        }))
      }
      setFootprintUnitCreateMode(null)
      setFootprintNewUnitName('')
      setFootprintNewUnitInitial('')
    },
  })

  const openFootprintCalculationModal = (rowsToReview: QueueRow[], source: FootprintCalculationSource) => {
    setFootprintFuelEfSearchInputs({})
    setFootprintFuelEfFocusedRowId(null)
    setFootprintFertilizerFactorSearchInputs({})
    setFootprintFertilizerFactorFocusedKey(null)
    setFootprintManualFertilizerFormulaInputs({})
    setIsFootprintModalResizing(false)
    setFootprintCalculationModal({
      kind: 'preview',
      source,
      rows: rowsToReview,
    })
  }

  const closeFootprintCalculationModal = () => {
    if (footprintCalculationModal.kind === 'running') return
    setFootprintFuelEfSearchInputs({})
    setFootprintFuelEfFocusedRowId(null)
    setFootprintFertilizerFactorSearchInputs({})
    setFootprintFertilizerFactorFocusedKey(null)
    setFootprintManualFertilizerFormulaInputs({})
    setIsFootprintModalResizing(false)
    setFootprintCalculationModal({ kind: 'hidden' })
  }

  const updateFootprintResultUnitSelection = (mode: FootprintFormulaMode, unitId: string) => {
    if (unitId && !supportedFootprintResultUnits.some((unit) => String(unit.unit_id) === unitId)) {
      return
    }
    setFootprintResultUnitSelections((prev) => ({
      ...prev,
      [mode]: unitId,
    }))
  }

  const updateFootprintSelectedEf = (rowId: number, efId: string) => {
    setFootprintSelectedEfIds((prev) => ({
      ...prev,
      [rowId]: efId,
    }))
  }

  const updateFootprintManualFertilizerFormulaInput = (
    rowId: number,
    key: keyof ManualFertilizerFormulaInput,
    value: string,
  ) => {
    setFootprintManualFertilizerFormulaInputs((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] ?? EMPTY_MANUAL_FERTILIZER_FORMULA_INPUT),
        [key]: value,
      },
    }))
  }

  const applyFootprintFuelEfSelection = (rowId: number, ef?: Ef) => {
    updateFootprintSelectedEf(rowId, ef ? String(ef.coefficient_emission_factor_id) : '')
    setFootprintFuelEfSearchInputs((prev) => ({
      ...prev,
      [rowId]: ef ? getFuelEfOptionLabel(ef, unitById) : '',
    }))
    setFootprintFuelEfFocusedRowId(null)
  }

  const updateFootprintFuelEfSearchInput = (rowId: number, value: string, efOptions: Ef[]) => {
    setFootprintFuelEfSearchInputs((prev) => ({
      ...prev,
      [rowId]: value,
    }))

    const trimmedValue = value.trim()
    if (!trimmedValue) {
      applyFootprintFuelEfSelection(rowId)
      return
    }

    const matchedEf = efOptions.find((item) => getFuelEfOptionLabel(item, unitById) === trimmedValue)
    updateFootprintSelectedEf(rowId, matchedEf ? String(matchedEf.coefficient_emission_factor_id) : '')
  }

  const scoreFertilizerFactorEfCandidate = (config: FertilizerFactorFieldConfig, ef: Ef) => {
    const text = [
      ef.coef_em_factor_idCode,
      ef.coef_em_factor_name,
      ef.coef_em_factor_info,
    ].filter(Boolean).join(' ').toLowerCase()

    let score = 0
    config.keywords.forEach((keyword, index) => {
      if (text.includes(keyword.toLowerCase())) {
        score += index === 0 ? 120 : 60
      }
    })

    if (ef.coef_em_factor_value_total != null) {
      const diff = Math.abs(Number(ef.coef_em_factor_value_total) - config.defaultValue)
      if (diff < 0.000001) score += 140
      else if (diff < 0.01) score += 40
    }

    return score
  }

  const scoreGwpCandidate = (gwp: Gwp) => {
    const text = [
      gwp.coef_em_factor_gwp_name,
      gwp.coef_em_factor_gwp_name_en,
      gwp.coef_em_factor_gwp_info,
    ].filter(Boolean).join(' ').toLowerCase()

    let score = 0
    if (text.includes('n2o')) score += 140
    if (gwp.coef_em_factor_gwp_value != null) {
      const diff = Math.abs(Number(gwp.coef_em_factor_gwp_value) - FERTILIZER_CFP_SIMPLE_CONSTANTS.GWP_N2O)
      if (diff < 0.000001) score += 140
      else if (diff < 0.1) score += 40
    }
    return score
  }

  const updateFootprintFertilizerFactorSelection = (selectionKey: keyof FertilizerFactorSelections, value: string) => {
    setFootprintFertilizerFactorSelections((prev) => ({
      ...prev,
      [selectionKey]: value,
    }))
  }

  const applyFootprintFertilizerFactorEfSelection = (config: FertilizerFactorFieldConfig, ef?: Ef) => {
    updateFootprintFertilizerFactorSelection(config.selectionKey, ef ? String(ef.coefficient_emission_factor_id) : '')
    setFootprintFertilizerFactorSearchInputs((prev) => ({
      ...prev,
      [config.selectionKey]: ef ? getFuelEfOptionLabel(ef, unitById) : '',
    }))
    setFootprintFertilizerFactorFocusedKey(null)
  }

  const updateFootprintFertilizerFactorEfSearchInput = (config: FertilizerFactorFieldConfig, value: string, efOptions: Ef[]) => {
    setFootprintFertilizerFactorSearchInputs((prev) => ({
      ...prev,
      [config.selectionKey]: value,
    }))

    const trimmedValue = value.trim()
    if (!trimmedValue) {
      applyFootprintFertilizerFactorEfSelection(config)
      return
    }

    const matchedEf = efOptions.find((item) => getFuelEfOptionLabel(item, unitById) === trimmedValue)
    updateFootprintFertilizerFactorSelection(config.selectionKey, matchedEf ? String(matchedEf.coefficient_emission_factor_id) : '')
  }

  const applyFootprintFertilizerGwpSelection = (gwp?: Gwp) => {
    updateFootprintFertilizerFactorSelection('gwpN2OId', gwp ? String(gwp.coefficients_emissions_factors_gwp_id) : '')
    setFootprintFertilizerFactorSearchInputs((prev) => ({
      ...prev,
      gwpN2OId: gwp ? getGwpOptionLabel(gwp) : '',
    }))
    setFootprintFertilizerFactorFocusedKey(null)
  }

  const updateFootprintFertilizerGwpSearchInput = (value: string, options: Gwp[]) => {
    setFootprintFertilizerFactorSearchInputs((prev) => ({
      ...prev,
      gwpN2OId: value,
    }))

    const trimmedValue = value.trim()
    if (!trimmedValue) {
      applyFootprintFertilizerGwpSelection()
      return
    }

    const matchedGwp = options.find((item) => getGwpOptionLabel(item) === trimmedValue)
    updateFootprintFertilizerFactorSelection('gwpN2OId', matchedGwp ? String(matchedGwp.coefficients_emissions_factors_gwp_id) : '')
  }

  const startFootprintModalResize = () => {
    setIsFootprintModalResizing(true)
  }

  const openFootprintUnitCreate = (mode: FootprintFormulaMode) => {
    setFootprintUnitCreateMode(mode)
    setFootprintNewUnitName('')
    setFootprintNewUnitInitial('')
    setFootprintUnitCreateError(null)
  }

  const submitFootprintUnitCreate = (mode: FootprintFormulaMode) => {
    const unitName = footprintNewUnitName.trim()
    const unitInitial = footprintNewUnitInitial.trim()
    if (!unitName) return
    const resolvedKind = resolveFootprintResultUnitKindFromNames([unitName, unitInitial])
    if (!resolvedKind) {
      setFootprintUnitCreateError('เพิ่มได้เฉพาะหน่วยในกลุ่ม kgCO2e หรือ tCO2e เท่านั้น')
      return
    }

    setFootprintUnitCreateError(null)

    saveFootprintUnitMut.mutate({
      mode,
      payload: {
        unit_name: unitName,
        unit_initial: unitInitial || undefined,
      },
    })
  }

  const startFootprintCalculation = async () => {
    if (footprintCalculationModal.kind !== 'preview') return

    const source = footprintCalculationModal.source
    const rowsToReview = footprintCalculationModal.rows
    const readyRows = footprintModalReadyRows.filter((row) => rowsToReview.some((item) => item.id === row.id))
    const successRows: FootprintCalculationRunResult[] = []
    const failedRows: FootprintCalculationRunResult[] = []

    setFootprintCalculationModal({
      kind: 'running',
      source,
      rows: rowsToReview,
      currentIndex: 0,
      currentLabel: '',
      successRows,
      failedRows,
    })

    for (let index = 0; index < readyRows.length; index += 1) {
      const row = readyRows[index]
      const currentLabel = `${row.headerLabel} · ${row.resourceItemName}`

      setFootprintCalculationModal({
        kind: 'running',
        source,
        rows: rowsToReview,
        currentIndex: index + 1,
        currentLabel,
        successRows: [...successRows],
        failedRows: [...failedRows],
      })

      try {
        const selectedResultUnitId = footprintResultUnitSelections[row.formulaMode]
        const selectedEfId = row.rowType === 'fuel' ? footprintSelectedEfIds[row.id] : undefined
        const manualFormula = parseManualFertilizerFormulaInput(footprintManualFertilizerFormulaInputs[row.id])
        const result = await post<CarbonProcessQueueItem>(`/activities/carbon-process-queue/${row.id}/calculate`, {
          resultUnitId: selectedResultUnitId ? Number(selectedResultUnitId) : undefined,
          selectedEfId: selectedEfId ? Number(selectedEfId) : undefined,
          fertilizerUreaEfId: footprintFertilizerFactorSelections.ureaAsNEfId ? Number(footprintFertilizerFactorSelections.ureaAsNEfId) : undefined,
          fertilizerDapEfId: footprintFertilizerFactorSelections.dapAsP2O5EfId ? Number(footprintFertilizerFactorSelections.dapAsP2O5EfId) : undefined,
          fertilizerKclEfId: footprintFertilizerFactorSelections.kclAsK2OEfId ? Number(footprintFertilizerFactorSelections.kclAsK2OEfId) : undefined,
          fertilizerGwpId: footprintFertilizerFactorSelections.gwpN2OId ? Number(footprintFertilizerFactorSelections.gwpN2OId) : undefined,
          manualFertilizerNPercent: manualFormula?.nPercent,
          manualFertilizerP2O5Percent: manualFormula?.p2o5Percent,
          manualFertilizerK2OPercent: manualFormula?.k2oPercent,
        }, {
          timeout: FOOTPRINT_CALC_REQUEST_TIMEOUT_MS,
        })
        successRows.push({
          row,
          resultValue: result.carbon_process_queue_resultValue,
          resultUnitLabel: getCarbonQueueResultUnitLabel(result),
        })
      } catch (error) {
        failedRows.push({
          row,
          error: getErrorMessage(error),
        })
      }

      setFootprintCalculationModal({
        kind: 'running',
        source,
        rows: rowsToReview,
        currentIndex: index + 1,
        currentLabel,
        successRows: [...successRows],
        failedRows: [...failedRows],
      })
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ['carbon-process-queue'] }),
      qc.invalidateQueries({ queryKey: ['activity-details-calculate'] }),
      qc.invalidateQueries({ queryKey: ['activity-details'] }),
    ])

    setSelectedQueueIds((prev) => prev.filter((id) => !successRows.some((item) => item.row.id === id)))
    setFootprintCalculationModal({
      kind: 'complete',
      source,
      rows: rowsToReview,
      successRows,
      failedRows,
      countdown: failedRows.length ? undefined : 4,
    })
  }

  const submitPreparation = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedRow) return

    const selectedFertilizerNitrogen = selectedRow.rowType === 'fertilizer'
      ? getFertilizerNitrogenProfile(selectedRow.resourceItemName)
      : null
    const resolvedSoilN = (() => {
      const manualSoilN = toNumberOrUndefined(form.soilN)
      if (manualSoilN != null) return manualSoilN
      if (!selectedFertilizerNitrogen) return undefined
      if (selectedFertilizerNitrogen.kind === 'chemical') return selectedFertilizerNitrogen.detectedN
      if (selectedFertilizerNitrogen.kind === 'organic') return null
      return undefined
    })()

    preparationMut.mutate({
      id: selectedRow.id,
      payload: {
        preparedUnitId: toNumberOrUndefined(form.preparedUnitId),
        preparedUnitName: form.preparedUnitId ? undefined : (form.preparedUnitName || undefined),
        preparedUnitInitial: form.preparedUnitId ? undefined : (form.preparedUnitInitial || undefined),
        preparedUnitPrefixId: toNumberOrUndefined(form.preparedUnitPrefixId),
        preparedVolumeAll: toNumberOrUndefined(form.preparedVolumeAll),
        preparedVolumePerUnit: toNumberOrUndefined(form.preparedVolumePerUnit),
        conversionFactor: toNumberOrUndefined(form.conversionFactor),
        fertilizerBagWeightKg: toNumberOrUndefined(form.fertilizerBagWeightKg),
        fertilizerPrepareType: form.fertilizerPrepareType || undefined,
        soilSampleDate: form.soilSampleDate || undefined,
        soilN: resolvedSoilN,
        soilSocBaseline: toNumberOrUndefined(form.soilSocBaseline),
        soilSocProject: toNumberOrUndefined(form.soilSocProject),
        note: form.note || undefined,
      },
    })
  }

  const clearFilters = () => {
    setStatusFilter(isPreparationMode ? 'preparing' : 'ready')
    setResourceTypeFilter('')
    setFertilizerKindFilter('')
    setCampFilter('')
    setPreparationFilter('')
  }

  const preparationColumns: Column<QueueRow>[] = [
    ...(isPreparationMode ? [{
      key: 'checked',
      header: 'เลือก',
      width: '70px',
      render: (row: QueueRow) => (
        <input
          type="checkbox"
          checked={Boolean(row.checked)}
          onChange={(event) => toggleSelectedQueueRow(row.id, event.target.checked)}
        />
      ),
    }] : []),
    { key: 'dateLabel', header: 'วันที่กิจกรรม', sortable: true },
    { key: 'headerLabel', header: 'หัวข้อกิจกรรม', sortable: true },
    { key: 'activityTypeName', header: 'กิจกรรม', sortable: true },
    { key: 'detailTypeName', header: 'รายละเอียด', sortable: true },
    { key: 'resourceTypeName', header: 'ประเภทปัจจัย', sortable: true },
    { key: 'resourceItemName', header: 'รายการปัจจัย', sortable: true },
    { key: 'nValueLabel', header: 'N', sortable: true, render: (row) => <span className="font-mono">{row.nValueLabel}</span> },
    { key: 'quantityUnitLabel', header: 'unit จำนวน', sortable: true },
    { key: 'quantityLabel', header: 'จำนวน', sortable: true, render: (row) => <span className="font-mono">{row.quantityLabel}</span> },
    { key: 'sourceUnitLabel', header: 'หน่วยเดิม', sortable: true },
    { key: 'sourceAmountLabel', header: 'ปริมาณรวมเดิม', sortable: true, render: (row) => <span className="font-mono">{row.sourceAmountLabel}</span> },
    { key: 'preparedUnitLabel', header: 'หน่วยหลังเตรียม', sortable: true, render: (row) => <span className={row.isPrepared ? 'font-medium text-emerald-700' : 'text-surface-400'}>{row.preparedUnitLabel}</span> },
    { key: 'preparedAmountLabel', header: 'ปริมาณรวมหลังเตรียม', sortable: true, render: (row) => <span className={`font-mono ${row.isPrepared ? 'text-emerald-700' : 'text-surface-400'}`}>{row.preparedAmountLabel}</span> },
    {
      key: 'preparationStateLabel',
      header: 'สถานะการเตรียม',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className={getPreparationStateBadgeClass(row)}>{row.preparationStateLabel}</span>
          {row.isPrepared && <span className="text-[11px] text-surface-500">อัปเดตล่าสุด {row.preparedAtLabel}</span>}
        </div>
      ),
    },
    {
      key: 'statusLabel',
      header: 'สถานะ',
      sortable: true,
      render: (row) => <span className={getActivityCalStatusBadgeClass(row.statusRawName, row.original.log_act_detail_calStatus_id)}>{row.statusLabel}</span>,
    },
  ]

  const footprintColumns: Column<QueueRow>[] = [
    {
      key: 'checked',
      header: 'เลือก',
      width: '70px',
      render: (row: QueueRow) => (
        <input
          type="checkbox"
          checked={Boolean(row.checked)}
          onChange={(event) => toggleSelectedQueueRow(row.id, event.target.checked)}
        />
      ),
    },
    { key: 'dateLabel', header: 'วันที่กิจกรรม', sortable: true },
    { key: 'campLabel', header: 'แคมป์', sortable: true, render: (row) => <span className="badge-blue">{row.campLabel}</span> },
    { key: 'landLabel', header: 'แปลง', sortable: true, render: (row) => <span className="badge-green">{row.landLabel}</span> },
    { key: 'resourceTypeName', header: 'ประเภทปัจจัย', sortable: true },
    { key: 'resourceItemName', header: 'รายการปัจจัย', sortable: true },
    { key: 'formulaModeLabel', header: 'สูตรที่จะใช้', sortable: true },
    {
      key: 'inputStatusLabel',
      header: 'สถานะ input',
      sortable: true,
      render: (row) => <span className={getFootprintInputStatusClass(row.inputStatusKind)}>{row.inputStatusLabel}</span>,
    },
    { key: 'nValueLabel', header: 'N', sortable: true, render: (row) => <span className="font-mono">{row.nValueLabel}</span> },
    { key: 'sourceAmountLabel', header: 'ปริมาณเดิม', sortable: true, render: (row) => <span className="font-mono">{row.sourceAmountLabel}</span> },
    { key: 'sourceUnitLabel', header: 'หน่วยเดิม', sortable: true },
    { key: 'calculationAmountLabel', header: 'ปริมาณที่ใช้คำนวณ', sortable: true, render: (row) => <span className="font-mono">{row.calculationAmountLabel}</span> },
    { key: 'preparedAmountLabel', header: 'ปริมาณหลังเตรียม', sortable: true, render: (row) => <span className="font-mono">{row.preparedAmountLabel}</span> },
    { key: 'preparedUnitLabel', header: 'หน่วยหลังเตรียม', sortable: true },
    { key: 'resultValueLabel', header: 'ผลลัพธ์การคำนวณ', sortable: true, render: (row) => <span className="font-mono">{row.resultValueLabel}</span> },
    { key: 'resultUnitLabel', header: 'หน่วยผลลัพธ์', sortable: true, render: (row) => <span className="font-medium">{row.resultUnitLabel}</span> },
    { key: 'retryCountLabel', header: 'จำนวนครั้งที่ลองใหม่', sortable: true, render: (row) => <span className="font-mono">{row.retryCountLabel}</span> },
    { key: 'errorMessageLabel', header: 'ข้อความปัญหา', sortable: true },
    { key: 'createAtLabel', header: 'เวลาสร้างรายการ', sortable: true },
    { key: 'startedAtLabel', header: 'เวลาเริ่มประมวลผล', sortable: true },
    { key: 'endedAtLabel', header: 'เวลาสิ้นสุดประมวลผล', sortable: true },
    {
      key: 'statusLabel',
      header: 'สถานะ',
      sortable: true,
      render: (row) => <span className={getActivityCalStatusBadgeClass(row.statusRawName, row.original.log_act_detail_calStatus_id)}>{row.statusLabel}</span>,
    },
  ]
  const columns = isPreparationMode ? preparationColumns : footprintColumns

  const selectedRowType = selectedRow?.rowType ?? 'other'
  const selectedIsFertilizer = selectedRowType === 'fertilizer'
  const selectedIsFuel = selectedRowType === 'fuel'
  const selectedFertilizerProfile = selectedIsFertilizer
    ? getFertilizerNitrogenProfile(selectedRow?.resourceItemName)
    : null
  const canApplyFuelPresets = selectedIsFuel && (sourceIsLiter || sourceIsCubicMeter)
  const previewPreparedVolume = toNumberOrUndefined(form.preparedVolumeAll)
  const previewDiff = previewPreparedVolume != null ? previewPreparedVolume - sourceVolume : undefined
  const previewPreparedUnitLabel = form.preparedUnitId
    ? unitLabel(unitById[Number(form.preparedUnitId)])
    : (form.preparedUnitInitial || form.preparedUnitName || '—')

  const renderFootprintRowsTable = (items: QueueRow[], options?: { reason?: 'blocked' | 'unsupported'; result?: FootprintCalculationRunResult[] }) => {
    if (!items.length) {
      return (
        <div className="rounded-xl border border-dashed border-[#d9e7f2] px-4 py-8 text-center text-sm text-surface-400">
          ไม่มีรายการในกลุ่มนี้
        </div>
      )
    }

    const isResultTable = Boolean(options?.result)

    return (
      <div className="max-h-[320px] overflow-auto rounded-xl border border-[#d9e7f2]">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead className="sticky top-0 bg-[#f3f7fb] text-surface-600">
            <tr>
              <th className="px-3 py-2 font-semibold">หัวข้อกิจกรรม</th>
              <th className="px-3 py-2 font-semibold">รายการปัจจัย</th>
              <th className="px-3 py-2 font-semibold">สูตร</th>
              <th className="px-3 py-2 font-semibold">ปริมาณที่ใช้</th>
              <th className="px-3 py-2 font-semibold">หน่วยหลังเตรียม</th>
              {!isResultTable && <th className="px-3 py-2 font-semibold">Preview result</th>}
              {!isResultTable && <th className="px-3 py-2 font-semibold">Preview unit</th>}
              <th className="px-3 py-2 font-semibold">{isResultTable ? 'ผลลัพธ์ที่บันทึก' : 'Preview detail / status'}</th>
              {isResultTable && <th className="px-3 py-2 font-semibold">หน่วยผลลัพธ์</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5eef5] bg-white">
            {items.map((row) => {
              const result = options?.result?.find((item) => item.row.id === row.id)
              const preview = footprintModalRowPreviewById[row.id]
              const previewStatusLabel = options?.reason === 'unsupported'
                ? 'สูตรนี้ยังไม่เปิดคำนวณ'
                : options?.reason === 'blocked'
                  ? getFootprintBlockedReason(row)
                  : (preview?.previewStatusLabel ?? row.inputStatusLabel)

              return (
                <tr key={row.id}>
                  <td className="px-3 py-2 align-top">
                    <div className="min-w-[140px]">
                      <div className="font-medium text-surface-800">{row.headerLabel}</div>
                      <div className="text-[11px] text-surface-500">{row.campLabel} · {row.landLabel}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">{row.resourceItemName}</td>
                  <td className="px-3 py-2 align-top">{row.formulaModeLabel}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono">{row.calculationAmountLabel}</div>
                    {preview?.inputSummary && (
                      <div className="mt-1 text-[11px] text-surface-500">{preview.inputSummary}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">{row.preparedUnitLabel}</td>
                  {!isResultTable && (
                    <td className="px-3 py-2 align-top font-mono">
                      {preview?.previewResultLabel ?? '—'}
                    </td>
                  )}
                  {!isResultTable && (
                    <td className="px-3 py-2 align-top">
                      <span className="font-medium">{preview?.previewResultUnitLabel ?? '—'}</span>
                    </td>
                  )}
                  <td className="px-3 py-2 align-top">
                    {result?.error
                      ? <span className="text-red-700">{result.error}</span>
                      : result
                        ? (
                          <div className="space-y-1">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">บันทึกผลแล้ว</span>
                            <div className="font-mono text-emerald-700">{formatNumberish(result.resultValue, 4)}</div>
                          </div>
                        )
                        : (
                          <div className="space-y-1">
                            <span className={preview ? getFootprintPreviewStatusClass(preview.previewStatusKind) : getFootprintInputStatusClass(row.inputStatusKind)}>
                              {previewStatusLabel}
                            </span>
                            {preview?.previewFormulaText && (
                              <div className="font-mono text-[11px] leading-5 text-surface-500">
                                {preview.previewFormulaText}
                              </div>
                            )}
                            {preview?.note && (
                              <div className="text-[11px] text-surface-500">{preview.note}</div>
                            )}
                          </div>
                        )}
                  </td>
                  {isResultTable && (
                    <td className="px-3 py-2 align-top">
                      <span className="font-medium">{result?.resultUnitLabel ?? row.resultUnitLabel}</span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const content = (
    <>
        <div className={`card ${isEmbeddedPreparationSection ? 'border-[#dccaa4] bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(247,240,223,0.96))] shadow-[0_16px_34px_rgba(120,94,38,0.10)]' : ''}`}>
          <div className="page-header mb-0">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900">
                <Calculator size={20} className={`${isEmbeddedPreparationSection ? 'text-amber-700' : 'text-primary-600'} shrink-0`} />
                {isPreparationMode ? 'คิวเตรียมข้อมูล Carbon' : 'Carbon Footprint'}
              </h1>
              <p className={`page-subtitle ${isEmbeddedPreparationSection ? 'text-[#6d5a31]' : ''}`}>
                {isPreparationMode
                  ? 'จัดการคิวเตรียมข้อมูล Carbon ปรับหน่วย ปริมาณ และตรวจสอบความพร้อมก่อนเปลี่ยนเป็น พร้อมคำนวณมาตรฐาน'
                  : 'คำนวณจากคิวที่พร้อม แสดงผลที่คำนวณแล้ว และติดตามรายการที่ผิดพลาดเพื่อ retry ได้'}
              </p>
            </div>
            <div className={`source-badge w-full justify-start md:w-auto md:justify-end ${isEmbeddedPreparationSection ? 'border-[#d8c08d] bg-white/75 text-[#6d5a31]' : ''}`}>
              <span>{isPreparationMode ? 'Preparation Queue' : 'Ready Queue'}</span>
              <span>{filteredRows.length.toLocaleString('th-TH')} รายการที่ตรงเงื่อนไข</span>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageQueryItems}
          className="mt-4"
          onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
        />

        <div className={`card min-w-0 transition-all duration-300 ${isEmbeddedPreparationSection ? 'border-[#dccaa4] bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(247,241,228,0.98))] hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(120,94,38,0.14)]' : 'hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(91,164,255,0.14)]'}`}>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{isPreparationMode ? 'ตารางคิวเตรียมข้อมูล Carbon' : 'ตาราง Carbon Footprint Ready Queue'}</h2>
              <p className={`mt-1 text-xs ${isEmbeddedPreparationSection ? 'text-[#6d5a31]' : 'text-surface-500'}`}>
                {isPreparationMode
                  ? 'ปรับข้อมูลให้อยู่ในหน่วยกลาง และยืนยันความพร้อมก่อนเปลี่ยนเป็น พร้อมคำนวณมาตรฐาน'
                  : 'หน้า Carbon Footprint ใช้รายการที่พร้อมคำนวณ พร้อมผลลัพธ์และข้อผิดพลาดจากการประมวลผลล่าสุด'}
              </p>
            </div>
            <button type="button" className="btn-ghost btn-sm w-full justify-center sm:w-auto" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          </div>

          {isPreparationMode && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-4 py-3">
                <div className="text-xs text-surface-500">รอเตรียมข้อมูล</div>
                <div className="mt-1 text-lg font-semibold text-surface-800">{pendingCount.toLocaleString('th-TH')}</div>
              </div>
              <div className="rounded-xl border border-[#d6eadf] bg-[#f6fcf8] px-4 py-3">
                <div className="text-xs text-surface-500">เตรียมข้อมูลแล้ว</div>
                <div className="mt-1 text-lg font-semibold text-blue-700">{preparedCount.toLocaleString('th-TH')}</div>
              </div>
              <div className="rounded-xl border border-[#cfe7d9] bg-[#f2fbf5] px-4 py-3">
                <div className="text-xs text-surface-500">แปลงหน่วยแล้ว</div>
                <div className="mt-1 text-lg font-semibold text-emerald-700">{changedCount.toLocaleString('th-TH')}</div>
              </div>
              <div className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                <div className="text-xs text-surface-500">ที่เลือกพร้อมเปลี่ยนสถานะ</div>
                <div className="mt-1 text-lg font-semibold text-primary-700">{readyEligibleDetailIds.length.toLocaleString('th-TH')}</div>
              </div>
            </div>
          )}

          {isPreparationMode && (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={selectVisibleQueueRows}>
                  เลือกทั้งหมดที่กรอง
                </button>
                <button type="button" className="btn-ghost w-full justify-center sm:w-auto" onClick={clearSelectedQueueRows}>
                  ล้างรายการที่เลือก
                </button>
              </div>

              <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-primary-600" />
                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">จัดการหลายรายการ</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-surface-700 sm:grid-cols-3">
                      <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span>เลือกอยู่</span>
                        <strong className="text-sm">{selectedQueueIds.length} รายการ</strong>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span>เปลี่ยนเป็นพร้อมได้</span>
                        <strong className="text-sm">{readyEligibleDetailIds.length} รายการ</strong>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span>ที่เลือกแต่ยังไม่พร้อม</span>
                        <strong className="text-sm">{Math.max(selectedQueueIds.length - readyEligibleDetailIds.length, 0)} รายการ</strong>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:max-w-[24rem]">
                      <button
                        type="button"
                        className="btn-secondary btn-sm w-full justify-center"
                        disabled={!importedEligibleDetailIds.length || statusMut.isPending}
                        onClick={() => statusMut.mutate({
                          detailIds: importedEligibleDetailIds,
                          statusName: ACTIVITY_CAL_STATUS_NAMES.imported,
                          fromStatusLabel: 'สถานะที่เลือก',
                          toStatusLabel: ACTIVITY_CAL_STATUS_NAMES.imported,
                        })}
                      >
                        ← ย้ายกลับไปนำเข้า
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm w-full justify-center"
                        disabled={!readyEligibleDetailIds.length || statusMut.isPending}
                        onClick={() => statusMut.mutate({
                          detailIds: readyEligibleDetailIds,
                          statusName: ACTIVITY_CAL_STATUS_NAMES.ready,
                          fromStatusLabel: ACTIVITY_CAL_STATUS_NAMES.preparing,
                          toStatusLabel: ACTIVITY_CAL_STATUS_NAMES.ready,
                        })}
                      >
                        <CheckCircle2 size={14} /> ย้ายเป็นพร้อมคำนวณ
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-[20px] border border-[#cfe3d6] bg-[linear-gradient(180deg,rgba(249,255,251,0.98),rgba(240,249,244,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Wand2 size={14} className="text-green-700" />
                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">เตรียมหน่วยหลายรายการ</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-surface-700 sm:grid-cols-4">
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">เลือกอยู่</span>
                        <strong className="text-sm">{selectedQueueRows.length} รายการ</strong>
                      </div>
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">ปุ๋ย</span>
                        <strong className="text-sm">{selectedFertilizerRows.length} รายการ</strong>
                      </div>
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">น้ำมัน</span>
                        <strong className="text-sm">{selectedFuelRows.length} รายการ</strong>
                      </div>
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">อื่น ๆ</span>
                        <strong className="text-sm">{selectedOtherRows.length} รายการ</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full justify-center xl:w-auto"
                    disabled={!selectedQueueRows.length || bulkPreparationMut.isPending}
                    onClick={() => {
                      setBulkModalError(null)
                      setBulkPreparationPopup({ kind: 'hidden' })
                      setBulkMovePreparedToReady(false)
                      setBulkModalOpen(true)
                    }}
                  >
                    <Wand2 size={14} /> ทำรายการทั้งหมดจากที่เลือก
                  </button>
                </div>
              </div>
            </>
          )}

          {!isPreparationMode && (
            <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <Calculator size={14} className="text-cyan-700" />
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">คำนวณ Carbon Footprint</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-surface-700 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                      <span className="block text-surface-500">เลือกอยู่</span>
                      <strong className="text-sm">{selectedQueueRows.length.toLocaleString('th-TH')} รายการ</strong>
                    </div>
                    <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                      <span className="block text-surface-500">เลือกที่คำนวณได้</span>
                      <strong className="text-sm">{footprintCalculateRows.length.toLocaleString('th-TH')} รายการ</strong>
                    </div>
                    <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                      <span className="block text-surface-500">พร้อมทั้งหมดที่กรอง</span>
                      <strong className="text-sm">{footprintCalculateAllRows.length.toLocaleString('th-TH')} รายการ</strong>
                    </div>
                    <div className="rounded-xl border border-[#f1d3d3] bg-[#fff8f8] px-3 py-2">
                      <span className="block text-surface-500">เลือกแต่ input ยังไม่ครบ</span>
                      <strong className="text-sm text-red-700">{footprintBlockedSelectedCount.toLocaleString('th-TH')} รายการ</strong>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[30rem]">
                  <button type="button" className="btn-secondary btn-sm w-full justify-center" onClick={selectVisibleQueueRows}>
                    เลือกทั้งหมดที่กรอง
                  </button>
                  <button type="button" className="btn-ghost btn-sm w-full justify-center" onClick={clearSelectedQueueRows}>
                    ล้างรายการที่เลือก
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full justify-center"
                    disabled={!selectedQueueRows.length || isFootprintCalculating}
                    onClick={() => openFootprintCalculationModal(selectedQueueRows, 'selected')}
                  >
                    <Calculator size={14} /> คำนวณรายการที่เลือก
                  </button>
                  {/*
                  <button
                    type="button"
                    className="btn-secondary btn-sm w-full justify-center"
                    disabled={!footprintAllCandidateRows.length || isFootprintCalculating}
                    onClick={() => openFootprintCalculationModal(footprintAllCandidateRows, 'all')}
                  >
                    <Calculator size={14} /> คำนวณทั้งหมดที่พร้อม
                  </button>
                  */}
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${
              isPreparationMode
                ? (showFertilizerKindFilter ? 'xl:grid-cols-6' : 'xl:grid-cols-5')
                : (showFertilizerKindFilter ? 'xl:grid-cols-5' : 'xl:grid-cols-4')
            }`}>
              <div>
                <label className="label">สถานะ</label>
                <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {isPreparationMode && <option value="preparing">กำลังเตรียมข้อมูล</option>}
                  <option value="ready">พร้อมคำนวณมาตรฐาน</option>
                  <option value="standardDone">คำนวณแล้ว(มาตรฐาน)</option>
                  <option value="cfpDone">คำนวณแล้ว(มาตรฐาน,CFP)</option>
                  <option value="error">คำนวณผิดพลาด</option>
                </select>
              </div>
              <div>
                <label className="label">ประเภทปัจจัย</label>
                <select className="select" value={resourceTypeFilter} onChange={(event) => setResourceTypeFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {resourceTypeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              {showFertilizerKindFilter && (
                <div>
                  <label className="label">ประเภทปุ๋ย</label>
                  <select className="select" value={fertilizerKindFilter} onChange={(event) => setFertilizerKindFilter(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    <option value="chemical">ปุ๋ยเคมี (มีค่า N)</option>
                    <option value="organic">ปุ๋ยอินทรีย์ (ไม่มี N)</option>
                    <option value="unknown">ยังไม่ทราบ / ขาดค่า N</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">แคมป์</label>
                <select className="select" value={campFilter} onChange={(event) => setCampFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {campOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              {isPreparationMode && (
                <div>
                  <label className="label">ประเภทการเตรียม</label>
                  <select className="select" value={preparationFilter} onChange={(event) => setPreparationFilter(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    <option value="pending">รอเตรียมข้อมูล</option>
                    <option value="prepared">เตรียมหน่วยแล้ว</option>
                    <option value="fertilizer">ปุ๋ย</option>
                    <option value="fuel">น้ำมัน</option>
                    <option value="soil">ตรวจดิน / SOC</option>
                    <option value="other">อื่น ๆ</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">จำนวนที่แสดง</label>
                <div className="rounded-xl border border-[#d9e7f2] bg-white/80 px-3 py-2 text-sm text-surface-700 shadow-sm">
                  {filteredRows.length.toLocaleString('th-TH')} รายการ
                </div>
              </div>
            </div>
          </div>

          {isPreparationMode && (preparationMut.isError || statusMut.isError) && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {preparationMut.error?.message ?? statusMut.error?.message}
            </div>
          )}

          <DataTable
            data={filteredRows}
            columns={columns}
            isLoading={isLoading}
            rowKey={(row) => row.id}
            searchPlaceholder="ค้นหาแคมป์ แปลง รายการปัจจัย หรือสถานะ..."
            emptyMessage={isPreparationMode ? 'ไม่พบรายการในคิวเตรียมข้อมูล Carbon' : 'ไม่พบรายการสถานะพร้อมคำนวณมาตรฐานสำหรับ Carbon Footprint'}
            actions={(row) => (
              <div className="flex flex-wrap justify-end gap-1">
                {isPreparationMode && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openPreparationForm(row)}>
                    <Edit3 size={13} /> เตรียม
                  </button>
                )}
                {isPreparationMode && row.statusKind === 'preparing' && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={!row.isPrepared || statusMut.isPending}
                    onClick={() => statusMut.mutate({
                      detailIds: [row.detailId],
                      statusName: ACTIVITY_CAL_STATUS_NAMES.ready,
                      fromStatusLabel: ACTIVITY_CAL_STATUS_NAMES.preparing,
                      toStatusLabel: ACTIVITY_CAL_STATUS_NAMES.ready,
                    })}
                  >
                    <CheckCircle2 size={13} /> พร้อม
                  </button>
                )}
                {!isPreparationMode && ['ready', 'error'].includes(row.statusKind) && (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={isFootprintCalculating}
                    onClick={() => openFootprintCalculationModal([row], 'single')}
                  >
                    <Calculator size={13} /> {row.statusKind === 'error' ? 'Retry' : 'คำนวณ'}
                  </button>
                )}
                {!isPreparationMode && ['ready', 'error'].includes(row.statusKind) && row.inputStatusKind === 'blocked' && (
                  <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    input ไม่ครบ
                  </span>
                )}
              </div>
            )}
          />
        </div>

        {!isPreparationMode && footprintCalculationModal.kind !== 'hidden' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={footprintCalculationModal.kind === 'running' ? undefined : closeFootprintCalculationModal}
            />
            <div className="relative flex max-h-[94vh] w-[96vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-card-lg animate-slide-up">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <Calculator size={17} className="text-cyan-700" />
                    คำนวณ Carbon Footprint
                  </h3>
                  <p className="mt-1 text-xs text-surface-500">
                    {footprintCalculationModal.kind === 'preview'
                      ? 'ตรวจสอบรายการก่อนเริ่มคำนวณ ระบบจะแสดงเฉพาะรายการที่พร้อมให้ประมวลผล'
                      : footprintCalculationModal.kind === 'running'
                        ? 'ระบบกำลังคำนวณทีละรายการและบันทึกผลกลับเข้าคิว'
                        : 'สรุปผลการคำนวณล่าสุด'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-icon btn-ghost"
                  onClick={closeFootprintCalculationModal}
                  disabled={footprintCalculationModal.kind === 'running'}
                >
                  <X size={16} />
                </button>
              </div>

              {footprintCalculationModal.kind === 'preview' && (
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
                  <div
                    ref={footprintPreviewLayoutRef}
                    className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden xl:flex-row xl:items-stretch xl:gap-0"
                  >
                    <div
                      className="space-y-4 xl:min-h-0 xl:shrink-0 xl:overflow-y-auto xl:pr-3"
                      style={{ width: isFootprintPreviewWide ? `${footprintModalLeftPaneWidth}%` : undefined }}
                    >
                      <section className="rounded-xl border border-[#d9e7f2] bg-white/85 p-4">
                        <h4 className="mb-3 text-sm font-semibold">แยกกลุ่มตามสูตรที่จะใช้</h4>
                        <div className="space-y-3">
                          {FOOTPRINT_SUPPORTED_FORMULA_MODES.map((mode) => {
                            const item = footprintModalFormulaSummary.find((summary) => summary.mode === mode)
                            if (!item?.count) return null

                            return (
                              <div key={mode} className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-3 text-xs">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-surface-800">{item.label}</div>
                                    <div className="mt-1 text-surface-500">
                                      ทั้งหมด {item.count.toLocaleString('th-TH')} รายการ
                                    </div>
                                  </div>
                                  <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${item.readyCount ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-surface-500'}`}>
                                    พร้อม {item.readyCount.toLocaleString('th-TH')}
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <label className="label">หน่วยผลลัพธ์จาก unit master</label>
                                  <select
                                    className="select"
                                    value={footprintResultUnitSelections[mode] ?? ''}
                                    onChange={(event) => updateFootprintResultUnitSelection(mode, event.target.value)}
                                  >
                                    <option value="">ใช้ค่า default ของระบบ ({getFootprintExpectedResultUnitLabel(mode)})</option>
                                    {supportedFootprintResultUnits.map((unit) => (
                                      <option key={unit.unit_id} value={unit.unit_id}>
                                        {unitLabel(unit)}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    className="btn-ghost btn-sm"
                                    onClick={() => openFootprintUnitCreate(mode)}
                                    disabled
                                    title="ปุ่มนี้โชว์ไว้ก่อน ระบบจะใช้แค่หน่วย kgCO2e และ tCO2e ในรอบนี้"
                                  >
                                    <Plus size={13} /> เพิ่มหน่วยใหม่
                                  </button>
                                  <span className="text-[11px] text-surface-500">
                                    ตอนนี้ตัวเลือกถูกจำกัดไว้เฉพาะหน่วยผลลัพธ์กลุ่ม `kgCO2e` และ `tCO2e`
                                  </span>
                                </div>

                                {footprintUnitCreateMode === mode && (
                                  <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-[#d9e7f2] bg-white px-3 py-3">
                                    <input
                                      className="input"
                                      placeholder="ชื่อหน่วย เช่น kilogram CO2e หรือ tonne CO2e"
                                      value={footprintNewUnitName}
                                      onChange={(event) => setFootprintNewUnitName(event.target.value)}
                                    />
                                    <input
                                      className="input"
                                      placeholder="ตัวย่อ เช่น kgCO2e หรือ tCO2e"
                                      value={footprintNewUnitInitial}
                                      onChange={(event) => setFootprintNewUnitInitial(event.target.value)}
                                    />
                                    <p className="text-xs text-surface-500">
                                      เพิ่มได้เฉพาะ alias ที่ระบบแปลได้เป็น `kgCO2e` หรือ `tCO2e`
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="btn-primary btn-sm"
                                        disabled={!footprintNewUnitName.trim() || saveFootprintUnitMut.isPending}
                                        onClick={() => submitFootprintUnitCreate(mode)}
                                      >
                                        เพิ่มเข้า unit master
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-secondary btn-sm"
                                        onClick={() => setFootprintUnitCreateMode(null)}
                                      >
                                        ยกเลิก
                                      </button>
                                    </div>
                                    {footprintUnitCreateError && (
                                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                        {footprintUnitCreateError}
                                      </div>
                                    )}
                                    {saveFootprintUnitMut.isError && (
                                      <div className="text-[11px] text-red-700">{getErrorMessage(saveFootprintUnitMut.error)}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-4 rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-3 text-xs text-surface-600">
                          ตาราง preview ทางขวาเป็น <span className="font-medium text-surface-800">Frontend preview</span> เพื่อให้เห็นค่าประมาณและหน่วยผลลัพธ์ก่อนกดยืนยันจริง
                        </div>
                      </section>

                      {fertilizerModalRows.length > 0 && (
                        <section className="rounded-xl border border-[#d9e7f2] bg-white/85 p-4">
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold">เลือก สปส สำหรับสูตรปุ๋ย</h4>
                            <p className="mt-1 text-xs text-surface-500">
                              ระบบจะใช้ค่า `Emission Factor value total` ของ EF ที่เลือกสำหรับ `ยูเรีย as N`, `DAP as P2O5`, `KCl as K2O` และใช้ค่า `GWP` ที่เลือกสำหรับ `N2O` ทั้งใน frontend preview และตอนคำนวณจริง
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {FERTILIZER_FACTOR_FIELD_CONFIGS.map((config) => {
                              const selectedEfId = footprintFertilizerFactorSelections[config.selectionKey]
                              const selectedEf = selectedEfId ? efById[Number(selectedEfId)] : undefined
                              const defaultSuggestions = [...fertilizerFactorSelectableEfs]
                                .sort((left, right) => scoreFertilizerFactorEfCandidate(config, right) - scoreFertilizerFactorEfCandidate(config, left))
                              const searchValue = footprintFertilizerFactorSearchInputs[config.selectionKey]
                                ?? (selectedEf ? getFuelEfOptionLabel(selectedEf, unitById) : '')
                              const normalizedSearch = searchValue.trim().toLowerCase()
                              const filteredSuggestions = (
                                normalizedSearch
                                  ? defaultSuggestions.filter((item) => getFuelEfOptionLabel(item, unitById).toLowerCase().includes(normalizedSearch))
                                  : defaultSuggestions
                              ).slice(0, 8)
                              const showSuggestionPanel = footprintFertilizerFactorFocusedKey === config.selectionKey && filteredSuggestions.length > 0

                              return (
                                <div key={config.selectionKey} className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-3">
                                  <div className="mb-2 text-sm font-semibold text-surface-800">{config.label}</div>
                                  <div className="relative">
                                    <input
                                      className="input w-full"
                                      value={searchValue}
                                      placeholder={config.placeholder}
                                      onFocus={() => setFootprintFertilizerFactorFocusedKey(config.selectionKey)}
                                      onBlur={() => {
                                        window.setTimeout(() => {
                                          setFootprintFertilizerFactorFocusedKey((current) => (current === config.selectionKey ? null : current))
                                        }, 120)
                                      }}
                                      onChange={(event) => updateFootprintFertilizerFactorEfSearchInput(config, event.target.value, defaultSuggestions)}
                                    />
                                    {showSuggestionPanel && (
                                      <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-[#d9e7f2] bg-white shadow-[0_18px_40px_rgba(35,49,66,0.18)]">
                                        {filteredSuggestions.map((item) => {
                                          const optionLabel = getFuelEfOptionLabel(item, unitById)
                                          const isActive = String(item.coefficient_emission_factor_id) === selectedEfId

                                          return (
                                            <button
                                              key={`${config.selectionKey}-${item.coefficient_emission_factor_id}`}
                                              type="button"
                                              className={`block w-full border-b border-[#eef3f8] px-3 py-3 text-left text-[11px] leading-5 transition last:border-b-0 ${isActive ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-surface-700 hover:bg-slate-50'}`}
                                              onMouseDown={(event) => {
                                                event.preventDefault()
                                                applyFootprintFertilizerFactorEfSelection(config, item)
                                              }}
                                            >
                                              <div className="font-medium text-surface-800">{item.coef_em_factor_name?.trim() || item.coef_em_factor_idCode?.trim() || `EF #${item.coefficient_emission_factor_id}`}</div>
                                              <div className="mt-1 whitespace-normal break-words text-surface-500">{optionLabel}</div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2 text-[11px] text-surface-500">
                                    ค่า default จากเอกสารคือ {formatNumberish(config.defaultValue, 6)}
                                  </div>
                                  <div className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] leading-5 text-surface-600">
                                    {selectedEf
                                      ? `EF_total ที่ใช้ = ${formatNumberish(selectedEf.coef_em_factor_value_total, 6)}`
                                      : `ยังไม่ได้เลือก EF ระบบจะ fallback เป็น ${formatNumberish(config.defaultValue, 6)}`}
                                  </div>
                                </div>
                              )
                            })}

                            {(() => {
                              const selectedGwp = footprintFertilizerFactorSelections.gwpN2OId
                                ? gwpById[Number(footprintFertilizerFactorSelections.gwpN2OId)]
                                : undefined
                              const defaultSuggestions = [...gwps].sort((left, right) => scoreGwpCandidate(right) - scoreGwpCandidate(left))
                              const searchValue = footprintFertilizerFactorSearchInputs.gwpN2OId
                                ?? (selectedGwp ? getGwpOptionLabel(selectedGwp) : '')
                              const normalizedSearch = searchValue.trim().toLowerCase()
                              const filteredSuggestions = (
                                normalizedSearch
                                  ? defaultSuggestions.filter((item) => getGwpOptionLabel(item).toLowerCase().includes(normalizedSearch))
                                  : defaultSuggestions
                              ).slice(0, 8)
                              const showSuggestionPanel = footprintFertilizerFactorFocusedKey === 'gwpN2OId' && filteredSuggestions.length > 0

                              return (
                                <div className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-3">
                                  <div className="mb-2 text-sm font-semibold text-surface-800">GWP N2O</div>
                                  <div className="relative">
                                    <input
                                      className="input w-full"
                                      value={searchValue}
                                      placeholder="ค้นหา GWP สำหรับ N2O"
                                      onFocus={() => setFootprintFertilizerFactorFocusedKey('gwpN2OId')}
                                      onBlur={() => {
                                        window.setTimeout(() => {
                                          setFootprintFertilizerFactorFocusedKey((current) => (current === 'gwpN2OId' ? null : current))
                                        }, 120)
                                      }}
                                      onChange={(event) => updateFootprintFertilizerGwpSearchInput(event.target.value, defaultSuggestions)}
                                    />
                                    {showSuggestionPanel && (
                                      <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-[#d9e7f2] bg-white shadow-[0_18px_40px_rgba(35,49,66,0.18)]">
                                        {filteredSuggestions.map((item) => {
                                          const optionLabel = getGwpOptionLabel(item)
                                          const isActive = String(item.coefficients_emissions_factors_gwp_id) === footprintFertilizerFactorSelections.gwpN2OId

                                          return (
                                            <button
                                              key={`gwp-${item.coefficients_emissions_factors_gwp_id}`}
                                              type="button"
                                              className={`block w-full border-b border-[#eef3f8] px-3 py-3 text-left text-[11px] leading-5 transition last:border-b-0 ${isActive ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-surface-700 hover:bg-slate-50'}`}
                                              onMouseDown={(event) => {
                                                event.preventDefault()
                                                applyFootprintFertilizerGwpSelection(item)
                                              }}
                                            >
                                              <div className="font-medium text-surface-800">{item.coef_em_factor_gwp_name?.trim() || item.coef_em_factor_gwp_name_en?.trim() || `GWP #${item.coefficients_emissions_factors_gwp_id}`}</div>
                                              <div className="mt-1 whitespace-normal break-words text-surface-500">{optionLabel}</div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2 text-[11px] text-surface-500">
                                    ค่า default จากเอกสารคือ {formatNumberish(FERTILIZER_CFP_SIMPLE_CONSTANTS.GWP_N2O, 6)}
                                  </div>
                                  <div className="mt-2 rounded-lg bg-white px-3 py-2 text-[11px] leading-5 text-surface-600">
                                    {selectedGwp
                                      ? `GWP ที่ใช้ = ${formatNumberish(selectedGwp.coef_em_factor_gwp_value, 6)}`
                                      : `ยังไม่ได้เลือก GWP ระบบจะ fallback เป็น ${formatNumberish(FERTILIZER_CFP_SIMPLE_CONSTANTS.GWP_N2O, 6)}`}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </section>
                      )}

                      {fertilizerRowsMissingDetectedFormula.length > 0 && (
                        <section className="rounded-xl border border-[#d9e7f2] bg-white/85 p-4">
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold">กรอก N-P2O5-K2O แทนสูตรที่ดึงจากชื่อไม่ได้</h4>
                            <p className="mt-1 text-xs text-surface-500">
                              ใช้สำหรับปุ๋ยอินทรีย์หรือปุ๋ยอื่นที่ชื่อรายการไม่มีสูตร N-P2O5-K2O ชัดเจน ระบบจะใช้ค่าที่กรอกนี้ทั้งใน frontend preview และตอนคำนวณจริง
                            </p>
                          </div>

                          <div className="space-y-3">
                            {fertilizerRowsMissingDetectedFormula.map((row) => {
                              const profile = getFertilizerNitrogenProfile(row.resourceItemName)
                              const manualInput = footprintManualFertilizerFormulaInputs[row.id] ?? EMPTY_MANUAL_FERTILIZER_FORMULA_INPUT
                              const manualFormula = parseManualFertilizerFormulaInput(manualInput)
                              const inputError = getManualFertilizerFormulaInputError(manualInput)

                              return (
                                <div key={`manual-fertilizer-formula-${row.id}`} className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-3">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-surface-800">{row.resourceItemName}</div>
                                      <div className="text-[11px] text-surface-500">{row.headerLabel} · {row.landLabel}</div>
                                    </div>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-surface-600">
                                      {profile.label} · {profile.reason}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    {([
                                      { key: 'nPercent', label: 'N (%)' },
                                      { key: 'p2o5Percent', label: 'P2O5 (%)' },
                                      { key: 'k2oPercent', label: 'K2O (%)' },
                                    ] as const).map((field) => (
                                      <div key={`${row.id}-${field.key}`}>
                                        <label className="label">{field.label}</label>
                                        <input
                                          className="input"
                                          type="number"
                                          inputMode="decimal"
                                          min="0"
                                          step="0.0001"
                                          placeholder="0.0000"
                                          value={manualInput[field.key]}
                                          onChange={(event) => updateFootprintManualFertilizerFormulaInput(row.id, field.key, event.target.value)}
                                        />
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-surface-600">
                                    <span className="rounded-full bg-white px-2.5 py-1">
                                      ปริมาณที่ใช้คำนวณ: {row.calculationAmountLabel} {row.preparedUnitLabel}
                                    </span>
                                    <span className="rounded-full bg-white px-2.5 py-1">
                                      filler: {manualFormula ? formatNumberish(manualFormula.fillerPercent, 4) : '—'} %
                                    </span>
                                    <span className="rounded-full bg-white px-2.5 py-1">
                                      สูตรที่ใช้: {manualFormula?.formulaLabel ?? 'รอกรอกให้ครบ'}
                                    </span>
                                  </div>

                                  {inputError && (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                      {inputError}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      )}

                      {footprintModalFuelRows.length > 0 && (
                        <section className="rounded-xl border border-[#d9e7f2] bg-white/85 p-4">
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold">เลือก EF สำหรับรายการน้ำมัน</h4>
                            <p className="mt-1 text-xs text-surface-500">
                              เลือก `EF_total` จากตาราง `coefficients_emissions_factors` เพื่อให้ระบบใช้ค่าที่คุณเลือกมาคูณกับ activity amount โดยตรง
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="label">CF Type</label>
                              <select className="select" value={footprintEfFilterCfTypeId} onChange={(event) => setFootprintEfFilterCfTypeId(event.target.value)}>
                                <option value="">ทั้งหมด</option>
                                {cfTypes.map((item) => (
                                  <option key={item.carbonfootprint_type_id} value={item.carbonfootprint_type_id}>
                                    {cfTypeMap[item.carbonfootprint_type_id]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">กลุ่ม EF</label>
                              <select className="select" value={footprintEfFilterGroupId} onChange={(event) => setFootprintEfFilterGroupId(event.target.value)}>
                                <option value="">ทั้งหมด</option>
                                {filteredFuelEfGroups.map((item) => (
                                  <option key={item.group_emission_factor_id} value={item.group_emission_factor_id}>
                                    {efGroupMap[item.group_emission_factor_id]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Unit</label>
                              <select className="select" value={footprintEfFilterUnitId} onChange={(event) => setFootprintEfFilterUnitId(event.target.value)}>
                                <option value="">ทั้งหมด</option>
                                {units.map((unit) => (
                                  <option key={unit.unit_id} value={unit.unit_id}>
                                    {unitLabel(unit)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">ค้นหา EF</label>
                              <input
                                className="input"
                                placeholder="รหัส EF, ชื่อ EF, รายละเอียด, กลุ่ม หรือหน่วย"
                                value={footprintEfFilterSearch}
                                onChange={(event) => setFootprintEfFilterSearch(event.target.value)}
                              />
                            </div>
                          </div>

                          <div className="mt-3 rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-2 text-xs text-surface-600">
                            พบ EF_total ที่เลือกได้ {selectableFuelEfs.length.toLocaleString('th-TH')} รายการ
                          </div>

                          <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-[#d9e7f2]">
                            <table className="w-full min-w-[1760px] text-left text-xs">
                              <thead className="sticky top-0 bg-[#f3f7fb] text-surface-600">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">หัวข้อกิจกรรม</th>
                                  <th className="px-3 py-2 font-semibold">รายการน้ำมัน</th>
                                  <th className="px-3 py-2 font-semibold">ปริมาณที่ใช้</th>
                                  <th className="px-3 py-2 font-semibold">หน่วยหลังเตรียม</th>
                                  <th className="px-3 py-2 font-semibold">เลือก EF_total</th>
                                  <th className="px-3 py-2 font-semibold">EF ที่เลือก</th>
                                  <th className="px-3 py-2 font-semibold">Preview result</th>
                                  <th className="px-3 py-2 font-semibold">Preview unit</th>
                                  <th className="px-3 py-2 font-semibold">สถานะ</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e5eef5] bg-white">
                            {footprintModalFuelRows.map((row) => {
                              const selectedEfId = footprintSelectedEfIds[row.id] ?? ''
                              const selectedEf = selectedEfId ? efById[Number(selectedEfId)] : undefined
                              const preview = footprintModalRowPreviewById[row.id]
                              const rowSelectableFuelEfs = selectableFuelEfs.filter((item) => getEfInputUnitId(item) === getRowCalculationUnitId(row))
                              const efOptions = rowSelectableFuelEfs.length > 0 ? rowSelectableFuelEfs : selectableFuelEfs
                              const efSearchValue = footprintFuelEfSearchInputs[row.id]
                                ?? (selectedEf ? getFuelEfOptionLabel(selectedEf, unitById) : '')
                              const normalizedEfSearchValue = efSearchValue.trim().toLowerCase()
                              const filteredEfSuggestions = (
                                normalizedEfSearchValue
                                  ? efOptions.filter((item) => getFuelEfOptionLabel(item, unitById).toLowerCase().includes(normalizedEfSearchValue))
                                  : efOptions
                              ).slice(0, 8)
                              const showEfSuggestionPanel = footprintFuelEfFocusedRowId === row.id && filteredEfSuggestions.length > 0

                              return (
                                <tr key={`fuel-ef-${row.id}`}>
                                  <td className="px-3 py-2 align-top">
                                    <div className="min-w-[140px]">
                                      <div className="font-medium text-surface-800">{row.headerLabel}</div>
                                      <div className="text-[11px] text-surface-500">{row.campLabel} · {row.landLabel}</div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 align-top">{row.resourceItemName}</td>
                                  <td className="px-3 py-2 align-top font-mono">{row.calculationAmountLabel}</td>
                                  <td className="px-3 py-2 align-top">{row.preparedUnitLabel}</td>
                                  <td className="px-3 py-2 align-top min-w-[560px]">
                                    <div className="relative">
                                      <input
                                        className="input w-full min-w-[560px]"
                                        value={efSearchValue}
                                        placeholder="พิมพ์เพื่อค้นหา แล้วเลือก EF_total สำหรับรายการนี้"
                                        onFocus={() => setFootprintFuelEfFocusedRowId(row.id)}
                                        onBlur={() => {
                                          window.setTimeout(() => {
                                            setFootprintFuelEfFocusedRowId((current) => (current === row.id ? null : current))
                                          }, 120)
                                        }}
                                        onChange={(event) => updateFootprintFuelEfSearchInput(row.id, event.target.value, efOptions)}
                                      />
                                      {showEfSuggestionPanel && (
                                        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-[#d9e7f2] bg-white shadow-[0_18px_40px_rgba(35,49,66,0.18)]">
                                          {filteredEfSuggestions.map((item) => {
                                            const optionLabel = getFuelEfOptionLabel(item, unitById)
                                            const isActive = String(item.coefficient_emission_factor_id) === selectedEfId

                                            return (
                                              <button
                                                key={item.coefficient_emission_factor_id}
                                                type="button"
                                                className={`block w-full border-b border-[#eef3f8] px-3 py-3 text-left text-[11px] leading-5 transition last:border-b-0 ${isActive ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-surface-700 hover:bg-slate-50'}`}
                                                onMouseDown={(event) => {
                                                  event.preventDefault()
                                                  applyFootprintFuelEfSelection(row.id, item)
                                                }}
                                              >
                                                <div className="font-medium text-surface-800">{item.coef_em_factor_name?.trim() || item.coef_em_factor_idCode?.trim() || `EF #${item.coefficient_emission_factor_id}`}</div>
                                                <div className="mt-1 whitespace-normal break-words text-surface-500">{optionLabel}</div>
                                              </button>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-1 text-[11px] text-surface-500">
                                      ค้นหาได้จากรหัส EF, ชื่อ, ค่า EF_total และหน่วย ก่อนเลือกจากรายการที่ระบบแนะนำ
                                    </div>
                                    {!!efSearchValue && (
                                      <div className="mt-1 whitespace-normal break-words rounded-lg bg-slate-50 px-2 py-2 text-[11px] leading-5 text-surface-600">
                                        {efSearchValue}
                                      </div>
                                    )}
                                    {rowSelectableFuelEfs.length === 0 && (
                                      <div className="mt-1 text-[11px] text-amber-700">
                                        ไม่พบ EF หน่วยตรง ระบบจึงแสดง EF_total ทั้งหมดที่ผ่าน filter ให้เลือกแทน
                                      </div>
                                    )}
                                  </td>
                                  <td className="min-w-[460px] px-3 py-2 align-top">
                                    {selectedEf ? (
                                      <div className="space-y-1">
                                        <div className="whitespace-normal break-words font-medium leading-5 text-emerald-800">
                                          {selectedEf.coef_em_factor_name?.trim() || selectedEf.coef_em_factor_idCode?.trim() || `EF #${selectedEf.coefficient_emission_factor_id}`}
                                        </div>
                                        <div className="whitespace-normal break-words text-[11px] leading-5 text-surface-500">
                                          EF_total {formatNumberish(selectedEf.coef_em_factor_value_total, 6)} · input {getEfInputUnitId(selectedEf) != null ? (unitById[getEfInputUnitId(selectedEf) ?? 0] ? unitLabel(unitById[getEfInputUnitId(selectedEf) ?? 0]) : `#${getEfInputUnitId(selectedEf)}`) : '—'} · result {getEfTotalResultUnitId(selectedEf) != null ? (unitById[getEfTotalResultUnitId(selectedEf) ?? 0] ? unitLabel(unitById[getEfTotalResultUnitId(selectedEf) ?? 0]) : `#${getEfTotalResultUnitId(selectedEf)}`) : '—'}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-amber-700">ยังไม่ได้เลือก EF</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 align-top font-mono">{preview?.previewResultLabel ?? '—'}</td>
                                  <td className="px-3 py-2 align-top">
                                    <span className="font-medium">{preview?.previewResultUnitLabel ?? '—'}</span>
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    <div className="space-y-1">
                                      <span className={preview ? getFootprintPreviewStatusClass(preview.previewStatusKind) : getFootprintInputStatusClass(row.inputStatusKind)}>
                                        {preview?.previewStatusLabel ?? row.inputStatusLabel}
                                      </span>
                                      {preview?.previewFormulaText && (
                                        <div className="font-mono text-[11px] leading-5 text-surface-500">{preview.previewFormulaText}</div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      {FOOTPRINT_UNSUPPORTED_FORMULA_MODES.some((mode) => footprintModalUnsupportedRows.some((row) => row.formulaMode === mode)) && (
                        <section className="rounded-xl border border-[#f5dfb8] bg-[#fffaf0] p-4">
                          <h4 className="mb-3 text-sm font-semibold text-amber-800">สูตรที่ยังไม่รองรับในรอบนี้</h4>
                          <div className="space-y-2">
                            {FOOTPRINT_UNSUPPORTED_FORMULA_MODES.map((mode) => {
                              const item = footprintModalFormulaSummary.find((summary) => summary.mode === mode)
                              if (!item?.count) return null

                              return (
                                <div key={mode} className="flex items-center justify-between gap-3 rounded-xl border border-[#f3dfbd] bg-white px-3 py-2 text-xs">
                                  <div className="font-medium text-surface-800">{item.label}</div>
                                  <div className="text-surface-500">{item.count.toLocaleString('th-TH')} รายการ</div>
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      )}
                    </div>

                    <div
                      className="relative hidden xl:flex w-5 shrink-0 cursor-col-resize select-none items-center justify-center"
                      onMouseDown={startFootprintModalResize}
                      title="ลากเพื่อปรับความกว้างของ panel ฝั่งซ้าย"
                    >
                      <div className={`h-full w-px ${isFootprintModalResizing ? 'bg-cyan-500' : 'bg-[#d9e7f2]'}`} />
                      <div className={`absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 rounded-full transition ${isFootprintModalResizing ? 'bg-cyan-100/80' : 'hover:bg-slate-100'}`} />
                    </div>

                    <div className="space-y-4 xl:min-h-0 xl:min-w-0 xl:flex-1 xl:overflow-y-auto xl:pl-3 xl:pr-1">
                      <section className="rounded-xl border border-[#d9e7f2] bg-white/90 p-4">
                        <h4 className="mb-3 text-sm font-semibold">Frontend preview ก่อนคำนวณจริง</h4>
                        <div className="rounded-xl border border-[#d9e7f2] bg-[#101827] px-4 py-4 text-xs text-slate-100">
                          <div className="space-y-4">
                            {footprintPreviewCodeGroups.map((group) => {
                              if (!group) return null

                              return (
                                <div key={`preview-code-${group.mode}`}>
                                  <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-slate-400">
                                    {group.label}
                                  </div>
                                  <div className="space-y-3">
                                    {group.rows.map(({ row, preview, selectedEf, fertilizerFactorValues, manualFormulaInput }) => {
                                      const fertilizerBreakdown = group.mode === 'fertilizer_n2o' && row.calculationAmount != null
                                        ? calculateFertilizerCfpSimplePreview({
                                          fertilizerKg: row.calculationAmount,
                                          fertilizerProfile: getFertilizerNitrogenProfile(row.resourceItemName),
                                          factorValues: fertilizerFactorValues,
                                          manualFormulaInput,
                                        })
                                        : null

                                      return (
                                      <div key={`preview-code-row-${row.id}`} className="rounded-xl border border-[#233142] bg-[#0b1220] px-4 py-3">
                                        <div className="mb-2 text-[11px] text-slate-400">
                                          {`// ${row.headerLabel} · ${row.resourceItemName}`}
                                        </div>

                                        {group.mode === 'fertilizer_n2o' && (
                                          <div className="space-y-1 font-mono leading-6">
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">fertilizerKg</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{row.calculationAmountLabel}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">fertilizerFormula</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{fertilizerBreakdown?.formulaLabel ?? 'กรอก N-P2O5-K2O หรือใช้สูตรจากชื่อรายการ'}"</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">nPercent</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{fertilizerBreakdown ? formatNumberish(fertilizerBreakdown.nFraction * 100, 3) : row.nValueLabel}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">p2o5Percent</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{fertilizerBreakdown ? formatNumberish(fertilizerBreakdown.p2o5Fraction * 100, 3) : '—'}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">k2oPercent</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{fertilizerBreakdown ? formatNumberish(fertilizerBreakdown.k2oFraction * 100, 3) : '—'}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">upstreamKgCO2e</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{fertilizerBreakdown ? formatNumberish(fertilizerBreakdown.upstreamKgco2e, 4) : '—'}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">usePhaseKgCO2e</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{fertilizerBreakdown ? formatNumberish(fertilizerBreakdown.usePhaseKgco2e, 4) : '—'}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">selectedUreaEfTotal</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{formatNumberish(fertilizerFactorValues.ureaAsNValue, 6)}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">selectedDapEfTotal</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{formatNumberish(fertilizerFactorValues.dapAsP2O5Value, 6)}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">selectedKclEfTotal</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{formatNumberish(fertilizerFactorValues.kclAsK2OValue, 6)}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">selectedGwpN2O</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{formatNumberish(fertilizerFactorValues.gwpN2OValue, 6)}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewFormula</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewFormulaText ?? 'fertilizerKg x [upstream + use phase]'}"</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewResult</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">{preview?.previewResultLabel ?? '—'}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewUnit</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewResultUnitLabel ?? 'kgCO2e'}"</span>
                                            </div>
                                          </div>
                                        )}

                                        {group.mode === 'generic_ef' && row.rowType === 'fuel' && (
                                          <div className="space-y-1 font-mono leading-6">
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">activityAmount</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{row.calculationAmountLabel}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">selectedEfTotal</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{selectedEf?.coef_em_factor_value_total != null ? formatNumberish(selectedEf.coef_em_factor_value_total, 6) : 'undefined'}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewFormula</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewFormulaText ?? 'activityAmount x EF_total'}"</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewResult</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">
                                                {preview?.previewResultLabel ?? '—'}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewUnit</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewResultUnitLabel ?? 'kgCO2e'}"</span>
                                            </div>
                                          </div>
                                        )}

                                        {group.mode === 'generic_ef' && row.rowType !== 'fuel' && (
                                          <div className="space-y-1 font-mono leading-6">
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">activityAmount</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-amber-300">{row.calculationAmountLabel}</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewStatus</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewStatusLabel ?? 'จะ resolve EF ตอนคำนวณจริง'}"</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewUnit</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewResultUnitLabel ?? 'kgCO2e'}"</span>
                                            </div>
                                          </div>
                                        )}

                                        {(group.mode === 'fnfix_group' || group.mode === 'soc_removal') && (
                                          <div className="space-y-1 font-mono leading-6">
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewStatus</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewStatusLabel ?? 'ยังไม่รองรับ'}"</span>
                                            </div>
                                            <div>
                                              <span className="text-sky-300">const</span>{' '}
                                              <span className="text-emerald-300">previewFormula</span>{' '}
                                              <span className="text-slate-300">=</span>{' '}
                                              <span className="text-orange-300">"{preview?.previewFormulaText ?? 'ยังไม่มีสูตรจำลอง'}"</span>
                                            </div>
                                          </div>
                                        )}

                                        <div className="mt-2 text-[11px] text-emerald-300">
                                          {`// previewResult = ${preview?.previewResultLabel ?? '—'} ${preview?.previewResultUnitLabel ?? ''}`}
                                        </div>
                                      </div>
                                      )
                                    })}
                                  </div>
                                  {group.hiddenCount > 0 && (
                                    <div className="mt-2 text-[11px] text-slate-400">
                                      {`// + อีก ${group.hiddenCount.toLocaleString('th-TH')} รายการในกลุ่ม ${group.label}`}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </section>

                      {FOOTPRINT_SUPPORTED_FORMULA_MODES.map((mode) => {
                        const modeRows = footprintModalReadyRows.filter((row) => row.formulaMode === mode)
                        if (!modeRows.length) return null

                        return (
                          <section key={mode} className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                            <h4 className="mb-3 text-sm font-semibold">รายการพร้อมคำนวณ: {getFootprintFormulaModeLabel(mode)}</h4>
                            {renderFootprintRowsTable(modeRows)}
                          </section>
                        )
                      })}

                      {!footprintModalReadyRows.length && (
                        <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                          <h4 className="mb-3 text-sm font-semibold">รายการพร้อมคำนวณ</h4>
                          {renderFootprintRowsTable([])}
                        </section>
                      )}

                      {footprintModalBlockedRows.length > 0 && (
                        <section className="rounded-xl border border-[#f1d3d3] bg-[#fff8f8] p-4">
                          <h4 className="mb-3 text-sm font-semibold text-red-800">รายการที่ input ยังไม่ครบ</h4>
                          {renderFootprintRowsTable(footprintModalBlockedRows, { reason: 'blocked' })}
                        </section>
                      )}

                      {FOOTPRINT_UNSUPPORTED_FORMULA_MODES.map((mode) => {
                        const modeRows = footprintModalUnsupportedRows.filter((row) => row.formulaMode === mode)
                        if (!modeRows.length) return null

                        return (
                          <section key={mode} className="rounded-xl border border-[#f5dfb8] bg-[#fffaf0] p-4">
                            <h4 className="mb-3 text-sm font-semibold text-amber-800">สูตรยังไม่รองรับ: {getFootprintFormulaModeLabel(mode)}</h4>
                            {renderFootprintRowsTable(modeRows, { reason: 'unsupported' })}
                          </section>
                        )
                      })}
                    </div>
                  </div>

                  <div className="shrink-0 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" className="btn-secondary flex-1 justify-center" onClick={closeFootprintCalculationModal}>
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        className="btn-primary flex-1 justify-center"
                        disabled={!footprintModalReadyRows.length || footprintModalFuelRowsMissingEf.length > 0 || footprintManualFertilizerFormulaRowsMissingInput.length > 0}
                        onClick={() => { void startFootprintCalculation() }}
                      >
                        <Calculator size={14} /> ยืนยันและเริ่มคำนวณ
                      </button>
                    </div>
                    {(footprintModalFuelRowsMissingEf.length > 0 || footprintManualFertilizerFormulaRowsMissingInput.length > 0) && (
                      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                        <div className="space-y-2 break-words">
                          {footprintModalFuelRowsMissingEf.length > 0 && (
                            <div>กรุณาเลือก EF ให้ครบทุกรายการน้ำมันก่อนเริ่มคำนวณ</div>
                          )}
                          {footprintManualFertilizerFormulaRowsMissingInput.length > 0 && (
                            <div>กรุณากรอก N, P2O5 และ K2O ให้ครบสำหรับปุ๋ยที่ไม่มีสูตรในชื่อรายการก่อนเริ่มคำนวณ</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {footprintCalculationModal.kind === 'running' && (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(91,164,255,0.22),rgba(91,164,255,0.08),transparent_72%)]">
                    <LoaderCircle size={40} className="animate-spin text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-surface-900">กำลังคำนวณทีละรายการ</h3>
                  <p className="mt-2 text-sm text-surface-600">
                    ระบบกำลังประมวลผล {footprintCalculationModal.currentIndex.toLocaleString('th-TH')} / {footprintModalReadyRows.length.toLocaleString('th-TH')} รายการ
                  </p>
                  <div className="mt-2 text-sm font-medium text-surface-800">{footprintCalculationModal.currentLabel || 'กำลังเริ่มคำนวณ'}</div>
                  <div className="mt-4 w-full max-w-md overflow-hidden rounded-full bg-[#eaf1f7]">
                    <div
                      className="h-2 rounded-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${footprintModalReadyRows.length ? (footprintCalculationModal.currentIndex / footprintModalReadyRows.length) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-2 text-xs text-surface-700">
                    <div className="rounded-xl border border-[#cfe7d9] bg-[#f2fbf5] px-3 py-2">
                      <span className="block text-surface-500">สำเร็จ</span>
                      <strong className="text-sm text-emerald-700">{footprintCalculationModal.successRows.length.toLocaleString('th-TH')}</strong>
                    </div>
                    <div className="rounded-xl border border-[#f1d3d3] bg-[#fff8f8] px-3 py-2">
                      <span className="block text-surface-500">ไม่สำเร็จ</span>
                      <strong className="text-sm text-red-700">{footprintCalculationModal.failedRows.length.toLocaleString('th-TH')}</strong>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-full border border-[#d9e7f2] bg-white/85 px-4 py-2 text-xs text-surface-500 shadow-sm">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="ml-1">กำลังส่งคำขอแบบเรียงลำดับทีละ row</span>
                  </div>
                </div>
              )}

              {footprintCalculationModal.kind === 'complete' && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center">
                    <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
                      footprintCalculationModal.failedRows.length
                        ? 'bg-[radial-gradient(circle_at_30%_30%,rgba(245,158,11,0.24),rgba(245,158,11,0.08),transparent_72%)]'
                        : 'bg-[radial-gradient(circle_at_30%_30%,rgba(78,143,106,0.24),rgba(78,143,106,0.08),transparent_72%)]'
                    }`}>
                      {footprintCalculationModal.failedRows.length
                        ? <CircleAlert size={40} className="text-amber-600" />
                        : <CheckCircle2 size={40} className="text-green-600" />}
                    </div>
                    <h3 className="text-lg font-semibold text-surface-900">สรุปผลการคำนวณ</h3>
                    <p className="mt-2 text-sm text-surface-600">
                      สำเร็จ {footprintCalculationModal.successRows.length.toLocaleString('th-TH')} รายการ, ไม่สำเร็จ {footprintCalculationModal.failedRows.length.toLocaleString('th-TH')} รายการ
                    </p>
                    {footprintCalculationModal.countdown != null && (
                      <div className="mt-4 rounded-2xl border border-[#d9e7f2] bg-white/90 px-4 py-3 shadow-sm">
                        <span className="text-xs text-surface-500">หน้าต่างนี้จะปิดอัตโนมัติใน </span>
                        <span className="countdown text-sm">{footprintCalculationModal.countdown}</span>
                        <span className="text-xs text-surface-500"> วินาที</span>
                      </div>
                    )}
                  </div>

                  {footprintCalculationModal.successRows.length > 0 && (
                    <section className="rounded-xl border border-[#cfe7d9] bg-[#f2fbf5] p-4">
                      <h4 className="mb-3 text-sm font-semibold text-emerald-800">รายการสำเร็จ</h4>
                      {renderFootprintRowsTable(
                        footprintCalculationModal.successRows.map((item) => item.row),
                        { result: footprintCalculationModal.successRows },
                      )}
                    </section>
                  )}

                  {footprintCalculationModal.failedRows.length > 0 && (
                    <section className="rounded-xl border border-[#f1d3d3] bg-[#fff8f8] p-4">
                      <h4 className="mb-3 text-sm font-semibold text-red-800">รายการที่ไม่สำเร็จ</h4>
                      {renderFootprintRowsTable(
                        footprintCalculationModal.failedRows.map((item) => item.row),
                        { result: footprintCalculationModal.failedRows },
                      )}
                    </section>
                  )}

                  <div className="flex justify-center">
                    <button type="button" className="btn-primary min-w-[12rem] justify-center" onClick={closeFootprintCalculationModal}>
                      ปิดหน้าต่าง
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isPreparationMode && bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={closeBulkModal} />
            <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg animate-slide-up">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <Wand2 size={17} className="text-primary-600" />
                    ทำรายการทั้งหมดจากที่เลือก
                  </h3>
                  <p className="mt-1 text-xs text-surface-500">ปรับหน่วยและปริมาณของข้อมูลกิจกรรมที่เลือก พร้อมเก็บข้อมูลประกอบของการเตรียมไว้สำหรับติดตามภายในระบบ</p>
                </div>
                <button type="button" className="btn-icon btn-ghost" onClick={closeBulkModal} disabled={bulkPreparationPopup.kind === 'loading'}>
                  <X size={16} />
                </button>
              </div>

              {bulkModalError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                  {bulkModalError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
                <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ตั้งค่าการเปลี่ยนหน่วยตามประเภท</h4>

                  <div className="space-y-3">
                    {selectedFertilizerRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/90 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-surface-800">ปุ๋ย</h5>
                            <p className="text-xs text-surface-500">{selectedFertilizerRows.length.toLocaleString('th-TH')} รายการ</p>
                          </div>
                          <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-primary-700">จำนวน x ปริมาณต่อจำนวน = kg</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="label">ปริมาณต่อจำนวน / ต่อชิ้น (kg)</label>
                            <input
                              type="number"
                              step="0.001"
                              className="input"
                              value={bulkFertilizerBagWeightKg}
                              onChange={(event) => setBulkFertilizerBagWeightKg(event.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label">ตัวคูณแปลงหน่วยจาก kg</label>
                            <input
                              type="number"
                              step="0.000001"
                              className="input"
                              value={bulkFertilizerUnitFactor}
                              onChange={(event) => setBulkFertilizerUnitFactor(event.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label">หน่วยหลังเตรียม</label>
                            <select
                              className="select"
                              value={bulkFertilizerPreparedUnitId}
                              onChange={(event) => setBulkFertilizerPreparedUnitId(event.target.value)}
                            >
                              <option value="">— กรอกหน่วยเอง —</option>
                              {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label">ชื่อหน่วยใหม่</label>
                            <input
                              className="input"
                              value={bulkFertilizerTargetUnitName}
                              onChange={(event) => setBulkFertilizerTargetUnitName(event.target.value)}
                              disabled={Boolean(bulkFertilizerPreparedUnitId)}
                              placeholder="เช่น kilogram"
                            />
                          </div>
                          <div>
                            <label className="label">ตัวย่อหน่วยใหม่</label>
                            <input
                              className="input"
                              value={bulkFertilizerTargetUnitInitial}
                              onChange={(event) => setBulkFertilizerTargetUnitInitial(event.target.value)}
                              disabled={Boolean(bulkFertilizerPreparedUnitId)}
                              placeholder="เช่น kg หรือ g"
                            />
                          </div>
                          <div className="md:col-span-2 rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-3 text-xs text-surface-600">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                              <div>ปุ๋ยเคมีที่พบสูตรอัตโนมัติ: <strong>{chemicalFertilizerCount.toLocaleString('th-TH')}</strong> รายการ</div>
                              <div>ปุ๋ยอินทรีย์ที่จะบันทึก N เป็นค่าว่าง: <strong>{organicFertilizerCount.toLocaleString('th-TH')}</strong> รายการ</div>
                              <div>ปุ๋ยที่ยังไม่ทราบ N: <strong>{unknownFertilizerCount.toLocaleString('th-TH')}</strong> รายการ</div>
                            </div>
                          </div>
                          {unknownFertilizerCount > 0 && (
                            <div>
                              <label className="label">ค่า N สำหรับปุ๋ยที่ยังไม่ทราบอัตโนมัติ</label>
                              <input
                                type="number"
                                step="0.001"
                                className="input"
                                value={bulkUnknownFertilizerN}
                                onChange={(event) => setBulkUnknownFertilizerN(event.target.value)}
                                placeholder="ปล่อยว่างไว้เพื่อให้เป็น null ก่อน"
                              />
                            </div>
                          )}
                        </div>
                        {!kgUnit && (
                          <p className="mt-2 text-xs text-amber-700">
                            ยังไม่พบหน่วย kg ใน master units ระบบจะสร้างหน่วยนี้ระหว่างบันทึกและผูกให้กับข้อมูลหลังเตรียม
                          </p>
                        )}
                        <p className="mt-2 text-xs text-surface-500">
                          สูตรปุ๋ยคือ (จำนวน x ปริมาณต่อจำนวนเป็น kg) x ตัวคูณแปลงหน่วย เช่น ถ้าต้องการ g ให้เลือกหน่วย g และใส่ตัวคูณ 1000
                        </p>
                        <p className="mt-1 text-xs text-surface-500">
                          ระบบจะพยายามอ่านค่า N อัตโนมัติจากชื่อปุ๋ยเคมี เช่น `ปุ๋ยสูตร 16-8-8` จะบันทึก N = 16 ส่วนปุ๋ยอินทรีย์จะบันทึก N เป็นค่าว่าง
                        </p>
                      </div>
                    )}

                    {selectedFuelRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/90 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-surface-800">น้ำมัน</h5>
                            <p className="text-xs text-surface-500">{selectedFuelRows.length.toLocaleString('th-TH')} รายการ</p>
                          </div>
                          <span className="rounded-full bg-[#eefbf7] px-3 py-1 text-xs font-medium text-green-700">เลือกหน่วยปลายทางได้เอง</span>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => applyBulkFuelPreset('liter')}>ใช้ preset L</button>
                          <button type="button" className="btn-secondary btn-sm" onClick={() => applyBulkFuelPreset('milliliter')}>ใช้ preset ml</button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="label">หน่วยหลังเตรียม</label>
                            <select className="select" value={bulkFuelPreparedUnitId} onChange={(event) => setBulkFuelPreparedUnitId(event.target.value)}>
                              <option value="">— กรอกหน่วยเอง / คงเดิม —</option>
                              {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label">ค่าหลังแปลงต่อจำนวน</label>
                            <input
                              type="number"
                              step="0.000001"
                              className="input"
                              value={bulkFuelValuePerUnit}
                              onChange={(event) => setBulkFuelValuePerUnit(event.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label">ชื่อหน่วยใหม่</label>
                            <input
                              className="input"
                              value={bulkFuelPreparedUnitName}
                              onChange={(event) => setBulkFuelPreparedUnitName(event.target.value)}
                              disabled={Boolean(bulkFuelPreparedUnitId)}
                              placeholder="เช่น litre"
                            />
                          </div>
                          <div>
                            <label className="label">ตัวย่อหน่วยใหม่</label>
                            <input
                              className="input"
                              value={bulkFuelPreparedUnitInitial}
                              onChange={(event) => setBulkFuelPreparedUnitInitial(event.target.value)}
                              disabled={Boolean(bulkFuelPreparedUnitId)}
                              placeholder="เช่น L หรือ m3"
                            />
                          </div>
                          <p className="text-xs text-surface-500 md:col-span-2">สูตรที่ใช้บันทึกคือ จำนวน * ค่าหลังแปลงต่อจำนวน เช่น 1000 * 0.001 = 1 m3</p>
                        </div>
                      </div>
                    )}

                    {otherGroupEntries.map((group) => {
                      const config = bulkOtherConfigs[group.key] ?? DEFAULT_OTHER_GROUP_CONFIG

                      return (
                        <div key={group.key} className="rounded-xl border border-[#d9e7f2] bg-white/90 p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <h5 className="text-sm font-semibold text-surface-800">{group.label}</h5>
                              <p className="text-xs text-surface-500">{group.rows.length.toLocaleString('th-TH')} รายการ</p>
                            </div>
                            <span className="rounded-full bg-[#fff8ec] px-3 py-1 text-xs font-medium text-amber-700">กำหนดหน่วยแยกตามหัวข้อ</span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="label">โหมดการเตรียมข้อมูล</label>
                              <select
                                className="select"
                                value={config.mode}
                                onChange={(event) => updateOtherGroupConfig(group.key, { mode: event.target.value as BulkOtherMode })}
                              >
                                <option value="keep">คงหน่วยเดิม</option>
                                <option value="factor">แปลงด้วยตัวคูณเดียวกัน</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">ตัวคูณแปลงหน่วย</label>
                              <input
                                type="number"
                                step="0.000001"
                                className="input"
                                value={config.conversionFactor}
                                onChange={(event) => updateOtherGroupConfig(group.key, { conversionFactor: event.target.value })}
                                disabled={config.mode !== 'factor'}
                              />
                            </div>
                            <div>
                              <label className="label">Prefix หน่วยหลังเตรียม</label>
                              <select
                                className="select"
                                value={config.preparedUnitPrefixId}
                                onChange={(event) => updateOtherGroupConfig(group.key, { preparedUnitPrefixId: event.target.value })}
                              >
                                <option value="">— คงค่าเดิม —</option>
                                {unitPrefixes.map((prefix) => <option key={prefix.unit_prefix_id} value={prefix.unit_prefix_id}>{prefixLabel(prefix)}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">หน่วยหลังเตรียม</label>
                              <select
                                className="select"
                                value={config.preparedUnitId}
                                onChange={(event) => updateOtherGroupConfig(group.key, { preparedUnitId: event.target.value })}
                              >
                                <option value="">— คงค่าเดิม —</option>
                                {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">ชื่อหน่วยใหม่</label>
                              <input
                                className="input"
                                value={config.preparedUnitName}
                                onChange={(event) => updateOtherGroupConfig(group.key, { preparedUnitName: event.target.value })}
                                disabled={Boolean(config.preparedUnitId)}
                                placeholder="เช่น kilogram"
                              />
                            </div>
                            <div>
                              <label className="label">ตัวย่อหน่วยใหม่</label>
                              <input
                                className="input"
                                value={config.preparedUnitInitial}
                                onChange={(event) => updateOtherGroupConfig(group.key, { preparedUnitInitial: event.target.value })}
                                disabled={Boolean(config.preparedUnitId)}
                                placeholder="เช่น kg"
                              />
                            </div>
                            <p className="text-xs text-surface-500 md:col-span-2">
                              ระบบจะสร้างส่วนนี้ให้อัตโนมัติสำหรับทุกหัวข้อที่ไม่ใช่ปุ๋ยหรือน้ำมัน และให้แต่ละหัวข้อตั้งค่าการเปลี่ยนหน่วยของตัวเองได้
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4">
                    <h5 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">Tracking หน่วยปัจจุบัน</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedUnitSummary.length ? selectedUnitSummary.map(([label, count]) => (
                        <span key={label} className="rounded-full border border-[#d9e7f2] bg-white px-3 py-1 text-xs text-surface-700">
                          {label}: {count.toLocaleString('th-TH')}
                        </span>
                      )) : (
                        <span className="text-xs text-surface-500">ยังไม่ได้เลือกรายการ</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#d9e7f2] bg-white/90 p-3 text-xs text-surface-600">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <strong className="block text-surface-800">Dynamic String Interpolation / Template Literals</strong>
                        <span>ข้อความสูตรด้านขวาถูกสร้างจากค่าที่เลือก เช่น จำนวน, ปริมาณต่อจำนวน และหน่วยปลายทาง แล้วอัปเดตทันทีเมื่อเปลี่ยนค่า</span>
                      </div>
                      <div>
                        <strong className="block text-surface-800">Frontend Simulation</strong>
                        <span>ผลลัพธ์ในตาราง preview คำนวณบนหน้าเว็บก่อน เพื่อให้เห็นผลก่อนกดบันทึกจริง</span>
                      </div>
                      <div>
                        <strong className="block text-surface-800">Syntax Highlighting</strong>
                        <span>ตัวอย่างสูตรใช้สีแยกคำสั่ง ตัวแปร และตัวเลข เพื่อให้อ่าน logic ได้เร็วขึ้น</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d9e7f2] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Code2 size={15} className="text-primary-600" />
                    <h4 className="text-sm font-semibold">Preview สูตรและผลลัพธ์</h4>
                  </div>
                  <div className="space-y-4">
                    {selectedFertilizerRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2]">
                        <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                          <h5 className="text-sm font-semibold">สูตรปุ๋ย</h5>
                        </div>
                        <div className="p-4">
                          <pre className="overflow-x-auto rounded-xl border border-[#d9e7f2] bg-[#101827] p-4 text-xs leading-6 text-slate-100">
                            <code>
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">weightPerUnitKg</span> = <span className="text-amber-300">{toNumberOrUndefined(bulkFertilizerBagWeightKg) ?? 50}</span>{'\n'}
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">unitFactor</span> = <span className="text-amber-300">{toNumberOrUndefined(bulkFertilizerUnitFactor) ?? 1}</span>{'\n'}
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">fertilizerResult</span> = (<span className="text-violet-300">quantity</span> * <span className="text-emerald-300">weightPerUnitKg</span>) * <span className="text-emerald-300">unitFactor</span>{'\n'}
                              <span className="text-slate-400">{'// '}</span><span className="text-slate-300">{bulkFertilizerPreview[0]?.formulaText ?? 'เลือกรายการปุ๋ยเพื่อดูสูตรตัวอย่าง'}</span>
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {selectedFuelRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2]">
                        <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                          <h5 className="text-sm font-semibold">สูตรน้ำมัน</h5>
                        </div>
                        <div className="p-4">
                          <pre className="overflow-x-auto rounded-xl border border-[#d9e7f2] bg-[#101827] p-4 text-xs leading-6 text-slate-100">
                            <code>
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">fuelValuePerUnit</span> = <span className="text-amber-300">{toNumberOrUndefined(bulkFuelValuePerUnit) ?? 1}</span>{'\n'}
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">fuelResult</span> = <span className="text-violet-300">quantity</span> * <span className="text-emerald-300">fuelValuePerUnit</span>{'\n'}
                              <span className="text-slate-400">{'// '}</span><span className="text-slate-300">{bulkFuelPreview[0]?.formulaText ?? 'เลือกรายการน้ำมันเพื่อดูสูตรตัวอย่าง'}</span>
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {bulkOtherPreviewGroups.map((group) => {
                      const config = bulkOtherConfigs[group.key] ?? DEFAULT_OTHER_GROUP_CONFIG

                      return (
                        <div key={`formula-${group.key}`} className="rounded-xl border border-[#d9e7f2]">
                          <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                            <h5 className="text-sm font-semibold">สูตร {group.label}</h5>
                          </div>
                          <div className="p-4">
                            <pre className="overflow-x-auto rounded-xl border border-[#d9e7f2] bg-[#101827] p-4 text-xs leading-6 text-slate-100">
                              <code>
                                <span className="text-sky-300">const</span> <span className="text-emerald-300">otherFactor</span> = <span className="text-amber-300">{config.mode === 'factor' ? (toNumberOrUndefined(config.conversionFactor) ?? 1) : 1}</span>{'\n'}
                                <span className="text-sky-300">const</span> <span className="text-emerald-300">otherResult</span> = <span className="text-violet-300">volumeAll</span> * <span className="text-emerald-300">otherFactor</span>{'\n'}
                                <span className="text-slate-400">{'// '}</span><span className="text-slate-300">{group.items[0]?.formulaText ?? `เลือก${group.label}เพื่อดูสูตรตัวอย่าง`}</span>
                              </code>
                            </pre>
                          </div>
                        </div>
                      )
                    })}

                    {[
                      { key: 'fertilizer', label: 'ปุ๋ย', items: bulkFertilizerPreview },
                      { key: 'fuel', label: 'น้ำมัน', items: bulkFuelPreview },
                      ...bulkOtherPreviewGroups.map((group) => ({ key: group.key, label: group.label, items: group.items })),
                    ].map((group) => (
                      group.items.length ? (
                        <div key={group.key} className="rounded-xl border border-[#d9e7f2]">
                          <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                            <h5 className="text-sm font-semibold">{group.label}</h5>
                          </div>
                          <div className="max-h-[280px] overflow-auto">
                            <table className="w-full min-w-[760px] text-left text-xs">
                              <thead className="sticky top-0 bg-[#f3f7fb] text-surface-600">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">หัวข้อกิจกรรม</th>
                                  <th className="px-3 py-2 font-semibold">รายการ</th>
                                  <th className="px-3 py-2 font-semibold">หน่วยเดิม</th>
                                  {group.key === 'fertilizer' && <th className="px-3 py-2 font-semibold">N ที่จะบันทึก</th>}
                                  <th className="px-3 py-2 font-semibold">Rule</th>
                                  <th className="px-3 py-2 font-semibold">สูตร</th>
                                  <th className="px-3 py-2 font-semibold">ผลลัพธ์</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e5eef5] bg-white">
                                {group.items.map((item) => (
                                  <tr key={item.row.id}>
                                    <td className="px-3 py-2 align-top">
                                      <div className="min-w-[140px]">
                                        <div className="font-medium text-surface-800">{item.row.headerLabel}</div>
                                        <div className="text-[11px] text-surface-500">{item.row.activityTypeName}</div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">{item.row.resourceItemName}</td>
                                    <td className="px-3 py-2 align-top">{item.currentUnitLabel}</td>
                                    {group.key === 'fertilizer' && (
                                      <td className="px-3 py-2 align-top">
                                        <span className="font-mono">{getBulkFertilizerPreviewNLabel(item.row)}</span>
                                      </td>
                                    )}
                                    <td className="px-3 py-2 align-top">{item.ruleLabel}</td>
                                    <td className="px-3 py-2 align-top font-mono">{item.formulaText}</td>
                                    <td className="px-3 py-2 align-top font-mono">{formatNumber(item.preparedVolumeAll)} {item.preparedUnitLabel}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null
                    ))}

                    {!bulkConversionPreview.length && (
                      <div className="rounded-xl border border-dashed border-[#d9e7f2] px-4 py-8 text-center text-sm text-surface-400">
                        ยังไม่ได้เลือกรายการ
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#cfe3d6] bg-[linear-gradient(180deg,rgba(249,255,251,0.98),rgba(240,249,244,0.98))] px-4 py-3 text-sm text-surface-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-green-600"
                  checked={bulkMovePreparedToReady}
                  onChange={(event) => setBulkMovePreparedToReady(event.target.checked)}
                  disabled={bulkPreparationPopup.kind === 'loading'}
                />
                <span>
                  <span className="block font-medium text-surface-900">เสร็จแล้ว ย้ายสถานะเป็น พร้อมคำนวณมาตรฐาน</span>
                  <span className="mt-1 block text-xs text-surface-500">
                    ถ้าไม่ติ๊กไว้ ระบบจะบันทึกการเตรียมข้อมูลอย่างเดียว และคงสถานะเดิมเป็น กำลังเตรียมข้อมูล
                  </span>
                </span>
              </label>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={closeBulkModal} disabled={bulkPreparationPopup.kind === 'loading'}>ยกเลิก</button>
                <button
                  type="button"
                  className="btn-primary flex-1 justify-center"
                  disabled={!bulkConversionPreview.length || bulkPreparationMut.isPending}
                  onClick={() => bulkPreparationMut.mutate({
                    items: bulkConversionPreview,
                    moveToReady: bulkMovePreparedToReady,
                    detailIds: bulkReadyTransitionDetailIds,
                  })}
                >
                  {bulkPreparationMut.isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนหน่วยทั้งหมด'}
                </button>
              </div>

              {bulkPreparationPopup.kind !== 'hidden' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
                  <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,253,0.98))] p-6 shadow-[0_28px_80px_rgba(35,49,66,0.24)] animate-slide-up">
                    {bulkPreparationPopup.kind === 'loading' ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(91,164,255,0.22),rgba(91,164,255,0.08),transparent_72%)]">
                          <LoaderCircle size={40} className="animate-spin text-primary-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-surface-900">กำลังเตรียมข้อมูลทีละรายการ</h3>
                        <p className="mt-2 text-sm text-surface-600">
                          ระบบกำลังบันทึก {bulkPreparationPopup.current.toLocaleString('th-TH')} / {bulkPreparationPopup.total.toLocaleString('th-TH')} รายการ
                        </p>
                        <div className="mt-2 text-sm font-medium text-surface-800">{bulkPreparationPopup.currentLabel || 'กำลังเริ่มทำรายการ'}</div>
                        <div className="mt-4 w-full overflow-hidden rounded-full bg-[#eaf1f7]">
                          <div
                            className="h-2 rounded-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${bulkPreparationPopup.total ? (bulkPreparationPopup.current / bulkPreparationPopup.total) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="mt-4 flex items-center gap-2 rounded-full border border-[#d9e7f2] bg-white/85 px-4 py-2 text-xs text-surface-500 shadow-sm">
                          <span className="loading-dot" />
                          <span className="loading-dot" />
                          <span className="loading-dot" />
                          <span className="ml-1">กำลังส่งคำขอแบบเรียงลำดับทีละ row</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <button
                          type="button"
                          className="absolute right-3 top-3 rounded-full p-2 text-surface-400 transition hover:bg-white/70 hover:text-surface-700"
                          onClick={closeBulkModal}
                        >
                          <X size={16} />
                        </button>
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(78,143,106,0.24),rgba(78,143,106,0.08),transparent_72%)]">
                          <CheckCircle2 size={40} className="text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-surface-900">บันทึกการเตรียมข้อมูลสำเร็จแล้ว</h3>
                        <p className="mt-2 text-sm text-surface-600">
                          อัปเดตข้อมูล {bulkPreparationPopup.itemCount.toLocaleString('th-TH')} รายการในชุดข้อมูลกิจกรรมเรียบร้อยแล้ว
                        </p>
                        {(bulkPreparationPopup.movedToReadyCount ?? 0) > 0 && (
                          <p className="mt-2 text-sm font-medium text-green-700">
                            พร้อมย้ายสถานะ {bulkPreparationPopup.movedToReadyCount?.toLocaleString('th-TH')} รายการเป็น พร้อมคำนวณมาตรฐาน แล้ว
                          </p>
                        )}
                        <div className="mt-4 rounded-2xl border border-[#d9e7f2] bg-white/90 px-4 py-3 shadow-sm">
                          <span className="text-xs text-surface-500">หน้าต่างนี้จะปิดอัตโนมัติใน </span>
                          <span className="countdown text-sm">{bulkPreparationPopup.countdown}</span>
                          <span className="text-xs text-surface-500"> วินาที</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isPreparationMode && selectedRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={closePreparationForm} />
            <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg animate-slide-up">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">เตรียมข้อมูล Carbon Footprint</h3>
                  <p className="mt-1 text-xs text-surface-500">{selectedRow.resourceItemName} · {selectedRow.campLabel} · {selectedRow.landLabel}</p>
                </div>
                <button type="button" className="btn-icon btn-ghost" onClick={closePreparationForm}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={submitPreparation} className="space-y-5">
                <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ข้อมูลเดิม</h4>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                    <div><span className="text-surface-500">จำนวน</span><strong className="block">{formatNumber(sourceQuantity)}</strong></div>
                    <div><span className="text-surface-500">ปริมาณรวมเดิม</span><strong className="block">{formatNumber(sourceVolume)}</strong></div>
                    <div><span className="text-surface-500">หน่วยเดิม</span><strong className="block">{selectedRow.sourceUnitLabel}</strong></div>
                    <div><span className="text-surface-500">พื้นที่ทำงาน</span><strong className="block">{formatNumber(selectedRow.original.log_activities_detail?.log_act_detail_areawork, 2)} ไร่</strong></div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d9e7f2] p-4">
                  <h4 className="mb-3 text-sm font-semibold">แปลงหน่วย</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="label">Prefix หน่วย</label>
                      <select className="select" value={form.preparedUnitPrefixId} onChange={(event) => setFormValue('preparedUnitPrefixId', event.target.value)}>
                        <option value="">— ไม่ระบุ —</option>
                        {unitPrefixes.map((prefix) => <option key={prefix.unit_prefix_id} value={prefix.unit_prefix_id}>{prefixLabel(prefix)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">หน่วยหลังเตรียม</label>
                      <select className="select" value={form.preparedUnitId} onChange={(event) => setFormValue('preparedUnitId', event.target.value)}>
                        <option value="">— ไม่ระบุ —</option>
                        {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">ชื่อหน่วยใหม่</label>
                      <input
                        className="input"
                        value={form.preparedUnitName}
                        onChange={(event) => setFormValue('preparedUnitName', event.target.value)}
                        disabled={Boolean(form.preparedUnitId)}
                        placeholder="เช่น kg"
                      />
                    </div>
                    <div>
                      <label className="label">ตัวย่อหน่วยใหม่</label>
                      <input
                        className="input"
                        value={form.preparedUnitInitial}
                        onChange={(event) => setFormValue('preparedUnitInitial', event.target.value)}
                        disabled={Boolean(form.preparedUnitId)}
                        placeholder="เช่น kg"
                      />
                    </div>
                    <div>
                      <label className="label">ตัวคูณแปลงหน่วย</label>
                      <input type="number" step="0.000001" className="input" value={form.conversionFactor} onChange={(event) => setFormValue('conversionFactor', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">ปริมาณรวมหลังเตรียม</label>
                      <input type="number" step="0.000001" className="input" value={form.preparedVolumeAll} onChange={(event) => setFormValue('preparedVolumeAll', event.target.value)} />
                    </div>
                  </div>
                </section>

                {selectedIsFertilizer && (
                  <section className="rounded-xl border border-[#d9e7f2] p-4">
                    <h4 className="mb-3 text-sm font-semibold">ปุ๋ย</h4>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => applyFertilizerBag(50)}>ตั้งค่า 50 kg/จำนวน</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => applyFertilizerBag(30)}>ตั้งค่า 30 kg/จำนวน</button>
                    </div>
                    {selectedFertilizerProfile && (
                      <div className="mb-3 rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-3 text-xs text-surface-600">
                        <div><strong className="text-surface-800">{selectedFertilizerProfile.label}</strong></div>
                        <div className="mt-1">{selectedFertilizerProfile.reason}</div>
                        <div className="mt-1">
                          ค่า N ที่ระบบแนะนำ:
                          {' '}
                          <strong>{selectedFertilizerProfile.detectedN != null ? formatNumber(selectedFertilizerProfile.detectedN, 3) : 'null'}</strong>
                        </div>
                        {selectedFertilizerProfile.kind === 'unknown' && (
                          <div className="mt-1 text-amber-700">ถ้าปุ๋ยนี้มีค่า N ให้กรอกเองในช่อง N ด้านล่าง</div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div><label className="label">ปริมาณต่อจำนวน / ต่อชิ้น (kg)</label><input type="number" step="0.001" className="input" value={form.fertilizerBagWeightKg} onChange={(event) => setFormValue('fertilizerBagWeightKg', event.target.value)} /></div>
                      <div><label className="label">N</label><input type="number" step="0.001" className="input" value={form.soilN} onChange={(event) => setFormValue('soilN', event.target.value)} placeholder={selectedFertilizerProfile?.detectedN != null ? String(selectedFertilizerProfile.detectedN) : 'ปล่อยว่างได้ถ้ายังไม่มีค่า'} /></div>
                    </div>
                    <p className="mt-3 text-xs text-surface-500">
                      สูตรปุ๋ยคือ (จำนวน x ปริมาณต่อจำนวนเป็น kg) x ตัวคูณแปลงหน่วย เช่น ถ้าต้องการ g ให้เลือกหน่วย g และใส่ตัวคูณ 1000
                    </p>
                  </section>
                )}

                {selectedIsFuel && (
                  <section className="rounded-xl border border-[#d9e7f2] p-4">
                    <h4 className="mb-3 text-sm font-semibold">น้ำมัน</h4>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={applyFuelLiter} disabled={!canApplyFuelPresets}>เตรียมเป็น L</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={applyFuelCubicMeter} disabled={!canApplyFuelPresets}>เตรียมเป็น m3</button>
                    </div>
                    <div className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-2 text-xs text-surface-600">
                      {canApplyFuelPresets
                        ? 'ใช้ factor พื้นฐาน 1 m3 = 1000 L และ 1 L = 0.001 m3 สำหรับเตรียมข้อมูลก่อนเข้าสูตร'
                        : 'ยังไม่พบหน่วยต้นทางที่ map กับ preset น้ำมันอัตโนมัติ ใช้การตั้งค่าในส่วนแปลงหน่วยด้านบนแทน'}
                    </div>
                  </section>
                )}

                {!selectedIsFertilizer && !selectedIsFuel && (
                  <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                    <h4 className="mb-3 text-sm font-semibold">ประเภทอื่น</h4>
                    <p className="text-sm text-surface-600">
                      รายการนี้ไม่มีสูตรเฉพาะแบบปุ๋ยหรือน้ำมันในรอบนี้ เราจะใช้การตั้งค่าในส่วนแปลงหน่วยด้านบน และอัปเดตผลกับข้อมูลกิจกรรมโดยตรง
                    </p>
                  </section>
                )}

                <section className="rounded-xl border border-[#d9e7f2] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ตรวจดิน / SOC</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div><label className="label">วันที่ตรวจดิน</label><input type="date" className="input" value={form.soilSampleDate} onChange={(event) => setFormValue('soilSampleDate', event.target.value)} /></div>
                    <div><label className="label">SOC ปีฐาน</label><input type="number" step="0.001" className="input" value={form.soilSocBaseline} onChange={(event) => setFormValue('soilSocBaseline', event.target.value)} /></div>
                    <div><label className="label">SOC ปีโครงการ</label><input type="number" step="0.001" className="input" value={form.soilSocProject} onChange={(event) => setFormValue('soilSocProject', event.target.value)} /></div>
                    <div><label className="label">หมายเหตุ</label><input className="input" value={form.note} onChange={(event) => setFormValue('note', event.target.value)} /></div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ผลลัพธ์ที่จะบันทึก</h4>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-5">
                    <div><span className="text-surface-500">ประเภท</span><strong className="block">{getPreparationTypeLabel(form.fertilizerPrepareType)}</strong></div>
                    <div><span className="text-surface-500">หน่วยหลังเตรียม</span><strong className="block">{previewPreparedUnitLabel}</strong></div>
                    <div><span className="text-surface-500">ปริมาณหลังเตรียม</span><strong className="block">{formatNumber(previewPreparedVolume)}</strong></div>
                    <div><span className="text-surface-500">N ที่จะบันทึก</span><strong className="block">{form.soilN || (selectedFertilizerProfile?.detectedN != null ? formatNumber(selectedFertilizerProfile.detectedN, 3) : 'null')}</strong></div>
                    <div><span className="text-surface-500">ผลต่างจากเดิม</span><strong className="block">{formatNumber(previewDiff)}</strong></div>
                  </div>
                </section>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn-secondary flex-1 justify-center" onClick={closePreparationForm}>ยกเลิก</button>
                  <button type="submit" className="btn-primary flex-1 justify-center" disabled={preparationMut.isPending}>
                    {preparationMut.isPending ? 'กำลังบันทึก...' : 'บันทึกการเตรียมข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isPreparationMode && statusPopup.kind !== 'hidden' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,253,0.98))] p-6 shadow-[0_28px_80px_rgba(35,49,66,0.24)] animate-slide-up">
              {statusPopup.kind === 'loading' ? (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(91,164,255,0.22),rgba(91,164,255,0.08),transparent_72%)]">
                    <LoaderCircle size={40} className="animate-spin text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-surface-900">กำลังเปลี่ยนสถานะข้อมูล</h3>
                  <p className="mt-2 text-sm text-surface-600">
                    ระบบกำลังย้าย {statusPopup.itemCount.toLocaleString('th-TH')} รายการ จาก
                    {' '}<span className="font-medium">{statusPopup.fromStatusLabel}</span>{' '}เป็น{' '}
                    <span className="font-medium">{statusPopup.toStatusLabel}</span>
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-full border border-[#d9e7f2] bg-white/85 px-4 py-2 text-xs text-surface-500 shadow-sm">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="ml-1">กรุณารอสักครู่</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-full p-2 text-surface-400 transition hover:bg-white/70 hover:text-surface-700"
                    onClick={() => setStatusPopup({ kind: 'hidden' })}
                  >
                    <X size={16} />
                  </button>
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(78,143,106,0.24),rgba(78,143,106,0.08),transparent_72%)]">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-surface-900">เปลี่ยนสถานะสำเร็จแล้ว</h3>
                  <p className="mt-2 text-sm text-surface-600">
                    ย้ายข้อมูล {statusPopup.itemCount.toLocaleString('th-TH')} รายการ ไปที่
                    {' '}<span className="font-medium">{statusPopup.toStatusLabel}</span>{' '}เรียบร้อยแล้ว
                  </p>
                  <div className="mt-4 rounded-2xl border border-[#d9e7f2] bg-white/90 px-4 py-3 shadow-sm">
                    <span className="text-xs text-surface-500">หน้าต่างนี้จะปิดอัตโนมัติใน </span>
                    <span className="countdown text-sm">{statusPopup.countdown}</span>
                    <span className="text-xs text-surface-500"> วินาที</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </>
  )

  if (embedded) return content

  return (
    <div className="cf-dash">
      <div className="page active">
        {content}
      </div>
    </div>
  )
}
