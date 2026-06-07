import { type FormEvent, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { get, post, put, del } from '@/lib/api'
import { Tractor, Plus, Pencil, Trash2 } from 'lucide-react'

interface Farmer {
  farmer_id: number
  thai_national_id: string
  thai_farmer_id: string
  first_name: string
  last_name: string
  phone: string
  line_user_id: string
  factory_id: number
  service_area_id: number
  update_at: string
}
interface Factory     { factory_id: number; name: string }
interface ServiceArea { service_area_id: number; name: string }
type FarmerPayload = {
  first_name: string
  last_name: string
  thai_national_id?: string
  thai_farmer_id?: string
  phone?: string
  line_user_id?: string
  factory_id?: number
  service_area_id?: number
}

export function FarmersPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState<Farmer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: farmers     = [], isLoading, error: farmersError } = useQuery({ queryKey: ['farmers'],      queryFn: () => get<Farmer[]>('/farmers') })
  const { data: factories   = [], error: factoriesError } = useQuery({ queryKey: ['factories'],    queryFn: () => get<Factory[]>('/infra/factories') })
  const { data: serviceAreas = [], error: serviceAreasError } = useQuery({ queryKey: ['service-areas'], queryFn: () => get<ServiceArea[]>('/infra/service-areas') })

  const pageQueryItems = [
    { label: 'ข้อมูลเกษตรกร', error: farmersError },
    { label: 'โรงงาน', error: factoriesError },
    { label: 'พื้นที่บริการ', error: serviceAreasError },
  ]

  const factMap = Object.fromEntries(factories.map(f => [f.factory_id, f.name]))
  const saMap   = Object.fromEntries(serviceAreas.map(s => [s.service_area_id, s.name]))

  const deleteMut = useMutation({
    mutationFn: () => del(`/farmers/${deleteTarget?.id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['farmers'] }); setDeleteTarget(null) },
  })

  const saveMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: FarmerPayload }) =>
      id ? put(`/farmers/${id}`, payload) : post('/farmers', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farmers'] })
      setShowModal(false)
      setEditing(null)
    },
  })

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const first_name = String(form.get('first_name') ?? '').trim()
    const last_name = String(form.get('last_name') ?? '').trim()
    const thai_national_id = String(form.get('thai_national_id') ?? '').trim()
    const thai_farmer_id = String(form.get('thai_farmer_id') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const line_user_id = String(form.get('line_user_id') ?? '').trim()
    const factoryId = Number(form.get('factory_id'))
    const serviceAreaId = Number(form.get('service_area_id'))

    if (!first_name || !last_name || !factoryId) return

    saveMut.mutate({
      id: editing?.farmer_id,
      payload: {
        first_name,
        last_name,
        thai_national_id: thai_national_id || undefined,
        thai_farmer_id: thai_farmer_id || undefined,
        phone: phone || undefined,
        line_user_id: line_user_id || undefined,
        factory_id: factoryId,
        service_area_id: serviceAreaId || undefined,
      },
    })
  }

  const columns: Column<Farmer>[] = [
    { key: 'farmer_id',       header: 'ID', width: '60px' },
    { key: 'thai_farmer_id',  header: 'รหัสเกษตรกร' },
    { key: 'first_name',      header: 'ชื่อ-สกุล', render: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'phone',           header: 'โทรศัพท์' },
    { key: 'thai_national_id',header: 'เลขบัตรประชาชน', render: (r) => <span className="font-mono text-xs">{r.thai_national_id}</span> },
    { key: 'factory_id',      header: 'โรงงาน',        render: (r) => <span className="badge-blue">{factMap[r.factory_id] ?? '—'}</span> },
    { key: 'line_user_id', header: 'Line  ID', render: (r) => <span className="badge-gray">{r.line_user_id || '—'}</span> },
    { key: 'service_area_id', header: 'พื้นที่บริการ', render: (r) => <span className="badge-gray">{saMap[r.service_area_id] ?? '—'}</span> },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Tractor size={20} className="text-primary-600" /> จัดการเกษตรกร</h1>
          <p className="page-subtitle">ทะเบียนเกษตรกรในระบบทั้งหมด</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus size={14} /> เพิ่มเกษตรกร
        </button>
      </div>

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      <div className="card">
        <DataTable
          data={farmers} columns={columns} isLoading={isLoading}
          rowKey={(r) => r.farmer_id}
          searchPlaceholder="ค้นหาชื่อ, รหัส, โทรศัพท์..."
          actions={(row) => (
            <div className="flex items-center gap-1 justify-end">
              <button className="btn-icon btn-ghost btn-sm" onClick={() => { setEditing(row); setShowModal(true) }}><Pencil size={13} /></button>
              <button className="btn-icon btn-ghost btn-sm text-red-400" onClick={() => setDeleteTarget({ id: row.farmer_id, name: `${row.first_name} ${row.last_name}` })}><Trash2 size={13} /></button>
            </div>
          )}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-lg animate-slide-up">
            <h3 className="font-semibold mb-5">{editing ? 'แก้ไขข้อมูลเกษตรกร' : 'เพิ่มเกษตรกรใหม่'}</h3>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">ชื่อ *</label><input className="input" name="first_name" required defaultValue={editing?.first_name ?? ''} /></div>
                <div><label className="label">นามสกุล *</label><input className="input" name="last_name" required defaultValue={editing?.last_name ?? ''} /></div>
                <div><label className="label">เลขบัตรประชาชน</label><input className="input font-mono" name="thai_national_id" defaultValue={editing?.thai_national_id ?? ''} maxLength={13} /></div>
                <div><label className="label">รหัสเกษตรกร</label><input className="input" name="thai_farmer_id" defaultValue={editing?.thai_farmer_id ?? ''} /></div>
                <div><label className="label">โทรศัพท์</label><input className="input" name="phone" defaultValue={editing?.phone ?? ''} /></div>
                <div><label className="label">LINE User ID</label><input className="input" name="line_user_id" defaultValue={editing?.line_user_id ?? ''} /></div>
                <div>
                  <label className="label">โรงงาน *</label>
                  <select className="select" name="factory_id" required defaultValue={editing?.factory_id ?? ''}>
                    <option value="">— เลือกโรงงาน —</option>
                    {factories.map(f => <option key={f.factory_id} value={f.factory_id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">พื้นที่บริการ</label>
                  <select className="select" name="service_area_id" defaultValue={editing?.service_area_id ?? ''}>
                    <option value="">— เลือกพื้นที่ —</option>
                    {serviceAreas.map(s => <option key={s.service_area_id} value={s.service_area_id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              {saveMut.isError && <p className="mt-3 text-sm text-red-600">{saveMut.error.message}</p>}
              <div className="flex gap-3 mt-5">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveMut.isPending}>
                  {saveMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ยืนยันการลบเกษตรกร"
        message={`ลบข้อมูลของ "${deleteTarget?.name}"? ข้อมูลแปลงที่เชื่อมอยู่จะได้รับผลกระทบ`}
        confirmLabel="ลบออก"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
