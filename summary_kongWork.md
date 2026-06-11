# Summary Kong Work

Last updated: 2026-06-10

## Project

Carbon Footprint Management & Traceability System เป็นระบบสำหรับจัดการข้อมูลคาร์บอนฟุตพริ้นท์ในอุตสาหกรรมอ้อย ครอบคลุมข้อมูลเกษตรกร พื้นที่เพาะปลูก กิจกรรมการเกษตร ปัจจัยการผลิต การคำนวณคาร์บอน และหน้ารายงานเชิงวิเคราะห์

เทคโนโลยีหลักของโปรเจกต์:

- Frontend: Vite + React 18 + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma 5
- Data fetching: TanStack Query

## My Main Responsibility

งานที่รับผิดชอบหลักครอบคลุม 2 กลุ่มใหญ่:

- Carbon Dashboard / Carbon Analytics
- Activities Management / Carbon Calculation workflow

ภาพรวมของงานไม่ใช่แค่ทำ UI แต่รวมถึงการเชื่อมข้อมูลระหว่าง frontend และ backend, การออกแบบ workflow สำหรับผู้ใช้, การรองรับ import ข้อมูล, และการจัดโครงสร้างข้อมูลให้พร้อมต่อการคำนวณคาร์บอนในขั้นถัดไป

พื้นที่งานที่เกี่ยวข้องหลัก:

- `frontend/src/features/cf-dashboard/`
- `frontend/src/features/activities/`
- `frontend/src/components/layout/Sidebar.tsx`
- `backend/src/modules/analytics/`
- `backend/src/modules/activities/`

## Main Work Completed

### 1. Carbon Analytics Pages

พัฒนาและปรับปรุงหน้าหลักของ Carbon Analytics ได้แก่:

- `/overview` สำหรับภาพรวม Carbon Credit
- `/process` สำหรับ Carbon Footprint / process analysis
- `/spatial` สำหรับแผนที่และการ drill-down รายพื้นที่
- `/report` สำหรับรายงาน Premium T-VER
- `/footprint-report` สำหรับรายงานคาร์บอนฟุตพริ้นท์
- `/calculate/footprint` สำหรับ workflow การคำนวณ Carbon Footprint
- `/calculate/credit` สำหรับหน้าเปรียบเทียบ Carbon Credit

### 2. Dashboard UX / UI Improvements

งานที่ทำในส่วน dashboard UX/UI มีทั้งการจัด layout, filter, navigation และการแยก flow ให้ผู้ใช้เข้าใจข้อมูลได้ง่ายขึ้น เช่น:

- ปรับโครงสร้างเมนู Carbon Analytics และ sidebar navigation
- แยกหน้า Spatial ออกจากหน้าภาพรวม เพื่อให้ข้อมูลแผนที่ชัดเจนขึ้น
- เพิ่ม leaderboard, KPI, grouped charts, trend comparisons และ summary cards
- ปรับ filter ในหลายหน้าให้สอดคล้องกับบริบทของแต่ละรายงาน
- เพิ่ม `DashboardVisibilityMenu` เพื่อให้ผู้ใช้เลือกแสดงหรือซ่อน summary cards ได้
- ปรับ report preview / export flow ให้ใช้งานแยกจากหน้า summary ปกติ

### 3. Activities Management Pages

พัฒนาและขยายหน้าจัดการกิจกรรมในฝั่ง frontend โดยเฉพาะที่ `ActivitiesPage.tsx`:

- รองรับการจัดการ `activities_header` และ `log_activities_detail` ในหน้าเดียว
- เพิ่ม modal/floor form สำหรับ create, edit และ delete ทั้งหัวข้อกิจกรรมและรายการบันทึกกิจกรรม
- เพิ่มการกรองข้อมูลตามช่วงวันที่, camp, land, activity type, detail type, resource type และ calculation status
- ปรับการแสดงรายการที่เชื่อมโยง land, camp, sugarcane type และข้อมูลประกอบอื่น ๆ ให้ดูง่ายขึ้น
- เพิ่มสถานะ calculation badge เพื่อให้ผู้ใช้เห็น workflow ของรายการกิจกรรมได้ชัดขึ้น

### 4. CSV Import And Large-File Workflow

พัฒนา workflow การนำเข้าข้อมูลกิจกรรมจาก CSV ให้พร้อมกับข้อมูลจริงมากขึ้น:

- ใช้ `CsvMappingWizard` เพื่อให้ผู้ใช้ map คอลัมน์จากไฟล์จริงเข้าสู่ target schema
- ปรับ target columns ให้รองรับรูปแบบไฟล์กิจกรรมที่ใช้จริง
- เพิ่ม chunked import โดยแบ่ง payload เป็นก้อนย่อยก่อนส่งเข้า backend
- ลดความเสี่ยง payload ใหญ่เกิน limit ของ server หรือ browser memory
- ปรับ error message ให้ระบุ row number กลับไปยังแถวจริงของไฟล์ต้นฉบับ
- รองรับการสร้างข้อมูลอ้างอิงบางส่วนอัตโนมัติระหว่าง import เช่น camp, land, header type, detail type, unit และ resource item

### 5. Activity Resources Management

พัฒนาหน้า `ActivityResourcesPage.tsx` สำหรับจัดการ master data ของปัจจัยการผลิต:

- แยกการจัดการ `resource_used_type`, `fertilizers`, `equipments`, และ `resourceOthers`
- รองรับ create, edit และ delete ของแต่ละ resource group
- เพิ่ม merged resource table เพื่อดูข้อมูลหลายประเภทในมุมรวม
- เพิ่ม filter ตาม `resource_used_type`
- เพิ่ม preference persistence ผ่าน `localStorage` เพื่อจำการตั้งค่าปุ่ม/ตัวกรองของผู้ใช้
- รองรับการกำหนดว่าในหน้านี้จะแสดงปุ่ม ปุ๋ย, น้ำมัน, รายการอื่น ๆ และประเภทปัจจัยใดบ้าง

### 6. Backend Activities Service And Data Normalization

ในฝั่ง backend มีการขยาย `activities.service.ts` เพื่อรองรับ workflow ที่ซับซ้อนขึ้น:

- เพิ่ม normalization helper สำหรับ number, text และ date เพื่อลดปัญหา raw input
- แยก payload handling สำหรับ header, detail, import file, resource item และ carbon preparation
- เพิ่ม logic สำหรับ calculation status map และการจัดการชื่อสถานะให้เป็นมาตรฐานเดียวกัน
- เพิ่ม workflow validation สำหรับการเปลี่ยนสถานะ calculation
- เพิ่มการ sync สถานะกับ `carbon_process_queue`
- เพิ่ม logic รองรับการสร้างข้อมูลอ้างอิงอัตโนมัติระหว่าง import
- รองรับ placeholder land สำหรับกรณีมี camp แต่ยังไม่มี land code

### 7. Carbon Preparation / Calculation Readiness

งานส่วน activities ไม่ได้จบแค่บันทึกข้อมูล แต่เชื่อมไปถึงการเตรียมข้อมูลก่อนคำนวณ:

- รองรับสถานะ `imported`, `preparing`, `ready`, `standardDone`, `cfpDone`, `error`
- เพิ่ม carbon preparation payload สำหรับ unit conversion, fertilizer prep, soil data และ note
- ช่วยให้ activity detail สามารถเข้าสู่ process queue เพื่อไปต่อใน carbon calculation pipeline ได้

### 8. Navigation And System Integration

มีการปรับ sidebar และ route structure ให้ workflow หลักของระบบเชื่อมกันมากขึ้น:

- เพิ่มเมนู `จัดการกิจกรรม`
- เพิ่มเมนู `รายการบันทึกกิจกรรม`
- เพิ่มเมนู `เตรียมข้อมูล Carbon`
- เพิ่มเมนู `ปุ๋ย / น้ำมัน`
- จัดกลุ่มเมนู Carbon Analytics, Carbon operations, ข้อมูลเกษตรกร และตั้งค่าระบบให้ชัดขึ้น

## Current Project Status

สถานะปัจจุบันของโปรเจกต์จากโค้ดและเอกสารใน repo:

- ระบบหลักเป็น monorepo แยก `frontend/`, `backend/`, `shared/`
- ฝั่ง dashboard และฝั่ง activities ถูกพัฒนาควบคู่กันและเริ่มเชื่อมต่อกันมากขึ้น
- activities module ตอนนี้ครอบคลุมทั้ง master data, import, CRUD, calculation status และ preparation workflow
- Swagger พร้อมใช้งานที่ `http://localhost:3000/api/docs`
- schema อ้างอิงปัจจุบันยังอยู่ที่ `backend/src/prisma/schema.prisma`

## Open Risks / Next Focus

ประเด็นที่ยังควรติดตามต่อ:

- บางตารางยังไม่มี database-generated primary key
- หลาย service ยังมีความเสี่ยงจากการใช้ `MAX(id) + 1`
- import flow ยังต้องทดสอบกับข้อมูลจริงหลายรูปแบบเพิ่มเติม
- activity calculation pipeline ยังควรยืนยัน source of truth ระหว่าง raw activity, prepared data และ analytics outputs
- dashboard data source บางส่วนยังควรสรุปให้ชัดว่าจะใช้ mock หรือ real API เป็นหลัก
- workflow ของ CO2e persistence และการเชื่อมผลคำนวณกลับมาสู่หน้า analytics ยังต้องยืนยันให้ครบ

## Useful Reference Docs

หากต้องการดูรายละเอียดเพิ่ม ให้เริ่มจากไฟล์ต่อไปนี้:

- `README.md`
- `GUIDE.md`
- `CONTEXT.md`
- `COMPONENT_PJ.md`
- `BUG_LOG.md`
- `DASHBOARD_WORK_SUMMARY.md`

## Short Summary

สรุปงานของ Kong ในโปรเจกต์นี้คือการพัฒนาทั้งฝั่ง Carbon Dashboard / Carbon Analytics และฝั่ง Activities Management ที่เชื่อมกับการคำนวณคาร์บอน โดยงานหลักครอบคลุมการออกแบบหน้าใช้งาน, การจัด navigation และ filter, การนำเข้าข้อมูลกิจกรรมจาก CSV, การจัดการ resource master data, การทำ CRUD และ workflow ของ activity log, รวมถึงการเตรียมข้อมูลและสถานะต่าง ๆ ให้พร้อมเข้าสู่กระบวนการคำนวณ Carbon Footprint และ Carbon Credit ต่อไป
