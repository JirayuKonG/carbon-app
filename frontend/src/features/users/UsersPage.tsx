import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable, Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { get, del } from '@/lib/api'
import { Users, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'

interface User       { user_id: number; username: string; first_name: string; last_name: string; email: string; role_id: number; department_id: number }
interface Role       { role_id: number; role_name: string; role_name_eng: string }
interface Department { departments_id: number; name: string }

type TabKey = 'users' | 'roles' | 'departments'

export function UsersPage() {
  const qc = useQueryClient()
  const [tab, setTab]               = useState<TabKey>('users')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: users       = [], isLoading: uLoad } = useQuery({ queryKey: ['users'],       queryFn: () => get<User[]>('/users') })
  const { data: roles       = [], isLoading: rLoad } = useQuery({ queryKey: ['roles'],       queryFn: () => get<Role[]>('/users/roles') })
  const { data: departments = [], isLoading: dLoad } = useQuery({ queryKey: ['departments'], queryFn: () => get<Department[]>('/infra/departments') })

  const deleteMut = useMutation({
    mutationFn: () => del(`/users/${deleteTarget?.id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null) },
  })

  const roleMap = Object.fromEntries(roles.map(r => [r.role_id, r.role_name]))
  const deptMap = Object.fromEntries(departments.map(d => [d.departments_id, d.name]))

  const userColumns: Column<User>[] = [
    { key: 'user_id',    header: 'ID', width: '60px' },
    { key: 'username',   header: 'Username' },
    { key: 'first_name', header: 'ชื่อ-สกุล', render: (r) => `${r.first_name} ${r.last_name}` },
    { key: 'email',      header: 'อีเมล' },
    { key: 'role_id',    header: 'บทบาท', render: (r) => <span className="badge-blue">{roleMap[r.role_id] ?? r.role_id}</span> },
    { key: 'department_id', header: 'แผนก', render: (r) => <span className="badge-gray">{deptMap[r.department_id] ?? '—'}</span> },
  ]
  const roleColumns: Column<Role>[] = [
    { key: 'role_id',       header: 'ID', width: '60px' },
    { key: 'role_name',     header: 'ชื่อบทบาท' },
    { key: 'role_name_eng', header: 'Role (EN)' },
  ]
  const deptColumns: Column<Department>[] = [
    { key: 'departments_id', header: 'ID', width: '60px' },
    { key: 'name',           header: 'ชื่อแผนก' },
  ]

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'users',       label: 'ผู้ใช้ทั้งหมด' },
    { key: 'roles',       label: 'บทบาท' },
    { key: 'departments', label: 'แผนก' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Users size={20} className="text-primary-600" /> จัดการผู้ใช้</h1>
          <p className="page-subtitle">บัญชีผู้ใช้ บทบาท และแผนก</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus size={14} /> เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${tab === t.key ? 'bg-white shadow-card text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'users' && (
          <DataTable data={users} columns={userColumns} isLoading={uLoad} rowKey={(r) => r.user_id}
            actions={(row) => (
              <div className="flex items-center gap-1 justify-end">
                <button className="btn-icon btn-ghost btn-sm" onClick={() => { setEditing(row); setShowModal(true) }}><Pencil size={13} /></button>
                <button className="btn-icon btn-ghost btn-sm text-red-400" onClick={() => setDeleteTarget({ id: row.user_id, name: `${row.first_name} ${row.last_name}` })}><Trash2 size={13} /></button>
              </div>
            )}
          />
        )}
        {tab === 'roles' && (
          <DataTable data={roles} columns={roleColumns} isLoading={rLoad} rowKey={(r) => r.role_id}
            actions={() => (
              <div className="flex items-center gap-1 justify-end">
                <button className="btn-icon btn-ghost btn-sm"><ShieldCheck size={13} /></button>
              </div>
            )}
          />
        )}
        {tab === 'departments' && (
          <DataTable data={departments} columns={deptColumns} isLoading={dLoad} rowKey={(r) => r.departments_id} />
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-md animate-slide-up">
            <h3 className="font-semibold mb-5">{editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">ชื่อ *</label><input className="input" defaultValue={editing?.first_name ?? ''} /></div>
              <div><label className="label">นามสกุล *</label><input className="input" defaultValue={editing?.last_name ?? ''} /></div>
              <div className="col-span-2"><label className="label">Username *</label><input className="input" defaultValue={editing?.username ?? ''} /></div>
              <div className="col-span-2"><label className="label">อีเมล</label><input className="input" type="email" defaultValue={editing?.email ?? ''} /></div>
              {!editing && <div className="col-span-2"><label className="label">รหัสผ่าน *</label><input className="input" type="password" /></div>}
              <div>
                <label className="label">บทบาท *</label>
                <select className="select" defaultValue={editing?.role_id ?? ''}>
                  <option value="">— เลือก —</option>
                  {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">แผนก</label>
                <select className="select" defaultValue={editing?.department_id ?? ''}>
                  <option value="">— เลือก —</option>
                  {departments.map(d => <option key={d.departments_id} value={d.departments_id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn-primary flex-1">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ยืนยันการลบผู้ใช้"
        message={`ลบบัญชี "${deleteTarget?.name}" ออกจากระบบ?`}
        confirmLabel="ลบ"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
