const fs = require('fs');
const files = [
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx',
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ReportPage.tsx',
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/SpatialPage.tsx',
  'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/FootprintReportPage.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/color:\s*"var\(--surface-400, #8fa3b0\)"/g, 'opacity: 0.6');
  fs.writeFileSync(file, content);
}

console.log('Opacity applied instead of hardcoded color.');
