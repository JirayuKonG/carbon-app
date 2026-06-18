# Phase 2A: Carbon Analytics Data Mapping

วันที่อัปเดต: 16 มิถุนายน 2569

เอกสารนี้สรุปการตรวจ field จริงของ database/queue และ mapping ระหว่างข้อมูลต้นทางกับ metric ที่ใช้ในหน้า Carbon Analytics, Carbon Footprint, Spatial, Report และ Premium T-VER เพื่อใช้เป็นฐานก่อนทำ Phase 2B/2C

## 1. เป้าหมาย Phase 2A

- ตรวจว่าข้อมูลจริงจาก queue/activity/land มี field เพียงพอสำหรับคำนวณและแสดงผล dashboard แค่ไหน
- ทำ mapping ระหว่าง database field กับ dashboard metric ให้ชัด
- แยกส่วนที่พร้อมใช้จริงแล้วออกจากส่วนที่ยังเป็น fallback/mock หรือยังต้องเติมสูตร
- ระบุ data guard ที่ควรทำก่อน Phase 2B เพื่อไม่ให้ dashboard แสดงค่า 0 หรือค่าจำลองแบบผู้ใช้เข้าใจผิด

## 2. Source Tables ที่เกี่ยวข้อง

| กลุ่มข้อมูล | ตาราง | Field สำคัญ | สถานะ |
| --- | --- | --- | --- |
| Queue คำนวณ Carbon | `carbon_process_queue` | `carbon_process_queue_id`, `log_act_detail_id`, `land_id`, `land_camp_id`, `carbon_process_queue_dateWork`, `carbon_process_queue_info`, `carbon_process_queue_resultValue`, `unit_id_resultValue`, `log_act_detail_calStatus_id` | พร้อมใช้เป็น source หลักของ emission หลังคำนวณ |
| Activity detail | `log_activities_detail` | `log_act_detail_id`, `activities_header_id`, `act_header_type_id`, `act_header_detail_type_id`, `act_fertilizer_id`, `act_chemiscal_id`, `act_resourceOther_id`, `unit_id`, `unit_prefix_id`, `log_act_detail_quatity`, `log_act_detail_volumePerUnit`, `log_act_detail_volumeAll`, `log_act_detail_areawork` | พร้อมใช้เป็น source ปริมาณกิจกรรมและพื้นที่ทำงาน |
| Activity header | `activities_header` | `activities_header_id`, `land_id`, `farmer_id`, `activities_header_startDate`, `act_header_type_id`, `act_header_typeLand_id`, `act_header_typeSugarCane_id` | พร้อมใช้สำหรับปี, แปลง, ประเภทกิจกรรม, ประเภทอ้อย |
| ประเภทกิจกรรม | `activities_header_type` | `act_header_type_id`, `act_header_type_name_th`, `act_header_type_name_en` | พร้อม map เป็น process |
| รายละเอียดกิจกรรม | `activities_header_detail_type` | `act_header_detail_type_id`, `act_header_detail_type_name_th` | พร้อม map เป็น activity |
| ประเภทอ้อย | `activities_header_typeSugarCane` | `act_header_typeSugarCane_id`, `act_header_typeSugarCane_name` | มี source แล้ว แต่ analytics endpoint ปัจจุบันยังไม่ส่ง cane type จริงครบทุกจุด |
| แปลง | `lands` | `land_id`, `land_code`, `name`, `land_camp_id`, `subdistrict_code`, `area_size`, `land_size`, `latitude`, `longitude`, `zip_code` | พร้อมใช้สำหรับ field/filter/area แต่ต้องเลือก area source ให้ชัด |
| แคมป์ | `lands_camps` | `land_camp_id`, `land_camp_name`, `land_camp_latitude`, `land_camp_longitude` | พร้อมใช้สำหรับ camp/filter |
| พื้นที่ | `subdistricts`, `districts`, `provinces`, `geographies` | `subdistricts_id`, `districts_id`, `provinces_id`, `geographies_id`, `name_th`, `latitude`, `longitude` | พร้อมใช้สำหรับ dropdown/filter/spatial |
| Resource references | `activities_fertilizers`, `activities_chemiscals`, `activities_resourceOther`, `activities_equipments`, `resource_used_type` | ชื่อ resource และชนิด resource | พร้อมใช้สำหรับ classify สูตรและ activity label |
| EF/GWP | `coefficients_emissions_factors`, `coefficients_emissions_factors_gwp` | EF total/gas split, unit, GWP | พร้อมใช้บางสูตร เช่น generic EF และ fertilizer N2O |

## 3. Mapping หลักจาก Database ไป Dashboard

| Dashboard metric | Source หลัก | Logic ปัจจุบัน | สถานะ |
| --- | --- | --- | --- |
| Current emission | `carbon_process_queue_resultValue` + `unit_id_resultValue` | ถ้าหน่วยผลลัพธ์เป็น kgCO2e แปลงเป็น tCO2e, ถ้าเป็น tCO2e ใช้ตรง | ใช้จริงแล้ว |
| Baseline average | ปีจาก `activities_header_startDate` | ปีล่าสุด = project year, ปีก่อนหน้าเฉลี่ยเป็น baseline | ใช้จริงแล้ว แต่ควรเพิ่ม setting เลือกปีฐานในอนาคต |
| Process emission | `activities_header_type`, `log_activities_detail`, queue result | group by year + process | ใช้จริงแล้ว |
| Activity breakdown | `activities_header_detail_type` + queue result | group by year + process + activity | ใช้จริงแล้ว แต่ถ้ารายการย่อยมีแค่ยอดรวม frontend ยังมี fallback |
| Camp summary | `lands_camps`, `lands`, queue result | group by camp, รวม emission/area/field count | ใช้จริงแล้ว |
| Field detail | `lands`, queue result | group by land, ดึง lat/lng จาก land หรือ fallback subdistrict/camp | ใช้จริงแล้ว |
| Spatial hierarchy | `geographies -> provinces -> districts -> subdistricts -> lands` | สร้าง node ตามพื้นที่และแปลง | ใช้จริงแล้ว |
| Area rai | `lands.area_size` ใน analytics, บางหน้าใช้ `land_size`/project fallback | ยังต้องมาตรฐานว่าใช้ `area_size` หรือ `land_size` | ต้องตัดสินใจ |
| Farmers count | `activities_header.farmer_id` หรือ `lands.farmer_id` | นับ unique farmer จาก current rows | ใช้จริงแล้ว |
| Fertilizer amount | `log_act_detail_volumeAll` หรือ prepared amount ใน `carbon_process_queue_info` | analytics ปัจจุบันรวมจาก `input_amount`; input usage summary normalize เป็น kg | ใช้ได้บางส่วน |
| Fuel amount | `log_act_detail_volumeAll` หรือ prepared amount | input usage summary normalize เป็น L | ใช้ได้บางส่วน |
| Calculation breakdown | `carbon_process_queue_info.calculation` | parse JSON จาก queue info แล้วส่ง `calculationBreakdowns` | ใช้จริงแล้วเฉพาะ queue ที่คำนวณใหม่ |
| Cane type analysis | `activities_header_typeSugarCane` | `getCfCaneTypes()` aggregate cane type จริงตาม current year, area, percent และ co2eTotal | ใช้จริงแล้วใน dashboard |
| SOC before/after/increase | ยังไม่มีตาราง SOC จริงโดยตรง | frontend ใช้สูตรประมาณจาก area/reduction/fallback | ยังไม่ใช่ข้อมูลจริง |
| Organic material usage | ยังไม่มี field แยกวัสดุอินทรีย์จริง | frontend ใช้ fallback share: ปุ๋ยอินทรีย์/ปุ๋ยหมัก, ฟิลเตอร์เค้ก, Vinasse, ใบอ้อยคลุมดิน | ยังไม่ใช่ข้อมูลจริง |
| Carbon credit | ใช้ reduction + SOC fallback | ยังไม่ผูกสูตร credit จริงครบ | ยังไม่ครบ |

## 4. Queue Info Contract ที่ใช้อยู่

`carbon_process_queue_info` เป็น JSON string ที่อาจมีทั้ง preparation info และ calculation info

ตัวอย่าง field ที่ระบบอ่าน/เขียนอยู่:

| Path | ความหมาย | ใช้ที่ไหน |
| --- | --- | --- |
| `preparedVolumeAll` | ปริมาณหลังเตรียมข้อมูล | queue calculation, frontend queue |
| `preparedUnitId` | หน่วยหลังเตรียมข้อมูล | queue calculation |
| `preparedUnitPrefixId` | prefix หน่วยหลังเตรียมข้อมูล | queue calculation |
| `sourceVolumeAll` | ปริมาณเดิมจาก activity | frontend queue |
| `sourceUnitId` | หน่วยเดิมจาก activity | frontend queue |
| `calculation.formulaMode` | mode สูตร เช่น `generic_ef`, `fertilizer_n2o` | analytics breakdown/report |
| `calculation.resultValue` | ผลลัพธ์ emission | analytics breakdown/report |
| `calculation.resultUnitId` | หน่วยผลลัพธ์ | analytics breakdown/report |
| `calculation.calculatedAt` | เวลาคำนวณ | audit/report |
| `calculation.efId` | EF ที่ใช้ | audit/report |
| `calculation.fertilizerKg` | ปริมาณปุ๋ย kg | fertilizer breakdown |
| `calculation.nAppliedKg`, `n2oKg`, `usePhaseKgco2e`, `upstreamKgco2e` | fertilizer N2O breakdown | Phase 2B พร้อมต่อ |

ข้อควรระวัง: queue เก่าที่คำนวณก่อนเพิ่ม `calculation` จะมี `resultValue` แต่ไม่มี breakdown จนกว่าจะคำนวณใหม่

## 5. API/Frontend Mapping ปัจจุบัน

| Endpoint | File | ใช้ข้อมูลจริงแล้ว | Gap |
| --- | --- | --- | --- |
| `/api/analytics/cf-kpi` | `backend/src/modules/analytics/analytics.service.ts` | current/baseline/area/farmer/field/process/fertilizer amount | yield ยังเป็น 0, cane type ยังไม่แยก |
| `/api/analytics/cf-process` | analytics service | process emission จาก queue | ต้องเพิ่ม data quality flag |
| `/api/analytics/cf-process-activities` | analytics service | process/activity breakdown จาก queue | fallback frontend ยังมีเมื่อข้อมูลย่อยไม่ครบ |
| `/api/analytics/cf-process-inputs` | analytics service | fertilizer/fuel input summary จาก activity rows | normalization ยังไม่ละเอียดเท่า input usage summary |
| `/api/analytics/cf-camps` | analytics service | camp summary, activity breakdown, calculationBreakdowns | ใช้ stable camp id สำหรับกลุ่มไร่บางกรณี ต้องระวัง match กับ lands จริง |
| `/api/analytics/cf-camp-fields` | analytics service | field detail, spatial, process input, breakdown | soil/irrigation/chanot ยังว่าง |
| `/api/analytics/cf-spatial` | analytics service | hierarchy ประเทศ/ภาค/จังหวัด/อำเภอ/ตำบล/แปลง | ต้อง sync กับ dropdown lands ที่เพื่อนทำล่าสุด |
| `/api/activities/input-usage-summary` | `backend/src/modules/activities/activities.service.ts` | fertilizer/fuel/resource usage summary จริง, `warningCount`, `warnings`, `sourcePreparedCount`, `fertilizerKind`, `areaRai`, `campName`, `landLabel`, `caneTypeName` | merge แล้ว และ frontend นำไปแสดงใน Overview, Carbon Footprint dashboard, Footprint Report และหน้า Input Usage; ยังไม่ใช้แทน CO2e หลัก |
| `/api/lands/bulk/subdistrict` | lands service ใน branch เพื่อน | bulk update subdistrict สำหรับแปลง | ยังไม่ได้ merge เข้า branch งานเรา |

## 6. Data Readiness

พร้อมใช้ต่อ Phase 2B:

- Emission result จริงจาก `carbon_process_queue_resultValue`
- Unit conversion ผลลัพธ์ kgCO2e -> tCO2e
- Process/activity grouping จาก `activities_header_type` และ `activities_header_detail_type`
- Camp/field/spatial grouping จาก `lands`, `lands_camps`, `subdistricts`, `districts`, `provinces`
- Calculation breakdown สำหรับ queue ที่คำนวณใหม่
- Fertilizer N2O breakdown บางส่วนจาก `calculation.fertilizer_n2o`

ยังต้องเติมก่อนใช้เป็น “คำนวณจริง 100%”:

- `getCfCaneTypes()` อ่าน `activities_header_typeSugarCane` จริงแล้ว แต่ควรเพิ่ม test ครอบ filter ระดับ region/camp/field ใน Phase 2E
- SOC removal ต้องมี source แยก baseline SOC, project SOC, practice/material input หรืออย่างน้อย mapping จาก resource/activity ที่ชัด
- Organic material usage ต้อง map จาก activity/resource จริง ไม่ใช้ share fallback
- Area source ต้องเลือกมาตรฐานเดียว เช่น `lands.land_size` สำหรับพื้นที่ปลูก หรือ `lands.area_size` สำหรับพื้นที่โฉนด
- Yield ยังไม่มี source ใน analytics; `yieldTon` ปัจจุบันเป็น 0
- Soil type/irrigation/chanot ยังไม่มี mapping จริงใน spatial detail

## 7. Data Quality Guard ที่ควรทำก่อน Phase 2B

| Guard | เงื่อนไข | ผลที่ควรส่งให้ frontend |
| --- | --- | --- |
| Missing calculation | queue มี `resultValue` แต่ไม่มี `carbon_process_queue_info.calculation` | `datasourceStatus: api_partial`, warning ให้คำนวณใหม่ถ้าต้องการ audit |
| Missing unit | queue/detail ไม่มี `unit_id` หรือ result ไม่มี `unit_id_resultValue` | warning + exclude จาก normalized input total |
| Missing EF | calculation error หรือไม่มี `efId` ใน breakdown | warning + แสดง row ใน audit table |
| Missing land/camp | activity ไม่มี `land_id` หรือ land ไม่มี `land_camp_id` | group เป็น `Unassigned`, ไม่ทิ้งข้อมูล |
| Missing area | `area_size`/`land_size` ว่าง | ห้ามคำนวณ per rai แบบเงียบ ๆ, ส่ง `null` หรือ warning |
| Missing year | `activities_header_startDate` ว่าง | exclude จาก baseline/current และส่ง count warning |
| Missing cane type | `act_header_typeSugarCane_id` ว่าง | group เป็น `ไม่ระบุประเภทอ้อย` |

## 8. Phase 2B/2C ที่ทำต่อได้ทันที

ลำดับแนะนำ:

1. เพิ่ม regression/smoke test ให้ `getCfCaneTypes()` และ endpoint dashboard หลักยังทำงานตาม filter
2. เพิ่ม `dataQuality` และ `datasourceStatus` ใน analytics response หลัก
3. รวม logic normalize fertilizer/fuel จาก `/activities/input-usage-summary` เข้ากับ analytics หรือ reuse helper เดียวกัน
4. เพิ่ม calculation breakdown summary ต่อ process/activity:
   - fertilizer: upstream, N applied, N2O, use phase
   - fuel/generic EF: amount, EF, gas split, result
5. ออกแบบ SOC source contract:
   - ถ้าใช้ activity/resource จริง ให้ map organic material จาก `activities_resourceOther`/`activities_fertilizers`
   - ถ้ามีตาราง SOC แยก ต้องระบุ field baseline/project/year/area/material
6. ทำ frontend badge datasource:
   - `API real calculation`
   - `API partial`
   - `fallback dataset`

## 9. สรุป Phase 2A

Phase 2A ยังทำต่อได้และไม่ชนงานเพื่อน โดยตอนนี้ข้อมูลพื้นที่/dropdown จากงานเพื่อนช่วยให้ mapping พื้นที่สมบูรณ์ขึ้น แต่ควร merge เฉพาะส่วน `lands` แบบ selective ก่อน ไม่ควร merge ทั้ง branch เพราะมีไฟล์ Carbon Dashboard หลายไฟล์ที่ชนกับงาน UI/PDF ล่าสุด

สำหรับงาน Carbon Analytics ฝั่งเรา ตอนนี้ data pipeline หลัก “queue -> analytics -> dashboard” ใช้ข้อมูลจริงได้แล้วในส่วน emission/process/spatial/camp/field ส่วนที่ยังไม่จริงคือ cane type summary, SOC removal, organic material contribution, yield และ data quality flag

## 10. อัปเดตหลัง merge งาน Phase 2B บางส่วน - 16 มิถุนายน 2569

งานจาก `block_dev` ที่เกี่ยวกับ `/api/activities/input-usage-summary` ถูก merge เข้า `idea` แล้ว และรอบนี้นำมาใช้ใน frontend เพิ่มเติมเฉพาะส่วนรายงานปริมาณทางกายภาพและ Data Quality เท่านั้น

ข้อมูลที่นำมาแสดงเพิ่ม:

- `fertilizerKg` และ `fuelLiter` สำหรับ Resource Consumption ในหน้า Overview, Carbon Footprint dashboard และ Footprint Report
- `areaRai`, `campName`, `landLabel`, `caneTypeName` เพื่อช่วยอธิบาย scope ของข้อมูลกิจกรรมและพื้นที่
- `warningCount` และ `warnings` เพื่อแสดง Data Quality guard ว่ามีหน่วย/ข้อมูลที่ normalize ไม่ได้หรือไม่
- `sourcePreparedCount` เพื่อบอกจำนวน record ที่ใช้ปริมาณหลัง prepare แล้ว เทียบกับจำนวน record ทั้งหมด
- `fertilizerKind` เพื่อแยกปุ๋ยเคมี/ปุ๋ยอินทรีย์ และใช้เป็นฐานข้อมูลประกอบ SOC/organic material summary ในอนาคต

ข้อจำกัดที่ยังตั้งใจคงไว้:

- ยังไม่ใช้ข้อมูลปริมาณจาก `/api/activities/input-usage-summary` แทนตัวเลข CO2e หลัก
- ตัวเลข CO2e หลักยังต้องอิง pipeline เดิมจาก queue/analytics จนกว่าจะนำปริมาณทางกายภาพชุดนี้เข้า `co2e-engine.service.ts`
- การ filter ตาม field จะพยายาม map จาก `field-{land_id}`; ถ้า map ไม่ได้จะใช้ระดับ camp เป็น fallback
- Phase 2E ควรทดสอบทั้ง endpoint analytics เดิมและ endpoint resource usage ใหม่ โดยเช็กว่า source badge/data quality ไม่ทำให้ผู้ใช้เข้าใจผิดว่าเป็น CO2e ที่คำนวณสมบูรณ์แล้ว

## 11. อัปเดต Dynamic SOC และ Cane Types API - 16 มิถุนายน 2569

เพิ่มงานต่อยอดจาก Phase 2D เพื่อให้ flow Carbon Footprint / Sequestration ใกล้ข้อมูลจริงขึ้น:

- หน้า Carbon Footprint แท็บ Sequestration เปลี่ยน `socIncrease` จากสูตรประมาณการณ์เดิมที่อิง `reduction * 0.35 + area * 0.012` มาอิง `organicFertilizerKg` จาก `resourceUsage.ts`
- ค่าการกักเก็บ SOC ใน dashboard ตอนนี้เปลี่ยนตามปริมาณปุ๋ยอินทรีย์จริงที่อยู่ใน `/activities/input-usage-summary`
- เพิ่ม `SOC_TCO2E_PER_ORGANIC_FERTILIZER_KG` เป็น coefficient proxy ฝั่ง frontend เพื่อแปลง kg ปุ๋ยอินทรีย์เป็น tCO2e SOC ชั่วคราว
- ข้อจำกัดสำคัญ: coefficient นี้ยังไม่ใช่สูตร CO2e engine อย่างเป็นทางการ และควรถูกย้าย/ยืนยันใน `co2e-engine.service.ts` ใน Phase 2B ถัดไป
- Backend `getCfCaneTypes()` ใน `analytics.service.ts` เริ่มส่ง cane type จริงจาก `activities_header_typeSugarCane` แล้ว โดย aggregate ตาม current year, area, percent และ co2eTotal
- Mapping ยังสอดคล้องกับ Phase 2A: `activities_header_typeSugarCane` เป็น source ของ cane type, `input-usage-summary.fertilizerKind=organic` เป็น source ของ organic material/SOC proxy, ส่วน CO2e หลักยังคงมาจาก queue/analytics เดิม
