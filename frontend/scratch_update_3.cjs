
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
let content = fs.readFileSync(path, "utf-8");

// Graph 3 labels
// <small className={diff >= 0 ? "green-text" : "red-text"}>
//   {diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })} {FOOTPRINT_UNIT}/ไร่ จากปีฐาน {baselinePerRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}
// </small>

const graph3Old = `{diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })} {FOOTPRINT_UNIT}/ไร่ จากปีฐาน {baselinePerRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
const graph3New = `{diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })} {FOOTPRINT_UNIT}/ไร่ จากปี {actualGraphYearA} {baselinePerRai.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
content = content.replace(graph3Old, graph3New);

// Also the "ผลต่าง" label in Graph 1 summary list
const graph1SummaryOld = `{activityChartMode === "both" && (
              <div>
                <span>ผลต่าง</span>
                <strong className={chartDiff >= 0 ? "green-text" : "red-text"}>
                  {Math.abs(chartDiffKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}
                </strong>
              </div>
            )}`;
const graph1SummaryNew = `{activityChartMode === "both" && (
              <div>
                <span>ผลต่าง (Reduction)</span>
                <strong className={chartDiff >= 0 ? "green-text" : "red-text"}>
                  {Math.abs(chartDiffKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} {FOOTPRINT_UNIT}
                </strong>
              </div>
            )}`;
content = content.replace(graph1SummaryOld, graph1SummaryNew);

fs.writeFileSync(path, content, "utf-8");
console.log("Applied updates 3");
