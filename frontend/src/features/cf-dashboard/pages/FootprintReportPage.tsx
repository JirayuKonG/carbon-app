import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import {
  getCampCarbonSummaries,
  getCampFieldCarbonDetails,
  getCaneTypeSummaries,
  getCfProcessActivities,
  getOverviewKpi,
  getProcessInputComparisons,
} from "../services/dashboardApi";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import type {
  CampCarbonSummary,
  CampFieldCarbonDetail,
  CaneTypeSummary,
  DataResult,
  OverviewKpi,
  ProcessActivityBreakdown,
  ProcessInputComparison,
} from "../types/dashboard";
import "../cf-dashboard.css";

type ScopeValue = "all" | `camp-${number}`;
type CaneFilter = "all" | string;
type FootprintPreviewTab = "pdf" | "word" | "excel";

const emptyKpi: OverviewKpi = {
  baselineAvgEmission: 0,
  currentEmission: 0,
  currentYear: "-",
  machineEmission: 0,
  inputEmission: 0,
  fertilizerAmountKg: 0,
  fertilizerEmission: 0,
  areaRai: 0,
  yieldTon: 0,
  co2ePerTon: 0,
  farmers: 0,
  fields: 0,
  years: [],
  baselineYears: [],
};

interface FootprintProcessReportRow {
  process: string;
  baselineEmission: number;
  currentEmission: number;
  diff: number;
  share: number;
  activity: string;
  inputRow?: ProcessInputComparison;
}

interface CaneProcessReportRow {
  cane: CaneTypeSummary;
  process: string;
  activity: string;
  baselineEmission: number;
  currentEmission: number;
  diff: number;
  shareInCane: number;
  shareInScope: number;
  baselineFertilizerKg: number;
  currentFertilizerKg: number;
  baselineFuelLiter: number;
  currentFuelLiter: number;
}

interface FootprintReportSnapshot {
  id: string;
  scopeLabel: string;
  currentYear: string;
  caneLabel: string;
  baselineTotal: number;
  currentTotal: number;
  reduction: ReturnType<typeof diffLabel>;
  processRows: FootprintProcessReportRow[];
  hotspotRows: FootprintProcessReportRow[];
  caneRows: CaneProcessReportRow[];
  inputs: ProcessInputComparison[];
  kpi: OverviewKpi;
}

function sumEmission(rows: ProcessActivityBreakdown[]) {
  return rows.reduce((sum, row) => sum + row.totalEmission, 0);
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function diffLabel(baseline: number, current: number) {
  const diff = baseline - current;
  const pct = baseline ? (diff / baseline) * 100 : 0;
  return {
    diff,
    pct,
    text: `${diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${formatNumber(Math.abs(diff))} tCO2e (${Math.abs(pct).toFixed(1)}%)`,
  };
}

function currentYearFrom(rows: ProcessActivityBreakdown[]) {
  const years = rows.filter((row) => row.year !== "baseline_avg").map((row) => row.year).sort();
  return years[years.length - 1] ?? "";
}

function fieldProcessRows(field: CampFieldCarbonDetail, year: string, totalEmission: number): ProcessActivityBreakdown[] {
  const sourceTotal = field.processBreakdown.reduce((sum, item) => sum + item.emission, 0) || 1;
  return field.processBreakdown.map((item) => {
    const emission = Number(((item.emission / sourceTotal) * totalEmission).toFixed(2));
    return {
      year,
      process: item.name,
      totalEmission: emission,
      activities: [{ name: item.name, emission }],
    };
  });
}

function scaleInputsForField(data: ProcessInputComparison[], field?: CampFieldCarbonDetail): ProcessInputComparison[] {
  if (!field) return data;
  const baselineFactor = field.baselineEmission / 896;
  const currentFactor = field.currentEmission / 723;
  return data.map((item) => ({
    process: item.process,
    baselineFertilizerKg: Number((item.baselineFertilizerKg * baselineFactor).toFixed(1)),
    currentFertilizerKg: Number((item.currentFertilizerKg * currentFactor).toFixed(1)),
    baselineFuelLiter: Number((item.baselineFuelLiter * baselineFactor).toFixed(1)),
    currentFuelLiter: Number((item.currentFuelLiter * currentFactor).toFixed(1)),
  }));
}

function topActivity(row?: ProcessActivityBreakdown) {
  return [...(row?.activities ?? [])].sort((a, b) => b.emission - a.emission)[0]?.name ?? "-";
}

function shareValue(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

function rowsForSheet<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows.length ? rows.map((row) => ({ ...row }) as Record<string, unknown>) : [{}];
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportSections() {
  return [
    "1. ข้อมูลหน้าปกรายงานและขอบเขตพื้นที่",
    "2. Executive summary สรุปผลรวม ผู้เกี่ยวข้อง พื้นที่ ปีฐาน และปีรายงาน",
    "3. ขอบเขตข้อมูล วิธีคำนวณ และแหล่งข้อมูลที่ใช้",
    "4. ผลคาร์บอนฟุตพริ้นท์รวม เทียบปีฐานกับปีรายงาน",
    "5. Hotspot รายกระบวนการที่ควรจัดการก่อน",
    "6. รายละเอียดตามประเภทอ้อยและสัดส่วนพื้นที่",
    "7. ปัจจัยกิจกรรมสำคัญ เช่น ปุ๋ย น้ำมัน และกิจกรรมหลัก",
    "8. ข้อสังเกต แนวทางลดการปล่อย และรายการหลักฐานแนบ",
  ];
}

function footprintWordHtml({
  scopeLabel,
  currentYear,
  caneLabel,
  baselineTotal,
  currentTotal,
  reductionText,
  processRows,
  caneRows,
  inputs,
  kpi,
}: {
  scopeLabel: string;
  currentYear: string;
  caneLabel: string;
  baselineTotal: number;
  currentTotal: number;
  reductionText: string;
  processRows: FootprintProcessReportRow[];
  caneRows: CaneProcessReportRow[];
  inputs: ProcessInputComparison[];
  kpi: OverviewKpi;
}) {
  const processHtml = processRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.process)}</td>
      <td>${escapeHtml(row.activity)}</td>
      <td>${formatNumber(row.baselineEmission)}</td>
      <td>${formatNumber(row.currentEmission)}</td>
      <td>${row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${formatNumber(Math.abs(row.diff))}</td>
      <td>${row.share.toFixed(1)}%</td>
    </tr>
  `).join("");

  const caneHtml = caneRows.map((row, index, rows) => {
    const isFirstCaneRow = index === 0 || rows[index - 1].cane.name !== row.cane.name;
    const rowSpan = rows.filter((item) => item.cane.name === row.cane.name).length;
    return `
    <tr>
      ${isFirstCaneRow ? `<td rowspan="${rowSpan}">${escapeHtml(row.cane.name)}</td><td rowspan="${rowSpan}">${row.cane.percent.toFixed(1)}%</td>` : ""}
      <td>${escapeHtml(row.process)}</td>
      <td>${formatNumber(row.currentEmission)}</td>
      <td>${row.shareInScope.toFixed(1)}%</td>
    </tr>
  `;
  }).join("");

  const inputHtml = inputs.map((row) => `
    <tr>
      <td>${escapeHtml(row.process)}</td>
      <td>${formatNumber(row.baselineFertilizerKg, 1)}</td>
      <td>${formatNumber(row.currentFertilizerKg, 1)}</td>
      <td>${formatNumber(row.baselineFuelLiter, 1)}</td>
      <td>${formatNumber(row.currentFuelLiter, 1)}</td>
    </tr>
  `).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: "TH Sarabun New", "Noto Sans Thai", Arial, sans-serif; font-size: 16px; color: #111827; }
          h1 { font-size: 26px; margin-bottom: 4px; }
          h2 { font-size: 20px; margin-top: 22px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          p { line-height: 1.55; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
          th, td { border: 1px solid #94a3b8; padding: 6px 8px; vertical-align: top; }
          th { background: #eef6ff; }
          .muted { color: #64748b; }
        </style>
      </head>
      <body>
        <h1>รายงานคาร์บอนฟุตพริ้นท์ ไร่บริษัทกลุ่มมิตรผล</h1>
        <p class="muted">เอกสารฉบับร่างจาก Carbon Analytics Dashboard สำหรับตรวจทานและปรับแก้ใน Word</p>

        <h2>1. ขอบเขตรายงาน</h2>
        <table>
          <tr><th>ขอบเขตข้อมูล</th><td>${escapeHtml(scopeLabel)}</td><th>ประเภทอ้อย</th><td>${escapeHtml(caneLabel)}</td></tr>
          <tr><th>ปีรายงาน</th><td>${escapeHtml(currentYear)}</td><th>พื้นที่รวม</th><td>${formatNumber(kpi.areaRai, 1)} ไร่</td></tr>
          <tr><th>เกษตรกร</th><td>${formatNumber(kpi.farmers, 0)} ราย</td><th>แปลง</th><td>${formatNumber(kpi.fields, 0)} แปลง</td></tr>
        </table>

        <h2>2. Executive summary</h2>
        <table>
          <tr><th>ปีฐาน</th><td>${formatNumber(baselineTotal)} tCO2e</td></tr>
          <tr><th>ปีรายงาน</th><td>${formatNumber(currentTotal)} tCO2e</td></tr>
          <tr><th>ผลต่าง</th><td>${escapeHtml(reductionText)}</td></tr>
          <tr><th>Intensity</th><td>${formatNumber(kpi.co2ePerTon, 3)} tCO2e/ตันอ้อย</td></tr>
        </table>

        <h2>3. ลำดับหัวข้อที่ควรมีในรายงาน</h2>
        <ol>${reportSections().map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>

        <h2>4. Hotspot รายกระบวนการ</h2>
        <table><thead><tr><th>กระบวนการ</th><th>กิจกรรมหลัก</th><th>ปีฐาน</th><th>ปีรายงาน</th><th>ผลต่าง</th><th>สัดส่วน</th></tr></thead><tbody>${processHtml}</tbody></table>

        <h2>5. ประเภทอ้อย x กระบวนการ</h2>
        <table><thead><tr><th>ประเภทอ้อย</th><th>สัดส่วนพื้นที่</th><th>กระบวนการ</th><th>ปีรายงาน</th><th>สัดส่วนรวม</th></tr></thead><tbody>${caneHtml}</tbody></table>

        <h2>6. ปัจจัยกิจกรรมหลัก</h2>
        <table><thead><tr><th>กระบวนการ</th><th>ปุ๋ยปีฐาน kg</th><th>ปุ๋ยปีรายงาน kg</th><th>น้ำมันปีฐาน L</th><th>น้ำมันปีรายงาน L</th></tr></thead><tbody>${inputHtml}</tbody></table>

        <h2>7. หลักฐานที่ควรแนบ</h2>
        <ul>
          <li>ทะเบียนแปลง พิกัด พื้นที่ไร่ และเจ้าของแปลง</li>
          <li>บันทึกกิจกรรมรายแปลง ปริมาณปุ๋ย น้ำมัน เครื่องจักร และวันที่ดำเนินงาน</li>
          <li>Emission factor, GWP และสมมติฐานที่ใช้คำนวณ</li>
          <li>รายงานตรวจทานข้อมูลและผู้รับผิดชอบการอนุมัติ</li>
        </ul>
      </body>
    </html>
  `;
}

function FootprintReportDocument({
  scopeLabel,
  currentYear,
  caneLabel,
  baselineTotal,
  currentTotal,
  reduction,
  processRows,
  caneRows,
  inputs,
  kpi,
}: {
  scopeLabel: string;
  currentYear: string;
  caneLabel: string;
  baselineTotal: number;
  currentTotal: number;
  reduction: ReturnType<typeof diffLabel>;
  processRows: FootprintProcessReportRow[];
  caneRows: CaneProcessReportRow[];
  inputs: ProcessInputComparison[];
  kpi: OverviewKpi;
}) {
  const topRows = processRows.slice(0, 4);

  return (
    <div className="pdd-paper footprint-paper">
      <div className="pdd-doc-header">
        <div>Carbon Footprint Report</div>
        <div>รายงานคาร์บอนฟุตพริ้นท์ ไร่บริษัทกลุ่มมิตรผล</div>
        <div>เอกสารสรุปผู้บริหาร ขอบเขตข้อมูล Hotspot และรายการหลักฐานแนบ</div>
      </div>

      <h2>1. ขอบเขตและข้อมูลตั้งต้น</h2>
      <table className="report-table">
        <tbody>
          <tr><th>ขอบเขตข้อมูล</th><td>{scopeLabel}</td><th>ประเภทอ้อย</th><td>{caneLabel}</td></tr>
          <tr><th>ปีรายงาน</th><td>{currentYear}</td><th>พื้นที่รวม</th><td>{formatNumber(kpi.areaRai, 1)} ไร่</td></tr>
          <tr><th>เกษตรกร / แปลง</th><td>{formatNumber(kpi.farmers, 0)} ราย / {formatNumber(kpi.fields, 0)} แปลง</td><th>ผลผลิต</th><td>{formatNumber(kpi.yieldTon, 1)} ตัน</td></tr>
        </tbody>
      </table>

      <h2>2. Executive summary</h2>
      <div className="footprint-doc-block-grid">
        <div><span>ปีฐาน</span><strong>{formatNumber(baselineTotal)} tCO2e</strong></div>
        <div><span>ปีรายงาน {currentYear}</span><strong>{formatNumber(currentTotal)} tCO2e</strong></div>
        <div><span>ผลต่าง</span><strong>{reduction.text}</strong></div>
        <div><span>Intensity</span><strong>{formatNumber(kpi.co2ePerTon, 3)} tCO2e/ตันอ้อย</strong></div>
      </div>

      <h2>3. ลำดับหัวข้อรายงานที่แนะนำ</h2>
      <ol className="footprint-doc-order">
        {reportSections().map((item) => <li key={item}>{item}</li>)}
      </ol>

      <h2>4. Hotspot ที่ควรจัดการก่อน</h2>
      <table className="report-table">
        <thead>
          <tr><th>ลำดับ</th><th>กระบวนการ</th><th>กิจกรรมหลัก</th><th>ปีรายงาน</th><th>สัดส่วน</th><th>ผลต่างจากปีฐาน</th></tr>
        </thead>
        <tbody>
          {topRows.map((row, index) => (
            <tr key={`doc-hotspot-${row.process}`}>
              <td>{index + 1}</td>
              <td>{row.process}</td>
              <td>{row.activity}</td>
              <td>{formatNumber(row.currentEmission)} tCO2e</td>
              <td>{row.share.toFixed(1)}%</td>
              <td>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>5. สรุปตามประเภทอ้อย</h2>
      <table className="report-table compact-report-table">
        <thead>
          <tr><th>ประเภทอ้อย</th><th>กระบวนการ</th><th>ปีรายงาน</th><th>สัดส่วนในประเภท</th><th>สัดส่วนเทียบทั้งขอบเขต</th></tr>
        </thead>
        <tbody>
          {caneRows.slice(0, 16).map((row) => (
            <tr key={`doc-cane-${row.cane.name}-${row.process}`}>
              <td>{row.cane.name} ({row.cane.percent.toFixed(1)}%)</td>
              <td>{row.process}</td>
              <td>{formatNumber(row.currentEmission)} tCO2e</td>
              <td>{row.shareInCane.toFixed(1)}%</td>
              <td>{row.shareInScope.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>6. ปัจจัยกิจกรรมและหลักฐานที่ควรแนบ</h2>
      <table className="report-table compact-report-table">
        <thead>
          <tr><th>กระบวนการ</th><th>ปุ๋ยปีฐาน / ปีรายงาน</th><th>น้ำมันปีฐาน / ปีรายงาน</th></tr>
        </thead>
        <tbody>
          {inputs.map((row) => (
            <tr key={`doc-input-${row.process}`}>
              <td>{row.process}</td>
              <td>{formatNumber(row.baselineFertilizerKg, 1)} / {formatNumber(row.currentFertilizerKg, 1)} kg</td>
              <td>{formatNumber(row.baselineFuelLiter, 1)} / {formatNumber(row.currentFuelLiter, 1)} L</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CfFootprintReportPage() {
  const reportPaperRef = useRef<HTMLDivElement>(null);
  const [kpi, setKpi] = useState<DataResult<OverviewKpi>>({ data: emptyKpi, source: "mock" });
  const [activities, setActivities] = useState<ProcessActivityBreakdown[]>([]);
  const [inputs, setInputs] = useState<ProcessInputComparison[]>([]);
  const [campResult, setCampResult] = useState<DataResult<CampCarbonSummary[]>>({ data: [], source: "mock" });
  const [fieldResult, setFieldResult] = useState<DataResult<CampFieldCarbonDetail[]>>({ data: [], source: "mock" });
  const [caneTypeResult, setCaneTypeResult] = useState<DataResult<CaneTypeSummary[]>>({ data: [], source: "mock" });
  const [scope, setScope] = useState<ScopeValue>("all");
  const [selectedFieldId, setSelectedFieldId] = useState("all");
  const [caneFilter, setCaneFilter] = useState<CaneFilter>("all");
  const [generatedReport, setGeneratedReport] = useState<FootprintReportSnapshot | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<FootprintPreviewTab>("pdf");
  const [reportRenderId, setReportRenderId] = useState(0);
  const [pdfUrl, setPdfUrl] = useState("");
  const [generateNotice, setGenerateNotice] = useState("");
  const [error, setError] = useState("");
  const [generatingPreview, setGeneratingPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      getOverviewKpi(),
      getCfProcessActivities("process"),
      getProcessInputComparisons(),
      getCampCarbonSummaries(),
      getCampFieldCarbonDetails(),
      getCaneTypeSummaries(),
    ])
      .then(([kpiResult, activityResult, inputResult, campSummaryResult, fieldDetailResult, caneSummaryResult]) => {
        setKpi(kpiResult);
        setActivities(activityResult.data);
        setInputs(inputResult.data);
        setCampResult(campSummaryResult);
        setFieldResult(fieldDetailResult);
        setCaneTypeResult(caneSummaryResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลรายงานไม่สำเร็จ"));
  }, []);

  const currentYear = currentYearFrom(activities) || kpi.data.currentYear;
  const selectedCampId = scope === "all" ? undefined : Number(scope.replace("camp-", ""));
  const selectedCamp = selectedCampId ? campResult.data.find((camp) => camp.campId === selectedCampId) : undefined;
  const fieldsInCamp = selectedCampId ? fieldResult.data.filter((field) => field.campId === selectedCampId) : [];
  const selectedField = selectedFieldId === "all" ? undefined : fieldResult.data.find((field) => field.id === selectedFieldId);

  const baselineRows = selectedField
    ? fieldProcessRows(selectedField, "baseline_avg", selectedField.baselineEmission)
    : selectedCamp
    ? selectedCamp.baselineProcessActivities
    : activities.filter((item) => item.year === "baseline_avg");
  const currentRows = selectedField
    ? fieldProcessRows(selectedField, currentYear, selectedField.currentEmission)
    : selectedCamp
    ? selectedCamp.currentProcessActivities
    : activities.filter((item) => item.year === currentYear);
  const processInputRows = selectedField ? scaleInputsForField(inputs, selectedField) : selectedCamp ? selectedCamp.processInputComparisons : inputs;
  const baselineTotal = sumEmission(baselineRows);
  const currentTotal = sumEmission(currentRows);
  const reduction = diffLabel(baselineTotal, currentTotal);
  const processOrder = new Map(sortProcessLabels(currentRows.map((item) => item.process)).map((process, index) => [process, index]));
  const orderedCurrentRows = [...currentRows].sort((a, b) => (processOrder.get(a.process) ?? 0) - (processOrder.get(b.process) ?? 0));
  const topProcess = [...currentRows].sort((a, b) => b.totalEmission - a.totalEmission)[0];
  const lowProcess = [...currentRows].sort((a, b) => a.totalEmission - b.totalEmission)[0];
  const selectedScopeLabel = selectedField?.fieldName ?? selectedCamp?.campName ?? "ภาพรวมทั้งระบบ";
  const selectedCaneTypes = caneTypeResult.data.filter((item) => caneFilter === "all" || item.name === caneFilter);
  const selectedCanePercent = selectedCaneTypes.reduce((sum, item) => sum + item.percent, 0);

  const caneProcessRows = useMemo(() => {
    const selectedNames = new Set(selectedCaneTypes.map((item) => item.name));
    return caneTypeResult.data
      .filter((cane) => selectedNames.has(cane.name))
      .flatMap((cane) => {
        const caneCurrentTotal = currentTotal * (cane.percent / 100);
        return orderedCurrentRows.map((currentRow) => {
          const baselineRow = baselineRows.find((item) => item.process === currentRow.process);
          const inputRow = processInputRows.find((item) => item.process === currentRow.process);
          const baselineEmission = (baselineRow?.totalEmission ?? 0) * (cane.percent / 100);
          const currentEmission = currentRow.totalEmission * (cane.percent / 100);
          return {
            cane,
            process: currentRow.process,
            activity: topActivity(currentRow),
            baselineEmission,
            currentEmission,
            diff: baselineEmission - currentEmission,
            shareInCane: shareValue(currentEmission, caneCurrentTotal),
            shareInScope: shareValue(currentEmission, currentTotal),
            baselineFertilizerKg: (inputRow?.baselineFertilizerKg ?? 0) * (cane.percent / 100),
            currentFertilizerKg: (inputRow?.currentFertilizerKg ?? 0) * (cane.percent / 100),
            baselineFuelLiter: (inputRow?.baselineFuelLiter ?? 0) * (cane.percent / 100),
            currentFuelLiter: (inputRow?.currentFuelLiter ?? 0) * (cane.percent / 100),
          };
        });
      });
  }, [baselineRows, caneTypeResult.data, currentTotal, orderedCurrentRows, processInputRows, selectedCaneTypes]);

  const processRows = orderedCurrentRows
    .map((currentRow) => {
      const baselineRow = baselineRows.find((item) => item.process === currentRow.process);
      const baselineEmission = baselineRow?.totalEmission ?? 0;
      const inputRow = processInputRows.find((item) => item.process === currentRow.process);
      return {
        process: currentRow.process,
        baselineEmission,
        currentEmission: currentRow.totalEmission,
        diff: baselineEmission - currentRow.totalEmission,
        share: shareValue(currentRow.totalEmission, currentTotal),
        activity: topActivity(currentRow),
        inputRow,
      };
    });
  const hotspotRows = [...processRows].sort((a, b) => b.currentEmission - a.currentEmission);

  const selectedCaneLabel = caneFilter === "all" ? "รวมทุกประเภทอ้อย" : selectedCaneTypes.map((item) => item.name).join(", ") || "-";
  const currentReport = useMemo<FootprintReportSnapshot>(() => ({
    id: `${scope}|${selectedFieldId}|${caneFilter}|${currentYear}|${baselineTotal}|${currentTotal}`,
    scopeLabel: selectedScopeLabel,
    currentYear,
    caneLabel: selectedCaneLabel,
    baselineTotal,
    currentTotal,
    reduction,
    processRows,
    hotspotRows,
    caneRows: caneProcessRows,
    inputs: processInputRows,
    kpi: kpi.data,
  }), [
    baselineTotal,
    caneFilter,
    caneProcessRows,
    currentTotal,
    currentYear,
    hotspotRows,
    kpi.data,
    processInputRows,
    processRows,
    reduction,
    scope,
    selectedCaneLabel,
    selectedFieldId,
    selectedScopeLabel,
  ]);

  const wordHtml = useMemo(
    () => footprintWordHtml({
      scopeLabel: generatedReport?.scopeLabel ?? currentReport.scopeLabel,
      currentYear: generatedReport?.currentYear ?? currentReport.currentYear,
      caneLabel: generatedReport?.caneLabel ?? currentReport.caneLabel,
      baselineTotal: generatedReport?.baselineTotal ?? currentReport.baselineTotal,
      currentTotal: generatedReport?.currentTotal ?? currentReport.currentTotal,
      reductionText: (generatedReport?.reduction ?? currentReport.reduction).text,
      processRows: generatedReport?.hotspotRows ?? currentReport.hotspotRows,
      caneRows: generatedReport?.caneRows ?? currentReport.caneRows,
      inputs: generatedReport?.inputs ?? currentReport.inputs,
      kpi: generatedReport?.kpi ?? currentReport.kpi,
    }),
    [currentReport, generatedReport],
  );

  useEffect(() => {
    if (!generatedReport || !reportPaperRef.current || !generatedReport.processRows.length) return;
    let revoked = "";
    setGeneratingPreview(true);
    const timer = window.setTimeout(() => {
      if (!reportPaperRef.current) return;
      html2canvas(reportPaperRef.current, { scale: 1.8, backgroundColor: "#ffffff" }).then((canvas) => {
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
        setGenerateNotice("อัปเดตตัวอย่างรายงานเรียบร้อยแล้ว");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "สร้าง PDF preview ไม่สำเร็จ"))
      .finally(() => setGeneratingPreview(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [generatedReport, reportRenderId]);

  const previewIsCurrent = Boolean(generatedReport && generatedReport.id === currentReport.id);

  const generateReportPreview = () => {
    if (!currentReport.processRows.length) return;
    setGenerateNotice("กำลังสร้างตัวอย่างรายงานตามตัวกรองปัจจุบัน...");
    setGeneratedReport(currentReport);
    setReportRenderId((value) => value + 1);
    setActivePreviewTab("pdf");
  };

  const markFilterChanged = () => {
    setGenerateNotice("ตัวกรองเปลี่ยนแล้ว สรุปด้านซ้ายอัปเดตทันที กดสร้างเอกสารใหม่เมื่อพร้อม");
  };

  const downloadPdf = () => {
    if (!pdfUrl || !previewIsCurrent) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "mitrphol-carbon-footprint-report.pdf";
    a.click();
  };

  const downloadWordDraft = () => {
    if (!generatedReport || !previewIsCurrent) return;
    const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mitrphol-carbon-footprint-report.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!generatedReport || !previewIsCurrent) return;
    const report = generatedReport;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet([{
      scope: report.scopeLabel,
      caneType: report.caneLabel,
      currentYear: report.currentYear,
      baselineTotal: report.baselineTotal,
      currentTotal: report.currentTotal,
      diff: report.reduction.diff,
      diffPercent: report.reduction.pct,
      areaRai: report.kpi.areaRai,
      yieldTon: report.kpi.yieldTon,
      co2ePerTon: report.kpi.co2ePerTon,
    }])), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.hotspotRows.map((row) => ({
      process: row.process,
      mainActivity: row.activity,
      baselineEmission: row.baselineEmission,
      currentEmission: row.currentEmission,
      diff: row.diff,
      sharePercent: row.share,
      baselineFertilizerKg: row.inputRow?.baselineFertilizerKg ?? 0,
      currentFertilizerKg: row.inputRow?.currentFertilizerKg ?? 0,
      baselineFuelLiter: row.inputRow?.baselineFuelLiter ?? 0,
      currentFuelLiter: row.inputRow?.currentFuelLiter ?? 0,
    })))), "Process Hotspot");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.caneRows.map((row) => ({
      caneType: row.cane.name,
      caneAreaPercent: row.cane.percent,
      caneAreaRai: row.cane.areaRai,
      process: row.process,
      baselineEmission: row.baselineEmission,
      currentEmission: row.currentEmission,
      diff: row.diff,
      shareInCanePercent: row.shareInCane,
      shareInScopePercent: row.shareInScope,
    })))), "Cane x Process");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.inputs)), "Activity Inputs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(reportSections().map((section, index) => ({
      order: index + 1,
      section,
    })))), "Report Order");
    XLSX.writeFile(wb, "mitrphol-carbon-footprint-report.xlsx");
  };

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>รายงานคาร์บอนฟุตพริ้นท์ ไร่บริษัทกลุ่มมิตรผล</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        {generatedReport && (
          <div className="pdf-render-source">
            <div ref={reportPaperRef}>
              <FootprintReportDocument
                scopeLabel={generatedReport.scopeLabel}
                currentYear={generatedReport.currentYear}
                caneLabel={generatedReport.caneLabel}
                baselineTotal={generatedReport.baselineTotal}
                currentTotal={generatedReport.currentTotal}
                reduction={generatedReport.reduction}
                processRows={generatedReport.hotspotRows}
                caneRows={generatedReport.caneRows}
                inputs={generatedReport.inputs}
                kpi={generatedReport.kpi}
              />
            </div>
          </div>
        )}

        <section className="card report-toolbar footprint-report-toolbar">
          <div>
            <div className="card-title">เอกสารรายงาน</div>
            <p className="muted">เลือกตัวกรองให้เรียบร้อย แล้วกดสร้างเอกสารใหม่เพื่อ Render PDF, Word และ Excel สำหรับ preview/download</p>
          </div>
          <button className="run-all-btn report-generate-btn" type="button" onClick={generateReportPreview} disabled={!processRows.length || generatingPreview}>
            สร้างเอกสารใหม่ (Generate Report)
          </button>
          <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl || generatingPreview || !previewIsCurrent}>Download PDF</button>
          <button className="run-btn word-download-btn" type="button" onClick={downloadWordDraft} disabled={!generatedReport || !previewIsCurrent}>Download Word</button>
          <button className="run-all-btn excel-download-btn" type="button" onClick={exportExcel} disabled={!generatedReport || !previewIsCurrent}>Export Excel</button>
        </section>

        {generateNotice && <div className="report-generate-notice">{generateNotice}</div>}

        <section className="card process-scope-panel footprint-report-filter">
          <div>
            <div className="card-title">ตัวกรองรายงาน</div>
            <p className="muted">เลือกขอบเขตพื้นที่และประเภทอ้อยเพื่อให้ตัวเลขในรายงาน PDF, Word และ Excel ตรงกัน</p>
          </div>
          <label>
            ขอบเขตข้อมูล
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as ScopeValue);
                setSelectedFieldId("all");
                markFilterChanged();
              }}
            >
              <option value="all">ภาพรวมทั้งระบบ</option>
              {campResult.data.map((camp) => (
                <option key={camp.campId} value={`camp-${camp.campId}`}>{camp.campName}</option>
              ))}
            </select>
          </label>
          <label>
            แปลงในแคมป์
            <select value={selectedFieldId} disabled={!selectedCampId} onChange={(event) => {
              setSelectedFieldId(event.target.value);
              markFilterChanged();
            }}>
              <option value="all">{selectedCampId ? "ทุกแปลงในแคมป์" : "เลือกแคมป์ก่อน"}</option>
              {fieldsInCamp.map((field) => (
                <option key={field.id} value={field.id}>{field.fieldCode} · {field.fieldName}</option>
              ))}
            </select>
          </label>
          <label>
            ประเภทอ้อย
            <select value={caneFilter} onChange={(event) => {
              setCaneFilter(event.target.value);
              markFilterChanged();
            }}>
              <option value="all">อ้อยปลูก + อ้อยตอ + พื้นที่พักดิน</option>
              {caneTypeResult.data.map((cane) => (
                <option key={cane.name} value={cane.name}>{cane.name}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="process-summary-grid footprint-exec-grid">
          <article>
            <span>ขอบเขตรายงาน</span>
            <strong>{selectedScopeLabel}</strong>
            <small>{selectedCanePercent.toFixed(1)}% ของสัดส่วนประเภทอ้อยที่เลือก</small>
          </article>
          <article>
            <span>ปีฐานรวม</span>
            <strong>{formatNumber(baselineTotal)}</strong>
            <small>tCO2e</small>
          </article>
          <article>
            <span>ปีรายงาน {currentYear}</span>
            <strong>{formatNumber(currentTotal)}</strong>
            <small>tCO2e</small>
          </article>
          <article>
            <span>{reduction.diff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span>
            <strong className={reduction.diff >= 0 ? "green-text" : "red-text"}>{formatNumber(Math.abs(reduction.diff))}</strong>
            <small>{Math.abs(reduction.pct).toFixed(1)}% · tCO2e</small>
          </article>
          <article>
            <span>Intensity</span>
            <strong>{formatNumber(kpi.data.co2ePerTon, 3)}</strong>
            <small>tCO2e/ตันอ้อย</small>
          </article>
          <article>
            <span>พื้นที่ / ผลผลิต</span>
            <strong>{formatNumber(kpi.data.areaRai, 0)}</strong>
            <small>ไร่ · {formatNumber(kpi.data.yieldTon, 0)} ตัน</small>
          </article>
          <article>
            <span>Hotspot สูงสุด</span>
            <strong>{topProcess?.process ?? "-"}</strong>
            <small>{formatNumber(topProcess?.totalEmission ?? 0)} tCO2e</small>
          </article>
          <article>
            <span>กระบวนการต่ำสุด</span>
            <strong>{lowProcess?.process ?? "-"}</strong>
            <small>{formatNumber(lowProcess?.totalEmission ?? 0)} tCO2e</small>
          </article>
        </section>

        <section className="card full-span">
          <div className="card-title">Hotspot รายกระบวนการ · แสดงแบบ block summary</div>
          <div className="footprint-block-grid">
            {hotspotRows.map((row, index) => (
              <article key={row.process} className={index === 0 ? "priority" : ""}>
                <div>
                  <span>#{index + 1}</span>
                  <strong>{row.process}</strong>
                </div>
                <p>{row.activity}</p>
                <dl>
                  <div><dt>ปีรายงาน</dt><dd>{formatNumber(row.currentEmission)} tCO2e</dd></div>
                  <div><dt>สัดส่วน</dt><dd>{row.share.toFixed(1)}%</dd></div>
                  <div><dt>เทียบปีฐาน</dt><dd className={row.diff >= 0 ? "green-text" : "red-text"}>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</dd></div>
                  <div><dt>ปุ๋ย / น้ำมัน</dt><dd>{formatNumber(row.inputRow?.currentFertilizerKg ?? 0, 1)} kg · {formatNumber(row.inputRow?.currentFuelLiter ?? 0, 1)} L</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">สรุปประเภทอ้อย x กระบวนการ</div>
          <div className="input-table-wrap">
            <table className="input-table">
              <thead>
                <tr>
                  <th>ประเภทอ้อย</th>
                  <th>สัดส่วนพื้นที่</th>
                  <th>กระบวนการ</th>
                  <th>กิจกรรมหลัก</th>
                  <th>ปีฐาน</th>
                  <th>ปีรายงาน</th>
                  <th>ผลต่าง</th>
                  <th>สัดส่วนในประเภท</th>
                  <th>สัดส่วนรวม</th>
                </tr>
              </thead>
              <tbody>
                {caneProcessRows.map((row, index, rows) => {
                  const isFirstCaneRow = index === 0 || rows[index - 1].cane.name !== row.cane.name;
                  const rowSpan = rows.filter((item) => item.cane.name === row.cane.name).length;
                  return (
                  <tr key={`${row.cane.name}-${row.process}`}>
                    {isFirstCaneRow && (
                      <>
                        <td rowSpan={rowSpan} className="rowspan-cell cane-rowspan-name">{row.cane.name}</td>
                        <td rowSpan={rowSpan} className="rowspan-cell">{row.cane.percent.toFixed(1)}% · {formatNumber(row.cane.areaRai, 1)} ไร่</td>
                      </>
                    )}
                    <td className="process-name-cell">{row.process}</td>
                    <td>{row.activity}</td>
                    <td>{formatNumber(row.baselineEmission)} tCO2e</td>
                    <td>{formatNumber(row.currentEmission)} tCO2e</td>
                    <td className={row.diff >= 0 ? "green-text" : "red-text"}>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</td>
                    <td>{row.shareInCane.toFixed(1)}%</td>
                    <td>{row.shareInScope.toFixed(1)}%</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card report-preview-panel full-span footprint-preview-layout">
          <div className="report-preview-header">
            <div>
              <div className="card-title">Preview & Download</div>
              <p className="muted">
                {generatedReport
                  ? previewIsCurrent
                    ? `ตัวอย่างล่าสุด: ${generatedReport.scopeLabel} · ${generatedReport.caneLabel}`
                    : "ตัวอย่างเอกสารยังเป็นชุดเดิม กด Generate Report เพื่ออัปเดตตามตัวกรองปัจจุบัน"
                  : "ยังไม่มีตัวอย่างเอกสาร กดสร้างเอกสารใหม่เพื่อ Render PDF / Word / Excel"}
              </p>
            </div>
            <div className="report-preview-tabs" role="tablist" aria-label="Carbon Footprint report preview tabs">
              {[
                ["pdf", "PDF"],
                ["word", "Word"],
                ["excel", "Excel"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activePreviewTab === tab}
                  className={activePreviewTab === tab ? "active" : ""}
                  onClick={() => setActivePreviewTab(tab as FootprintPreviewTab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!generatedReport && <div className="empty-state">เลือกตัวกรองด้านบนให้เรียบร้อย แล้วกด “สร้างเอกสารใหม่ (Generate Report)”</div>}
          {generatedReport && activePreviewTab === "pdf" && (
            <div className="pdf-preview">
              {generatingPreview ? <div className="empty-state">กำลัง Render PDF preview...</div> : pdfUrl ? <iframe title="Carbon Footprint PDF Preview" src={pdfUrl} /> : <div className="empty-state">กดสร้างเอกสารใหม่เพื่อเตรียม PDF preview</div>}
            </div>
          )}
          {generatedReport && activePreviewTab === "word" && (
            <div className="word-preview">
              <iframe title="Carbon Footprint Word Preview" srcDoc={wordHtml} />
            </div>
          )}
          {generatedReport && activePreviewTab === "excel" && (
            <div className="excel-preview">
              <div className="excel-sheet-grid">
                <div>
                  <h3>Summary</h3>
                  <table className="report-table">
                    <tbody>
                      <tr><th>Scope</th><td>{generatedReport.scopeLabel}</td></tr>
                      <tr><th>Baseline</th><td>{formatNumber(generatedReport.baselineTotal)} tCO2e</td></tr>
                      <tr><th>Project</th><td>{formatNumber(generatedReport.currentTotal)} tCO2e</td></tr>
                      <tr><th>Diff</th><td>{generatedReport.reduction.text}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3>Process Hotspot</h3>
                  <table className="report-table">
                    <thead><tr><th>Process</th><th>Current</th><th>Share</th></tr></thead>
                    <tbody>
                      {generatedReport.hotspotRows.slice(0, 6).map((row) => (
                        <tr key={`excel-preview-${row.process}`}><td>{row.process}</td><td>{formatNumber(row.currentEmission)}</td><td>{row.share.toFixed(1)}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3>Activity Inputs</h3>
                  <table className="report-table">
                    <thead><tr><th>Process</th><th>Fertilizer</th><th>Fuel</th></tr></thead>
                    <tbody>
                      {generatedReport.inputs.map((row) => (
                        <tr key={`input-preview-${row.process}`}><td>{row.process}</td><td>{formatNumber(row.currentFertilizerKg, 1)} kg</td><td>{formatNumber(row.currentFuelLiter, 1)} L</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
