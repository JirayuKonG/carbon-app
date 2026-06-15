const fs = require('fs');

// ReportPage.tsx
const reportPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ReportPage.tsx';
let content = fs.readFileSync(reportPage, 'utf8');

const reportOld = `<p className="muted">
                    {generatedReport
                      ? previewIsCurrent
                        ? \`ตัวอย่างล่าสุด: \${new Date(generatedReport.generatedAt).toLocaleString()}\`
                        : "ตัวอย่างเอกสารยังเป็นชุดเดิม กด Generate Report เพื่ออัปเดตตามตัวกรองปัจจุบัน"
                      : "เลือกตัวกรองด้านซ้ายให้เรียบร้อย แล้วกดสร้างเอกสารใหม่เพื่อดูตัวอย่าง"}
                  </p>`;

const reportNew = `<p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>
                    {generatedReport
                      ? previewIsCurrent
                        ? \`ข้อมูลฉบับร่างล่าสุด: \${new Date(generatedReport.generatedAt).toLocaleString()}\`
                        : "ข้อมูลฉบับร่างยังไม่อัปเดตตามเงื่อนไขปัจจุบัน กรุณากด Generate Report เพื่อสร้างเอกสารใหม่"
                      : "กรุณากำหนดเงื่อนไขด้านซ้าย และกดสร้างเอกสารใหม่เพื่อแสดงข้อมูลฉบับร่าง"}
                  </p>`;

content = content.replace(reportOld, reportNew);
fs.writeFileSync(reportPage, content);

// FootprintReportPage.tsx
const footprintPage = 'C:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/FootprintReportPage.tsx';
let contentFootprint = fs.readFileSync(footprintPage, 'utf8');

const fpOld1 = `<div className="card-title">เอกสารรายงาน</div>
              <p className="muted">เลือกตัวกรองให้เรียบร้อย แล้วกดสร้างเอกสารใหม่เพื่อ Render PDF, Word และ Excel สำหรับ preview/download</p>`;

const fpNew1 = `<div className="card-title">เอกสารรายงาน</div>
              <p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>กรุณากำหนดเงื่อนไขที่ต้องการ และกดสร้างเอกสารใหม่เพื่อประมวลผลไฟล์ PDF, Word และ Excel สำหรับการแสดงผลและการดาวน์โหลด</p>`;

contentFootprint = contentFootprint.replace(fpOld1, fpNew1);

const fpOld2 = `<p className="muted">
                  {generatedReport
                    ? previewIsCurrent
                      ? \`ตัวอย่างล่าสุด: \${generatedReport.scopeLabel} · \${generatedReport.caneLabel}\`
                      : "ตัวอย่างเอกสารยังเป็นชุดเดิม กด Generate Report เพื่ออัปเดตตามตัวกรองปัจจุบัน"
                    : "ยังไม่มีตัวอย่างเอกสาร กดสร้างเอกสารใหม่เพื่อ Render PDF / Word / Excel"}
                </p>`;

const fpNew2 = `<p className="muted text-xs font-normal" style={{ fontSize: "0.85em", opacity: 0.6 }}>
                  {generatedReport
                    ? previewIsCurrent
                      ? \`ข้อมูลฉบับร่างล่าสุด: \${generatedReport.scopeLabel} · \${generatedReport.caneLabel}\`
                      : "ข้อมูลฉบับร่างยังไม่อัปเดตตามเงื่อนไขปัจจุบัน กรุณากด Generate Report เพื่อสร้างเอกสารใหม่"
                    : "ยังไม่มีข้อมูลฉบับร่างในระบบ กรุณากดสร้างเอกสารใหม่เพื่อประมวลผลข้อมูล PDF / Word / Excel"}
                </p>`;

contentFootprint = contentFootprint.replace(fpOld2, fpNew2);
fs.writeFileSync(footprintPage, contentFootprint);

console.log('Replacements completed.');
