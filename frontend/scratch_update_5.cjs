
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
let content = fs.readFileSync(path, "utf-8");

const target = `  const [period, setPeriod] = useState<PeriodMode>("project");`;
const replacement = `  const [period, setPeriod] = useState<PeriodMode>("project");
  const [graphYearA, setGraphYearA] = useState<string>("baseline_avg");
  const [graphYearB, setGraphYearB] = useState<string>("project");
  const [graph2Mode, setGraph2Mode] = useState<"single" | "compare">("single");`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, "utf-8");
  console.log("Applied updates 5");
} else {
  console.log("Target not found!");
}
