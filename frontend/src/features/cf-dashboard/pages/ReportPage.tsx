import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { getCfSpatialNodes, getReportSummary } from "../services/dashboardApi";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import type { ProcessEmission, ReportFilter, ReportFilterLevel, ReportSummary, SpatialSummaryNode } from "../types/dashboard";
import "../cf-dashboard.css";

type CascadingReportLevel = Exclude<ReportFilterLevel, "all">;
type PreviewTab = "pdf" | "word" | "excel";
const reportLevelOrder: CascadingReportLevel[] = ["region", "province", "district", "subdistrict", "field"];
type ReportCampNode = SpatialSummaryNode & { campId?: number; campName?: string; fieldCode?: string };
const farmGroupFilterOptions = [
  { value: "dan-chang", label: "ไร่ด่านช้าง" },
  { value: "isan", label: "ไร่อีสาน" },
] as const;

function emptyReportPath(): Record<CascadingReportLevel, string> {
  return {
    region: "",
    province: "",
    district: "",
    subdistrict: "",
    field: "",
  };
}

function diffText(baseline: number, current: number) {
  const diff = baseline - current;
  const pct = baseline ? (diff / baseline) * 100 : 0;
  return `${diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} ${Math.abs(diff).toFixed(2)} tCO2e (${Math.abs(pct).toFixed(1)}%)`;
}

function nodeIdValue(node: SpatialSummaryNode) {
  return node.id.replace(`${node.level}-`, "");
}

function reportNodeCampId(node: SpatialSummaryNode) {
  return String((node as ReportCampNode).campId ?? "");
}

function reportNodeCampName(node: SpatialSummaryNode) {
  return (node as ReportCampNode).campName ?? "";
}

function reportNodeFieldCode(node: SpatialSummaryNode) {
  return (node as ReportCampNode).fieldCode ?? "";
}

function rowsForSheet<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows.length ? rows.map((row) => ({ ...row }) as Record<string, unknown>) : [{}];
}

function reportAreaRai(report: ReportSummary) {
  return report.spatialNodes.find((node) => node.level === "country")?.areaRai ?? report.spatialNodes[0]?.areaRai ?? 0;
}

function reportInputTotals(report: ReportSummary) {
  const inputs = report.processInputs ?? [];
  return {
    baselineFertilizerKg: inputs.reduce((sum, item) => sum + item.baselineFertilizerKg, 0),
    currentFertilizerKg: inputs.reduce((sum, item) => sum + item.currentFertilizerKg, 0),
    baselineFuelLiter: inputs.reduce((sum, item) => sum + item.baselineFuelLiter, 0),
    currentFuelLiter: inputs.reduce((sum, item) => sum + item.currentFuelLiter, 0),
  };
}

function pddEmissionSummary(report: ReportSummary) {
  const totals = reportInputTotals(report);
  const fertilizerRatio = totals.currentFertilizerKg ? totals.baselineFertilizerKg / totals.currentFertilizerKg : 1;
  const fuelRatio = totals.currentFuelLiter ? totals.baselineFuelLiter / totals.currentFuelLiter : 1;
  const n2oProject = report.kpi.fertilizerEmission;
  const n2oBaseline = n2oProject * fertilizerRatio;
  const co2FuelProject = report.kpi.machineEmission;
  const co2FuelBaseline = co2FuelProject * fuelRatio;
  const areaRai = reportAreaRai(report);
  const socRemoval = Math.max(report.kpi.baselineAvgEmission - report.kpi.currentEmission, 0) * 0.35;
  const leakage = 0;

  return {
    areaRai,
    n2oBaseline,
    n2oProject,
    n2oReduction: n2oBaseline - n2oProject,
    co2FuelBaseline,
    co2FuelProject,
    co2FuelReduction: co2FuelBaseline - co2FuelProject,
    baselineEmission: report.kpi.baselineAvgEmission,
    projectEmission: report.kpi.currentEmission,
    leakage,
    socRemoval,
    emissionReduction: report.kpi.baselineAvgEmission - report.kpi.currentEmission,
    totalReduction: report.kpi.baselineAvgEmission - report.kpi.currentEmission + socRemoval - leakage,
  };
}

function numberCell(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sortReportProcessRows<T extends { process: string }>(rows: T[]) {
  const order = new Map(sortProcessLabels(rows.map((row) => row.process)).map((process, index) => [process, index]));
  return [...rows].sort((a, b) => (order.get(a.process) ?? 0) - (order.get(b.process) ?? 0));
}

function processComparisonGroups(report: ReportSummary) {
  const grouped = new Map<string, ProcessEmission[]>();
  sortReportProcessRows(report.process).forEach((row) => {
    grouped.set(row.process, [...(grouped.get(row.process) ?? []), row]);
  });
  return Array.from(grouped.entries()).map(([process, rows]) => {
    const baselineAverage = rows.find((row) => row.year === "baseline_avg");
    const baselineYears = rows.filter((row) => row.isBaseline && row.year !== "baseline_avg");
    const projectRows = rows.filter((row) => !row.isBaseline);
    return { process, rows: [baselineAverage, ...baselineYears, ...projectRows].filter((row): row is ProcessEmission => Boolean(row)) };
  });
}

function processTypeLabel(row: ProcessEmission) {
  if (row.year === "baseline_avg") return "Baseline avg";
  return row.isBaseline ? "Baseline year" : "Project year";
}

function getYearGroupRowSpanInfo(groupRows: ProcessEmission[], index: number) {
  const row = groupRows[index];
  if (!row) return { shouldRender: false, rowSpan: 1 };
  if (row.year === "baseline_avg") {
    return { shouldRender: true, rowSpan: 1 };
  }
  if (row.isBaseline) {
    const baselineYears = groupRows.filter(r => r.isBaseline && r.year !== "baseline_avg");
    const firstBaselineYearIndex = groupRows.findIndex(r => r.isBaseline && r.year !== "baseline_avg");
    return {
      shouldRender: index === firstBaselineYearIndex,
      rowSpan: baselineYears.length,
    };
  } else {
    const projectRows = groupRows.filter(r => !r.isBaseline);
    const firstProjectRowIndex = groupRows.findIndex(r => !r.isBaseline);
    return {
      shouldRender: index === firstProjectRowIndex,
      rowSpan: projectRows.length,
    };
  }
}

function spatialOverviewRows(report: ReportSummary) {
  const selected = report.filter.level === "all" || !report.filter.id
    ? report.spatialNodes.find((node) => node.level === "country") ?? report.spatialNodes[0]
    : report.spatialNodes.find((node) => node.level === report.filter.level && nodeIdValue(node) === report.filter.id) ?? report.spatialNodes[0];
  const children = selected ? report.spatialNodes.filter((node) => node.parentId === selected.id) : [];
  return [selected, ...children].filter((node): node is SpatialSummaryNode => Boolean(node)).slice(0, 8);
}

function processRowsHtml(report: ReportSummary) {
  return processComparisonGroups(report).map((group) =>
    group.rows.map((row, index) => {
      const spanInfo = getYearGroupRowSpanInfo(group.rows, index);
      const yearGroupCell = spanInfo.shouldRender
        ? `<td rowspan="${spanInfo.rowSpan}">${escapeHtml(processTypeLabel(row))}</td>`
        : "";
      return `
        <tr>
          ${index === 0 ? `<td rowspan="${group.rows.length}">${escapeHtml(group.process)}</td>` : ""}
          ${yearGroupCell}
          <td>${escapeHtml(row.year)}</td>
          <td>${escapeHtml(numberCell(row.emission))}</td>
        </tr>
      `;
    }).join("")
  ).join("");
}

function spatialRowsHtml(report: ReportSummary) {
  return spatialOverviewRows(report).map((node) => `
    <tr>
      <td>${escapeHtml(node.level)}</td>
      <td>${escapeHtml(node.name)}</td>
      <td>${escapeHtml(node.fields.toLocaleString())}</td>
      <td>${escapeHtml(node.areaRai.toLocaleString())}</td>
      <td>${escapeHtml(numberCell(node.baselineEmission))}</td>
      <td>${escapeHtml(numberCell(node.currentEmission))}</td>
      <td>${escapeHtml(diffText(node.baselineEmission, node.currentEmission))}</td>
    </tr>
  `).join("");
}

function pddDraftHtml(report: ReportSummary) {
  const processRows = processRowsHtml(report);
  const inputRows = (report.processInputs ?? []).map((row) => `
    <tr>
      <td>${escapeHtml(row.process)}</td>
      <td>${escapeHtml(row.baselineFertilizerKg.toLocaleString())}</td>
      <td>${escapeHtml(row.currentFertilizerKg.toLocaleString())}</td>
      <td>${escapeHtml(row.baselineFuelLiter.toLocaleString())}</td>
      <td>${escapeHtml(row.currentFuelLiter.toLocaleString())}</td>
    </tr>
  `).join("");
  const spatialRows = spatialRowsHtml(report);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: "TH Sarabun New", "Noto Sans Thai", Arial, sans-serif; font-size: 16px; color: #111827; }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; margin-top: 22px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
          th, td { border: 1px solid #9ca3af; padding: 6px 8px; vertical-align: top; }
          th { background: #eef6ff; }
          .muted { color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>ชุดข้อมูลสรุปสำหรับเตรียมยื่น Premium T-VER</h1>
        <p class="muted">เอกสารนี้สร้างจาก Dashboard เพื่อเป็นร่างข้อมูลสำหรับนำไปกรอก/เรียบเรียงในแบบฟอร์ม PDD ไม่ใช่แบบฟอร์มทางการแทน อบก.</p>

        <h2>1. รายละเอียดโครงการ</h2>
        <table>
          <tr><th>หัวข้อ</th><th>ข้อมูลจาก Dashboard</th></tr>
          <tr><td>ขอบเขตโครงการ</td><td>กระบวนการเพาะปลูกอ้อย 4 ขั้นตอน: การเตรียมดินและปลูก, การใช้ปุ๋ย, การให้น้ำและกำจัดวัชพืช, การเก็บเกี่ยว</td></tr>
          <tr><td>จำนวนแปลง</td><td>${escapeHtml(report.kpi.fields.toLocaleString())} แปลง</td></tr>
          <tr><td>ปีดำเนินการ</td><td>${escapeHtml(report.kpi.currentYear)}</td></tr>
          <tr><td>พื้นที่/ขอบเขตเชิงภูมิศาสตร์</td><td>${escapeHtml(report.analysis.areaSummary)}</td></tr>
        </table>

        <h2>2. ระเบียบวิธีและกิจกรรมที่เกี่ยวข้อง</h2>
        <table>
          <tr><th>หัวข้อ PDD</th><th>ข้อมูลที่ควรใส่</th></tr>
          <tr><td>Methodology</td><td>T-VER-P-METH-13-06 กิจกรรมการจัดการพื้นที่การเกษตรที่ดี และเครื่องมือคำนวณ SOC สำหรับโครงการเกษตร ตามตัวอย่าง PDD</td></tr>
          <tr><td>กิจกรรมลดการปล่อย</td><td>ลดการใช้ปุ๋ยไนโตรเจน/ใช้ปุ๋ยตามค่าวิเคราะห์ดิน, ลดการใช้น้ำมันในกิจกรรมเพาะปลูก, เพิ่มแนวปฏิบัติที่ส่งเสริมคาร์บอนในดิน</td></tr>
          <tr><td>ข้อมูลหลักที่ใช้คำนวณ</td><td>ปริมาณปุ๋ย, น้ำมัน, จำนวนแปลง, พื้นที่ไร่, ค่า EF/GWP, baseline average และ project year</td></tr>
        </table>

        <h2>3. ผลการคำนวณเบื้องต้น</h2>
        <table>
          <tr><th>รายการ</th><th>ค่า</th></tr>
          <tr><td>ค่าเฉลี่ยปีฐาน</td><td>${escapeHtml(report.kpi.baselineAvgEmission.toLocaleString())} tCO2e</td></tr>
          <tr><td>ปีดำเนินการ</td><td>${escapeHtml(report.kpi.currentEmission.toLocaleString())} tCO2e</td></tr>
          <tr><td>ผลต่าง</td><td>${escapeHtml(diffText(report.kpi.baselineAvgEmission, report.kpi.currentEmission))}</td></tr>
          <tr><td>Machine / Fuel</td><td>${escapeHtml(report.kpi.machineEmission.toLocaleString())} tCO2e</td></tr>
          <tr><td>ปุ๋ยรวม</td><td>${escapeHtml(report.kpi.fertilizerAmountKg.toLocaleString())} kg / ${escapeHtml(report.kpi.fertilizerEmission.toLocaleString())} tCO2e</td></tr>
        </table>

        <h2>4. ตารางเปรียบเทียบกระบวนการ</h2>
        <table><thead><tr><th>Process</th><th>Year group</th><th>Year</th><th>Emission (tCO2e)</th></tr></thead><tbody>${processRows}</tbody></table>

        <h2>5. ตารางปุ๋ยและน้ำมัน</h2>
        <table><thead><tr><th>Process</th><th>ปุ๋ย baseline (kg)</th><th>ปุ๋ย project (kg)</th><th>น้ำมัน baseline (L)</th><th>น้ำมัน project (L)</th></tr></thead><tbody>${inputRows}</tbody></table>

        <h2>6. ตารางพื้นที่ภาพรวม</h2>
        <table><thead><tr><th>Level</th><th>พื้นที่</th><th>แปลง</th><th>ไร่</th><th>Baseline</th><th>Project</th><th>ผลต่าง</th></tr></thead><tbody>${spatialRows}</tbody></table>

        <h2>7. แผนติดตามผลที่ควรแนบ</h2>
        <ul>
          <li>หลักฐานบันทึกกิจกรรมรายแปลง: วันที่, แปลง, ขั้นตอน, ปริมาณปุ๋ย, ปริมาณน้ำมัน, ผู้บันทึก</li>
          <li>หลักฐานพื้นที่: รหัสแปลง, พิกัด, จังหวัด/อำเภอ/ตำบล, พื้นที่ไร่, เกษตรกร/เจ้าของแปลง</li>
          <li>หลักฐานคำนวณ: EF/GWP ที่ใช้, วิธีคิด baseline average, ปีดำเนินการ และผู้ตรวจทาน</li>
          <li>หลักฐานประกอบ PDD: รูปภาพกิจกรรม, ผลวิเคราะห์ดิน, แผนที่, สรุปการรับฟังความคิดเห็นถ้ามี</li>
        </ul>
      </body>
    </html>
  `;
}

function PddCarbonSummary({ report }: { report: ReportSummary }) {
  const summary = pddEmissionSummary(report);
  return (
    <div className="pdd-paper">
      <div className="pdd-doc-header">
        <div>โครงการลดก๊าซเรือนกระจกภาคสมัครใจตามมาตรฐานของประเทศไทย</div>
        <div>มาตรฐานขั้นสูง (Premium T-VER)</div>
        <div>เอกสารสรุปข้อมูลสำหรับจัดทำ PDD จาก Carbon Analytics</div>
      </div>

      <h2>สรุปปริมาณการลดก๊าซเรือนกระจก</h2>
      <p>
        ข้อมูลในส่วนนี้จัดรูปแบบตามตัวอย่าง PDD เพื่อสรุปปริมาณการลดการปล่อยก๊าซเรือนกระจก
        โดยใช้ค่าเฉลี่ยปีฐานเทียบกับปีดำเนินโครงการ {report.kpi.currentYear}
      </p>

      <h3>การปล่อยก๊าซเรือนกระจก</h3>
      <p>
        ปริมาณการปล่อยก๊าซเรือนกระจกคำนวณจากการนำปริมาณการปล่อยก๊าซเรือนกระจกในกรณีฐาน
        หักลบด้วยปริมาณการปล่อยก๊าซเรือนกระจกในกรณีดำเนินโครงการ
      </p>

      <h4>ปริมาณการปล่อยก๊าซไนตรัสออกไซด์จากการใส่ปุ๋ยไนโตรเจนและพืชตรึงไนโตรเจน</h4>
      <div className="pdd-method-box">
        <div><span>รหัส</span><strong>TVER-METH-13-06, T-VER-P-TOOL-01-12</strong></div>
        <div><span>เวอร์ชั่น</span><strong>01</strong></div>
        <div><span>ชื่อระเบียบวิธีฯ/เครื่องมือ</span><strong>กิจกรรมการจัดการพื้นที่การเกษตรที่ดี (Enhanced Good Practices in Agricultural Land)</strong></div>
        <div><span>สมการที่ใช้</span><strong>ΔN2O SOIL,i,t = N2O SOIL,BSL,i,t - N2O SOIL,PROJ,i,t</strong></div>
      </div>
      <table className="report-table pdd-table">
        <thead><tr><th>พารามิเตอร์</th><th>ความหมาย</th><th>อ้างอิง</th><th>ค่าที่ใช้</th><th>หน่วย</th></tr></thead>
        <tbody>
          <tr>
            <td>ΔN2O SOIL,i,t</td>
            <td>ปริมาณการลดการปล่อยก๊าซไนตรัสออกไซด์จากกระบวนการใส่ปุ๋ยไนโตรเจนและพืชตรึงไนโตรเจน</td>
            <td>การคำนวณ</td>
            <td>{numberCell(summary.n2oReduction)}</td>
            <td>ตันคาร์บอนไดออกไซด์เทียบเท่าต่อปี</td>
          </tr>
          <tr>
            <td>N2O SOIL,BSL,i,t</td>
            <td>ปริมาณการปล่อยก๊าซไนตรัสออกไซด์ในกรณีฐาน จากค่าเฉลี่ยปีฐานของโครงการ</td>
            <td>การคำนวณ</td>
            <td>{numberCell(summary.n2oBaseline)}</td>
            <td>ตันคาร์บอนไดออกไซด์เทียบเท่าต่อปี</td>
          </tr>
          <tr>
            <td>N2O SOIL,PROJ,i,t</td>
            <td>ปริมาณการปล่อยก๊าซไนตรัสออกไซด์ในกรณีดำเนินโครงการ ปี {report.kpi.currentYear}</td>
            <td>การคำนวณ</td>
            <td>{numberCell(summary.n2oProject)}</td>
            <td>ตันคาร์บอนไดออกไซด์เทียบเท่าต่อปี</td>
          </tr>
        </tbody>
      </table>

      <h4>ปริมาณการปล่อยก๊าซคาร์บอนไดออกไซด์จากการเผาไหม้เชื้อเพลิงฟอสซิล</h4>
      <div className="pdd-method-box">
        <div><span>รหัส</span><strong>TVER-METH-13-06, T-VER-P-TOOL-01-12</strong></div>
        <div><span>เวอร์ชั่น</span><strong>01</strong></div>
        <div><span>ชื่อระเบียบวิธีฯ/เครื่องมือ</span><strong>กิจกรรมการจัดการพื้นที่การเกษตรที่ดี (Enhanced Good Practices in Agricultural Land)</strong></div>
        <div><span>สมการที่ใช้</span><strong>ΔCO2 FUEL,i,t = CO2 FUEL,BSL,i,t - CO2 FUEL,PROJ,i,t</strong></div>
      </div>
      <table className="report-table pdd-table">
        <thead><tr><th>พารามิเตอร์</th><th>ความหมาย</th><th>อ้างอิง</th><th>ค่าที่ใช้</th><th>หน่วย</th></tr></thead>
        <tbody>
          <tr>
            <td>ΔCO2 FUEL,i,t</td>
            <td>ปริมาณการลดการปล่อยก๊าซคาร์บอนไดออกไซด์ที่เกิดจากการเผาไหม้เชื้อเพลิงฟอสซิล</td>
            <td>การคำนวณ</td>
            <td>{numberCell(summary.co2FuelReduction)}</td>
            <td>ตันคาร์บอนไดออกไซด์เทียบเท่าต่อปี</td>
          </tr>
          <tr>
            <td>CO2 FUEL,BSL,i,t</td>
            <td>ปริมาณการปล่อยก๊าซคาร์บอนไดออกไซด์จากเชื้อเพลิงฟอสซิลในกรณีฐาน</td>
            <td>การคำนวณ</td>
            <td>{numberCell(summary.co2FuelBaseline)}</td>
            <td>ตันคาร์บอนไดออกไซด์เทียบเท่าต่อปี</td>
          </tr>
          <tr>
            <td>CO2 FUEL,PROJ,i,t</td>
            <td>ปริมาณการปล่อยก๊าซคาร์บอนไดออกไซด์จากเชื้อเพลิงฟอสซิลในกรณีดำเนินโครงการ</td>
            <td>การคำนวณ</td>
            <td>{numberCell(summary.co2FuelProject)}</td>
            <td>ตันคาร์บอนไดออกไซด์เทียบเท่าต่อปี</td>
          </tr>
        </tbody>
      </table>

      <p className="pdd-note">
        หมายเหตุ: ค่าที่แสดงเป็นข้อมูลสมมุติสำหรับตรวจรูปแบบรายงานและ dashboard preview
        โดยคงโครงสร้างการเชื่อมต่อข้อมูลจริงไว้สำหรับสลับกลับเมื่อมีผลคำนวณจากฐานข้อมูลครบถ้วน
      </p>
    </div>
  );
}

type InsightTab = "alerts" | "pdd";

function WebReportSummary({ report }: { report: ReportSummary }) {
  const [insightTab, setInsightTab] = useState<InsightTab>("alerts");
  const summary = pddEmissionSummary(report);
  const totalInputs = summary.n2oProject + summary.co2FuelProject + summary.socRemoval;
  return (
    <>
      {/* BLOCK 1: PROJECT CONTEXT */}
      <div className="card-title">ข้อมูลภาพรวมโครงการ</div>
      <div className="executive-summary-grid tver-executive-summary">
        <article>
          <span>พื้นที่โครงการ</span>
          <strong>{reportAreaRai(report).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
          <small>ไร่ · {report.kpi.fields.toLocaleString()} แปลง</small>
        </article>
        <article>
          <span>เครดิตที่คาดว่าจะได้</span>
          <strong>{summary.totalReduction.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <small>tCO2e</small>
        </article>
        <article>
          <span>องค์ประกอบเครดิต N2O + น้ำมัน + SOC</span>
          <strong>{totalInputs.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <small>tCO2e</small>
        </article>
        <article>
          <span>Emission ปีดำเนินโครงการ</span>
          <strong>{report.kpi.currentEmission.toLocaleString()}</strong>
          <small>Project year {report.kpi.currentYear} · tCO2e</small>
        </article>
        <article>
          <span>Emission ปีฐาน Baseline</span>
          <strong>{report.kpi.baselineAvgEmission.toLocaleString()}</strong>
          <small>Baseline year เฉลี่ย · tCO2e</small>
        </article>
      </div>

      {/* BLOCK 2: EVIDENCE / BREAKDOWN */}
      <h3>Evidence / Breakdown</h3>
      <p className="card-title" style={{ fontSize: "11px", marginBottom: "10px", marginTop: "0", letterSpacing: ".02em" }}>พารามิเตอร์สำคัญสำหรับการยื่น อบก. (TGO)</p>
      <div className="report-kpi-grid">
        <div><span>Baseline avg</span><strong>{report.kpi.baselineAvgEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>Project year {report.kpi.currentYear}</span><strong>{report.kpi.currentEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>ผลต่าง</span><strong>{diffText(report.kpi.baselineAvgEmission, report.kpi.currentEmission)}</strong></div>
        <div><span>พื้นที่</span><strong>{report.kpi.fields} แปลง / {report.kpi.farmers} ราย</strong></div>
        <div><span>Machine / Fuel</span><strong>{report.kpi.machineEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>ปุ๋ยรวม</span><strong>{report.kpi.fertilizerAmountKg.toLocaleString()} kg / {report.kpi.fertilizerEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>SOC Removal</span><strong>{summary.socRemoval.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e</strong></div>
      </div>

      {/* BLOCK 3: TABBED INSIGHTS */}
      <div className="insights-tabs-wrapper">
        <h3>บทวิเคราะห์</h3>
        <div className="report-preview-tabs" role="tablist" aria-label="Insight tabs">
          <button
            role="tab"
            type="button"
            aria-selected={insightTab === "alerts"}
            className={insightTab === "alerts" ? "active" : ""}
            onClick={() => setInsightTab("alerts")}
          >
            สรุปตามความปลอดภัย
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={insightTab === "pdd"}
            className={insightTab === "pdd" ? "active" : ""}
            onClick={() => setInsightTab("pdd")}
          >
            ตัวเลขอ้างอิงเล่ม PDD
          </button>
        </div>

        {insightTab === "alerts" && (
          <div className="alert-cards-grid">
            <div className="alert-card alert-card--success">
              <span className="alert-card-icon">🟢</span>
              <div>
                <strong>ความสำเร็จหลัก (Success)</strong>
                <p>ประสิทธิภาพการลดคาร์บอนต่อหน่วยลดลงเหลือ 3.22 tCO2e/ตันอ้อย ต่ำกว่าปีฐานชัดเจน</p>
              </div>
            </div>
            <div className="alert-card alert-card--warning">
              <span className="alert-card-icon">🟡</span>
              <div>
                <strong>ข้อมูลเฝ้าระวัง (Warning)</strong>
                <p>แคมป์หนองสาหร่ายปล่อยก๊าซฯ จากขั้นตอนจัดการน้ำเพิ่มขึ้น 5.2% จากน้ำมันสูบน้ำ</p>
              </div>
            </div>
            <div className="alert-card alert-card--danger">
              <span className="alert-card-icon">🔴</span>
              <div>
                <strong>จุดวิกฤตที่ต้องแก้ (Danger)</strong>
                <p>กิจกรรม "การใช้ปุ๋ยเคมี" ในอ้อยปลูกใหม่เป็น Hotspot ครองสัดส่วนปล่อยสูงถึง 52.8%</p>
              </div>
            </div>
          </div>
        )}

        {insightTab === "pdd" && (
          <ul className="pdd-ref-list">
            <li>
              <div>
                <strong>บรรลุเป้าหมายการลดก๊าซเรือนกระจกประจำปี</strong>
                <p className="muted">ลดลงตามเกณฑ์มาตรฐาน</p>
              </div>
              <span className="pdd-ref-badge pdd-ref-badge--green">-173 tCO2e</span>
            </li>
            <li>
              <div>
                <strong>สัญญาณบวกการกักเก็บคาร์บอนในดินสุทธิ</strong>
                <p className="muted">เพิ่มนัยสำคัญในส่วน บ.4 เล่ม PDD แคมป์ป่าสาง</p>
              </div>
              <span className="pdd-ref-badge pdd-ref-badge--blue">+60.55 tCO2e</span>
            </li>
          </ul>
        )}
      </div>
    </>
  );
}

function ExcelPreview({ report }: { report: ReportSummary }) {
  return (
    <div className="excel-sheet-grid">
      <div>
        <h3>KPI</h3>
        <table className="report-table">
          <tbody>
            <tr><th>Baseline avg</th><td>{report.kpi.baselineAvgEmission.toLocaleString()} tCO2e</td></tr>
            <tr><th>Project year</th><td>{report.kpi.currentEmission.toLocaleString()} tCO2e</td></tr>
            <tr><th>Fields</th><td>{report.kpi.fields.toLocaleString()} แปลง</td></tr>
            <tr><th>Fertilizer</th><td>{report.kpi.fertilizerAmountKg.toLocaleString()} kg</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h3>Process</h3>
        <table className="report-table">
          <thead><tr><th>Process</th><th>Year group</th><th>Year</th><th>Emission</th></tr></thead>
          <tbody>
            {processComparisonGroups(report).map((group) =>
              group.rows.map((row, index) => {
                const spanInfo = getYearGroupRowSpanInfo(group.rows, index);
                return (
                  <tr key={`excel-process-${row.year}-${row.process}`}>
                    {index === 0 && <td rowSpan={group.rows.length} className="process-group-cell">{group.process}</td>}
                    {spanInfo.shouldRender && <td rowSpan={spanInfo.rowSpan}>{processTypeLabel(row)}</td>}
                    <td>{row.year}</td>
                    <td>{numberCell(row.emission)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Inputs</h3>
        <table className="report-table">
          <thead><tr><th>Process</th><th>ปุ๋ย project</th><th>น้ำมัน project</th></tr></thead>
          <tbody>
            {(report.processInputs ?? []).map((row) => (
              <tr key={`excel-input-${row.process}`}>
                <td>{row.process}</td>
                <td>{row.currentFertilizerKg.toLocaleString()} kg</td>
                <td>{row.currentFuelLiter.toLocaleString()} L</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Spatial</h3>
        <table className="report-table">
          <thead><tr><th>Level</th><th>พื้นที่</th><th>แปลง</th><th>ไร่</th></tr></thead>
          <tbody>
            {spatialOverviewRows(report).map((node) => (
              <tr key={`excel-spatial-${node.id}`}>
                <td>{node.level}</td>
                <td>{node.name}</td>
                <td>{node.fields.toLocaleString()}</td>
                <td>{node.areaRai.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportFullTables({ report }: { report: ReportSummary }) {
  return (
    <>
      {/* BLOCK 4: Process comparison table */}
      <section className="card">
        <h3>ตารางเปรียบเทียบกระบวนการ</h3>
        <table className="report-table">
          <thead><tr><th>Process</th><th>Year group</th><th>Year</th><th>Emission (tCO2e)</th></tr></thead>
          <tbody>
            {processComparisonGroups(report).map((group) =>
              group.rows.map((row, index) => {
                const spanInfo = getYearGroupRowSpanInfo(group.rows, index);
                return (
                  <tr key={`tbl4-${row.year}-${row.process}`}>
                    {index === 0 && <td rowSpan={group.rows.length} className="process-group-cell">{group.process}</td>}
                    {spanInfo.shouldRender && <td rowSpan={spanInfo.rowSpan}>{processTypeLabel(row)}</td>}
                    <td>{row.year}</td>
                    <td>{numberCell(row.emission)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* BLOCK 5: Inputs table */}
      <section className="card">
        <h3>ตารางปุ๋ยและน้ำมัน</h3>
        <table className="report-table">
          <thead><tr><th>Process</th><th>ปุ๋ย baseline (kg)</th><th>ปุ๋ย project (kg)</th><th>น้ำมัน baseline (L)</th><th>น้ำมัน project (L)</th></tr></thead>
          <tbody>
            {(report.processInputs ?? []).map((row) => (
              <tr key={`tbl5-${row.process}`}>
                <td>{row.process}</td>
                <td>{row.baselineFertilizerKg.toLocaleString()}</td>
                <td>{row.currentFertilizerKg.toLocaleString()}</td>
                <td>{row.baselineFuelLiter.toLocaleString()}</td>
                <td>{row.currentFuelLiter.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* BLOCK 6: Spatial table */}
      <section className="card">
        <h3>ตารางพื้นที่ (Spatial Summary)</h3>
        <table className="report-table">
          <thead><tr><th>Level</th><th>พื้นที่</th><th>แปลง</th><th>ไร่</th><th>Baseline</th><th>Project</th><th>ผลต่าง</th></tr></thead>
          <tbody>
            {spatialOverviewRows(report).map((node) => (
              <tr key={`tbl6-${node.id}`}>
                <td>{node.level}</td>
                <td>{node.name}</td>
                <td>{node.fields.toLocaleString()}</td>
                <td>{node.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                <td>{numberCell(node.baselineEmission)}</td>
                <td>{numberCell(node.currentEmission)}</td>
                <td>{diffText(node.baselineEmission, node.currentEmission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function CfReportPage() {
  const pddEmissionRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [reportPath, setReportPath] = useState<Record<CascadingReportLevel, string>>(emptyReportPath);
  const [selectedReportCampId, setSelectedReportCampId] = useState("");
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [generatedReport, setGeneratedReport] = useState<ReportSummary | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>("pdf");
  const [reportRenderId, setReportRenderId] = useState(0);
  const [pdfUrl, setPdfUrl] = useState("");
  const [generateNotice, setGenerateNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  useEffect(() => {
    getCfSpatialNodes()
      .then((result) => setNodes(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดตัวกรองพื้นที่ไม่สำเร็จ"));
  }, []);

  const reportFieldOptions = useMemo(() => {
    if (!reportPath.subdistrict) return [];
    const byId = new Map<string, SpatialSummaryNode>();
    nodes
      .filter((node) => node.level === "field" && node.parentId === reportPath.subdistrict && !node.id.startsWith("camp-"))
      .forEach((node) => {
        const current = byId.get(node.id);
        if (!current || (!reportNodeCampName(current) && reportNodeCampName(node))) {
          byId.set(node.id, node);
        }
      });
    return Array.from(byId.values());
  }, [nodes, reportPath.subdistrict]);

  const reportCampOptions = useMemo(() => {
    const byCampId = new Map<string, string>();
    reportFieldOptions.forEach((node) => {
      const campId = reportNodeCampId(node);
      const campName = reportNodeCampName(node);
      if (campId && campName) byCampId.set(campId, campName);
    });
    return Array.from(byCampId.entries())
      .map(([campId, campName]) => ({ campId, campName }))
      .sort((a, b) => a.campName.localeCompare(b.campName, "th"));
  }, [reportFieldOptions]);

  const filteredReportFieldOptions = useMemo(
    () => selectedReportCampId
      ? reportFieldOptions.filter((node) => reportNodeCampId(node) === selectedReportCampId)
      : reportFieldOptions,
    [reportFieldOptions, selectedReportCampId],
  );

  const selectedReportCampSummaryNode = useMemo(
    () => selectedReportCampId
      ? nodes.find((node) => node.level === "field" && node.id.startsWith("camp-") && reportNodeCampId(node) === selectedReportCampId)
      : undefined,
    [nodes, selectedReportCampId],
  );

  const activeReportFilter = useMemo<ReportFilter>(() => {
    if (reportPath.field) {
      const node = nodes.find((item) => item.id === reportPath.field);
      return { level: "field", id: node ? nodeIdValue(node) : reportPath.field };
    }
    if (selectedReportCampSummaryNode) {
      return { level: "field", id: nodeIdValue(selectedReportCampSummaryNode) };
    }
    const selectedLevel = [...reportLevelOrder].reverse().find((level) => reportPath[level]);
    if (!selectedLevel) return { level: "all" };
    const node = nodes.find((item) => item.id === reportPath[selectedLevel]);
    return {
      level: selectedLevel,
      id: node ? nodeIdValue(node) : reportPath[selectedLevel],
    };
  }, [nodes, reportPath, selectedReportCampSummaryNode]);

  const selectedReportNode = activeReportFilter.level === "all"
    ? undefined
    : nodes.find((node) => node.level === activeReportFilter.level && nodeIdValue(node) === activeReportFilter.id);

  useEffect(() => {
    setLoading(true);
    getReportSummary(activeReportFilter)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดรายงานไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [activeReportFilter]);

  useEffect(() => {
    if (selectedReportCampId && !reportCampOptions.some((camp) => camp.campId === selectedReportCampId)) {
      setSelectedReportCampId("");
    }
  }, [reportCampOptions, selectedReportCampId]);

  useEffect(() => {
    if (!generatedReport || !pddEmissionRef.current) return;
    let revoked = "";
    setGeneratingPreview(true);
    const timer = window.setTimeout(() => {
      if (!pddEmissionRef.current) return;
      html2canvas(pddEmissionRef.current, { scale: 1.8, backgroundColor: "#ffffff" })
        .then((canvas) => {
        const pdf = new jsPDF("l", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const margin = 8;
        const imageWidth = width - margin * 2;
        const image = canvas.toDataURL("image/png");
        const height = (canvas.height * imageWidth) / canvas.width;
        pdf.addImage(image, "PNG", margin, margin, imageWidth, height);
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
    }, 200);
    return () => {
      window.clearTimeout(timer);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [generatedReport, reportRenderId]);

  const reportOptionsFor = (level: CascadingReportLevel, parentId?: string) =>
    nodes.filter((node) => node.level === level && (!parentId || node.parentId === parentId));

  const selectReportPath = (level: CascadingReportLevel, id: string) => {
    const levelIndex = reportLevelOrder.indexOf(level);
    const next = { ...reportPath, [level]: id };
    reportLevelOrder.slice(levelIndex + 1).forEach((key) => {
      next[key] = "";
    });
    setReportPath(next);
    if (level !== "field") setSelectedReportCampId("");
    setGenerateNotice("ตัวกรองเปลี่ยนแล้ว สรุปด้านซ้ายอัปเดตทันที กดสร้างเอกสารใหม่เมื่อพร้อม");
  };

  const selectReportCamp = (campId: string) => {
    setSelectedReportCampId(campId);
    setReportPath((current) => ({ ...current, field: "" }));
    setGenerateNotice("ตัวกรองแคมป์เปลี่ยนแล้ว สรุปด้านซ้ายอัปเดตทันที กดสร้างเอกสารใหม่เมื่อพร้อม");
  };

  const generateReportPreview = () => {
    if (!report) return;
    setGenerateNotice("กำลังสร้างตัวอย่างรายงานตามตัวกรองปัจจุบัน...");
    setGeneratedReport(report);
    setReportRenderId((value) => value + 1);
    setActivePreviewTab("pdf");
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "premium-tver-carbon-summary.pdf";
    a.click();
  };

  const exportExcel = () => {
    if (!generatedReport) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet([generatedReport.kpi])), "KPI");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(generatedReport.process)), "Process");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(generatedReport.processInputs ?? [])), "Inputs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(spatialOverviewRows(generatedReport).map((node) => ({
      level: node.level,
      name: node.name,
      fields: node.fields,
      farmers: node.farmers,
      areaRai: node.areaRai,
      baselineEmission: node.baselineEmission,
      currentEmission: node.currentEmission,
      diff: node.currentEmission - node.baselineEmission,
    })))), "Spatial");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet([generatedReport.analysis])), "Analysis");
    XLSX.writeFile(wb, "premium-tver-carbon-summary.xlsx");
  };

  const downloadWordDraft = () => {
    if (!generatedReport) return;
    const blob = new Blob([pddDraftHtml(generatedReport)], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "premium-tver-pdd-data-draft.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewIsCurrent = Boolean(generatedReport && report && generatedReport.generatedAt === report.generatedAt);

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <h1>สรุปผลทั้งหมดสำหรับเตรียมยื่น Premium T-VER</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="card report-toolbar">
          <div>
            <div className="card-title">ตัวกรองรายงาน</div>
            <p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>กรุณาระบุกลุ่มไร่หลักและพื้นที่โครงการเป้าหมาย เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน {selectedReportNode ? `(กำลังดู: ${selectedReportNode.name})` : "(กำลังดู: ภาพรวมทั้งระบบ)"}</p>
          </div>
          <label>
            กลุ่มไร่หลัก
            <select value={reportPath.region} onChange={(event) => selectReportPath("region", event.target.value)}>
              <option value="">ทุกกลุ่มไร่หลัก</option>
              {farmGroupFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            จังหวัด
            <select value={reportPath.province} onChange={(event) => selectReportPath("province", event.target.value)} disabled={!reportPath.region}>
              <option value="">ทุกจังหวัดในกลุ่มไร่</option>
              {reportOptionsFor("province", reportPath.region).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            อำเภอ / เขต
            <select value={reportPath.district} onChange={(event) => selectReportPath("district", event.target.value)} disabled={!reportPath.province}>
              <option value="">ทุกอำเภอ/เขตในจังหวัด</option>
              {reportOptionsFor("district", reportPath.province).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            ตำบล / แขวง
            <select value={reportPath.subdistrict} onChange={(event) => selectReportPath("subdistrict", event.target.value)} disabled={!reportPath.district}>
              <option value="">ทุกตำบล/แขวง</option>
              {reportOptionsFor("subdistrict", reportPath.district).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            แคมป์
            <select value={selectedReportCampId} onChange={(event) => selectReportCamp(event.target.value)} disabled={!reportPath.subdistrict || !reportCampOptions.length}>
              <option value="">ทุกแคมป์ในตำบล</option>
              {reportCampOptions.map((camp) => (
                <option key={camp.campId} value={camp.campId}>{camp.campName}</option>
              ))}
            </select>
          </label>
          <label>
            แปลง
            <select value={reportPath.field} onChange={(event) => selectReportPath("field", event.target.value)} disabled={!reportPath.subdistrict || !filteredReportFieldOptions.length}>
              <option value="">{selectedReportCampId ? "ทุกแปลงในแคมป์" : "ทุกแปลงในตำบล"}</option>
              {filteredReportFieldOptions.map((node) => (
                <option key={node.id} value={node.id}>{reportNodeFieldCode(node) ? `${reportNodeFieldCode(node)} · ${node.name}` : node.name}</option>
              ))}
            </select>
          </label>
          <button className="run-all-btn report-generate-btn" type="button" onClick={generateReportPreview} disabled={!report || loading || generatingPreview}>
            สร้างเอกสารใหม่ (Generate Report)
          </button>
          <div className="report-download-actions">
            <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl || generatingPreview || !previewIsCurrent}>Download PDF</button>
            <button className="run-btn word-download-btn" type="button" onClick={downloadWordDraft} disabled={!generatedReport || !previewIsCurrent}>Download Word</button>
            <button className="run-all-btn excel-download-btn" type="button" onClick={exportExcel} disabled={!generatedReport || !previewIsCurrent}>Export Excel</button>
          </div>
        </section>

        {generateNotice && <div className="report-generate-notice">{generateNotice}</div>}

        {loading && <div className="empty-state">กำลังสร้างรายงานจากข้อมูลสมมุติเพื่อดูหน้าตาแดชบอร์ด...</div>}

        {report && (
          <>
          {generatedReport && (
            <div className="pdf-render-source">
              <div ref={pddEmissionRef}>
                <PddCarbonSummary report={generatedReport} />
              </div>
            </div>
          )}
          <section className="report-layout">
            <div className="card report-paper">
              <WebReportSummary report={report} />
            </div>

            <div className="card report-preview-panel">
              <div className="report-preview-header">
                <div>
                  <div className="card-title">Preview & Download</div>
                  <p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>
                    {generatedReport
                      ? previewIsCurrent
                        ? `ข้อมูลฉบับร่างล่าสุด: ${new Date(generatedReport.generatedAt).toLocaleString()}`
                        : "ข้อมูลฉบับร่างยังไม่อัปเดตตามเงื่อนไขปัจจุบัน กรุณากด Generate Report เพื่อสร้างเอกสารใหม่"
                      : "กรุณากำหนดเงื่อนไขด้านซ้าย และกดสร้างเอกสารใหม่เพื่อแสดงข้อมูลฉบับร่าง"}
                  </p>
                </div>
                <div className="report-preview-tabs" role="tablist" aria-label="Report preview tabs">
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
                      onClick={() => setActivePreviewTab(tab as PreviewTab)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {!generatedReport && <div className="empty-state">ยังไม่มีตัวอย่างเอกสาร กด “สร้างเอกสารใหม่ (Generate Report)” เพื่อ Render PDF / Word / Excel</div>}
              {generatedReport && activePreviewTab === "pdf" && (
                <div className="pdf-preview">
                  {generatingPreview ? <div className="empty-state">กำลัง Render PDF preview...</div> : pdfUrl ? <iframe title="Premium T-VER PDF Preview" src={pdfUrl} /> : <div className="empty-state">กดสร้างเอกสารใหม่เพื่อเตรียม PDF preview</div>}
                </div>
              )}
              {generatedReport && activePreviewTab === "word" && (
                <div className="word-preview">
                  <iframe title="Premium T-VER Word Draft Preview" srcDoc={pddDraftHtml(generatedReport)} />
                </div>
              )}
              {generatedReport && activePreviewTab === "excel" && (
                <div className="excel-preview">
                  <ExcelPreview report={generatedReport} />
                </div>
              )}
            </div>
          </section>
          <ReportFullTables report={report} />
          </>
        )}
      </div>
    </div>
  );
}
