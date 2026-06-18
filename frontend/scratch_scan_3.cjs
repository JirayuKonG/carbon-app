
const fs = require("fs");
const path = "c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx";
const content = fs.readFileSync(path, "utf-8");

const sectionRegex = /<section className="card full-span[^>]*>/g;
let match;
const indices = [];
while ((match = sectionRegex.exec(content)) !== null) {
  indices.push(match.index);
}

// Section 1 starts at indices[0]
// Section 2 starts at indices[1]
// Section 3 starts at indices[2]
// Section 4 starts at indices[3]
// Section 5 starts at indices[4]

const part1 = content.substring(0, indices[0]); // Before Section 1 (KPIs, filter, etc.)
const section1and2 = content.substring(indices[0], indices[2]); // Graph 1 and Graph 2
const section3and4 = content.substring(indices[2], indices[4]); // Camp summary and Camp comparison
const rest = content.substring(indices[4]); // Everything else

const newContent = part1 + section3and4 + section1and2 + rest;

fs.writeFileSync(path, newContent, "utf-8");
console.log("Swapped sections 1/2 with 3/4");
