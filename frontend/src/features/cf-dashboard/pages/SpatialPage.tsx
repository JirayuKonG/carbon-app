import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ThailandMap } from "../components/map/ThailandMap";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCfSpatialNodes } from "../services/dashboardApi";
import type { CampCarbonSummary, CampFieldCarbonDetail, DataResult, FieldCarbonDetail, ProcessInputComparison, SpatialLevel, SpatialSummaryNode } from "../types/dashboard";
import { MapPinned } from "lucide-react";
import "../cf-dashboard.css";

type SpatialPreviewTab = "pdf" | "excel";
type SpatialProcessPeriod = "baseline" | "current";

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

function nodeIsWithin(nodes: SpatialSummaryNode[], nodeId: string | undefined, scopeId: string | undefined) {
  if (!scopeId || !nodeId) return false;
  if (scopeId === nodeId) return true;
  let cur = nodes.find((node) => node.id === nodeId);
  while (cur?.parentId) {
    if (cur.parentId === scopeId) return true;
    cur = nodes.find((node) => node.id === cur?.parentId);
  }
  return false;
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
      "Carbon Footprint (tCO2e)": Number(campCurrent.toFixed(2)),
      "Carbon Credit (tCO2e)": Number(Math.max(campBaseline - campCurrent, 0).toFixed(2)),
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
      "Carbon Footprint (tCO2e)": Number(current.toFixed(2)),
      "Carbon Credit (tCO2e)": Number(Math.max(baseline - current, 0).toFixed(2)),
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
      "Baseline Emission (tCO2e)": Number(field.baselineEmission.toFixed(2)),
      "Project Emission (tCO2e)": Number(field.currentEmission.toFixed(2)),
      "Emission Reduction (tCO2e)": Number(reduction.toFixed(2)),
      "Carbon Credit (tCO2e)": Number(Math.max(reduction, 0).toFixed(2)),
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

function SpatialDocument({ title, fields }: { title: string; fields: CampFieldCarbonDetail[] }) {
  return (
    <div className="spatial-doc-paper">
      <div className="spatial-doc-header">
        <div className="spatial-doc-logo">Premium<br />T-VER</div>
        <div>
          <strong>โครงการลดก๊าซเรือนกระจกภาคสมัครใจตามมาตรฐานของประเทศไทย</strong>
          <span>มาตรฐานขั้นสูง Premium T-VER</span>
          <span>{title}</span>
        </div>
        <div>
          <strong>T-VER-P-F003-PDD</strong>
          <span>VERSION 2.0</span>
        </div>
      </div>
      <table className="spatial-doc-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ชื่อแคมป์</th>
            <th>รหัสแปลง</th>
            <th>ชนิดดิน</th>
            <th>พื้นที่โครงการ (ไร่)</th>
            <th>พิกัด x</th>
            <th>พิกัด y</th>
            <th>ภาพลักษณะแปลง</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={`doc-${field.id}`}>
              <td>{index + 1}</td>
              <td>{field.campName}</td>
              <td>{field.fieldCode}</td>
              <td>{field.soilType || "-"}</td>
              <td>{formatNumber(field.areaRai, 2)}</td>
              <td>{field.lng.toFixed(6)}</td>
              <td>{field.lat.toFixed(6)}</td>
              <td>{fieldThumbnail(field, index)}</td>
            </tr>
          ))}
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
  .spatial-doc-header { display: grid; grid-template-columns: 74px 1fr 116px; border: 1px solid #222; margin-bottom: 10px; }
  .spatial-doc-header > div { padding: 6px 8px; border-right: 1px solid #222; display: grid; gap: 3px; align-content: center; }
  .spatial-doc-header > div:last-child { border-right: 0; text-align: center; }
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
  const [campResult, setCampResult] = useState<DataResult<CampCarbonSummary[]>>({ data: [], source: "mock" });
  const [campFieldResult, setCampFieldResult] = useState<DataResult<CampFieldCarbonDetail[]>>({ data: [], source: "mock" });
  const [selectedCampId, setSelectedCampId] = useState<number | "all">("all");
  const [selectedBoundaryFieldId, setSelectedBoundaryFieldId] = useState("");
  const [showAllCampRows, setShowAllCampRows] = useState(false);
  const [processPeriod, setProcessPeriod] = useState<SpatialProcessPeriod>("current");
  const [generatedDocument, setGeneratedDocument] = useState<{ title: string; fields: CampFieldCarbonDetail[]; camps: CampCarbonSummary[] } | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<SpatialPreviewTab>("pdf");
  const [documentRenderId, setDocumentRenderId] = useState(0);
  const [generatingDocument, setGeneratingDocument] = useState(false);
  const [documentNotice, setDocumentNotice] = useState("");
  const [filters, setFilters] = useState<Record<Exclude<SpatialLevel, "country">, string>>(emptySpatialFilters);
  const rootId = nodes.find((node) => !node.parentId)?.id ?? "thailand";

  useEffect(() => {
    Promise.all([getCfSpatialNodes(), getCampCarbonSummaries(), getCampFieldCarbonDetails()])
      .then(([result, campSummaryResult, campFieldDetailResult]) => {
        setNodes(result.data);
        setCampResult(campSummaryResult);
        setCampFieldResult(campFieldDetailResult);
        const root = result.data.find((node) => !node.parentId);
        if (root) setSelectedId(root.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลแผนที่ไม่สำเร็จ"));
  }, []);

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
  const scopedCampFields = useMemo(() => {
    if (!selected || selected.id === rootId) return campFieldResult.data;
    return campFieldResult.data.filter((field) => nodeIsWithin(nodes, field.parentId, selected.id) || nodeIsWithin(nodes, field.id, selected.id));
  }, [campFieldResult.data, nodes, rootId, selected]);
  const scopedCampIds = useMemo(() => new Set(scopedCampFields.map((field) => field.campId)), [scopedCampFields]);
  const scopedCamps = useMemo(
    () => selected?.id === rootId
      ? campResult.data
      : campResult.data.filter((camp) => scopedCampIds.has(camp.campId)),
    [campResult.data, rootId, scopedCampIds, selected?.id],
  );
  const selectedCamp = selectedCampId === "all"
    ? undefined
    : scopedCamps.find((camp) => camp.campId === selectedCampId);
  const selectedCampFields = useMemo(
    () => selectedCamp ? scopedCampFields.filter((field) => field.campId === selectedCamp.campId) : [],
    [scopedCampFields, selectedCamp],
  );
  const displayCampFields = useMemo(
    () => selectedCamp ? selectedCampFields : scopedCampFields,
    [scopedCampFields, selectedCamp, selectedCampFields],
  );
  const selectedBoundaryField = selectedBoundaryFieldId
    ? displayCampFields.find((field) => field.id === selectedBoundaryFieldId)
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
    if (!scopedCampFields.length) return selected;
    const inputRows = aggregateInputs(scopedCampFields.map((field) => field.processInputComparisons ?? []));
    return {
      ...selected,
      fields: scopedCampFields.reduce((sum, field) => sum + field.fields, 0),
      farmers: scopedCampFields.reduce((sum, field) => sum + field.farmers, 0),
      areaRai: scopedCampFields.reduce((sum, field) => sum + field.areaRai, 0),
      baselineEmission: scopedCampFields.reduce((sum, field) => sum + field.baselineEmission, 0),
      currentEmission: scopedCampFields.reduce((sum, field) => sum + field.currentEmission, 0),
      processBreakdown: aggregateProcessBreakdown(scopedCampFields),
      processInputComparisons: hasInputComparisonRows(inputRows) ? inputRows : selected.processInputComparisons,
    };
  }, [scopedCampFields, selected, selectedBoundaryField, selectedCamp]);
  const focusNode = selectedBoundaryField ?? selectedCampNode ?? scopedNode ?? selected;
  const diff = focusNode ? focusNode.baselineEmission - focusNode.currentEmission : 0;
  const diffPercent = focusNode?.baselineEmission ? (diff / focusNode.baselineEmission) * 100 : 0;
  const carbonCredit = focusNode ? creditSummary(focusNode.baselineEmission, focusNode.currentEmission) : creditSummary(0, 0);
  const baselineProcessBreakdown = focusNode ? scaleProcessBreakdown(focusNode.processBreakdown, focusNode.baselineEmission) : [];
  const currentProcessBreakdown = focusNode?.processBreakdown ?? [];
  const processBreakdownForPeriod = processPeriod === "baseline" ? baselineProcessBreakdown : currentProcessBreakdown;
  const processComparisonBreakdown = processPeriod === "baseline" ? currentProcessBreakdown : baselineProcessBreakdown;
  const processPeriodLabel = processPeriod === "baseline" ? "ปีฐาน" : "ปีดำเนินการ";
  const spatialInputs = focusNode?.processInputComparisons ?? [];
  const inputTotals = sumInputs(spatialInputs);
  const fertilizerDiff = inputTotals.baselineFertilizerKg - inputTotals.currentFertilizerKg;
  const fuelDiff = inputTotals.baselineFuelLiter - inputTotals.currentFuelLiter;
  const socRemoval = focusNode ? Math.max(focusNode.baselineEmission - focusNode.currentEmission, 0) * 0.35 : 0;
  const socIndex = focusNode?.areaRai ? (socRemoval / focusNode.areaRai) * 100 : 0;
  const campOverview = useMemo(() => {
    const totalAreaRai = scopedCamps.reduce((sum, camp) => sum + camp.areaRai, 0);
    const totalCo2e = scopedCamps.reduce((sum, camp) => sum + camp.co2eTotal, 0);
    return {
      totalCamps: scopedCamps.length,
      totalAreaRai,
      totalCo2e,
      co2ePerRai: totalAreaRai ? totalCo2e / totalAreaRai : 0,
    };
  }, [scopedCamps]);
  const visibleCampFields = showAllCampRows ? displayCampFields : displayCampFields.slice(0, 10);
  const hiddenCampFieldCount = Math.max(displayCampFields.length - visibleCampFields.length, 0);
  const mapBoundaryFields = selectedCamp ? selectedCampFields : displayCampFields.length ? displayCampFields : isField(selected) ? [selected] : [];
  const activeBoundaryFieldId = selectedBoundaryFieldId || (isField(selected) ? selected.id : undefined);
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

  useEffect(() => {
    if (selectedBoundaryFieldId && !displayCampFields.some((field) => field.id === selectedBoundaryFieldId)) {
      setSelectedBoundaryFieldId("");
    }
  }, [displayCampFields, selectedBoundaryFieldId]);

  useEffect(() => {
    if (!generatedDocument || !spatialDocRef.current) return;
    let revoked = "";
    setGeneratingDocument(true);
    const timer = window.setTimeout(() => {
      if (!spatialDocRef.current) return;
      html2canvas(spatialDocRef.current, { scale: 1.8, backgroundColor: "#ffffff" }).then((canvas) => {
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const imageWidth = width - margin * 2;
        const imageHeight = (canvas.height * imageWidth) / canvas.width;
        const image = canvas.toDataURL("image/png");
        let position = margin;

        pdf.addImage(image, "PNG", margin, position, imageWidth, imageHeight);
        let remainingHeight = imageHeight - (height - margin * 2);
        while (remainingHeight > 0) {
          position = remainingHeight - imageHeight + margin;
          pdf.addPage();
          pdf.addImage(image, "PNG", margin, position, imageWidth, imageHeight);
          remainingHeight -= height - margin * 2;
        }

        const url = URL.createObjectURL(pdf.output("blob"));
        setPdfUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        revoked = url;
        setDocumentNotice("อัปเดต Preview เอกสารเรียบร้อยแล้ว");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "สร้าง PDF preview ไม่สำเร็จ"))
      .finally(() => setGeneratingDocument(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [generatedDocument, documentRenderId]);

  const generateSpatialDocument = () => {
    setDocumentNotice("กำลังสร้าง Preview เอกสารตามฟิลเตอร์ปัจจุบัน...");
    setGeneratedDocument({ title: documentTitle, fields: documentFields, camps: documentCamps });
    setDocumentRenderId((value) => value + 1);
    setActivePreviewTab("pdf");
  };

  const markSpatialFilterChanged = () => {
    setShowAllCampRows(false);
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

  const optionsFor = (level: Exclude<SpatialLevel, "country">, parentId?: string) =>
    nodes.filter((node) => node.level === level && (!parentId || node.parentId === parentId));

  const selectSpatialNode = (id: string) => {
    const nextId = id || rootId;
    setSelectedId(nextId);
    setFilters(filtersFromNode(nodes, nextId, rootId));
    setSelectedCampId("all");
    setSelectedBoundaryFieldId("");
    markSpatialFilterChanged();
  };

  const selectArea = (level: keyof typeof filters, id: string) => {
    const levelIndex = spatialOrder.indexOf(level);
    const next = { ...filters, [level]: id };
    spatialOrder.slice(levelIndex + 1).forEach((key) => {
      next[key] = "";
    });
    setFilters(next);
    setSelectedId(id || next.subdistrict || next.district || next.province || next.region || rootId);
    setSelectedCampId("all");
    setSelectedBoundaryFieldId("");
    markSpatialFilterChanged();
  };

  const selectCamp = (value: string) => {
    const nextCampId = value === "all" ? "all" : Number(value);
    const firstField = nextCampId === "all" ? undefined : campFieldResult.data.find((field) => field.campId === nextCampId);
    setSelectedCampId(nextCampId);
    setSelectedBoundaryFieldId("");
    if (firstField?.parentId) {
      setSelectedId(firstField.parentId);
      setFilters(filtersFromNode(nodes, firstField.parentId, rootId));
    }
    markSpatialFilterChanged();
  };

  const selectBoundaryField = (id: string) => {
    if (!id) {
      const parentId = selectedCampFields[0]?.parentId;
      if (parentId) {
        setSelectedId(parentId);
        setFilters(filtersFromNode(nodes, parentId, rootId));
      }
      setSelectedBoundaryFieldId("");
      markSpatialFilterChanged();
      return;
    }
    const field = campFieldResult.data.find((item) => item.id === id);
    if (field) {
      setSelectedCampId(field.campId);
      setSelectedId(field.id);
      setFilters(filtersFromNode(nodes, field.id, rootId));
    }
    setSelectedBoundaryFieldId(id);
    markSpatialFilterChanged();
  };

  const selectFieldFilter = (id: string) => {
    if (selectedCamp) {
      selectBoundaryField(id);
      return;
    }
    selectArea("field", id);
  };

  const resetSpatialFilters = () => {
    setSelectedId(rootId);
    setFilters(emptySpatialFilters());
    setSelectedCampId("all");
    setSelectedBoundaryFieldId("");
    markSpatialFilterChanged();
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
            <div className="card-title">เลือกพื้นที่</div>
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
              กลุ่มไร่หลัก
              <select value={filters.region} onChange={(event) => selectArea("region", event.target.value)}>
                <option value="">ทั้งหมด</option>
                {optionsFor("region", rootId).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              จังหวัด
              <select value={filters.province} onChange={(event) => selectArea("province", event.target.value)} disabled={!filters.region}>
                <option value="">ทั้งหมด</option>
                {optionsFor("province", filters.region).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              อำเภอ / เขต
              <select value={filters.district} onChange={(event) => selectArea("district", event.target.value)} disabled={!filters.province}>
                <option value="">ทั้งหมด</option>
                {optionsFor("district", filters.province).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              ตำบล / แขวง
              <select value={filters.subdistrict} onChange={(event) => selectArea("subdistrict", event.target.value)} disabled={!filters.district}>
                <option value="">ทั้งหมด</option>
                {optionsFor("subdistrict", filters.district).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label className="filter-level-camp">
              แคมป์
              <select value={selectedCampId} onChange={(event) => selectCamp(event.target.value)}>
                <option value="all">ภาพรวมทุกแคมป์</option>
                {scopedCamps.map((camp) => (
                  <option key={camp.campId} value={camp.campId}>{camp.campName}</option>
                ))}
              </select>
            </label>
            <label className="filter-level-field">
              แปลง
              <select
                value={selectedCamp ? selectedBoundaryFieldId : filters.field}
                onChange={(event) => selectFieldFilter(event.target.value)}
                disabled={selectedCamp ? !selectedCampFields.length : !filters.subdistrict}
              >
                <option value="">ทั้งหมด</option>
                {selectedCamp
                  ? selectedCampFields.map((field) => <option key={field.id} value={field.id}>{field.fieldCode} · {field.fieldName}</option>)
                  : optionsFor("field", filters.subdistrict).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="card full-span spatial-camp-fields-card">
          <div className="card-title-row">
            <div className="card-title">รายแปลงในแคมป์</div>
          </div>
          <div className="camp-selector-row">
            <label>
              เลือกแคมป์
              <select
                value={selectedCampId}
                onChange={(event) => selectCamp(event.target.value)}
              >
                <option value="all">ภาพรวมทุกแคมป์</option>
                {scopedCamps.map((camp) => (
                  <option key={camp.campId} value={camp.campId}>{camp.campName}</option>
                ))}
              </select>
            </label>
            {selectedCamp && (
              <label>
                เลือกแปลงบนแผนที่
                <select
                  value={selectedBoundaryFieldId}
                  onChange={(event) => selectBoundaryField(event.target.value)}
                  disabled={!selectedCampFields.length}
                >
                  <option value="">{selectedCampFields.length ? "แสดงทุกแปลงในแคมป์" : "ยังไม่มี mock รายแปลง"}</option>
                  {selectedCampFields.map((field) => (
                    <option key={field.id} value={field.id}>{field.fieldCode} · {field.fieldName}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {selectedCamp ? (
            <>
              <div className="mini-stat-grid wide">
                <div><strong>{selectedCamp.fieldCount.toLocaleString()}</strong><span>แปลงในแคมป์</span></div>
                <div><strong>{selectedCamp.areaRai.toLocaleString()}</strong><span>ไร่รวม</span></div>
                <div><strong>{selectedCamp.co2eTotal.toLocaleString()}</strong><span>tCO2e รวม</span></div>
                <div><strong>{selectedCamp.co2ePerRai.toFixed(3)}</strong><span>tCO2e/ไร่</span></div>
              </div>
              <div className="input-table-wrap">
                <table className="input-table">
                  <thead>
                    <tr>
                      <th>รหัสแปลง</th>
                      <th>ชื่อแปลง</th>
                      <th>เกษตรกร</th>
                      <th>พื้นที่</th>
                      <th>โฉนดที่ผูกอยู่</th>
                      <th>กิจกรรมที่บันทึก</th>
                      <th>CO2e ของแปลง</th>
                      <th>ขอบเขต</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCampFields.map((field) => (
                      <tr
                        key={field.id}
                        className={selectedBoundaryFieldId === field.id ? "active-row" : ""}
                        onClick={() => selectBoundaryField(field.id)}
                      >
                        <td>{field.fieldCode}</td>
                        <td>{field.fieldName}</td>
                        <td>{field.farmerName}</td>
                        <td>{field.areaRai.toLocaleString()} ไร่</td>
                        <td>{field.chanots.map((chanot) => `${chanot.chanotNo} (${chanot.areaRai} ไร่)`).join(", ") || "-"}</td>
                        <td>{field.activitiesLogged.join(", ") || "-"}</td>
                        <td>{field.co2eTotal.toLocaleString()} tCO2e</td>
                        <td>
                          <button
                            type="button"
                            className="map-zoom-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectBoundaryField(field.id);
                            }}
                            title="ซูมไปที่ขอบเขตแปลง"
                          >
                            <MapPinned size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!displayCampFields.length && (
                      <tr><td colSpan={8}>ยังไม่มี mock รายแปลงสำหรับขอบเขตที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="mini-stat-grid wide">
                <div><strong>{campOverview.totalCamps.toLocaleString()}</strong><span>แคมป์ทั้งหมด</span></div>
                <div><strong>{campOverview.totalAreaRai.toLocaleString()}</strong><span>ไร่รวม</span></div>
                <div><strong>{campOverview.totalCo2e.toLocaleString()}</strong><span>tCO2e รวม</span></div>
                <div><strong>{campOverview.co2ePerRai.toFixed(3)}</strong><span>tCO2e/ไร่</span></div>
              </div>
              <div className="input-table-wrap">
                <table className="input-table">
                  <thead>
                    <tr>
                      <th>ชื่อแคมป์</th>
                      <th>รหัสแปลง</th>
                      <th>ชื่อแปลง</th>
                      <th>พื้นที่</th>
                      <th>กิจกรรมที่บันทึก</th>
                      <th>CO2e ของแปลง</th>
                      <th>ขอบเขต</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCampFields.map((field) => (
                      <tr
                        key={`scope-${field.id}`}
                        className={selectedBoundaryFieldId === field.id ? "active-row" : ""}
                        onClick={() => selectBoundaryField(field.id)}
                      >
                        <td>{field.campName}</td>
                        <td>{field.fieldCode}</td>
                        <td>{field.fieldName}</td>
                        <td>{field.areaRai.toLocaleString()} ไร่</td>
                        <td>{field.activitiesLogged.join(", ") || "-"}</td>
                        <td>{field.co2eTotal.toLocaleString()} tCO2e</td>
                        <td>
                          <button
                            type="button"
                            className="map-zoom-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectBoundaryField(field.id);
                            }}
                            title="ซูมไปที่ขอบเขตแปลง"
                          >
                            <MapPinned size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!displayCampFields.length && (
                      <tr><td colSpan={7}>ยังไม่มี mock รายแปลงสำหรับขอบเขตที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {hiddenCampFieldCount > 0 && (
            <div className="table-more-row">
              <button type="button" className="run-btn" onClick={() => setShowAllCampRows(true)}>
                ดูข้อมูลทั้งหมดอีก {hiddenCampFieldCount.toLocaleString()} รายการ
              </button>
            </div>
          )}
        </section>

        <section className="card map-card wide-map">
          <ThailandMap
            nodes={nodes}
            selectedId={selected.id}
            onSelect={selectSpatialNode}
            boundaryFields={mapBoundaryFields}
            selectedBoundaryFieldId={activeBoundaryFieldId}
            onSelectBoundaryField={selectBoundaryField}
          />
        </section>

        <section className="card report-toolbar spatial-export-toolbar">
          <div>
            <div className="card-title">เอกสารรายละเอียดรายแปลง</div>
            <p className="muted">Preview PDF ใช้ตรวจรูปแบบเอกสารรายแปลง ส่วน Excel จะ Export เป็น 3 Sheet: Camp Summary, Province Summary และ Plot Detail</p>
            <p className="muted export-preview-note">หมายเหตุ: Word ไม่มี preview แยก เพราะเนื้อหาภายในเหมือน PDF และเตรียมไว้ให้ดาวน์โหลดไปแก้ไขต่อใน Word ได้เอง</p>
          </div>
          <button className="run-all-btn report-generate-btn" type="button" onClick={generateSpatialDocument} disabled={!documentFields.length || generatingDocument}>
            สร้างเอกสารใหม่ (Generate Report)
          </button>
          <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl || generatingDocument || !documentIsCurrent}>Download PDF</button>
          <button className="run-btn word-download-btn" type="button" onClick={downloadWordDraft} disabled={!generatedDocument || !documentIsCurrent}>Download Word</button>
          <button className="run-all-btn excel-download-btn" type="button" onClick={exportExcel} disabled={!generatedExcelRows || !documentIsCurrent}>Export Excel</button>
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
          <div className="card-title">Preview เอกสารรายแปลง</div>
          <p className="muted export-preview-note">Preview ไม่ได้มีการแสดงข้อมูลของ Word เนื่องจากใช้เนื้อหาเดียวกันกับ PDF</p>
          {!generatedDocument && <div className="empty-state">เลือกฟิลเตอร์ให้เรียบร้อย แล้วกดสร้างเอกสารใหม่เพื่อ Render preview</div>}
          <div className="spatial-doc-preview" style={{ display: generatedDocument && activePreviewTab === "pdf" ? undefined : "none" }}>
            {generatingDocument && <div className="empty-state">กำลัง Render PDF preview...</div>}
            <div ref={spatialDocRef}>
              <SpatialDocument title={generatedDocument?.title ?? documentTitle} fields={generatedDocument?.fields ?? []} />
            </div>
          </div>
          {generatedDocument && activePreviewTab === "excel" && generatedExcelRows && (
            <div className="excel-preview">
              <SpatialExcelPreview rows={generatedExcelRows} />
            </div>
          )}
        </section>

        <section className="grid2">
          <article className="card spatial-summary-card">
            <div className="card-title">สรุปรายละเอียดพื้นที่ · {focusNode.name}</div>
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
              <div className="card-title">แผนภูมิวงกลม · สัดส่วนกระบวนการในพื้นที่</div>
              <div className="period-switch spatial-period-switch" role="group" aria-label="เลือกปีข้อมูลแผนภูมิวงกลม">
                <button type="button" className={processPeriod === "baseline" ? "active" : ""} onClick={() => setProcessPeriod("baseline")}>
                  ปีฐาน
                </button>
                <button type="button" className={processPeriod === "current" ? "active" : ""} onClick={() => setProcessPeriod("current")}>
                  ปีดำเนินการ
                </button>
              </div>
            </div>
            <ProcessDoughnut
              title={`${focusNode.name} · ${processPeriodLabel}`}
              data={processBreakdownForPeriod}
              comparisonData={processComparisonBreakdown}
            />
          </article>
        </section>

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
      </div>
    </div>
  );
}
