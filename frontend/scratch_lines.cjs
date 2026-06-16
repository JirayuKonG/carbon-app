
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
const lines = fs.readFileSync(path, "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(`className="card-title"`)) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
