import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ProcessInputComparisonBar } from "../components/charts/ProcessInputComparisonBar";
import { CaneTypeSummaryPanel } from "../components/common/CaneTypeSummaryPanel";
import {
  getCampCarbonSummaries,
  getCampFieldCarbonDetails,
  getCaneTypeSummaries,
  getCfProcessActivities,
  getOverviewKpi,
  getProcessInputComparisons,
} from "../services/dashboardApi";
import type {
  ActivityValue,
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

function sumEmission(rows: ProcessActivityBreakdown[]) {
  return rows.reduce((sum, row) => sum + row.totalEmission, 0);
}

function diffLabel(baseline: number, current: number) {
  const diff = baseline - current;
  const pct = baseline ? (diff / baseline) * 100 : 0;
  return {
    diff,
    pct,
    text: `${diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e (${Math.abs(pct).toFixed(1)}%)`,
  };
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function currentYearFrom(rows: ProcessActivityBreakdown[]) {
  const years = rows.filter((row) => row.year !== "baseline_avg").map((row) => row.year).sort();
  return years.at(-1) ?? "";
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

function FootprintReportDocument({
  scopeLabel,
  currentYear,
  caneLabel,
  baselineTotal,
  currentTotal,
  reductionText,
  processRows,
  caneRows,
}: {
  scopeLabel: string;
  currentYear: string;
  caneLabel: string;
  baselineTotal: number;
  currentTotal: number;
  reductionText: string;
  processRows: FootprintProcessReportRow[];
  caneRows: CaneProcessReportRow[];
}) {
  return (
    <div className="pdd-paper footprint-paper">
      <div className="pdd-doc-header">
        <div>Carbon Footprint Analytical Report</div>
        <div>ไร่บริษัทกลุ่มมิตรผล</div>
        <div>รายงานเชิงรายละเอียดรายกระบวนการ ประเภทอ้อย และค่ากิจกรรมที่ใช้คำนวณ</div>
      </div>

      <h2>1. สรุปขอบเขตรายงาน</h2>
      <table className="report-table">
        <tbody>
          <tr><th>ขอบเขตข้อมูล</th><td>{scopeLabel}</td><th>ประเภทอ้อย</th><td>{caneLabel}</td></tr>
          <tr><th>ปีฐาน</th><td>{formatNumber(baselineTotal)} tCO2e</td><th>ปีดำเนินโครงการ {currentYear}</th><td>{formatNumber(currentTotal)} tCO2e</td></tr>
          <tr><th>ผลต่าง</th><td colSpan={3}>{reductionText}</td></tr>
        </tbody>
      </table>

      <h2>2. สรุปรายกระบวนการ</h2>
      <table className="report-table">
        <thead>
          <tr>
            <th>กระบวนการ</th>
            <th>กิจกรรมหลัก</th>
            <th>ปีฐาน</th>
            <th>ปีดำเนินโครงการ</th>
            <th>ผลต่าง</th>
            <th>สัดส่วน</th>
            <th>ปุ๋ย kg</th>
            <th>น้ำมัน L</th>
          </tr>
        </thead>
        <tbody>
          {processRows.map((row) => (
            <tr key={`paper-process-${row.process}`}>
              <td>{row.process}</td>
              <td>{row.activity}</td>
              <td>{formatNumber(row.baselineEmission)}</td>
              <td>{formatNumber(row.currentEmission)}</td>
              <td>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</td>
              <td>{row.share.toFixed(1)}%</td>
              <td>{formatNumber(row.inputRow?.baselineFertilizerKg ?? 0, 1)} / {formatNumber(row.inputRow?.currentFertilizerKg ?? 0, 1)}</td>
              <td>{formatNumber(row.inputRow?.baselineFuelLiter ?? 0, 1)} / {formatNumber(row.inputRow?.currentFuelLiter ?? 0, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. รายละเอียดประเภทอ้อย x กระบวนการ</h2>
      <table className="report-table compact-report-table">
        <thead>
          <tr>
            <th>ประเภทอ้อย</th>
            <th>กระบวนการ</th>
            <th>ปีฐาน</th>
            <th>ปีดำเนินโครงการ</th>
            <th>ผลต่าง</th>
            <th>สัดส่วนในประเภท</th>
            <th>สัดส่วนรวม</th>
          </tr>
        </thead>
        <tbody>
          {caneRows.map((row) => (
            <tr key={`paper-cane-${row.cane.name}-${row.process}`}>
              <td>{row.cane.name} ({row.cane.percent.toFixed(1)}%)</td>
              <td>{row.process}</td>
              <td>{formatNumber(row.baselineEmission)}</td>
              <td>{formatNumber(row.currentEmission)}</td>
              <td>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</td>
              <td>{row.shareInCane.toFixed(1)}%</td>
              <td>{row.shareInScope.toFixed(1)}%</td>
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
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

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
        const caneBaselineTotal = baselineTotal * (cane.percent / 100);
        const caneCurrentTotal = currentTotal * (cane.percent / 100);
        return currentRows.map((currentRow) => {
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
            caneBaselineTotal,
            caneCurrentTotal,
          };
        });
      });
  }, [baselineRows, baselineTotal, caneTypeResult.data, currentRows, currentTotal, processInputRows, selectedCaneTypes]);

  const processRows = currentRows.map((currentRow) => {
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

  const currentDoughnut: ActivityValue[] = currentRows.map((row) => ({ name: row.process, emission: row.totalEmission }));
  const selectedCaneLabel = caneFilter === "all" ? "รวมทุกประเภทอ้อย" : selectedCaneTypes.map((item) => item.name).join(", ") || "-";

  useEffect(() => {
    if (!reportPaperRef.current || !processRows.length) return;
    let revoked = "";
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
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [baselineTotal, caneFilter, caneProcessRows.length, currentTotal, currentYear, processRows.length, scope, selectedFieldId]);

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "carbon-footprint-detail-report.pdf";
    a.click();
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

        <div className="pdf-render-source">
          <div ref={reportPaperRef}>
            <FootprintReportDocument
              scopeLabel={selectedScopeLabel}
              currentYear={currentYear}
              caneLabel={selectedCaneLabel}
              baselineTotal={baselineTotal}
              currentTotal={currentTotal}
              reductionText={reduction.text}
              processRows={processRows}
              caneRows={caneProcessRows}
            />
          </div>
        </div>

        <section className="card report-toolbar">
          <div>
            <div className="card-title">เอกสารรายงาน</div>
            <p className="muted">พรีวิวและดาวน์โหลดรายงาน Carbon Footprint แบบจัดหน้าเอกสาร</p>
          </div>
          <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl}>Download PDF</button>
        </section>

        <section className="card process-scope-panel footprint-report-filter">
          <div>
            <div className="card-title">ตัวกรองรายงาน</div>
            <p className="muted">เลือกขอบเขตข้อมูลและประเภทอ้อย เพื่อดูรายละเอียดรายกระบวนการเทียบปีฐานกับปีดำเนินโครงการ</p>
          </div>
          <label>
            ขอบเขตข้อมูล
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as ScopeValue);
                setSelectedFieldId("all");
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
            <select value={selectedFieldId} disabled={!selectedCampId} onChange={(event) => setSelectedFieldId(event.target.value)}>
              <option value="all">{selectedCampId ? "ทุกแปลงในแคมป์" : "เลือกแคมป์ก่อน"}</option>
              {fieldsInCamp.map((field) => (
                <option key={field.id} value={field.id}>{field.fieldCode} · {field.fieldName}</option>
              ))}
            </select>
          </label>
          <label>
            ประเภทอ้อย
            <select value={caneFilter} onChange={(event) => setCaneFilter(event.target.value)}>
              <option value="all">อ้อยปลูก + อ้อยตอ + พื้นที่พักดิน</option>
              {caneTypeResult.data.map((cane) => (
                <option key={cane.name} value={cane.name}>{cane.name}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="process-summary-grid">
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
            <span>ปีดำเนินโครงการ {currentYear}</span>
            <strong>{formatNumber(currentTotal)}</strong>
            <small>tCO2e</small>
          </article>
          <article>
            <span>{reduction.diff >= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span>
            <strong className={reduction.diff >= 0 ? "green-text" : "red-text"}>{formatNumber(Math.abs(reduction.diff))}</strong>
            <small>{Math.abs(reduction.pct).toFixed(1)}% · tCO2e</small>
          </article>
        </section>

        <CaneTypeSummaryPanel result={caneTypeResult} showSource={false} />

        <section className="card pdf-preview footprint-pdf-preview full-span">
          <div className="card-title">PDF Preview · รายงานคาร์บอนฟุตพริ้นท์</div>
          {pdfUrl ? <iframe title="Carbon Footprint PDF Preview" src={pdfUrl} /> : <div className="empty-state">กำลังเตรียม preview...</div>}
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title">สัดส่วน CO2e รายกระบวนการ · {selectedScopeLabel}</div>
            <ProcessDoughnut data={currentDoughnut} />
          </article>
          <article className="card">
            <div className="card-title">เทียบรายกระบวนการ · ปีฐาน vs ปีดำเนินโครงการ</div>
            <ActivityGroupedBar baseline={baselineRows} current={currentRows} />
            <div className="summary-list">
              <div><span>กระบวนการปล่อยสูงสุด</span><strong>{topProcess?.process ?? "-"}</strong></div>
              <div><span>กระบวนการปล่อยต่ำสุด</span><strong>{lowProcess?.process ?? "-"}</strong></div>
              <div><span>ภาพรวมการเปลี่ยนแปลง</span><strong className={reduction.diff >= 0 ? "green-text" : "red-text"}>{reduction.text}</strong></div>
            </div>
          </article>
        </section>

        <section className="card full-span">
          <div className="card-title">สรุปรายกระบวนการ</div>
          <div className="input-table-wrap">
            <table className="input-table">
              <thead>
                <tr>
                  <th>กระบวนการ</th>
                  <th>กิจกรรมย่อยหลัก</th>
                  <th>ปีฐาน</th>
                  <th>ปีดำเนินโครงการ</th>
                  <th>ผลต่าง</th>
                  <th>สัดส่วนในปีโครงการ</th>
                  <th>ปุ๋ยปีฐาน / ปีโครงการ</th>
                  <th>น้ำมันปีฐาน / ปีโครงการ</th>
                </tr>
              </thead>
              <tbody>
                {processRows.map((row) => (
                  <tr key={row.process}>
                    <td>{row.process}</td>
                    <td>{row.activity}</td>
                    <td>{formatNumber(row.baselineEmission)} tCO2e</td>
                    <td>{formatNumber(row.currentEmission)} tCO2e</td>
                    <td className={row.diff >= 0 ? "green-text" : "red-text"}>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</td>
                    <td>{row.share.toFixed(1)}%</td>
                    <td>{formatNumber(row.inputRow?.baselineFertilizerKg ?? 0, 1)} / {formatNumber(row.inputRow?.currentFertilizerKg ?? 0, 1)} kg</td>
                    <td>{formatNumber(row.inputRow?.baselineFuelLiter ?? 0, 1)} / {formatNumber(row.inputRow?.currentFuelLiter ?? 0, 1)} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">รายละเอียดประเภทอ้อย x กระบวนการ</div>
          <div className="input-table-wrap">
            <table className="input-table">
              <thead>
                <tr>
                  <th>ประเภทอ้อย</th>
                  <th>สัดส่วนพื้นที่</th>
                  <th>กระบวนการ</th>
                  <th>กิจกรรมย่อยหลัก</th>
                  <th>ปีฐาน</th>
                  <th>ปีดำเนินโครงการ</th>
                  <th>ผลต่าง</th>
                  <th>สัดส่วนในประเภทอ้อย</th>
                  <th>สัดส่วนเทียบทั้งขอบเขต</th>
                  <th>ปุ๋ย kg</th>
                  <th>น้ำมัน L</th>
                </tr>
              </thead>
              <tbody>
                {caneProcessRows.map((row) => (
                  <tr key={`${row.cane.name}-${row.process}`}>
                    <td>{row.cane.name}</td>
                    <td>{row.cane.percent.toFixed(1)}% · {formatNumber(row.cane.areaRai, 1)} ไร่</td>
                    <td>{row.process}</td>
                    <td>{row.activity}</td>
                    <td>{formatNumber(row.baselineEmission)} tCO2e</td>
                    <td>{formatNumber(row.currentEmission)} tCO2e</td>
                    <td className={row.diff >= 0 ? "green-text" : "red-text"}>{row.diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatNumber(Math.abs(row.diff))}</td>
                    <td>{row.shareInCane.toFixed(1)}%</td>
                    <td>{row.shareInScope.toFixed(1)}%</td>
                    <td>{formatNumber(row.baselineFertilizerKg, 1)} / {formatNumber(row.currentFertilizerKg, 1)}</td>
                    <td>{formatNumber(row.baselineFuelLiter, 1)} / {formatNumber(row.currentFuelLiter, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">ปุ๋ยและน้ำมันรายกระบวนการ · ค่าใช้งานจริงก่อนแปลงเป็นคาร์บอน</div>
          <ProcessInputComparisonBar data={processInputRows} />
        </section>
      </div>
    </div>
  );
}
