import { Bar, Doughnut } from "react-chartjs-2";
import type { TooltipItem } from "chart.js";
import type { ActivityValue } from "../../types/dashboard";
import { chartColors, chartOptions, chartPalette } from "./ChartRegistry";
import "./ChartRegistry";

const exactActivityColorMap: Record<string, string> = {
  // 4 หมวดหมู่หลัก (จัดกลุ่มใหม่)
  "น้ำมัน": "#3B82F6", // Blue
  "ปุ๋ย": "#22C55E", // Green
  "สารเคมี": "#EF4444", // Red
  "ไฟฟ้า": "#F59E0B", // Yellow

  // 1. การเตรียมดินและปลูก
  "ปุ๋ย/ปูนปรับปรุงดิน": "#86EFAC", // Soft Mint Green
  "เครื่องจักร": "#FDE68A", // Warm Pastel Yellow
  // 2. การใช้ปุ๋ย
  "ปุ๋ยรองพื้น": "#2DD4BF", // Pastel Teal
  "ท่อนพันธุ์": "#FDBA74", // Pastel Orange
  // 3. การให้น้ำและกำจัดวัชพืช
  "ปุ๋ยเคมี": "#FDA4AF", // Pastel Rose Pink
  "สารเคมี/สารกำจัดวัชพืช": "#C4B5FD", // Pastel Lavender
  "น้ำ/ไฟฟ้า": "#67E8F9", // Pastel Cyan
  "น้ำมันสูบน้ำ": "#A5B4FC", // Pastel Indigo
  // 4. การเก็บเกี่ยว
  "น้ำมันรถตัด": "#38BDF8", // Pastel Sky Blue
  "แรงงาน/เครื่องมือ": "#FCD34D", // Pastel Gold/Amber
  "รวบรวมผลผลิต": "#F9A8D4", // Pastel Pink
};

const activityColorMap: { pattern: RegExp; color: string }[] = [
  // 1. กลุ่มเชื้อเพลิง/น้ำมัน (น้ำเงินพาสเทล)
  { pattern: /น้ำมัน|ดีเซล|fuel|สูบน้ำ|รถตัด/i, color: "#93C5FD" }, // Light blue pastel
  // 2. กลุ่มปุ๋ย/สารปรับปรุงดิน (เขียวพาสเทล)
  { pattern: /ปุ๋ย|ปูน|อินทรีย์|หมัก|เคมี|ไนโตรเจน/i, color: "#86EFAC" }, // Light green pastel
  // รองรับทั้งคำใหม่และคำเดิมจากข้อมูลเก่าเพื่อให้การจัดสีกลุ่มยังทำงานต่อเนื่อง
  { pattern: /สารเคมี|ยาป้องกัน|ศัตรูพืช|วัชพืช|chemical|herbicide|pesticide/i, color: "#C4B5FD" }, // Light purple/violet pastel
  // 4. กลุ่มเครื่องจักร/เครื่องมือ/แรงงาน (ส้ม/เหลืองพาสเทล)
  { pattern: /เครื่องจักร|เครื่องมือ|แรงงาน|machine|equipment|labor|รวบรวมผลผลิต/i, color: "#FDE68A" }, // Warm cream/yellow-orange pastel
  // 5. แหล่งน้ำ/ไฟฟ้า (ฟ้า/เทอร์คอยส์พาสเทล)
  { pattern: /น้ำ\/ไฟฟ้า|ไฟฟ้า|irrigation|water/i, color: "#99F6E4" }, // Cyan/Teal pastel
  // 6. ท่อนพันธุ์/วัตถุดิบปลูก (เขียวตองอ่อนพาสเทล)
  { pattern: /ท่อนพันธุ์|พันธุ์|seed/i, color: "#D9F99D" }, // Lime green pastel
];

function stableColorForLabel(label: string) {
  const trimmed = label.trim();
  if (exactActivityColorMap[trimmed]) {
    return exactActivityColorMap[trimmed];
  }
  const mapped = activityColorMap.find((item) => item.pattern.test(trimmed));
  if (mapped) return mapped.color;
  let hash = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    hash = ((hash * 31) + trimmed.charCodeAt(index)) % 1000003;
  }
  return chartColors[hash % chartColors.length];
}

export function ProcessDoughnut({
  title,
  data,
  comparisonData,
  unit = "tCO2e",
  variant = "doughnut",
}: {
  title?: string;
  data: ActivityValue[];
  comparisonData?: ActivityValue[];
  unit?: string;
  variant?: "doughnut" | "bar" | "comparisonBar";
}) {
  const total = data.reduce((sum, item) => sum + item.emission, 0);
  const totalLabel = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const comparisonTotal = (comparisonData ?? []).reduce((sum, item) => sum + item.emission, 0);
  const comparisonDiff = comparisonTotal - total;
  const comparisonDiffPct = total ? (comparisonDiff / total) * 100 : 0;
  const comparisonMap = new Map((comparisonData ?? []).map((item) => [item.name, item.emission]));
  const comparisonLabels = Array.from(new Set([...data.map((item) => item.name), ...(comparisonData ?? []).map((item) => item.name)]));
  const dataColors = data.map((item) => stableColorForLabel(item.name));
  const growthFor = (name: string, value: number) => {
    const previous = comparisonMap.get(name);
    if (previous === undefined || previous === 0) return undefined;
    return ((value - previous) / previous) * 100;
  };
  const isBar = variant === "bar";
  const isComparisonBar = variant === "comparisonBar";
  const barOptions = {
    ...chartOptions,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      legend: { display: isComparisonBar, labels: { color: "#5B728A", boxWidth: 12, font: { size: 12 } } },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"bar">) => {
            const value = Number(context.parsed.y || 0);
            const growth = growthFor(String(context.label), value);
            const datasetLabel = context.dataset.label ? `${context.dataset.label}: ` : "";
            const lines = [`${datasetLabel}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`];
            if (!isComparisonBar && growth !== undefined) {
              lines.push(`Delta/Growth: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        ticks: {
          ...chartOptions.scales.x.ticks,
          font: { size: 11 },
          padding: 8,
        },
      },
    },
  };
  return (
    <div className="doughnut-wrap">
      {title && <h3>{title}</h3>}
      <div className={`doughnut-canvas${isBar || isComparisonBar ? " process-share-bar-canvas" : ""}`}>
        {isComparisonBar ? (
          <Bar
            data={{
              labels: comparisonLabels,
              datasets: [
                {
                  label: `ปีฐาน (${unit})`,
                  data: comparisonLabels.map((label) => data.find((item) => item.name === label)?.emission ?? 0),
                  backgroundColor: chartPalette.baseline.bg,
                  borderColor: chartPalette.baseline.border,
                  borderWidth: 1,
                },
                {
                  label: `ปีดำเนินการ (${unit})`,
                  data: comparisonLabels.map((label) => comparisonMap.get(label) ?? 0),
                  backgroundColor: chartPalette.project.bg,
                  borderColor: chartPalette.project.border,
                  borderWidth: 1,
                },
              ],
            }}
            options={barOptions}
          />
        ) : isBar ? (
          <Bar
            data={{
              labels: data.map((item) => item.name),
              datasets: [
                {
                  label: `ปริมาณการปล่อย (${unit})`,
                  data: data.map((item) => item.emission),
                  backgroundColor: dataColors,
                  borderColor: dataColors,
                  borderWidth: 1,
                },
              ],
            }}
            options={{ ...barOptions, plugins: { ...barOptions.plugins, legend: { display: false } } }}
          />
        ) : (
          <>
            <Doughnut
              data={{
                labels: data.map((item) => item.name),
                datasets: [
                  {
                    data: data.map((item) => item.emission),
                    backgroundColor: dataColors,
                    borderColor: "#FFFFFF",
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                plugins: {
                  legend: {
                    display: false,
                    labels: { color: "#5B728A", boxWidth: 10, font: { size: 11 } },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const value = Number(context.parsed || 0);
                        const growth = growthFor(String(context.label), value);
                        const lines = [`${context.label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`];
                        if (growth !== undefined) {
                          lines.push(`Delta/Growth: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`);
                        }
                        return lines;
                      },
                    },
                  },
                },
              }}
            />
            <div className="doughnut-center-label" aria-label={`ปริมาณการปล่อยรวม ${totalLabel} ${unit}`}>
              <small>ปริมาณการปล่อย</small>
              <strong>{totalLabel}</strong>
              <span>{unit}</span>
            </div>
          </>
        )}
      </div>
      <div className={isComparisonBar ? "process-total-summary" : "value-legend"}>
        {isComparisonBar ? (
          <>
            <div className="process-total-card baseline">
              <span>ปีฐานรวมทุกกระบวนการ</span>
              <strong>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong>
            </div>
            <div className="process-total-card current">
              <span>ปีดำเนินการรวมทุกกระบวนการ</span>
              <strong>{comparisonTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong>
            </div>
            <div className={`process-total-card delta ${comparisonDiff <= 0 ? "good" : "bad"}`}>
              <span>{comparisonDiff <= 0 ? "ลดลงจากปีฐาน" : "เพิ่มขึ้นจากปีฐาน"}</span>
              <strong>
                {Math.abs(comparisonDiff).toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                <small> ({comparisonDiff >= 0 ? "+" : "-"}{Math.abs(comparisonDiffPct).toFixed(1)}%)</small>
              </strong>
            </div>
          </>
        ) : data.map((item, index) => {
            const pct = total ? (item.emission / total) * 100 : 0;
            const growth = growthFor(item.name, item.emission);
            return (
              <div className="value-legend-row" key={item.name}>
                <span className="legend-swatch" style={{ background: dataColors[index] }} />
                <span className="legend-name">{item.name}</span>
                <span className="legend-values">
                  <strong>{item.emission.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong>
                  <small>{pct.toFixed(1)}%</small>
                  {growth !== undefined && (
                    <small className={`growth-pill ${growth <= 0 ? "good" : "bad"}`}>
                      {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                    </small>
                  )}
                </span>
              </div>
            );
          })}
        {!data.length && <div className="empty-state">ไม่มีข้อมูลสำหรับแผนภูมินี้</div>}
      </div>
    </div>
  );
}
