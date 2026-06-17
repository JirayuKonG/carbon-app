import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column, ExpandableTextCell } from '@/components/ui/DataTable'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { useToast } from '@/components/ui/Toast'
import { del, get, post, put } from '@/lib/api'
import { CalendarRange, ChevronDown, ExternalLink, Layers3, Pencil, Plus, Trash2 } from 'lucide-react'

interface ProductYearListItem {
  act_productYear_id: number
  act_productYear_name?: string | null
  act_productYear_info?: string | null
  act_productyear_create_at?: string | null
  act_productYear_update_at?: string | null
  act_productYear_update_uid?: number | null
  detailCount: number
  queueCount: number
  canDelete: boolean
}

type ProductYearPayload = {
  act_productYear_name: string
  act_productYear_info?: string
  act_productYear_update_uid?: number
}

type ProductYearFormState = {
  act_productYear_name: string
  act_productYear_info: string
  act_productYear_update_uid: string
}

type ProductYearStatusFilter = 'all' | 'in_use' | 'can_delete'

const emptyForm: ProductYearFormState = {
  act_productYear_name: '',
  act_productYear_info: '',
  act_productYear_update_uid: '',
}

function textOrDash(value?: string | null) {
  const text = value?.trim()
  return text || '—'
}

function countValue(value?: number | null) {
  return (value ?? 0).toLocaleString('th-TH')
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function summaryTileTone(value: number) {
  return value > 0 ? 'blue' as const : 'green' as const
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
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString('th-TH')}</p>
    </div>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
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

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="label">{children}</label>
}

function buildSearch(pathname: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return
    search.set(key, value)
  })
  const query = search.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function ProductYearsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState<ProductYearListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductYearListItem | null>(null)
  const [blockedDeleteMessage, setBlockedDeleteMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductYearStatusFilter>('all')
  const [form, setForm] = useState<ProductYearFormState>(emptyForm)

  const { data: productYears = [], isLoading, error } = useQuery({
    queryKey: ['activity-product-years-master'],
    queryFn: () => get<ProductYearListItem[]>('/activities/product-years'),
  })

  const pageQueryItems = [
    { label: 'ปีการผลิต', error },
  ]

  const invalidateQueries = () => {
    void qc.invalidateQueries({ queryKey: ['activity-product-years-master'] })
    void qc.invalidateQueries({ queryKey: ['activity-product-years'] })
    void qc.invalidateQueries({ queryKey: ['activity-product-years-calculate'] })
    void qc.invalidateQueries({ queryKey: ['calculation-summary'] })
    void qc.invalidateQueries({ queryKey: ['carbon-credit-workspace'] })
  }

  const saveMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ProductYearPayload }) => (
      id
        ? put<ProductYearListItem>(`/activities/product-years/${id}`, payload)
        : post<ProductYearListItem>('/activities/product-years', payload)
    ),
    onSuccess: (_, vars) => {
      invalidateQueries()
      setShowModal(false)
      setEditingRow(null)
      setForm(emptyForm)
      toast.success(
        vars.id ? 'อัปเดตปีการผลิตแล้ว' : 'เพิ่มปีการผลิตแล้ว',
        vars.payload.act_productYear_name,
      )
    },
    onError: (err) => toast.error('บันทึกปีการผลิตไม่สำเร็จ', err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => del(`/activities/product-years/${id}`),
    onSuccess: (_, id) => {
      invalidateQueries()
      setDeleteTarget(null)
      toast.success('ลบปีการผลิตแล้ว', `ลบรายการ #${id.toLocaleString('th-TH')}`)
    },
    onError: (err) => toast.error('ลบปีการผลิตไม่สำเร็จ', err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'),
  })

  const visibleRows = useMemo(() => {
    if (statusFilter === 'in_use') return productYears.filter((row) => row.detailCount > 0)
    if (statusFilter === 'can_delete') return productYears.filter((row) => row.canDelete)
    return productYears
  }, [productYears, statusFilter])

  const totalDetailCount = useMemo(
    () => productYears.reduce((sum, row) => sum + (row.detailCount ?? 0), 0),
    [productYears],
  )

  const inUseCount = useMemo(
    () => productYears.filter((row) => row.detailCount > 0).length,
    [productYears],
  )

  const canDeleteCount = useMemo(
    () => productYears.filter((row) => row.canDelete).length,
    [productYears],
  )

  const openModal = (row?: ProductYearListItem) => {
    setEditingRow(row ?? null)
    setForm(row ? {
      act_productYear_name: row.act_productYear_name ?? '',
      act_productYear_info: row.act_productYear_info ?? '',
      act_productYear_update_uid: row.act_productYear_update_uid != null ? String(row.act_productYear_update_uid) : '',
    } : emptyForm)
    setShowModal(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = form.act_productYear_name.trim()
    if (!name) return

    saveMut.mutate({
      id: editingRow?.act_productYear_id,
      payload: {
        act_productYear_name: name,
        act_productYear_info: form.act_productYear_info.trim() || undefined,
        act_productYear_update_uid: toOptionalNumber(form.act_productYear_update_uid),
      },
    })
  }

  const requestDelete = (row: ProductYearListItem) => {
    if (!row.canDelete) {
      setBlockedDeleteMessage(`ลบปีการผลิตนี้ไม่ได้ เพราะยังถูกใช้อยู่ในข้อมูลกิจกรรม ${countValue(row.detailCount)} รายการ`)
      return
    }
    setDeleteTarget(row)
  }

  const openTargets = (row: ProductYearListItem) => {
    const productYearId = String(row.act_productYear_id)
    const yearLabel = row.act_productYear_name?.trim() || undefined

    return [
      { label: 'ดูในหน้าจัดการกิจกรรม', path: buildSearch('/activities/manage', { productYearId }), disabled: false },
      { label: 'ดูในรายการบันทึกกิจกรรม', path: buildSearch('/activities/logs', { productYearId }), disabled: false },
      { label: 'ดูในเตรียมข้อมูล Carbon', path: buildSearch('/calculate/prepare', { productYearId }), disabled: false },
      { label: 'ดูใน Carbon Footprint', path: buildSearch('/calculate/footprint', { productYearId }), disabled: false },
      { label: 'ดูในหน้าแปลงที่ดิน', path: buildSearch('/lands', { activityProductYearId: productYearId }), disabled: false },
      { label: 'ดูในสรุปการใช้ปัจจัย', path: buildSearch('/calculate/usage', { years: yearLabel }), disabled: !yearLabel },
      { label: 'ดูในสรุปผลการคำนวณ', path: buildSearch('/calculate/summary', { mode: 'footprint', years: yearLabel }), disabled: !yearLabel },
      { label: 'ใช้เป็นปีโครงการใน Carbon Credit', path: buildSearch('/calculate/credit', { projectYear: yearLabel }), disabled: !yearLabel },
    ]
  }

  const columns: Column<ProductYearListItem>[] = [
    {
      key: 'act_productYear_id',
      header: 'รหัสปีการผลิต',
      sortable: true,
      render: (row) => <span className="font-mono font-semibold text-surface-800">{row.act_productYear_id.toLocaleString('th-TH')}</span>,
    },
    {
      key: 'act_productYear_name',
      header: 'ชื่อปีการผลิต',
      sortable: true,
      width: '180px',
      minWidth: '160px',
      resizable: true,
      render: (row) => <span className="font-medium text-surface-900">{textOrDash(row.act_productYear_name)}</span>,
    },
    {
      key: 'act_productYear_info',
      header: 'รายละเอียด',
      sortable: true,
      width: '280px',
      minWidth: '220px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.act_productYear_info} title="รายละเอียดปีการผลิต" previewChars={86} />,
    },
    {
      key: 'detailCount',
      header: 'รายการกิจกรรม',
      sortable: true,
      render: (row) => <span className="font-mono font-semibold text-surface-800">{countValue(row.detailCount)}</span>,
    },
    {
      key: 'queueCount',
      header: 'Carbon queue',
      sortable: true,
      render: (row) => <span className="font-mono text-surface-700">{countValue(row.queueCount)}</span>,
    },
    {
      key: 'act_productYear_update_at',
      header: 'อัปเดตล่าสุด',
      sortable: true,
      width: '170px',
      minWidth: '170px',
      render: (row) => <span className="text-sm text-surface-600">{formatDateTime(row.act_productYear_update_at)}</span>,
    },
    {
      key: 'canDelete',
      header: 'สถานะลบ',
      sortable: true,
      render: (row) => row.canDelete
        ? <span className="badge-green">ลบได้</span>
        : <span className="badge-gray">กำลังใช้งาน</span>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarRange size={20} className="text-primary-600" /> ปีการผลิต
          </h1>
          <p className="page-subtitle">จัดการ master ปีการผลิตของกิจกรรม และกดเปิดไปหน้าที่กรองตามปีการผลิตได้ทันที</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          <Plus size={14} /> เพิ่มปีการผลิต
        </button>
      </div>

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="ปีการผลิตทั้งหมด" value={productYears.length} tone="blue" />
        <SummaryTile label="ปีที่ถูกใช้งานแล้ว" value={inUseCount} tone={summaryTileTone(inUseCount)} />
        <SummaryTile label="ปีที่ยังลบได้" value={canDeleteCount} tone={canDeleteCount > 0 ? 'green' : 'amber'} />
        <SummaryTile label="รายการกิจกรรมที่อ้างอิง" value={totalDetailCount} tone={totalDetailCount > 0 ? 'amber' : 'green'} />
      </div>

      <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 border-b border-surface-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-surface-900">
              <Layers3 size={17} className="text-primary-600" /> รายการปีการผลิต
            </h2>
            <p className="text-sm text-surface-500">ดูจำนวนการใช้งานในกิจกรรมและคิว Carbon ก่อนแก้ไขหรือลบ</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${statusFilter === 'all' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-surface-200 bg-white text-surface-600 hover:border-primary-200'}`}
              onClick={() => setStatusFilter('all')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${statusFilter === 'in_use' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-surface-200 bg-white text-surface-600 hover:border-amber-200'}`}
              onClick={() => setStatusFilter('in_use')}
            >
              กำลังใช้งาน
            </button>
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${statusFilter === 'can_delete' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-surface-200 bg-white text-surface-600 hover:border-emerald-200'}`}
              onClick={() => setStatusFilter('can_delete')}
            >
              ลบได้
            </button>
          </div>
        </div>

        <DataTable
          data={visibleRows}
          columns={columns}
          isLoading={isLoading}
          rowKey={(row) => row.act_productYear_id}
          defaultPageSize={10}
          searchPlaceholder="ค้นหาปีการผลิต..."
          actions={(row) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                className="btn-icon btn-ghost btn-sm"
                onClick={() => openModal(row)}
                title="แก้ไขปีการผลิต"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
                onClick={() => requestDelete(row)}
                title="ลบปีการผลิต"
              >
                <Trash2 size={14} />
              </button>
              <details className="relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-medium text-surface-700 transition hover:border-primary-200 hover:text-primary-700">
                  <ExternalLink size={13} />
                  เปิดในหน้าอื่น
                  <ChevronDown size={12} />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-surface-200 bg-white p-2 shadow-xl">
                  <div className="mb-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
                    ใช้ปีการผลิตนี้กรองหน้าปลายทาง
                  </div>
                  <div className="space-y-1">
                    {openTargets(row).map((target) => (
                      <button
                        key={target.label}
                        type="button"
                        disabled={target.disabled}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${target.disabled ? 'cursor-not-allowed bg-surface-50 text-surface-400' : 'text-surface-700 hover:bg-primary-50 hover:text-primary-700'}`}
                        onClick={() => navigate(target.path)}
                      >
                        <span className="pr-3">{target.label}</span>
                        <ExternalLink size={13} className="shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          )}
          emptyMessage="ยังไม่มีปีการผลิต"
        />
      </section>

      {showModal && (
        <ModalShell title={editingRow ? 'แก้ไขปีการผลิต' : 'เพิ่มปีการผลิต'} onClose={() => setShowModal(false)}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <FieldLabel>ชื่อปีการผลิต</FieldLabel>
              <input
                className="input"
                required
                value={form.act_productYear_name}
                onChange={(event) => setForm((prev) => ({ ...prev, act_productYear_name: event.target.value }))}
                placeholder="เช่น 67/68"
              />
            </div>

            <div>
              <FieldLabel>รายละเอียด</FieldLabel>
              <textarea
                className="textarea min-h-[110px]"
                value={form.act_productYear_info}
                onChange={(event) => setForm((prev) => ({ ...prev, act_productYear_info: event.target.value }))}
                placeholder="บันทึกหมายเหตุเพิ่มเติมของปีการผลิต"
              />
            </div>

            <div>
              <FieldLabel>ผู้แก้ไข (UID)</FieldLabel>
              <input
                className="input"
                value={form.act_productYear_update_uid}
                onChange={(event) => setForm((prev) => ({ ...prev, act_productYear_update_uid: event.target.value }))}
                placeholder="ไม่กรอกก็ได้"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-surface-200 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                ยกเลิก
              </button>
              <button type="submit" className="btn-primary" disabled={saveMut.isPending}>
                <Plus size={14} /> {saveMut.isPending ? 'กำลังบันทึก...' : editingRow ? 'บันทึกการแก้ไข' : 'เพิ่มปีการผลิต'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ลบปีการผลิต"
        message={deleteTarget ? `ต้องการลบปีการผลิต "${textOrDash(deleteTarget.act_productYear_name)}" ใช่หรือไม่` : ''}
        confirmLabel={deleteMut.isPending ? 'กำลังลบ...' : 'ลบรายการ'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteMut.mutate(deleteTarget.act_productYear_id)
        }}
        isLoading={deleteMut.isPending}
      />

      <ConfirmDialog
        open={Boolean(blockedDeleteMessage)}
        title="ยังลบไม่ได้"
        message={blockedDeleteMessage}
        confirmLabel="รับทราบ"
        cancelLabel="ปิด"
        variant="info"
        onCancel={() => setBlockedDeleteMessage('')}
        onConfirm={() => setBlockedDeleteMessage('')}
      />
    </div>
  )
}
