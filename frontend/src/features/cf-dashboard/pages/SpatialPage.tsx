import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { SourceBadge } from "../components/common/SourceBadge";
import { ThailandMap } from "../components/map/ThailandMap";
import { getSpatialProjectGeo, normalizeProjectCampName } from "../data/spatialProjectGeoMappings";
import { spatialProjectPlots, type SpatialProjectPlot } from "../data/spatialProjectPlots";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCfSpatialNodes, getOverviewKpi } from "../services/dashboardApi";
import type { CampCarbonSummary, CampFieldCarbonDetail, DataResult, FieldCarbonDetail, ProcessInputComparison, SpatialLevel, SpatialSummaryNode } from "../types/dashboard";
import { MapPinned } from "lucide-react";
import "../cf-dashboard.css";

type SpatialPreviewTab = "pdf" | "excel";

interface SpatialExcelRows {
  campRows: Record<string, unknown>[];
  provinceRows: Record<string, unknown>[];
  plotRows: Record<string, unknown>[];
}

function isField(node?: SpatialSummaryNode): node is FieldCarbonDetail {
  return node?.level === "field";
}

function sumInputs(inputs: ProcessInputComparison[]) {
  return inputs.reduce(
    (sum, item) => ({
      baselineFertilizerKg: sum.baselineFertilizerKg + item.baselineFertilizerKg,
      currentFertilizerKg: sum.currentFertilizerKg + item.currentFertilizerKg,
      baselineFuelLiter: sum.baselineFuelLiter + item.baselineFuelLiter,
      currentFuelLiter: sum.currentFuelLiter + item.currentFuelLiter,
    }),
    { baselineFertilizerKg: 0, currentFertilizerKg: 0, baselineFuelLiter: 0, currentFuelLiter: 0 },
  );
}

function inputPct(base: number, current: number) {
  return base ? ((base - current) / base) * 100 : 0;
}

function hasInputComparisonRows(rows?: ProcessInputComparison[]) {
  return Boolean(rows?.some((row) =>
    row.baselineFertilizerKg > 0
    || row.currentFertilizerKg > 0
    || row.baselineFuelLiter > 0
    || row.currentFuelLiter > 0,
  ));
}

const spatialOrder: Exclude<SpatialLevel, "country">[] = ["region", "province", "district", "subdistrict", "field"];
const knownGeoValue = (value?: string) => Boolean(value && value !== "-");
const MAP_FIELD_RENDER_LIMIT = 160;
const MAP_CAMP_FIELD_RENDER_LIMIT = 220;
const SPATIAL_DOC_ROWS_PER_PAGE = 10;
const projectProcessLabels = [
  "1. การเตรียมดินและปลูก",
  "2. การใช้ปุ๋ย",
  "3. การให้น้ำและกำจัดวัชพืช",
  "4. การเก็บเกี่ยว",
];
const projectProcessShares = [0.18, 0.26, 0.35, 0.21];
const projectReductionBands = [-0.08, 0.02, 0.04, 0.07, 0.1, 0.13, 0.16, 0.19, 0.23, 0.28];
const farmGroupFilterOptions = [
  { value: "dan-chang", label: "ไร่ด่านช้าง" },
  { value: "isan", label: "ไร่อีสาน" },
] as const;

function projectPlotId(plotCode: string) {
  return `project-${plotCode.toLowerCase()}`;
}

function projectCampId(campName: string, farmGroup: string) {
  const key = `${farmGroup}:${campName}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 31) + key.charCodeAt(index)) % 900000;
  }
  return 100000 + hash;
}

function projectStableIndex(key: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 33) + key.charCodeAt(index)) % 1000003;
  }
  return hash % modulo;
}

function projectReductionPct(plot: SpatialProjectPlot, campName: string) {
  const baseIndex = projectStableIndex(`${plot.plotCode}:${campName}`, projectReductionBands.length);
  const farmShift = plot.farmGroup === "dan-chang" ? 1 : 0;
  return projectReductionBands[(baseIndex + farmShift) % projectReductionBands.length];
}

function utmToLatLng(easting: number, northing: number, farmGroup: string) {
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

function projectPlotToField(plot: SpatialProjectPlot): CampFieldCarbonDetail {
  const campName = normalizeProjectCampName(plot.campName);
  const geo = getSpatialProjectGeo(plot.campName);
  const { lat, lng } = utmToLatLng(plot.x, plot.y, plot.farmGroup);
  const baselineEmission = Number((plot.projectAreaRai * (0.08 + (plot.sequence % 9) * 0.006)).toFixed(2));
  const reductionFactor = projectReductionPct(plot, campName);
  const currentEmission = Number((baselineEmission * (1 - reductionFactor)).toFixed(2));
  const processBreakdown = projectProcessLabels.map((name, index) => ({
    name,
    emission: Number((currentEmission * projectProcessShares[index]).toFixed(2)),
  }));
  const processInputComparisons = projectProcessLabels.map((process, index) => ({
    process,
    baselineFertilizerKg: Number((plot.projectAreaRai * [8, 16, 22, 0][index]).toFixed(1)),
    currentFertilizerKg: Number((plot.projectAreaRai * [7.1, 14.4, 18.8, 0][index]).toFixed(1)),
    baselineFuelLiter: Number((plot.projectAreaRai * [3.4, 2.6, 1.6, 4.2][index]).toFixed(1)),
    currentFuelLiter: Number((plot.projectAreaRai * [2.9, 2.2, 1.5, 3.5][index]).toFixed(1)),
  }));
  return {
    id: projectPlotId(plot.plotCode),
    parentId: plot.farmGroup,
    level: "field",
    name: `${plot.plotCode} - ${campName}`,
    lat,
    lng,
    zoom: 15,
    fields: 1,
    farmers: 1,
    areaRai: plot.projectAreaRai,
    baselineEmission,
    currentEmission,
    processBreakdown,
    processInputComparisons,
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
    campId: projectCampId(campName, plot.farmGroup),
    campName,
    activitiesLogged: ["เตรียมดินและปลูก", "ใช้ปุ๋ย", "ให้น้ำ/กำจัดวัชพืช", "เก็บเกี่ยว"],
    co2eTotal: currentEmission,
  };
}

function summarizeProjectCamps(fields: CampFieldCarbonDetail[]): CampCarbonSummary[] {
  const grouped = new Map<number, CampFieldCarbonDetail[]>();
  fields.forEach((field) => grouped.set(field.campId, [...(grouped.get(field.campId) ?? []), field]));
  return Array.from(grouped.entries()).map(([campId, campFields]) => {
    const baseline = campFields.reduce((sum, field) => sum + field.baselineEmission, 0);
    const current = campFields.reduce((sum, field) => sum + field.currentEmission, 0);
    const area = campFields.reduce((sum, field) => sum + field.areaRai, 0);
    const currentBreakdown = aggregateProcessBreakdown(campFields);
    const baselineBreakdown = scaleProcessBreakdown(currentBreakdown, baseline);
    return {
      campId,
      campName: campFields[0]?.campName ?? "-",
      fieldCount: campFields.length,
      areaRai: Number(area.toFixed(2)),
      baselineCo2eTotal: Number(baseline.toFixed(2)),
      currentCo2eTotal: Number(current.toFixed(2)),
      co2eTotal: Number(current.toFixed(2)),
      co2ePerRai: area ? Number((current / area).toFixed(4)) : 0,
      topActivity: [...currentBreakdown].sort((a, b) => b.emission - a.emission)[0]?.name ?? "-",
      baselineActivityBreakdown: baselineBreakdown,
      currentActivityBreakdown: currentBreakdown,
      baselineProcessActivities: [],
      currentProcessActivities: [],
      processInputComparisons: aggregateInputs(campFields.map((field) => field.processInputComparisons ?? [])),
    };
  }).sort((a, b) => a.campName.localeCompare(b.campName, "th"));
}

function aggregateInputs(inputs: ProcessInputComparison[][]): ProcessInputComparison[] {
  const grouped = new Map<string, ProcessInputComparison>();
  inputs.flat().forEach((item) => {
    const current = grouped.get(item.process) ?? {
      process: item.process,
      baselineFertilizerKg: 0,
      currentFertilizerKg: 0,
      baselineFuelLiter: 0,
      currentFuelLiter: 0,
    };
    grouped.set(item.process, {
      process: item.process,
      baselineFertilizerKg: current.baselineFertilizerKg + item.baselineFertilizerKg,
      currentFertilizerKg: current.currentFertilizerKg + item.currentFertilizerKg,
      baselineFuelLiter: current.baselineFuelLiter + item.baselineFuelLiter,
      currentFuelLiter: current.currentFuelLiter + item.currentFuelLiter,
    });
  });
  return Array.from(grouped.values());
}

function aggregateProcessBreakdown(fields: CampFieldCarbonDetail[]) {
  const grouped = new Map<string, number>();
  fields.forEach((field) => {
    field.processBreakdown.forEach((item) => grouped.set(item.name, (grouped.get(item.name) ?? 0) + item.emission));
  });
  return Array.from(grouped.entries()).map(([name, emission]) => ({ name, emission }));
}

function scaleProcessBreakdown(rows: SpatialSummaryNode["processBreakdown"], targetTotal: number) {
  const total = rows.reduce((sum, item) => sum + item.emission, 0);
  if (!total) return rows;
  return rows.map((item) => ({
    name: item.name,
    emission: Number(((item.emission / total) * targetTotal).toFixed(2)),
  }));
}

function emptySpatialFilters(): Record<Exclude<SpatialLevel, "country">, string> {
  return { region: "", province: "", district: "", subdistrict: "", field: "" };
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function filtersFromNode(nodes: SpatialSummaryNode[], nodeId: string, rootId: string) {
  const next: Record<Exclude<SpatialLevel, "country">, string> = {
    region: "",
    province: "",
    district: "",
    subdistrict: "",
    field: "",
  };
  let cur = nodes.find((node) => node.id === nodeId);
  while (cur && cur.id !== rootId) {
    if (cur.level !== "country") next[cur.level] = cur.id;
    cur = cur.parentId ? nodes.find((node) => node.id === cur?.parentId) : undefined;
  }
  return next;
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function rowsForSheet<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows.length ? rows.map((row) => ({ ...row }) as Record<string, unknown>) : [{}];
}

function creditSummary(baseline: number, current: number) {
  const diff = baseline - current;
  const credit = Math.max(diff, 0);
  return {
    diff,
    credit,
    direction: diff >= 0 ? "ลดลง" : "เพิ่มขึ้น",
  };
}

function caneTypeForField(field: CampFieldCarbonDetail) {
  const record = field as CampFieldCarbonDetail & { caneType?: string; cane_type?: string; caneName?: string; cane_name?: string };
  return record.caneType ?? record.cane_type ?? record.caneName ?? record.cane_name ?? "-";
}

function buildSpatialExcelRows(fieldsForExport: CampFieldCarbonDetail[], campsForScope: CampCarbonSummary[]): SpatialExcelRows {
  const campsForExport = campsForScope.filter((camp) => fieldsForExport.some((field) => field.campId === camp.campId));
  const campRows = campsForExport.map((camp) => {
    const campFields = fieldsForExport.filter((field) => field.campId === camp.campId);
    const province = Array.from(new Set(campFields.map((field) => field.province).filter(Boolean))).join(", ") || "-";
    const farmerCount = new Set(campFields.map((field) => field.farmerName).filter(Boolean)).size;
    const campBaseline = campFields.reduce((sum, field) => sum + field.baselineEmission, 0) || camp.baselineCo2eTotal;
    const campCurrent = campFields.reduce((sum, field) => sum + field.currentEmission, 0) || camp.currentCo2eTotal;
    return {
      "Camp Code": camp.campId,
      "Camp Name": camp.campName,
      Province: province,
      "Number of Plots": campFields.length || camp.fieldCount,
      "Number of Farmers": farmerCount,
      "Area (Rai)": Number((campFields.reduce((sum, field) => sum + field.areaRai, 0) || camp.areaRai).toFixed(2)),
      "Carbon Footprint (kgCO2e)": Number((campCurrent * 1000).toFixed(2)),
      "SOC (kgCO2e)": Number((Math.max(campBaseline - campCurrent, 0) * 0.35 * 1000).toFixed(2)),
      "Carbon Credit (kgCO2e)": Number((Math.max(campBaseline - campCurrent, 0) * 1000).toFixed(2)),
    };
  });

  const provinceMap = new Map<string, CampFieldCarbonDetail[]>();
  fieldsForExport.forEach((field) => {
    const province = field.province || "-";
    provinceMap.set(province, [...(provinceMap.get(province) ?? []), field]);
  });
  const provinceRows = Array.from(provinceMap.entries()).map(([province, fields]) => {
    const campIds = new Set(fields.map((field) => field.campId));
    const farmers = new Set(fields.map((field) => field.farmerName).filter(Boolean));
    const baseline = fields.reduce((sum, field) => sum + field.baselineEmission, 0);
    const current = fields.reduce((sum, field) => sum + field.currentEmission, 0);
    return {
      Province: province,
      "Number of Camps": campIds.size,
      "Number of Plots": fields.length,
      "Number of Farmers": farmers.size,
      "Area (Rai)": Number(fields.reduce((sum, field) => sum + field.areaRai, 0).toFixed(2)),
      "Carbon Footprint (kgCO2e)": Number((current * 1000).toFixed(2)),
      "SOC (kgCO2e)": Number((Math.max(baseline - current, 0) * 0.35 * 1000).toFixed(2)),
      "Carbon Credit (kgCO2e)": Number((Math.max(baseline - current, 0) * 1000).toFixed(2)),
    };
  });

  const plotRows = fieldsForExport.map((field) => {
    const reduction = field.baselineEmission - field.currentEmission;
    return {
      "Plot ID": field.fieldCode || field.id,
      Camp: field.campName,
      Province: field.province,
      Farmer: field.farmerName,
      "Area (Rai)": Number(field.areaRai.toFixed(2)),
      "Cane Type": caneTypeForField(field),
      "Baseline Emission (kgCO2e)": Number((field.baselineEmission * 1000).toFixed(2)),
      "Carbon Footprint (kgCO2e)": Number((field.currentEmission * 1000).toFixed(2)),
      "SOC (kgCO2e)": Number((Math.max(reduction, 0) * 0.35 * 1000).toFixed(2)),
      "Emission Reduction (kgCO2e)": Number((reduction * 1000).toFixed(2)),
      "Carbon Credit (kgCO2e)": Number((Math.max(reduction, 0) * 1000).toFixed(2)),
    };
  });

  return { campRows, provinceRows, plotRows };
}

function SpatialExcelPreview({ rows }: { rows: SpatialExcelRows }) {
  const sheets = [
    ["Camp Summary", rows.campRows],
    ["Province Summary", rows.provinceRows],
    ["Plot Detail", rows.plotRows],
  ] as const;

  return (
    <div className="excel-sheet-grid">
      {sheets.map(([title, sheetRows]) => {
        const previewRows = sheetRows.slice(0, 6);
        const columns = Object.keys(sheetRows[0] ?? {});
        return (
          <div key={title}>
            <h3>{title}</h3>
            <table className="report-table">
              <thead>
                <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${title}-${index}`}>
                    {columns.map((column) => <td key={`${title}-${index}-${column}`}>{String(row[column] ?? "-")}</td>)}
                  </tr>
                ))}
                {!previewRows.length && (
                  <tr><td colSpan={Math.max(columns.length, 1)}>No data for current filters</td></tr>
                )}
              </tbody>
            </table>
            {sheetRows.length > previewRows.length && <p className="muted export-preview-note">Showing first {previewRows.length} of {sheetRows.length} rows. Export Excel includes all filtered rows.</p>}
          </div>
        );
      })}
    </div>
  );
}

function fieldThumbnail(field: CampFieldCarbonDetail, index: number) {
  const shapes = [
    "polygon(12% 18%, 90% 24%, 78% 76%, 18% 84%)",
    "polygon(22% 12%, 86% 18%, 92% 66%, 14% 88%)",
    "polygon(18% 22%, 74% 10%, 90% 72%, 30% 88%)",
    "polygon(34% 8%, 78% 18%, 66% 90%, 16% 72%)",
  ];
  return (
    <div className="spatial-doc-map-thumb" aria-label={`ภาพลักษณะแปลง ${field.fieldCode}`}>
      <span style={{ clipPath: shapes[index % shapes.length] }} />
    </div>
  );
}

function SpatialDocument({ docInfo, fields }: { docInfo: { title: string; periodLabel: string; filterScope: string }; fields: CampFieldCarbonDetail[] }) {
  return (
    <div className="spatial-doc-paper">
      <div className="spatial-doc-header">
        <div className="spatial-doc-logo" style={{ display: "grid", alignContent: "center", justifyItems: "center" }}>
          <MapPinned size={32} strokeWidth={1.5} color="#333" />
        </div>
        <div>
          <strong>รายงานรายละเอียดการปล่อยและกักเก็บก๊าซเรือนกระจกรายแปลง</strong>
          <span>{docInfo.title}</span>
          <span style={{ color: "#666" }}>ข้อมูลโครงการประเมินคาร์บอนฟุตพริ้นท์ ไร่บริษัทกลุ่มมิตรผล</span>
        </div>
        <div style={{ textAlign: "right", borderRight: 0, paddingRight: "16px" }}>
          <strong>ปีดำเนินการ: {docInfo.periodLabel}</strong>
          <span>ขอบเขต: {docInfo.filterScope}</span>
          <span style={{ color: "#888", fontSize: "10px" }}>ออกรายงาน ณ {new Date().toLocaleDateString("th-TH")}</span>
        </div>
      </div>
      <table className="spatial-doc-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ชื่อแคมป์</th>
            <th>รหัสแปลง</th>
            <th>ชนิดดิน</th>
            <th>พื้นที่ (ไร่)</th>
            <th>Carbon Footprint<br/>(kgCO2e)</th>
            <th>SOC<br/>(kgCO2e)</th>
            <th>ภาพลักษณะแปลง</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => {
            const carbonFootprint = field.currentEmission * 1000;
            const soc = Math.max(field.baselineEmission - field.currentEmission, 0) * 0.35 * 1000;
            return (
              <tr key={`doc-${field.id}`}>
                <td>{index + 1}</td>
                <td>{field.campName}</td>
                <td>{field.fieldCode}</td>
                <td>{field.soilType || "-"}</td>
                <td>{formatNumber(field.areaRai, 2)}</td>
                <td>{formatNumber(carbonFootprint, 2)}</td>
                <td>{formatNumber(soc, 2)}</td>
                <td>{fieldThumbnail(field, index)}</td>
              </tr>
            );
          })}
          {!fields.length && (
            <tr><td colSpan={8}>ยังไม่มีข้อมูลแปลงในขอบเขตที่เลือก</td></tr>
          )}
        </tbody>
      </table>
      <div className="spatial-doc-footer">
        <span>องค์การบริหารจัดการก๊าซเรือนกระจก (องค์การมหาชน)</span>
        <span>Thailand Greenhouse Gas Management Organization (Public Organization)</span>
      </div>
    </div>
  );
}

const documentCss = `
  body { margin: 0; background: #fff; font-family: "Sarabun", "Tahoma", sans-serif; color: #222; }
  .spatial-doc-paper { width: 760px; padding: 22px 28px; background: #fff; font-size: 11px; }
  .spatial-doc-header { display: grid; grid-template-columns: 74px 1fr 200px; border: 1px solid #222; margin-bottom: 10px; }
  .spatial-doc-header > div { padding: 6px 8px; border-right: 1px solid #222; display: grid; gap: 3px; align-content: center; }
  .spatial-doc-header > div:last-child { border-right: 0; text-align: right; }
  .spatial-doc-logo { color: #b89119; font-weight: 800; text-align: center; line-height: 1.1; }
  .spatial-doc-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .spatial-doc-table th, .spatial-doc-table td { border: 1px solid #222; padding: 5px 4px; text-align: center; vertical-align: middle; }
  .spatial-doc-table th { font-weight: 700; background: #fafafa; }
  .spatial-doc-map-thumb { width: 86px; height: 58px; margin: 0 auto; position: relative; overflow: hidden; background: linear-gradient(135deg,#64745c,#b79b75 42%,#41543b 43%,#a98966 68%,#5d6f52); }
  .spatial-doc-map-thumb span { position: absolute; inset: 9px 12px; display: block; background: #39ff14; border: 1px solid rgba(0,0,0,.35); }
  .spatial-doc-footer { display: grid; gap: 8px; margin-top: 30px; color: #555; font-size: 10px; }
`;

export function CfSpatialPage() {
  const spatialDocRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [selectedId, setSelectedId] = useState("thailand");
  const [spatialResult, setSpatialResult] = useState<DataResult<SpatialSummaryNode[]>>({ data: [], source: "mock" });
  const [campFieldResult, setCampFieldResult] = useState<DataResult<CampFieldCarbonDetail[]>>({ data: [], source: "mock" });
  const [selectedCampId, setSelectedCampId] = useState<number | "all">("all");
  const [selectedBoundaryFieldId, setSelectedBoundaryFieldId] = useState("");
  const [selectedProjectCampName, setSelectedProjectCampName] = useState("all");
  const [selectedProjectPlotCode, setSelectedProjectPlotCode] = useState("all");
  const [generatedDocument, setGeneratedDocument] = useState<{ title: string; periodLabel: string; filterScope: string; fields: CampFieldCarbonDetail[]; camps: CampCarbonSummary[] } | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<SpatialPreviewTab>("pdf");
  const [documentRenderId, setDocumentRenderId] = useState(0);
  const [generatingDocument, setGeneratingDocument] = useState(false);
  const [documentNotice, setDocumentNotice] = useState("");
  const [filters, setFilters] = useState<Record<Exclude<SpatialLevel, "country">, string>>(emptySpatialFilters);
  const [period, setPeriod] = useState<string>("project");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("-");
  const rootId = nodes.find((node) => !node.parentId)?.id ?? "thailand";

  useEffect(() => {
    Promise.all([getCfSpatialNodes(), getCampCarbonSummaries(), getCampFieldCarbonDetails(), getOverviewKpi()])
      .then(([result, , campFieldDetailResult, kpiResult]) => {
        setNodes(result.data);
        setSpatialResult(result);
        setCampFieldResult(campFieldDetailResult);
        const kpiYears = Array.from(new Set(kpiResult.data.years ?? [])).filter((y) => y && y !== "baseline_avg").sort();
        setAvailableYears(kpiYears);
        setCurrentYear(kpiResult.data.currentYear || "-");
        const root = result.data.find((node) => !node.parentId);
        if (root) setSelectedId(root.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลแผนที่ไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    if (!spatialResult) return; // Prevent initial double fetch
    Promise.all([
      getCfSpatialNodes({ year: period }),
      getCampCarbonSummaries({ year: period }),
      getCampFieldCarbonDetails({ year: period })
    ])
      .then(([spatialRes, , campFieldRes]) => {
        setNodes(spatialRes.data);
        setSpatialResult(spatialRes);
        // We only update campFieldResult to avoid breaking campSummaries which aren't in state but wait,
        // are campSummaries stored in state?
        // Let's check where campSummaries are used... wait, in the initial load we ignored campSummaryRes.
        setCampFieldResult(campFieldRes);
      })
      .catch((err) => console.error("Failed to load spatial nodes for period", err));
  }, [period]);

  useEffect(() => {
    if (selectedCampId === "all") return;
    const campFields = campFieldResult.data.filter((field) => field.campId === selectedCampId);
    const selectedField = selectedBoundaryFieldId ? campFields.find((field) => field.id === selectedBoundaryFieldId) : undefined;
    if (selectedField) {
      setSelectedId(selectedField.id);
      setFilters(filtersFromNode(nodes, selectedField.id, rootId));
      return;
    }
    setSelectedBoundaryFieldId((current) => current && campFields.some((field) => field.id === current) ? current : "");
    const parentId = campFields[0]?.parentId;
    if (parentId) {
      setSelectedId(parentId);
      setFilters(filtersFromNode(nodes, parentId, rootId));
    }
  }, [campFieldResult.data, nodes, rootId, selectedBoundaryFieldId, selectedCampId]);

  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const selectedProjectGroup = filters.region === "dan-chang" || filters.region === "isan" ? filters.region : "all";
  const projectFields = useMemo(() => spatialProjectPlots.map(projectPlotToField), []);
  const projectPlotByCode = useMemo(() => new Map(spatialProjectPlots.map((plot) => [plot.plotCode, plot])), []);
  const projectFieldsForGroup = useMemo(
    () => selectedProjectGroup === "all"
      ? projectFields
      : projectFields.filter((field) => field.parentId === selectedProjectGroup),
    [projectFields, selectedProjectGroup],
  );
  const projectProvinceOptions = useMemo(
    () => Array.from(new Set(projectFieldsForGroup.map((field) => field.province).filter(knownGeoValue))).sort((a, b) => a.localeCompare(b, "th")),
    [projectFieldsForGroup],
  );
  const projectFieldsForProvince = useMemo(
    () => filters.province
      ? projectFieldsForGroup.filter((field) => field.province === filters.province)
      : projectFieldsForGroup,
    [filters.province, projectFieldsForGroup],
  );
  const projectDistrictOptions = useMemo(
    () => Array.from(new Set(projectFieldsForProvince.map((field) => field.district).filter(knownGeoValue))).sort((a, b) => a.localeCompare(b, "th")),
    [projectFieldsForProvince],
  );
  const projectFieldsForDistrict = useMemo(
    () => filters.district
      ? projectFieldsForProvince.filter((field) => field.district === filters.district)
      : projectFieldsForProvince,
    [filters.district, projectFieldsForProvince],
  );
  const projectSubdistrictOptions = useMemo(
    () => Array.from(new Set(projectFieldsForDistrict.map((field) => field.subdistrict).filter(knownGeoValue))).sort((a, b) => a.localeCompare(b, "th")),
    [projectFieldsForDistrict],
  );
  const projectFieldsForArea = useMemo(
    () => filters.subdistrict
      ? projectFieldsForDistrict.filter((field) => field.subdistrict === filters.subdistrict)
      : projectFieldsForDistrict,
    [filters.subdistrict, projectFieldsForDistrict],
  );
  const projectOverviewMapNodes = useMemo<SpatialSummaryNode[]>(() => {
    const countryNode = nodes.find((node) => node.id === rootId) ?? nodes.find((node) => node.level === "country");
    const groupNodes = farmGroupFilterOptions.map((option) => {
      const fields = projectFields.filter((field) => field.parentId === option.value);
      const denominator = Math.max(fields.length, 1);
      const inputRows = aggregateInputs(fields.map((field) => field.processInputComparisons ?? []));
      return {
        id: option.value,
        parentId: "thailand",
        level: "region" as const,
        name: option.label,
        lat: fields.reduce((sum, field) => sum + field.lat, 0) / denominator,
        lng: fields.reduce((sum, field) => sum + field.lng, 0) / denominator,
        zoom: 7,
        fields: fields.reduce((sum, field) => sum + field.fields, 0),
        farmers: fields.reduce((sum, field) => sum + field.farmers, 0),
        areaRai: fields.reduce((sum, field) => sum + field.areaRai, 0),
        baselineEmission: Number(fields.reduce((sum, field) => sum + field.baselineEmission, 0).toFixed(2)),
        currentEmission: Number(fields.reduce((sum, field) => sum + field.currentEmission, 0).toFixed(2)),
        processBreakdown: aggregateProcessBreakdown(fields),
        processInputComparisons: hasInputComparisonRows(inputRows) ? inputRows : [],
        childrenIds: [],
      };
    });
    return [
      {
        ...(countryNode ?? {
          id: "thailand",
          level: "country" as const,
          name: "ประเทศไทย",
          lat: 15.5,
          lng: 101.2,
          zoom: 6,
          fields: 0,
          farmers: 0,
          areaRai: 0,
          baselineEmission: 0,
          currentEmission: 0,
          processBreakdown: [],
          childrenIds: [],
        }),
        id: "thailand",
        childrenIds: groupNodes.map((node) => node.id),
      },
      ...groupNodes,
    ];
  }, [nodes, projectFields, rootId]);
  const projectGroupMapNodes = useMemo<SpatialSummaryNode[]>(() => {
    if (selectedProjectGroup === "all") return projectOverviewMapNodes;
    const countryNode = projectOverviewMapNodes.find((node) => node.id === "thailand");
    const groupOption = farmGroupFilterOptions.find((option) => option.value === selectedProjectGroup);
    const groupFields = projectFields.filter((field) => field.parentId === selectedProjectGroup);
    const groupDenominator = Math.max(groupFields.length, 1);
    const groupInputs = aggregateInputs(groupFields.map((field) => field.processInputComparisons ?? []));
    const groupNode: SpatialSummaryNode = {
      id: selectedProjectGroup,
      parentId: "thailand",
      level: "region",
      name: groupOption?.label ?? "กลุ่มไร่หลัก",
      lat: groupFields.reduce((sum, field) => sum + field.lat, 0) / groupDenominator,
      lng: groupFields.reduce((sum, field) => sum + field.lng, 0) / groupDenominator,
      zoom: 8,
      fields: groupFields.length,
      farmers: groupFields.reduce((sum, field) => sum + field.farmers, 0),
      areaRai: Number(groupFields.reduce((sum, field) => sum + field.areaRai, 0).toFixed(2)),
      baselineEmission: Number(groupFields.reduce((sum, field) => sum + field.baselineEmission, 0).toFixed(2)),
      currentEmission: Number(groupFields.reduce((sum, field) => sum + field.currentEmission, 0).toFixed(2)),
      processBreakdown: aggregateProcessBreakdown(groupFields),
      processInputComparisons: hasInputComparisonRows(groupInputs) ? groupInputs : [],
      childrenIds: [],
    };
    const campNodes = summarizeProjectCamps(groupFields).map((camp) => {
      const campFields = groupFields.filter((field) => field.campId === camp.campId);
      const denominator = Math.max(campFields.length, 1);
      return {
        id: `project-camp-${camp.campId}`,
        parentId: selectedProjectGroup,
        level: "subdistrict" as const,
        name: camp.campName,
        lat: campFields.reduce((sum, field) => sum + field.lat, 0) / denominator,
        lng: campFields.reduce((sum, field) => sum + field.lng, 0) / denominator,
        zoom: 11,
        fields: camp.fieldCount,
        farmers: campFields.reduce((sum, field) => sum + field.farmers, 0),
        areaRai: camp.areaRai,
        baselineEmission: camp.baselineCo2eTotal,
        currentEmission: camp.currentCo2eTotal,
        processBreakdown: camp.currentActivityBreakdown,
        processInputComparisons: camp.processInputComparisons,
        childrenIds: [],
      };
    });
    groupNode.childrenIds = campNodes.map((node) => node.id);
    return [
      countryNode
        ? { ...countryNode, childrenIds: [selectedProjectGroup] }
        : {
          id: "thailand",
          level: "country",
          name: "ประเทศไทย",
          lat: 15.5,
          lng: 101.2,
          zoom: 6,
          fields: groupNode.fields,
          farmers: groupNode.farmers,
          areaRai: groupNode.areaRai,
          baselineEmission: groupNode.baselineEmission,
          currentEmission: groupNode.currentEmission,
          processBreakdown: groupNode.processBreakdown,
          childrenIds: [selectedProjectGroup],
        },
      groupNode,
      ...campNodes,
    ];
  }, [projectFields, projectOverviewMapNodes, selectedProjectGroup]);
  const scopedCamps = useMemo(() => summarizeProjectCamps(projectFieldsForArea), [projectFieldsForArea]);
  const selectedCamp = selectedProjectCampName === "all"
    ? undefined
    : scopedCamps.find((camp) => camp.campName === selectedProjectCampName);
  const selectedCampFields = useMemo(
    () => selectedCamp ? projectFieldsForArea.filter((field) => field.campId === selectedCamp.campId) : [],
    [projectFieldsForArea, selectedCamp],
  );
  const projectCampOptions = useMemo(
    () => scopedCamps.map((camp) => camp.campName).sort((a, b) => a.localeCompare(b, "th")),
    [scopedCamps],
  );
  const projectPlotOptions = useMemo(
    () => (selectedCamp ? selectedCampFields : projectFieldsForArea)
      .map((field) => ({ code: field.fieldCode, label: field.fieldName })),
    [projectFieldsForArea, selectedCamp, selectedCampFields],
  );
  const displayCampFields = useMemo(
    () => {
      const fields = selectedCamp ? selectedCampFields : projectFieldsForArea;
      return selectedProjectPlotCode === "all"
        ? fields
        : fields.filter((field) => field.fieldCode === selectedProjectPlotCode);
    },
    [projectFieldsForArea, selectedCamp, selectedCampFields, selectedProjectPlotCode],
  );
  const visibleProjectPlots = useMemo(
    () => displayCampFields
      .map((field) => projectPlotByCode.get(field.fieldCode))
      .filter((plot): plot is SpatialProjectPlot => Boolean(plot)),
    [displayCampFields, projectPlotByCode],
  );
  const projectPlotOverview = useMemo(() => {
    const campCount = new Set(displayCampFields.map((field) => field.campName)).size;
    const totalAreaRai = displayCampFields.reduce((sum, field) => sum + field.areaRai, 0);
    return { campCount, totalAreaRai, plotCount: displayCampFields.length };
  }, [displayCampFields]);
  const activeBoundaryFieldId = selectedBoundaryFieldId || (selectedProjectPlotCode === "all" ? "" : projectPlotId(selectedProjectPlotCode));
  const selectedBoundaryField = activeBoundaryFieldId
    ? displayCampFields.find((field) => field.id === activeBoundaryFieldId)
    : undefined;
  const selectedCampNode = useMemo<SpatialSummaryNode | undefined>(() => {
    if (!selectedCamp) return undefined;
    const anchor = selectedCampFields[0] ?? selected;
    const campInputs = aggregateInputs(selectedCampFields.map((field) => field.processInputComparisons ?? []));
    const campBreakdown = selectedCampFields.length ? aggregateProcessBreakdown(selectedCampFields) : selectedCamp.currentActivityBreakdown;
    return {
      id: `camp-${selectedCamp.campId}`,
      parentId: anchor?.parentId,
      level: "subdistrict",
      name: selectedCamp.campName,
      lat: anchor?.lat ?? selected?.lat ?? 15.5,
      lng: anchor?.lng ?? selected?.lng ?? 101.2,
      zoom: anchor?.zoom ?? selected?.zoom ?? 8,
      fields: selectedCamp.fieldCount,
      farmers: anchor?.farmers ?? 0,
      areaRai: selectedCamp.areaRai,
      baselineEmission: selectedCamp.baselineCo2eTotal,
      currentEmission: selectedCamp.currentCo2eTotal,
      processBreakdown: campBreakdown,
      processInputComparisons: campInputs.length ? campInputs : selectedCamp.processInputComparisons,
      childrenIds: [],
    };
  }, [selected, selectedCamp, selectedCampFields]);
  const scopedNode = useMemo<SpatialSummaryNode | undefined>(() => {
    if (!selected || selectedCamp || selectedBoundaryField) return undefined;
    if (!displayCampFields.length) return selected;
    const inputRows = aggregateInputs(displayCampFields.map((field) => field.processInputComparisons ?? []));
    const anchor = displayCampFields[0];
    return {
      ...selected,
      id: selectedProjectGroup === "all" ? selected.id : selectedProjectGroup,
      name: selectedProjectGroup === "all" ? "ประเทศไทย" : anchor.province,
      lat: displayCampFields.reduce((sum, field) => sum + field.lat, 0) / displayCampFields.length,
      lng: displayCampFields.reduce((sum, field) => sum + field.lng, 0) / displayCampFields.length,
      fields: displayCampFields.reduce((sum, field) => sum + field.fields, 0),
      farmers: displayCampFields.reduce((sum, field) => sum + field.farmers, 0),
      areaRai: displayCampFields.reduce((sum, field) => sum + field.areaRai, 0),
      baselineEmission: Number(displayCampFields.reduce((sum, field) => sum + field.baselineEmission, 0).toFixed(2)),
      currentEmission: Number(displayCampFields.reduce((sum, field) => sum + field.currentEmission, 0).toFixed(2)),
      processBreakdown: aggregateProcessBreakdown(displayCampFields),
      processInputComparisons: hasInputComparisonRows(inputRows) ? inputRows : selected.processInputComparisons,
    };
  }, [displayCampFields, selected, selectedBoundaryField, selectedCamp, selectedProjectGroup]);
  const focusNode = selectedBoundaryField ?? selectedCampNode ?? scopedNode ?? selected;
  const diff = focusNode ? focusNode.baselineEmission - focusNode.currentEmission : 0;
  const diffPercent = focusNode?.baselineEmission ? (diff / focusNode.baselineEmission) * 100 : 0;
  const carbonCredit = focusNode ? creditSummary(focusNode.baselineEmission, focusNode.currentEmission) : creditSummary(0, 0);
  const currentProcessBreakdown = focusNode?.processBreakdown ?? [];
  const spatialInputs = focusNode?.processInputComparisons ?? [];
  const inputTotals = sumInputs(spatialInputs);
  const fertilizerDiff = inputTotals.baselineFertilizerKg - inputTotals.currentFertilizerKg;
  const fuelDiff = inputTotals.baselineFuelLiter - inputTotals.currentFuelLiter;
  const socRemoval = focusNode ? Math.max(focusNode.baselineEmission - focusNode.currentEmission, 0) * 0.35 : 0;
  const socIndex = focusNode?.areaRai ? (socRemoval / focusNode.areaRai) * 100 : 0;
  const mapFieldRenderLimit = selectedCamp ? MAP_CAMP_FIELD_RENDER_LIMIT : MAP_FIELD_RENDER_LIMIT;
  const hasFocusedProjectPlot = selectedProjectPlotCode !== "all";
  const hasScopedProjectArea = Boolean(filters.province || filters.district || filters.subdistrict || selectedCamp || hasFocusedProjectPlot);
  const isProjectOverviewMap = selectedProjectGroup === "all" && !hasScopedProjectArea;
  const isProjectGroupOverviewMap = selectedProjectGroup !== "all" && !hasScopedProjectArea;
  const projectMapFields = hasFocusedProjectPlot
    ? displayCampFields
    : hasScopedProjectArea && displayCampFields.length <= mapFieldRenderLimit
    ? displayCampFields
    : [];
  const mapBoundaryFields = isProjectOverviewMap || isProjectGroupOverviewMap ? [] : projectMapFields.length ? projectMapFields : isField(selected) ? [selected] : [];
  const mapActiveBoundaryFieldId = isProjectOverviewMap || isProjectGroupOverviewMap ? undefined : activeBoundaryFieldId || (isField(selected) ? selected.id : undefined);
  const mapNodes = isProjectOverviewMap ? projectOverviewMapNodes : isProjectGroupOverviewMap ? projectGroupMapNodes : nodes;
  const mapSelectedId = isProjectOverviewMap ? "thailand" : isProjectGroupOverviewMap ? selectedProjectGroup : selected.id;
  const documentFields = displayCampFields;
  const documentTitle = selectedCamp
    ? `รายละเอียดรายแปลง ${selectedCamp.campName}`
    : `รายละเอียดรายแปลง ${selected?.name ?? "ภาพรวมทุกแคมป์"}`;

  const documentCamps = selectedCamp ? [selectedCamp] : scopedCamps;
  const documentIsCurrent = Boolean(
    generatedDocument
      && generatedDocument.title === documentTitle
      && generatedDocument.fields.map((field) => field.id).join("|") === documentFields.map((field) => field.id).join("|")
      && generatedDocument.camps.map((camp) => camp.campId).join("|") === documentCamps.map((camp) => camp.campId).join("|"),
  );
  const generatedExcelRows = useMemo(
    () => generatedDocument ? buildSpatialExcelRows(generatedDocument.fields, generatedDocument.camps) : undefined,
    [generatedDocument],
  );
  const projectPlotSource = {
    source: "api" as const,
    meta: {
      route: "frontend/spatial-project-plots",
      techniques: ["API spatial hierarchy", "project plot file"],
      rowCount: displayCampFields.length,
      datasourceStatus: "api_partial" as const,
      note: "plot boundaries are derived in frontend",
    },
  };

  const clearSpatialDocumentPreview = () => {
    setGeneratedDocument(null);
    setActivePreviewTab("pdf");
    setDocumentRenderId(0);
    setGeneratingDocument(false);
    setPdfUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
  };

  useEffect(() => {
    if (selectedBoundaryFieldId && !displayCampFields.some((field) => field.id === selectedBoundaryFieldId)) {
      setSelectedBoundaryFieldId("");
    }
  }, [displayCampFields, selectedBoundaryFieldId]);

  useEffect(() => {
    if (selectedProjectCampName !== "all" && !projectCampOptions.includes(selectedProjectCampName)) {
      setSelectedProjectCampName("all");
      setSelectedProjectPlotCode("all");
    }
  }, [projectCampOptions, selectedProjectCampName]);

  useEffect(() => {
    if (selectedProjectPlotCode !== "all" && !projectPlotOptions.some((plot) => plot.code === selectedProjectPlotCode)) {
      setSelectedProjectPlotCode("all");
    }
  }, [projectPlotOptions, selectedProjectPlotCode]);

  useEffect(() => {
    if (!generatedDocument || !spatialDocRef.current) return;
    let cancelled = false;
    let revoked = "";
    setGeneratingDocument(true);
    const timer = window.setTimeout(() => {
      if (!spatialDocRef.current) return;
      const pages = Array.from(spatialDocRef.current.querySelectorAll<HTMLElement>(".spatial-doc-paper"));
      const renderTargets = pages.length ? pages : [spatialDocRef.current];
      Promise.all(renderTargets.map((page) => html2canvas(page, { scale: 1.6, backgroundColor: "#ffffff" }))).then((canvases) => {
        if (cancelled) return;
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        const margin = 8;
        canvases.forEach((canvas, index) => {
          const imageWidth = width - margin * 2;
          const imageHeight = Math.min((canvas.height * imageWidth) / canvas.width, height - margin * 2);
          const image = canvas.toDataURL("image/png");
          if (!image.startsWith("data:image/png;base64,")) {
          throw new Error("ไม่สามารถสร้างรูปภาพสำหรับ PDF preview ได้");
        }
          if (index > 0) pdf.addPage();
          pdf.addImage(image, "PNG", margin, margin, imageWidth, imageHeight);
        });

        const url = URL.createObjectURL(pdf.output("blob"));
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPdfUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        revoked = url;
        setDocumentNotice("อัปเดต Preview เอกสารเรียบร้อยแล้ว");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "สร้าง PDF preview ไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setGeneratingDocument(false);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [generatedDocument, documentRenderId]);

  const generateSpatialDocument = () => {
    setError("");
    setPdfUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
    setDocumentNotice("กำลังสร้าง Preview เอกสารตามฟิลเตอร์ปัจจุบัน...");
    const documentPeriodLabel = availableYears.find(y => y === period) || "ปีโครงการหลัก";
    const documentFilterScope = [filters.province, filters.district, filters.subdistrict].filter(Boolean).join(" / ") || "ทุกพื้นที่";
    setGeneratedDocument({ title: documentTitle, periodLabel: documentPeriodLabel, filterScope: documentFilterScope, fields: documentFields, camps: documentCamps });
    setDocumentRenderId((value) => value + 1);
    setActivePreviewTab("pdf");
  };

  const markSpatialFilterChanged = () => {
    clearSpatialDocumentPreview();
    setError("");
    setDocumentNotice("ตัวกรองเปลี่ยนแล้ว ข้อมูลหน้าเว็บและแผนที่อัปเดตทันที กดสร้างเอกสารเมื่อพร้อม");
  };

  const downloadPdf = () => {
    if (!pdfUrl || !documentIsCurrent) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "mitrphol-spatial-fields.pdf";
    a.click();
  };

  const downloadWordDraft = () => {
    if (!spatialDocRef.current || !documentIsCurrent) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${documentCss}</style></head><body>${spatialDocRef.current.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mitrphol-spatial-fields.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!generatedExcelRows || !documentIsCurrent) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(generatedExcelRows.campRows)), "Camp Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(generatedExcelRows.provinceRows)), "Province Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(generatedExcelRows.plotRows)), "Plot Detail");
    XLSX.writeFile(wb, "mitrphol-spatial-carbon-export.xlsx");
  };

  const breadcrumbs = useMemo(() => {
    const list: SpatialSummaryNode[] = [];
    let cur: SpatialSummaryNode | undefined = selected;
    while (cur) {
      list.unshift(cur);
      cur = cur.parentId ? nodes.find((node) => node.id === cur?.parentId) : undefined;
    }
    return list;
  }, [nodes, selected]);

  const selectSpatialNode = (id: string) => {
    const nextId = id || rootId;
    setSelectedId(nextId);
    setFilters(filtersFromNode(nodes, nextId, rootId));
    setSelectedCampId("all");
    setSelectedBoundaryFieldId("");
    markSpatialFilterChanged();
  };

  const selectMapNode = (id: string) => {
    if (id === "dan-chang" || id === "isan") {
      setFilters({ ...emptySpatialFilters(), region: id });
      setSelectedId(id);
      setSelectedCampId("all");
      setSelectedBoundaryFieldId("");
      setSelectedProjectCampName("all");
      setSelectedProjectPlotCode("all");
      markSpatialFilterChanged();
      return;
    }
    if (id.startsWith("project-camp-")) {
      const campId = Number(id.replace("project-camp-", ""));
      const camp = scopedCamps.find((item) => item.campId === campId);
      if (camp) {
        setSelectedProjectCampName(camp.campName);
        setSelectedProjectPlotCode("all");
        setSelectedBoundaryFieldId("");
        setSelectedId(selectedProjectGroup === "all" ? rootId : selectedProjectGroup);
        markSpatialFilterChanged();
        return;
      }
    }
    selectSpatialNode(id);
  };

  const selectArea = (level: keyof typeof filters, id: string) => {
    const levelIndex = spatialOrder.indexOf(level);
    const next = { ...filters, [level]: id };
    spatialOrder.slice(levelIndex + 1).forEach((key) => {
      next[key] = "";
    });
    setFilters(next);
    setSelectedId(next.region || rootId);
    setSelectedCampId("all");
    setSelectedBoundaryFieldId("");
    setSelectedProjectCampName("all");
    setSelectedProjectPlotCode("all");
    markSpatialFilterChanged();
  };

  const selectBoundaryField = (id: string) => {
    if (!id) {
      setSelectedBoundaryFieldId("");
      setSelectedProjectPlotCode("all");
      markSpatialFilterChanged();
      return;
    }
    const field = displayCampFields.find((item) => item.id === id) ?? campFieldResult.data.find((item) => item.id === id);
    if (field) {
      setSelectedProjectCampName(field.campName);
      setSelectedProjectPlotCode(field.fieldCode);
      setSelectedId(field.id);
      if (field.parentId === "dan-chang" || field.parentId === "isan") {
        setFilters({
          region: field.parentId,
          province: knownGeoValue(field.province) ? field.province : "",
          district: knownGeoValue(field.district) ? field.district : "",
          subdistrict: knownGeoValue(field.subdistrict) ? field.subdistrict : "",
          field: "",
        });
      } else {
        setSelectedCampId(field.campId);
        setFilters(filtersFromNode(nodes, field.id, rootId));
      }
    }
    setSelectedBoundaryFieldId(id);
    markSpatialFilterChanged();
  };

  const resetSpatialFilters = () => {
    setSelectedId(rootId);
    setFilters(emptySpatialFilters());
    setSelectedCampId("all");
    setSelectedBoundaryFieldId("");
    setSelectedProjectCampName("all");
    setSelectedProjectPlotCode("all");
    clearSpatialDocumentPreview();
    setError("");
    setDocumentNotice("Reset Filter แล้ว Preview เอกสารรายแปลงและไฟล์สร้างเอกสารถูกล้างเรียบร้อยแล้ว");
  };

  if (!selected) {
    return <div className="cf-dash"><div className="page active"><div className="empty-state">กำลังโหลดข้อมูลแผนที่...</div></div></div>;
  }

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>แผนที่ประเทศไทยและรายละเอียดรายพื้นที่</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="card spatial-picker">
          <div>
            <div className="card-title">ตัวกรองพื้นที่</div>
            <p className="muted text-xs font-normal" style={{ marginBottom: "1rem", fontSize: "0.85em", opacity: 0.6 }}>กรุณากำหนดขอบเขตพื้นที่และโครงการ เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูลแผนที่เชิงพื้นที่</p>
            <div className="breadcrumb">
              {breadcrumbs.map((item, index) => (
                <span key={item.id}>
                  {index > 0 && <span>›</span>}
                  <button onClick={() => selectSpatialNode(item.id)}>{item.name}</button>
                </span>
              ))}
            </div>
            <button type="button" className="run-btn spatial-reset-btn" onClick={resetSpatialFilters}>
              Reset Filter
            </button>
          </div>
          <div className="spatial-select-grid">
            <label>
              ปีดำเนินการ
              <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                <option value="project">ปีดำเนินการ {currentYear}</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>ปี {y}</option>
                ))}
              </select>
            </label>
            <label>
              กลุ่มไร่หลัก
              <select value={filters.region} onChange={(event) => selectArea("region", event.target.value)}>
                <option value="">ทุกกลุ่มไร่หลัก</option>
                {farmGroupFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              จังหวัด
              <select value={filters.province} onChange={(event) => selectArea("province", event.target.value)} disabled={!projectProvinceOptions.length}>
                <option value="">ทั้งหมด</option>
                {projectProvinceOptions.map((province) => <option key={province} value={province}>{province}</option>)}
              </select>
            </label>
            <label>
              อำเภอ / เขต
              <select value={filters.district} onChange={(event) => selectArea("district", event.target.value)} disabled={!projectDistrictOptions.length}>
                <option value="">ทั้งหมด</option>
                {projectDistrictOptions.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </label>
            <label>
              ตำบล / แขวง
              <select value={filters.subdistrict} onChange={(event) => selectArea("subdistrict", event.target.value)} disabled={!projectSubdistrictOptions.length}>
                <option value="">ทั้งหมด</option>
                {projectSubdistrictOptions.map((subdistrict) => <option key={subdistrict} value={subdistrict}>{subdistrict}</option>)}
              </select>
            </label>
            <label className="filter-level-camp">
              แคมป์
              <select
                value={selectedProjectCampName}
                onChange={(event) => {
                  setSelectedProjectCampName(event.target.value);
                  setSelectedProjectPlotCode("all");
                  setSelectedBoundaryFieldId("");
                }}
              >
                <option value="all">ทุกแคมป์</option>
                {projectCampOptions.map((campName) => (
                  <option key={campName} value={campName}>{campName}</option>
                ))}
              </select>
            </label>
            <label className="filter-level-field">
              แปลง
              <select
                value={selectedProjectPlotCode}
                onChange={(event) => {
                  setSelectedProjectPlotCode(event.target.value);
                  setSelectedBoundaryFieldId("");
                }}
                disabled={!projectPlotOptions.length}
              >
                <option value="all">ทุกแปลง</option>
                {projectPlotOptions.map((plot) => <option key={plot.code} value={plot.code}>{plot.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="card full-span spatial-camp-fields-card">
          <div className="card-title-row">
            <div className="card-title">รายแปลงในแคมป์</div>
            <SourceBadge source={projectPlotSource.source} meta={projectPlotSource.meta} />
          </div>
          <div className="mini-stat-grid wide">
            <div><strong>{projectPlotOverview.campCount.toLocaleString()}</strong><span>แคมป์ตามตัวกรอง</span></div>
            <div><strong>{projectPlotOverview.plotCount.toLocaleString()}</strong><span>แปลงตามตัวกรอง</span></div>
            <div><strong>{projectPlotOverview.totalAreaRai.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><span>ไร่โครงการ</span></div>
            <div><strong>{selectedProjectGroup === "all" ? "ทั้งหมด" : visibleProjectPlots[0]?.farmGroupName ?? "-"}</strong><span>กลุ่มไร่หลัก</span></div>
          </div>
          <div className="input-table-wrap spatial-project-table-wrap">
            <table className="input-table spatial-project-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>กลุ่มไร่หลัก</th>
                  <th>ชื่อแคมป์</th>
                  <th>รหัสแปลง</th>
                  <th>พื้นที่โครงการ (ไร่)</th>
                  <th>พิกัด X</th>
                  <th>พิกัด Y</th>
                  <th>ขอบเขต</th>
                </tr>
              </thead>
              <tbody>
                {displayCampFields.map((field) => {
                  const plot = projectPlotByCode.get(field.fieldCode);
                  if (!plot) return null;
                  const fieldId = field.id;
                  return (
                    <tr key={plot.plotCode} className={mapActiveBoundaryFieldId === fieldId ? "active-row" : ""}>
                      <td>{plot.sequence.toLocaleString()}</td>
                      <td>{plot.farmGroupName}</td>
                      <td>{field.campName}</td>
                      <td>{plot.plotCode}</td>
                      <td>{plot.projectAreaRai.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                      <td>{plot.x.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td>{plot.y.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td>
                        <button
                          type="button"
                          className="map-zoom-btn"
                          onClick={() => selectBoundaryField(fieldId)}
                          title="ซูมไปที่ขอบเขตแปลง"
                        >
                          <MapPinned size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!visibleProjectPlots.length && (
                  <tr><td colSpan={8}>ไม่พบข้อมูลรายแปลงตามตัวกรองนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card map-card wide-map">
          <ThailandMap
            nodes={mapNodes}
            selectedId={mapSelectedId}
            onSelect={selectMapNode}
            boundaryFields={mapBoundaryFields}
            selectedBoundaryFieldId={mapActiveBoundaryFieldId}
            onSelectBoundaryField={selectBoundaryField}
          />
        </section>

        <div className="spatial-report-layout">
          <div className="spatial-report-left-column">
            <article className="card spatial-summary-card">
              <div className="card-title-row">
                <div className="card-title">สรุปรายละเอียดพื้นที่ · {focusNode.name}</div>
                <SourceBadge source={spatialResult.source} meta={spatialResult.meta} />
              </div>
              <div className="mini-stat-grid wide spatial-summary-stats">
                <div><strong>{focusNode.fields}</strong><span>แปลง</span></div>
                <div><strong>{focusNode.farmers}</strong><span>เกษตรกร</span></div>
                <div><strong>{focusNode.areaRai.toLocaleString()}</strong><span>ไร่</span></div>
                <div>
                  <strong className={diff >= 0 ? "green-text" : "red-text"}>{Math.abs(diff).toFixed(2)}</strong>
                  <span>{diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} tCO2e</span>
                </div>
              </div>
              <div className="carbon-compare spatial-carbon-compare">
                <div><span>เทียบกับปีฐาน</span><strong className={diff >= 0 ? "green-text" : "red-text"}>{diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diffPercent).toFixed(1)}%</strong></div>
                <div><span>Carbon Footprint ปีฐาน</span><strong>{focusNode.baselineEmission.toLocaleString()} tCO2e</strong></div>
                <div><span>Carbon Footprint ปีดำเนินการ</span><strong>{focusNode.currentEmission.toLocaleString()} tCO2e</strong></div>
                <div><span>ผลต่าง Footprint</span><strong className={diff >= 0 ? "green-text" : "red-text"}>{carbonCredit.direction} {formatNumber(Math.abs(diff), 2)} tCO2e</strong></div>
                <div><span>Carbon Credit ปีฐาน</span><strong>0 tCO2e</strong></div>
                <div><span>Carbon Credit ปีดำเนินการ</span><strong>{formatNumber(carbonCredit.credit, 2)} tCO2e</strong></div>
                <div><span>เครดิตที่ได้</span><strong className={carbonCredit.credit > 0 ? "green-text" : "red-text"}>{formatNumber(carbonCredit.credit, 2)} tCO2e</strong></div>
                <div><span>การสะสมคาร์บอนในดิน (SOC)</span><strong className="green-text">{formatNumber(socRemoval, 2)} tCO2e</strong></div>
                <div><span>SOC index ต่อพื้นที่</span><strong>{formatNumber(socIndex, 2)}</strong></div>
                <div><span>เครดิตรวมหลังรวม SOC</span><strong className="green-text">{formatNumber(carbonCredit.credit + socRemoval, 2)} tCO2e</strong></div>
              </div>
              {isField(focusNode) && (
                <div className="field-detail">
                  <h3>{focusNode.fieldName}</h3>
                  <div className="field-meta">
                    <span>รหัสแปลง: {focusNode.fieldCode}</span>
                    <span>เกษตรกร: {focusNode.farmerName}</span>
                    <span>จังหวัด: {focusNode.province}</span>
                    <span>อำเภอ: {focusNode.district}</span>
                    <span>ตำบล: {focusNode.subdistrict}</span>
                    <span>โทร: {focusNode.phone}</span>
                  </div>
                  <div className="chanot-list">
                    {focusNode.chanots.map((chanot) => (
                      <span key={chanot.chanotNo}>{chanot.chanotNo} · {formatNumber(chanot.areaRai, 2)} ไร่</span>
                    ))}
                    {!focusNode.chanots.length && <span>ยังไม่มีข้อมูลโฉนดที่ดิน</span>}
                  </div>
                </div>
              )}
            </article>

            <article className="card">
              <div className="card-title-row">
                <div className="card-title">กราฟแท่ง · สัดส่วนกระบวนการในพื้นที่</div>
                <SourceBadge source={projectPlotSource.source} meta={projectPlotSource.meta} />
              </div>
              <ProcessDoughnut
                title={`${focusNode.name} · ${period === "project" ? `ปีดำเนินการ ${currentYear}` : `ปี ${period}`}`}
                data={currentProcessBreakdown}
                variant="bar"
              />
            </article>
          </div>

          <div className="spatial-report-right-column">
            <section className="card report-toolbar spatial-export-toolbar">
              <div>
                <div className="card-title">เอกสารรายละเอียดรายแปลง</div>
              </div>
              <div className="report-download-actions">
                <button className="run-all-btn report-generate-btn" type="button" onClick={generateSpatialDocument} disabled={!documentFields.length || generatingDocument}>
                  สร้างเอกสารใหม่ <br /> (Generate Report)
                </button>
                <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl || generatingDocument || !documentIsCurrent}>Download PDF</button>
                <button className="run-btn word-download-btn" type="button" onClick={downloadWordDraft} disabled={!generatedDocument || !documentIsCurrent}>Download Word</button>
                <button className="run-all-btn excel-download-btn" type="button" onClick={exportExcel} disabled={!generatedExcelRows || !documentIsCurrent}>Export Excel</button>
              </div>
            </section>

            {documentNotice && <div className="report-generate-notice">{documentNotice}</div>}

            <section className="card report-preview-panel spatial-doc-preview-card">
              <div className="report-preview-tabs spatial-preview-tabs" role="tablist" aria-label="Spatial report preview tabs">
                {[
                  ["pdf", "PDF"],
                  ["excel", "Excel"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activePreviewTab === tab}
                    className={activePreviewTab === tab ? "active" : ""}
                    onClick={() => setActivePreviewTab(tab as SpatialPreviewTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="card-title-row">
                <div className="card-title">Preview เอกสารรายแปลง</div>
                <SourceBadge source={projectPlotSource.source} meta={projectPlotSource.meta} />
              </div>
              {!generatedDocument && <div className="empty-state">กรุณาสร้างเอกสารใหม่เพื่อดูตัวอย่าง</div>}
              <div className={`spatial-doc-preview ${activePreviewTab === "pdf" ? "pdf-mode" : ""}`} style={{ display: generatedDocument && activePreviewTab === "pdf" ? undefined : "none" }}>
                {generatingDocument ? (
                  <div className="empty-state">กำลัง Render PDF preview...</div>
                ) : pdfUrl ? (
                  <iframe title="Spatial Fields PDF Preview" src={pdfUrl} />
                ) : (
                  <div className="empty-state">ยังไม่ได้สร้างเอกสาร หรือเกิดข้อผิดพลาดในการโหลด PDF</div>
                )}
              </div>
              {generatedDocument && activePreviewTab === "excel" && generatedExcelRows && (
                <div className="excel-preview">
                  <SpatialExcelPreview rows={generatedExcelRows} />
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="card">
            <div className="card-title">สรุปการใช้ปุ๋ยและน้ำมันในพื้นที่ · {focusNode.name}</div>
            <div className="mini-stat-grid wide">
              <div>
                <strong>{inputTotals.baselineFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>kg ปุ๋ยปีฐาน</span>
              </div>
              <div>
                <strong>{inputTotals.currentFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>kg ปุ๋ยปีดำเนินการ</span>
              </div>
              <div>
                <strong>{inputTotals.baselineFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>L น้ำมันปีฐาน</span>
              </div>
              <div>
                <strong>{inputTotals.currentFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>L น้ำมันปีดำเนินการ</span>
              </div>
            </div>
            <div className="input-insight-grid">
              <div>
                <span>ปุ๋ยเทียบปีฐาน</span>
                <strong className={fertilizerDiff >= 0 ? "green-text" : "red-text"}>
                  {fertilizerDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(fertilizerDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                </strong>
                <small>{Math.abs(inputPct(inputTotals.baselineFertilizerKg, inputTotals.currentFertilizerKg)).toFixed(1)}%</small>
              </div>
              <div>
                <span>น้ำมันเทียบปีฐาน</span>
                <strong className={fuelDiff >= 0 ? "green-text" : "red-text"}>
                  {fuelDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(fuelDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                </strong>
                <small>{Math.abs(inputPct(inputTotals.baselineFuelLiter, inputTotals.currentFuelLiter)).toFixed(1)}%</small>
              </div>
            </div>
        </section>

        {/* Off-screen PDF render source */}
        <div className="pdf-render-source">
          <div ref={spatialDocRef} className="spatial-doc-pages">
            {chunkRows(generatedDocument?.fields ?? [], SPATIAL_DOC_ROWS_PER_PAGE).map((pageFields, pageIndex, pages) => (
              <SpatialDocument
                key={`spatial-doc-page-${pageIndex}`}
                docInfo={{
                  title: `${generatedDocument?.title ?? documentTitle} · Page ${pageIndex + 1}/${pages.length}`,
                  periodLabel: generatedDocument?.periodLabel ?? "-",
                  filterScope: generatedDocument?.filterScope ?? "-"
                }}
                fields={pageFields}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
