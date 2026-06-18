import { get, post } from '@/lib/api'
import type {
  CarbonCreditCalculationRequest,
  CarbonCreditWorkspaceParams,
  CarbonCreditWorkspaceResponse,
} from '../types/carbonCredit'

function cleanParams(params: CarbonCreditWorkspaceParams = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  )
}

export function getCarbonCreditWorkspace(params: CarbonCreditWorkspaceParams = {}) {
  return get<CarbonCreditWorkspaceResponse>('/activities/carbon-credit/workspace', cleanParams(params))
}

export function previewCarbonCreditCalculation(payload: CarbonCreditCalculationRequest) {
  return post<CarbonCreditWorkspaceResponse>('/activities/carbon-credit/preview', payload, { timeout: 10 * 60_000 })
}

export function calculateCarbonCredit(payload: CarbonCreditCalculationRequest) {
  return post<CarbonCreditWorkspaceResponse>('/activities/carbon-credit/calculate', payload, { timeout: 10 * 60_000 })
}
