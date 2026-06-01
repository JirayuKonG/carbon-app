import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { getCfSpatialNodes, getReportSummary } from "../services/dashboardApi";
import type { ReportFilter, ReportFilterLevel, ReportSummary, SpatialSummaryNode } from "../types/dashboard";
import "../cf-dashboard.css";

const LEVEL_LABEL: Record<ReportFilterLevel, string> = {
  all: "ทั้งหมด",
  region: "ภาค",
  province: "จังหวัด",
  district: "อำเภอ",
  subdistrict: "ตำบล",
  field: "รายแปลง",
};

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

export function CfReportPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [filter, setFilter] = useState<ReportFilter>({ level: "all" });
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCfSpatialNodes()
      .then((result) => setNodes(result.data))
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดตัวกรองพื้นที่ไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    setLoading(true);
    getReportSummary(filter)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดรายงานไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (!report || !reportRef.current) return;
    let revoked = "";
    const timer = window.setTimeout(() => {
      if (!reportRef.current) return;
      html2canvas(reportRef.current, { scale: 1.5, backgroundColor: "#ffffff" }).then((canvas) => {
        const pdf = new jsPDF("p", "mm", "a4");
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, height);
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

  const areaOptions = useMemo(
    () => nodes.filter((node) => filter.level !== "all" && node.level === filter.level),
    [filter.level, nodes],
  );

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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForSheet(report.transport)), "Transport");
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

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <p className="eyebrow">05 · Premium T-VER Report</p>
            <h1>สรุปผลทั้งหมดสำหรับเตรียมยื่น Premium T-VER</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="card report-toolbar">
          <label>
            ระดับรายงาน
            <select
              value={filter.level}
              onChange={(event) => setFilter({ level: event.target.value as ReportFilterLevel })}
            >
              {(Object.keys(LEVEL_LABEL) as ReportFilterLevel[]).map((level) => (
                <option key={level} value={level}>{LEVEL_LABEL[level]}</option>
              ))}
            </select>
          </label>
          {filter.level !== "all" && (
            <label>
              พื้นที่
              <select
                value={filter.id ?? ""}
                onChange={(event) => setFilter((prev) => ({ ...prev, id: event.target.value }))}
              >
                <option value="">เลือกพื้นที่</option>
                {areaOptions.map((node) => (
                  <option key={node.id} value={nodeIdValue(node)}>{node.name}</option>
                ))}
              </select>
            </label>
          )}
          <button className="run-btn" type="button" onClick={downloadPdf} disabled={!pdfUrl}>Download PDF</button>
          <button className="run-all-btn" type="button" onClick={exportExcel} disabled={!report}>Export Excel</button>
        </section>

        {loading && <div className="empty-state">กำลังสร้างรายงานจากข้อมูลจริง...</div>}

        {report && (
          <section className="report-layout">
            <div className="card report-paper" ref={reportRef}>
              <h2>Carbon Footprint Summary for Premium T-VER</h2>
              <p className="muted">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
              <h3>ภาพรวม</h3>
              <div className="report-kpi-grid">
                <div><span>Baseline avg</span><strong>{report.kpi.baselineAvgEmission.toLocaleString()} tCO2e</strong></div>
                <div><span>Project year {report.kpi.currentYear}</span><strong>{report.kpi.currentEmission.toLocaleString()} tCO2e</strong></div>
                <div><span>ผลต่าง</span><strong>{diffText(report.kpi.baselineAvgEmission, report.kpi.currentEmission)}</strong></div>
                <div><span>พื้นที่</span><strong>{report.kpi.fields} แปลง / {report.kpi.farmers} ราย</strong></div>
              </div>
              <h3>บทวิเคราะห์</h3>
              <p>{report.analysis.headline}</p>
              <ul>
                <li>กระบวนการที่ปล่อยสูงสุด: {report.analysis.topProcess}</li>
                <li>กระบวนการที่ปล่อยต่ำสุด: {report.analysis.lowProcess}</li>
                <li>ขนส่งที่ปล่อยสูงสุด: {report.analysis.topTransport}</li>
                <li>สรุปพื้นที่: {report.analysis.areaSummary}</li>
              </ul>
              <h3>ตารางเปรียบเทียบกระบวนการ</h3>
              <table className="report-table">
                <thead><tr><th>Year</th><th>Process</th><th>Emission</th><th>Type</th></tr></thead>
                <tbody>
                  {report.process.slice(0, 20).map((row) => (
                    <tr key={`${row.year}-${row.process}`}><td>{row.year}</td><td>{row.process}</td><td>{row.emission}</td><td>{row.isBaseline ? "Baseline" : "Project"}</td></tr>
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
            </div>

            <div className="card pdf-preview">
              <div className="card-title">PDF Preview</div>
              {pdfUrl ? <iframe title="Premium T-VER PDF Preview" src={pdfUrl} /> : <div className="empty-state">กำลังเตรียม preview...</div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
