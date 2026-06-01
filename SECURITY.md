# Security Policy / นโยบายความปลอดภัย

Last updated: 2026-06-01

This document explains how to report security issues for the Carbon Footprint Management & Traceability System and what contributors should keep in mind when handling sensitive data.

เอกสารนี้อธิบายวิธีรายงานช่องโหว่ด้านความปลอดภัยของระบบ Carbon Footprint Management & Traceability System รวมถึงแนวทางที่ผู้พัฒนาควรใช้เมื่อทำงานกับข้อมูลสำคัญหรือข้อมูลที่มีความอ่อนไหว

## Supported Scope / ขอบเขตที่ครอบคลุม

This policy applies to:

นโยบายนี้ครอบคลุมส่วนต่อไปนี้:

- `frontend/`
- `backend/`
- `shared/`
- project configuration and environment files
- Prisma schema and database access patterns

Third-party services such as PostgreSQL hosting, cloud infrastructure, or email systems are only in scope when the risk comes from this repository's configuration or code.

บริการภายนอก เช่น PostgreSQL hosting, cloud infrastructure, หรือระบบอีเมล จะถือว่าอยู่ในขอบเขตของเอกสารนี้เฉพาะกรณีที่ความเสี่ยงเกิดจากโค้ดหรือการตั้งค่าที่อยู่ใน repository นี้เท่านั้น

## Reporting A Vulnerability / การรายงานช่องโหว่

Please do not post full exploit details in a public issue.

ไม่ควรเปิดเผยรายละเอียดการโจมตีหรือวิธีใช้ช่องโหว่แบบครบถ้วนใน issue สาธารณะ

Instead:

ควรดำเนินการดังนี้:

1. Contact the project maintainer or repository owner through a private communication channel already used for this project.
2. Include a clear summary, affected area, reproduction steps, impact, and any suggested mitigation.
3. If you must open a repository issue first, keep it minimal and avoid secrets, payloads, credentials, tokens, or detailed exploit instructions.

1. ติดต่อผู้ดูแลโครงการหรือเจ้าของ repository ผ่านช่องทางส่วนตัวที่ทีมใช้อยู่แล้ว
2. ส่งข้อมูลสรุปปัญหาให้ชัดเจน เช่น ส่วนที่ได้รับผลกระทบ วิธีทำให้เกิดปัญหา ผลกระทบ และแนวทางลดความเสี่ยงเบื้องต้น
3. หากจำเป็นต้องเปิด issue ก่อน ให้เขียนเพียงข้อมูลระดับสูง และหลีกเลี่ยงการใส่ secret, payload, credential, token หรือขั้นตอนโจมตีแบบละเอียด

Useful report details:

ข้อมูลที่ควรมีในรายงาน:

- affected file, route, module, or feature
- environment where it was found
- steps to reproduce
- expected vs actual security behavior
- severity and possible impact
- whether credentials or personal data may be exposed

- ไฟล์, route, module หรือ feature ที่เกี่ยวข้อง
- environment ที่พบปัญหา
- ขั้นตอนที่ทำให้เกิดปัญหา
- พฤติกรรมที่ควรเป็น เทียบกับพฤติกรรมที่เกิดขึ้นจริง
- ระดับความรุนแรงและผลกระทบที่อาจเกิดขึ้น
- มีความเป็นไปได้หรือไม่ที่ credential หรือข้อมูลส่วนบุคคลจะรั่วไหล

## Response Expectations / แนวทางการตอบสนอง

The current project does not define a formal SLA, but the expected workflow is:

โครงการนี้ยังไม่มี SLA ด้านความปลอดภัยอย่างเป็นทางการ แต่แนวทางการทำงานที่ควรใช้คือ:

1. Acknowledge the report.
2. Validate whether the issue is reproducible.
3. Assess impact and decide whether the fix should be private first.
4. Patch the issue and verify the fix.
5. Document the outcome in `BUG_LOG.md` when it is safe to do so.

1. รับทราบรายงาน
2. ตรวจสอบว่าสามารถทำให้เกิดปัญหาซ้ำได้จริงหรือไม่
3. ประเมินผลกระทบ และตัดสินใจว่าควรแก้แบบ private ก่อนหรือไม่
4. แก้ไขปัญหาและตรวจสอบผลการแก้
5. บันทึกผลลัพธ์ลงใน `BUG_LOG.md` เมื่อตรวจสอบแล้วว่าปลอดภัยพอที่จะเปิดเผย

If public disclosure is needed, wait until a fix or mitigation is ready.

หากจำเป็นต้องเปิดเผยต่อสาธารณะ ควรรอจนกว่าจะมีวิธีแก้หรือแนวทางลดผลกระทบที่พร้อมใช้งาน

## Sensitive Data Handling / การจัดการข้อมูลอ่อนไหว

- Never commit real credentials, tokens, or connection strings.
- Treat `backend/.env` and any exported database credentials as sensitive.
- Do not paste production secrets into issues, screenshots, or Markdown files.
- Remove or rotate exposed secrets immediately if they were shared accidentally.
- Use sample or masked values in docs and examples.

- ห้าม commit credential, token หรือ connection string จริงลงใน repository
- ให้ถือว่า `backend/.env` และข้อมูลเชื่อมต่อฐานข้อมูลทุกชุดเป็นข้อมูลอ่อนไหว
- ห้ามนำ production secret ไปใส่ใน issue, screenshot หรือไฟล์ Markdown
- หากมีการเผยแพร่ secret โดยไม่ตั้งใจ ให้รีบลบและ rotate ทันที
- ในเอกสารและตัวอย่าง ควรใช้ค่าจำลองหรือค่าที่ปกปิดบางส่วนแล้ว

## Security Practices For Contributors / แนวปฏิบัติด้านความปลอดภัยสำหรับผู้พัฒนา

- Keep dependencies updated, especially NestJS, Prisma, Vite, React, and authentication packages.
- Validate and normalize user input before database writes.
- Prefer DTOs, parsing, and explicit type conversion over passing raw request bodies to Prisma.
- Review authorization and authentication behavior before exposing new endpoints.
- Avoid logging secrets, tokens, or personally sensitive records.
- Review CSV import and bulk-write flows carefully because they touch large amounts of data quickly.
- Confirm database schema defaults and primary-key behavior before changing create flows.

- อัปเดต dependency ที่สำคัญอย่างสม่ำเสมอ โดยเฉพาะ NestJS, Prisma, Vite, React และแพ็กเกจด้าน authentication
- ตรวจสอบและ normalize ข้อมูลจากผู้ใช้ก่อนเขียนลงฐานข้อมูล
- ควรใช้ DTO, parsing และการแปลง type แบบชัดเจน แทนการส่ง request body ดิบไปยัง Prisma โดยตรง
- ทบทวนเรื่อง authorization และ authentication ทุกครั้งก่อนเปิด endpoint ใหม่
- หลีกเลี่ยงการ log secret, token หรือข้อมูลที่มีความอ่อนไหวต่อบุคคล
- ตรวจสอบ flow การ import CSV และการเขียนข้อมูลแบบจำนวนมากอย่างรอบคอบ เพราะมีผลกับข้อมูลหลายรายการในครั้งเดียว
- ตรวจสอบ default ของ schema และพฤติกรรมของ primary key ให้แน่ชัดก่อนปรับ logic การ create ข้อมูล

## Common Areas To Review In This Repository / จุดที่ควรระวังเป็นพิเศษใน repository นี้

- `backend/.env` and environment variable handling
- authentication and JWT configuration
- Prisma queries and raw input handling
- CSV import flows in frontend and backend
- file uploads and parsing logic
- Swagger-exposed endpoints and public API behavior

- การจัดการ `backend/.env` และ environment variables
- การตั้งค่า authentication และ JWT
- Prisma query และการรับ raw input
- flow การ import CSV ทั้งฝั่ง frontend และ backend
- logic การอัปโหลดไฟล์และการ parse ข้อมูล
- endpoint ที่เปิดผ่าน Swagger และพฤติกรรมของ public API

## Verification Suggestions / แนวทางการตรวจสอบหลังแก้ไข

When fixing a security-related issue, verify as many of these as apply:

เมื่อมีการแก้ไขประเด็นด้านความปลอดภัย ควรตรวจสอบให้ครอบคลุมเท่าที่เกี่ยวข้อง:

- `npm run build --workspace=frontend`
- `npm run build --workspace=backend`
- `npm run prisma:generate --workspace=backend`
- affected endpoint or UI flow reproduction
- secret handling and log output review

- รัน build ของ frontend
- รัน build ของ backend
- ตรวจสอบ Prisma client generation
- ทดสอบ endpoint หรือ UI flow ที่ได้รับผลกระทบซ้ำอีกครั้ง
- ตรวจสอบว่าการจัดการ secret และ log output ยังปลอดภัย

## Current Project Notes / หมายเหตุเฉพาะของโครงการนี้

This repository already contains several areas that should be reviewed carefully from a security and reliability perspective:

สำหรับโครงการนี้ มีบางจุดที่ควรเฝ้าระวังเป็นพิเศษทั้งในด้านความปลอดภัยและความน่าเชื่อถือของระบบ:

- CSV imports can create or link large volumes of data, so malformed files or weak validation may affect many records at once.
- Some API areas have known input-normalization or schema-related risks tracked in `BUG_LOG.md`.
- Database credentials and environment configuration should be reviewed carefully before local sharing or deployment.

- การ import CSV สามารถสร้างหรือผูกข้อมูลจำนวนมากได้ในครั้งเดียว ดังนั้นหาก validation ไม่รัดกุมหรือไฟล์ผิดรูปแบบ อาจกระทบข้อมูลหลายแถวพร้อมกัน
- บางส่วนของ API ยังมีความเสี่ยงด้านการ normalize input หรือข้อจำกัดของ schema ซึ่งมีการติดตามไว้ใน `BUG_LOG.md`
- ข้อมูลเชื่อมต่อฐานข้อมูลและ environment configuration ควรถูกตรวจสอบอย่างรอบคอบก่อนแชร์ให้ผู้อื่นหรือก่อน deploy

## Future Improvements / แนวทางปรับปรุงในอนาคต

Good follow-up additions for this project would be:

สิ่งที่ควรเพิ่มในอนาคตเพื่อยกระดับความปลอดภัยของโครงการ:

- a dedicated private security contact
- environment-specific secret management guidance
- dependency and vulnerability scanning in CI
- a release checklist for security-sensitive changes

- ช่องทางติดต่อด้าน security แบบเฉพาะ
- คู่มือการจัดการ secret แยกตาม environment
- ระบบสแกน dependency และ vulnerability ใน CI
- release checklist สำหรับการเปลี่ยนแปลงที่มีผลต่อความปลอดภัย
