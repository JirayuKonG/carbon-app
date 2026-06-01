import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, Column } from '@/components/ui/DataTable'
import { get } from '@/lib/api'
import { MapPin } from 'lucide-react'

interface Province   { provinces_id: number; geography_id: number; name_th: string; name_th_short: string; name_en: string;}
interface District   { districts_id: number; province_code: number; name_th: string; name_en: string; }
interface Subdistrict { subdistricts_id: number; district_code: number ; zip_code: string; name_th: string; name_en: string; latitude: number; longitude: number}
interface Geography { geographies_id: number; name: string }

export function GeoPage() {
  const [selectedGeography, setSelectedGeography] = useState<number | null>(null)
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null)

  const { data: geographies = [], error: geographiesError } =
    useQuery({ 
      queryKey: ['geographies'], 
      queryFn: () => get<Geography[]>('/geo/geographies') 
    })

  const { data: provinces = [], isLoading: pLoading, error: provincesError } =
    useQuery({
      queryKey: ['provinces', selectedGeography],
      queryFn: () => get<Province[]>('/geo/provinces', selectedGeography ? { geography_id: selectedGeography } : undefined),
    })

  const { data: districts = [], isLoading: dLoading, error: districtsError } =
    useQuery({
      queryKey: ['districts', selectedProvince],
      queryFn:  () => get<District[]>(`/geo/districts?province_id=${selectedProvince}`),
      enabled:  !!selectedProvince,
    })

  const { data: subdistricts = [], isLoading: sLoading, error: subdistrictsError } =
    useQuery({
      queryKey: ['subdistricts', selectedDistrict],
      queryFn:  () => get<Subdistrict[]>(`/geo/subdistricts?district_id=${selectedDistrict}`),
      enabled:  !!selectedDistrict,
    })

  const geographyMap = Object.fromEntries(geographies.map((g) => [g.geographies_id, g.name]))

  const provinceColumns: Column<Province>[] = [
    { key: 'provinces_id', header: 'ID', width: '60px' },
    { key: 'name_th',      header: 'ชื่อ (ไทย)' },
    { key: 'name_en',      header: 'ชื่อ (อังกฤษ)' },
    { key: 'geography_id', header: 'ภูมิภาค', render: (r) => geographyMap[r.geography_id] ?? r.geography_id ?? '-' },
  ]
  const districtColumns: Column<District>[] = [
    { key: 'districts_id', header: 'ID', width: '60px' },
    { key: 'name_th', header: 'ชื่อ (ไทย)' },
    { key: 'name_en', header: 'ชื่อ (อังกฤษ)' },
  ]
  const subdistrictColumns: Column<Subdistrict>[] = [
    { key: 'subdistricts_id', header: 'ID', width: '60px' },
    { key: 'name_th',         header: 'ชื่อ (ไทย)' },
    { key: 'zip_code',        header: 'รหัสไปรษณีย์', width: '120px' },
  ]

  const queryError = [geographiesError, provincesError, districtsError, subdistrictsError]
    .find((error): error is Error => error instanceof Error)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <MapPin size={20} className="text-primary-600" /> ตั้งค่าพื้นที่ในประเทศไทย
          </h1>
          <p className="page-subtitle">จัดการข้อมูลจังหวัด อำเภอ และตำบล</p>
        </div>
        {/* <button className="btn-primary btn-sm">
          <Plus size={14} /> เพิ่มข้อมูล
        </button> */}
      </div>

      {queryError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">ไม่สามารถโหลดข้อมูลพื้นที่จาก PostgreSQL ได้</p>
          <p className="mt-1">{queryError.message}</p>
        </div>
      )}

      {/* Cascading filters */}
      <div className="card mb-6">
        <p className="text-xs font-medium text-surface-600 mb-3">กรองพื้นที่</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">ภูมิภาค</label>
            <select
              className="select"
              value={selectedGeography ?? ''}
              onChange={(e) => {
                setSelectedGeography(Number(e.target.value) || null)
                setSelectedProvince(null)
                setSelectedDistrict(null)
              }}
            >
              <option value="">— ทุกภูมิภาค —</option>
              {geographies.map((g) => <option key={g.geographies_id} value={g.geographies_id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">จังหวัด</label>
            <select className="select" value={selectedProvince ?? ''} onChange={(e) => { setSelectedProvince(Number(e.target.value) || null); setSelectedDistrict(null) }}>
              <option value="">— เลือกจังหวัด —</option>
              {provinces.map((p) => <option key={p.provinces_id} value={p.provinces_id}>{p.name_th}</option>)}
            </select>
          </div>
          <div>
            <label className="label">อำเภอ</label>
            <select className="select" value={selectedDistrict ?? ''} onChange={(e) => setSelectedDistrict(Number(e.target.value) || null)} disabled={!selectedProvince}>
              <option value="">— เลือกอำเภอ —</option>
              {districts.map((d) => <option key={d.districts_id} value={d.districts_id}>{d.name_th}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ตำบล</label>
            <select className="select" disabled={!selectedDistrict}>
              <option value="">— เลือกตำบล —</option>
              {subdistricts.map((s) => <option key={s.subdistricts_id} value={s.subdistricts_id}>{s.name_th}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-800 mb-4">จังหวัด ({provinces.length})</h2>
          <DataTable
            data={provinces} columns={provinceColumns} isLoading={pLoading}
            rowKey={(r) => r.provinces_id} defaultPageSize={10}
            onRowClick={(r) => { setSelectedProvince(r.provinces_id); setSelectedDistrict(null) }}
          />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-800 mb-4">
            อำเภอ {selectedProvince ? `(${districts.length})` : '— เลือกจังหวัดก่อน'}
          </h2>
          <DataTable
            data={districts} columns={districtColumns} isLoading={dLoading}
            rowKey={(r) => r.districts_id} defaultPageSize={10}
            onRowClick={(r) => setSelectedDistrict(r.districts_id)}
            emptyMessage={selectedProvince ? 'ไม่พบอำเภอ' : 'เลือกจังหวัดเพื่อดูอำเภอ'}
          />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-800 mb-4">
            ตำบล {selectedDistrict ? `(${subdistricts.length})` : '— เลือกอำเภอก่อน'}
          </h2>
          <DataTable
            data={subdistricts} columns={subdistrictColumns} isLoading={sLoading}
            rowKey={(r) => r.subdistricts_id} defaultPageSize={10}
            emptyMessage={selectedDistrict ? 'ไม่พบตำบล' : 'เลือกอำเภอเพื่อดูตำบล'}
          />
        </div>
      </div>
    </div>
  )
}
