
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
let content = fs.readFileSync(path, "utf-8");

// 1. Remove CaneTypeSummaryPanel
// Look for <CaneTypeSummaryPanel result={caneTypeResult} mode="footprint" />
const canePanelRegex = /<CaneTypeSummaryPanel[^>]+mode="footprint"[^>]*\/>/g;
content = content.replace(canePanelRegex, "");

// 2. Remove Resource Consumption section
// It starts with <section className="card full-span">...<div className="card-title">Resource Consumption & Data Quality</div>
const resourceUsageRegex = /<section className="card full-span">[\s\S]*?<div className="card-title">Resource Consumption & Data Quality<\/div>[\s\S]*?<\/section>/g;
content = content.replace(resourceUsageRegex, "");

// 3. Update Graph 1 (ActivityGroupedBar)
// We need to change the toggle to "diff" and "details". The state is activityChartMode.
// We change activityChartMode values to "diff" | "details"
// We change the buttons:
const graph1Old = `<div className="card-title">การปล่อยคาร์บอนรายกระบวนการ · {selectedField?.fieldName ?? selectedCamp?.campName ?? \`ปีดำเนินการ \${currentYear || "-"}\`}</div>`;
const graph1New = `<div className="card-title">กราฟเปรียบเทียบ GHG รายกระบวนการ · {selectedField?.fieldName ?? selectedCamp?.campName ?? "รวม"}</div>`;
content = content.replace(graph1Old, graph1New);

const graph1ToggleOld = `{[
                ["both", "ปีฐาน VS ปีดำเนินการ"],
                ["baseline", "ปีฐาน"],
                ["current", "ปีดำเนินการ"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={activityChartMode === value ? "active" : ""}
                  onClick={() => setActivityChartMode(value as ActivityChartMode)}
                >
                  {label}
                </button>
              ))}`;
const graph1ToggleNew = `{[
                ["both", "ผลต่าง (Reduction)"],
                ["details", "ดูเพิ่มเติม (แยกปี)"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={(activityChartMode === value || (value === "both" && activityChartMode !== "details")) ? "active" : ""}
                  onClick={() => setActivityChartMode(value as ActivityChartMode)}
                >
                  {label}
                </button>
              ))}`;
content = content.replace(graph1ToggleOld, graph1ToggleNew);

// 4. Update Graph 2 (ProcessDoughnut)
// Old mode switch: PeriodSwitch
const graph2PeriodSwitch = `<PeriodSwitch value={period} currentYear={currentYear} onChange={setPeriod} />`;
const graph2PeriodSwitchNew = `<div className="group-mode-switch" role="group">
                <button type="button" className={graph2Mode === "single" ? "active" : ""} onClick={() => setGraph2Mode("single")}>ดูรายปี (ปี B)</button>
                <button type="button" className={graph2Mode === "compare" ? "active" : ""} onClick={() => setGraph2Mode("compare")}>เปรียบเทียบ (A/B)</button>
              </div>`;
content = content.replace(graph2PeriodSwitch, graph2PeriodSwitchNew);

// Adjust Graph 2 comparison data logic
const graph2DoughnutOld = `const comparisonActivities = (period === "baseline_avg" ? chartCurrentKg : chartBaselineKg).find((row) => row.process === item.process)?.activities;
              return (
                <article className="card sub-card" key={\`\${item.year}-\${item.process}\`}>
                  <ProcessDoughnut
                    title={selectedField ? \`\${item.process} · \${selectedField.fieldCode}\` : selectedCamp ? \`\${item.process} · \${periodLabel(period, currentYear)}\` : \`\${item.process} · \${yearName(item.year)}\`}
                    data={item.activities}
                    comparisonData={comparisonActivities}
                    unit={FOOTPRINT_UNIT}
                  />`;
const graph2DoughnutNew = `const comparisonActivities = graph2Mode === "compare" ? chartBaselineKg.find((row) => row.process === item.process)?.activities : undefined;
              const dataToDisplay = graph2Mode === "single" ? (chartCurrentKg.find(row => row.process === item.process)?.activities ?? []) : item.activities;
              
              // Only render if there is data
              if (dataToDisplay.length === 0 && (!comparisonActivities || comparisonActivities.length === 0)) return null;

              return (
                <article className="card sub-card" key={\`\${item.year}-\${item.process}\`}>
                  <ProcessDoughnut
                    title={selectedField ? \`\${item.process} · \${selectedField.fieldCode}\` : selectedCamp ? \`\${item.process} · \${graph2Mode === "single" ? actualGraphYearB : actualGraphYearB + " vs " + actualGraphYearA}\` : \`\${item.process}\`}
                    data={dataToDisplay}
                    comparisonData={comparisonActivities}
                    unit={FOOTPRINT_UNIT}
                  />`;
content = content.replace(graph2DoughnutOld, graph2DoughnutNew);

fs.writeFileSync(path, content, "utf-8");
console.log("Applied updates 2");
