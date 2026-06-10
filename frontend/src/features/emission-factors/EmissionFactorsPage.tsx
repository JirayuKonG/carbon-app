import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { Column, DataTable } from '@/components/ui/DataTable'
import { formatBangkokDateTime } from '@/lib/datetime'
import { del, get, post, put } from '@/lib/api'
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'

interface Ef {
  coefficient_emission_factor_id: number
  coef_em_factor_idCode?: string | null
  carbonfootprint_type_id?: number | null
  group_emission_factor_id?: number | null
  coef_em_factor_name?: string | null
  coef_em_factor_info?: string | null
  unit_prefix_id?: number | null
  unit_id?: number | null
  coef_em_factor_value_co2?: number | null
  unit_prefix_id_co2?: number | null
  unit_id_co2?: number | null
  coef_em_factor_value_ch4foss?: number | null
  unit_prefix_id_ch4foss?: number | null
  unit_id_ch4foss?: number | null
  coef_em_factor_value_ch4?: number | null
  unit_prefix_id_ch4?: number | null
  unit_id_ch4?: number | null
  coef_em_factor_value_n2o?: number | null
  unit_prefix_id_n2o?: number | null
  unit_id_n2o?: number | null
  coef_em_factor_value_total?: number | null
  unit_prefix_id_total?: number | null
  unit_id_total?: number | null
  coef_em_factor_ref?: number | null
  coef_em_factor_updatePostDateRef?: string | null
  create_at?: string | null
  update_at?: string | null
  update_uid?: number | null
}

interface Gwp {
  coefficients_emissions_factors_gwp_id: number
  coef_em_factor_gwp_name?: string | null
  coef_em_factor_gwp_name_en?: string | null
  coef_em_factor_gwp_value?: number | null
  coef_em_factor_gwp_info?: string | null
  coef_em_factor_gwp_update_uid?: number | null
  coef_em_factor_gwp_create_at?: string | null
  coef_em_factor_gwp_update_at?: string | null
  coef_em_factor_gwp_ref?: number | null
}

interface CfType {
  carbonfootprint_type_id: number
  cf_type_name_short?: string | null
  cf_type_name_th?: string | null
  cf_type_name_en?: string | null
  cf_type_create_at?: string | null
  cf_type_update_at?: string | null
}

interface EfGroup {
  group_emission_factor_id: number
  group_emission_factor_idCode?: string | null
  group_emission_factor_name_short?: string | null
  group_emission_factor_name?: string | null
  group_emission_factor_info?: string | null
  carbonfootprint_type_id?: number | null
}

interface Unit {
  unit_id: number
  unit_name?: string | null
  unit_initial?: string | null
  unit_updated_uid?: number | null
  unit_updated_at?: string | null
}

interface UnitPrefix {
  unit_prefix_id: number
  unit_prefix_name?: string | null
  unit_prefix_initial?: string | null
  unit_prefix_updated_uid?: number | null
  unit_prefix_updated_at?: string | null
  unit_prefix_value?: number | null
}

type TabKey = 'ef' | 'gwp' | 'cf-types' | 'groups' | 'units'
type DeleteTarget =
  | { type: 'ef'; id: number; name: string }
  | { type: 'gwp'; id: number; name: string }
  | { type: 'cf-type'; id: number; name: string }
  | { type: 'group'; id: number; name: string }
  | { type: 'unit'; id: number; name: string }
  | { type: 'unit-prefix'; id: number; name: string }

function formatText(value?: string | null) {
  const text = value?.trim()
  return text ? text : '—'
}

function formatNumber(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? undefined : parsed
}

function toOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function toDateInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function efHeaderChip(label: string, className: string) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] ${className}`}>
      {label}
    </span>
  )
}

function efText(value: React.ReactNode, className: string) {
  return <span className={className}>{value}</span>
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="label">{children}</label>
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[28px] bg-white p-4 shadow-card-lg animate-slide-up sm:p-6 lg:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-600">Data Form</p>
            <h3 className="mt-1 text-lg font-semibold text-surface-900 sm:text-xl">{title}</h3>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-3 text-sm font-semibold text-surface-800">{children}</h4>
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-surface-50/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 border-b border-surface-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionTitle>{title}</SectionTitle>
          {description ? <p className="text-xs text-surface-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmissionMetricCard({
  title,
  valueName,
  prefixName,
  unitName,
  defaultValue,
  defaultPrefix,
  defaultUnit,
  unitPfxs,
  units,
}: {
  title: string
  valueName: string
  prefixName: string
  unitName: string
  defaultValue?: number | null
  defaultPrefix?: number | null
  defaultUnit?: number | null
  unitPfxs: UnitPrefix[]
  units: Unit[]
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-surface-800">{title}</p>
        <p className="text-xs text-surface-500">กำหนดค่าตัวเลขและหน่วยให้ครบในกลุ่มเดียวกัน</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="sm:col-span-2 xl:col-span-1">
          <FieldLabel>ค่า {title}</FieldLabel>
          <input className="input" name={valueName} type="number" step="any" defaultValue={defaultValue ?? ''} />
        </div>
        <div>
          <FieldLabel>Prefix {title}</FieldLabel>
          <select className="select" name={prefixName} defaultValue={defaultPrefix ?? ''}>
            <option value="">— ไม่ระบุ —</option>
            {unitPfxs.map((item) => (
              <option key={item.unit_prefix_id} value={item.unit_prefix_id}>
                {item.unit_prefix_name?.trim() || item.unit_prefix_initial?.trim() || `#${item.unit_prefix_id}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>หน่วย {title}</FieldLabel>
          <select className="select" name={unitName} defaultValue={defaultUnit ?? ''}>
            <option value="">— ไม่ระบุ —</option>
            {units.map((item) => (
              <option key={item.unit_id} value={item.unit_id}>
                {item.unit_name?.trim() || item.unit_initial?.trim() || `#${item.unit_id}`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export function EmissionFactorsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('ef')

  const [showEfModal, setShowEfModal] = useState(false)
  const [showGwpModal, setShowGwpModal] = useState(false)
  const [showCfTypeModal, setShowCfTypeModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [showPfxModal, setShowPfxModal] = useState(false)

  const [editingEf, setEditingEf] = useState<Ef | null>(null)
  const [editingGwp, setEditingGwp] = useState<Gwp | null>(null)
  const [editingCfType, setEditingCfType] = useState<CfType | null>(null)
  const [editingGroup, setEditingGroup] = useState<EfGroup | null>(null)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [editingPfx, setEditingPfx] = useState<UnitPrefix | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [efFormCfTypeId, setEfFormCfTypeId] = useState('')
  const [efFormGroupId, setEfFormGroupId] = useState('')
  const [efFilterCfTypeId, setEfFilterCfTypeId] = useState('')
  const [efFilterGroupId, setEfFilterGroupId] = useState('')
  const [efFilterUnitId, setEfFilterUnitId] = useState('')

  const { data: efs = [], isLoading: efLoad, error: efsError } = useQuery({
    queryKey: ['efs'],
    queryFn: () => get<Ef[]>('/emission-factors/coefficients'),
  })
  const { data: gwps = [], isLoading: gwpLoad, error: gwpsError } = useQuery({
    queryKey: ['gwps'],
    queryFn: () => get<Gwp[]>('/emission-factors/gwp'),
  })
  const { data: cfTypes = [], isLoading: ctLoad, error: cfTypesError } = useQuery({
    queryKey: ['cf-types'],
    queryFn: () => get<CfType[]>('/emission-factors/cf-types'),
  })
  const { data: efGroups = [], isLoading: egLoad, error: efGroupsError } = useQuery({
    queryKey: ['ef-groups'],
    queryFn: () => get<EfGroup[]>('/emission-factors/groups'),
  })
  const { data: units = [], isLoading: uLoad, error: unitsError } = useQuery({
    queryKey: ['units'],
    queryFn: () => get<Unit[]>('/emission-factors/units'),
  })
  const { data: unitPfxs = [], isLoading: upLoad, error: unitPfxsError } = useQuery({
    queryKey: ['unit-prefixs'],
    queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs'),
  })

  const pageQueryItems = [
    { label: 'Emission Factors', error: efsError },
    { label: 'GWP', error: gwpsError },
    { label: 'CF Types', error: cfTypesError },
    { label: 'กลุ่ม EF', error: efGroupsError },
    { label: 'หน่วยนับ', error: unitsError },
    { label: 'คำนำหน้าหน่วย', error: unitPfxsError },
  ]

  const cfTypeMap = useMemo(
    () => Object.fromEntries(
      cfTypes.map((item) => [
        item.carbonfootprint_type_id,
        item.cf_type_name_short?.trim() || item.cf_type_name_th?.trim() || `#${item.carbonfootprint_type_id}`,
      ]),
    ),
    [cfTypes],
  )

  const groupMap = useMemo(
    () => Object.fromEntries(
      efGroups.map((item) => [
        item.group_emission_factor_id,
        item.group_emission_factor_name_short?.trim() || item.group_emission_factor_name?.trim() || `#${item.group_emission_factor_id}`,
      ]),
    ),
    [efGroups],
  )

  const unitMap = useMemo(
    () => Object.fromEntries(
      units.map((item) => [
        item.unit_id,
        item.unit_name?.trim() || item.unit_initial?.trim() || `#${item.unit_id}`,
      ]),
    ),
    [units],
  )

  const unitPrefixMap = useMemo(
    () => Object.fromEntries(
      unitPfxs.map((item) => [
        item.unit_prefix_id,
        item.unit_prefix_name?.trim() || item.unit_prefix_initial?.trim() || `#${item.unit_prefix_id}`,
      ]),
    ),
    [unitPfxs],
  )

  const filteredEfGroups = useMemo(() => {
    if (!efFormCfTypeId) return efGroups
    const selectedCfTypeId = Number(efFormCfTypeId)
    return efGroups.filter((item) => item.carbonfootprint_type_id === selectedCfTypeId)
  }, [efFormCfTypeId, efGroups])

  const filteredEfGroupsForTable = useMemo(() => {
    if (!efFilterCfTypeId) return efGroups
    const selectedCfTypeId = Number(efFilterCfTypeId)
    return efGroups.filter((item) => item.carbonfootprint_type_id === selectedCfTypeId)
  }, [efFilterCfTypeId, efGroups])

  const filteredEfs = useMemo(() => (
    efs.filter((item) =>
      (!efFilterCfTypeId || item.carbonfootprint_type_id === Number(efFilterCfTypeId))
      && (!efFilterGroupId || item.group_emission_factor_id === Number(efFilterGroupId))
      && (!efFilterUnitId || item.unit_id === Number(efFilterUnitId))
    )
  ), [efs, efFilterCfTypeId, efFilterGroupId, efFilterUnitId])

  useEffect(() => {
    if (!showEfModal) return
    setEfFormCfTypeId(editingEf?.carbonfootprint_type_id ? String(editingEf.carbonfootprint_type_id) : '')
    setEfFormGroupId(editingEf?.group_emission_factor_id ? String(editingEf.group_emission_factor_id) : '')
  }, [showEfModal, editingEf])

  useEffect(() => {
    if (!efFormGroupId) return
    const groupExists = filteredEfGroups.some((item) => String(item.group_emission_factor_id) === efFormGroupId)
    if (!groupExists) {
      setEfFormGroupId('')
    }
  }, [efFormGroupId, filteredEfGroups])

  useEffect(() => {
    if (!efFilterGroupId) return
    const groupExists = filteredEfGroupsForTable.some((item) => String(item.group_emission_factor_id) === efFilterGroupId)
    if (!groupExists) {
      setEfFilterGroupId('')
    }
  }, [efFilterGroupId, filteredEfGroupsForTable])

  const saveEfMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? put(`/emission-factors/coefficients/${id}`, payload) : post('/emission-factors/coefficients', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['efs'] })
      setShowEfModal(false)
      setEditingEf(null)
    },
  })

  const saveGwpMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? put(`/emission-factors/gwp/${id}`, payload) : post('/emission-factors/gwp', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gwps'] })
      setShowGwpModal(false)
      setEditingGwp(null)
    },
  })

  const saveCfTypeMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? put(`/emission-factors/cf-types/${id}`, payload) : post('/emission-factors/cf-types', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cf-types'] })
      setShowCfTypeModal(false)
      setEditingCfType(null)
    },
  })

  const saveGroupMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? put(`/emission-factors/groups/${id}`, payload) : post('/emission-factors/groups', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ef-groups'] })
      qc.invalidateQueries({ queryKey: ['efs'] })
      setShowGroupModal(false)
      setEditingGroup(null)
    },
  })

  const saveUnitMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? put(`/emission-factors/units/${id}`, payload) : post('/emission-factors/units', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units'] })
      setShowUnitModal(false)
      setEditingUnit(null)
    },
  })

  const savePfxMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? put(`/emission-factors/unit-prefixs/${id}`, payload) : post('/emission-factors/unit-prefixs', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unit-prefixs'] })
      setShowPfxModal(false)
      setEditingPfx(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (target: DeleteTarget) => {
      switch (target.type) {
        case 'ef':
          return del(`/emission-factors/coefficients/${target.id}`)
        case 'gwp':
          return del(`/emission-factors/gwp/${target.id}`)
        case 'cf-type':
          return del(`/emission-factors/cf-types/${target.id}`)
        case 'group':
          return del(`/emission-factors/groups/${target.id}`)
        case 'unit':
          return del(`/emission-factors/units/${target.id}`)
        default:
          return del(`/emission-factors/unit-prefixs/${target.id}`)
      }
    },
    onSuccess: (_, target) => {
      if (target.type === 'ef') qc.invalidateQueries({ queryKey: ['efs'] })
      if (target.type === 'gwp') qc.invalidateQueries({ queryKey: ['gwps'] })
      if (target.type === 'cf-type') {
        qc.invalidateQueries({ queryKey: ['cf-types'] })
        qc.invalidateQueries({ queryKey: ['ef-groups'] })
        qc.invalidateQueries({ queryKey: ['efs'] })
      }
      if (target.type === 'group') {
        qc.invalidateQueries({ queryKey: ['ef-groups'] })
        qc.invalidateQueries({ queryKey: ['efs'] })
      }
      if (target.type === 'unit') {
        qc.invalidateQueries({ queryKey: ['units'] })
        qc.invalidateQueries({ queryKey: ['efs'] })
      }
      if (target.type === 'unit-prefix') {
        qc.invalidateQueries({ queryKey: ['unit-prefixs'] })
        qc.invalidateQueries({ queryKey: ['efs'] })
      }
      setDeleteTarget(null)
    },
  })

  const openCreateModal = () => {
    if (tab === 'ef') {
      setEditingEf(null)
      setEfFormCfTypeId('')
      setEfFormGroupId('')
      setShowEfModal(true)
      return
    }
    if (tab === 'gwp') {
      setEditingGwp(null)
      setShowGwpModal(true)
      return
    }
    if (tab === 'cf-types') {
      setEditingCfType(null)
      setShowCfTypeModal(true)
      return
    }
    if (tab === 'groups') {
      setEditingGroup(null)
      setShowGroupModal(true)
      return
    }
    setEditingUnit(null)
    setShowUnitModal(true)
  }

  const actionButtons = <T,>(
    onEdit: (row: T) => void,
    onDelete: (row: T) => void,
  ) => (row: T) => (
    <>
      <button type="button" className="btn-icon btn-ghost btn-sm" onClick={() => onEdit(row)}>
        <Pencil size={13} />
      </button>
      <button type="button" className="btn-icon btn-ghost btn-sm text-red-500" onClick={() => onDelete(row)}>
        <Trash2 size={13} />
      </button>
    </>
  )

  const efCols: Column<Ef>[] = [
    { key: 'coef_em_factor_idCode', header: 'รหัส EF', sortable: true, render: (row) => formatText(row.coef_em_factor_idCode) },
    {
      key: 'carbonfootprint_type_id',
      header: efHeaderChip('CF Type', 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'),
      sortable: true,
      render: (row) => efText(row.carbonfootprint_type_id ? (cfTypeMap[row.carbonfootprint_type_id] ?? `#${row.carbonfootprint_type_id}`) : '—', 'font-medium text-sky-800'),
    },
    {
      key: 'group_emission_factor_id',
      header: efHeaderChip('กลุ่ม EF', 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200'),
      sortable: true,
      render: (row) => efText(row.group_emission_factor_id ? (groupMap[row.group_emission_factor_id] ?? `#${row.group_emission_factor_id}`) : '—', 'font-medium text-indigo-800'),
    },
    {
      key: 'coef_em_factor_name',
      header: efHeaderChip('ชื่อ EF', 'bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200'),
      sortable: true,
      render: (row) => efText(formatText(row.coef_em_factor_name), 'font-medium text-fuchsia-800'),
    },
    { key: 'coef_em_factor_info', header: 'รายละเอียด', sortable: true, render: (row) => formatText(row.coef_em_factor_info) },
    {
      key: 'unit_prefix_id',
      header: efHeaderChip('Prefix ตั้งต้น', 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'),
      sortable: true,
      render: (row) => efText(row.unit_prefix_id ? (unitPrefixMap[row.unit_prefix_id] ?? `#${row.unit_prefix_id}`) : '—', 'font-medium text-amber-800'),
    },
    {
      key: 'unit_id',
      header: efHeaderChip('หน่วยตั้งต้น', 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'),
      sortable: true,
      render: (row) => efText(row.unit_id ? (unitMap[row.unit_id] ?? `#${row.unit_id}`) : '—', 'font-medium text-amber-800'),
    },
    {
      key: 'coef_em_factor_value_co2',
      header: efHeaderChip('CO2', 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'),
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold text-emerald-700">{formatNumber(row.coef_em_factor_value_co2)}</span>,
    },
    {
      key: 'unit_prefix_id_co2',
      header: efHeaderChip('Prefix CO2', 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'),
      sortable: true,
      render: (row) => efText(row.unit_prefix_id_co2 ? (unitPrefixMap[row.unit_prefix_id_co2] ?? `#${row.unit_prefix_id_co2}`) : '—', 'font-medium text-emerald-800'),
    },
    {
      key: 'unit_id_co2',
      header: efHeaderChip('หน่วย CO2', 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'),
      sortable: true,
      render: (row) => efText(row.unit_id_co2 ? (unitMap[row.unit_id_co2] ?? `#${row.unit_id_co2}`) : '—', 'font-medium text-emerald-800'),
    },
    {
      key: 'coef_em_factor_value_ch4foss',
      header: efHeaderChip('CH4 Fossil', 'bg-orange-100 text-orange-800 ring-1 ring-orange-200'),
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold text-orange-700">{formatNumber(row.coef_em_factor_value_ch4foss)}</span>,
    },
    {
      key: 'unit_prefix_id_ch4foss',
      header: efHeaderChip('Prefix CH4 Fossil', 'bg-orange-100 text-orange-800 ring-1 ring-orange-200'),
      sortable: true,
      render: (row) => efText(row.unit_prefix_id_ch4foss ? (unitPrefixMap[row.unit_prefix_id_ch4foss] ?? `#${row.unit_prefix_id_ch4foss}`) : '—', 'font-medium text-orange-800'),
    },
    {
      key: 'unit_id_ch4foss',
      header: efHeaderChip('หน่วย CH4 Fossil', 'bg-orange-100 text-orange-800 ring-1 ring-orange-200'),
      sortable: true,
      render: (row) => efText(row.unit_id_ch4foss ? (unitMap[row.unit_id_ch4foss] ?? `#${row.unit_id_ch4foss}`) : '—', 'font-medium text-orange-800'),
    },
    {
      key: 'coef_em_factor_value_ch4',
      header: efHeaderChip('CH4', 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200'),
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold text-cyan-700">{formatNumber(row.coef_em_factor_value_ch4)}</span>,
    },
    {
      key: 'unit_prefix_id_ch4',
      header: efHeaderChip('Prefix CH4', 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200'),
      sortable: true,
      render: (row) => efText(row.unit_prefix_id_ch4 ? (unitPrefixMap[row.unit_prefix_id_ch4] ?? `#${row.unit_prefix_id_ch4}`) : '—', 'font-medium text-cyan-800'),
    },
    {
      key: 'unit_id_ch4',
      header: efHeaderChip('หน่วย CH4', 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200'),
      sortable: true,
      render: (row) => efText(row.unit_id_ch4 ? (unitMap[row.unit_id_ch4] ?? `#${row.unit_id_ch4}`) : '—', 'font-medium text-cyan-800'),
    },
    {
      key: 'coef_em_factor_value_n2o',
      header: efHeaderChip('N2O', 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'),
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold text-rose-700">{formatNumber(row.coef_em_factor_value_n2o)}</span>,
    },
    {
      key: 'unit_prefix_id_n2o',
      header: efHeaderChip('Prefix N2O', 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'),
      sortable: true,
      render: (row) => efText(row.unit_prefix_id_n2o ? (unitPrefixMap[row.unit_prefix_id_n2o] ?? `#${row.unit_prefix_id_n2o}`) : '—', 'font-medium text-rose-800'),
    },
    {
      key: 'unit_id_n2o',
      header: efHeaderChip('หน่วย N2O', 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'),
      sortable: true,
      render: (row) => efText(row.unit_id_n2o ? (unitMap[row.unit_id_n2o] ?? `#${row.unit_id_n2o}`) : '—', 'font-medium text-rose-800'),
    },
    {
      key: 'coef_em_factor_value_total',
      header: efHeaderChip('Total', 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'),
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold text-violet-700">{formatNumber(row.coef_em_factor_value_total)}</span>,
    },
    {
      key: 'unit_prefix_id_total',
      header: efHeaderChip('Prefix Total', 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'),
      sortable: true,
      render: (row) => efText(row.unit_prefix_id_total ? (unitPrefixMap[row.unit_prefix_id_total] ?? `#${row.unit_prefix_id_total}`) : '—', 'font-medium text-violet-800'),
    },
    {
      key: 'unit_id_total',
      header: efHeaderChip('หน่วย Total', 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'),
      sortable: true,
      render: (row) => efText(row.unit_id_total ? (unitMap[row.unit_id_total] ?? `#${row.unit_id_total}`) : '—', 'font-medium text-violet-800'),
    },
    { key: 'coef_em_factor_ref', header: 'Ref', sortable: true, render: (row) => row.coef_em_factor_ref ?? '—' },
    { key: 'coef_em_factor_updatePostDateRef', header: 'วันที่อ้างอิง', sortable: true, render: (row) => formatBangkokDateTime(row.coef_em_factor_updatePostDateRef) },
    { key: 'update_uid', header: 'ผู้แก้ไขล่าสุด', sortable: true, render: (row) => row.update_uid ?? '—' },
    { key: 'create_at', header: 'สร้างเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.create_at) },
    { key: 'update_at', header: 'อัปเดตเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.update_at) },
  ]

  const gwpCols: Column<Gwp>[] = [
    { key: 'coef_em_factor_gwp_name', header: 'ชื่อ GWP', sortable: true, render: (row) => formatText(row.coef_em_factor_gwp_name) },
    { key: 'coef_em_factor_gwp_name_en', header: 'Name (EN)', sortable: true, render: (row) => formatText(row.coef_em_factor_gwp_name_en) },
    { key: 'coef_em_factor_gwp_value', header: 'ค่า GWP', sortable: true, render: (row) => <span className="font-mono font-semibold text-accent-700">{formatNumber(row.coef_em_factor_gwp_value)}</span> },
    { key: 'coef_em_factor_gwp_info', header: 'รายละเอียด', sortable: true, render: (row) => formatText(row.coef_em_factor_gwp_info) },
    { key: 'coef_em_factor_gwp_ref', header: 'Ref', sortable: true, render: (row) => row.coef_em_factor_gwp_ref ?? '—' },
    { key: 'coef_em_factor_gwp_update_uid', header: 'ผู้แก้ไขล่าสุด', sortable: true, render: (row) => row.coef_em_factor_gwp_update_uid ?? '—' },
    { key: 'coef_em_factor_gwp_create_at', header: 'สร้างเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.coef_em_factor_gwp_create_at) },
    { key: 'coef_em_factor_gwp_update_at', header: 'อัปเดตเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.coef_em_factor_gwp_update_at) },
  ]

  const cfTypeCols: Column<CfType>[] = [
    { key: 'cf_type_name_short', header: 'ชื่อย่อ', sortable: true, render: (row) => formatText(row.cf_type_name_short) },
    { key: 'cf_type_name_th', header: 'ชื่อ (ไทย)', sortable: true, render: (row) => formatText(row.cf_type_name_th) },
    { key: 'cf_type_name_en', header: 'ชื่อ (EN)', sortable: true, render: (row) => formatText(row.cf_type_name_en) },
    { key: 'cf_type_create_at', header: 'สร้างเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.cf_type_create_at) },
    { key: 'cf_type_update_at', header: 'อัปเดตเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.cf_type_update_at) },
  ]

  const groupCols: Column<EfGroup>[] = [
    { key: 'group_emission_factor_idCode', header: 'รหัส', sortable: true, render: (row) => formatText(row.group_emission_factor_idCode) },
    { key: 'group_emission_factor_name_short', header: 'ชื่อย่อ', sortable: true, render: (row) => formatText(row.group_emission_factor_name_short) },
    { key: 'group_emission_factor_name', header: 'ชื่อกลุ่ม EF', sortable: true, render: (row) => formatText(row.group_emission_factor_name) },
    { key: 'group_emission_factor_info', header: 'รายละเอียด', sortable: true, render: (row) => formatText(row.group_emission_factor_info) },
    { key: 'carbonfootprint_type_id', header: 'CF Type', sortable: true, render: (row) => row.carbonfootprint_type_id ? (cfTypeMap[row.carbonfootprint_type_id] ?? `#${row.carbonfootprint_type_id}`) : '—' },
  ]

  const unitCols: Column<Unit>[] = [
    { key: 'unit_name', header: 'ชื่อหน่วย', sortable: true, render: (row) => formatText(row.unit_name) },
    { key: 'unit_initial', header: 'ตัวย่อ', sortable: true, render: (row) => formatText(row.unit_initial) },
    { key: 'unit_updated_uid', header: 'ผู้แก้ไขล่าสุด', sortable: true, render: (row) => row.unit_updated_uid ?? '—' },
    { key: 'unit_updated_at', header: 'อัปเดตเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.unit_updated_at) },
  ]

  const unitPfxCols: Column<UnitPrefix>[] = [
    { key: 'unit_prefix_name', header: 'ชื่อ Prefix', sortable: true, render: (row) => formatText(row.unit_prefix_name) },
    { key: 'unit_prefix_initial', header: 'ตัวย่อ', sortable: true, render: (row) => formatText(row.unit_prefix_initial) },
    { key: 'unit_prefix_value', header: 'ค่าตัวคูณ', sortable: true, render: (row) => <span className="font-mono">{formatNumber(row.unit_prefix_value)}</span> },
    { key: 'unit_prefix_updated_uid', header: 'ผู้แก้ไขล่าสุด', sortable: true, render: (row) => row.unit_prefix_updated_uid ?? '—' },
    { key: 'unit_prefix_updated_at', header: 'อัปเดตเมื่อ', sortable: true, render: (row) => formatBangkokDateTime(row.unit_prefix_updated_at) },
  ]

  const tabConfigs: { key: TabKey; label: string; count: number }[] = [
    { key: 'ef', label: 'Emission Factors', count: efs.length },
    { key: 'gwp', label: 'GWP', count: gwps.length },
    { key: 'cf-types', label: 'CF Types', count: cfTypes.length },
    { key: 'groups', label: 'กลุ่ม EF', count: efGroups.length },
    { key: 'units', label: 'หน่วย', count: units.length },
  ]

  const addLabel: Record<TabKey, string> = {
    ef: 'เพิ่ม EF',
    gwp: 'เพิ่ม GWP',
    'cf-types': 'เพิ่ม CF Type',
    groups: 'เพิ่มกลุ่ม EF',
    units: 'เพิ่มหน่วย',
  }

  const handleSaveEf = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    saveEfMut.mutate({
      id: editingEf?.coefficient_emission_factor_id,
      payload: {
        coef_em_factor_idCode: toOptionalText(form.get('coef_em_factor_idCode')),
        carbonfootprint_type_id: toOptionalNumber(form.get('carbonfootprint_type_id')),
        group_emission_factor_id: toOptionalNumber(form.get('group_emission_factor_id')),
        coef_em_factor_name: toOptionalText(form.get('coef_em_factor_name')),
        coef_em_factor_info: toOptionalText(form.get('coef_em_factor_info')),
        unit_prefix_id: toOptionalNumber(form.get('unit_prefix_id')),
        unit_id: toOptionalNumber(form.get('unit_id')),
        coef_em_factor_value_co2: toOptionalNumber(form.get('coef_em_factor_value_co2')),
        unit_prefix_id_co2: toOptionalNumber(form.get('unit_prefix_id_co2')),
        unit_id_co2: toOptionalNumber(form.get('unit_id_co2')),
        coef_em_factor_value_ch4foss: toOptionalNumber(form.get('coef_em_factor_value_ch4foss')),
        unit_prefix_id_ch4foss: toOptionalNumber(form.get('unit_prefix_id_ch4foss')),
        unit_id_ch4foss: toOptionalNumber(form.get('unit_id_ch4foss')),
        coef_em_factor_value_ch4: toOptionalNumber(form.get('coef_em_factor_value_ch4')),
        unit_prefix_id_ch4: toOptionalNumber(form.get('unit_prefix_id_ch4')),
        unit_id_ch4: toOptionalNumber(form.get('unit_id_ch4')),
        coef_em_factor_value_n2o: toOptionalNumber(form.get('coef_em_factor_value_n2o')),
        unit_prefix_id_n2o: toOptionalNumber(form.get('unit_prefix_id_n2o')),
        unit_id_n2o: toOptionalNumber(form.get('unit_id_n2o')),
        coef_em_factor_value_total: toOptionalNumber(form.get('coef_em_factor_value_total')),
        unit_prefix_id_total: toOptionalNumber(form.get('unit_prefix_id_total')),
        unit_id_total: toOptionalNumber(form.get('unit_id_total')),
        coef_em_factor_ref: toOptionalNumber(form.get('coef_em_factor_ref')),
        coef_em_factor_updatePostDateRef: toOptionalText(form.get('coef_em_factor_updatePostDateRef')),
        update_uid: toOptionalNumber(form.get('update_uid')),
      },
    })
  }

  const handleSaveGwp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    saveGwpMut.mutate({
      id: editingGwp?.coefficients_emissions_factors_gwp_id,
      payload: {
        coef_em_factor_gwp_name: toOptionalText(form.get('coef_em_factor_gwp_name')),
        coef_em_factor_gwp_name_en: toOptionalText(form.get('coef_em_factor_gwp_name_en')),
        coef_em_factor_gwp_value: toOptionalNumber(form.get('coef_em_factor_gwp_value')),
        coef_em_factor_gwp_info: toOptionalText(form.get('coef_em_factor_gwp_info')),
        coef_em_factor_gwp_update_uid: toOptionalNumber(form.get('coef_em_factor_gwp_update_uid')),
        coef_em_factor_gwp_ref: toOptionalNumber(form.get('coef_em_factor_gwp_ref')),
      },
    })
  }

  const handleSaveCfType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    saveCfTypeMut.mutate({
      id: editingCfType?.carbonfootprint_type_id,
      payload: {
        cf_type_name_short: toOptionalText(form.get('cf_type_name_short')),
        cf_type_name_th: toOptionalText(form.get('cf_type_name_th')),
        cf_type_name_en: toOptionalText(form.get('cf_type_name_en')),
      },
    })
  }

  const handleSaveGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    saveGroupMut.mutate({
      id: editingGroup?.group_emission_factor_id,
      payload: {
        group_emission_factor_idCode: toOptionalText(form.get('group_emission_factor_idCode')),
        group_emission_factor_name_short: toOptionalText(form.get('group_emission_factor_name_short')),
        group_emission_factor_name: toOptionalText(form.get('group_emission_factor_name')),
        group_emission_factor_info: toOptionalText(form.get('group_emission_factor_info')),
        carbonfootprint_type_id: toOptionalNumber(form.get('carbonfootprint_type_id')),
      },
    })
  }

  const handleSaveUnit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    saveUnitMut.mutate({
      id: editingUnit?.unit_id,
      payload: {
        unit_name: toOptionalText(form.get('unit_name')),
        unit_initial: toOptionalText(form.get('unit_initial')),
        unit_updated_uid: toOptionalNumber(form.get('unit_updated_uid')),
      },
    })
  }

  const handleSavePfx = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    savePfxMut.mutate({
      id: editingPfx?.unit_prefix_id,
      payload: {
        unit_prefix_name: toOptionalText(form.get('unit_prefix_name')),
        unit_prefix_initial: toOptionalText(form.get('unit_prefix_initial')),
        unit_prefix_value: toOptionalNumber(form.get('unit_prefix_value')),
        unit_prefix_updated_uid: toOptionalNumber(form.get('unit_prefix_updated_uid')),
      },
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FlaskConical size={20} className="text-primary-600" /> EF / GWP / หน่วย / CF Type
          </h1>
          <p className="page-subtitle">จัดการ emission factor, ค่า GWP, กลุ่มข้อมูลอ้างอิง และหน่วยวัดให้ครบตามฐานข้อมูล</p>
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <Plus size={14} /> {addLabel[tab]}
        </button>
      </div>

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      <div className="card">
        <div className="mb-4 flex flex-col gap-4 border-b border-surface-200 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-surface-900">รายการข้อมูล</h2>
              <p className="text-sm text-surface-500">เลือกหมวดที่ต้องการจัดการ แล้วเพิ่ม แก้ไข หรือลบข้อมูลได้จากตารางเดียวกัน</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge-blue">EF {efs.length}</span>
              <span className="badge-gray">GWP {gwps.length}</span>
              <span className="badge-gray">CF Type {cfTypes.length}</span>
              <span className="badge-gray">กลุ่ม EF {efGroups.length}</span>
              <span className="badge-gray">หน่วย {units.length + unitPfxs.length}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabConfigs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                  tab === item.key
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200 hover:text-surface-800'
                }`}
              >
                {item.label} <span className="ml-1 text-xs opacity-80">({item.count})</span>
              </button>
            ))}
          </div>

          {tab === 'gwp' && gwps.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {gwps.slice(0, 4).map((item) => (
                <div key={item.coefficients_emissions_factors_gwp_id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                  <p className="text-xs text-surface-500">{formatText(item.coef_em_factor_gwp_name_en)}</p>
                  <p className="mt-1 text-sm font-semibold text-surface-800">{formatText(item.coef_em_factor_gwp_name)}</p>
                  <p className="mt-3 font-mono text-xl font-semibold text-primary-700">{formatNumber(item.coef_em_factor_gwp_value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {tab === 'ef' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-[linear-gradient(180deg,#fbfdff,#f5f9fd)] p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-surface-900">กลุ่มสีในตาราง EF</h3>
                <p className="mt-1 text-xs text-surface-500">ใช้สีแยกหมวด CF Type, กลุ่ม EF, หน่วยตั้งต้น และ gas แต่ละกลุ่มเพื่อให้อ่านตารางยาวได้ง่ายขึ้น</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {efHeaderChip('CF Type', 'bg-sky-100 text-sky-800 ring-1 ring-sky-200')}
                {efHeaderChip('กลุ่ม EF', 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200')}
                {efHeaderChip('ชื่อ EF', 'bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200')}
                {efHeaderChip('หน่วยตั้งต้น', 'bg-amber-100 text-amber-800 ring-1 ring-amber-200')}
                {efHeaderChip('CO2', 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200')}
                {efHeaderChip('CH4 Fossil', 'bg-orange-100 text-orange-800 ring-1 ring-orange-200')}
                {efHeaderChip('CH4', 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200')}
                {efHeaderChip('N2O', 'bg-rose-100 text-rose-800 ring-1 ring-rose-200')}
                {efHeaderChip('Total', 'bg-violet-100 text-violet-800 ring-1 ring-violet-200')}
              </div>
            </div>

            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-surface-900">ตัวกรอง Emission Factors</h3>
                  <p className="text-xs text-surface-500">กรองข้อมูลตาม CF Type, กลุ่ม EF และหน่วยตั้งต้น</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setEfFilterCfTypeId('')
                    setEfFilterGroupId('')
                    setEfFilterUnitId('')
                  }}
                >
                  ล้างตัวกรอง
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <FieldLabel>CF Type</FieldLabel>
                  <select className="select" value={efFilterCfTypeId} onChange={(event) => setEfFilterCfTypeId(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {cfTypes.map((item) => (
                      <option key={item.carbonfootprint_type_id} value={item.carbonfootprint_type_id}>
                        {item.cf_type_name_short?.trim() || item.cf_type_name_th?.trim() || `#${item.carbonfootprint_type_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>กลุ่ม EF</FieldLabel>
                  <select className="select" value={efFilterGroupId} onChange={(event) => setEfFilterGroupId(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {filteredEfGroupsForTable.map((item) => (
                      <option key={item.group_emission_factor_id} value={item.group_emission_factor_id}>
                        {item.group_emission_factor_name_short?.trim() || item.group_emission_factor_name?.trim() || `#${item.group_emission_factor_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>หน่วยตั้งต้น</FieldLabel>
                  <select className="select" value={efFilterUnitId} onChange={(event) => setEfFilterUnitId(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {units.map((item) => (
                      <option key={item.unit_id} value={item.unit_id}>
                        {item.unit_name?.trim() || item.unit_initial?.trim() || `#${item.unit_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>จำนวนที่แสดง</FieldLabel>
                  <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-700">
                    {filteredEfs.length.toLocaleString('en-US')} รายการ
                  </div>
                </div>
              </div>
            </div>

            <DataTable
              data={filteredEfs}
              columns={efCols}
              isLoading={efLoad}
              rowKey={(row) => row.coefficient_emission_factor_id}
              defaultPageSize={10}
              searchPlaceholder="ค้นหา EF, กลุ่ม EF, CF Type หรือค่า factor..."
              actions={actionButtons<Ef>(
                (row) => {
                  setEditingEf(row)
                  setEfFormCfTypeId(row.carbonfootprint_type_id ? String(row.carbonfootprint_type_id) : '')
                  setEfFormGroupId(row.group_emission_factor_id ? String(row.group_emission_factor_id) : '')
                  setShowEfModal(true)
                },
                (row) => setDeleteTarget({ type: 'ef', id: row.coefficient_emission_factor_id, name: row.coef_em_factor_name?.trim() || row.coef_em_factor_idCode?.trim() || `EF #${row.coefficient_emission_factor_id}` }),
              )}
            />
          </div>
        )}

        {tab === 'gwp' && (
          <DataTable
            data={gwps}
            columns={gwpCols}
            isLoading={gwpLoad}
            rowKey={(row) => row.coefficients_emissions_factors_gwp_id}
            defaultPageSize={10}
            searchPlaceholder="ค้นหา GWP..."
            actions={actionButtons<Gwp>(
              (row) => { setEditingGwp(row); setShowGwpModal(true) },
              (row) => setDeleteTarget({ type: 'gwp', id: row.coefficients_emissions_factors_gwp_id, name: row.coef_em_factor_gwp_name?.trim() || `GWP #${row.coefficients_emissions_factors_gwp_id}` }),
            )}
          />
        )}

        {tab === 'cf-types' && (
          <DataTable
            data={cfTypes}
            columns={cfTypeCols}
            isLoading={ctLoad}
            rowKey={(row) => row.carbonfootprint_type_id}
            defaultPageSize={10}
            searchPlaceholder="ค้นหา CF Type..."
            actions={actionButtons<CfType>(
              (row) => { setEditingCfType(row); setShowCfTypeModal(true) },
              (row) => setDeleteTarget({ type: 'cf-type', id: row.carbonfootprint_type_id, name: row.cf_type_name_th?.trim() || row.cf_type_name_short?.trim() || `CF Type #${row.carbonfootprint_type_id}` }),
            )}
          />
        )}

        {tab === 'groups' && (
          <DataTable
            data={efGroups}
            columns={groupCols}
            isLoading={egLoad}
            rowKey={(row) => row.group_emission_factor_id}
            defaultPageSize={10}
            searchPlaceholder="ค้นหากลุ่ม EF..."
            actions={actionButtons<EfGroup>(
              (row) => { setEditingGroup(row); setShowGroupModal(true) },
              (row) => setDeleteTarget({ type: 'group', id: row.group_emission_factor_id, name: row.group_emission_factor_name?.trim() || row.group_emission_factor_name_short?.trim() || `Group #${row.group_emission_factor_id}` }),
            )}
          />
        )}

        {tab === 'units' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 border-b border-surface-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-surface-900">หน่วยวัด (units)</h3>
                  <p className="text-xs text-surface-500">จัดการรายการหน่วยหลักที่ใช้ผูกกับ emission factor</p>
                </div>
                <button className="btn-primary btn-sm" onClick={() => { setEditingUnit(null); setShowUnitModal(true) }}>
                  <Plus size={13} /> เพิ่ม Unit
                </button>
              </div>
              <DataTable
                data={units}
                columns={unitCols}
                isLoading={uLoad}
                rowKey={(row) => row.unit_id}
                defaultPageSize={10}
                searchPlaceholder="ค้นหาหน่วย..."
                actions={actionButtons<Unit>(
                  (row) => { setEditingUnit(row); setShowUnitModal(true) },
                  (row) => setDeleteTarget({ type: 'unit', id: row.unit_id, name: row.unit_name?.trim() || row.unit_initial?.trim() || `Unit #${row.unit_id}` }),
                )}
              />
            </div>

            <div className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 border-b border-surface-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-surface-900">คำนำหน้าหน่วย (units_prefixs)</h3>
                  <p className="text-xs text-surface-500">แยก prefix ออกจากหน่วยหลักเพื่อผูกใช้งานได้ยืดหยุ่นขึ้น</p>
                </div>
                <button className="btn-primary btn-sm" onClick={() => { setEditingPfx(null); setShowPfxModal(true) }}>
                  <Plus size={13} /> เพิ่ม Prefix
                </button>
              </div>
              <DataTable
                data={unitPfxs}
                columns={unitPfxCols}
                isLoading={upLoad}
                rowKey={(row) => row.unit_prefix_id}
                defaultPageSize={10}
                searchPlaceholder="ค้นหา Prefix..."
                actions={actionButtons<UnitPrefix>(
                  (row) => { setEditingPfx(row); setShowPfxModal(true) },
                  (row) => setDeleteTarget({ type: 'unit-prefix', id: row.unit_prefix_id, name: row.unit_prefix_name?.trim() || row.unit_prefix_initial?.trim() || `Prefix #${row.unit_prefix_id}` }),
                )}
              />
            </div>
          </div>
        )}
      </div>

      {showEfModal && (
        <ModalShell title={editingEf ? 'แก้ไข Emission Factor' : 'เพิ่ม Emission Factor'} onClose={() => setShowEfModal(false)}>
          <form onSubmit={handleSaveEf}>
            <div className="space-y-6">
              <FormSection title="ข้อมูลหลัก" description="กำหนดตัวตนของ emission factor และเชื่อมกับหมวดอ้างอิงที่เกี่ยวข้อง">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>รหัส EF</FieldLabel>
                    <input className="input" name="coef_em_factor_idCode" defaultValue={editingEf?.coef_em_factor_idCode ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ชื่อ EF *</FieldLabel>
                    <input className="input" name="coef_em_factor_name" required defaultValue={editingEf?.coef_em_factor_name ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>CF Type</FieldLabel>
                    <select
                      className="select"
                      name="carbonfootprint_type_id"
                      value={efFormCfTypeId}
                      onChange={(event) => {
                        setEfFormCfTypeId(event.target.value)
                      }}
                    >
                      <option value="">— ไม่ระบุ —</option>
                      {cfTypes.map((item) => (
                        <option key={item.carbonfootprint_type_id} value={item.carbonfootprint_type_id}>
                          {item.cf_type_name_short?.trim() || item.cf_type_name_th?.trim() || `#${item.carbonfootprint_type_id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>กลุ่ม EF</FieldLabel>
                    <select
                      className="select"
                      name="group_emission_factor_id"
                      value={efFormGroupId}
                      onChange={(event) => {
                        setEfFormGroupId(event.target.value)
                      }}
                    >
                      <option value="">— ไม่ระบุ —</option>
                      {filteredEfGroups.map((item) => (
                        <option key={item.group_emission_factor_id} value={item.group_emission_factor_id}>
                          {item.group_emission_factor_name_short?.trim() || item.group_emission_factor_name?.trim() || `#${item.group_emission_factor_id}`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-surface-500">
                      {efFormCfTypeId
                        ? 'แสดงเฉพาะกลุ่ม EF ที่อยู่ใน Carbon Footprint Type ที่เลือก'
                        : 'หากเลือก Carbon Footprint Type ก่อน ระบบจะกรองกลุ่ม EF ให้ตรงประเภทอัตโนมัติ'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>รายละเอียด</FieldLabel>
                    <textarea className="input min-h-24" name="coef_em_factor_info" defaultValue={editingEf?.coef_em_factor_info ?? ''} />
                  </div>
                </div>
              </FormSection>

              <FormSection title="หน่วยตั้งต้น" description="ตั้งค่าหน่วยหลักของ emission factor ก่อนแตกเป็นค่าในแต่ละ gas">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Prefix ตั้งต้น</FieldLabel>
                    <select className="select" name="unit_prefix_id" defaultValue={editingEf?.unit_prefix_id ?? ''}>
                      <option value="">— ไม่ระบุ —</option>
                      {unitPfxs.map((item) => (
                        <option key={item.unit_prefix_id} value={item.unit_prefix_id}>
                          {item.unit_prefix_name?.trim() || item.unit_prefix_initial?.trim() || `#${item.unit_prefix_id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>หน่วยตั้งต้น</FieldLabel>
                    <select className="select" name="unit_id" defaultValue={editingEf?.unit_id ?? ''}>
                      <option value="">— ไม่ระบุ —</option>
                      {units.map((item) => (
                        <option key={item.unit_id} value={item.unit_id}>
                          {item.unit_name?.trim() || item.unit_initial?.trim() || `#${item.unit_id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FormSection>

              <FormSection title="ค่า Emission" description="แต่ละ gas ถูกแยกเป็นการ์ดของตัวเองเพื่อให้มองเห็นค่าและหน่วยในชุดเดียวกัน">
                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <EmissionMetricCard
                    title="CO2"
                    valueName="coef_em_factor_value_co2"
                    prefixName="unit_prefix_id_co2"
                    unitName="unit_id_co2"
                    defaultValue={editingEf?.coef_em_factor_value_co2}
                    defaultPrefix={editingEf?.unit_prefix_id_co2}
                    defaultUnit={editingEf?.unit_id_co2}
                    unitPfxs={unitPfxs}
                    units={units}
                  />
                  <EmissionMetricCard
                    title="CH4 Fossil"
                    valueName="coef_em_factor_value_ch4foss"
                    prefixName="unit_prefix_id_ch4foss"
                    unitName="unit_id_ch4foss"
                    defaultValue={editingEf?.coef_em_factor_value_ch4foss}
                    defaultPrefix={editingEf?.unit_prefix_id_ch4foss}
                    defaultUnit={editingEf?.unit_id_ch4foss}
                    unitPfxs={unitPfxs}
                    units={units}
                  />
                  <EmissionMetricCard
                    title="CH4"
                    valueName="coef_em_factor_value_ch4"
                    prefixName="unit_prefix_id_ch4"
                    unitName="unit_id_ch4"
                    defaultValue={editingEf?.coef_em_factor_value_ch4}
                    defaultPrefix={editingEf?.unit_prefix_id_ch4}
                    defaultUnit={editingEf?.unit_id_ch4}
                    unitPfxs={unitPfxs}
                    units={units}
                  />
                  <EmissionMetricCard
                    title="N2O"
                    valueName="coef_em_factor_value_n2o"
                    prefixName="unit_prefix_id_n2o"
                    unitName="unit_id_n2o"
                    defaultValue={editingEf?.coef_em_factor_value_n2o}
                    defaultPrefix={editingEf?.unit_prefix_id_n2o}
                    defaultUnit={editingEf?.unit_id_n2o}
                    unitPfxs={unitPfxs}
                    units={units}
                  />
                  <EmissionMetricCard
                    title="Total"
                    valueName="coef_em_factor_value_total"
                    prefixName="unit_prefix_id_total"
                    unitName="unit_id_total"
                    defaultValue={editingEf?.coef_em_factor_value_total}
                    defaultPrefix={editingEf?.unit_prefix_id_total}
                    defaultUnit={editingEf?.unit_id_total}
                    unitPfxs={unitPfxs}
                    units={units}
                  />
                </div>
              </FormSection>

              <FormSection title="อ้างอิงและการติดตาม" description="เก็บ reference และผู้แก้ไขล่าสุดไว้ในหมวดเดียวกัน">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <FieldLabel>Ref</FieldLabel>
                    <input className="input" name="coef_em_factor_ref" type="number" defaultValue={editingEf?.coef_em_factor_ref ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>วันที่อ้างอิง</FieldLabel>
                    <input className="input" name="coef_em_factor_updatePostDateRef" type="date" defaultValue={toDateInputValue(editingEf?.coef_em_factor_updatePostDateRef)} />
                  </div>
                  <div>
                    <FieldLabel>ผู้แก้ไขล่าสุด</FieldLabel>
                    <input className="input" name="update_uid" type="number" defaultValue={editingEf?.update_uid ?? ''} />
                  </div>
                </div>
              </FormSection>
            </div>

            {saveEfMut.isError && <p className="mt-4 text-sm text-red-600">{saveEfMut.error.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-surface-200 pt-4 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowEfModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={saveEfMut.isPending}>
                {saveEfMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showGwpModal && (
        <ModalShell title={editingGwp ? 'แก้ไข GWP' : 'เพิ่ม GWP'} onClose={() => setShowGwpModal(false)}>
          <form onSubmit={handleSaveGwp}>
            <div className="space-y-6">
              <FormSection title="ข้อมูล GWP" description="ชื่อและค่าหลักของ GWP อยู่ในกลุ่มเดียวกันเพื่อกรอกได้เร็วขึ้น">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>ชื่อ GWP *</FieldLabel>
                    <input className="input" name="coef_em_factor_gwp_name" required defaultValue={editingGwp?.coef_em_factor_gwp_name ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>Name (EN)</FieldLabel>
                    <input className="input" name="coef_em_factor_gwp_name_en" defaultValue={editingGwp?.coef_em_factor_gwp_name_en ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ค่า GWP</FieldLabel>
                    <input className="input" name="coef_em_factor_gwp_value" type="number" step="any" defaultValue={editingGwp?.coef_em_factor_gwp_value ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>Ref</FieldLabel>
                    <input className="input" name="coef_em_factor_gwp_ref" type="number" defaultValue={editingGwp?.coef_em_factor_gwp_ref ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ผู้แก้ไขล่าสุด</FieldLabel>
                    <input className="input" name="coef_em_factor_gwp_update_uid" type="number" defaultValue={editingGwp?.coef_em_factor_gwp_update_uid ?? ''} />
                  </div>
                  <div className="lg:col-span-2">
                    <FieldLabel>รายละเอียด</FieldLabel>
                    <textarea className="input min-h-24" name="coef_em_factor_gwp_info" defaultValue={editingGwp?.coef_em_factor_gwp_info ?? ''} />
                  </div>
                </div>
              </FormSection>
            </div>
            {saveGwpMut.isError && <p className="mt-4 text-sm text-red-600">{saveGwpMut.error.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-surface-200 pt-4 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowGwpModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={saveGwpMut.isPending}>
                {saveGwpMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showCfTypeModal && (
        <ModalShell title={editingCfType ? 'แก้ไข CF Type' : 'เพิ่ม CF Type'} onClose={() => setShowCfTypeModal(false)}>
          <form onSubmit={handleSaveCfType}>
            <div className="space-y-6">
              <FormSection title="ข้อมูล CF Type" description="แยกชื่อย่อ ชื่อไทย และชื่ออังกฤษให้อยู่ในบล็อกเดียวกัน">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>ชื่อย่อ</FieldLabel>
                    <input className="input" name="cf_type_name_short" defaultValue={editingCfType?.cf_type_name_short ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ชื่อ (ไทย) *</FieldLabel>
                    <input className="input" name="cf_type_name_th" required defaultValue={editingCfType?.cf_type_name_th ?? ''} />
                  </div>
                  <div className="lg:col-span-2">
                    <FieldLabel>ชื่อ (EN)</FieldLabel>
                    <input className="input" name="cf_type_name_en" defaultValue={editingCfType?.cf_type_name_en ?? ''} />
                  </div>
                </div>
              </FormSection>
            </div>
            {saveCfTypeMut.isError && <p className="mt-4 text-sm text-red-600">{saveCfTypeMut.error.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-surface-200 pt-4 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowCfTypeModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={saveCfTypeMut.isPending}>
                {saveCfTypeMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showGroupModal && (
        <ModalShell title={editingGroup ? 'แก้ไขกลุ่ม EF' : 'เพิ่มกลุ่ม EF'} onClose={() => setShowGroupModal(false)}>
          <form onSubmit={handleSaveGroup}>
            <div className="space-y-6">
              <FormSection title="ข้อมูลกลุ่ม EF" description="รวมข้อมูลกลุ่มและการเชื่อมกับ CF Type ให้อยู่ในชุดเดียวกัน">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>รหัสกลุ่ม</FieldLabel>
                    <input className="input" name="group_emission_factor_idCode" defaultValue={editingGroup?.group_emission_factor_idCode ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ชื่อย่อ</FieldLabel>
                    <input className="input" name="group_emission_factor_name_short" defaultValue={editingGroup?.group_emission_factor_name_short ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ชื่อกลุ่ม EF *</FieldLabel>
                    <input className="input" name="group_emission_factor_name" required defaultValue={editingGroup?.group_emission_factor_name ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>CF Type</FieldLabel>
                    <select className="select" name="carbonfootprint_type_id" defaultValue={editingGroup?.carbonfootprint_type_id ?? ''}>
                      <option value="">— ไม่ระบุ —</option>
                      {cfTypes.map((item) => (
                        <option key={item.carbonfootprint_type_id} value={item.carbonfootprint_type_id}>
                          {item.cf_type_name_short?.trim() || item.cf_type_name_th?.trim() || `#${item.carbonfootprint_type_id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <FieldLabel>รายละเอียด</FieldLabel>
                    <textarea className="input min-h-24" name="group_emission_factor_info" defaultValue={editingGroup?.group_emission_factor_info ?? ''} />
                  </div>
                </div>
              </FormSection>
            </div>
            {saveGroupMut.isError && <p className="mt-4 text-sm text-red-600">{saveGroupMut.error.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-surface-200 pt-4 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowGroupModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={saveGroupMut.isPending}>
                {saveGroupMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showUnitModal && (
        <ModalShell title={editingUnit ? 'แก้ไขหน่วยวัด' : 'เพิ่มหน่วยวัด'} onClose={() => setShowUnitModal(false)}>
          <form onSubmit={handleSaveUnit}>
            <div className="space-y-6">
              <FormSection title="ข้อมูลหน่วยวัด" description="ฟอร์มนี้ปรับให้กระชับและยืดหดตามความกว้างหน้าจอ">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>ชื่อหน่วย *</FieldLabel>
                    <input className="input" name="unit_name" required defaultValue={editingUnit?.unit_name ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ตัวย่อ</FieldLabel>
                    <input className="input" name="unit_initial" defaultValue={editingUnit?.unit_initial ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ผู้แก้ไขล่าสุด</FieldLabel>
                    <input className="input" name="unit_updated_uid" type="number" defaultValue={editingUnit?.unit_updated_uid ?? ''} />
                  </div>
                </div>
              </FormSection>
            </div>
            {saveUnitMut.isError && <p className="mt-4 text-sm text-red-600">{saveUnitMut.error.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-surface-200 pt-4 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowUnitModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={saveUnitMut.isPending}>
                {saveUnitMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showPfxModal && (
        <ModalShell title={editingPfx ? 'แก้ไข Prefix หน่วย' : 'เพิ่ม Prefix หน่วย'} onClose={() => setShowPfxModal(false)}>
          <form onSubmit={handleSavePfx}>
            <div className="space-y-6">
              <FormSection title="ข้อมูล Prefix" description="รวมชื่อ ค่าตัวคูณ และข้อมูลผู้แก้ไขไว้ในบล็อกเดียว">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>ชื่อ Prefix *</FieldLabel>
                    <input className="input" name="unit_prefix_name" required defaultValue={editingPfx?.unit_prefix_name ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ตัวย่อ</FieldLabel>
                    <input className="input" name="unit_prefix_initial" defaultValue={editingPfx?.unit_prefix_initial ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ค่าตัวคูณ</FieldLabel>
                    <input className="input" name="unit_prefix_value" type="number" step="any" defaultValue={editingPfx?.unit_prefix_value ?? ''} />
                  </div>
                  <div>
                    <FieldLabel>ผู้แก้ไขล่าสุด</FieldLabel>
                    <input className="input" name="unit_prefix_updated_uid" type="number" defaultValue={editingPfx?.unit_prefix_updated_uid ?? ''} />
                  </div>
                </div>
              </FormSection>
            </div>
            {savePfxMut.isError && <p className="mt-4 text-sm text-red-600">{savePfxMut.error.message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-surface-200 pt-4 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowPfxModal(false)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={savePfxMut.isPending}>
                {savePfxMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบ"
        message={deleteTarget ? `ลบ "${deleteTarget.name}" ออกจากระบบ?` : ''}
        confirmLabel="ลบ"
        variant="danger"
        errorMessage={deleteMut.isError ? deleteMut.error.message : undefined}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMut.mutate(deleteTarget)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
