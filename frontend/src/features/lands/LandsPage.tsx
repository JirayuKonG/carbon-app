import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DataTable, Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { del, get, post, put } from '@/lib/api'
import { LandLocationPicker } from '@/features/lands/LandLocationPicker'
import { Layers, Plus, Map, Tent, Pencil, Trash2, ActivitySquare } from 'lucide-react'
import type { LatLngTuple } from 'leaflet'

interface Land {
  land_id: number
  farmer_id?: number
  subdistrict_code?: number
  land_camp_id?: number
  land_code?: string
  name?: string
  quota_code?: string
  area_size?: number
  land_size?: number
  land_unit_prefix_id?: number
  land_unit_id?: number
  land_planSize?: number
  village?: string
  zip_code?: string
  latitude?: number
  longitude?: number
  subdistricts?: { name_th?: string; zip_code?: string }
}

interface LandCamp {
  land_camp_id: number
  land_camp_idCode?: string
  land_camp_name?: string
  land_camp_latitude?: number
  land_camp_longitude?: number
  land_camp_info?: string
}

interface Landmap {
  landmap_id: number
  landmap_idCode?: string
  landmap_area_size?: number
  landmap_unit_prefix_id?: number
  landmap_unit_id?: number
  landmap_latitude?: number
  landmap_longitude?: number
  landmap_info?: string
}

interface Unit { unit_id: number; unit_name?: string; unit_initial?: string }
interface UnitPrefix { unit_prefix_id: number; unit_prefix_name?: string; unit_prefix_initial?: string; unit_prefix_value?: number }
interface Farmer { farmer_id: number; first_name?: string; last_name?: string }
interface Province { provinces_id: number; name_th?: string }
interface District { districts_id: number; province_code?: number; name_th?: string }
interface Subdistrict {
  subdistricts_id: number
  district_code?: number
  name_th?: string
  zip_code?: string
  latitude?: number | string | null
  longitude?: number | string | null
}
interface ActivityHeaderType { act_header_type_id: number; act_header_type_name_th?: string }
interface ActivityDetailType { act_header_detail_type_id: number; act_header_detail_type_name_th?: string }
interface LogActivityDetail {
  log_act_detail_id: number
  act_header_type_id?: number
  act_header_detail_type_id?: number
  activities_header?: {
    land_id?: number
  }
}

type TabKey = 'lands' | 'camps' | 'landmaps'
type ModalState =
  | { type: 'lands'; row?: Land }
  | { type: 'camps'; row?: LandCamp }
  | { type: 'landmaps'; row?: Landmap }
  | null
type DeleteState =
  | { type: 'lands'; id: number; name: string }
  | { type: 'camps'; id: number; name: string }
  | { type: 'landmaps'; id: number; name: string }
  | null

const toNumber = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim()
  return text === '' ? undefined : Number(text)
}

const toStringValue = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim()
  return text === '' ? undefined : text
}

const field = (data: FormData, key: string) => data.get(key)
const toCoordinateNumber = (value: number | string | null | undefined) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function LandsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('lands')
  const [selectedCamp, setSelectedCamp] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteState>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: lands = [], isLoading: lLoad, error: landsError } = useQuery({ queryKey: ['lands'], queryFn: () => get<Land[]>('/lands') })
  const { data: camps = [], isLoading: cLoad, error: campsError } = useQuery({ queryKey: ['camps'], queryFn: () => get<LandCamp[]>('/lands/camps') })
  const { data: landmaps = [], isLoading: mLoad, error: landmapsError } = useQuery({ queryKey: ['landmaps'], queryFn: () => get<Landmap[]>('/lands/landmaps') })
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: () => get<Unit[]>('/emission-factors/units') })
  const { data: unitPfxs = [] } = useQuery({ queryKey: ['unit-prefixs'], queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs') })
  const { data: farmers = [] } = useQuery({ queryKey: ['farmers'], queryFn: () => get<Farmer[]>('/farmers') })
  const { data: provinces = [], error: provincesError } = useQuery({ queryKey: ['provinces-all'], queryFn: () => get<Province[]>('/geo/provinces') })
  const { data: districts = [], error: districtsError } = useQuery({ queryKey: ['districts-all'], queryFn: () => get<District[]>('/geo/districts') })
  const { data: subdistricts = [], error: subdistrictsError } = useQuery({ queryKey: ['subdistricts-all'], queryFn: () => get<Subdistrict[]>('/geo/subdistricts') })
  const { data: activityDetails = [] } = useQuery({ queryKey: ['activity-details'], queryFn: () => get<LogActivityDetail[]>('/activities/details') })
  const { data: headerTypes = [] } = useQuery({ queryKey: ['header-types'], queryFn: () => get<ActivityHeaderType[]>('/activities/header-types') })
  const { data: detailTypes = [] } = useQuery({ queryKey: ['detail-types-all'], queryFn: () => get<ActivityDetailType[]>('/activities/detail-types') })

  const farmerMap = useMemo(() => Object.fromEntries(farmers.map((f) => [f.farmer_id, `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim()])), [farmers])
  const campMap = useMemo(() => Object.fromEntries(camps.map((c) => [c.land_camp_id, c.land_camp_name ?? ''])), [camps])
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.unit_id, u.unit_name ?? u.unit_initial ?? ''])), [units])
  const unitPfxMap = useMemo(() => Object.fromEntries(unitPfxs.map((u) => [u.unit_prefix_id, u.unit_prefix_name ?? u.unit_prefix_initial ?? ''])), [unitPfxs])
  const provinceMap = useMemo(() => Object.fromEntries(provinces.map((province) => [province.provinces_id, province.name_th ?? ''])), [provinces])
  const districtMap = useMemo(() => Object.fromEntries(districts.map((district) => [district.districts_id, district.name_th ?? ''])), [districts])
  const districtById = useMemo(() => Object.fromEntries(districts.map((district) => [district.districts_id, district])), [districts])
  const subdistrictMap = useMemo(() => Object.fromEntries(subdistricts.map((subdistrict) => [subdistrict.subdistricts_id, subdistrict.name_th ?? ''])), [subdistricts])
  const subdistrictById = useMemo(() => Object.fromEntries(subdistricts.map((subdistrict) => [subdistrict.subdistricts_id, subdistrict])), [subdistricts])
  const headerTypeMap = useMemo(() => Object.fromEntries(headerTypes.map((t) => [t.act_header_type_id, t.act_header_type_name_th ?? `#${t.act_header_type_id}`])), [headerTypes])
  const detailTypeMap = useMemo(() => Object.fromEntries(detailTypes.map((t) => [t.act_header_detail_type_id, t.act_header_detail_type_name_th ?? `#${t.act_header_detail_type_id}`])), [detailTypes])
  const landActivityMap = useMemo(() => {
    return activityDetails.reduce<Record<number, LogActivityDetail[]>>((acc, detail) => {
      const landId = detail.activities_header?.land_id
      if (!landId) return acc
      if (!acc[landId]) acc[landId] = []
      acc[landId].push(detail)
      return acc
    }, {})
  }, [activityDetails])

  const getDistrictName = (subdistrictCode?: number) => {
    if (!subdistrictCode) return '-'
    const districtId = subdistrictById[subdistrictCode]?.district_code
    if (!districtId) return '-'
    return districtMap[districtId] ?? String(districtId)
  }

  const getProvinceName = (subdistrictCode?: number) => {
    if (!subdistrictCode) return '-'
    const districtId = subdistrictById[subdistrictCode]?.district_code
    if (!districtId) return '-'
    const provinceId = districtById[districtId]?.province_code
    if (!provinceId) return '-'
    return provinceMap[provinceId] ?? String(provinceId)
  }

  const invalidateLands = () => {
    qc.invalidateQueries({ queryKey: ['lands'] })
    qc.invalidateQueries({ queryKey: ['camps'] })
    qc.invalidateQueries({ queryKey: ['landmaps'] })
  }

  const saveMut = useMutation({
    mutationFn: async ({ modalState, payload }: { modalState: Exclude<ModalState, null>; payload: Record<string, unknown> }) => {
      if (modalState.type === 'lands') {
        return modalState.row ? put(`/lands/${modalState.row.land_id}`, payload) : post('/lands', payload)
      }
      if (modalState.type === 'camps') {
        return modalState.row ? put(`/lands/camps/${modalState.row.land_camp_id}`, payload) : post('/lands/camps', payload)
      }
      return modalState.row ? put(`/lands/landmaps/${modalState.row.landmap_id}`, payload) : post('/lands/landmaps', payload)
    },
    onSuccess: () => {
      invalidateLands()
      setModal(null)
      setFormError(null)
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : 'Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (target: Exclude<DeleteState, null>) => {
      if (target.type === 'lands') return del(`/lands/${target.id}`)
      if (target.type === 'camps') return del(`/lands/camps/${target.id}`)
      return del(`/lands/landmaps/${target.id}`)
    },
    onSuccess: () => {
      invalidateLands()
      setDeleteTarget(null)
    },
  })

  const filteredLands = selectedCamp ? lands.filter((land) => land.land_camp_id === selectedCamp) : lands
  const queryError = [landsError, campsError, landmapsError, provincesError, districtsError, subdistrictsError]
    .find((error): error is Error => error instanceof Error)

  const openCreate = (type: TabKey) => {
    setFormError(null)
    setModal({ type })
  }

  const openEdit = (state: Exclude<ModalState, null>) => {
    setFormError(null)
    setModal(state)
  }

  const actions = <T,>(onEdit: (row: T) => void, onDelete: (row: T) => void) => (row: T) => (
    <div className="flex gap-1 justify-end">
      <button className="btn-icon btn-ghost btn-sm" onClick={() => onEdit(row)} title="แก้ไข">
        <Pencil size={13} />
      </button>
      <button className="btn-icon btn-ghost btn-sm text-red-500" onClick={() => onDelete(row)} title="ลบ">
        <Trash2 size={13} />
      </button>
    </div>
  )

  const landActions = (row: Land) => (
    <div className="flex gap-1 justify-end">
      <button
        className="btn-icon btn-ghost btn-sm text-primary-600"
        onClick={() => navigate(`/activities/logs?land_id=${row.land_id}${row.land_camp_id ? `&camp_id=${row.land_camp_id}` : ''}`)}
        title="ดูกิจกรรมของแปลงนี้"
      >
        <ActivitySquare size={13} />
      </button>
      {actions<Land>(
        (item) => openEdit({ type: 'lands', row: item }),
        (item) => setDeleteTarget({ type: 'lands', id: item.land_id, name: item.name || item.land_code || `#${item.land_id}` }),
      )(row)}
    </div>
  )

  const landColumns: Column<Land>[] = [
    { key: 'land_id', header: 'ID', width: '60px' },
    { key: 'land_code', header: 'รหัสแปลง' },
    { key: 'name', header: 'ชื่อแปลง' },
    { key: 'farmer_id', header: 'เกษตรกร', render: (row) => row.farmer_id ? farmerMap[row.farmer_id] ?? row.farmer_id : '-' },
    { key: 'land_camp_id', header: 'แคมป์', render: (row) => <span className="badge-green">{row.land_camp_id ? campMap[row.land_camp_id] ?? row.land_camp_id : '-'}</span> },
    {
      key: 'operations',
      header: 'การดำเนินงาน',
      render: (row) => {
        const details = landActivityMap[row.land_id] ?? []
        if (details.length === 0) return <span className="text-surface-400">-</span>

        const labels = Array.from(new Set(details.map((detail) => {
          const detailTypeName = detail.act_header_detail_type_id ? detailTypeMap[detail.act_header_detail_type_id] : undefined
          const headerTypeName = detail.act_header_type_id ? headerTypeMap[detail.act_header_type_id] : undefined
          return detailTypeName ?? headerTypeName ?? ''
        }).filter((label) => Boolean(label && label.trim()))))

        if (labels.length === 0) return <span className="text-surface-400">-</span>

        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-[280px]">
            {labels.slice(0, 3).map((label) => (
              <span key={label} className="badge-blue">{label}</span>
            ))}
            {labels.length > 3 && <span className="badge-gray">+{labels.length - 3} รายการ</span>}
          </div>
        )
      },
    },
    { key: 'area_size', header: 'เนื้อที่โฉนด', render: (row) => row.area_size?.toFixed(2) ?? '-' },
    { key: 'land_size', header: 'ขนาดปลูก', render: (row) => row.land_size?.toFixed(2) ?? '-' },
    { key: 'land_planSize', header: 'ขนาดแผน', render: (row) => row.land_planSize?.toFixed(2) ?? '-' },
    { key: 'land_unit_prefix_id', header: 'คำนำหน้าหน่วย', render: (row) => row.land_unit_prefix_id ? unitPfxMap[row.land_unit_prefix_id] ?? row.land_unit_prefix_id : '-' },
    { key: 'land_unit_id', header: 'หน่วยนับ', render: (row) => row.land_unit_id ? unitMap[row.land_unit_id] ?? row.land_unit_id : '-' },
    { key: 'province_name', header: 'จังหวัด', render: (row) => getProvinceName(row.subdistrict_code) },
    { key: 'district_name', header: 'อำเภอ', render: (row) => getDistrictName(row.subdistrict_code) },
    { key: 'subdistrict_code', header: 'ตำบล', render: (row) => row.subdistricts?.name_th ?? (row.subdistrict_code ? subdistrictMap[row.subdistrict_code] ?? row.subdistrict_code : '-') },
    { key: 'zip_code', header: 'รหัสไปรษณีย์', render: (row) => row.zip_code ?? row.subdistricts?.zip_code ?? '-' },
    { key: 'village', header: 'หมู่บ้าน' },
    { key: 'quota_code', header: 'รหัสอ้างอิง' },
  ]

  const campColumns: Column<LandCamp>[] = [
    { key: 'land_camp_id', header: 'ID', width: '60px' },
    { key: 'land_camp_idCode', header: 'รหัสแคมป์' },
    { key: 'land_camp_name', header: 'ชื่อแคมป์' },
    { key: 'land_camp_latitude', header: 'Lat', render: (row) => row.land_camp_latitude?.toFixed(6) ?? '-' },
    { key: 'land_camp_longitude', header: 'Lng', render: (row) => row.land_camp_longitude?.toFixed(6) ?? '-' },
    { key: 'land_camp_info', header: 'หมายเหตุ', render: (row) => <span className="text-surface-400">{row.land_camp_info || '-'}</span> },
  ]

  const landmapColumns: Column<Landmap>[] = [
    { key: 'landmap_id', header: 'ID', width: '60px' },
    { key: 'landmap_idCode', header: 'รหัสโฉนด' },
    { key: 'landmap_area_size', header: 'เนื้อที่', render: (row) => row.landmap_area_size?.toFixed(2) ?? '-' },
    { key: 'landmap_unit_prefix_id', header: 'คำนำหน้าหน่วย', render: (row) => row.landmap_unit_prefix_id ? unitPfxMap[row.landmap_unit_prefix_id] ?? row.landmap_unit_prefix_id : '-' },
    { key: 'landmap_unit_id', header: 'หน่วยนับ', render: (row) => row.landmap_unit_id ? unitMap[row.landmap_unit_id] ?? row.landmap_unit_id : '-' },
    { key: 'landmap_latitude', header: 'Lat', render: (row) => row.landmap_latitude?.toFixed(6) ?? '-' },
    { key: 'landmap_longitude', header: 'Lng', render: (row) => row.landmap_longitude?.toFixed(6) ?? '-' },
    { key: 'landmap_info', header: 'หมายเหตุ', render: (row) => <span className="text-surface-400">{row.landmap_info || '-'}</span> },
  ]

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'lands', label: `แปลงที่ดิน (${filteredLands.length})`, icon: <Layers size={14} /> },
    { key: 'camps', label: `แคมป์ (${camps.length})`, icon: <Tent size={14} /> },
    { key: 'landmaps', label: `โฉนด (${landmaps.length})`, icon: <Map size={14} /> },
  ]

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!modal) return
    const data = new FormData(event.currentTarget)
    const payload =
      modal.type === 'lands'
        ? {
            land_code: toStringValue(field(data, 'land_code')),
            name: toStringValue(field(data, 'name')),
            quota_code: toStringValue(field(data, 'quota_code')),
            farmer_id: toNumber(field(data, 'farmer_id')),
            land_camp_id: toNumber(field(data, 'land_camp_id')),
            subdistrict_code: toNumber(field(data, 'subdistrict_code')),
            area_size: toNumber(field(data, 'area_size')),
            land_size: toNumber(field(data, 'land_size')),
            land_planSize: toNumber(field(data, 'land_planSize')),
            land_unit_prefix_id: toNumber(field(data, 'land_unit_prefix_id')),
            land_unit_id: toNumber(field(data, 'land_unit_id')),
            latitude: toNumber(field(data, 'latitude')),
            longitude: toNumber(field(data, 'longitude')),
            village: toStringValue(field(data, 'village')),
            zip_code: toStringValue(field(data, 'zip_code')),
          }
        : modal.type === 'camps'
          ? {
              land_camp_idCode: toStringValue(field(data, 'land_camp_idCode')),
              land_camp_name: toStringValue(field(data, 'land_camp_name')),
              land_camp_latitude: toNumber(field(data, 'land_camp_latitude')),
              land_camp_longitude: toNumber(field(data, 'land_camp_longitude')),
              land_camp_info: toStringValue(field(data, 'land_camp_info')),
            }
          : {
              landmap_idCode: toStringValue(field(data, 'landmap_idCode')),
              landmap_area_size: toNumber(field(data, 'landmap_area_size')),
              landmap_unit_prefix_id: toNumber(field(data, 'landmap_unit_prefix_id')),
              landmap_unit_id: toNumber(field(data, 'landmap_unit_id')),
              landmap_latitude: toNumber(field(data, 'landmap_latitude')),
              landmap_longitude: toNumber(field(data, 'landmap_longitude')),
              landmap_info: toStringValue(field(data, 'landmap_info')),
            }

    saveMut.mutate({ modalState: modal, payload })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Layers size={20} className="text-primary-600" /> จัดการพื้นที่เพาะปลูก</h1>
          <p className="page-subtitle">แปลงที่ดิน แคมป์เกษตร และโฉนดที่ดิน</p>
        </div>
        <button className="btn-primary btn-sm flex items-center gap-1" onClick={() => openCreate(tab)}>
          <Plus size={13} /> {tab === 'lands' ? 'เพิ่มแปลง' : tab === 'camps' ? 'เพิ่มแคมป์' : 'เพิ่มโฉนด'}
        </button>
      </div>

      {queryError && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">ไม่สามารถโหลดข้อมูลพื้นที่จาก PostgreSQL ได้</p>
          <p className="mt-1">{queryError.message}</p>
        </div>
      )}

      {tab === 'lands' && camps.length > 0 && (
        <div className="card mb-5">
          <p className="text-xs font-medium text-surface-600 mb-2">กรองตามแคมป์</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedCamp(null)} className={`btn btn-sm rounded-full ${!selectedCamp ? 'btn-primary' : 'btn-secondary'}`}>
              ทั้งหมด ({lands.length})
            </button>
            {camps.map((camp) => (
              <button
                key={camp.land_camp_id}
                onClick={() => setSelectedCamp(camp.land_camp_id)}
                className={`btn btn-sm rounded-full ${selectedCamp === camp.land_camp_id ? 'btn-primary' : 'btn-secondary'}`}
              >
                {camp.land_camp_name} ({lands.filter((land) => land.land_camp_id === camp.land_camp_id).length})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-5 bg-surface-100 p-1 rounded-xl w-fit">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === tabItem.key ? 'bg-white shadow-card text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
          >
            {tabItem.icon}{tabItem.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'lands' && (
          <DataTable
            data={filteredLands}
            columns={landColumns}
            isLoading={lLoad}
            rowKey={(row) => row.land_id}
            searchPlaceholder="ค้นหารหัสแปลง, ชื่อ, จังหวัด, อำเภอ..."
            actions={landActions}
          />
        )}
        {tab === 'camps' && (
          <DataTable
            data={camps}
            columns={campColumns}
            isLoading={cLoad}
            rowKey={(row) => row.land_camp_id}
            actions={actions<LandCamp>(
              (row) => openEdit({ type: 'camps', row }),
              (row) => setDeleteTarget({ type: 'camps', id: row.land_camp_id, name: row.land_camp_name || row.land_camp_idCode || `#${row.land_camp_id}` }),
            )}
          />
        )}
        {tab === 'landmaps' && (
          <DataTable
            data={landmaps}
            columns={landmapColumns}
            isLoading={mLoad}
            rowKey={(row) => row.landmap_id}
            actions={actions<Landmap>(
              (row) => openEdit({ type: 'landmaps', row }),
              (row) => setDeleteTarget({ type: 'landmaps', id: row.landmap_id, name: row.landmap_idCode || `#${row.landmap_id}` }),
            )}
          />
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <form
            onSubmit={submitForm}
            className={`relative bg-white rounded-2xl shadow-card-lg p-6 w-full ${modal.type === 'lands' ? 'max-w-6xl' : 'max-w-3xl'} max-h-[90vh] overflow-y-auto animate-slide-up`}
          >
            <h3 className="font-semibold mb-5">
              {modal.row ? 'แก้ไข' : 'เพิ่ม'} {modal.type === 'lands' ? 'แปลงที่ดิน' : modal.type === 'camps' ? 'แคมป์' : 'โฉนด'}
            </h3>
            {formError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

            {modal.type === 'lands' && (
              <LandForm
                row={modal.row}
                farmers={farmers}
                camps={camps}
                units={units}
                unitPfxs={unitPfxs}
                provinces={provinces}
                districts={districts}
                subdistricts={subdistricts}
              />
            )}
            {modal.type === 'camps' && <CampForm row={modal.row} />}
            {modal.type === 'landmaps' && <LandmapForm row={modal.row} units={units} unitPfxs={unitPfxs} />}

            <div className="flex gap-3 mt-5">
              <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)}>ยกเลิก</button>
              <button type="submit" className="btn-primary flex-1" disabled={saveMut.isPending}>
                {saveMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ยืนยันการลบ"
        message={`คุณต้องการลบ "${deleteTarget?.name}" หรือไม่? ถ้ามีข้อมูลอื่นอ้างอิงอยู่ PostgreSQL อาจปฏิเสธการลบ`}
        confirmLabel="ลบออก"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}

function LandForm({
  row,
  farmers,
  camps,
  units,
  unitPfxs,
  provinces,
  districts,
  subdistricts,
}: {
  row?: Land
  farmers: Farmer[]
  camps: LandCamp[]
  units: Unit[]
  unitPfxs: UnitPrefix[]
  provinces: Province[]
  districts: District[]
  subdistricts: Subdistrict[]
}) {
  const districtById = useMemo(() => Object.fromEntries(districts.map((district) => [district.districts_id, district])), [districts])
  const subdistrictById = useMemo(() => Object.fromEntries(subdistricts.map((subdistrict) => [subdistrict.subdistricts_id, subdistrict])), [subdistricts])
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null)
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null)
  const [selectedSubdistrictId, setSelectedSubdistrictId] = useState<number | null>(null)
  const [latitude, setLatitude] = useState(row?.latitude != null ? String(row.latitude) : '')
  const [longitude, setLongitude] = useState(row?.longitude != null ? String(row.longitude) : '')

  useEffect(() => {
    const currentSubdistrict = row?.subdistrict_code ? subdistrictById[row.subdistrict_code] : undefined
    const nextDistrictId = currentSubdistrict?.district_code ?? null
    const nextProvinceId = nextDistrictId ? districtById[nextDistrictId]?.province_code ?? null : null

    setSelectedProvinceId(nextProvinceId)
    setSelectedDistrictId(nextDistrictId)
    setSelectedSubdistrictId(row?.subdistrict_code ?? null)
    setLatitude(row?.latitude != null ? String(row.latitude) : '')
    setLongitude(row?.longitude != null ? String(row.longitude) : '')
  }, [districtById, row?.land_id, row?.latitude, row?.longitude, row?.subdistrict_code, subdistrictById])

  const filteredDistricts = useMemo(() => {
    if (selectedProvinceId == null) return []
    return districts.filter((district) => district.province_code === selectedProvinceId)
  }, [districts, selectedProvinceId])

  const filteredSubdistricts = useMemo(() => {
    if (selectedDistrictId == null) return []
    return subdistricts.filter((subdistrict) => subdistrict.district_code === selectedDistrictId)
  }, [selectedDistrictId, subdistricts])

  const selectedSubdistrict = selectedSubdistrictId != null ? subdistrictById[selectedSubdistrictId] : undefined
  const zipCode = selectedSubdistrict?.zip_code ?? ''

  const parsedLatitude = Number.parseFloat(latitude)
  const parsedLongitude = Number.parseFloat(longitude)
  const selectedSubdistrictLatitude = toCoordinateNumber(selectedSubdistrict?.latitude)
  const selectedSubdistrictLongitude = toCoordinateNumber(selectedSubdistrict?.longitude)
  const markerLatitude = Number.isFinite(parsedLatitude) ? parsedLatitude : selectedSubdistrictLatitude
  const markerLongitude = Number.isFinite(parsedLongitude) ? parsedLongitude : selectedSubdistrictLongitude
  const provinceReferencePoints = useMemo<LatLngTuple[]>(() => {
    if (selectedProvinceId == null) return []

    return subdistricts.flatMap((subdistrict) => {
      const districtId = subdistrict.district_code
      if (districtId == null || districtById[districtId]?.province_code !== selectedProvinceId) return []
      const lat = toCoordinateNumber(subdistrict.latitude)
      const lng = toCoordinateNumber(subdistrict.longitude)
      return lat != null && lng != null ? [[lat, lng] as LatLngTuple] : []
    })
  }, [districtById, selectedProvinceId, subdistricts])

  const districtReferencePoints = useMemo<LatLngTuple[]>(() => {
    if (selectedDistrictId == null) return []

    return subdistricts.flatMap((subdistrict) => {
      if (subdistrict.district_code !== selectedDistrictId) return []
      const lat = toCoordinateNumber(subdistrict.latitude)
      const lng = toCoordinateNumber(subdistrict.longitude)
      return lat != null && lng != null ? [[lat, lng] as LatLngTuple] : []
    })
  }, [selectedDistrictId, subdistricts])

  const subdistrictReferencePoints = useMemo<LatLngTuple[]>(() => {
    if (selectedSubdistrictId == null) return []

    return subdistricts.flatMap((subdistrict) => {
      if (subdistrict.subdistricts_id !== selectedSubdistrictId) return []
      const lat = toCoordinateNumber(subdistrict.latitude)
      const lng = toCoordinateNumber(subdistrict.longitude)
      return lat != null && lng != null ? [[lat, lng] as LatLngTuple] : []
    })
  }, [selectedSubdistrictId, subdistricts])

  const referencePoints = selectedDistrictId != null
    ? districtReferencePoints
    : selectedProvinceId != null
      ? provinceReferencePoints
      : subdistrictReferencePoints
  const scopeKey = selectedDistrictId != null
    ? `district:${selectedDistrictId}`
    : selectedProvinceId != null
      ? `province:${selectedProvinceId}`
      : selectedSubdistrictId != null
        ? `subdistrict:${selectedSubdistrictId}`
        : 'default'

  const handleMapChange = (nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude.toFixed(8))
    setLongitude(nextLongitude.toFixed(8))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FormSection title="ข้อมูลแปลงพื้นฐาน" description="กำหนดรหัส ชื่อแปลง และข้อมูลอ้างอิงพื้นฐานของพื้นที่เพาะปลูก">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField name="land_code" label="รหัสแปลง" defaultValue={row?.land_code} />
            <TextField name="name" label="ชื่อแปลง" defaultValue={row?.name} />
            <TextField name="quota_code" label="รหัสอ้างอิงแปลง" defaultValue={row?.quota_code} />
            <TextField name="village" label="หมู่บ้าน" defaultValue={row?.village} />
          </div>
        </FormSection>

        <FormSection title="ผู้รับผิดชอบและแคมป์" description="เชื่อมโยงแปลงกับเกษตรกรและแคมป์ที่เกี่ยวข้อง">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField
              name="farmer_id"
              label="เกษตรกร"
              defaultValue={row?.farmer_id}
              options={farmers.map((farmer) => ({ value: farmer.farmer_id, label: `${farmer.first_name ?? ''} ${farmer.last_name ?? ''}`.trim() || `#${farmer.farmer_id}` }))}
            />
            <SelectField
              name="land_camp_id"
              label="แคมป์"
              defaultValue={row?.land_camp_id}
              options={camps.map((camp) => ({ value: camp.land_camp_id, label: camp.land_camp_name || camp.land_camp_idCode || `#${camp.land_camp_id}` }))}
            />
          </div>
        </FormSection>
      </div>

      <FormSection title="ตำแหน่งที่อยู่" description="เลือกจังหวัด อำเภอ และตำบลเพื่อช่วยระบุตำแหน่งของแปลง พร้อมบันทึกรหัสไปรษณีย์จากตำบลที่เลือก">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="label">จังหวัด</label>
            <select
              className="select"
              value={selectedProvinceId ?? ''}
              onChange={(event) => {
                const nextProvinceId = Number(event.target.value) || null
                setSelectedProvinceId(nextProvinceId)
                setSelectedDistrictId(null)
                setSelectedSubdistrictId(null)
              }}
            >
              <option value="">- เลือกจังหวัด -</option>
              {provinces.map((province) => (
                <option key={province.provinces_id} value={province.provinces_id}>{province.name_th ?? `#${province.provinces_id}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">อำเภอ</label>
            <select
              className="select"
              value={selectedDistrictId ?? ''}
              onChange={(event) => {
                const nextDistrictId = Number(event.target.value) || null
                setSelectedDistrictId(nextDistrictId)
                setSelectedSubdistrictId(null)
              }}
              disabled={selectedProvinceId == null}
            >
              <option value="">{selectedProvinceId == null ? '- เลือกจังหวัดก่อน -' : '- เลือกอำเภอ -'}</option>
              {filteredDistricts.map((district) => (
                <option key={district.districts_id} value={district.districts_id}>{district.name_th ?? `#${district.districts_id}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">ตำบล</label>
            <select
              name="subdistrict_code"
              className="select"
              value={selectedSubdistrictId ?? ''}
              onChange={(event) => setSelectedSubdistrictId(Number(event.target.value) || null)}
              disabled={selectedDistrictId == null}
            >
              <option value="">{selectedDistrictId == null ? '- เลือกอำเภอก่อน -' : '- เลือกตำบล -'}</option>
              {filteredSubdistricts.map((subdistrict) => (
                <option key={subdistrict.subdistricts_id} value={subdistrict.subdistricts_id}>
                  {subdistrict.name_th ?? '-'}{subdistrict.zip_code ? ` (${subdistrict.zip_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <ReadOnlyField name="zip_code" label="รหัสไปรษณีย์" value={zipCode} placeholder="เลือกตำบลเพื่อดึงรหัสไปรษณีย์" />
        </div>
      </FormSection>

      <FormSection title="ขนาดพื้นที่และหน่วย" description="ระบุขนาดแปลง ขนาดตามโฉนด และหน่วยที่ใช้ในระบบ">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <NumberField name="area_size" label="เนื้อที่ตามโฉนด" defaultValue={row?.area_size} />
          <NumberField name="land_size" label="ขนาดแปลงปลูก" defaultValue={row?.land_size} />
          <NumberField name="land_planSize" label="ขนาดแผนแปลงปลูก" defaultValue={row?.land_planSize} />
          <SelectField
            name="land_unit_prefix_id"
            label="คำนำหน้าหน่วย"
            defaultValue={row?.land_unit_prefix_id}
            options={unitPfxs.map((unitPrefix) => ({ value: unitPrefix.unit_prefix_id, label: unitPrefix.unit_prefix_name || unitPrefix.unit_prefix_initial || `#${unitPrefix.unit_prefix_id}` }))}
          />
          <SelectField
            name="land_unit_id"
            label="หน่วยนับ"
            defaultValue={row?.land_unit_id}
            options={units.map((unit) => ({ value: unit.unit_id, label: unit.unit_name || unit.unit_initial || `#${unit.unit_id}` }))}
          />
        </div>
      </FormSection>

      <FormSection title="พิกัดบนแผนที่" description="คลิกบนแผนที่เพื่อปักหมุดตำแหน่งแปลง หรือแก้ไข Latitude/Longitude โดยตรง">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="space-y-3">
            <div>
              <label className="label">Latitude</label>
              <input
                name="latitude"
                type="number"
                step="0.00000001"
                className="input"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input
                name="longitude"
                type="number"
                step="0.00000001"
                className="input"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              คลิกบนแผนที่เพื่อวางตำแหน่ง หรือ drag marker เพื่อปรับค่าพิกัดให้แม่นยำขึ้น
            </div>
            {selectedProvinceId != null && provinceReferencePoints.length > 0 && selectedDistrictId == null && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                แผนที่จะเริ่มซูมตามขอบเขตโดยประมาณของจังหวัดจากพิกัดตำบลที่มีอยู่ในฐานข้อมูล
              </div>
            )}
            {selectedDistrictId != null && districtReferencePoints.length > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                เมื่อเลือกอำเภอ แผนที่จะซูมลึกลงตามขอบเขตโดยประมาณของอำเภอจากพิกัดตำบลในอำเภอนี้
              </div>
            )}
            {!Number.isFinite(parsedLatitude) && !Number.isFinite(parsedLongitude) && selectedSubdistrictLatitude != null && selectedSubdistrictLongitude != null && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                กำลังแสดงตำแหน่งอ้างอิงของตำบลที่เลือกบนแผนที่ คุณสามารถคลิกหรือเลื่อนหมุดเพื่อกำหนดพิกัดจริงของแปลงได้
              </div>
            )}
          </div>

          <LandLocationPicker
            latitude={markerLatitude}
            longitude={markerLongitude}
            referencePoints={referencePoints}
            scopeKey={scopeKey}
            onChange={handleMapChange}
          />
        </div>
      </FormSection>
    </div>
  )
}

function CampForm({ row }: { row?: LandCamp }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <TextField name="land_camp_idCode" label="รหัสแคมป์" defaultValue={row?.land_camp_idCode} />
      <TextField name="land_camp_name" label="ชื่อแคมป์" defaultValue={row?.land_camp_name} />
      <NumberField name="land_camp_latitude" label="Latitude" defaultValue={row?.land_camp_latitude} step="0.00000001" />
      <NumberField name="land_camp_longitude" label="Longitude" defaultValue={row?.land_camp_longitude} step="0.00000001" />
      <div className="md:col-span-2">
        <label className="label">หมายเหตุ</label>
        <textarea name="land_camp_info" className="input" rows={3} defaultValue={row?.land_camp_info ?? ''} />
      </div>
    </div>
  )
}

function LandmapForm({ row, units, unitPfxs }: { row?: Landmap; units: Unit[]; unitPfxs: UnitPrefix[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <TextField name="landmap_idCode" label="รหัสโฉนด" defaultValue={row?.landmap_idCode} />
      <NumberField name="landmap_area_size" label="เนื้อที่" defaultValue={row?.landmap_area_size} />
      <SelectField
        name="landmap_unit_prefix_id"
        label="คำนำหน้าหน่วย"
        defaultValue={row?.landmap_unit_prefix_id}
        options={unitPfxs.map((unitPrefix) => ({ value: unitPrefix.unit_prefix_id, label: unitPrefix.unit_prefix_name || unitPrefix.unit_prefix_initial || `#${unitPrefix.unit_prefix_id}` }))}
      />
      <SelectField
        name="landmap_unit_id"
        label="หน่วยนับ"
        defaultValue={row?.landmap_unit_id}
        options={units.map((unit) => ({ value: unit.unit_id, label: unit.unit_name || unit.unit_initial || `#${unit.unit_id}` }))}
      />
      <NumberField name="landmap_latitude" label="Latitude" defaultValue={row?.landmap_latitude} step="0.00000001" />
      <NumberField name="landmap_longitude" label="Longitude" defaultValue={row?.landmap_longitude} step="0.00000001" />
      <div className="md:col-span-2">
        <label className="label">หมายเหตุ</label>
        <textarea name="landmap_info" className="input" rows={3} defaultValue={row?.landmap_info ?? ''} />
      </div>
    </div>
  )
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
    <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4 md:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-surface-900">{title}</h4>
        {description && <p className="text-xs text-surface-500 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ReadOnlyField({
  name,
  label,
  value,
  placeholder,
}: {
  name: string
  label: string
  value: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} className="input bg-surface-100 text-surface-700" value={value} readOnly placeholder={placeholder} />
    </div>
  )
}

function TextField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} className="input" defaultValue={defaultValue ?? ''} />
    </div>
  )
}

function NumberField({
  name,
  label,
  defaultValue,
  step = '0.01',
}: {
  name: string
  label: string
  defaultValue?: number
  step?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type="number" step={step} className="input" defaultValue={defaultValue ?? ''} />
    </div>
  )
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string
  label: string
  defaultValue?: number
  options: { value: number; label: string }[]
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select name={name} className="select" defaultValue={defaultValue ?? ''}>
        <option value="">- ไม่ระบุ -</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}
