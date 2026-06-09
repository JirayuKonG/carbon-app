# Summary Kong Work

Last updated: 2026-06-09

## Project

Carbon Footprint Management & Traceability System เป็นระบบสำหรับจัดการข้อมูลคาร์บอนฟุตพริ้นท์ในอุตสาหกรรมอ้อย ครอบคลุมการจัดการข้อมูลเกษตรกร พื้นที่เพาะปลูก กิจกรรมการเพาะปลูก ปัจจัยการปล่อยคาร์บอน การคำนวณ และหน้าสรุปผลเชิงวิเคราะห์

เทคโนโลยีหลักของโปรเจกต์:

- Frontend: Vite + React 18 + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma 5
- Data fetching: TanStack Query

## My Main Responsibility

งานที่รับผิดชอบหลักคือส่วน Carbon Dashboard / Carbon Analytics และเอกสารสรุปรายงาน โดยเน้นการออกแบบหน้าแสดงผล การเชื่อมโยงข้อมูล การจัดโครงสร้างหน้ารายงาน และการทำ workflow ที่ช่วยให้ผู้ใช้วิเคราะห์ข้อมูลได้ง่ายขึ้น

พื้นที่งานที่เกี่ยวข้องหลัก:

- `frontend/src/features/cf-dashboard/`
- `backend/src/modules/analytics/`
- routing และ navigation ที่เกี่ยวข้องกับหน้า dashboard
- report preview / export flow

## Main Work Completed

### 1. Carbon Analytics Pages

พัฒนาและปรับปรุงหน้าหลักของ Carbon Analytics ได้แก่:

- `/overview` สำหรับภาพรวม Carbon
- `/process` สำหรับวิเคราะห์กระบวนการเพาะปลูก
- `/spatial` สำหรับแผนที่และการ drill-down รายพื้นที่
- `/report` สำหรับรายงาน Premium T-VER
- `/calculate/footprint` สำหรับ workflow การคำนวณ Carbon Footprint
- `/calculate/credit` สำหรับหน้าเปรียบเทียบ Carbon Credit

### 2. Dashboard UX / UI Improvements

งานที่ทำในส่วน UX/UI มีทั้งการจัด layout, filter, drill-down และการแยก flow ให้ผู้ใช้เข้าใจข้อมูลได้ง่ายขึ้น เช่น:

- ปรับเมนูและโครงสร้างหน้า Carbon Analytics ให้ใช้งานง่ายขึ้น
- แยกหน้า Spatial ออกจากหน้าภาพรวม เพื่อให้ข้อมูลแผนที่ชัดเจนขึ้น
- เพิ่ม leaderboard, KPI, grouped charts, trend comparisons และ summary cards
- ปรับ filter ในหลายหน้าให้สอดคล้องกับบริบทของแต่ละรายงาน
- เพิ่ม `DashboardVisibilityMenu` เพื่อให้ผู้ใช้เลือกแสดงหรือซ่อน summary cards ได้

### 3. Reporting Flow

พัฒนาระบบรายงานให้ผู้ใช้สามารถดูข้อมูลบนหน้าเว็บและสร้างเอกสารได้อย่างเป็นขั้นตอน:

- แยกข้อมูล summary บนหน้าเว็บออกจาก preview/download document
- เพิ่มปุ่ม Generate Report เพื่อให้ preview ใช้ snapshot ตาม filter ล่าสุด
- รองรับ preview/download หลายรูปแบบ เช่น PDF, Word และ Excel ในบางหน้ารายงาน
- ปรับหน้า Premium T-VER และ Footprint Report ให้เหมาะกับการใช้งานเชิงนำเสนอและการส่งออกเอกสาร

### 4. Spatial And Drill-Down Experience

งานด้านแผนที่และรายละเอียดพื้นที่ที่พัฒนาเพิ่มเติม:

- ปรับหน้า `/spatial` ให้รองรับ filter ที่สัมพันธ์กับข้อมูลแผนที่
- เพิ่มการ drill-down ตามระดับพื้นที่
- เพิ่มข้อมูลสรุปเชิงพื้นที่ เช่น camp, land details, SOC, carbon comparison
- เพิ่ม visualization เช่น Net Zero progress และ correlation chart

### 5. Carbon Footprint / Carbon Credit Presentation

มีการปรับหน้าแสดงผล Carbon Footprint ให้เล่าเรื่องข้อมูลได้ชัดขึ้น:

- แยกมุมมอง `การปล่อยคาร์บอน` และ `การกักเก็บ / SOC & Credits`
- ปรับ charts ให้หน่วยข้อมูลสอดคล้องกันมากขึ้น
- เพิ่ม comparison ระหว่าง baseline และ project year
- เพิ่ม Top/Bottom camp analysis และ drill-down ไปยังรายงานละเอียด

## Related Project Improvements Found In Docs

จากเอกสารใน repo งานรอบเดียวกันยังมีผลต่อภาพรวมระบบดังนี้:

- ปรับ Prisma schema ให้สอดคล้องกับ live Aiven PostgreSQL เมื่อ 2026-06-08
- เพิ่มความเข้ากันได้ของ backend create flows หลัง schema sync
- ปรับ activity import ให้รองรับไฟล์ใหญ่ขึ้นและ import แบบ chunk
- เพิ่ม import history สำหรับ activities
- ปรับ route, sidebar behavior และ CRUD บางส่วนของ lands / geo / infra

## Current Project Status

สถานะปัจจุบันของโปรเจกต์จากเอกสาร:

- ระบบหลักเป็น monorepo ขนาดเล็ก แยก `frontend/`, `backend/`, `shared/`
- Swagger พร้อมใช้งานที่ `http://localhost:3000/api/docs`
- คำสั่ง build หลักของ frontend และ backend ผ่านแล้วตามบันทึกล่าสุด
- ฐานข้อมูลอ้างอิงปัจจุบันคือ `backend/src/prisma/schema.prisma`

หมายเหตุสำคัญ:

- เอกสาร `CONTEXT.md` ระบุว่า Carbon Analytics frontend บางส่วนยังอยู่ใน mock preview mode ผ่าน `ENABLE_API_DASHBOARD = false`
- แต่ `DASHBOARD_WORK_SUMMARY.md` ยังบันทึกประวัติการพัฒนา dashboard ในมุมที่เน้น behavior และหน้าจอเป็นหลัก
- ดังนั้นหากจะทำงานต่อใน dashboard ควรตรวจสอบก่อนว่า task ถัดไปต้องการใช้ mock data ต่อ หรือจะเปิด real API integration

## Verification

คำสั่งที่ถูกบันทึกว่าตรวจสอบผ่านในเอกสาร:

```bash
npm run prisma:generate --workspace=backend
npm run build --workspace=backend
npm run build --workspace=frontend
npm run build
```

## Open Risks / Next Focus

ประเด็นที่ยังควรติดตามต่อจาก `BUG_LOG.md` และ `CONTEXT.md`:

- บางตารางยังไม่มี database-generated primary key
- หลาย service ยังมีความเสี่ยงจากการใช้ `MAX(id) + 1`
- บาง controller ยังรับค่า raw body โดยไม่ normalize type ให้ชัดเจน
- Weather manual-entry modal ยัง wiring ไม่ครบ
- การ persist ผลคำนวณ CO2e สำหรับ analytics ยังต้องยืนยันแนวทางให้ชัด
- Dashboard data source ควรสรุปให้ชัดว่าจะใช้ mock หรือ real API เป็น source of truth

## Useful Reference Docs

หากต้องการดูรายละเอียดเพิ่ม ให้เริ่มจากไฟล์ต่อไปนี้:

- `README.md`
- `GUIDE.md`
- `CONTEXT.md`
- `COMPONENT_PJ.md`
- `BUG_LOG.md`
- `DASHBOARD_WORK_SUMMARY.md`

## Short Summary

สรุปงานของ Kong ในโปรเจกต์นี้คือการพัฒนาและปรับปรุงส่วน Carbon Dashboard / Carbon Analytics เป็นหลัก ครอบคลุมหน้าภาพรวม กระบวนการเพาะปลูก แผนที่พื้นที่ รายงาน Premium T-VER และหน้า Carbon Footprint / Carbon Credit โดยเน้นทั้งการจัดโครงสร้างข้อมูล การออกแบบประสบการณ์ผู้ใช้ การทำ filter / drill-down / report flow และการทำให้หน้าสรุปผลพร้อมใช้งานสำหรับการวิเคราะห์และการนำเสนอ
