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
type InsightsTab = "traffic" | "pdd";

const reportLevelOrder: CascadingReportLevel[] = ["region", "province", "district", "subdistrict", "field"];

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

function spatialOverviewRows(report: ReportSummary) {
  const selected = report.filter.level === "all" || !report.filter.id
    ? report.spatialNodes.find((node) => node.level === "country") ?? report.spatialNodes[0]
    : report.spatialNodes.find((node) => node.level === report.filter.level && nodeIdValue(node) === report.filter.id) ?? report.spatialNodes[0];
  const children = selected ? report.spatialNodes.filter((node) => node.parentId === selected.id) : [];
  return [selected, ...children].filter((node): node is SpatialSummaryNode => Boolean(node)).slice(0, 8);
}

function processRowsHtml(report: ReportSummary) {
  return processComparisonGroups(report).map((group) =>
    group.rows.map((row, index) => `
      <tr>
        ${index === 0 ? `<td rowspan="${group.rows.length}">${escapeHtml(group.process)}</td>` : ""}
        <td>${escapeHtml(processTypeLabel(row))}</td>
        <td>${escapeHtml(row.year)}</td>
        <td>${escapeHtml(numberCell(row.emission))}</td>
      </tr>
    `).join("")
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
              group.rows.map((row, index) => (
                <tr key={`excel-process-${row.year}-${row.process}`}>
                  {index === 0 && <td rowSpan={group.rows.length} className="process-group-cell">{group.process}</td>}
                  <td>{processTypeLabel(row)}</td>
                  <td>{row.year}</td>
                  <td>{numberCell(row.emission)}</td>
                </tr>
              ))
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

// ─── Block 1: PROJECT CONTEXT ─────────────────────────────────────────────────
function ProjectContextBlock({ report }: { report: ReportSummary }) {
  const summary = pddEmissionSummary(report);
  const totalInputs = summary.n2oProject + summary.co2FuelProject + summary.socRemoval;
  const cards = [
    {
      label: "พื้นที่โครงการ",
      value: reportAreaRai(report).toLocaleString(undefined, { maximumFractionDigits: 1 }),
      unit: "ไร่",
      sub: `${report.kpi.fields.toLocaleString()} แปลง · ${report.kpi.farmers.toLocaleString()} ราย`,
      icon: "🌾",
      accent: "from-green-500 to-emerald-600",
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
    },
    {
      label: "เครดิตที่คาดว่าจะได้",
      value: summary.totalReduction.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "tCO2e",
      sub: "คาร์บอนเครดิต Premium T-VER",
      icon: "🏅",
      accent: "from-blue-500 to-indigo-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
    },
    {
      label: "องค์ประกอบเครดิต N2O + น้ำมัน + SOC",
      value: totalInputs.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "tCO2e",
      sub: `N2O: ${numberCell(summary.n2oProject)} · Fuel: ${numberCell(summary.co2FuelProject)} · SOC: ${numberCell(summary.socRemoval)}`,
      icon: "⚗️",
      accent: "from-violet-500 to-purple-600",
      bg: "bg-violet-50",
      border: "border-violet-200",
      text: "text-violet-800",
    },
    {
      label: `Emission ปีดำเนินโครงการ`,
      value: report.kpi.currentEmission.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "tCO2e",
      sub: `Project year ${report.kpi.currentYear}`,
      icon: "📉",
      accent: "from-amber-500 to-orange-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
    },
    {
      label: "Emission ปีฐาน Baseline",
      value: report.kpi.baselineAvgEmission.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: "tCO2e",
      sub: "Baseline year · ค่าเฉลี่ย",
      icon: "📊",
      accent: "from-slate-400 to-slate-500",
      bg: "bg-slate-50",
      border: "border-slate-200",
      text: "text-slate-700",
    },
  ];
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
        <span className="text-xl">🏢</span>
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Block 1 · Project Context</h2>
          <p className="text-xs text-slate-500 mt-0.5">ภาพรวมโครงการ Premium T-VER ปี {report.kpi.currentYear}</p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div key={card.label} className={`${card.bg} ${card.border} border rounded-lg p-4 flex flex-col gap-1`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{card.icon}</span>
              <span className={`text-xs font-semibold ${card.text} leading-tight`}>{card.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-bold ${card.text}`}>{card.value}</span>
              <span className={`text-xs font-medium ${card.text} opacity-70`}>{card.unit}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">{card.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Block 2: EVIDENCE / BREAKDOWN ───────────────────────────────────────────
function EvidenceBreakdownBlock({ report }: { report: ReportSummary }) {
  const summary = pddEmissionSummary(report);
  const diff = report.kpi.baselineAvgEmission - report.kpi.currentEmission;
  const diffPct = report.kpi.baselineAvgEmission ? (diff / report.kpi.baselineAvgEmission) * 100 : 0;
  const isReduced = diff >= 0;

  const params = [
    {
      label: "Baseline avg",
      value: `${numberCell(report.kpi.baselineAvgEmission)} tCO2e`,
      hint: "ค่าเฉลี่ยปีฐาน (สำหรับอ้างอิง PDD)",
      color: "text-slate-700",
    },
    {
      label: `Project year ${report.kpi.currentYear}`,
      value: `${numberCell(report.kpi.currentEmission)} tCO2e`,
      hint: "Emission ปีดำเนินการ",
      color: "text-blue-700",
    },
    {
      label: "ผลต่าง (Reduction)",
      value: `${isReduced ? "▼" : "▲"} ${numberCell(Math.abs(diff))} tCO2e`,
      hint: `${Math.abs(diffPct).toFixed(1)}% จากปีฐาน · ${isReduced ? "ลดลง ✓" : "เพิ่มขึ้น ⚠️"}`,
      color: isReduced ? "text-green-700" : "text-red-600",
    },
    {
      label: "พื้นที่ (แปลง / ราย)",
      value: `${report.kpi.fields.toLocaleString()} แปลง`,
      hint: `เกษตรกร ${report.kpi.farmers.toLocaleString()} ราย`,
      color: "text-slate-700",
    },
    {
      label: "Machine / Fuel Emission",
      value: `${numberCell(report.kpi.machineEmission)} tCO2e`,
      hint: "CO₂ จากการเผาไหม้เชื้อเพลิงฟอสซิล",
      color: "text-orange-700",
    },
    {
      label: "ปุ๋ยรวม (N2O)",
      value: `${report.kpi.fertilizerAmountKg.toLocaleString()} kg`,
      hint: `Emission ${numberCell(report.kpi.fertilizerEmission)} tCO2e`,
      color: "text-amber-700",
    },
    {
      label: "SOC Removal (ประมาณ)",
      value: `${numberCell(summary.socRemoval)} tCO2e`,
      hint: "การกักเก็บคาร์บอนในดิน (ค่าประมาณ 35%)",
      color: "text-emerald-700",
    },
  ];

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
        <span className="text-xl">📋</span>
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Block 2 · Evidence / Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">พารามิเตอร์สำคัญสำหรับยื่น อบก. (TGO)</p>
        </div>
      </div>
      <div className="p-5">
        <div className="divide-y divide-slate-100">
          {params.map((param) => (
            <div key={param.label} className="flex items-center justify-between py-2.5 gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-600 truncate">{param.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{param.hint}</div>
              </div>
              <div className={`text-sm font-bold ${param.color} whitespace-nowrap text-right`}>{param.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Block 3: TABBED INSIGHTS ─────────────────────────────────────────────────
function TabbedInsightsBlock() {
  const [activeTab, setActiveTab] = useState<InsightsTab>("traffic");

  const trafficAlerts = [
    {
      level: "success" as const,
      emoji: "🟢",
      badge: "ความสำเร็จหลัก",
      title: "ประสิทธิภาพการลดคาร์บอนต่อหน่วยดีขึ้น",
      detail:
        "ประสิทธิภาพการลดคาร์บอนต่อหน่วยลดลงเหลือ 3.22 tCO2e/ตันอ้อย ต่ำกว่าปีฐานชัดเจน สะท้อนว่ากิจกรรมการจัดการที่ดีในภาพรวมดำเนินไปในทิศทางที่ถูกต้อง",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      badgeBg: "bg-emerald-100 text-emerald-800",
      titleColor: "text-emerald-900",
      detailColor: "text-emerald-700",
    },
    {
      level: "warning" as const,
      emoji: "🟡",
      badge: "ข้อมูลเฝ้าระวัง",
      title: "แคมป์หนองสาหร่าย — Emission น้ำเพิ่มขึ้น",
      detail:
        "แคมป์หนองสาหร่ายปล่อยก๊าซฯ จากขั้นตอนจัดการน้ำเพิ่มขึ้น 5.2% จากน้ำมันสูบน้ำ ควรติดตามและพิจารณาทางเลือกประหยัดพลังงาน เช่น ระบบน้ำหยดหรือแรงโน้มถ่วง",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badgeBg: "bg-amber-100 text-amber-800",
      titleColor: "text-amber-900",
      detailColor: "text-amber-700",
    },
    {
      level: "danger" as const,
      emoji: "🔴",
      badge: "จุดวิกฤตที่ต้องแก้",
      title: "Hotspot: การใช้ปุ๋ยเคมีในอ้อยปลูกใหม่",
      detail:
        'กิจกรรม "การใช้ปุ๋ยเคมี" ในอ้อยปลูกใหม่เป็น Hotspot ครองสัดส่วนปล่อยสูงถึง 52.8% ต้องเร่งปรับแผนการใส่ปุ๋ยตามค่าวิเคราะห์ดิน และพิจารณาการใช้ปุ๋ยอินทรีย์ทดแทนบางส่วน',
      bg: "bg-red-50",
      border: "border-red-200",
      badgeBg: "bg-red-100 text-red-800",
      titleColor: "text-red-900",
      detailColor: "text-red-700",
    },
  ];

  const pddRefs = [
    {
      id: "pdd-ref-1",
      label: "บรรลุเป้าหมายการลดก๊าซเรือนกระจกประจำปี (ลดลงตามเกณฑ์มาตรฐาน)",
      sub: "บ.3 ผลคำนวณ Emission Reduction · ปีดำเนินการ 2566/67",
      badge: "-173 tCO2e",
      badgeStyle: "bg-green-100 text-green-800 border border-green-300",
    },
    {
      id: "pdd-ref-2",
      label: "สัญญาณบวกการกักเก็บคาร์บอนในดินสุทธิ (เพิ่มนัยสำคัญ)",
      sub: "บ.4 SOC Removal · แคมป์ป่าสาง · T-VER-P-TOOL-SOC-01",
      badge: "+60.55 tCO2e",
      badgeStyle: "bg-blue-100 text-blue-800 border border-blue-300",
    },
  ];

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
        <span className="text-xl">🔍</span>
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Block 3 · บทวิเคราะห์ (Insights)</h2>
          <p className="text-xs text-slate-500 mt-0.5">สลับแท็บเพื่อดูมุมมองต่างๆ ของการวิเคราะห์</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-5 pt-4 pb-0 border-b border-slate-200 flex gap-1">
        <button
          id="insights-tab-traffic"
          type="button"
          role="tab"
          aria-selected={activeTab === "traffic"}
          onClick={() => setActiveTab("traffic")}
          className={[
            "px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all duration-200 whitespace-nowrap",
            activeTab === "traffic"
              ? "border-blue-600 text-blue-700 bg-blue-50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          🚦 สรุปตามความปลอดภัย (Traffic-Light Alerts)
        </button>
        <button
          id="insights-tab-pdd"
          type="button"
          role="tab"
          aria-selected={activeTab === "pdd"}
          onClick={() => setActiveTab("pdd")}
          className={[
            "px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all duration-200 whitespace-nowrap",
            activeTab === "pdd"
              ? "border-blue-600 text-blue-700 bg-blue-50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          📄 ตัวเลขอ้างอิงเล่ม PDD
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {activeTab === "traffic" && (
          <div className="flex flex-col gap-3">
            {trafficAlerts.map((alert) => (
              <div
                key={alert.level}
                className={`${alert.bg} ${alert.border} border rounded-lg p-4`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5 flex-shrink-0">{alert.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${alert.badgeBg}`}>
                        {alert.badge}
                      </span>
                    </div>
                    <div className={`text-sm font-bold ${alert.titleColor} mb-1`}>{alert.title}</div>
                    <p className={`text-xs leading-relaxed ${alert.detailColor}`}>{alert.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "pdd" && (
          <div className="flex flex-col gap-3">
            {pddRefs.map((ref) => (
              <div
                key={ref.id}
                id={ref.id}
                className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 leading-snug">{ref.label}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{ref.sub}</div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${ref.badgeStyle}`}>
                    {ref.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Bottom Tables (Blocks 4, 5, 6) ──────────────────────────────────────────
function BottomTablesSection({ report }: { report: ReportSummary }) {
  return (
    <div className="space-y-6 mt-6">

      {/* Block 4: Process Comparison Table */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <span className="text-lg">⚖️</span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Block 4 · ตารางเปรียบเทียบกระบวนการ</h2>
            <p className="text-xs text-slate-500 mt-0.5">Process Comparison — Baseline avg vs. Project year {report.kpi.currentYear}</p>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-left text-slate-600 border border-slate-200 rounded-lg">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Process</th>
                <th className="px-4 py-3 border-b border-slate-200">Year Group</th>
                <th className="px-4 py-3 border-b border-slate-200">Year</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">Emission (tCO2e)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processComparisonGroups(report).map((group) =>
                group.rows.map((row, index) => (
                  <tr key={`${row.year}-${row.process}`} className="hover:bg-slate-50/50 transition-colors">
                    {index === 0 && (
                      <td rowSpan={group.rows.length} className="px-4 py-3 font-semibold text-slate-800 align-top border-r border-slate-100 bg-slate-50/30">
                        {group.process}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        row.year === "baseline_avg"
                          ? "bg-slate-200 text-slate-700"
                          : row.isBaseline
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {processTypeLabel(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.year}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{numberCell(row.emission)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Block 5: Fertilizer & Fuel Table */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <span className="text-lg">🧪</span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Block 5 · ตารางปุ๋ยและน้ำมัน</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fertilizer & Fuel Consumption — Baseline vs. Project</p>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-left text-slate-600 border border-slate-200 rounded-lg">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Process</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">ปุ๋ย Baseline (kg)</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">ปุ๋ย Project (kg)</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">น้ำมัน Baseline (L)</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">น้ำมัน Project (L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(report.processInputs ?? []).map((row) => {
                const fertDiff = row.baselineFertilizerKg - row.currentFertilizerKg;
                const fuelDiff = row.baselineFuelLiter - row.currentFuelLiter;
                return (
                  <tr key={row.process} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.process}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.baselineFertilizerKg.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-800">{row.currentFertilizerKg.toLocaleString()}</span>
                      {fertDiff !== 0 && (
                        <span className={`ml-1.5 text-[10px] font-medium ${fertDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {fertDiff >= 0 ? "▼" : "▲"}{Math.abs(fertDiff).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.baselineFuelLiter.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-800">{row.currentFuelLiter.toLocaleString()}</span>
                      {fuelDiff !== 0 && (
                        <span className={`ml-1.5 text-[10px] font-medium ${fuelDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {fuelDiff >= 0 ? "▼" : "▲"}{Math.abs(fuelDiff).toLocaleString()}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Block 6: Spatial Summary Table */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-2">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <span className="text-lg">🗺️</span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Block 6 · ตารางพื้นที่ภาพรวม (Spatial Summary)</h2>
            <p className="text-xs text-slate-500 mt-0.5">สรุปพื้นที่ตามระดับภูมิศาสตร์ที่เลือก</p>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-left text-slate-600 border border-slate-200 rounded-lg">
            <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Level</th>
                <th className="px-4 py-3 border-b border-slate-200">พื้นที่</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">แปลง</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">ไร่</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">Baseline (tCO2e)</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">Project (tCO2e)</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">ผลต่าง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spatialOverviewRows(report).map((node) => {
                const diff = node.baselineEmission - node.currentEmission;
                return (
                  <tr key={node.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        {node.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{node.name}</td>
                    <td className="px-4 py-3 text-right">{node.fields.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{node.areaRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{numberCell(node.baselineEmission)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{numberCell(node.currentEmission)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {diff >= 0 ? "▼" : "▲"} {numberCell(Math.abs(diff))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function CfReportPage() {
  const pddEmissionRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [reportPath, setReportPath] = useState<Record<CascadingReportLevel, string>>(emptyReportPath);
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

  const activeReportFilter = useMemo<ReportFilter>(() => {
    const selectedLevel = [...reportLevelOrder].reverse().find((level) => reportPath[level]);
    if (!selectedLevel) return { level: "all" };
    const node = nodes.find((item) => item.id === reportPath[selectedLevel]);
    return {
      level: selectedLevel,
      id: node ? nodeIdValue(node) : reportPath[selectedLevel],
    };
  }, [nodes, reportPath]);

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
    setGenerateNotice("ตัวกรองเปลี่ยนแล้ว สรุปด้านซ้ายอัปเดตทันที กดสร้างเอกสารใหม่เมื่อพร้อม");
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
        {/* Page Header */}
        <div className="page-title">
          <div>
            <h1>สรุปผลทั้งหมดสำหรับเตรียมยื่น Premium T-VER</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        {/* Toolbar: Filter & Export Controls */}
        <section className="card report-toolbar shadow-sm border border-slate-200 rounded-xl mb-6">
          <div>
            <div className="card-title text-base">ตัวกรองพื้นที่รายงาน</div>
            <p className="muted text-sm">{selectedReportNode ? `กำลังดู: ${selectedReportNode.name}` : "กำลังดู: ภาพรวมทั้งระบบ"}</p>
          </div>
          <label>
            ภาค
            <select value={reportPath.region} onChange={(event) => selectReportPath("region", event.target.value)}>
              <option value="">ภาพรวมทั้งระบบ</option>
              {reportOptionsFor("region", nodes.find((node) => !node.parentId)?.id).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            จังหวัด
            <select value={reportPath.province} onChange={(event) => selectReportPath("province", event.target.value)} disabled={!reportPath.region}>
              <option value="">ทุกจังหวัดในภาค</option>
              {reportOptionsFor("province", reportPath.region).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            อำเภอ
            <select value={reportPath.district} onChange={(event) => selectReportPath("district", event.target.value)} disabled={!reportPath.province}>
              <option value="">ทุกอำเภอในจังหวัด</option>
              {reportOptionsFor("district", reportPath.province).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            ตำบล
            <select value={reportPath.subdistrict} onChange={(event) => selectReportPath("subdistrict", event.target.value)} disabled={!reportPath.district}>
              <option value="">ทุกตำบลในอำเภอ</option>
              {reportOptionsFor("subdistrict", reportPath.district).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <label>
            รายแปลง
            <select value={reportPath.field} onChange={(event) => selectReportPath("field", event.target.value)} disabled={!reportPath.subdistrict}>
              <option value="">ทุกแปลงในตำบล</option>
              {reportOptionsFor("field", reportPath.subdistrict).map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </label>
          <button
            className="run-all-btn report-generate-btn"
            type="button"
            onClick={generateReportPreview}
            disabled={!report || loading || generatingPreview}
          >
            สร้างเอกสารใหม่ (Generate Report)
          </button>
        </section>

        {generateNotice && (
          <div className="report-generate-notice bg-blue-50 text-blue-700 p-3 rounded-xl text-sm mb-5 border border-blue-100">
            {generateNotice}
          </div>
        )}

        {loading && <div className="empty-state">กำลังสร้างรายงานจากข้อมูลสมมุติเพื่อดูหน้าตาแดชบอร์ด...</div>}

        {report && (
          <>
            {/* Hidden PDF render target */}
            {generatedReport && (
              <div className="pdf-render-source">
                <div ref={pddEmissionRef}>
                  <PddCarbonSummary report={generatedReport} />
                </div>
              </div>
            )}

            {/* ─── 2-Column Grid ─────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

              {/* LEFT COLUMN: Blocks 1, 2, 3 */}
              <div className="flex flex-col gap-6">
                <ProjectContextBlock report={report} />
                <EvidenceBreakdownBlock report={report} />
                <TabbedInsightsBlock />
              </div>

              {/* RIGHT COLUMN: Preview & Download (sticky) */}
              <div className="flex flex-col gap-6">
                <div className="sticky top-6 flex flex-col gap-4">

                  {/* Export Toolbar */}
                  <section className="card report-toolbar shadow-sm border border-slate-200 rounded-xl" style={{ margin: 0 }}>
                    <div>
                      <div className="card-title text-base">เอกสารรายงาน (Export)</div>
                      <p className="muted text-sm">กดสร้างเอกสารใหม่เพื่อ Render PDF, Word และ Excel</p>
                    </div>
                    <div className="report-download-actions">
                      <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl || generatingPreview || !previewIsCurrent}>Download PDF</button>
                      <button className="run-btn word-download-btn" type="button" onClick={downloadWordDraft} disabled={!generatedReport || !previewIsCurrent}>Download Word</button>
                      <button className="run-all-btn excel-download-btn" type="button" onClick={exportExcel} disabled={!generatedReport || !previewIsCurrent}>Export Excel</button>
                    </div>
                  </section>

                  {/* Preview Panel */}
                  <section className="card report-preview-panel shadow-sm border border-slate-200 rounded-xl" style={{ margin: 0 }}>
                    <div className="report-preview-header">
                      <div>
                        <div className="card-title text-base">Preview &amp; Download</div>
                        <p className="muted text-xs">
                          {generatedReport
                            ? previewIsCurrent
                              ? `ตัวอย่างล่าสุด: ${new Date(generatedReport.generatedAt).toLocaleString()}`
                              : "ตัวอย่างเอกสารยังเป็นชุดเดิม กด Generate Report เพื่ออัปเดตตามตัวกรองปัจจุบัน"
                            : "เลือกตัวกรองด้านซ้ายให้เรียบร้อย แล้วกดสร้างเอกสารใหม่เพื่อดูตัวอย่าง"}
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

                    {!generatedReport && <div className="empty-state">ยังไม่มีตัวอย่างเอกสาร กด "สร้างเอกสารใหม่ (Generate Report)" เพื่อ Render PDF / Word / Excel</div>}
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
                  </section>

                </div>
              </div>

            </div>
            {/* ─── END 2-Column Grid ────────────────────────────── */}

            {/* Bottom Full-Width Tables (Blocks 4, 5, 6) */}
            <BottomTablesSection report={report} />
          </>
        )}
      </div>
    </div>
  );
}
