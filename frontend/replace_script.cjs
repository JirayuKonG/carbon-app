const fs = require('fs');

const processPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx';
let content = fs.readFileSync(processPage, 'utf8');
content = content.replace(
  '<p className="muted">เลือกดูการปล่อยคาร์บอน การกักเก็บคาร์บอน หรือผลลัพธ์สุทธิของโครงการ</p>',
  '<p className="muted text-xs">กรุณาเลือกมุมมองเพื่อแสดงข้อมูลการปล่อยคาร์บอน การสะสมคาร์บอนในดิน หรือผลลัพธ์สุทธิของโครงการ</p>'
);
content = content.replace(
  '<p className="muted">กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูล Carbon Footprint</p>',
  '<p className="muted text-xs">กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูล Carbon Footprint</p>'
);
fs.writeFileSync(processPage, content);

const reportPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ReportPage.tsx';
content = fs.readFileSync(reportPage, 'utf8');
content = content.replace(
  '<p className="muted">กรุณากำหนดขอบเขตพื้นที่ เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน {selectedReportNode ? `(กำลังดู: ${selectedReportNode.name})` : "(กำลังดู: ภาพรวมทั้งระบบ)"}</p>',
  '<p className="muted text-xs">กรุณากำหนดขอบเขตพื้นที่ เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน {selectedReportNode ? `(กำลังดู: ${selectedReportNode.name})` : "(กำลังดู: ภาพรวมทั้งระบบ)"}</p>'
);
// Also in case the user meant Carbon Credit page, wait, I will check CarbonCreditPage manually later.
fs.writeFileSync(reportPage, content);

const spatialPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/SpatialPage.tsx';
content = fs.readFileSync(spatialPage, 'utf8');
content = content.replace(
  '<p className="muted" style={{ marginBottom: "1rem" }}>กรุณากำหนดขอบเขตพื้นที่ เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูลแผนที่</p>',
  '<p className="muted text-xs" style={{ marginBottom: "1rem" }}>กรุณากำหนดขอบเขตพื้นที่ เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูลแผนที่</p>'
);
fs.writeFileSync(spatialPage, content);

const footprintReportPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/FootprintReportPage.tsx';
content = fs.readFileSync(footprintReportPage, 'utf8');
content = content.replace(
  '<p className="muted">กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน</p>',
  '<p className="muted text-xs">กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน</p>'
);
fs.writeFileSync(footprintReportPage, content);

console.log('Replaced all.');
