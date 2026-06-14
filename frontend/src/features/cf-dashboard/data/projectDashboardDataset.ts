import type {
  ActivityValue,
  CampCarbonSummary,
  CampFieldCarbonDetail,
  CaneTypeSummary,
  DashboardDataset,
  FieldCarbonDetail,
  ProcessActivityBreakdown,
  ProcessEmission,
  ProcessInputComparison,
  SpatialLevel,
  SpatialSummaryNode,
  TrendPoint,
} from "../types/dashboard";
import { getSpatialProjectGeo, normalizeProjectCampName } from "./spatialProjectGeoMappings";
import { spatialProjectPlots, type ProjectFarmGroup, type SpatialProjectPlot } from "./spatialProjectPlots";

const PROJECT_CURRENT_YEAR = "2566/67";
const BASELINE_YEARS = ["2563/64", "2564/65", "2565/66"];
const PROJECT_ROOT_ID = "thailand";
const UNKNOWN_GEO = "-";

const PROCESS_STEPS = [
  "1. การเตรียมดินและปลูก",
  "2. การใช้ปุ๋ย",
  "3. การให้น้ำและกำจัดวัชพืช",
  "4. การเก็บเกี่ยว",
];

const PROCESS_SHARES = [0.18, 0.26, 0.35, 0.21];
const REDUCTION_BANDS = [-0.08, 0.02, 0.04, 0.07, 0.1, 0.13, 0.16, 0.19, 0.23, 0.28];
const INPUT_FACTORS = [
  { fertilizer: 8, fertilizerSaving: 0.11, fuel: 3.4, fuelSaving: 0.15 },
  { fertilizer: 16, fertilizerSaving: 0.14, fuel: 2.6, fuelSaving: 0.13 },
  { fertilizer: 22, fertilizerSaving: 0.16, fuel: 1.6, fuelSaving: 0.08 },
  { fertilizer: 0, fertilizerSaving: 0, fuel: 4.2, fuelSaving: 0.17 },
];

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function slug(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) % 1000000007;
  }
  return hash.toString(36);
}

function stableIndex(key: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 33) + key.charCodeAt(index)) % 1000003;
  }
  return hash % modulo;
}

function stableCampId(campName: string, farmGroup: ProjectFarmGroup) {
  return 100000 + stableIndex(`${farmGroup}:${campName}`, 900000);
}

function reductionPct(plot: SpatialProjectPlot, campName: string) {
  const farmShift = plot.farmGroup === "dan-chang" ? 1 : 0;
  return REDUCTION_BANDS[(stableIndex(`${plot.plotCode}:${campName}`, REDUCTION_BANDS.length) + farmShift) % REDUCTION_BANDS.length];
}

function utmToLatLng(easting: number, northing: number, farmGroup: ProjectFarmGroup) {
  const zone = farmGroup === "isan" && easting < 300000 ? 48 : 47;
  const a = 6378137;
  const e = 0.081819191;
  const e1sq = 0.006739497;
  const k0 = 0.9996;
  const x = easting - 500000;
  const y = northing;
  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const m = y / k0;
  const mu = m / (a * (1 - (e ** 2) / 4 - (3 * e ** 4) / 64 - (5 * e ** 6) / 256));
  const e1 = (1 - Math.sqrt(1 - e ** 2)) / (1 + Math.sqrt(1 - e ** 2));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const n1 = a / Math.sqrt(1 - e ** 2 * Math.sin(phi1) ** 2);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = e1sq * Math.cos(phi1) ** 2;
  const r1 = a * (1 - e ** 2) / ((1 - e ** 2 * Math.sin(phi1) ** 2) ** 1.5);
  const d = x / (n1 * k0);
  const lat = phi1 - (n1 * Math.tan(phi1) / r1) * (
    d ** 2 / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * e1sq) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * e1sq - 3 * c1 ** 2) * d ** 6 / 720
  );
  const lng = longOrigin + (
    d
    - (1 + 2 * t1 + c1) * d ** 3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * e1sq + 24 * t1 ** 2) * d ** 5 / 120
  ) / Math.cos(phi1) * (180 / Math.PI);
  return { lat: lat * (180 / Math.PI), lng };
}

function processBreakdown(totalEmission: number): ActivityValue[] {
  return PROCESS_STEPS.map((name, index) => ({
    name,
    emission: round(totalEmission * PROCESS_SHARES[index]),
  }));
}

function inputComparisons(areaRai: number): ProcessInputComparison[] {
  return PROCESS_STEPS.map((process, index) => {
    const input = INPUT_FACTORS[index];
    const baselineFertilizerKg = areaRai * input.fertilizer;
    const baselineFuelLiter = areaRai * input.fuel;
    return {
      process,
      baselineFertilizerKg: round(baselineFertilizerKg, 1),
      currentFertilizerKg: round(baselineFertilizerKg * (1 - input.fertilizerSaving), 1),
      baselineFuelLiter: round(baselineFuelLiter, 1),
      currentFuelLiter: round(baselineFuelLiter * (1 - input.fuelSaving), 1),
    };
  });
}

function aggregateInputs(rows: ProcessInputComparison[][]): ProcessInputComparison[] {
  const grouped = new Map<string, ProcessInputComparison>();
  rows.flat().forEach((row) => {
    const current = grouped.get(row.process) ?? {
      process: row.process,
      baselineFertilizerKg: 0,
      currentFertilizerKg: 0,
      baselineFuelLiter: 0,
      currentFuelLiter: 0,
    };
    grouped.set(row.process, {
      process: row.process,
      baselineFertilizerKg: current.baselineFertilizerKg + row.baselineFertilizerKg,
      currentFertilizerKg: current.currentFertilizerKg + row.currentFertilizerKg,
      baselineFuelLiter: current.baselineFuelLiter + row.baselineFuelLiter,
      currentFuelLiter: current.currentFuelLiter + row.currentFuelLiter,
    });
  });
  return Array.from(grouped.values()).map((row) => ({
    process: row.process,
    baselineFertilizerKg: round(row.baselineFertilizerKg, 1),
    currentFertilizerKg: round(row.currentFertilizerKg, 1),
    baselineFuelLiter: round(row.baselineFuelLiter, 1),
    currentFuelLiter: round(row.currentFuelLiter, 1),
  }));
}

function aggregateBreakdown(fields: CampFieldCarbonDetail[], key: "baselineEmission" | "currentEmission") {
  return PROCESS_STEPS.map((name, index) => ({
    name,
    emission: round(fields.reduce((sum, field) => sum + field[key] * PROCESS_SHARES[index], 0)),
  }));
}

function activityRows(year: string, fields: CampFieldCarbonDetail[], key: "baselineEmission" | "currentEmission"): ProcessActivityBreakdown[] {
  return PROCESS_STEPS.map((process, index) => {
    const totalEmission = fields.reduce((sum, field) => sum + field[key] * PROCESS_SHARES[index], 0);
    return {
      year,
      process,
      totalEmission: round(totalEmission),
      activities: [{ name: process, emission: round(totalEmission) }],
    };
  });
}

function meanCoord(fields: CampFieldCarbonDetail[], key: "lat" | "lng") {
  return fields.reduce((sum, field) => sum + field[key], 0) / Math.max(fields.length, 1);
}

function farmLabel(farmGroup: ProjectFarmGroup) {
  return spatialProjectPlots.find((plot) => plot.farmGroup === farmGroup)?.farmGroupName ?? farmGroup;
}

function nodeId(level: SpatialLevel, parentId: string, value: string) {
  return `${level}-${slug(`${parentId}:${value}`)}`;
}

function buildField(plot: SpatialProjectPlot): CampFieldCarbonDetail {
  const campName = normalizeProjectCampName(plot.campName);
  const geo = getSpatialProjectGeo(plot.campName);
  const coords = utmToLatLng(plot.x, plot.y, plot.farmGroup);
  const baselineEmission = round(plot.projectAreaRai * (0.08 + (plot.sequence % 9) * 0.006));
  const currentEmission = round(baselineEmission * (1 - reductionPct(plot, campName)));
  const regionId = plot.farmGroup;
  const provinceId = geo.province !== UNKNOWN_GEO ? nodeId("province", regionId, geo.province) : regionId;
  const districtId = geo.district !== UNKNOWN_GEO ? nodeId("district", provinceId, geo.district) : provinceId;
  const subdistrictId = geo.subdistrict !== UNKNOWN_GEO ? nodeId("subdistrict", districtId, geo.subdistrict) : districtId;

  return {
    id: `project-${plot.plotCode.toLowerCase()}`,
    parentId: subdistrictId,
    level: "field",
    name: `${plot.plotCode} - ${campName}`,
    lat: coords.lat,
    lng: coords.lng,
    zoom: 15,
    fields: 1,
    farmers: 1,
    areaRai: plot.projectAreaRai,
    baselineEmission,
    currentEmission,
    processBreakdown: processBreakdown(currentEmission),
    processInputComparisons: inputComparisons(plot.projectAreaRai),
    childrenIds: [],
    fieldCode: plot.plotCode,
    fieldName: `${plot.plotCode} - ${campName}`,
    farmerName: "-",
    phone: "-",
    province: geo.province,
    district: geo.district,
    subdistrict: geo.subdistrict,
    soilType: plot.soilType,
    irrigationType: "-",
    chanots: [],
    campId: stableCampId(campName, plot.farmGroup),
    campName,
    activitiesLogged: PROCESS_STEPS,
    co2eTotal: currentEmission,
  };
}

function summarizeNode(id: string, parentId: string | undefined, level: SpatialLevel, name: string, fields: CampFieldCarbonDetail[], zoom: number): SpatialSummaryNode {
  const areaRai = fields.reduce((sum, field) => sum + field.areaRai, 0);
  const baselineEmission = fields.reduce((sum, field) => sum + field.baselineEmission, 0);
  const currentEmission = fields.reduce((sum, field) => sum + field.currentEmission, 0);
  return {
    id,
    parentId,
    level,
    name,
    lat: meanCoord(fields, "lat"),
    lng: meanCoord(fields, "lng"),
    zoom,
    fields: fields.length,
    farmers: Math.max(Math.round(fields.length * 0.7), 1),
    areaRai: round(areaRai),
    baselineEmission: round(baselineEmission),
    currentEmission: round(currentEmission),
    processBreakdown: processBreakdown(currentEmission),
    processInputComparisons: aggregateInputs(fields.map((field) => field.processInputComparisons ?? [])),
    childrenIds: [],
  };
}

function addNode(nodes: Map<string, SpatialSummaryNode>, node: SpatialSummaryNode) {
  nodes.set(node.id, node);
  if (node.parentId) {
    const parent = nodes.get(node.parentId);
    if (parent && !parent.childrenIds.includes(node.id)) parent.childrenIds.push(node.id);
  }
}

function buildSpatialNodes(fields: CampFieldCarbonDetail[]) {
  const nodes = new Map<string, SpatialSummaryNode>();
  addNode(nodes, summarizeNode(PROJECT_ROOT_ID, undefined, "country", "ประเทศไทย", fields, 6));

  (["dan-chang", "isan"] as ProjectFarmGroup[]).forEach((farmGroup) => {
    const groupFields = fields.filter((field) => {
      const plot = spatialProjectPlots.find((item) => `project-${item.plotCode.toLowerCase()}` === field.id);
      return plot?.farmGroup === farmGroup;
    });
    addNode(nodes, summarizeNode(farmGroup, PROJECT_ROOT_ID, "region", farmLabel(farmGroup), groupFields, 7));

    const provinceNames = Array.from(new Set(groupFields.map((field) => field.province).filter((value) => value !== UNKNOWN_GEO)));
    provinceNames.forEach((province) => {
      const provinceFields = groupFields.filter((field) => field.province === province);
      const provinceId = nodeId("province", farmGroup, province);
      addNode(nodes, summarizeNode(provinceId, farmGroup, "province", province, provinceFields, 9));

      const districtNames = Array.from(new Set(provinceFields.map((field) => field.district).filter((value) => value !== UNKNOWN_GEO)));
      districtNames.forEach((district) => {
        const districtFields = provinceFields.filter((field) => field.district === district);
        const districtId = nodeId("district", provinceId, district);
        addNode(nodes, summarizeNode(districtId, provinceId, "district", district, districtFields, 11));

        const subdistrictNames = Array.from(new Set(districtFields.map((field) => field.subdistrict).filter((value) => value !== UNKNOWN_GEO)));
        subdistrictNames.forEach((subdistrict) => {
          const subdistrictFields = districtFields.filter((field) => field.subdistrict === subdistrict);
          const subdistrictId = nodeId("subdistrict", districtId, subdistrict);
          addNode(nodes, summarizeNode(subdistrictId, districtId, "subdistrict", subdistrict, subdistrictFields, 13));
        });
      });
    });
  });

  buildCampSummaryFields(fields).forEach((field) => addNode(nodes, field));
  fields.forEach((field) => addNode(nodes, field));
  return Array.from(nodes.values());
}

function buildCampSummaryFields(fields: CampFieldCarbonDetail[]): CampFieldCarbonDetail[] {
  const grouped = new Map<number, CampFieldCarbonDetail[]>();
  fields.forEach((field) => grouped.set(field.campId, [...(grouped.get(field.campId) ?? []), field]));

  return Array.from(grouped.entries()).map(([campId, campFields]) => {
    const areaRai = campFields.reduce((sum, field) => sum + field.areaRai, 0);
    const baselineEmission = campFields.reduce((sum, field) => sum + field.baselineEmission, 0);
    const currentEmission = campFields.reduce((sum, field) => sum + field.currentEmission, 0);
    const campName = campFields[0]?.campName ?? "-";
    return {
      id: `camp-${campId}-all`,
      parentId: campFields[0]?.parentId,
      level: "field",
      name: `ภาพรวมแคมป์ ${campName}`,
      lat: meanCoord(campFields, "lat"),
      lng: meanCoord(campFields, "lng"),
      zoom: 13,
      fields: campFields.length,
      farmers: Math.max(Math.round(campFields.length * 0.7), 1),
      areaRai: round(areaRai),
      baselineEmission: round(baselineEmission),
      currentEmission: round(currentEmission),
      processBreakdown: processBreakdown(currentEmission),
      processInputComparisons: aggregateInputs(campFields.map((field) => field.processInputComparisons ?? [])),
      childrenIds: [],
      fieldCode: `CAMP-${campId}`,
      fieldName: `ภาพรวมแคมป์ ${campName}`,
      farmerName: "หลายราย",
      phone: "-",
      province: campFields[0]?.province ?? UNKNOWN_GEO,
      district: campFields[0]?.district ?? UNKNOWN_GEO,
      subdistrict: campFields[0]?.subdistrict ?? UNKNOWN_GEO,
      soilType: "หลายประเภท",
      irrigationType: "-",
      chanots: [],
      campId,
      campName,
      activitiesLogged: PROCESS_STEPS,
      co2eTotal: round(currentEmission),
    };
  });
}

function buildCampSummaries(fields: CampFieldCarbonDetail[]): CampCarbonSummary[] {
  const grouped = new Map<number, CampFieldCarbonDetail[]>();
  fields.forEach((field) => grouped.set(field.campId, [...(grouped.get(field.campId) ?? []), field]));

  return Array.from(grouped.entries()).map(([campId, campFields]) => {
    const areaRai = campFields.reduce((sum, field) => sum + field.areaRai, 0);
    const baselineCo2eTotal = campFields.reduce((sum, field) => sum + field.baselineEmission, 0);
    const currentCo2eTotal = campFields.reduce((sum, field) => sum + field.currentEmission, 0);
    const currentActivityBreakdown = aggregateBreakdown(campFields, "currentEmission");
    return {
      campId,
      campName: campFields[0]?.campName ?? "-",
      fieldCount: campFields.length,
      areaRai: round(areaRai),
      baselineCo2eTotal: round(baselineCo2eTotal),
      currentCo2eTotal: round(currentCo2eTotal),
      co2eTotal: round(currentCo2eTotal),
      co2ePerRai: areaRai ? round(currentCo2eTotal / areaRai, 4) : 0,
      topActivity: [...currentActivityBreakdown].sort((a, b) => b.emission - a.emission)[0]?.name ?? "-",
      baselineActivityBreakdown: aggregateBreakdown(campFields, "baselineEmission"),
      currentActivityBreakdown,
      baselineProcessActivities: activityRows("baseline_avg", campFields, "baselineEmission"),
      currentProcessActivities: activityRows(PROJECT_CURRENT_YEAR, campFields, "currentEmission"),
      processInputComparisons: aggregateInputs(campFields.map((field) => field.processInputComparisons ?? [])),
    };
  }).sort((a, b) => a.campName.localeCompare(b.campName, "th"));
}

function buildProcessEmissions(fields: CampFieldCarbonDetail[]): ProcessEmission[] {
  const baselineRows = PROCESS_STEPS.map((process, index) => ({
    year: "baseline_avg",
    process,
    emission: round(fields.reduce((sum, field) => sum + field.baselineEmission * PROCESS_SHARES[index], 0)),
    isBaseline: true,
  }));
  const yearlyBaselineRows = BASELINE_YEARS.flatMap((year, yearIndex) => PROCESS_STEPS.map((process, index) => ({
    year,
    process,
    emission: round(baselineRows[index].emission * [0.96, 1.03, 1.01][yearIndex]),
    isBaseline: true,
  })));
  const currentRows = PROCESS_STEPS.map((process, index) => ({
    year: PROJECT_CURRENT_YEAR,
    process,
    emission: round(fields.reduce((sum, field) => sum + field.currentEmission * PROCESS_SHARES[index], 0)),
    isBaseline: false,
  }));
  return [...baselineRows, ...yearlyBaselineRows, ...currentRows];
}

function buildTrend(fields: CampFieldCarbonDetail[]): TrendPoint[] {
  const baselineAverage = fields.reduce((sum, field) => sum + field.baselineEmission, 0);
  const currentEmission = fields.reduce((sum, field) => sum + field.currentEmission, 0);
  return [
    ...BASELINE_YEARS.map((year, index) => ({
      year,
      emission: round(baselineAverage * [0.96, 1.03, 1.01][index]),
      baselineAverage: round(baselineAverage),
      isBaseline: true,
    })),
    { year: PROJECT_CURRENT_YEAR, emission: round(currentEmission), baselineAverage: round(baselineAverage), isBaseline: false },
  ];
}

function buildCaneTypes(totalArea: number, currentEmission: number): CaneTypeSummary[] {
  const shares = [
    { name: "อ้อยปลูก", percent: 45 },
    { name: "อ้อยตอ", percent: 43 },
    { name: "พื้นที่พักดิน", percent: 12 },
  ];
  return shares.map((item) => ({
    ...item,
    areaRai: round(totalArea * item.percent / 100, 1),
    co2eTotal: round(currentEmission * item.percent / 100),
  }));
}

const projectFields = spatialProjectPlots.map(buildField);
const projectCampSummaries = buildCampSummaries(projectFields);
const projectProcessEmissions = buildProcessEmissions(projectFields);
const projectTrend = buildTrend(projectFields);
const projectProcessActivities = [
  ...activityRows("baseline_avg", projectFields, "baselineEmission"),
  ...activityRows(PROJECT_CURRENT_YEAR, projectFields, "currentEmission"),
];
const projectProcessInputComparisons = aggregateInputs(projectFields.map((field) => field.processInputComparisons ?? []));
const projectSpatialNodes = buildSpatialNodes(projectFields);
const totalAreaRai = projectFields.reduce((sum, field) => sum + field.areaRai, 0);
const baselineAvgEmission = projectFields.reduce((sum, field) => sum + field.baselineEmission, 0);
const currentEmission = projectFields.reduce((sum, field) => sum + field.currentEmission, 0);
const fertilizerAmountKg = projectProcessInputComparisons.reduce((sum, row) => sum + row.currentFertilizerKg, 0);
const fertilizerEmission = fertilizerAmountKg * 0.00245;
const machineEmission = projectProcessInputComparisons.reduce((sum, row) => sum + row.currentFuelLiter, 0) * 0.00268;
const yieldTon = totalAreaRai * 0.06;

export const projectDashboardDataset: DashboardDataset = {
  kpi: {
    baselineAvgEmission: round(baselineAvgEmission),
    currentEmission: round(currentEmission),
    currentYear: PROJECT_CURRENT_YEAR,
    machineEmission: round(machineEmission),
    inputEmission: round(fertilizerEmission + machineEmission),
    fertilizerAmountKg: round(fertilizerAmountKg, 1),
    fertilizerEmission: round(fertilizerEmission),
    areaRai: round(totalAreaRai),
    yieldTon: round(yieldTon, 1),
    co2ePerTon: yieldTon ? round(currentEmission / yieldTon) : 0,
    farmers: Math.max(Math.round(projectFields.length * 0.7), 1),
    fields: projectFields.length,
    years: [...BASELINE_YEARS, PROJECT_CURRENT_YEAR],
    baselineYears: BASELINE_YEARS,
  },
  trend: projectTrend,
  processEmissions: projectProcessEmissions,
  processActivities: projectProcessActivities,
  processInputComparisons: projectProcessInputComparisons,
  transportActivities: [],
  caneTypeSummaries: buildCaneTypes(totalAreaRai, currentEmission),
  spatialNodes: projectSpatialNodes,
  fields: projectFields as FieldCarbonDetail[],
  campSummaries: projectCampSummaries,
  campFields: projectFields,
};
