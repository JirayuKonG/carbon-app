
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
const content = fs.readFileSync(path, "utf-8");

// Try to grab the high level section headers
const sections = content.split(/<section className="card full-span[^>]*>/g);
console.log(`Found ${sections.length} sections`);

for (let i = 1; i < Math.min(sections.length, 6); i++) {
  const preview = sections[i].substring(0, 150).replace(/\n/g, " ");
  console.log(`Section ${i}: ${preview}`);
}
