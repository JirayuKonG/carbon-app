
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
let content = fs.readFileSync(path, "utf-8");

const target = "  const currentYear = currentYearFrom(emissions);\r\n  const selectedCampId = scope === \"all\" ? undefined : Number(scope.replace(\"camp-\", \"\"));";

const replacement = "  const currentYear = currentYearFrom(emissions);\r\n  const availableYears = Array.from(new Set(activities.map(a => a.year).filter(y => y !== \"baseline_avg\"))).sort();\r\n  const actualPeriod = period === \"project\" ? currentYear : period;\r\n  const actualGraphYearA = graphYearA === \"project\" ? currentYear : graphYearA;\r\n  const actualGraphYearB = graphYearB === \"project\" ? currentYear : graphYearB;\r\n  const selectedCampId = scope === \"all\" ? undefined : Number(scope.replace(\"camp-\", \"\"));";

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, "utf-8");
  console.log("Applied updates 4");
} else {
  // try \n
  const target2 = target.replace(/\r\n/g, "\n");
  const replacement2 = replacement.replace(/\r\n/g, "\n");
  if (content.includes(target2)) {
    content = content.replace(target2, replacement2);
    fs.writeFileSync(path, content, "utf-8");
    console.log("Applied updates 4 with \\n");
  } else {
    console.log("Target not found!");
  }
}
