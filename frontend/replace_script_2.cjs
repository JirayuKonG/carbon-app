const fs = require('fs');

// ProcessPage
const processPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx';
let content = fs.readFileSync(processPage, 'utf8');
content = content.replace(
  '<p className="muted text-xs">กรุณาเลือกมุมมองเพื่อแสดงข้อมูลการปล่อยคาร์บอน การสะสมคาร์บอนในดิน หรือผลลัพธ์สุทธิของโครงการ</p>',
  '<p className="muted text-xs font-normal" style={{ fontSize: "0.85em" }}>โปรดระบุมุมมองการแสดงผลสำหรับข้อมูลการปล่อยก๊าซเรือนกระจก การกักเก็บคาร์บอนในดิน หรือผลลัพธ์คาร์บอนสุทธิของโครงการ</p>'
);
content = content.replace(
  '<p className="muted text-xs">กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูล Carbon Footprint</p>',
  '<p className="muted text-xs font-normal" style={{ fontSize: "0.85em" }}>กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการประมวลผลข้อมูล Carbon Footprint</p>'
);
fs.writeFileSync(processPage, content);

// ReportPage
const reportPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ReportPage.tsx';
content = fs.readFileSync(reportPage, 'utf8');
content = content.replace(
  '<p className="muted text-xs">กรุณากำหนดขอบเขตพื้นที่ เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน {selectedReportNode ? `(กำลังดู: ${selectedReportNode.name})` : "(กำลังดู: ภาพรวมทั้งระบบ)"}</p>',
  '<p className="muted text-xs font-normal" style={{ fontSize: "0.85em" }}>กรุณาระบุกลุ่มไร่หลักและพื้นที่โครงการเป้าหมาย เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน {selectedReportNode ? `(กำลังดู: ${selectedReportNode.name})` : "(กำลังดู: ภาพรวมทั้งระบบ)"}</p>'
);
fs.writeFileSync(reportPage, content);

// SpatialPage
const spatialPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/SpatialPage.tsx';
content = fs.readFileSync(spatialPage, 'utf8');
content = content.replace(
  '<p className="muted text-xs" style={{ marginBottom: "1rem" }}>กรุณากำหนดขอบเขตพื้นที่ เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูลแผนที่</p>',
  '<p className="muted text-xs font-normal" style={{ marginBottom: "1rem", fontSize: "0.85em" }}>กรุณากำหนดขอบเขตพื้นที่และโครงการ เพื่อใช้เป็นเงื่อนไขในการแสดงผลข้อมูลแผนที่เชิงพื้นที่</p>'
);
fs.writeFileSync(spatialPage, content);

// FootprintReportPage
const footprintReportPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/FootprintReportPage.tsx';
content = fs.readFileSync(footprintReportPage, 'utf8');
content = content.replace(
  '<p className="muted text-xs">กรุณากำหนดขอบเขตพื้นที่และประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน</p>',
  '<p className="muted text-xs font-normal" style={{ fontSize: "0.85em" }}>กรุณาระบุกลุ่มไร่หลักและพื้นที่เป้าหมาย รวมถึงประเภทอ้อย เพื่อใช้เป็นเงื่อนไขในการจัดทำเอกสารรายงาน</p>'
);
fs.writeFileSync(footprintReportPage, content);

console.log('Replaced all texts with smaller size and formal language.');
