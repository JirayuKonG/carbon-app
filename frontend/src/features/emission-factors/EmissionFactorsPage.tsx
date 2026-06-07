import { type FormEvent, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { get, post, put, del } from '@/lib/api'
import { FlaskConical, Plus, Pencil, Trash2 } from 'lucide-react'

interface Ef         { coefficient_emission_factor_id: number; coef_em_factor_idCode: string; coef_em_factor_name: string; coef_em_factor_value_co2: number; coef_em_factor_value_ch4: number; coef_em_factor_value_n2o: number; coef_em_factor_value_total: number; group_emission_factor_id: number }
interface Gwp        { coefficients_emissions_factors_gwp_id: number; coef_em_factor_gwp_name: string; coef_em_factor_gwp_value: number; coef_em_factor_gwp_name_en: string }
interface CfType     { carbonfootprint_type_id: number; cf_type_name_short: string; cf_type_name_th: string; cf_type_name_en: string }
interface EfGroup    { group_emission_factor_id: number; group_emission_factor_idCode: string; group_emission_factor_name: string; carbonfootprint_type_id: number }
interface Unit       { 
  unit_id: number; unit_name: string; 
  unit_initial: string 
}
interface UnitPrefix { 
  unit_prefix_id: number; unit_prefix_name: string; unit_prefix_initial: string;
   unit_prefix_value: number 
}

type TabKey        = 'ef' | 'gwp' | 'cf-types' | 'groups' | 'units'
type UnitPayload   = { 
  unit_name: string 
  unit_initial: string 
}
type PrefixPayload = { 
  unit_prefix_name: string
  unit_prefix_initial: string
  unit_prefix_value: number 
}

export function EmissionFactorsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('ef')

  // modal open/edit state
  const [showUnitModal, setShowUnitModal]   = useState(false)
  const [showPfxModal,  setShowPfxModal]    = useState(false)
  const [editingUnit,   setEditingUnit]     = useState<Unit | null>(null)
  const [editingPfx,    setEditingPfx]      = useState<UnitPrefix | null>(null)
  const [deleteTarget,  setDeleteTarget]    = useState<{ type: 'unit' | 'unit-prefix'; id: number; name: string } | null>(null)

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: efs      = [], isLoading: efLoad, error: efsError } = useQuery({ queryKey: ['efs'],          queryFn: () => get<Ef[]>('/emission-factors/coefficients') })
  const { data: gwps     = [], isLoading: gwpLoad, error: gwpsError } = useQuery({ queryKey: ['gwps'],         queryFn: () => get<Gwp[]>('/emission-factors/gwp') })
  const { data: cfTypes  = [], isLoading: ctLoad, error: cfTypesError } = useQuery({ queryKey: ['cf-types'],     queryFn: () => get<CfType[]>('/emission-factors/cf-types') })
  const { data: efGroups = [], isLoading: egLoad, error: efGroupsError } = useQuery({ queryKey: ['ef-groups'],    queryFn: () => get<EfGroup[]>('/emission-factors/groups') })
  const { data: units    = [], isLoading: uLoad, error: unitsError } = useQuery({ queryKey: ['units'],        queryFn: () => get<Unit[]>('/emission-factors/units') })
  const { data: unitPfxs = [], isLoading: upLoad, error: unitPfxsError } = useQuery({ queryKey: ['unit-prefixs'], queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs') })

  const pageQueryItems = [
    { label: 'Emission Factors', error: efsError },
    { label: 'GWP', error: gwpsError },
    { label: 'CF Types', error: cfTypesError },
    { label: 'กลุ่ม EF', error: efGroupsError },
    { label: 'หน่วยนับ', error: unitsError },
    { label: 'คำนำหน้าหน่วย', error: unitPfxsError },
  ]

  // ── mutations ─────────────────────────────────────────────────────────────
  const saveUnitMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: UnitPayload }) =>
      id ? put(`/emission-factors/units/${id}`, payload) : post('/emission-factors/units', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); setShowUnitModal(false); setEditingUnit(null) },
  })

  const savePfxMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: PrefixPayload }) =>
      id ? put(`/emission-factors/unit-prefixs/${id}`, payload) : post('/emission-factors/unit-prefixs', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['unit-prefixs'] }); setShowPfxModal(false); setEditingPfx(null) },
  })

  const deleteMut = useMutation({
    mutationFn: () => {
      if (!deleteTarget) return Promise.reject(new Error('no target'))
      return deleteTarget.type === 'unit'
        ? del(`/emission-factors/units/${deleteTarget.id}`)
        : del(`/emission-factors/unit-prefixs/${deleteTarget.id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deleteTarget?.type === 'unit' ? ['units'] : ['unit-prefixs'] })
      setDeleteTarget(null)
    },
  })

  // ── form handlers (FormData pattern — same as UsersPage) ──────────────────
  const handleSaveUnit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const unit_name    = String(form.get('unit_name')    ?? '').trim()
    const unit_initial = String(form.get('unit_initial') ?? '').trim()
    if (!unit_name) return
    saveUnitMut.mutate({ 
      id: editingUnit?.unit_id, 
      payload: { unit_name, unit_initial }, 
    })
  }

  const handleSavePfx = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const unit_prefix_name    = String(form.get('unit_prefix_name')    ?? '').trim()
    const unit_prefix_initial = String(form.get('unit_prefix_initial') ?? '').trim()
    const unit_prefix_value   = Number(form.get('unit_prefix_value')   ?? 0)
    if (!unit_prefix_name) return
    savePfxMut.mutate({ 
      id: editingPfx?.unit_prefix_id, 
      payload: { unit_prefix_name, unit_prefix_initial, unit_prefix_value },
    })
  }

  // ── action column helper ──────────────────────────────────────────────────
  const actionCol = <T,>(onEdit: (r: T) => void, onDelete: (r: T) => void): Column<T> => ({
    key: '_actions',
    header: '',
    width: '80px',
    render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={() => onEdit(r)}   className="btn-icon btn-ghost btn-sm"><Pencil size={13} /></button>
        <button onClick={() => onDelete(r)} className="btn-icon btn-ghost btn-sm text-red-400"><Trash2 size={13} /></button>
      </div>
    ),
  })

  // ── column definitions ────────────────────────────────────────────────────
  const efCols: Column<Ef>[] = [
    { key: 'coef_em_factor_idCode',      header: 'รหัส EF', width: '90px' },
    { key: 'coef_em_factor_name',        header: 'ชื่อ EF' },
    { key: 'coef_em_factor_value_co2',   header: 'CO₂',  render: (r) => <span className="font-mono text-xs">{r.coef_em_factor_value_co2  ?? '—'}</span> },
    { key: 'coef_em_factor_value_ch4',   header: 'CH₄',  render: (r) => <span className="font-mono text-xs">{r.coef_em_factor_value_ch4  ?? '—'}</span> },
    { key: 'coef_em_factor_value_n2o',   header: 'N₂O',  render: (r) => <span className="font-mono text-xs">{r.coef_em_factor_value_n2o  ?? '—'}</span> },
    { key: 'coef_em_factor_value_total', header: 'รวม',  render: (r) => <span className="font-mono text-xs font-semibold text-primary-700">{r.coef_em_factor_value_total ?? '—'}</span> },
    actionCol<Ef>(() => {}, () => {}),
  ]
  const gwpCols: Column<Gwp>[] = [
    { key: 'coefficients_emissions_factors_gwp_id', header: 'ID', width: '60px' },
    { key: 'coef_em_factor_gwp_name',    header: 'ชื่อ GWP' },
    { key: 'coef_em_factor_gwp_name_en', header: 'Name (EN)' },
    { key: 'coef_em_factor_gwp_value',   header: 'GWP Value', render: (r) => <span className="font-mono font-semibold text-accent-700">{r.coef_em_factor_gwp_value}</span> },
    actionCol<Gwp>(() => {}, () => {}),
  ]
  const cfTypeCols: Column<CfType>[] = [
    { key: 'carbonfootprint_type_id', header: 'ID', width: '60px' },
    { key: 'cf_type_name_short',      header: 'ชื่อย่อ' },
    { key: 'cf_type_name_th',         header: 'ชื่อ (ไทย)' },
    { key: 'cf_type_name_en',         header: 'ชื่อ (EN)' },
    actionCol<CfType>(() => {}, () => {}),
  ]
  const groupCols: Column<EfGroup>[] = [
    { key: 'group_emission_factor_id',     header: 'ID', width: '60px' },
    { key: 'group_emission_factor_idCode', header: 'รหัส' },
    { key: 'group_emission_factor_name',   header: 'ชื่อกลุ่ม EF' },
    actionCol<EfGroup>(() => {}, () => {}),
  ]
  const unitCols: Column<Unit>[] = [
    { key: 'unit_id',      header: 'ID', width: '60px' },
    { key: 'unit_name',    header: 'ชื่อหน่วย' },
    { key: 'unit_initial', header: 'ตัวย่อ', render: (r) => <span className="badge-gray">{r.unit_initial}</span> },
    actionCol<Unit>(
      (r) => { setEditingUnit(r); setShowUnitModal(true) },
      (r) => setDeleteTarget({ type: 'unit', id: r.unit_id, name: r.unit_name }),
    ),
  ]
  const unitPfxCols: Column<UnitPrefix>[] = [
    { key: 'unit_prefix_id',      header: 'ID', width: '60px' },
    { key: 'unit_prefix_name',    header: 'ชื่อ prefix' },
    { key: 'unit_prefix_initial', header: 'ตัวย่อ', render: (r) => <span className="badge-gray">{r.unit_prefix_initial}</span> },
    { key: 'unit_prefix_value',   header: 'ค่าตัวคูณ', render: (r) => <span className="font-mono">{r.unit_prefix_value}</span> },
    actionCol<UnitPrefix>(
      (r) => { setEditingPfx(r); setShowPfxModal(true) },
      (r) => setDeleteTarget({ type: 'unit-prefix', id: r.unit_prefix_id, name: r.unit_prefix_name }),
    ),
  ]

  const ADD_LABEL: Record<TabKey, string> = {
    'ef':       'เพิ่ม EF',
    'gwp':      'เพิ่ม GWP',
    'cf-types': 'เพิ่ม CF Type',
    'groups':   'เพิ่มกลุ่ม EF',
    'units':    'เพิ่มหน่วย',
  }

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'ef',       label: 'Emission Factors', count: efs.length },
    { key: 'gwp',      label: 'GWP',              count: gwps.length },
    { key: 'cf-types', label: 'CF Types',          count: cfTypes.length },
    { key: 'groups',   label: 'กลุ่ม EF',          count: efGroups.length },
    { key: 'units',    label: 'หน่วย',             count: units.length },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><FlaskConical size={20} className="text-primary-600" /> EF / GWP / หน่วย / CF Type</h1>
          <p className="page-subtitle">ค่าสัมประสิทธิ์การปล่อยก๊าซ, ค่า GWP, และหน่วยวัด</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingUnit(null); setShowUnitModal(tab === 'units') }}>
          <Plus size={14} /> {ADD_LABEL[tab]}
        </button>
      </div>

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

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

      {/* Tables */}
      <div className="card">
        {tab === 'ef'       && <DataTable data={efs}      columns={efCols}     isLoading={efLoad}  rowKey={(r) => r.coefficient_emission_factor_id} />}
        {tab === 'gwp'      && <DataTable data={gwps}     columns={gwpCols}    isLoading={gwpLoad} rowKey={(r) => r.coefficients_emissions_factors_gwp_id} />}
        {tab === 'cf-types' && <DataTable data={cfTypes}  columns={cfTypeCols} isLoading={ctLoad}  rowKey={(r) => r.carbonfootprint_type_id} />}
        {tab === 'groups'   && <DataTable data={efGroups} columns={groupCols}  isLoading={egLoad}  rowKey={(r) => r.group_emission_factor_id} />}
        {tab === 'units' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold mb-3">หน่วยวัด (units)</h3>
                <button className="btn-primary btn-sm" onClick={() => { setEditingUnit(null); setShowUnitModal(true) }}>
                  <Plus size={13} /> เพิ่ม Unit
                </button>
              </div> 
              <DataTable data={units} columns={unitCols} isLoading={uLoad} rowKey={(r) => r.unit_id} defaultPageSize={10} />
            </div>

            <div>
              {/* Prefix add button inside card — same pattern as UsersPage roles tab */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">prefix หน่วย (units_prefixs)</h3>
                <button className="btn-primary btn-sm" onClick={() => { setEditingPfx(null); setShowPfxModal(true) }}>
                  <Plus size={13} /> เพิ่ม Prefix
                </button>
              </div>
              <DataTable data={unitPfxs} columns={unitPfxCols} isLoading={upLoad} rowKey={(r) => r.unit_prefix_id} defaultPageSize={10} />
            </div>

          </div>
        )}
      </div>

      {/* Add / Edit Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnitModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-md animate-slide-up">
            <h3 className="font-semibold mb-5">{editingUnit ? 'แก้ไขหน่วยวัด' : 'เพิ่มหน่วยวัด'}</h3>
            <form onSubmit={handleSaveUnit}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อหน่วย *</label>
                  <input className="input" name="unit_name" required defaultValue={editingUnit?.unit_name ?? ''} placeholder="เช่น กิโลกรัม" />
                </div>
                <div>
                  <label className="label">ตัวย่อ</label>
                  <input className="input" name="unit_initial" defaultValue={editingUnit?.unit_initial ?? ''} placeholder="เช่น kg" />
                </div>
              </div>
              {saveUnitMut.isError && <p className="mt-3 text-sm text-red-600">{saveUnitMut.error.message}</p>}
              <div className="flex gap-3 mt-5">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowUnitModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveUnitMut.isPending}>
                  {saveUnitMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Unit Prefix Modal */}
      {showPfxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPfxModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-md animate-slide-up">
            <h3 className="font-semibold mb-5">{editingPfx ? 'แก้ไข Prefix หน่วย' : 'เพิ่ม Prefix หน่วย'}</h3>
            <form onSubmit={handleSavePfx}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อ prefix *</label>
                  <input className="input" name="unit_prefix_name" required defaultValue={editingPfx?.unit_prefix_name ?? ''} placeholder="เช่น กิโล" />
                </div>
                <div>
                  <label className="label">ตัวย่อ</label>
                  <input className="input" name="unit_prefix_initial" defaultValue={editingPfx?.unit_prefix_initial ?? ''} placeholder="เช่น k" />
                </div>
                <div>
                  <label className="label">ค่าตัวคูณ</label>
                  <input className="input" name="unit_prefix_value" type="number" step="any" defaultValue={editingPfx?.unit_prefix_value ?? ''} placeholder="เช่น 1000" />
                </div>
              </div>
              {savePfxMut.isError && <p className="mt-3 text-sm text-red-600">{savePfxMut.error.message}</p>}
              <div className="flex gap-3 mt-5">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowPfxModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={savePfxMut.isPending}>
                  {savePfxMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="ยืนยันการลบ"
        message={`ลบ "${deleteTarget?.name ?? ''}" ออกจากระบบ?`}
        confirmLabel="ลบ"
        variant="danger"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
