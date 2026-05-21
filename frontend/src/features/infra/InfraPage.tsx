import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable, Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { get, del } from '@/lib/api'
import { Factory, Plus, Pencil, Trash2 } from 'lucide-react'

interface FactoryRow    { factory_id: number; name: string; initial: string; note: string }
interface ServiceArea   { service_area_id: number; factory_id: number; code: string; name: string; note: string }
interface Department    { departments_id: number; name: string }

type ModalTarget = 'factory' | 'service_area' | 'department' | null

export function InfraPage() {
  const qc = useQueryClient()
  const [modal, setModal]       = useState<ModalTarget>(null)
  const [editing, setEditing]   = useState<Record<string, unknown> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: ModalTarget; id: number; name: string } | null>(null)

  const { data: factories   = [], isLoading: fLoad } = useQuery({ queryKey: ['factories'],   queryFn: () => get<FactoryRow[]>('/infra/factories') })
  const { data: serviceAreas = [], isLoading: sLoad } = useQuery({ queryKey: ['service-areas'], queryFn: () => get<ServiceArea[]>('/infra/service-areas') })
  const { data: departments  = [], isLoading: dLoad } = useQuery({ queryKey: ['departments'],  queryFn: () => get<Department[]>('/infra/departments') })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['factories'] }); qc.invalidateQueries({ queryKey: ['service-areas'] }); qc.invalidateQueries({ queryKey: ['departments'] }) }

  const deleteMut = useMutation({
    mutationFn: () => del(`/infra/${deleteTarget?.type}s/${deleteTarget?.id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  const factoryColumns: Column<FactoryRow>[] = [
    { key: 'factory_id', header: 'ID', width: '60px' },
    { key: 'initial',    header: 'รหัส', width: '80px' },
    { key: 'name',       header: 'ชื่อโรงงาน' },
    { key: 'note',       header: 'หมายเหตุ', render: (r) => <span className="text-surface-400">{r.note || '—'}</span> },
  ]
  const serviceColumns: Column<ServiceArea>[] = [
    { key: 'service_area_id', header: 'ID', width: '60px' },
    { key: 'code',            header: 'รหัส', width: '80px' },
    { key: 'name',            header: 'ชื่อพื้นที่บริการ' },
    { key: 'factory_id',      header: 'โรงงาน', render: (r) => <span>{factories.find(f => f.factory_id === r.factory_id)?.name ?? r.factory_id}</span> },
  ]
  const deptColumns: Column<Department>[] = [
    { key: 'departments_id', header: 'ID', width: '60px' },
    { key: 'name',           header: 'ชื่อแผนก' },
  ]

  const rowActions = (type: ModalTarget) => (row: FactoryRow | ServiceArea | Department) => {
    const r = row as unknown as Record<string, unknown>
    return (
      <div className="flex items-center gap-1 justify-end">
        <button className="btn-icon btn-ghost btn-sm" onClick={() => { setEditing(r); setModal(type) }}><Pencil size={13} /></button>
        <button className="btn-icon btn-ghost btn-sm text-red-400" onClick={() => setDeleteTarget({ type, id: r[`${type}_id`] as number, name: r.name as string })}><Trash2 size={13} /></button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Factory size={20} className="text-primary-600" /> โรงงาน / พื้นที่บริการ / แผนก</h1>
          <p className="page-subtitle">จัดการโครงสร้างองค์กรและพื้นที่ให้บริการ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Factories */}
        <div className="card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">โรงงาน</h2>
            <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setModal('factory') }}><Plus size={13} />เพิ่ม</button>
          </div>
          <DataTable data={factories} columns={factoryColumns} isLoading={fLoad} rowKey={(r) => r.factory_id} defaultPageSize={10} actions={rowActions('factory')} />
        </div>

        {/* Service Areas */}
        <div className="card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">พื้นที่บริการ</h2>
            <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setModal('service_area') }}><Plus size={13} />เพิ่ม</button>
          </div>
          <DataTable data={serviceAreas} columns={serviceColumns} isLoading={sLoad} rowKey={(r) => r.service_area_id} defaultPageSize={10} actions={rowActions('service_area')} />
        </div>

        {/* Departments */}
        <div className="card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">แผนก</h2>
            <button className="btn-primary btn-sm" onClick={() => { setEditing(null); setModal('department') }}><Plus size={13} />เพิ่ม</button>
          </div>
          <DataTable data={departments} columns={deptColumns} isLoading={dLoad} rowKey={(r) => r.departments_id} defaultPageSize={10} actions={rowActions('department')} />
        </div>
      </div>

      {/* Simple edit modal placeholder */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-md animate-slide-up">
            <h3 className="font-semibold mb-4">{editing ? 'แก้ไข' : 'เพิ่ม'} {modal === 'factory' ? 'โรงงาน' : modal === 'service_area' ? 'พื้นที่บริการ' : 'แผนก'}</h3>
            <div className="space-y-3">
              <div><label className="label">ชื่อ *</label><input className="input" defaultValue={editing?.name as string ?? ''} /></div>
              {modal === 'factory' && <div><label className="label">รหัสย่อ</label><input className="input" defaultValue={editing?.initial as string ?? ''} /></div>}
              {modal === 'service_area' && (
                <div>
                  <label className="label">โรงงาน *</label>
                  <select className="select">
                    {factories.map(f => <option key={f.factory_id} value={f.factory_id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              {(modal === 'factory' || modal === 'service_area') && <div><label className="label">หมายเหตุ</label><textarea className="input" rows={2} defaultValue={editing?.note as string ?? ''} /></div>}
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn-primary flex-1">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ยืนยันการลบ"
        message={`คุณต้องการลบ "${deleteTarget?.name}" ออกจากระบบหรือไม่? ไม่สามารถกู้คืนได้`}
        confirmLabel="ลบออก"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
