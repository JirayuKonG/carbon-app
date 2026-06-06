import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { getCfSpatialNodes, getReportSummary } from "../services/dashboardApi";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import type { ReportFilter, ReportFilterLevel, ReportSummary, SpatialSummaryNode } from "../types/dashboard";
import "../cf-dashboard.css";

type CascadingReportLevel = Exclude<ReportFilterLevel, "all">;
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

function creditingRows(report: ReportSummary) {
  const summary = pddEmissionSummary(report);
  const years = Array.from({ length: 15 }, (_, index) => 2567 + index);
  const rows = years.map((year) => ({
    year,
    baseline: summary.baselineEmission,
    project: summary.projectEmission,
    leakage: summary.leakage,
    soc: summary.socRemoval,
    reduction: summary.emissionReduction,
    total: summary.totalReduction,
  }));
  const total = rows.reduce(
    (sum, row) => ({
      baseline: sum.baseline + row.baseline,
      project: sum.project + row.project,
      leakage: sum.leakage + row.leakage,
      soc: sum.soc + row.soc,
      reduction: sum.reduction + row.reduction,
      total: sum.total + row.total,
    }),
    { baseline: 0, project: 0, leakage: 0, soc: 0, reduction: 0, total: 0 },
  );
  return { rows, total };
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

function pddDraftHtml(report: ReportSummary) {
  const processRows = report.process
    .filter((row) => row.year === "baseline_avg" || row.year === report.kpi.currentYear)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year === "baseline_avg" ? -1 : 1;
      return sortReportProcessRows([a, b])[0] === a ? -1 : 1;
    })
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.year)}</td>
        <td>${escapeHtml(row.process)}</td>
        <td>${escapeHtml(row.emission)}</td>
        <td>${row.isBaseline ? "Baseline" : "Project"}</td>
      </tr>
    `)
    .join("");
  const inputRows = (report.processInputs ?? []).map((row) => `
    <tr>
      <td>${escapeHtml(row.process)}</td>
      <td>${escapeHtml(row.baselineFertilizerKg.toLocaleString())}</td>
      <td>${escapeHtml(row.currentFertilizerKg.toLocaleString())}</td>
      <td>${escapeHtml(row.baselineFuelLiter.toLocaleString())}</td>
      <td>${escapeHtml(row.currentFuelLiter.toLocaleString())}</td>
    </tr>
  `).join("");
  const spatialRows = report.spatialNodes.slice(0, 30).map((node) => `
    <tr>
      <td>${escapeHtml(node.level)}</td>
      <td>${escapeHtml(node.name)}</td>
      <td>${escapeHtml(node.fields)}</td>
      <td>${escapeHtml(node.areaRai.toLocaleString())}</td>
      <td>${escapeHtml(node.baselineEmission)}</td>
      <td>${escapeHtml(node.currentEmission)}</td>
    </tr>
  `).join("");

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
        <table><thead><tr><th>Year</th><th>Process</th><th>Emission</th><th>Type</th></tr></thead><tbody>${processRows}</tbody></table>

        <h2>5. ตารางปุ๋ยและน้ำมัน</h2>
        <table><thead><tr><th>Process</th><th>ปุ๋ย baseline (kg)</th><th>ปุ๋ย project (kg)</th><th>น้ำมัน baseline (L)</th><th>น้ำมัน project (L)</th></tr></thead><tbody>${inputRows}</tbody></table>

        <h2>6. รายละเอียดพื้นที่สำหรับภาคผนวก</h2>
        <table><thead><tr><th>Level</th><th>พื้นที่</th><th>แปลง</th><th>ไร่</th><th>Baseline</th><th>Project</th></tr></thead><tbody>${spatialRows}</tbody></table>

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

function PddCreditingSummary({ report }: { report: ReportSummary }) {
  const { rows, total } = creditingRows(report);
  return (
    <div className="pdd-paper">
      <div className="pdd-doc-header">
        <div>โครงการลดก๊าซเรือนกระจกภาคสมัครใจตามมาตรฐานของประเทศไทย</div>
        <div>มาตรฐานขั้นสูง (Premium T-VER)</div>
        <div>เอกสารสรุปข้อมูลสำหรับจัดทำ PDD จาก Carbon Analytics</div>
      </div>

      <h2>สรุปปริมาณก๊าซเรือนกระจกที่คาดว่าจะลดได้</h2>
      <p>ระยะเวลาการคิดเครดิตของโครงการ 15 ปี 1 ตุลาคม 2566 - 31 กันยายน 2581</p>
      <h3>ปริมาณการลดการปล่อยและการกักเก็บก๊าซเรือนกระจกรวม</h3>
      <table className="report-table pdd-table pdd-crediting-table">
        <thead>
          <tr>
            <th>ปี</th>
            <th>ปริมาณก๊าซเรือนกระจกจากกรณีฐาน (tonCO2e)</th>
            <th>ปริมาณก๊าซเรือนกระจกจากการดำเนินโครงการ (tonCO2e)</th>
            <th>ปริมาณก๊าซเรือนกระจกนอกขอบเขตโครงการ (tonCO2e)</th>
            <th>ปริมาณการสะสมคาร์บอนอินทรีย์ในดิน (tonCO2e)</th>
            <th>ปริมาณการลดก๊าซเรือนกระจก (tonCO2e)</th>
            <th>ปริมาณการลดการปล่อยและการกักเก็บก๊าซเรือนกระจกรวม (tonCO2e)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <td>{row.year}</td>
              <td>{numberCell(row.baseline)}</td>
              <td>{numberCell(row.project)}</td>
              <td>{numberCell(row.leakage)}</td>
              <td>{numberCell(row.soc)}</td>
              <td>{numberCell(row.reduction)}</td>
              <td>{numberCell(row.total)}</td>
            </tr>
          ))}
          <tr className="pdd-total-row">
            <td>รวม (tonCO2e)</td>
            <td>{numberCell(total.baseline)}</td>
            <td>{numberCell(total.project)}</td>
            <td>{numberCell(total.leakage)}</td>
            <td>{numberCell(total.soc)}</td>
            <td>{numberCell(total.reduction)}</td>
            <td>{numberCell(total.total)}</td>
          </tr>
          <tr>
            <td>จำนวนปี</td>
            <td>15</td>
            <td>15</td>
            <td>15</td>
            <td>15</td>
            <td>15</td>
            <td>15</td>
          </tr>
          <tr>
            <td>เฉลี่ยปีละ (tonCO2e/y)</td>
            <td>{numberCell(total.baseline / 15)}</td>
            <td>{numberCell(total.project / 15)}</td>
            <td>{numberCell(total.leakage / 15)}</td>
            <td>{numberCell(total.soc / 15)}</td>
            <td>{numberCell(total.reduction / 15)}</td>
            <td>{numberCell(total.total / 15)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function WebReportSummary({ report }: { report: ReportSummary }) {
  const summary = pddEmissionSummary(report);
  const totalInputs = summary.n2oProject + summary.co2FuelProject + summary.socRemoval;
  return (
    <>
      <h2>Final Submission Summary for Premium T-VER</h2>
      <p className="muted">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
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
      <h3>Evidence / Breakdown</h3>
      <div className="report-kpi-grid">
        <div><span>Baseline avg</span><strong>{report.kpi.baselineAvgEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>Project year {report.kpi.currentYear}</span><strong>{report.kpi.currentEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>ผลต่าง</span><strong>{diffText(report.kpi.baselineAvgEmission, report.kpi.currentEmission)}</strong></div>
        <div><span>พื้นที่</span><strong>{report.kpi.fields} แปลง / {report.kpi.farmers} ราย</strong></div>
        <div><span>Machine / Fuel</span><strong>{report.kpi.machineEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>ปุ๋ยรวม</span><strong>{report.kpi.fertilizerAmountKg.toLocaleString()} kg / {report.kpi.fertilizerEmission.toLocaleString()} tCO2e</strong></div>
      </div>
      <h3>ข้อมูลที่เตรียมใช้กรอกแบบฟอร์ม</h3>
      <div className="report-form-grid">
        <div><span>ขอบเขตโครงการ</span><strong>กระบวนการเพาะปลูกอ้อย 4 ขั้นตอน</strong></div>
        <div><span>ขั้นตอนที่ครอบคลุม</span><strong>การเตรียมดินและปลูก, การใช้ปุ๋ย, การให้น้ำและกำจัดวัชพืช, การเก็บเกี่ยว</strong></div>
        <div><span>ปีฐาน</span><strong>ค่าเฉลี่ยจากปีฐานก่อนหน้า</strong></div>
        <div><span>ปีดำเนินการ</span><strong>{report.kpi.currentYear}</strong></div>
        <div><span>จำนวนแปลง</span><strong>{report.kpi.fields.toLocaleString()} แปลง</strong></div>
        <div><span>สรุปพื้นที่</span><strong>{report.analysis.areaSummary}</strong></div>
      </div>
      <h3>สรุปปริมาณก๊าซเรือนกระจกที่คาดว่าจะลดได้</h3>
      <div className="report-form-grid">
        <div><span>ค่าเฉลี่ยปีฐาน</span><strong>{report.kpi.baselineAvgEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>ปีดำเนินโครงการ</span><strong>{report.kpi.currentEmission.toLocaleString()} tCO2e</strong></div>
        <div><span>ผลลดสุทธิ</span><strong>{diffText(report.kpi.baselineAvgEmission, report.kpi.currentEmission)}</strong></div>
        <div><span>ช่วงเวลาคิดเครดิต</span><strong>15 ปี</strong></div>
      </div>
      <h3>บทวิเคราะห์</h3>
      <p>{report.analysis.headline}</p>
      <ul>
        <li>กระบวนการที่ปล่อยสูงสุด: {report.analysis.topProcess}</li>
        <li>กระบวนการที่ปล่อยต่ำสุด: {report.analysis.lowProcess}</li>
        <li>สรุปพื้นที่: {report.analysis.areaSummary}</li>
      </ul>
      <h3>ตารางเปรียบเทียบกระบวนการ</h3>
      <table className="report-table">
        <thead><tr><th>Year</th><th>Process</th><th>Emission</th><th>Type</th></tr></thead>
        <tbody>
          {sortReportProcessRows(report.process).slice(0, 20).map((row) => (
            <tr key={`${row.year}-${row.process}`}><td>{row.year}</td><td>{row.process}</td><td>{row.emission}</td><td>{row.isBaseline ? "Baseline" : "Project"}</td></tr>
          ))}
        </tbody>
      </table>
      <h3>ตารางปุ๋ยและน้ำมัน</h3>
      <table className="report-table">
        <thead><tr><th>Process</th><th>ปุ๋ย baseline (kg)</th><th>ปุ๋ย project (kg)</th><th>น้ำมัน baseline (L)</th><th>น้ำมัน project (L)</th></tr></thead>
        <tbody>
          {(report.processInputs ?? []).map((row) => (
            <tr key={row.process}>
              <td>{row.process}</td>
              <td>{row.baselineFertilizerKg.toLocaleString()}</td>
              <td>{row.currentFertilizerKg.toLocaleString()}</td>
              <td>{row.baselineFuelLiter.toLocaleString()}</td>
              <td>{row.currentFuelLiter.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>ตารางพื้นที่</h3>
      <table className="report-table">
        <thead><tr><th>พื้นที่</th><th>แปลง</th><th>ไร่</th><th>Baseline</th><th>Project</th></tr></thead>
        <tbody>
          {report.spatialNodes.slice(0, 20).map((node) => (
            <tr key={node.id}><td>{node.name}</td><td>{node.fields}</td><td>{node.areaRai}</td><td>{node.baselineEmission}</td><td>{node.currentEmission}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function CfReportPage() {
  const pddEmissionRef = useRef<HTMLDivElement>(null);
  const pddCreditingRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [reportPath, setReportPath] = useState<Record<CascadingReportLevel, string>>(emptyReportPath);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (!report || !pddEmissionRef.current || !pddCreditingRef.current) return;
    let revoked = "";
    const timer = window.setTimeout(() => {
      if (!pddEmissionRef.current || !pddCreditingRef.current) return;
      Promise.all([
        html2canvas(pddEmissionRef.current, { scale: 1.8, backgroundColor: "#ffffff" }),
        html2canvas(pddCreditingRef.current, { scale: 1.8, backgroundColor: "#ffffff" }),
      ]).then((canvases) => {
        const pdf = new jsPDF("l", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const margin = 8;
        const imageWidth = width - margin * 2;
        canvases.forEach((canvas, index) => {
          if (index > 0) pdf.addPage();
          const image = canvas.toDataURL("image/png");
          const height = (canvas.height * imageWidth) / canvas.width;
          pdf.addImage(image, "PNG", margin, margin, imageWidth, height);
        });
        const url = URL.createObjectURL(pdf.output("blob"));
        setPdfUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        revoked = url;
      });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [report]);

  const reportOptionsFor = (level: CascadingReportLevel, parentId?: string) =>
    nodes.filter((node) => node.level === level && (!parentId || node.parentId === parentId));

  const selectReportPath = (level: CascadingReportLevel, id: string) => {
    const levelIndex = reportLevelOrder.indexOf(level);
    const next = { ...reportPath, [level]: id };
    reportLevelOrder.slice(levelIndex + 1).forEach((key) => {
      next[key] = "";
    });
    setReportPath(next);
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "premium-tver-carbon-summary.pdf";
    a.click();
  };

  const exportExcel = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet([report.kpi])), "KPI");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.process)), "Process");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.processInputs ?? [])), "Inputs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.spatialNodes.map((node) => ({
      level: node.level,
      name: node.name,
      fields: node.fields,
      farmers: node.farmers,
      areaRai: node.areaRai,
      baselineEmission: node.baselineEmission,
      currentEmission: node.currentEmission,
      diff: node.currentEmission - node.baselineEmission,
    })))), "Spatial");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet([report.analysis])), "Analysis");
    XLSX.writeFile(wb, "premium-tver-carbon-summary.xlsx");
  };

  const downloadWordDraft = () => {
    if (!report) return;
    const blob = new Blob([pddDraftHtml(report)], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "premium-tver-pdd-data-draft.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <div className="card-title">ตัวกรองพื้นที่รายงาน</div>
            <p className="muted">{selectedReportNode ? `กำลังดู: ${selectedReportNode.name}` : "กำลังดู: ภาพรวมทั้งระบบ"}</p>
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
          <button className="run-btn pdf-download-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl}>Download PDF</button>
          <button className="run-btn word-download-btn" type="button" onClick={downloadWordDraft} disabled={!report}>Download Word</button>
          <button className="run-all-btn excel-download-btn" type="button" onClick={exportExcel} disabled={!report}>Export Excel</button>
        </section>

        {loading && <div className="empty-state">กำลังสร้างรายงานจากข้อมูลสมมุติเพื่อดูหน้าตาแดชบอร์ด...</div>}

        {report && (
          <>
          <div className="pdf-render-source">
            <div ref={pddEmissionRef}>
              <PddCarbonSummary report={report} />
            </div>
            <div ref={pddCreditingRef}>
              <PddCreditingSummary report={report} />
            </div>
          </div>
          <section className="report-layout">
            <div className="card report-paper">
              <WebReportSummary report={report} />
            </div>

            <div className="report-preview-stack">
              <div className="card pdf-preview">
                <div className="card-title">PDF Preview</div>
                {pdfUrl ? <iframe title="Premium T-VER PDF Preview" src={pdfUrl} /> : <div className="empty-state">กำลังเตรียม preview...</div>}
              </div>

              <div className="card word-preview">
                <div className="card-title">Word Preview · เอกสารร่างที่แก้ไขได้</div>
                <iframe title="Premium T-VER Word Draft Preview" srcDoc={pddDraftHtml(report)} />
              </div>

              <div className="card excel-preview">
                <div className="card-title">Excel Preview · Sheet ที่จะ Export</div>
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
                      <thead><tr><th>Year</th><th>Process</th><th>Emission</th></tr></thead>
                      <tbody>
                        {sortReportProcessRows(report.process.filter((row) => row.year === "baseline_avg" || row.year === report.kpi.currentYear)).slice(0, 8).map((row) => (
                          <tr key={`excel-process-${row.year}-${row.process}`}><td>{row.year}</td><td>{row.process}</td><td>{row.emission}</td></tr>
                        ))}
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
                      <thead><tr><th>พื้นที่</th><th>แปลง</th><th>ไร่</th></tr></thead>
                      <tbody>
                        {report.spatialNodes.slice(0, 6).map((node) => (
                          <tr key={`excel-spatial-${node.id}`}><td>{node.name}</td><td>{node.fields}</td><td>{node.areaRai.toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>
          </>
        )}
      </div>
    </div>
  );
}
