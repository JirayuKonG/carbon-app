import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable, Column } from '@/components/ui/DataTable'
import { CsvMappingWizard, TargetColumn, ColumnMapping } from '@/components/ui/CsvMappingWizard'
import { get, post } from '@/lib/api'
import { CloudRain, Upload, Plus, Thermometer, Wind, Droplets } from 'lucide-react'

interface WeatherRec {
  land_weatherStationRec_id: number
  land_camp_id: number
  land_weatherStationRec_airTemperature: number
  land_weatherStationRec_relativeHumidity: number
  land_weatherStationRec_barometricPressure: number
  land_weatherStationRec_windSP: number
  land_weatherStationRec_rainfall: number
  land_weatherStationRec_solarRadiation_UV: number
  land_weatherStationRec_soilMoisture_soilTemp: number
  land_weatherStationRec_dewPoint: number
  land_weatherStationRec_evapotranspiration: number
}
interface LandCamp { land_camp_id: number; land_camp_name: string }

// Target columns matching lands_weatherStationRec schema v1.3
const WEATHER_TARGET_COLUMNS: TargetColumn[] = [
  { key: 'land_camp_id',                               label: 'แคมป์',                        required: true,  type: 'fk', fkTable: 'lands_camps' },
  { key: 'land_weatherStationRec_airTemperature',       label: 'อุณหภูมิอากาศ (°C)',           required: false, type: 'number' },
  { key: 'land_weatherStationRec_relativeHumidity',     label: 'ความชื้นสัมพัทธ์ (%)',         required: false, type: 'number' },
  { key: 'land_weatherStationRec_barometricPressure',   label: 'ความดันบรรยากาศ (hPa)',        required: false, type: 'number' },
  { key: 'land_weatherStationRec_windSP',               label: 'ความเร็วลม (m/s)',             required: false, type: 'number' },
  { key: 'land_weatherStationRec_rainfall',             label: 'ปริมาณฝน (mm)',               required: false, type: 'number' },
  { key: 'land_weatherStationRec_solarRadiation_UV',    label: 'รังสีแสงอาทิตย์ / UV',        required: false, type: 'number' },
  { key: 'land_weatherStationRec_soilMoisture_soilTemp',label: 'ความชื้น/อุณหภูมิดิน',        required: false, type: 'number' },
  { key: 'land_weatherStationRec_dewPoint',             label: 'จุดน้ำค้าง (°C)',              required: false, type: 'number' },
  { key: 'land_weatherStationRec_evapotranspiration',   label: 'การระเหย-คายน้ำ (ET)',         required: false, type: 'number' },
]

export function WeatherPage() {
  const qc = useQueryClient()
  const [showWizard, setShowWizard]   = useState(false)
  const [showManual, setShowManual]   = useState(false)
  const [selectedCamp, setSelectedCamp] = useState<number | ''>('')

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['weather-records', selectedCamp],
    queryFn:  () => get<WeatherRec[]>(`/lands/weather${selectedCamp ? `?camp_id=${selectedCamp}` : ''}`),
  })
  const { data: camps = [] } = useQuery({ queryKey: ['camps'], queryFn: () => get<LandCamp[]>('/lands/camps') })

  const importMut = useMutation({
    mutationFn: (payload: { mappings: ColumnMapping[]; rows: Record<string, string>[] }) =>
      post('/lands/weather/import', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weather-records'] }); setShowWizard(false) },
  })

  const campMap = Object.fromEntries(camps.map(c => [c.land_camp_id, c.land_camp_name]))

  const fmt = (v: number | null | undefined, dec = 1) => v != null ? v.toFixed(dec) : '—'

  const columns: Column<WeatherRec>[] = [
    { key: 'land_weatherStationRec_id', header: 'ID', width: '60px' },
    { key: 'land_camp_id',              header: 'แคมป์', render: (r) => <span className="badge-green">{campMap[r.land_camp_id] ?? r.land_camp_id}</span> },
    { key: 'land_weatherStationRec_airTemperature',   header: 'อุณหภูมิ (°C)',  render: (r) => fmt(r.land_weatherStationRec_airTemperature) },
    { key: 'land_weatherStationRec_relativeHumidity', header: 'ความชื้น (%)',    render: (r) => fmt(r.land_weatherStationRec_relativeHumidity) },
    { key: 'land_weatherStationRec_rainfall',         header: 'ฝน (mm)',         render: (r) => fmt(r.land_weatherStationRec_rainfall) },
    { key: 'land_weatherStationRec_windSP',           header: 'ลม (m/s)',        render: (r) => fmt(r.land_weatherStationRec_windSP) },
    { key: 'land_weatherStationRec_solarRadiation_UV',header: 'UV/Solar',        render: (r) => fmt(r.land_weatherStationRec_solarRadiation_UV) },
    { key: 'land_weatherStationRec_dewPoint',         header: 'จุดน้ำค้าง (°C)', render: (r) => fmt(r.land_weatherStationRec_dewPoint) },
    { key: 'land_weatherStationRec_evapotranspiration',header: 'ET',             render: (r) => fmt(r.land_weatherStationRec_evapotranspiration, 3) },
  ]

  // Summary stats from current data
  const avgTemp = records.length ? records.reduce((s, r) => s + (r.land_weatherStationRec_airTemperature ?? 0), 0) / records.length : null
  const totalRain = records.reduce((s, r) => s + (r.land_weatherStationRec_rainfall ?? 0), 0)
  const avgHumidity = records.length ? records.reduce((s, r) => s + (r.land_weatherStationRec_relativeHumidity ?? 0), 0) / records.length : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><CloudRain size={20} className="text-primary-600" /> ข้อมูลสภาพอากาศ</h1>
          <p className="page-subtitle">บันทึกจากสถานีตรวจวัดในแคมป์เกษตร</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowManual(true)}><Plus size={14} /> เพิ่มรายการ</button>
          <button className="btn-primary" onClick={() => setShowWizard(true)}><Upload size={14} /> นำเข้า CSV</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2"><Thermometer size={14} className="text-accent-500" /><span className="stat-label">อุณหภูมิเฉลี่ย</span></div>
          <p className="stat-value">{avgTemp != null ? avgTemp.toFixed(1) : '—'}°C</p>
          <p className="stat-sub">{records.length} records</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2"><Droplets size={14} className="text-blue-500" /><span className="stat-label">ปริมาณฝนรวม</span></div>
          <p className="stat-value">{totalRain.toFixed(1)} mm</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2"><Droplets size={14} className="text-teal-500" /><span className="stat-label">ความชื้นเฉลี่ย</span></div>
          <p className="stat-value">{avgHumidity != null ? avgHumidity.toFixed(1) : '—'}%</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2"><Wind size={14} className="text-surface-400" /><span className="stat-label">จำนวนแคมป์</span></div>
          <p className="stat-value">{camps.length}</p>
        </div>
      </div>

      {/* Camp filter */}
      <div className="card mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="label mb-0 shrink-0">กรองตามแคมป์:</label>
          <select className="select max-w-xs" value={selectedCamp} onChange={(e) => setSelectedCamp(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— ทุกแคมป์ —</option>
            {camps.map(c => <option key={c.land_camp_id} value={c.land_camp_id}>{c.land_camp_name}</option>)}
          </select>
          <span className="text-xs text-surface-400">{records.length} รายการ</span>
        </div>
      </div>

      <div className="card">
        <DataTable
          data={records} columns={columns} isLoading={isLoading}
          rowKey={(r) => r.land_weatherStationRec_id}
          searchPlaceholder="ค้นหา..."
          emptyMessage="ยังไม่มีข้อมูลสภาพอากาศ — กด 'นำเข้า CSV' เพื่อเริ่มต้น"
        />
      </div>

      {/* Manual entry modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowManual(false)} />
          <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-lg animate-slide-up">
            <h3 className="font-semibold mb-5">เพิ่มข้อมูลสภาพอากาศ</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">แคมป์ *</label>
                <select className="select">
                  <option value="">— เลือกแคมป์ —</option>
                  {camps.map(c => <option key={c.land_camp_id} value={c.land_camp_id}>{c.land_camp_name}</option>)}
                </select>
              </div>
              {[
                { key: 'airTemperature',       label: 'อุณหภูมิอากาศ (°C)' },
                { key: 'relativeHumidity',     label: 'ความชื้นสัมพัทธ์ (%)' },
                { key: 'barometricPressure',   label: 'ความดันบรรยากาศ (hPa)' },
                { key: 'windSP',               label: 'ความเร็วลม (m/s)' },
                { key: 'rainfall',             label: 'ปริมาณฝน (mm)' },
                { key: 'solarRadiation_UV',    label: 'รังสีแสงอาทิตย์ UV' },
                { key: 'soilMoisture_soilTemp',label: 'ความชื้น/อุณหภูมิดิน' },
                { key: 'dewPoint',             label: 'จุดน้ำค้าง (°C)' },
                { key: 'evapotranspiration',   label: 'การระเหยคายน้ำ (ET)' },
              ].map(f => (
                <div key={f.key}><label className="label">{f.label}</label><input type="number" step="0.01" className="input" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setShowManual(false)}>ยกเลิก</button>
              <button className="btn-primary flex-1">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Wizard */}
      {showWizard && (
        <CsvMappingWizard
          title="นำเข้าข้อมูลสภาพอากาศ"
          subtitle="อัพโหลด CSV จากสถานีตรวจวัด แล้วจับคู่ column กับฐานข้อมูล"
          targetColumns={WEATHER_TARGET_COLUMNS}
          onComplete={async (mappings, rows) => { await importMut.mutateAsync({ mappings, rows }) }}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
