import { type FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, Column, ExpandableTextCell } from '@/components/ui/DataTable'
import { del, get, post, put } from '@/lib/api'
import { ChevronDown, ChevronUp, FlaskConical, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'

interface ResourceType {
  resource_used_type_id: number
  resc_used_type_name?: string | null
  resc_used_type_info?: string | null
}

interface Fertilizer {
  act_fertilizer_id: number
  act_fertilizer_name?: string | null
  act_fertilizer_info?: string | null
  resource_used_type_id?: number | null
  resource_used_type?: {
    resc_used_type_name?: string | null
  }
}

interface Equipment {
  act_equipment_id: number
  act_equipment_name?: string | null
  act_equipment_info?: string | null
  resource_used_type_id?: number | null
  resource_used_type?: {
    resc_used_type_name?: string | null
  }
}

interface Chemical {
  act_chemiscal_id: number
  act_chemiscal_name?: string | null
  act_chemiscal_info?: string | null
  resource_used_type_id?: number | null
  resource_used_type?: {
    resc_used_type_name?: string | null
  }
}

interface ResourceOther {
  act_resourceOther_id: number
  act_resourceOther_name?: string | null
  act_resourceOther_info?: string | null
  resource_used_type_id?: number | null
  resource_used_type?: {
    resc_used_type_name?: string | null
  }
}

type ResourceSectionKey = 'fertilizers' | 'equipments' | 'chemicals' | 'resourceOthers'
type VisibleButtonKey = ResourceSectionKey | 'resourceTypes'
type ResourceCategory = 'fertilizer' | 'equipment' | 'chemical' | 'resourceOther'

type ResourceTypePayload = {
  resc_used_type_name: string
  resc_used_type_info?: string
}

type FertilizerPayload = {
  act_fertilizer_name: string
  act_fertilizer_info?: string
  resource_used_type_id?: number
}

type EquipmentPayload = {
  act_equipment_name: string
  act_equipment_info?: string
  resource_used_type_id?: number
}

type ChemicalPayload = {
  act_chemiscal_name: string
  act_chemiscal_info?: string
  resource_used_type_id?: number
}

type ResourceOtherPayload = {
  act_resourceOther_name: string
  act_resourceOther_info?: string
  resource_used_type_id?: number
}

type ResourceRow = {
  key: string
  category: ResourceCategory
  resourceId: number
  name: string
  info: string
  resourceUsedTypeName: string
  source: Fertilizer | Equipment | Chemical | ResourceOther
}

type DeleteTarget =
  | { type: 'resource-type'; id: number; name: string }
  | { type: 'fertilizer'; id: number; name: string }
  | { type: 'equipment'; id: number; name: string }
  | { type: 'chemical'; id: number; name: string }
  | { type: 'resource-other'; id: number; name: string }

type ResourceTypeFormState = {
  resc_used_type_name: string
  resc_used_type_info: string
}

const RESOURCE_PAGE_PREFS_KEY = 'activity-resources-page-prefs'
const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  fertilizer: 'ปุ๋ย',
  equipment: 'น้ำมัน',
  chemical: 'สารเคมี',
  resourceOther: 'รายการอื่น ๆ',
}

const ADD_RESOURCE_DESTINATIONS: { value: ResourceCategory; label: string }[] = [
  { value: 'chemical', label: 'chemical' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'resourceOther', label: 'otherSource' },
]

const readStoredPreferences = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(RESOURCE_PAGE_PREFS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      visibleButtons?: Partial<Record<VisibleButtonKey, boolean>>
      visibleResourceTypeFilters?: Record<string, boolean>
    }
  } catch {
    return null
  }
}

export function ActivityResourcesPage() {
  const qc = useQueryClient()
  const [activeResourceTypeFilter, setActiveResourceTypeFilter] = useState<number | 'all'>('all')
  const [showResourceTypeSection, setShowResourceTypeSection] = useState(false)
  const [showButtonConfigModal, setShowButtonConfigModal] = useState(false)
  const [showAddResourceModal, setShowAddResourceModal] = useState(false)
  const [addResourceFormError, setAddResourceFormError] = useState('')
  const [showResourceTypeModal, setShowResourceTypeModal] = useState(false)
  const [showFertilizerModal, setShowFertilizerModal] = useState(false)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [showChemicalModal, setShowChemicalModal] = useState(false)
  const [showResourceOtherModal, setShowResourceOtherModal] = useState(false)
  const [editingResourceType, setEditingResourceType] = useState<ResourceType | null>(null)
  const [editingFertilizer, setEditingFertilizer] = useState<Fertilizer | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [editingChemical, setEditingChemical] = useState<Chemical | null>(null)
  const [editingResourceOther, setEditingResourceOther] = useState<ResourceOther | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [resourceTypeForm, setResourceTypeForm] = useState<ResourceTypeFormState>({
    resc_used_type_name: '',
    resc_used_type_info: '',
  })
  const [visibleButtons, setVisibleButtons] = useState<Record<VisibleButtonKey, boolean>>(() => {
    const prefs = readStoredPreferences()
    return {
      fertilizers: prefs?.visibleButtons?.fertilizers ?? true,
      equipments: prefs?.visibleButtons?.equipments ?? true,
      chemicals: prefs?.visibleButtons?.chemicals ?? true,
      resourceOthers: prefs?.visibleButtons?.resourceOthers ?? true,
      resourceTypes: prefs?.visibleButtons?.resourceTypes ?? false,
    }
  })
  const [visibleResourceTypeFilters, setVisibleResourceTypeFilters] = useState<Record<number, boolean>>(() => {
    const prefs = readStoredPreferences()
    if (!prefs?.visibleResourceTypeFilters) return {}

    return Object.fromEntries(
      Object.entries(prefs.visibleResourceTypeFilters).map(([key, value]) => [Number(key), value]),
    )
  })

  const { data: fertilizers = [], isLoading: fertilizersLoading, error: fertilizersError } = useQuery({
    queryKey: ['activity-resource-fertilizers'],
    queryFn: () => get<Fertilizer[]>('/activities/fertilizers'),
  })

  const { data: equipments = [], isLoading: equipmentsLoading, error: equipmentsError } = useQuery({
    queryKey: ['activity-resource-equipments'],
    queryFn: () => get<Equipment[]>('/activities/equipments'),
  })

  const { data: chemicals = [], isLoading: chemicalsLoading, error: chemicalsError } = useQuery({
    queryKey: ['activity-resource-chemicals'],
    queryFn: () => get<Chemical[]>('/activities/chemicals'),
  })

  const { data: resourceOthers = [], isLoading: resourceOthersLoading, error: resourceOthersError } = useQuery({
    queryKey: ['activity-resource-others'],
    queryFn: () => get<ResourceOther[]>('/activities/resource-others'),
  })

  const { data: resourceTypes = [], isLoading: resourceTypesLoading, error: resourceTypesError } = useQuery({
    queryKey: ['activity-resource-types'],
    queryFn: () => get<ResourceType[]>('/activities/resource-types'),
  })

  const pageQueryItems = [
    { label: 'ปุ๋ย', error: fertilizersError },
    { label: 'น้ำมัน', error: equipmentsError },
    { label: 'สารเคมี', error: chemicalsError },
    { label: 'รายการอื่น ๆ', error: resourceOthersError },
    { label: 'ประเภทปัจจัย', error: resourceTypesError },
  ]

  const saveResourceTypeMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ResourceTypePayload }) =>
      id ? put<ResourceType>(`/activities/resource-types/${id}`, payload) : post<ResourceType>('/activities/resource-types', payload),
    onSuccess: (saved) => {
      qc.setQueryData<ResourceType[]>(['activity-resource-types'], (current = []) => {
        const next = [...current]
        const existingIndex = next.findIndex((item) => item.resource_used_type_id === saved.resource_used_type_id)

        if (existingIndex >= 0) {
          next[existingIndex] = saved
        } else {
          next.push(saved)
        }

        return next.sort((left, right) => left.resource_used_type_id - right.resource_used_type_id)
      })

      setVisibleButtons((prev) => ({ ...prev, resourceTypes: true }))
      setShowResourceTypeSection(true)
      setVisibleResourceTypeFilters((prev) => ({
        ...prev,
        [saved.resource_used_type_id]: true,
      }))
      qc.invalidateQueries({ queryKey: ['activity-resource-types'] })
      setShowResourceTypeModal(false)
      setEditingResourceType(null)
      setResourceTypeForm({
        resc_used_type_name: '',
        resc_used_type_info: '',
      })
    },
  })

  const saveFertilizerMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: FertilizerPayload }) =>
      id ? put<Fertilizer>(`/activities/fertilizers/${id}`, payload) : post<Fertilizer>('/activities/fertilizers', payload),
    onSuccess: (saved) => {
      qc.setQueryData<Fertilizer[]>(['activity-resource-fertilizers'], (current = []) => {
        const next = [...current]
        const existingIndex = next.findIndex((item) => item.act_fertilizer_id === saved.act_fertilizer_id)

        if (existingIndex >= 0) {
          next[existingIndex] = saved
        } else {
          next.push(saved)
        }

        return next.sort((left, right) => left.act_fertilizer_id - right.act_fertilizer_id)
      })

      qc.invalidateQueries({ queryKey: ['activity-resource-fertilizers'] })
      qc.invalidateQueries({ queryKey: ['activity-resource-types'] })
      setShowAddResourceModal(false)
      setShowFertilizerModal(false)
      setEditingFertilizer(null)
    },
  })

  const saveEquipmentMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: EquipmentPayload }) =>
      id ? put<Equipment>(`/activities/equipments/${id}`, payload) : post<Equipment>('/activities/equipments', payload),
    onSuccess: (saved) => {
      qc.setQueryData<Equipment[]>(['activity-resource-equipments'], (current = []) => {
        const next = [...current]
        const existingIndex = next.findIndex((item) => item.act_equipment_id === saved.act_equipment_id)

        if (existingIndex >= 0) {
          next[existingIndex] = saved
        } else {
          next.push(saved)
        }

        return next.sort((left, right) => left.act_equipment_id - right.act_equipment_id)
      })

      qc.invalidateQueries({ queryKey: ['activity-resource-equipments'] })
      qc.invalidateQueries({ queryKey: ['activity-resource-types'] })
      setShowAddResourceModal(false)
      setShowEquipmentModal(false)
      setEditingEquipment(null)
    },
  })

  const saveChemicalMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ChemicalPayload }) =>
      id ? put<Chemical>(`/activities/chemicals/${id}`, payload) : post<Chemical>('/activities/chemicals', payload),
    onSuccess: (saved) => {
      qc.setQueryData<Chemical[]>(['activity-resource-chemicals'], (current = []) => {
        const next = [...current]
        const existingIndex = next.findIndex((item) => item.act_chemiscal_id === saved.act_chemiscal_id)

        if (existingIndex >= 0) {
          next[existingIndex] = saved
        } else {
          next.push(saved)
        }

        return next.sort((left, right) => left.act_chemiscal_id - right.act_chemiscal_id)
      })

      qc.invalidateQueries({ queryKey: ['activity-resource-chemicals'] })
      qc.invalidateQueries({ queryKey: ['activity-resource-types'] })
      setShowAddResourceModal(false)
      setShowChemicalModal(false)
      setEditingChemical(null)
    },
  })

  const saveResourceOtherMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: ResourceOtherPayload }) =>
      id ? put<ResourceOther>(`/activities/resource-others/${id}`, payload) : post<ResourceOther>('/activities/resource-others', payload),
    onSuccess: (saved) => {
      qc.setQueryData<ResourceOther[]>(['activity-resource-others'], (current = []) => {
        const next = [...current]
        const existingIndex = next.findIndex((item) => item.act_resourceOther_id === saved.act_resourceOther_id)

        if (existingIndex >= 0) {
          next[existingIndex] = saved
        } else {
          next.push(saved)
        }

        return next.sort((left, right) => left.act_resourceOther_id - right.act_resourceOther_id)
      })

      qc.invalidateQueries({ queryKey: ['activity-resource-others'] })
      qc.invalidateQueries({ queryKey: ['activity-resource-types'] })
      setShowAddResourceModal(false)
      setShowResourceOtherModal(false)
      setEditingResourceOther(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (target: DeleteTarget) => {
      if (target.type === 'resource-type') {
        return del(`/activities/resource-types/${target.id}`)
      }
      if (target.type === 'fertilizer') {
        return del(`/activities/fertilizers/${target.id}`)
      }
      if (target.type === 'chemical') {
        return del(`/activities/chemicals/${target.id}`)
      }
      if (target.type === 'resource-other') {
        return del(`/activities/resource-others/${target.id}`)
      }
      return del(`/activities/equipments/${target.id}`)
    },
    onSuccess: (_, target) => {
      if (target.type === 'resource-type') {
        qc.invalidateQueries({ queryKey: ['activity-resource-types'] })
        qc.invalidateQueries({ queryKey: ['activity-resource-fertilizers'] })
        qc.invalidateQueries({ queryKey: ['activity-resource-equipments'] })
        qc.invalidateQueries({ queryKey: ['activity-resource-chemicals'] })
        qc.invalidateQueries({ queryKey: ['activity-resource-others'] })
        setVisibleResourceTypeFilters((prev) => {
          const next = { ...prev }
          delete next[target.id]
          return next
        })
        if (activeResourceTypeFilter === target.id) {
          setActiveResourceTypeFilter('all')
        }
      } else if (target.type === 'fertilizer') {
        qc.invalidateQueries({ queryKey: ['activity-resource-fertilizers'] })
      } else if (target.type === 'chemical') {
        qc.invalidateQueries({ queryKey: ['activity-resource-chemicals'] })
      } else if (target.type === 'resource-other') {
        qc.invalidateQueries({ queryKey: ['activity-resource-others'] })
      } else {
        qc.invalidateQueries({ queryKey: ['activity-resource-equipments'] })
      }

      setDeleteTarget(null)
    },
  })

  const resourceTypeMap = Object.fromEntries(
    resourceTypes.map((item) => [item.resource_used_type_id, item.resc_used_type_name ?? '-']),
  )

  const resourceTypeCols: Column<ResourceType>[] = [
    { key: 'resource_used_type_id', header: 'ID', width: '80px', sortable: true },
    {
      key: 'resc_used_type_name',
      header: 'ชื่อประเภทปัจจัย',
      sortable: true,
      width: '220px',
      minWidth: '180px',
      resizable: true,
      render: (row) => row.resc_used_type_name?.trim() || '-',
    },
    {
      key: 'resc_used_type_info',
      header: 'ข้อมูลเพิ่มเติม',
      sortable: true,
      width: '300px',
      minWidth: '220px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.resc_used_type_info} title="ข้อมูลเพิ่มเติมประเภทปัจจัย" />,
    },
  ]

  const resourceCols: Column<ResourceRow>[] = [
    {
      key: 'name',
      header: 'ชื่อรายการ',
      sortable: true,
      width: '240px',
      minWidth: '180px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.name} title="ชื่อรายการ" previewChars={72} />,
    },
    {
      key: 'resourceUsedTypeName',
      header: 'ประเภทปัจจัย',
      sortable: true,
      render: (row) => {
        const tone = row.category === 'fertilizer'
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : row.category === 'equipment'
            ? 'bg-amber-50 text-amber-700 ring-amber-200'
            : row.category === 'chemical'
              ? 'bg-rose-50 text-rose-700 ring-rose-200'
              : 'bg-sky-50 text-sky-700 ring-sky-200'

        return row.resourceUsedTypeName && row.resourceUsedTypeName !== '-'
          ? (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tone}`}>
              {row.resourceUsedTypeName}
            </span>
            )
          : '-'
      },
    },
    {
      key: 'info',
      header: 'ข้อมูลเพิ่มเติม',
      sortable: true,
      width: '320px',
      minWidth: '220px',
      resizable: true,
      render: (row) => <ExpandableTextCell text={row.info} title="ข้อมูลเพิ่มเติมรายการปัจจัย" />,
    },
  ]

  const visibleResourceSectionCount = Number(visibleButtons.fertilizers)
    + Number(visibleButtons.equipments)
    + Number(visibleButtons.chemicals)
    + Number(visibleButtons.resourceOthers)
  const hasVisibleResourceSections = visibleResourceSectionCount > 0

  const defaultResourceTypeVisible = (item: ResourceType) => {
    const normalized = item.resc_used_type_name?.trim().toLowerCase() ?? ''
    if (!normalized) return false
    return /น้ำมัน|diesel|fuel|gas|gasoline|benzene|equipment|อุปกรณ์/.test(normalized)
      || /ปุ๋ย|fertilizer/.test(normalized)
      || /เคมี|chemical|chemiscal|สาร/.test(normalized)
      || /อื่น|other|พันธุ์|variety|sugarcane|อ้อย/.test(normalized)
  }

  useEffect(() => {
    const savedPrefs = readStoredPreferences()
    const hasSavedResourceFilters = Boolean(savedPrefs?.visibleResourceTypeFilters)

    setVisibleResourceTypeFilters((prev) => {
      const next: Record<number, boolean> = { ...prev }
      let changed = false
      const currentIds = new Set(resourceTypes.map((item) => item.resource_used_type_id))

      resourceTypes.forEach((item) => {
        if (next[item.resource_used_type_id] === undefined) {
          next[item.resource_used_type_id] = hasSavedResourceFilters ? true : defaultResourceTypeVisible(item)
          changed = true
        }
      })

      Object.keys(next).forEach((key) => {
        const id = Number(key)
        if (!currentIds.has(id)) {
          delete next[id]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [resourceTypes])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      RESOURCE_PAGE_PREFS_KEY,
      JSON.stringify({
        visibleButtons,
        visibleResourceTypeFilters,
      }),
    )
  }, [visibleButtons, visibleResourceTypeFilters])

  useEffect(() => {
    if (activeResourceTypeFilter === 'all') return
    if (!visibleResourceTypeFilters[activeResourceTypeFilter] || !hasVisibleResourceSections) {
      setActiveResourceTypeFilter('all')
    }
  }, [activeResourceTypeFilter, hasVisibleResourceSections, visibleResourceTypeFilters])

  const shownResourceTypeFilters = resourceTypes.filter(
    (item) => visibleResourceTypeFilters[item.resource_used_type_id] ?? false,
  )

  const filteredFertilizers = activeResourceTypeFilter === 'all'
    ? fertilizers
    : fertilizers.filter((row) => row.resource_used_type_id === activeResourceTypeFilter)

  const filteredEquipments = activeResourceTypeFilter === 'all'
    ? equipments
    : equipments.filter((row) => row.resource_used_type_id === activeResourceTypeFilter)

  const filteredChemicals = activeResourceTypeFilter === 'all'
    ? chemicals
    : chemicals.filter((row) => row.resource_used_type_id === activeResourceTypeFilter)

  const filteredResourceOthers = activeResourceTypeFilter === 'all'
    ? resourceOthers
    : resourceOthers.filter((row) => row.resource_used_type_id === activeResourceTypeFilter)

  const mergedResources: ResourceRow[] = [
    ...(visibleButtons.fertilizers
      ? filteredFertilizers.map((row) => ({
          key: `fertilizer-${row.act_fertilizer_id}`,
          category: 'fertilizer' as const,
          resourceId: row.act_fertilizer_id,
          name: row.act_fertilizer_name?.trim() || '-',
          info: row.act_fertilizer_info?.trim() || '',
          resourceUsedTypeName: row.resource_used_type?.resc_used_type_name ?? resourceTypeMap[row.resource_used_type_id ?? 0] ?? '-',
          source: row,
        }))
      : []),
    ...(visibleButtons.equipments
      ? filteredEquipments.map((row) => ({
          key: `equipment-${row.act_equipment_id}`,
          category: 'equipment' as const,
          resourceId: row.act_equipment_id,
          name: row.act_equipment_name?.trim() || '-',
          info: row.act_equipment_info?.trim() || '',
          resourceUsedTypeName: row.resource_used_type?.resc_used_type_name ?? resourceTypeMap[row.resource_used_type_id ?? 0] ?? '-',
          source: row,
        }))
      : []),
    ...(visibleButtons.chemicals
      ? filteredChemicals.map((row) => ({
          key: `chemical-${row.act_chemiscal_id}`,
          category: 'chemical' as const,
          resourceId: row.act_chemiscal_id,
          name: row.act_chemiscal_name?.trim() || '-',
          info: row.act_chemiscal_info?.trim() || '',
          resourceUsedTypeName: row.resource_used_type?.resc_used_type_name ?? resourceTypeMap[row.resource_used_type_id ?? 0] ?? '-',
          source: row,
        }))
      : []),
    ...(visibleButtons.resourceOthers
      ? filteredResourceOthers.map((row) => ({
          key: `resource-other-${row.act_resourceOther_id}`,
          category: 'resourceOther' as const,
          resourceId: row.act_resourceOther_id,
          name: row.act_resourceOther_name?.trim() || '-',
          info: row.act_resourceOther_info?.trim() || '',
          resourceUsedTypeName: row.resource_used_type?.resc_used_type_name ?? resourceTypeMap[row.resource_used_type_id ?? 0] ?? '-',
          source: row,
        }))
      : []),
  ]

  const closeResourceTypeModal = () => {
    setShowResourceTypeModal(false)
    setEditingResourceType(null)
    saveResourceTypeMut.reset()
  }

  const openCreateResourceTypeModal = () => {
    saveResourceTypeMut.reset()
    setEditingResourceType(null)
    setResourceTypeForm({
      resc_used_type_name: '',
      resc_used_type_info: '',
    })
    setShowResourceTypeSection(true)
    setShowResourceTypeModal(true)
  }

  const openEditResourceTypeModal = (row: ResourceType) => {
    saveResourceTypeMut.reset()
    setEditingResourceType(row)
    setResourceTypeForm({
      resc_used_type_name: row.resc_used_type_name?.trim() ?? '',
      resc_used_type_info: row.resc_used_type_info?.trim() ?? '',
    })
    setShowResourceTypeSection(true)
    setShowResourceTypeModal(true)
  }

  const closeFertilizerModal = () => {
    setShowFertilizerModal(false)
    setEditingFertilizer(null)
    saveFertilizerMut.reset()
  }

  const closeEquipmentModal = () => {
    setShowEquipmentModal(false)
    setEditingEquipment(null)
    saveEquipmentMut.reset()
  }

  const closeChemicalModal = () => {
    setShowChemicalModal(false)
    setEditingChemical(null)
    saveChemicalMut.reset()
  }

  const closeResourceOtherModal = () => {
    setShowResourceOtherModal(false)
    setEditingResourceOther(null)
    saveResourceOtherMut.reset()
  }

  const closeAddResourceModal = () => {
    setShowAddResourceModal(false)
    setAddResourceFormError('')
    saveFertilizerMut.reset()
    saveEquipmentMut.reset()
    saveChemicalMut.reset()
    saveResourceOtherMut.reset()
  }

  const openAddResourceModal = () => {
    setAddResourceFormError('')
    saveFertilizerMut.reset()
    saveEquipmentMut.reset()
    saveChemicalMut.reset()
    saveResourceOtherMut.reset()
    setShowAddResourceModal(true)
  }

  const closeDeleteDialog = () => {
    setDeleteTarget(null)
    deleteMut.reset()
  }

  const handleSaveResourceType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const resc_used_type_name = resourceTypeForm.resc_used_type_name.trim()
    const resc_used_type_info = resourceTypeForm.resc_used_type_info.trim()

    if (!resc_used_type_name) return

    saveResourceTypeMut.mutate({
      id: editingResourceType?.resource_used_type_id,
      payload: {
        resc_used_type_name,
        resc_used_type_info: resc_used_type_info || undefined,
      },
    })
  }

  const handleSaveFertilizer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const act_fertilizer_name = String(form.get('act_fertilizer_name') ?? '').trim()
    const act_fertilizer_info = String(form.get('act_fertilizer_info') ?? '').trim()
    const resource_used_type_id = Number(form.get('resource_used_type_id') ?? '')

    if (!act_fertilizer_name) return

    saveFertilizerMut.mutate({
      id: editingFertilizer?.act_fertilizer_id,
      payload: {
        act_fertilizer_name,
        act_fertilizer_info: act_fertilizer_info || undefined,
        resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
      },
    })
  }

  const handleSaveEquipment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const act_equipment_name = String(form.get('act_equipment_name') ?? '').trim()
    const act_equipment_info = String(form.get('act_equipment_info') ?? '').trim()
    const resource_used_type_id = Number(form.get('resource_used_type_id') ?? '')

    if (!act_equipment_name) return

    saveEquipmentMut.mutate({
      id: editingEquipment?.act_equipment_id,
      payload: {
        act_equipment_name,
        act_equipment_info: act_equipment_info || undefined,
        resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
      },
    })
  }

  const handleSaveResourceOther = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const act_resourceOther_name = String(form.get('act_resourceOther_name') ?? '').trim()
    const act_resourceOther_info = String(form.get('act_resourceOther_info') ?? '').trim()
    const resource_used_type_id = Number(form.get('resource_used_type_id') ?? '')

    if (!act_resourceOther_name) return

    saveResourceOtherMut.mutate({
      id: editingResourceOther?.act_resourceOther_id,
      payload: {
        act_resourceOther_name,
        act_resourceOther_info: act_resourceOther_info || undefined,
        resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
      },
    })
  }

  const handleSaveChemical = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const act_chemiscal_name = String(form.get('act_chemiscal_name') ?? '').trim()
    const act_chemiscal_info = String(form.get('act_chemiscal_info') ?? '').trim()
    const resource_used_type_id = Number(form.get('resource_used_type_id') ?? '')

    if (!act_chemiscal_name) return

    saveChemicalMut.mutate({
      id: editingChemical?.act_chemiscal_id,
      payload: {
        act_chemiscal_name,
        act_chemiscal_info: act_chemiscal_info || undefined,
        resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
      },
    })
  }

  const handleSaveAddResource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveFertilizerMut.reset()
    saveEquipmentMut.reset()
    saveChemicalMut.reset()
    saveResourceOtherMut.reset()
    const form = new FormData(event.currentTarget)
    const destination = String(form.get('resource_destination') ?? '').trim() as ResourceCategory
    const resource_used_type_id = Number(form.get('resource_used_type_id') ?? '')
    if (!destination) {
      setAddResourceFormError('กรุณาเลือกปลายทางรายการก่อนบันทึก')
      return
    }

    setAddResourceFormError('')
    if (destination === 'fertilizer') {
      const act_fertilizer_name = String(form.get('resource_name') ?? '').trim()
      const act_fertilizer_info = String(form.get('resource_info') ?? '').trim()
      if (!act_fertilizer_name) return

      saveFertilizerMut.mutate({
        payload: {
          act_fertilizer_name,
          act_fertilizer_info: act_fertilizer_info || undefined,
          resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
        },
      })
      return
    }

    if (destination === 'chemical') {
      const act_chemiscal_name = String(form.get('resource_name') ?? '').trim()
      const act_chemiscal_info = String(form.get('resource_info') ?? '').trim()
      if (!act_chemiscal_name) return

      saveChemicalMut.mutate({
        payload: {
          act_chemiscal_name,
          act_chemiscal_info: act_chemiscal_info || undefined,
          resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
        },
      })
      return
    }

    if (destination === 'resourceOther') {
      const act_resourceOther_name = String(form.get('resource_name') ?? '').trim()
      const act_resourceOther_info = String(form.get('resource_info') ?? '').trim()
      if (!act_resourceOther_name) return

      saveResourceOtherMut.mutate({
        payload: {
          act_resourceOther_name,
          act_resourceOther_info: act_resourceOther_info || undefined,
          resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
        },
      })
      return
    }

    const act_equipment_name = String(form.get('resource_name') ?? '').trim()
    const act_equipment_info = String(form.get('resource_info') ?? '').trim()
    if (!act_equipment_name) return

    saveEquipmentMut.mutate({
      payload: {
        act_equipment_name,
        act_equipment_info: act_equipment_info || undefined,
        resource_used_type_id: Number.isFinite(resource_used_type_id) && resource_used_type_id > 0 ? resource_used_type_id : undefined,
      },
    })
  }

  const openEditResourceRow = (row: ResourceRow) => {
    if (row.category === 'fertilizer') {
      saveFertilizerMut.reset()
      setEditingFertilizer(row.source as Fertilizer)
      setShowFertilizerModal(true)
      return
    }

    if (row.category === 'chemical') {
      saveChemicalMut.reset()
      setEditingChemical(row.source as Chemical)
      setShowChemicalModal(true)
      return
    }

    if (row.category === 'resourceOther') {
      saveResourceOtherMut.reset()
      setEditingResourceOther(row.source as ResourceOther)
      setShowResourceOtherModal(true)
      return
    }

    saveEquipmentMut.reset()
    setEditingEquipment(row.source as Equipment)
    setShowEquipmentModal(true)
  }

  const openDeleteResourceRow = (row: ResourceRow) => {
    deleteMut.reset()

    if (row.category === 'fertilizer') {
      setDeleteTarget({
        type: 'fertilizer',
        id: row.resourceId,
        name: row.name,
      })
      return
    }

    if (row.category === 'resourceOther') {
      setDeleteTarget({
        type: 'resource-other',
        id: row.resourceId,
        name: row.name,
      })
      return
    }

    if (row.category === 'chemical') {
      setDeleteTarget({
        type: 'chemical',
        id: row.resourceId,
        name: row.name,
      })
      return
    }

    setDeleteTarget({
      type: 'equipment',
      id: row.resourceId,
      name: row.name,
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FlaskConical size={20} className="text-primary-600" /> ปุ๋ย / น้ำมัน / สารเคมี / รายการอื่น ๆ
          </h1>
          <p className="page-subtitle">จัดการข้อมูลอ้างอิงสำหรับปุ๋ย น้ำมัน สารเคมี และรายการอื่น ๆ ที่ใช้ในหน้าบันทึกกิจกรรมและการนำเข้าข้อมูล</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {visibleButtons.resourceTypes && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => setShowResourceTypeSection((prev) => !prev)}
          >
            {showResourceTypeSection ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showResourceTypeSection ? 'ซ่อนประเภทปัจจัย' : 'แสดงประเภทปัจจัย'}
          </button>
        )}
        <button
          className="btn-ghost btn-sm"
          onClick={() => setShowButtonConfigModal(true)}
        >
          <Settings2 size={13} /> Edit ปุ่ม
        </button>
      </div>

      <DatabaseConnectionNotice
        items={pageQueryItems}
        className="mb-6"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      {visibleButtons.resourceTypes && showResourceTypeSection && (
        <div className="card mb-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-surface-800">รายการประเภทปัจจัย ({resourceTypes.length})</h2>
            <button
              className="btn-primary btn-sm"
              type="button"
              onClick={openCreateResourceTypeModal}
            >
              <Plus size={13} /> เพิ่มประเภทปัจจัย
            </button>
          </div>
          <DataTable
            data={resourceTypes}
            columns={resourceTypeCols}
            isLoading={resourceTypesLoading}
            rowKey={(row) => row.resource_used_type_id}
            defaultPageSize={10}
            searchPlaceholder="ค้นหาชื่อประเภทปัจจัย..."
            emptyMessage="ไม่พบข้อมูลประเภทปัจจัย"
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  className="btn-icon btn-ghost btn-sm"
                  type="button"
                  title="แก้ไขประเภทปัจจัย"
                  aria-label="แก้ไขประเภทปัจจัย"
                  onClick={() => openEditResourceTypeModal(row)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="btn-icon btn-ghost btn-sm text-red-500"
                  type="button"
                  title="ลบประเภทปัจจัย"
                  aria-label="ลบประเภทปัจจัย"
                  onClick={() => {
                    deleteMut.reset()
                    setDeleteTarget({
                      type: 'resource-type',
                      id: row.resource_used_type_id,
                      name: row.resc_used_type_name?.trim() || `ประเภท #${row.resource_used_type_id}`,
                    })
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          />
        </div>
      )}

      {hasVisibleResourceSections && shownResourceTypeFilters.length > 0 && (
        <div className="mb-5 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-surface-800">ตัวกรองประเภทปัจจัย</p>
            <p className="text-xs text-surface-500">รายการนี้ดึงจากฐานข้อมูล ประเภทรายการปัจจัย</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                activeResourceTypeFilter === 'all'
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:text-surface-800'
              }`}
              onClick={() => setActiveResourceTypeFilter('all')}
            >
              ทั้งหมด
            </button>
            {shownResourceTypeFilters.map((item) => (
              <button
                key={item.resource_used_type_id}
                className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                  activeResourceTypeFilter === item.resource_used_type_id
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:text-surface-800'
                }`}
                onClick={() => setActiveResourceTypeFilter(item.resource_used_type_id)}
              >
                {item.resc_used_type_name?.trim() || `ประเภท #${item.resource_used_type_id}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasVisibleResourceSections ? (
        <div className="card">
          <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 px-4 py-8 text-center text-sm text-surface-600">
            ยังไม่มีส่วนข้อมูลที่เปิดแสดงอยู่ กรุณากด <span className="font-medium text-surface-800">Edit ปุ่ม</span> เพื่อเลือกให้แสดง `ปุ๋ย`, `น้ำมัน`, `สารเคมี` หรือ `รายการอื่น ๆ`
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-surface-800">
              รายการปุ๋ย / น้ำมัน / สารเคมี / รายการอื่น ๆ ({mergedResources.length})
            </h2>
            <button
              className="btn-primary btn-sm"
              type="button"
              onClick={openAddResourceModal}
            >
              <Plus size={13} /> เพิ่มรายการ
            </button>
          </div>
          <DataTable
            data={mergedResources}
            columns={resourceCols}
            isLoading={fertilizersLoading || equipmentsLoading || chemicalsLoading || resourceOthersLoading}
            rowKey={(row) => row.key}
            defaultPageSize={10}
            searchPlaceholder="ค้นหาชื่อปุ๋ย ชื่อน้ำมัน ชื่อสารเคมี รายการอื่น ๆ หรือประเภทปัจจัย..."
            emptyMessage="ไม่พบข้อมูลปุ๋ย น้ำมัน สารเคมี หรือรายการอื่น ๆ"
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  className="btn-icon btn-ghost btn-sm"
                  type="button"
                  title={`แก้ไข${RESOURCE_CATEGORY_LABELS[row.category]}`}
                  aria-label={`แก้ไข${RESOURCE_CATEGORY_LABELS[row.category]}`}
                  onClick={() => openEditResourceRow(row)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="btn-icon btn-ghost btn-sm text-red-500"
                  type="button"
                  title={`ลบ${RESOURCE_CATEGORY_LABELS[row.category]}`}
                  aria-label={`ลบ${RESOURCE_CATEGORY_LABELS[row.category]}`}
                  onClick={() => openDeleteResourceRow(row)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          />
        </div>
      )}

      {showResourceTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeResourceTypeModal} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-5 font-semibold">{editingResourceType ? 'แก้ไขประเภทปัจจัย' : 'เพิ่มประเภทปัจจัย'}</h3>
            <form onSubmit={handleSaveResourceType}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อประเภทปัจจัย *</label>
                  <input
                    className="input"
                    name="resc_used_type_name"
                    required
                    value={resourceTypeForm.resc_used_type_name}
                    onChange={(event) => setResourceTypeForm((prev) => ({
                      ...prev,
                      resc_used_type_name: event.target.value,
                    }))}
                  />
                </div>
                <div>
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea
                    className="input min-h-24"
                    name="resc_used_type_info"
                    value={resourceTypeForm.resc_used_type_info}
                    onChange={(event) => setResourceTypeForm((prev) => ({
                      ...prev,
                      resc_used_type_info: event.target.value,
                    }))}
                  />
                </div>
              </div>
              {saveResourceTypeMut.isError && <p className="mt-3 text-sm text-red-600">{saveResourceTypeMut.error.message}</p>}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={closeResourceTypeModal}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saveResourceTypeMut.isPending}>
                  {saveResourceTypeMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showButtonConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowButtonConfigModal(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-card-lg">
            <div className="border-b border-surface-200 px-6 py-5">
              <h3 className="font-semibold">ตั้งค่าการแสดงปุ่มและตัวกรอง</h3>
              <p className="mt-2 text-sm text-surface-600">
                เลือกได้ว่าหน้านี้จะแสดงตัวกรองหรือส่วนข้อมูลไหนบ้าง เช่น ปุ๋ย, น้ำมัน, สารเคมี, รายการอื่น ๆ และประเภทปัจจัย
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3">
                  <span className="text-sm text-surface-700">แสดงตัวกรอง ปุ๋ย</span>
                  <input
                    type="checkbox"
                    checked={visibleButtons.fertilizers}
                    onChange={(event) => setVisibleButtons((prev) => ({ ...prev, fertilizers: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3">
                  <span className="text-sm text-surface-700">แสดงตัวกรอง น้ำมัน</span>
                  <input
                    type="checkbox"
                    checked={visibleButtons.equipments}
                    onChange={(event) => setVisibleButtons((prev) => ({ ...prev, equipments: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3">
                  <span className="text-sm text-surface-700">แสดงตัวกรอง สารเคมี</span>
                  <input
                    type="checkbox"
                    checked={visibleButtons.chemicals}
                    onChange={(event) => setVisibleButtons((prev) => ({ ...prev, chemicals: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3">
                  <span className="text-sm text-surface-700">แสดงตัวกรอง รายการอื่น ๆ</span>
                  <input
                    type="checkbox"
                    checked={visibleButtons.resourceOthers}
                    onChange={(event) => setVisibleButtons((prev) => ({ ...prev, resourceOthers: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3">
                  <span className="text-sm text-surface-700">แสดงปุ่ม ประเภทปัจจัย</span>
                  <input
                    type="checkbox"
                    checked={visibleButtons.resourceTypes}
                    onChange={(event) => setVisibleButtons((prev) => {
                      const next = { ...prev, resourceTypes: event.target.checked }
                      if (!event.target.checked) setShowResourceTypeSection(false)
                      return next
                    })}
                  />
                </label>
              </div>
              <div className="mt-5 border-t border-surface-200 pt-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-surface-800">ปุ่มตัวกรองประเภทปัจจัย</h4>
                    <p className="mt-1 text-xs text-surface-500">
                      แสดงรายการ `resource_used_type` จากฐานข้อมูล เพื่อเลือกว่าปุ่มตัวกรองใดจะแสดงบนหน้า
                    </p>
                  </div>
                  {resourceTypes.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm whitespace-nowrap"
                      onClick={() => {
                        setVisibleResourceTypeFilters(
                          Object.fromEntries(resourceTypes.map((item) => [item.resource_used_type_id, false])),
                        )
                        setActiveResourceTypeFilter('all')
                      }}
                    >
                      ล้างตัวเลือก
                    </button>
                  )}
                </div>
                {resourceTypesLoading ? (
                  <p className="text-sm text-surface-500">กำลังโหลดประเภทปัจจัย...</p>
                ) : resourceTypes.length === 0 ? (
                  <p className="text-sm text-surface-500">ยังไม่มีข้อมูลประเภทปัจจัยในฐานข้อมูล</p>
                ) : (
                  <div className="space-y-2">
                    {resourceTypes.map((item) => (
                      <label
                        key={item.resource_used_type_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm text-surface-700">
                            {item.resc_used_type_name?.trim() || `ประเภท #${item.resource_used_type_id}`}
                          </p>
                          {item.resc_used_type_info?.trim() && (
                            <p className="mt-1 text-xs text-surface-500">{item.resc_used_type_info.trim()}</p>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={visibleResourceTypeFilters[item.resource_used_type_id] ?? true} // false is for new types that haven't been configured yet, default to hide
                          // if true, show the filter button for this resource type; if false, hide the filter button
                          onChange={(event) => {
                            const checked = event.target.checked
                            setVisibleResourceTypeFilters((prev) => ({
                              ...prev,
                              [item.resource_used_type_id]: checked,
                            }))
                            if (!checked && activeResourceTypeFilter === item.resource_used_type_id) {
                              setActiveResourceTypeFilter('all')
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}

              </div>
            </div>
            <div className="border-t border-surface-200 px-6 py-4">
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowButtonConfigModal(false)}>ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeAddResourceModal} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-2 font-semibold">เพิ่มรายการ</h3>
            <p className="mb-5 text-sm text-surface-600">กรอกข้อมูลรายการใหม่ได้ทันทีจากฟอร์มนี้</p>
            <form onSubmit={handleSaveAddResource}>
              <div className="space-y-3">
                <div>
                  <label className="label">ปลายทางรายการ *</label>
                  <select className="select" name="resource_destination" defaultValue="" required>
                    <option value="">เลือกปลายทางที่จะบันทึก</option>
                    {ADD_RESOURCE_DESTINATIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">
                    ชื่อรายการ *
                  </label>
                  <input className="input" name="resource_name" required />
                </div>
                <div>
                  <label className="label">ประเภทปัจจัย{visibleResourceSectionCount > 1 ? ' *' : ''}</label>
                  <select
                    className="select"
                    name="resource_used_type_id"
                    defaultValue=""
                    required={visibleResourceSectionCount > 1}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {resourceTypes.map((item) => (
                      <option key={item.resource_used_type_id} value={item.resource_used_type_id}>
                        {item.resc_used_type_name ?? `#${item.resource_used_type_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea className="input min-h-24" name="resource_info" />
                </div>
              </div>
              {addResourceFormError && (
                <p className="mt-3 text-sm text-red-600">{addResourceFormError}</p>
              )}
              {saveFertilizerMut.isError && (
                <p className="mt-3 text-sm text-red-600">{saveFertilizerMut.error.message}</p>
              )}
              {saveEquipmentMut.isError && (
                <p className="mt-3 text-sm text-red-600">{saveEquipmentMut.error.message}</p>
              )}
              {saveChemicalMut.isError && (
                <p className="mt-3 text-sm text-red-600">{saveChemicalMut.error.message}</p>
              )}
              {saveResourceOtherMut.isError && (
                <p className="mt-3 text-sm text-red-600">{saveResourceOtherMut.error.message}</p>
              )}
              <div className="mt-5 flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeAddResourceModal}>ยกเลิก</button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saveFertilizerMut.isPending || saveEquipmentMut.isPending || saveChemicalMut.isPending || saveResourceOtherMut.isPending}
                >
                  {saveFertilizerMut.isPending || saveEquipmentMut.isPending || saveChemicalMut.isPending || saveResourceOtherMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFertilizerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeFertilizerModal} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-5 font-semibold">{editingFertilizer ? 'แก้ไขปุ๋ย' : 'เพิ่มปุ๋ย'}</h3>
            <form onSubmit={handleSaveFertilizer}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อปุ๋ย *</label>
                  <input className="input" name="act_fertilizer_name" required defaultValue={editingFertilizer?.act_fertilizer_name ?? ''} />
                </div>
                <div>
                  <label className="label">ประเภทปัจจัย</label>
                  <select className="select" name="resource_used_type_id" defaultValue={editingFertilizer?.resource_used_type_id ?? ''}>
                    <option value="">— ไม่ระบุ —</option>
                    {resourceTypes.map((item) => (
                      <option key={item.resource_used_type_id} value={item.resource_used_type_id}>
                        {item.resc_used_type_name ?? `#${item.resource_used_type_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea className="input min-h-24" name="act_fertilizer_info" defaultValue={editingFertilizer?.act_fertilizer_info ?? ''} />
                </div>
              </div>
              {saveFertilizerMut.isError && <p className="mt-3 text-sm text-red-600">{saveFertilizerMut.error.message}</p>}
              <div className="mt-5 flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeFertilizerModal}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveFertilizerMut.isPending}>
                  {saveFertilizerMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEquipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeEquipmentModal} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-5 font-semibold">{editingEquipment ? 'แก้ไขน้ำมัน' : 'เพิ่มน้ำมัน'}</h3>
            <form onSubmit={handleSaveEquipment}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อน้ำมัน *</label>
                  <input className="input" name="act_equipment_name" required defaultValue={editingEquipment?.act_equipment_name ?? ''} />
                </div>
                <div>
                  <label className="label">ประเภทปัจจัย</label>
                  <select className="select" name="resource_used_type_id" defaultValue={editingEquipment?.resource_used_type_id ?? ''}>
                    <option value="">— ไม่ระบุ —</option>
                    {resourceTypes.map((item) => (
                      <option key={item.resource_used_type_id} value={item.resource_used_type_id}>
                        {item.resc_used_type_name ?? `#${item.resource_used_type_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea className="input min-h-24" name="act_equipment_info" defaultValue={editingEquipment?.act_equipment_info ?? ''} />
                </div>
              </div>
              {saveEquipmentMut.isError && <p className="mt-3 text-sm text-red-600">{saveEquipmentMut.error.message}</p>}
              <div className="mt-5 flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeEquipmentModal}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveEquipmentMut.isPending}>
                  {saveEquipmentMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChemicalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeChemicalModal} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-5 font-semibold">{editingChemical ? 'แก้ไขสารเคมี' : 'เพิ่มสารเคมี'}</h3>
            <form onSubmit={handleSaveChemical}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อสารเคมี *</label>
                  <input className="input" name="act_chemiscal_name" required defaultValue={editingChemical?.act_chemiscal_name ?? ''} />
                </div>
                <div>
                  <label className="label">ประเภทปัจจัย</label>
                  <select className="select" name="resource_used_type_id" defaultValue={editingChemical?.resource_used_type_id ?? ''}>
                    <option value="">— ไม่ระบุ —</option>
                    {resourceTypes.map((item) => (
                      <option key={item.resource_used_type_id} value={item.resource_used_type_id}>
                        {item.resc_used_type_name ?? `#${item.resource_used_type_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea className="input min-h-24" name="act_chemiscal_info" defaultValue={editingChemical?.act_chemiscal_info ?? ''} />
                </div>
              </div>
              {saveChemicalMut.isError && <p className="mt-3 text-sm text-red-600">{saveChemicalMut.error.message}</p>}
              <div className="mt-5 flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeChemicalModal}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveChemicalMut.isPending}>
                  {saveChemicalMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResourceOtherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeResourceOtherModal} />
          <div className="relative w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="mb-5 font-semibold">{editingResourceOther ? 'แก้ไขรายการอื่น ๆ' : 'เพิ่มรายการอื่น ๆ'}</h3>
            <form onSubmit={handleSaveResourceOther}>
              <div className="space-y-3">
                <div>
                  <label className="label">ชื่อรายการ *</label>
                  <input
                    className="input"
                    name="act_resourceOther_name"
                    required
                    defaultValue={editingResourceOther?.act_resourceOther_name ?? ''}
                  />
                </div>
                <div>
                  <label className="label">ประเภทปัจจัย</label>
                  <select className="select" name="resource_used_type_id" defaultValue={editingResourceOther?.resource_used_type_id ?? ''}>
                    <option value="">— ไม่ระบุ —</option>
                    {resourceTypes.map((item) => (
                      <option key={item.resource_used_type_id} value={item.resource_used_type_id}>
                        {item.resc_used_type_name ?? `#${item.resource_used_type_id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ข้อมูลเพิ่มเติม</label>
                  <textarea
                    className="input min-h-24"
                    name="act_resourceOther_info"
                    defaultValue={editingResourceOther?.act_resourceOther_info ?? ''}
                  />
                </div>
              </div>
              {saveResourceOtherMut.isError && <p className="mt-3 text-sm text-red-600">{saveResourceOtherMut.error.message}</p>}
              <div className="mt-5 flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeResourceOtherModal}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={saveResourceOtherMut.isPending}>
                  {saveResourceOtherMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบข้อมูล"
        message={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่` : ''}
        errorMessage={deleteMut.isError ? deleteMut.error.message : undefined}
        confirmLabel="ลบข้อมูล"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMut.mutate(deleteTarget)
          }
        }}
        onCancel={closeDeleteDialog}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
