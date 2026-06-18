export type CarbonCreditScope = 'all' | 'camp_group' | 'camp' | 'land'
export type CarbonCreditScenario = 'baseline' | 'project' | 'outside_scope'
export type CarbonCreditDatasourceStatus = 'api_real' | 'api_partial' | 'missing'

export interface CarbonCreditFilterOption {
  id: number
  label: string
  groupId?: number | null
  campId?: number | null
}

export interface CarbonCreditYearOption {
  label: string
  value: string
  sortYear?: number | null
}

export interface CarbonCreditEfSelection {
  selectedEfId?: number
  resultUnitId?: number
  organicFertilizerMode?: 'manual_formula' | 'generic_ef' | 'skip_error'
  fertilizerUreaEfId?: number
  fertilizerDapEfId?: number
  fertilizerKclEfId?: number
  fertilizerGwpId?: number
  manualFertilizerNPercent?: number
  manualFertilizerP2O5Percent?: number
  manualFertilizerK2OPercent?: number
}

export interface CarbonCreditCalculationRequest {
  baselineYears: string[]
  projectYear: string
  scope: CarbonCreditScope
  campGroupId?: number
  campId?: number
  landId?: number
  selectedQueueIds: number[]
  includeSocRemoval: boolean
  efSelections: Record<number, CarbonCreditEfSelection>
}

export interface CarbonCreditQueueRow {
  queueId: number
  activityDetailId: number | null
  productionYearLabel: string
  productionYearSortYear: number | null
  scenario: CarbonCreditScenario
  campGroupId: number | null
  campGroupLabel: string
  campId: number | null
  campLabel: string
  landId: number | null
  landLabel: string
  areaRai: number
  resourceName: string
  formulaMode: string
  preparedAmount: number | null
  preparedUnitId?: number | null
  preparedUnitPrefixId?: number | null
  preparedUnitLabel: string | null
  cfpResultValue: number | null
  cfpResultUnitLabel: string | null
  cfpResultTco2e: number | null
  creditResultValue: number | null
  creditResultUnitLabel: string | null
  creditResultTco2e: number | null
  needsFootprintCalculation: boolean
  footprintError: string | null
  statusName: string | null
  errorMessage: string | null
  selected: boolean
  calculationInfo: Record<string, unknown>
}

export interface CarbonCreditBlockedRow {
  id: string
  kind: 'row' | 'land'
  queueId?: number
  landId?: number | null
  landLabel?: string
  scenario?: CarbonCreditScenario
  reason: string
}

export interface CarbonCreditBaselineTotal {
  year: string
  totalTco2e: number
  queueIds: number[]
}

export interface CarbonCreditLandGroup {
  landId: number
  landLabel: string
  campLabel: string
  campGroupLabel: string
  areaRai: number
  baselineTotals: CarbonCreditBaselineTotal[]
  baselineAverageTco2e: number
  projectEmissionTco2e: number
  emissionReductionTco2e: number
  socRemovalTco2e: number
  creditCandidateTco2e: number
  projectQueueIds: number[]
  baselineQueueIds: number[]
  baselineYearCount?: number
  missingBaselineYears?: string[]
  status: 'ready' | 'blocked' | 'skipped'
  blockedReason: string | null
}

export interface CarbonCreditWritePlanItem {
  queueId: number
  landId: number
  landLabel: string
  productionYearLabel: string
  resourceName: string
  projectEmissionTco2e: number
  allocatedCreditTco2e: number
  allocationShare: number
  allocationMethod: 'project_emission_share' | 'equal_project_rows'
  snapshot: Record<string, unknown>
}

export interface CarbonCreditWorkspaceResponse {
  datasourceStatus: CarbonCreditDatasourceStatus
  notes: string[]
  filters: {
    yearOptions: CarbonCreditYearOption[]
    campGroups: Array<{ id: number; label: string }>
    camps: CarbonCreditFilterOption[]
    lands: CarbonCreditFilterOption[]
  }
  rows: CarbonCreditQueueRow[]
  landGroups: CarbonCreditLandGroup[]
  blockedRows: CarbonCreditBlockedRow[]
  writePlan: CarbonCreditWritePlanItem[]
  totals: {
    selectedRows: number
    readyLands: number
    skippedLands?: number
    blockedRows: number
    projectRowsToUpdate: number
    creditCandidateTco2e: number
  }
  calculated?: {
    updated: number
    footprintCalculated: number
  }
}

export interface CarbonCreditWorkspaceParams {
  years?: string
  scope?: CarbonCreditScope
  campGroupId?: number | string
  campId?: number | string
  landId?: number | string
}

export interface Ef {
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

export interface Unit {
  unit_id?: number
  unit_name?: string
  unit_initial?: string
}
