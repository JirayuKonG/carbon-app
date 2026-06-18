import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, Column, ExpandableTextCell } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { del, get, post, put } from '@/lib/api'
import { LandLocationPicker } from '@/features/lands/LandLocationPicker'
import { Layers, Plus, Map, Tent, Pencil, Trash2, ActivitySquare, MapPinned, CheckSquare, Square } from 'lucide-react'
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
  land_camp_group_id?: number
  lands_camps_groups?: {
    land_camp_group_id?: number
    land_camp_group_idCode?: string
    land_camp_group_name?: string
  }
}

interface LandCampGroup {
  land_camp_group_id: number
  land_camp_group_idCode?: string
  land_camp_group_name?: string
  _count?: {
    lands_camps?: number
  }
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
interface ProductYear { act_productYear_id: number; act_productYear_name?: string }
interface LogActivityDetail {
  log_act_detail_id: number
  act_productYear_id?: number
  act_header_type_id?: number
  act_header_detail_type_id?: number
  activities_productYear?: { act_productYear_name?: string }
  activities_header?: {
    land_id?: number
  }
}

interface BulkSubdistrictUpdateResponse {
  updatedCount: number
  land_ids: number[]
  subdistrict: {
    subdistricts_id: number
    name_th?: string
    zip_code?: string
  }
}

interface BulkCampGroupUpdateResponse {
  updatedCount: number
  camp_ids: number[]
  camp_group: {
    land_camp_group_id: number
    land_camp_group_idCode?: string
    land_camp_group_name?: string
  }
}

type TabKey = 'lands' | 'camps' | 'landmaps'
type CampGroupFilter = 'all' | 'grouped' | 'ungrouped'
type ModalState =
  | { type: 'lands'; row?: Land }
  | { type: 'camps'; row?: LandCamp }
  | { type: 'camp-groups'; row?: LandCampGroup }
  | { type: 'landmaps'; row?: Landmap }
  | null
type DeleteState =
  | { type: 'lands'; id: number; name: string }
  | { type: 'camps'; id: number; name: string }
  | { type: 'camp-groups'; id: number; name: string }
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
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>('lands')
  const [selectedCamp, setSelectedCamp] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteState>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedLandIds, setSelectedLandIds] = useState<number[]>([])
  const [bulkProvinceId, setBulkProvinceId] = useState<number | null>(null)
  const [bulkDistrictId, setBulkDistrictId] = useState<number | null>(null)
  const [bulkSubdistrictId, setBulkSubdistrictId] = useState<number | null>(null)
  const [campGroupFilter, setCampGroupFilter] = useState<CampGroupFilter>('all')
  const [campGroupIdFilter, setCampGroupIdFilter] = useState<string>('')
  const [selectedCampIds, setSelectedCampIds] = useState<number[]>([])
  const [bulkCampGroupId, setBulkCampGroupId] = useState<number | null>(null)
  const [activityProductYearFilter, setActivityProductYearFilter] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [campBulkError, setCampBulkError] = useState<string | null>(null)

  const { data: lands = [], isLoading: lLoad, error: landsError } = useQuery({ queryKey: ['lands'], queryFn: () => get<Land[]>('/lands') })
  const { data: camps = [], isLoading: cLoad, error: campsError } = useQuery({ queryKey: ['camps'], queryFn: () => get<LandCamp[]>('/lands/camps') })
  const { data: campGroups = [], isLoading: cgLoad, error: campGroupsError } = useQuery({ queryKey: ['camp-groups'], queryFn: () => get<LandCampGroup[]>('/lands/camp-groups') })
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
  const { data: productYears = [], error: productYearsError } = useQuery({ queryKey: ['activity-product-years'], queryFn: () => get<ProductYear[]>('/activities/product-years') })

  const farmerMap = useMemo(() => Object.fromEntries(farmers.map((f) => [f.farmer_id, `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim()])), [farmers])
  const campMap = useMemo(() => Object.fromEntries(camps.map((c) => [c.land_camp_id, c.land_camp_name ?? ''])), [camps])
  const campGroupMap = useMemo(() => Object.fromEntries(campGroups.map((group) => [group.land_camp_group_id, group.land_camp_group_name ?? group.land_camp_group_idCode ?? `#${group.land_camp_group_id}`])), [campGroups])
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.unit_id, u.unit_name ?? u.unit_initial ?? ''])), [units])
  const unitPfxMap = useMemo(() => Object.fromEntries(unitPfxs.map((u) => [u.unit_prefix_id, u.unit_prefix_name ?? u.unit_prefix_initial ?? ''])), [unitPfxs])
  const provinceMap = useMemo(() => Object.fromEntries(provinces.map((province) => [province.provinces_id, province.name_th ?? ''])), [provinces])
  const districtMap = useMemo(() => Object.fromEntries(districts.map((district) => [district.districts_id, district.name_th ?? ''])), [districts])
  const districtById = useMemo(() => Object.fromEntries(districts.map((district) => [district.districts_id, district])), [districts])
  const subdistrictMap = useMemo(() => Object.fromEntries(subdistricts.map((subdistrict) => [subdistrict.subdistricts_id, subdistrict.name_th ?? ''])), [subdistricts])
  const subdistrictById = useMemo(() => Object.fromEntries(subdistricts.map((subdistrict) => [subdistrict.subdistricts_id, subdistrict])), [subdistricts])
  const headerTypeMap = useMemo(() => Object.fromEntries(headerTypes.map((t) => [t.act_header_type_id, t.act_header_type_name_th ?? `#${t.act_header_type_id}`])), [headerTypes])
  const detailTypeMap = useMemo(() => Object.fromEntries(detailTypes.map((t) => [t.act_header_detail_type_id, t.act_header_detail_type_name_th ?? `#${t.act_header_detail_type_id}`])), [detailTypes])
  const filteredActivityDetails = useMemo(() => (
    activityProductYearFilter
      ? activityDetails.filter((detail) => String(detail.act_productYear_id ?? '') === activityProductYearFilter)
      : activityDetails
  ), [activityDetails, activityProductYearFilter])
  const landActivityMap = useMemo(() => {
    return filteredActivityDetails.reduce<Record<number, LogActivityDetail[]>>((acc, detail) => {
      const landId = detail.activities_header?.land_id
      if (!landId) return acc
      if (!acc[landId]) acc[landId] = []
      acc[landId].push(detail)
      return acc
    }, {})
  }, [filteredActivityDetails])

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

  useEffect(() => {
    const productYearId = searchParams.get('activityProductYearId') ?? ''
    setActivityProductYearFilter((prev) => (prev === productYearId ? prev : productYearId))
  }, [searchParams])

  const invalidateLands = () => {
    qc.invalidateQueries({ queryKey: ['lands'] })
    qc.invalidateQueries({ queryKey: ['camps'] })
    qc.invalidateQueries({ queryKey: ['camp-groups'] })
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
      if (modalState.type === 'camp-groups') {
        return modalState.row ? put(`/lands/camp-groups/${modalState.row.land_camp_group_id}`, payload) : post('/lands/camp-groups', payload)
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

  const bulkSubdistrictMut = useMutation({
    mutationFn: async () => put<BulkSubdistrictUpdateResponse>('/lands/bulk/subdistrict', {
      land_ids: selectedLandIds,
      subdistrict_code: bulkSubdistrictId,
    }),
    onSuccess: (result) => {
      invalidateLands()
      setSelectedLandIds([])
      setBulkError(null)
      toast.success(
        'อัปเดตตำบลสำเร็จ',
        `อัปเดตแล้ว ${result.updatedCount} แปลงเป็นตำบล ${result.subdistrict.name_th ?? `#${result.subdistrict.subdistricts_id}`}${result.subdistrict.zip_code ? ` (${result.subdistrict.zip_code})` : ''}`,
      )
    },
    onError: (error) => {
      setBulkError(error instanceof Error ? error.message : 'Bulk update failed')
    },
  })

  const bulkCampGroupMut = useMutation({
    mutationFn: async () => put<BulkCampGroupUpdateResponse>('/lands/camps/bulk-group', {
      camp_ids: selectedCampIds,
      land_camp_group_id: bulkCampGroupId,
    }),
    onSuccess: (result) => {
      invalidateLands()
      setSelectedCampIds([])
      setCampBulkError(null)
      toast.success(
        selectedGroupedCampCount > 0
          ? 'ย้ายกลุ่มไร่สำเร็จ'
          : 'เพิ่มเข้ากลุ่มไร่สำเร็จ',
        `อัปเดตแล้ว ${result.updatedCount} แคมป์ไปยัง ${result.camp_group.land_camp_group_name ?? result.camp_group.land_camp_group_idCode ?? `#${result.camp_group.land_camp_group_id}`}`,
      )
    },
    onError: (error) => {
      setCampBulkError(error instanceof Error ? error.message : 'Bulk camp group update failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (target: Exclude<DeleteState, null>) => {
      if (target.type === 'lands') return del(`/lands/${target.id}`)
      if (target.type === 'camps') return del(`/lands/camps/${target.id}`)
      if (target.type === 'camp-groups') return del(`/lands/camp-groups/${target.id}`)
      return del(`/lands/landmaps/${target.id}`)
    },
    onSuccess: () => {
      invalidateLands()
      setDeleteTarget(null)
    },
  })

  const filteredLands = selectedCamp ? lands.filter((land) => land.land_camp_id === selectedCamp) : lands
  const filteredCamps = useMemo(() => (
    camps.filter((camp) => {
      const matchesStatus = campGroupFilter === 'grouped'
        ? camp.land_camp_group_id != null
        : campGroupFilter === 'ungrouped'
          ? camp.land_camp_group_id == null
          : true
      const matchesGroupId = !campGroupIdFilter || String(camp.land_camp_group_id ?? '') === campGroupIdFilter
      return matchesStatus && matchesGroupId
    })
  ), [campGroupFilter, campGroupIdFilter, camps])
  const selectedLandIdSet = useMemo(() => new Set(selectedLandIds), [selectedLandIds])
  const filteredLandIds = useMemo(() => filteredLands.map((land) => land.land_id), [filteredLands])
  const filteredLandIdSet = useMemo(() => new Set(filteredLandIds), [filteredLandIds])
  const selectedLands = useMemo(() => lands.filter((land) => selectedLandIdSet.has(land.land_id)), [lands, selectedLandIdSet])
  const selectedCampIdSet = useMemo(() => new Set(selectedCampIds), [selectedCampIds])
  const filteredCampIds = useMemo(() => filteredCamps.map((camp) => camp.land_camp_id), [filteredCamps])
  const filteredCampIdSet = useMemo(() => new Set(filteredCampIds), [filteredCampIds])
  const selectedCamps = useMemo(() => camps.filter((camp) => selectedCampIdSet.has(camp.land_camp_id)), [camps, selectedCampIdSet])
  const groupedCampsCount = useMemo(() => camps.filter((camp) => camp.land_camp_group_id != null).length, [camps])
  const ungroupedCampsCount = camps.length - groupedCampsCount
  const areAllFilteredCampsSelected = filteredCamps.length > 0 && filteredCamps.every((camp) => selectedCampIdSet.has(camp.land_camp_id))
  const filteredCampSelectionCount = filteredCamps.filter((camp) => selectedCampIdSet.has(camp.land_camp_id)).length
  const selectedGroupedCampCount = selectedCamps.filter((camp) => camp.land_camp_group_id != null).length
  const selectedUngroupedCampCount = selectedCamps.length - selectedGroupedCampCount
  const bulkFilteredDistricts = useMemo(() => {
    if (bulkProvinceId == null) return []
    return districts.filter((district) => district.province_code === bulkProvinceId)
  }, [bulkProvinceId, districts])
  const bulkFilteredSubdistricts = useMemo(() => {
    if (bulkDistrictId == null) return []
    return subdistricts.filter((subdistrict) => subdistrict.district_code === bulkDistrictId)
  }, [bulkDistrictId, subdistricts])
  const selectedBulkSubdistrict = bulkSubdistrictId != null ? subdistrictById[bulkSubdistrictId] : undefined
  const areAllFilteredLandsSelected = filteredLands.length > 0 && filteredLands.every((land) => selectedLandIdSet.has(land.land_id))
  const filteredSelectionCount = filteredLands.filter((land) => selectedLandIdSet.has(land.land_id)).length
  const pageQueryItems = [
    { label: 'ข้อมูลแปลง', error: landsError },
    { label: 'ข้อมูลแคมป์', error: campsError },
    { label: 'ข้อมูลกลุ่มไร่', error: campGroupsError },
    { label: 'ข้อมูลโฉนด', error: landmapsError },
    { label: 'จังหวัด', error: provincesError },
    { label: 'อำเภอ', error: districtsError },
    { label: 'ตำบล', error: subdistrictsError },
    { label: 'ปีการผลิตกิจกรรม', error: productYearsError },
  ]

  const openCreate = (type: TabKey) => {
    setFormError(null)
    setModal({ type })
  }

  const openEdit = (state: Exclude<ModalState, null>) => {
    setFormError(null)
    setModal(state)
  }

  useEffect(() => {
    setSelectedLandIds((prev) => prev.filter((landId) => lands.some((land) => land.land_id === landId)))
  }, [lands])

  useEffect(() => {
    setSelectedCampIds((prev) => prev.filter((campId) => camps.some((camp) => camp.land_camp_id === campId)))
  }, [camps])

  useEffect(() => {
    if (!campGroupIdFilter) return
    if (campGroups.some((group) => String(group.land_camp_group_id) === campGroupIdFilter)) return
    setCampGroupIdFilter('')
  }, [campGroupIdFilter, campGroups])

  const toggleLandSelection = (landId: number) => {
    setSelectedLandIds((prev) => (
      prev.includes(landId) ? prev.filter((id) => id !== landId) : [...prev, landId]
    ))
  }

  const toggleCampSelection = (campId: number) => {
    setSelectedCampIds((prev) => (
      prev.includes(campId) ? prev.filter((id) => id !== campId) : [...prev, campId]
    ))
  }

  const toggleFilteredLandSelection = () => {
    setSelectedLandIds((prev) => {
      if (areAllFilteredLandsSelected) {
        return prev.filter((landId) => !filteredLandIdSet.has(landId))
      }

      return Array.from(new Set([...prev, ...filteredLandIds]))
    })
  }

  const clearSelectedLands = () => {
    setSelectedLandIds([])
  }

  const toggleFilteredCampSelection = () => {
    setSelectedCampIds((prev) => {
      if (areAllFilteredCampsSelected) {
        return prev.filter((campId) => !filteredCampIdSet.has(campId))
      }

      return Array.from(new Set([...prev, ...filteredCampIds]))
    })
  }

  const clearSelectedCamps = () => {
    setSelectedCampIds([])
  }

  const handleLandRowClick = (row: Land) => {
    toggleLandSelection(row.land_id)
    setBulkError(null)
  }

  const handleCampRowClick = (row: LandCamp) => {
    toggleCampSelection(row.land_camp_id)
    setCampBulkError(null)
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
    {
      key: 'bulk_select',
      header: (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            checked={areAllFilteredLandsSelected}
            onClick={(event) => event.stopPropagation()}
            onChange={toggleFilteredLandSelection}
            title="เลือกหรือยกเลิกทุกแปลงในรายการที่กรองอยู่"
            aria-label="เลือกหรือยกเลิกทุกแปลงในรายการที่กรองอยู่"
          />
        </label>
      ),
      width: '54px',
      render: (row) => (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            checked={selectedLandIdSet.has(row.land_id)}
            onClick={(event) => event.stopPropagation()}
            onChange={() => {
              toggleLandSelection(row.land_id)
              setBulkError(null)
            }}
            aria-label={`เลือกแปลง ${row.name || row.land_code || row.land_id}`}
          />
        </label>
      ),
    },
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
    {
      key: 'bulk_select',
      header: (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            checked={areAllFilteredCampsSelected}
            onClick={(event) => event.stopPropagation()}
            onChange={toggleFilteredCampSelection}
            title="เลือกหรือยกเลิกทุกแคมป์ในรายการที่กรองอยู่"
            aria-label="เลือกหรือยกเลิกทุกแคมป์ในรายการที่กรองอยู่"
          />
        </label>
      ),
      width: '54px',
      render: (row) => (
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            checked={selectedCampIdSet.has(row.land_camp_id)}
            onClick={(event) => event.stopPropagation()}
            onChange={() => {
              toggleCampSelection(row.land_camp_id)
              setCampBulkError(null)
            }}
            aria-label={`เลือกแคมป์ ${row.land_camp_name || row.land_camp_idCode || row.land_camp_id}`}
          />
        </label>
      ),
    },
    { key: 'land_camp_id', header: 'ID', width: '60px' },
    { key: 'land_camp_idCode', header: 'รหัสแคมป์' },
    { key: 'land_camp_name', header: 'ชื่อแคมป์', width: '220px', minWidth: '180px', resizable: true },
    {
      key: 'land_camp_group_id',
      header: 'กลุ่มไร่',
      render: (row) => row.land_camp_group_id
        ? <span className="badge-blue">{row.lands_camps_groups?.land_camp_group_name ?? campGroupMap[row.land_camp_group_id] ?? `#${row.land_camp_group_id}`}</span>
        : <span className="text-surface-400">-</span>,
    },
    {
      key: 'group_status',
      header: 'สถานะกลุ่ม',
      sortable: true,
      sortValue: (row) => row.land_camp_group_id ? 1 : 0,
      render: (row) => row.land_camp_group_id
        ? <span className="badge-green">มีกลุ่มแล้ว</span>
        : <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">ยังไม่มีกลุ่ม</span>,
    },
    { key: 'land_camp_latitude', header: 'Lat', render: (row) => row.land_camp_latitude?.toFixed(6) ?? '-' },
    { key: 'land_camp_longitude', header: 'Lng', render: (row) => row.land_camp_longitude?.toFixed(6) ?? '-' },
    { key: 'land_camp_info', header: 'หมายเหตุ', width: '300px', minWidth: '220px', resizable: true, render: (row) => <ExpandableTextCell text={row.land_camp_info} title="หมายเหตุแคมป์" className="text-surface-400" /> },
  ]

  const campGroupColumns: Column<LandCampGroup>[] = [
    { key: 'land_camp_group_id', header: 'ID', width: '60px' },
    { key: 'land_camp_group_idCode', header: 'รหัสกลุ่มไร่' },
    { key: 'land_camp_group_name', header: 'ชื่อกลุ่มไร่', width: '220px', minWidth: '180px', resizable: true },
    {
      key: 'camp_count',
      header: 'จำนวนแคมป์',
      sortable: true,
      sortValue: (row) => row._count?.lands_camps ?? 0,
      render: (row) => <span className="font-mono">{row._count?.lands_camps ?? 0}</span>,
    },
  ]

  const landmapColumns: Column<Landmap>[] = [
    { key: 'landmap_id', header: 'ID', width: '60px' },
    { key: 'landmap_idCode', header: 'รหัสโฉนด' },
    { key: 'landmap_area_size', header: 'เนื้อที่', render: (row) => row.landmap_area_size?.toFixed(2) ?? '-' },
    { key: 'landmap_unit_prefix_id', header: 'คำนำหน้าหน่วย', render: (row) => row.landmap_unit_prefix_id ? unitPfxMap[row.landmap_unit_prefix_id] ?? row.landmap_unit_prefix_id : '-' },
    { key: 'landmap_unit_id', header: 'หน่วยนับ', render: (row) => row.landmap_unit_id ? unitMap[row.landmap_unit_id] ?? row.landmap_unit_id : '-' },
    { key: 'landmap_latitude', header: 'Lat', render: (row) => row.landmap_latitude?.toFixed(6) ?? '-' },
    { key: 'landmap_longitude', header: 'Lng', render: (row) => row.landmap_longitude?.toFixed(6) ?? '-' },
    { key: 'landmap_info', header: 'หมายเหตุ', width: '300px', minWidth: '220px', resizable: true, render: (row) => <ExpandableTextCell text={row.landmap_info} title="หมายเหตุโฉนด" className="text-surface-400" /> },
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
              land_camp_group_id: toNumber(field(data, 'land_camp_group_id')),
              land_camp_latitude: toNumber(field(data, 'land_camp_latitude')),
              land_camp_longitude: toNumber(field(data, 'land_camp_longitude')),
              land_camp_info: toStringValue(field(data, 'land_camp_info')),
            }
          : modal.type === 'camp-groups'
            ? {
                land_camp_group_idCode: toStringValue(field(data, 'land_camp_group_idCode')),
                land_camp_group_name: toStringValue(field(data, 'land_camp_group_name')),
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

  const selectedCampActionLabel = selectedGroupedCampCount > 0
    ? 'ย้ายกลุ่มไร่ให้รายการที่เลือก'
    : 'เพิ่มเข้ากลุ่มไร่ให้รายการที่เลือก'
  const canSubmitCampBulkUpdate = selectedCampIds.length > 0 && bulkCampGroupId != null && !bulkCampGroupMut.isPending

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

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-5"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      {tab === 'lands' && (camps.length > 0 || productYears.length > 0) && (
        <div className="card mb-5">
          <p className="text-xs font-medium text-surface-600 mb-3">ตัวกรองแปลงและกิจกรรม</p>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-surface-400">กรองตามแคมป์</p>
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
            <div>
              <label className="label">ปีการผลิตของกิจกรรม</label>
              <select className="select" value={activityProductYearFilter} onChange={(event) => setActivityProductYearFilter(event.target.value)}>
                <option value="">ทุกปี</option>
                {productYears.map((year) => (
                  <option key={year.act_productYear_id} value={year.act_productYear_id}>
                    {year.act_productYear_name ?? `#${year.act_productYear_id}`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-surface-500">มีผลกับคอลัมน์การดำเนินงานเท่านั้น</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'lands' && (
        <div className="card mb-5 border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                <MapPinned size={13} />
                จัดการตำบลหลายแปลง
              </div>
              <h2 className="mt-3 text-lg font-semibold text-surface-900">เปลี่ยน `subdistrict code` หลายแถวพร้อมกันจากหน้าแปลงที่ดิน</h2>
              <p className="mt-1 text-sm text-surface-600">
                ตอนนี้หน้า `พื้นที่เพาะปลูก` แก้ตำบลรายแถวได้อยู่แล้วจากปุ่มแก้ไข แต่ส่วนนี้เพิ่มมาเพื่อให้เลือกหลายแปลงแล้วอัปเดตตำบลพร้อมกันได้เลย
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[340px]">
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs text-surface-500">เลือกแล้ว</div>
                <div className="mt-1 text-2xl font-semibold text-surface-900">{selectedLandIds.length}</div>
                <div className="text-xs text-surface-500">แปลง</div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs text-surface-500">ในรายการที่กรอง</div>
                <div className="mt-1 text-2xl font-semibold text-surface-900">{filteredLands.length}</div>
                <div className="text-xs text-surface-500">{selectedCamp ? 'ภายใต้แคมป์ที่เลือก' : 'ทุกแปลงที่แสดงอยู่'}</div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div className="text-xs text-surface-500">เลือกจากรายการนี้</div>
                <div className="mt-1 text-2xl font-semibold text-surface-900">{filteredSelectionCount}</div>
                <div className="text-xs text-surface-500">แปลงในชุดกรองปัจจุบัน</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label">จังหวัดปลายทาง</label>
              <select
                className="select"
                value={bulkProvinceId ?? ''}
                onChange={(event) => {
                  const nextProvinceId = Number(event.target.value) || null
                  setBulkProvinceId(nextProvinceId)
                  setBulkDistrictId(null)
                  setBulkSubdistrictId(null)
                  setBulkError(null)
                }}
              >
                <option value="">- เลือกจังหวัด -</option>
                {provinces.map((province) => (
                  <option key={province.provinces_id} value={province.provinces_id}>
                    {province.name_th ?? `#${province.provinces_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">อำเภอปลายทาง</label>
              <select
                className="select"
                value={bulkDistrictId ?? ''}
                onChange={(event) => {
                  const nextDistrictId = Number(event.target.value) || null
                  setBulkDistrictId(nextDistrictId)
                  setBulkSubdistrictId(null)
                  setBulkError(null)
                }}
                disabled={bulkProvinceId == null}
              >
                <option value="">{bulkProvinceId == null ? '- เลือกจังหวัดก่อน -' : '- เลือกอำเภอ -'}</option>
                {bulkFilteredDistricts.map((district) => (
                  <option key={district.districts_id} value={district.districts_id}>
                    {district.name_th ?? `#${district.districts_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">ตำบลปลายทาง</label>
              <select
                className="select"
                value={bulkSubdistrictId ?? ''}
                onChange={(event) => {
                  setBulkSubdistrictId(Number(event.target.value) || null)
                  setBulkError(null)
                }}
                disabled={bulkDistrictId == null}
              >
                <option value="">{bulkDistrictId == null ? '- เลือกอำเภอก่อน -' : '- เลือกตำบล -'}</option>
                {bulkFilteredSubdistricts.map((subdistrict) => (
                  <option key={subdistrict.subdistricts_id} value={subdistrict.subdistricts_id}>
                    {subdistrict.name_th ?? '-'}{subdistrict.zip_code ? ` (${subdistrict.zip_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <ReadOnlyField
              name="bulk_zip_code_preview"
              label="รหัสไปรษณีย์"
              value={selectedBulkSubdistrict?.zip_code ?? ''}
              placeholder="เลือกตำบลเพื่อดูรหัสไปรษณีย์"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary btn-sm flex items-center gap-1" onClick={toggleFilteredLandSelection}>
              {areAllFilteredLandsSelected ? <Square size={13} /> : <CheckSquare size={13} />}
              {areAllFilteredLandsSelected ? 'ยกเลิกเลือกรายการที่กรองอยู่' : 'เลือกทั้งหมดในรายการที่กรองอยู่'}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={clearSelectedLands} disabled={selectedLandIds.length === 0}>
              ล้างรายการที่เลือก
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={selectedLandIds.length === 0 || bulkSubdistrictId == null || bulkSubdistrictMut.isPending}
              onClick={() => bulkSubdistrictMut.mutate()}
            >
              {bulkSubdistrictMut.isPending ? 'กำลังอัปเดตตำบล...' : 'อัปเดตตำบลให้แปลงที่เลือก'}
            </button>
          </div>

          {bulkError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {bulkError}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-surface-200 bg-white/80 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-surface-500">รายการที่เลือกอยู่</div>
            {selectedLands.length === 0 ? (
              <p className="mt-2 text-sm text-surface-500">ยังไม่ได้เลือกแปลงจากตารางด้านล่าง คุณสามารถติ๊ก checkbox หน้าแถว, คลิกทั้งแถวเพื่อเลือก, หรือใช้ปุ่มเลือกทั้งหมดในชุดที่กรองอยู่ได้</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedLands.slice(0, 8).map((land) => (
                  <span key={land.land_id} className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs text-surface-700">
                    {land.name || land.land_code || `แปลง #${land.land_id}`}
                  </span>
                ))}
                {selectedLands.length > 8 && (
                  <span className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs text-surface-500">
                    +{selectedLands.length - 8} แปลง
                  </span>
                )}
              </div>
            )}
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
            onRowClick={handleLandRowClick}
            searchPlaceholder="ค้นหารหัสแปลง, ชื่อ, จังหวัด, อำเภอ..."
            actions={landActions}
          />
        )}
        {tab === 'camps' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-surface-900">กลุ่มไร่</h2>
                  <p className="mt-1 text-xs text-surface-500">จัดกลุ่มแคมป์เป็นชุดใหญ่ขึ้น เช่น โซนดูแล กลุ่มพื้นที่ หรือทีมรับผิดชอบ</p>
                </div>
                <button type="button" className="btn-secondary btn-sm w-full justify-center sm:w-auto" onClick={() => setModal({ type: 'camp-groups' })}>
                  <Plus size={13} /> เพิ่มกลุ่มไร่
                </button>
              </div>
              <DataTable
                data={campGroups}
                columns={campGroupColumns}
                isLoading={cgLoad}
                rowKey={(row) => row.land_camp_group_id}
                searchPlaceholder="ค้นหารหัสกลุ่มไร่ หรือชื่อกลุ่มไร่..."
                emptyMessage="ยังไม่มีกลุ่มไร่"
                actions={actions<LandCampGroup>(
                  (row) => openEdit({ type: 'camp-groups', row }),
                  (row) => setDeleteTarget({ type: 'camp-groups', id: row.land_camp_group_id, name: row.land_camp_group_name || row.land_camp_group_idCode || `#${row.land_camp_group_id}` }),
                )}
              />
            </div>

            <div>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-surface-900">แคมป์</h2>
                  <p className="mt-1 text-xs text-surface-500">คัดดูแคมป์ที่ยังไม่มีกลุ่มหรือมีกลุ่มแล้ว และเลือกหลายรายการเพื่อเพิ่มเข้ากลุ่มหรือย้ายกลุ่มพร้อมกัน</p>
                </div>
                <button type="button" className="btn-secondary btn-sm w-full justify-center sm:w-auto" onClick={() => setModal({ type: 'camps' })}>
                  <Plus size={13} /> เพิ่มแคมป์
                </button>
              </div>
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-4">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-surface-500">คัดตามสถานะกลุ่ม</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm rounded-full ${campGroupFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCampGroupFilter('all')}
                      >
                        ทั้งหมด ({camps.length})
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm rounded-full ${campGroupFilter === 'ungrouped' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCampGroupFilter('ungrouped')}
                      >
                        ยังไม่มีกลุ่ม ({ungroupedCampsCount})
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm rounded-full ${campGroupFilter === 'grouped' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCampGroupFilter('grouped')}
                      >
                        มีกลุ่มแล้ว ({groupedCampsCount})
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <label className="label">กรองตามกลุ่มไร่</label>
                        <select
                          className="select"
                          value={campGroupIdFilter}
                          onChange={(event) => setCampGroupIdFilter(event.target.value)}
                        >
                          <option value="">ทุกกลุ่มไร่</option>
                          {campGroups.map((group) => (
                            <option key={group.land_camp_group_id} value={group.land_camp_group_id}>
                              {group.land_camp_group_name || group.land_camp_group_idCode || `#${group.land_camp_group_id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn-secondary btn-sm w-full justify-center lg:w-auto"
                          onClick={() => {
                            setCampGroupFilter('all')
                            setCampGroupIdFilter('')
                          }}
                          disabled={campGroupFilter === 'all' && !campGroupIdFilter}
                        >
                          ล้าง filter แคมป์
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                        <div className="text-xs text-surface-500">เลือกอยู่</div>
                        <div className="mt-1 text-2xl font-semibold text-surface-900">{selectedCampIds.length}</div>
                        <div className="text-xs text-surface-500">แคมป์</div>
                      </div>
                      <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                        <div className="text-xs text-surface-500">ในรายการที่คัดอยู่</div>
                        <div className="mt-1 text-2xl font-semibold text-surface-900">{filteredCamps.length}</div>
                        <div className="text-xs text-surface-500">แคมป์ที่กำลังแสดง</div>
                      </div>
                      <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                        <div className="text-xs text-surface-500">เลือกจากรายการนี้</div>
                        <div className="mt-1 text-2xl font-semibold text-surface-900">{filteredCampSelectionCount}</div>
                        <div className="text-xs text-surface-500">แคมป์ในชุดคัดปัจจุบัน</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-surface-500">เพิ่มเข้ากลุ่ม / ย้ายกลุ่ม</div>
                    <div className="mt-3">
                      <label className="label">กลุ่มไร่ปลายทาง</label>
                      <select
                        className="select"
                        value={bulkCampGroupId ?? ''}
                        onChange={(event) => {
                          setBulkCampGroupId(Number(event.target.value) || null)
                          setCampBulkError(null)
                        }}
                      >
                        <option value="">- เลือกกลุ่มไร่ -</option>
                        {campGroups.map((group) => (
                          <option key={group.land_camp_group_id} value={group.land_camp_group_id}>
                            {group.land_camp_group_name || group.land_camp_group_idCode || `#${group.land_camp_group_id}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 text-xs text-surface-500">
                      เลือกแคมป์ที่ยังไม่มีกลุ่มเพื่อเพิ่มเข้ากลุ่ม หรือเลือกแคมป์ที่มีกลุ่มแล้วเพื่อย้ายไปกลุ่มใหม่
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button type="button" className="btn-secondary btn-sm flex items-center gap-1" onClick={toggleFilteredCampSelection}>
                        {areAllFilteredCampsSelected ? <Square size={13} /> : <CheckSquare size={13} />}
                        {areAllFilteredCampsSelected ? 'ยกเลิกเลือกรายการที่คัดอยู่' : 'เลือกทั้งหมดในรายการที่คัดอยู่'}
                      </button>
                      <button type="button" className="btn-secondary btn-sm" onClick={clearSelectedCamps} disabled={selectedCampIds.length === 0}>
                        ล้างรายการที่เลือก
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={!canSubmitCampBulkUpdate}
                        onClick={() => bulkCampGroupMut.mutate()}
                      >
                        {bulkCampGroupMut.isPending ? 'กำลังอัปเดตกลุ่มไร่...' : selectedCampActionLabel}
                      </button>
                    </div>
                  </div>
                </div>

                {campBulkError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {campBulkError}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-surface-200 bg-white/80 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-surface-500">รายการแคมป์ที่เลือกอยู่</div>
                  {selectedCamps.length === 0 ? (
                    <p className="mt-2 text-sm text-surface-500">ยังไม่ได้เลือกแคมป์จากตารางด้านล่าง คุณสามารถติ๊ก checkbox หน้าแถว คลิกที่แถวเพื่อเลือก หรือใช้ปุ่มเลือกทั้งหมดในรายการที่คัดอยู่ได้</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCamps.slice(0, 8).map((camp) => (
                        <span key={camp.land_camp_id} className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs text-surface-700">
                          {camp.land_camp_name || camp.land_camp_idCode || `แคมป์ #${camp.land_camp_id}`}
                          <span className="ml-2 text-surface-400">
                            {camp.land_camp_group_id
                              ? camp.lands_camps_groups?.land_camp_group_name ?? campGroupMap[camp.land_camp_group_id] ?? `#${camp.land_camp_group_id}`
                              : 'ยังไม่มีกลุ่ม'}
                          </span>
                        </span>
                      ))}
                      {selectedCamps.length > 8 && (
                        <span className="inline-flex items-center rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs text-surface-500">
                          +{selectedCamps.length - 8} แคมป์
                        </span>
                      )}
                    </div>
                  )}
                  {selectedCamps.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-surface-500">
                      <span>ยังไม่มีกลุ่ม {selectedUngroupedCampCount} แคมป์</span>
                      <span>มีกลุ่มแล้ว {selectedGroupedCampCount} แคมป์</span>
                    </div>
                  )}
                </div>
              </div>
              <DataTable
                data={filteredCamps}
                columns={campColumns}
                isLoading={cLoad}
                rowKey={(row) => row.land_camp_id}
                onRowClick={handleCampRowClick}
                searchPlaceholder="ค้นหารหัสแคมป์ ชื่อแคมป์ หรือชื่อกลุ่มไร่..."
                emptyMessage={campGroupFilter === 'ungrouped' ? 'ยังไม่มีแคมป์ที่ยังไม่มีกลุ่ม' : campGroupFilter === 'grouped' ? 'ยังไม่มีแคมป์ที่มีกลุ่มแล้ว' : 'ยังไม่มีข้อมูลแคมป์'}
                actions={actions<LandCamp>(
                  (row) => openEdit({ type: 'camps', row }),
                  (row) => setDeleteTarget({ type: 'camps', id: row.land_camp_id, name: row.land_camp_name || row.land_camp_idCode || `#${row.land_camp_id}` }),
                )}
              />
            </div>
          </div>
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
            className={`relative bg-white rounded-2xl shadow-card-lg p-6 w-full ${modal.type === 'lands' ? 'max-w-6xl' : modal.type === 'camp-groups' ? 'max-w-xl' : 'max-w-3xl'} max-h-[90vh] overflow-y-auto animate-slide-up`}
          >
            <h3 className="font-semibold mb-5">
              {modal.row ? 'แก้ไข' : 'เพิ่ม'} {modal.type === 'lands' ? 'แปลงที่ดิน' : modal.type === 'camps' ? 'แคมป์' : modal.type === 'camp-groups' ? 'กลุ่มไร่' : 'โฉนด'}
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
            {modal.type === 'camps' && <CampForm row={modal.row} campGroups={campGroups} />}
            {modal.type === 'camp-groups' && <CampGroupForm row={modal.row} />}
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

function CampForm({ row, campGroups }: { row?: LandCamp; campGroups: LandCampGroup[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <TextField name="land_camp_idCode" label="รหัสแคมป์" defaultValue={row?.land_camp_idCode} />
      <TextField name="land_camp_name" label="ชื่อแคมป์" defaultValue={row?.land_camp_name} />
      <SelectField
        name="land_camp_group_id"
        label="กลุ่มไร่"
        defaultValue={row?.land_camp_group_id}
        options={campGroups.map((group) => ({ value: group.land_camp_group_id, label: group.land_camp_group_name || group.land_camp_group_idCode || `#${group.land_camp_group_id}` }))}
      />
      <NumberField name="land_camp_latitude" label="Latitude" defaultValue={row?.land_camp_latitude} step="0.00000001" />
      <NumberField name="land_camp_longitude" label="Longitude" defaultValue={row?.land_camp_longitude} step="0.00000001" />
      <div className="md:col-span-2">
        <label className="label">หมายเหตุ</label>
        <textarea name="land_camp_info" className="input" rows={3} defaultValue={row?.land_camp_info ?? ''} />
      </div>
    </div>
  )
}

function CampGroupForm({ row }: { row?: LandCampGroup }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <TextField name="land_camp_group_idCode" label="รหัสกลุ่มไร่" defaultValue={row?.land_camp_group_idCode} />
      <TextField name="land_camp_group_name" label="ชื่อกลุ่มไร่" defaultValue={row?.land_camp_group_name} />
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
