
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
const content = fs.readFileSync(path, "utf-8");

const matches = [...content.matchAll(/<section className="card full-span[^>]*>[\s\S]*?<div className="card-title[^>]*>([\s\S]*?)<\/div>/g)];

matches.forEach((m, i) => {
  console.log(`Match ${i}: Index ${m.index}, Title: ${m[1].trim()}`);
});
