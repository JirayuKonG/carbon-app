import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, Column } from '@/components/ui/DataTable'
import { get } from '@/lib/api'
import { FlaskConical, Plus, Pencil } from 'lucide-react'

interface Ef  { coefficient_emission_factor_id: number; coef_em_factor_idCode: string; coef_em_factor_name: string; coef_em_factor_value_co2: number; coef_em_factor_value_ch4: number; coef_em_factor_value_n2o: number; coef_em_factor_value_total: number; group_emission_factor_id: number }
interface Gwp { coefficients_emissions_factors_gwp_id: number; coef_em_factor_gwp_name: string; coef_em_factor_gwp_value: number; coef_em_factor_gwp_name_en: string }
interface CfType { carbonfootprint_type_id: number; cf_type_name_short: string; cf_type_name_th: string; cf_type_name_en: string }
interface EfGroup { group_emission_factor_id: number; group_emission_factor_idCode: string; group_emission_factor_name: string; carbonfootprint_type_id: number }
interface Unit { unit_id: number; unit_name: string; unit_initial: string }
interface UnitPrefix { unit_prefix_id: number; unit_prefix_name: string; unit_prefix_initial: string; unit_prefix_value: number }

type TabKey = 'ef' | 'gwp' | 'cf-types' | 'groups' | 'units'

export function EmissionFactorsPage() {
  const [tab, setTab] = useState<TabKey>('ef')

  const { data: efs        = [], isLoading: efLoad }  = useQuery({ queryKey: ['efs'],         queryFn: () => get<Ef[]>('/emission-factors/coefficients') })
  const { data: gwps       = [], isLoading: gwpLoad }  = useQuery({ queryKey: ['gwps'],        queryFn: () => get<Gwp[]>('/emission-factors/gwp') })
  const { data: cfTypes    = [], isLoading: ctLoad }   = useQuery({ queryKey: ['cf-types'],    queryFn: () => get<CfType[]>('/emission-factors/cf-types') })
  const { data: efGroups   = [], isLoading: egLoad }   = useQuery({ queryKey: ['ef-groups'],   queryFn: () => get<EfGroup[]>('/emission-factors/groups') })
  const { data: units      = [], isLoading: uLoad }    = useQuery({ queryKey: ['units'],       queryFn: () => get<Unit[]>('/emission-factors/units') })
  const { data: unitPfxs   = [], isLoading: upLoad }   = useQuery({ queryKey: ['unit-prefixs'],queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs') })

  const efCols: Column<Ef>[] = [
    { key: 'coef_em_factor_idCode',    header: 'รหัส EF', width: '90px' },
    { key: 'coef_em_factor_name',      header: 'ชื่อ EF' },
    { key: 'coef_em_factor_value_co2', header: 'CO₂', render: (r) => <span className="font-mono text-xs">{r.coef_em_factor_value_co2 ?? '—'}</span> },
    { key: 'coef_em_factor_value_ch4', header: 'CH₄', render: (r) => <span className="font-mono text-xs">{r.coef_em_factor_value_ch4 ?? '—'}</span> },
    { key: 'coef_em_factor_value_n2o', header: 'N₂O', render: (r) => <span className="font-mono text-xs">{r.coef_em_factor_value_n2o ?? '—'}</span> },
    { key: 'coef_em_factor_value_total',header: 'รวม (total)', render: (r) => <span className="font-mono text-xs font-semibold text-primary-700">{r.coef_em_factor_value_total ?? '—'}</span> },
  ]
  const gwpCols: Column<Gwp>[] = [
    { key: 'coefficients_emissions_factors_gwp_id', header: 'ID', width: '60px' },
    { key: 'coef_em_factor_gwp_name',    header: 'ชื่อ GWP' },
    { key: 'coef_em_factor_gwp_name_en', header: 'Name (EN)' },
    { key: 'coef_em_factor_gwp_value',   header: 'GWP Value', render: (r) => <span className="font-mono font-semibold text-accent-700">{r.coef_em_factor_gwp_value}</span> },
  ]
  const cfTypeCols: Column<CfType>[] = [
    { key: 'carbonfootprint_type_id', header: 'ID', width: '60px' },
    { key: 'cf_type_name_short',      header: 'ชื่อย่อ' },
    { key: 'cf_type_name_th',         header: 'ชื่อ (ไทย)' },
    { key: 'cf_type_name_en',         header: 'ชื่อ (EN)' },
  ]
  const groupCols: Column<EfGroup>[] = [
    { key: 'group_emission_factor_id',     header: 'ID', width: '60px' },
    { key: 'group_emission_factor_idCode', header: 'รหัส' },
    { key: 'group_emission_factor_name',   header: 'ชื่อกลุ่ม EF' },
  ]
  const unitCols: Column<Unit>[] = [
    { key: 'unit_id',      header: 'ID', width: '60px' },
    { key: 'unit_name',    header: 'ชื่อหน่วย' },
    { key: 'unit_initial', header: 'ตัวย่อ', render: (r) => <span className="badge-gray">{r.unit_initial}</span> },
  ]

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'ef',       label: 'Emission Factors', count: efs.length },
    { key: 'gwp',      label: 'GWP',              count: gwps.length },
    { key: 'cf-types', label: 'CF Types',          count: cfTypes.length },
    { key: 'groups',   label: 'กลุ่ม EF',          count: efGroups.length },
    { key: 'units',    label: 'หน่วย',             count: units.length },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><FlaskConical size={20} className="text-primary-600" /> EF / GWP / หน่วย / CF Type</h1>
          <p className="page-subtitle">ค่าสัมประสิทธิ์การปล่อยก๊าซ, ค่า GWP, และหน่วยวัด</p>
        </div>
        <button className="btn-primary btn-sm"><Plus size={13} /> เพิ่ม EF</button>
      </div>

      {/* GWP quick reference */}
      {gwps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {gwps.slice(0, 4).map(g => (
            <div key={g.coefficients_emissions_factors_gwp_id} className="card-sm">
              <p className="text-xs text-surface-500">{g.coef_em_factor_gwp_name_en}</p>
              <p className="text-xl font-semibold font-mono text-accent-700 mt-1">{g.coef_em_factor_gwp_value}</p>
              <p className="text-[10px] text-surface-400">GWP100</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-card text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
            {t.label}
            {t.count !== undefined && <span className="text-[10px] bg-surface-200 text-surface-500 px-1.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'ef'       && <DataTable data={efs}      columns={efCols}      isLoading={efLoad}  rowKey={(r) => r.coefficient_emission_factor_id} actions={() => <button className="btn-icon btn-ghost btn-sm"><Pencil size={13} /></button>} />}
        {tab === 'gwp'      && <DataTable data={gwps}     columns={gwpCols}     isLoading={gwpLoad} rowKey={(r) => r.coefficients_emissions_factors_gwp_id} actions={() => <button className="btn-icon btn-ghost btn-sm"><Pencil size={13} /></button>} />}
        {tab === 'cf-types' && <DataTable data={cfTypes}  columns={cfTypeCols}  isLoading={ctLoad}  rowKey={(r) => r.carbonfootprint_type_id} />}
        {tab === 'groups'   && <DataTable data={efGroups} columns={groupCols}   isLoading={egLoad}  rowKey={(r) => r.group_emission_factor_id} />}
        {tab === 'units'    && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-3">หน่วยวัด (units)</h3>
              <DataTable data={units} columns={unitCols} isLoading={uLoad} rowKey={(r) => r.unit_id} defaultPageSize={10} />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3">prefix หน่วย (units_prefixs)</h3>
              <DataTable
                data={unitPfxs}
                columns={[
                  { key: 'unit_prefix_id',      header: 'ID', width: '60px' },
                  { key: 'unit_prefix_name',    header: 'ชื่อ prefix' },
                  { key: 'unit_prefix_initial', header: 'ตัวย่อ', render: (r) => <span className="badge-gray">{r.unit_prefix_initial}</span> },
                  { key: 'unit_prefix_value',   header: 'ค่าตัวคูณ', render: (r) => <span className="font-mono">{r.unit_prefix_value}</span> },
                ]}
                isLoading={upLoad}
                rowKey={(r) => r.unit_prefix_id}
                defaultPageSize={10}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
