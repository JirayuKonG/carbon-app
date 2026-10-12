# เปิด Carbon App จากสำเนาบน SSD

อัปเดต: 2026-10-12

## ตำแหน่งและอักษรไดรฟ์

ต้นฉบับอยู่ที่ D:\Project_Tesis\carbon-app และสำเนา SSD ใช้ F:\Project_Tesis\carbon-app
เครื่องอื่นอาจเห็น SSD เป็นไดรฟ์อื่นได้ ไม่ต้องแก้โค้ดให้ยึด F ตายตัว
start.ps1 ใช้ $PSScriptRoot และ scripts/dev.cjs ใช้ __dirname เพื่อหาตำแหน่งโปรเจ็คจริง

## สำคัญ: SSD นี้เป็น exFAT

ตรวจไดรฟ์ F เมื่อ 2026-10-12 พบว่าเป็น exFAT บน Windows ระบบไฟล์นี้ไม่รองรับ junction/symbolic links ที่ npm workspaces ของโปรเจ็คใช้
จึงใช้ SSD นี้เก็บและขนย้าย source code ก่อน ไม่รับรองว่าติดตั้ง npm ci หรือรันโดยตรงบน SSD นี้ได้
เมื่อไปคอมอื่น ให้ก๊อปโฟลเดอร์ carbon-app ลงไดรฟ์ NTFS ของเครื่องนั้นก่อน เช่น C:\Projects\carbon-app แล้วติดตั้งและรันจากสำเนาบน NTFS
ไม่ต้องฟอร์แมต SSD เพื่อใช้วิธีนี้ และไม่มีการฟอร์แมตไดรฟ์ในงานก๊อป

## สิ่งที่อยู่ในสำเนา

ก๊อปโค้ด เอกสาร .git, package.json, package-lock.json, start.ps1, scripts และไฟล์ตั้งค่า รวมถึง .env ที่มีอยู่
ไม่ก๊อป node_modules ทุกระดับ, dist ทุกระดับ, .vite, .cache และไฟล์ *.log เพราะสร้างใหม่ได้
ต้นฉบับบน D ยังอยู่และไม่ได้แก้ junctions
.env มีรหัสผ่านและ secrets สำเนานี้จึงเป็นสำเนาส่วนตัว อย่าส่งทั้งโฟลเดอร์ให้ผู้อื่นโดยไม่ตรวจไฟล์เหล่านี้ก่อน

## ติดตั้งบนเครื่องปลายทาง

1. ก๊อป source จาก SSD ลงโฟลเดอร์บน NTFS ที่ไม่มี node_modules เก่า
2. ติดตั้ง Node.js และ npm ที่เข้ากันได้กับ dependencies ของโปรเจ็ค
   บันทึก environment ที่ทดสอบเมื่อ 2026-10-08: Node.js 20.10.0 และ npm 10.8.3 ไม่ใช่การระบุเวอร์ชันล่าสุดหรือเวอร์ชันที่ควรใช้ตลอดไป
3. เปิด PowerShell ในโฟลเดอร์ carbon-app ที่ก๊อปลง NTFS แล้ว ตัวอย่าง:

~~~powershell
cd C:\Projects\carbon-app
node --version
npm.cmd --version
npm.cmd ci
~~~

npm ci ติดตั้งตาม package-lock.json และสร้าง workspace links ตามตำแหน่งจริง ไม่ต้องเปลี่ยน D เป็น F ด้วยมือ
การติดตั้งอาจต้องใช้อินเทอร์เน็ต หากแพ็กเกจหรือ Prisma binaries ยังไม่อยู่ใน cache

4. ตรวจ backend/.env และ frontend/.env ถ้ามีไฟล์ที่ถูกต้องอยู่แล้วอย่าเขียนทับ
   หากไม่มี ให้ใช้ .env.example เป็นแม่แบบและกรอกค่าจริงด้วยตนเอง
5. สร้าง Prisma Client บนเครื่องปลายทาง (สร้างโค้ด client ไม่เปลี่ยน schema ฐานข้อมูล):

~~~powershell
npm.cmd run prisma:generate --workspace=backend
npm.cmd run build
npm.cmd run dev
~~~

หรือเปิดด้วย:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
~~~

ใช้ URL ที่แสดงใน terminal แยกเปิดได้ด้วย start.ps1 -Mode Backend หรือ -Mode Frontend
หากย้ายโฟลเดอร์ที่ติดตั้ง dependencies แล้ว ให้ใช้สำเนา source ที่ไม่มี node_modules และติดตั้งใหม่ในตำแหน่งใหม่

## ฐานข้อมูลและการเชื่อมต่อ

ฐานข้อมูล PostgreSQL ภายนอกไม่ได้อยู่ในสำเนาโฟลเดอร์โปรเจ็ค
- DATABASE_URL ที่ชี้เซิร์ฟเวอร์ภายนอก: ต้องมีอินเทอร์เน็ตและเข้าถึง host/port ได้ ใช้ credentials และ SSL settings ที่ถูกต้อง ไม่ต้องนำเข้าฐานข้อมูลเดิมซ้ำ
- DATABASE_URL ที่ชี้ localhost: หมายถึงเครื่องที่กำลังรัน backend จึงต้องเตรียม PostgreSQL และข้อมูลบนเครื่องใหม่ หรือเชื่อมต่อไปเซิร์ฟเวอร์เดิมที่เข้าถึงได้
- ชื่อ defaultdb ที่ตรวจพบก่อนหน้านี้ไม่ได้บอกตำแหน่งเซิร์ฟเวอร์ ให้ตรวจ host ใน .env ส่วนตัวโดยไม่เผยรหัสผ่าน
- หากเชื่อมฐานข้อมูลเดิม การเพิ่ม แก้ หรือลบข้อมูลในแอปจากอีกเครื่องจะกระทบข้อมูลฐานเดียวกันด้วย
- ตรวจ VITE_API_BASE_URL, API proxy และ ALLOWED_ORIGINS หากเปลี่ยนพอร์ตหรือเครื่อง backend ดู GUIDE.md
- VITE_CF_API_URL สำหรับหน้า benchmark เป็นบริการแยก ไม่ได้ติดมากับ carbon-app อัตโนมัติ
- การก๊อปโปรเจ็คไม่ต้องรัน migration, introspection, db push หรือ import SQL snapshot ทับฐานข้อมูลเดิม

## ตรวจหลังเปิดงาน

ตรวจว่า frontend เปิดได้, backend /api/docs เปิดได้ และหน้าที่ใช้ข้อมูลจริงอ่าน API ได้
หากพอร์ตซ้ำ ให้ปิดโปรเจ็คอื่นหรือปรับ backend/frontend/proxy/CORS ให้สอดคล้องกัน
ยังไม่ได้ทดสอบบนคอมเครื่องอื่น การตรวจสำเนาไฟล์ไม่ใช่การรับรองว่าทุกฟีเจอร์ทำงานบนเครื่องใหม่แล้ว
พาธ D ในบันทึกประวัติ README/CONTEXT ไม่ใช่ข้อบังคับว่าต้องรันจาก D
