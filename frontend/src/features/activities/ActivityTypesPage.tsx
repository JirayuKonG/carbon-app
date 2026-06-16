import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { Column, DataTable, ExpandableTextCell } from '@/components/ui/DataTable'
import { del, get, post, put } from '@/lib/api'
import { GitBranch, Layers3, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'

interface HeaderType {
  act_header_type_id: number
  act_header_type_idCode?: string | null
  act_header_type_name_th?: string | null
  act_header_type_name_en?: string | null
  act_header_type_create_at?: string | null
  act_header_type_update_uid?: number | null
  detailTypeCount?: number
  activityHeaderCount?: number
  logDetailCount?: number
}

interface DetailType {
  act_header_detail_type_id: number
  act_header_type_id?: number | null
  act_header_detail_type_name_th?: string | null
  activities_header_type?: {
    act_header_type_id: number
    act_header_type_name_th?: string | null
    act_header_type_name_en?: string | null
  } | null
  logDetailCount?: number
}

type HeaderTypePayload = {
  act_header_type_idCode?: string
  act_header_type_name_th: string
  act_header_type_name_en?: string
  act_header_type_update_uid?: number
}

type DetailTypePayload = {
  act_header_detail_type_name_th: string
  act_header_type_id?: number | null
}

type DeleteTarget =
  | { type: 'header'; id: number; name: string }
  | { type: 'detail'; id: number; name: string }

type HeaderFormState = {
  act_header_type_idCode: string
  act_header_type_name_th: string
  act_header_type_name_en: string
  act_header_type_update_uid: string
}

type DetailFormState = {
  act_header_detail_type_name_th: string
  act_header_type_id: string
}

const emptyHeaderForm: HeaderFormState = {
  act_header_type_idCode: '',
  act_header_type_name_th: '',
  act_header_type_name_en: '',
  act_header_type_update_uid: '',
}

const emptyDetailForm: DetailFormState = {
  act_header_detail_type_name_th: '',
  act_header_type_id: '',
}

function textOrDash(value?: string | null) {
  const text = value?.trim()
  return text || '—'
}

function countValue(value?: number | null) {
  return (value ?? 0).toLocaleString('en-US')
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function headerTypeLabel(item?: HeaderType | DetailType['activities_header_type'] | null) {
  if (!item) return 'ยังไม่ผูกกิจกรรมหลัก'
  return item.act_header_type_name_th?.trim()
    || item.act_header_type_name_en?.trim()
    || `กิจกรรมหลัก #${item.act_header_type_id}`
}

function detailTypeLabel(item: DetailType) {
  return item.act_header_detail_type_name_th?.trim() || `กิจกรรมย่อย #${item.act_header_detail_type_id}`
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-5 shadow-card-lg animate-slide-up sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-surface-200 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-600">Activity Master</p>
            <h3 className="mt-1 text-lg font-semibold text-surface-900">{title}</h3>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="label">{children}</label>
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'blue' | 'green' | 'amber' | 'red'
}) {
  const toneClasses = {
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString('en-US')}</p>
    </div>
  )
}

export function ActivityTypesPage() {
  const qc = useQueryClient()
  const [showHeaderModal, setShowHeaderModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingHeader, setEditingHeader] = useState<HeaderType | null>(null)
  const [editingDetail, setEditingDetail] = useState<DetailType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [blockedDeleteMessage, setBlockedDeleteMessage] = useState('')
  const [detailParentFilter, setDetailParentFilter] = useState('all')
  const [parentSearch, setParentSearch] = useState('')
  const [headerForm, setHeaderForm] = useState<HeaderFormState>(emptyHeaderForm)
  const [detailForm, setDetailForm] = useState<DetailFormState>(emptyDetailForm)

  const { data: headerTypes = [], isLoading: headerTypesLoading, error: headerTypesError } = useQuery({
    queryKey: ['header-types'],
    queryFn: () => get<HeaderType[]>('/activities/header-types'),
  })

  const { data: detailTypes = [], isLoading: detailTypesLoading, error: detailTypesError } = useQuery({
    queryKey: ['detail-types-all'],
    queryFn: () => get<DetailType[]>('/activities/detail-types'),
  })

  const pageQueryItems = [
    { label: 'กิจกรรมหลัก', error: headerTypesError },
    { label: 'กิจกรรมย่อย', error: detailTypesError },
  ]

  const invalidateActivityTypeQueries = () => {
    void qc.invalidateQueries({ queryKey: ['header-types'] })
    void qc.invalidateQueries({ queryKey: ['detail-types-all'] })
    void qc.invalidateQueries({ queryKey: ['detail-types'] })
    void qc.invalidateQueries({ queryKey: ['header-types-calculate'] })
    void qc.invalidateQueries({ queryKey: ['detail-types-calculate'] })
    void qc.invalidateQueries({ queryKey: ['header-types-carbon-footprint'] })
    void qc.invalidateQueries({ queryKey: ['detail-types-carbon-footprint'] })
  }

  const saveHeaderMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: HeaderTypePayload }) =>
      id
        ? put<HeaderType>(`/activities/header-types/${id}`, payload)
        : post<HeaderType>('/activities/header-types', payload),
    onSuccess: () => {
      invalidateActivityTypeQueries()
      setShowHeaderModal(false)
      setEditingHeader(null)
      setHeaderForm(emptyHeaderForm)
    },
  })

  const saveDetailMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: DetailTypePayload }) =>
      id
        ? put<DetailType>(`/activities/detail-types/${id}`, payload)
        : post<DetailType>('/activities/detail-types', payload),
    onSuccess: () => {
      invalidateActivityTypeQueries()
      setShowDetailModal(false)
      setEditingDetail(null)
      setDetailForm(emptyDetailForm)
      setParentSearch('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (target: DeleteTarget) => (
      target.type === 'header'
        ? del(`/activities/header-types/${target.id}`)
        : del(`/activities/detail-types/${target.id}`)
    ),
    onSuccess: () => {
      invalidateActivityTypeQueries()
      setDeleteTarget(null)
    },
  })

  const headerMap = useMemo(
    () => Object.fromEntries(headerTypes.map((item) => [item.act_header_type_id, item])),
    [headerTypes],
  )

  const unassignedDetailCount = useMemo(
    () => detailTypes.filter((item) => item.act_header_type_id == null).length,
    [detailTypes],
  )

  const activeLogCount = useMemo(
    () => detailTypes.reduce((sum, item) => sum + (item.logDetailCount ?? 0), 0),
    [detailTypes],
  )

  const visibleDetailTypes = useMemo(() => {
    if (detailParentFilter === 'all') return detailTypes
    if (detailParentFilter === 'unassigned') return detailTypes.filter((item) => item.act_header_type_id == null)
    return detailTypes.filter((item) => item.act_header_type_id === Number(detailParentFilter))
  }, [detailParentFilter, detailTypes])

  const filteredParentOptions = useMemo(() => {
    const keyword = parentSearch.trim().toLowerCase()
    if (!keyword) return headerTypes
    return headerTypes.filter((item) => (
      headerTypeLabel(item).toLowerCase().includes(keyword)
      || item.act_header_type_idCode?.toLowerCase().includes(keyword)
      || String(item.act_header_type_id).includes(keyword)
    ))
  }, [headerTypes, parentSearch])

  const openHeaderModal = (row?: HeaderType) => {
    setEditingHeader(row ?? null)
    setHeaderForm(row ? {
      act_header_type_idCode: row.act_header_type_idCode ?? '',
      act_header_type_name_th: row.act_header_type_name_th ?? '',
      act_header_type_name_en: row.act_header_type_name_en ?? '',
      act_header_type_update_uid: row.act_header_type_update_uid != null ? String(row.act_header_type_update_uid) : '',
    } : emptyHeaderForm)
    setShowHeaderModal(true)
  }

  const openDetailModal = (row?: DetailType) => {
    setEditingDetail(row ?? null)
    setDetailForm(row ? {
      act_header_detail_type_name_th: row.act_header_detail_type_name_th ?? '',
      act_header_type_id: row.act_header_type_id != null ? String(row.act_header_type_id) : '',
    } : emptyDetailForm)
    setParentSearch('')
    setShowDetailModal(true)
  }

  const handleSaveHeader = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = headerForm.act_header_type_name_th.trim()
    if (!name) return

    saveHeaderMut.mutate({
      id: editingHeader?.act_header_type_id,
      payload: {
        act_header_type_idCode: headerForm.act_header_type_idCode.trim() || undefined,
        act_header_type_name_th: name,
        act_header_type_name_en: headerForm.act_header_type_name_en.trim() || undefined,
        act_header_type_update_uid: toOptionalNumber(headerForm.act_header_type_update_uid),
      },
    })
  }

  const handleSaveDetail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = detailForm.act_header_detail_type_name_th.trim()
    if (!name) return

    saveDetailMut.mutate({
      id: editingDetail?.act_header_detail_type_id,
      payload: {
        act_header_detail_type_name_th: name,
        act_header_type_id: detailForm.act_header_type_id ? Number(detailForm.act_header_type_id) : null,
      },
    })
  }

  const requestDeleteHeader = (row: HeaderType) => {
    const detailCount = row.detailTypeCount ?? 0
    const headerCount = row.activityHeaderCount ?? 0
    const logCount = row.logDetailCount ?? 0
    if (detailCount > 0 || headerCount > 0 || logCount > 0) {
      setBlockedDeleteMessage(
        `ลบกิจกรรมหลักนี้ไม่ได้ เพราะยังถูกใช้อยู่: header ${countValue(headerCount)} รายการ, กิจกรรมย่อย ${countValue(detailCount)} รายการ, log ${countValue(logCount)} รายการ`,
      )
      return
    }

    setDeleteTarget({ type: 'header', id: row.act_header_type_id, name: headerTypeLabel(row) })
  }

  const requestDeleteDetail = (row: DetailType) => {
    const logCount = row.logDetailCount ?? 0
    if (logCount > 0) {
      setBlockedDeleteMessage(`ลบกิจกรรมย่อยนี้ไม่ได้ เพราะยังถูกใช้ใน log ${countValue(logCount)} รายการ`)
      return
    }

    setDeleteTarget({ type: 'detail', id: row.act_header_detail_type_id, name: detailTypeLabel(row) })
  }

  const headerColumns: Column<HeaderType>[] = [
    { key: 'act_header_type_idCode', header: 'รหัส', sortable: true, render: (row) => textOrDash(row.act_header_type_idCode) },
    {
      key: 'act_header_type_name_th',
      header: 'กิจกรรมหลัก',
      sortable: true,
      width: '260px',
      minWidth: '200px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.act_header_type_name_th} title="ชื่อกิจกรรมหลัก" previewChars={72} />,
    },
    {
      key: 'act_header_type_name_en',
      header: 'Name (EN)',
      sortable: true,
      width: '220px',
      minWidth: '180px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.act_header_type_name_en} title="ชื่อกิจกรรมหลักภาษาอังกฤษ" previewChars={72} />,
    },
    { key: 'detailTypeCount', header: 'กิจกรรมย่อย', sortable: true, render: (row) => <span className="font-mono font-semibold text-surface-800">{countValue(row.detailTypeCount)}</span> },
    { key: 'activityHeaderCount', header: 'Header ที่ใช้', sortable: true, render: (row) => <span className="font-mono text-surface-700">{countValue(row.activityHeaderCount)}</span> },
    { key: 'logDetailCount', header: 'Log ที่ใช้', sortable: true, render: (row) => <span className="font-mono text-surface-700">{countValue(row.logDetailCount)}</span> },
    {
      key: 'deleteStatus',
      header: 'สถานะลบ',
      render: (row) => {
        const blocked = (row.detailTypeCount ?? 0) > 0 || (row.activityHeaderCount ?? 0) > 0 || (row.logDetailCount ?? 0) > 0
        return blocked
          ? <span className="badge-gray">กำลังใช้งาน</span>
          : <span className="badge-green">ลบได้</span>
      },
    },
  ]

  const detailColumns: Column<DetailType>[] = [
    {
      key: 'act_header_detail_type_name_th',
      header: 'กิจกรรมย่อย',
      sortable: true,
      width: '300px',
      minWidth: '220px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.act_header_detail_type_name_th} title="ชื่อกิจกรรมย่อย" previewChars={82} />,
    },
    {
      key: 'act_header_type_id',
      header: 'กิจกรรมหลัก',
      sortable: true,
      sortValue: (row) => headerTypeLabel(row.activities_header_type ?? headerMap[row.act_header_type_id ?? 0]),
      width: '260px',
      minWidth: '200px',
      resizable: true,
      render: (row) => {
        const parent = row.activities_header_type ?? headerMap[row.act_header_type_id ?? 0]
        return row.act_header_type_id == null
          ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">ยังไม่มี parent</span>
          : <span className="font-medium text-surface-800">{headerTypeLabel(parent)}</span>
      },
    },
    { key: 'logDetailCount', header: 'Log ที่ใช้', sortable: true, render: (row) => <span className="font-mono font-semibold text-surface-800">{countValue(row.logDetailCount)}</span> },
    {
      key: 'deleteStatus',
      header: 'สถานะลบ',
      render: (row) => (row.logDetailCount ?? 0) > 0
        ? <span className="badge-gray">กำลังใช้งาน</span>
        : <span className="badge-green">ลบได้</span>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <GitBranch size={20} className="text-primary-600" /> กิจกรรมหลัก / กิจกรรมย่อย
          </h1>
          <p className="page-subtitle">จัดการ master data ของกิจกรรม และกำหนดว่ากิจกรรมย่อยอยู่ใต้กิจกรรมหลักใด</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => openDetailModal()}>
            <Plus size={14} /> เพิ่มกิจกรรมย่อย
          </button>
          <button className="btn-primary" onClick={() => openHeaderModal()}>
            <Plus size={14} /> เพิ่มกิจกรรมหลัก
          </button>
        </div>
      </div>

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="กิจกรรมหลัก" value={headerTypes.length} tone="blue" />
        <SummaryTile label="กิจกรรมย่อย" value={detailTypes.length} tone="green" />
        <SummaryTile label="ยังไม่มี parent" value={unassignedDetailCount} tone={unassignedDetailCount > 0 ? 'amber' : 'green'} />
        <SummaryTile label="Log ที่ผูกกิจกรรมย่อย" value={activeLogCount} tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 border-b border-surface-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-surface-900">
                <Layers3 size={17} className="text-primary-600" /> กิจกรรมหลัก
              </h2>
              <p className="text-sm text-surface-500">ใช้เป็น parent ของกิจกรรมย่อยและ header กิจกรรม</p>
            </div>
            <button className="btn-primary btn-sm" onClick={() => openHeaderModal()}>
              <Plus size={13} /> เพิ่ม
            </button>
          </div>
          <DataTable
            data={headerTypes}
            columns={headerColumns}
            isLoading={headerTypesLoading}
            rowKey={(row) => row.act_header_type_id}
            defaultPageSize={10}
            searchPlaceholder="ค้นหากิจกรรมหลัก..."
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button className="btn-icon btn-ghost btn-sm" onClick={() => openHeaderModal(row)} title="แก้ไขกิจกรรมหลัก">
                  <Pencil size={13} />
                </button>
                <button className="btn-icon btn-ghost btn-sm text-red-500" onClick={() => requestDeleteHeader(row)} title="ลบกิจกรรมหลัก">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          />
        </section>

        <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 border-b border-surface-200 pb-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-surface-900">
                <GitBranch size={17} className="text-primary-600" /> กิจกรรมย่อย
              </h2>
              <p className="text-sm text-surface-500">แก้ parent เพื่อกำหนดว่ากิจกรรมย่อยนี้อยู่ในกิจกรรมหลักไหน</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="select-sm rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                value={detailParentFilter}
                onChange={(event) => setDetailParentFilter(event.target.value)}
              >
                <option value="all">กิจกรรมย่อยทั้งหมด</option>
                <option value="unassigned">ยังไม่มี parent</option>
                {headerTypes.map((item) => (
                  <option key={item.act_header_type_id} value={item.act_header_type_id}>
                    {headerTypeLabel(item)}
                  </option>
                ))}
              </select>
              <button className="btn-primary btn-sm" onClick={() => openDetailModal()}>
                <Plus size={13} /> เพิ่ม
              </button>
            </div>
          </div>
          <DataTable
            data={visibleDetailTypes}
            columns={detailColumns}
            isLoading={detailTypesLoading}
            rowKey={(row) => row.act_header_detail_type_id}
            defaultPageSize={10}
            searchPlaceholder="ค้นหากิจกรรมย่อยหรือกิจกรรมหลัก..."
            emptyMessage={detailParentFilter === 'unassigned' ? 'ไม่มีกิจกรรมย่อยที่ยังไม่ผูก parent' : 'ไม่พบข้อมูล'}
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button className="btn-icon btn-ghost btn-sm" onClick={() => openDetailModal(row)} title="แก้ไขกิจกรรมย่อย">
                  <Pencil size={13} />
                </button>
                <button className="btn-icon btn-ghost btn-sm text-red-500" onClick={() => requestDeleteDetail(row)} title="ลบกิจกรรมย่อย">
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          />
        </section>
      </div>

      {showHeaderModal && (
        <ModalShell
          title={editingHeader ? 'แก้ไขกิจกรรมหลัก' : 'เพิ่มกิจกรรมหลัก'}
          onClose={() => {
            setShowHeaderModal(false)
            setEditingHeader(null)
            setHeaderForm(emptyHeaderForm)
          }}
        >
          <form onSubmit={handleSaveHeader}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>รหัสกิจกรรม</FieldLabel>
                <input
                  className="input"
                  value={headerForm.act_header_type_idCode}
                  onChange={(event) => setHeaderForm((prev) => ({ ...prev, act_header_type_idCode: event.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>ผู้แก้ไขล่าสุด</FieldLabel>
                <input
                  className="input"
                  type="number"
                  value={headerForm.act_header_type_update_uid}
                  onChange={(event) => setHeaderForm((prev) => ({ ...prev, act_header_type_update_uid: event.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>ชื่อกิจกรรมหลัก (ไทย) *</FieldLabel>
                <input
                  className="input"
                  required
                  value={headerForm.act_header_type_name_th}
                  onChange={(event) => setHeaderForm((prev) => ({ ...prev, act_header_type_name_th: event.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>ชื่อกิจกรรมหลัก (EN)</FieldLabel>
                <input
                  className="input"
                  value={headerForm.act_header_type_name_en}
                  onChange={(event) => setHeaderForm((prev) => ({ ...prev, act_header_type_name_en: event.target.value }))}
                />
              </div>
            </div>
            {saveHeaderMut.isError && <p className="mt-4 text-sm text-red-600">{saveHeaderMut.error.message}</p>}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowHeaderModal(false)} disabled={saveHeaderMut.isPending}>
                ยกเลิก
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={saveHeaderMut.isPending}>
                {saveHeaderMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showDetailModal && (
        <ModalShell
          title={editingDetail ? 'แก้ไขกิจกรรมย่อย' : 'เพิ่มกิจกรรมย่อย'}
          onClose={() => {
            setShowDetailModal(false)
            setEditingDetail(null)
            setDetailForm(emptyDetailForm)
            setParentSearch('')
          }}
        >
          <form onSubmit={handleSaveDetail}>
            <div className="space-y-4">
              <div>
                <FieldLabel>ชื่อกิจกรรมย่อย *</FieldLabel>
                <input
                  className="input"
                  required
                  value={detailForm.act_header_detail_type_name_th}
                  onChange={(event) => setDetailForm((prev) => ({ ...prev, act_header_detail_type_name_th: event.target.value }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div>
                  <FieldLabel>ค้นหากิจกรรมหลัก</FieldLabel>
                  <input
                    className="input"
                    value={parentSearch}
                    onChange={(event) => setParentSearch(event.target.value)}
                    placeholder="พิมพ์ชื่อหรือรหัสกิจกรรมหลัก"
                  />
                </div>
                <div>
                  <FieldLabel>กิจกรรมหลัก</FieldLabel>
                  <select
                    className="select"
                    value={detailForm.act_header_type_id}
                    onChange={(event) => setDetailForm((prev) => ({ ...prev, act_header_type_id: event.target.value }))}
                  >
                    <option value="">ยังไม่ผูกกิจกรรมหลัก</option>
                    {filteredParentOptions.map((item) => (
                      <option key={item.act_header_type_id} value={item.act_header_type_id}>
                        {headerTypeLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {detailForm.act_header_type_id && (
                <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-600">
                  Parent ปัจจุบัน: <strong className="text-surface-900">{headerTypeLabel(headerMap[Number(detailForm.act_header_type_id)])}</strong>
                </div>
              )}
            </div>
            {saveDetailMut.isError && <p className="mt-4 text-sm text-red-600">{saveDetailMut.error.message}</p>}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowDetailModal(false)} disabled={saveDetailMut.isPending}>
                ยกเลิก
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={saveDetailMut.isPending}>
                {saveDetailMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {blockedDeleteMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBlockedDeleteMessage('')} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-card-lg animate-slide-up">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <ShieldAlert size={22} />
            </div>
            <h3 className="mb-2 text-base font-semibold text-surface-900">ยังลบไม่ได้</h3>
            <p className="mb-5 text-sm leading-6 text-surface-600">{blockedDeleteMessage}</p>
            <button className="btn-primary w-full" onClick={() => setBlockedDeleteMessage('')}>รับทราบ</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบ"
        message={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" หรือไม่` : ''}
        errorMessage={deleteMut.isError ? deleteMut.error.message : undefined}
        confirmLabel="ลบ"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget)
        }}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
