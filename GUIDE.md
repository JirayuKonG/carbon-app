# คู่มือการติดตั้งและรัน Carbon Footprint System

> อัปเดตล่าสุด: 2026-05-21 | Schema v1.3 | NestJS + Prisma + PostgreSQL + Vite + React

---

## สารบัญ

1. [สิ่งที่ต้องติดตั้งก่อน](#1-สิ่งที่ต้องติดตั้งก่อน)
2. [Clone และติดตั้ง dependencies](#2-clone-และติดตั้ง-dependencies)
3. [ตั้งค่า Database](#3-ตั้งค่า-database)
4. [ตั้งค่าไฟล์ .env](#4-ตั้งค่าไฟล์-env)
5. [Generate Prisma Client](#5-generate-prisma-client)
6. [รัน Development Server](#6-รัน-development-server)
7. [Build สำหรับ Production](#7-build-สำหรับ-production)
8. [ตาราง URL ที่ใช้งาน](#8-ตาราง-url-ที่ใช้งาน)
9. [สรุปคำสั่งทั้งหมด](#9-สรุปคำสั่งทั้งหมด)
10. [สถานะ Bug ปัจจุบัน](#10-สถานะ-bug-ปัจจุบัน)

---

## 1. สิ่งที่ต้องติดตั้งก่อน

| เครื่องมือ | เวอร์ชันขั้นต่ำ | ตรวจสอบด้วย |
|---|---|---|
| Node.js | 18 | `node -v` |
| npm | 9 | `npm -v` |
| PostgreSQL | 14 (ถ้า local) | `psql --version` |

> ถ้าใช้ **Aiven** (cloud PostgreSQL) ไม่ต้องติดตั้ง PostgreSQL ใน machine ตัวเอง

---

## 2. Clone และติดตั้ง dependencies

```bash
cd C:\ProjectNotMe\carbon-app

# ติดตั้ง dependency ทุก workspace (frontend, backend, shared) ครั้งเดียว
npm install --workspaces
```

โครงสร้าง workspace:
```
carbon-app/
├── frontend/    ← Vite + React + TypeScript
├── backend/     ← NestJS + Prisma
└── shared/      ← TypeScript types ร่วมกัน
```

---

## 3. ตั้งค่า Database

### ตัวเลือก A — ใช้ Aiven (Cloud PostgreSQL) แนะนำ

1. เข้า [https://console.aiven.io](https://console.aiven.io) → เปิด service PostgreSQL
2. คัดลอก **Service URI** จากหน้า Overview
3. URI จะมีรูปแบบ:
   ```
   postgres://avnadmin:PASSWORD@pg-xxxx.aivencloud.com:PORT/defaultdb?sslmode=require
   ```
4. Import schema เข้า Aiven:
   ```bash
   psql "postgres://avnadmin:PASSWORD@pg-xxxx.aivencloud.com:PORT/defaultdb?sslmode=require" \
     -f managementDataSystem_forCalculate_1.3_05192026_postgres.sql
   ```

### ตัวเลือก B — ใช้ PostgreSQL ใน machine (Local)

```bash
# สร้าง database
createdb managementDataSystem_forCalculate

# Import schema (ห้ามแก้ไขไฟล์ SQL นี้)
psql -d managementDataSystem_forCalculate \
  -f managementDataSystem_forCalculate_1.3_05192026_postgres.sql
```

---

## 4. ตั้งค่าไฟล์ .env

```bash
# ก็อปจาก template
copy backend\.env.example backend\.env
```

เปิดแก้ไข `backend/.env`:

```dotenv
# ─── Aiven (Cloud) ───────────────────────────────────────────────────────────
DATABASE_URL="postgresql://avnadmin:PASSWORD@pg-xxxx.aivencloud.com:PORT/defaultdb?sslmode=require&schema=public"

# ─── Local PostgreSQL ─────────────────────────────────────────────────────────
# DATABASE_URL="postgresql://postgres:password@localhost:5432/managementDataSystem_forCalculate?schema=public"

# NestJS
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d
```

> **สำคัญ:** ต้องต่อท้าย `&schema=public` (สำหรับ Aiven) หรือ `?schema=public` (สำหรับ local) เสมอ

---

## 5. Generate Prisma Client

ต้องรันทุกครั้งที่:
- ติดตั้งโปรเจกต์ใหม่
- มีการเปลี่ยน `backend/src/prisma/schema.prisma`
- backend build ล้มเหลวด้วย Prisma type errors

```bash
cd C:\ProjectNotMe\carbon-app\backend

..\node_modules\.bin\prisma generate --schema src/prisma/schema.prisma
```

ผลลัพธ์ที่ถูกต้อง:
```
✔ Generated Prisma Client to ..\node_modules\@prisma\client
```

---

## 6. รัน Development Server

### รันพร้อมกันทั้ง 2 (แนะนำ)

```bash
cd C:\ProjectNotMe\carbon-app
npm run dev
```

คำสั่งนี้รัน frontend และ backend พร้อมกันผ่าน `concurrently`

### รันแยก (เปิด 2 terminal)

**Terminal 1 — Backend (NestJS)**
```bash
cd C:\ProjectNotMe\carbon-app\backend
..\node_modules\.bin\nest start --watch
```
รอจนเห็น `Nest application successfully started`

**Terminal 2 — Frontend (Vite)**
```bash
cd C:\ProjectNotMe\carbon-app\frontend
..\node_modules\.bin\vite
```
รอจนเห็น `Local: http://localhost:5173/`

---

## 7. Build สำหรับ Production

### Frontend

```bash
cd C:\ProjectNotMe\carbon-app\frontend

# ตรวจ TypeScript อย่างเดียว (ไม่ build จริง)
..\node_modules\.bin\tsc --noEmit

# Build จริง → ได้ไฟล์ใน frontend/dist/
npm run build --workspace=frontend
```

### Backend

```bash
cd C:\ProjectNotMe\carbon-app\backend

# Build → ได้ไฟล์ใน backend/dist/
..\node_modules\.bin\nest build

# รัน production build
node dist/main
```

---

## 8. ตาราง URL ที่ใช้งาน

| URL | คืออะไร |
|---|---|
| `http://localhost:5173` | Frontend (Vite dev server) |
| `http://localhost:3000` | Backend API (NestJS) |
| `http://localhost:3000/api/docs` | Swagger UI — ทดสอบ API ทั้งหมด |
| `http://localhost:3000/api/geo/provinces` | ตัวอย่าง API endpoint |

---

## 9. สรุปคำสั่งทั้งหมด

| คำสั่ง | รันที่ไหน | ทำอะไร |
|---|---|---|
| `npm install --workspaces` | root | ติดตั้ง dependency ครั้งแรก |
| `npm run dev` | root | รัน frontend + backend พร้อมกัน |
| `npm run build --workspace=frontend` | root | build frontend เป็น production |
| `npm run build --workspace=backend` | root | build backend เป็น production |
| `prisma generate --schema src/prisma/schema.prisma` | backend/ | generate Prisma client |
| `prisma studio --schema src/prisma/schema.prisma` | backend/ | เปิด GUI ดูข้อมูลใน DB |
| `prisma db pull --schema src/prisma/schema.prisma` | backend/ | sync schema จาก DB จริง |
| `tsc --noEmit` | frontend/ | ตรวจ TypeScript error เฉยๆ |

> คำสั่ง `prisma` และ `nest` ต้องใช้ path `..\node_modules\.bin\` นำหน้าเสมอ (เพราะ binary อยู่ที่ root)

---

## 10. สถานะ Bug ปัจจุบัน

ดูรายละเอียดครบได้ที่ [BUG_LOG.md](BUG_LOG.md)

### แก้ไขแล้ว

| BUG | ปัญหา |
|---|---|
| BUG-001 | Static land routes ถูก shadow ด้วย `:id` — แก้แล้ว |
| BUG-004 | Frontend build ล้มเหลว (TypeScript errors) — **แก้แล้ว 2026-05-21** |
| BUG-008 | Weather navigation highlight sidebar 2 items — แก้แล้ว |
| BUG-010 | Geo page ไม่แสดง subdistrict table — แก้แล้ว |
| BUG-011 | Geo page ซ่อน API error — แก้แล้ว |

### ยังเปิดอยู่

| BUG | ผลกระทบ |
|---|---|
| BUG-002 | `POST /api/geo/provinces` อาจ fail เพราะ PK ไม่มี auto-increment |
| BUG-003 | Form values ส่งเป็น string แทน number ทำให้ Prisma insert ผิดประเภท |
| BUG-005 | Infrastructure delete URL/ID ผิดสำหรับบาง resource type |
| BUG-006 | ปุ่ม "บันทึก" ใน modal บางหน้ายังไม่ได้ต่อ mutation จริง |
| BUG-007 | CO2e calculation result ไม่ถูก persist ลง DB |
| BUG-009 | Backend authenticate PostgreSQL ไม่ได้ถ้า `.env` ยังใช้ค่าเดิมที่ผิด |

---

*สร้างโดย Claude Code · Carbon Footprint System v1.3*
