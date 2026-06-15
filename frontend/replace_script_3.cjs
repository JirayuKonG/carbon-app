const fs = require('fs');
const files = [
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx',
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ReportPage.tsx',
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/SpatialPage.tsx',
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/FootprintReportPage.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Replace all occurrences of fontSize: "0.85em" without opacity
  // Or just replace the whole style tag if possible
  content = content.replace(/fontSize:\s*"0\.85em"/g, 'fontSize: "0.85em", color: "var(--surface-400, #8fa3b0)"');
  fs.writeFileSync(file, content);
}

console.log('Faded colors applied.');
