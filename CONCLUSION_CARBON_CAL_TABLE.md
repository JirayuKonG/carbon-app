# CONCLUSION_CARBON_CAL_TABLE

Last updated: 2026-06-15

หมายเหตุ: เอกสารนี้เป็น design note สำหรับ logic การคำนวณและโครงสร้างข้อมูล ไม่ใช่สเปก schema ปัจจุบันแบบหนึ่งต่อหนึ่งกับ `backend/src/prisma/schema.prisma`

เอกสารนี้สรุปจากไฟล์ต้นทาง 7 ไฟล์ที่นำเข้ามาเพื่อใช้เป็นฐานคิดสำหรับทำระบบคำนวณ Carbon Footprint และ Carbon Credit บนเว็บ หลังจากสรุปแล้วระบบไม่ควรผูกกับไฟล์ Excel/PowerPoint เหล่านี้โดยตรง แต่ควรถอดข้อมูลสำคัญออกมาเป็นสูตร, constant, input schema, result schema และฐานข้อมูลที่ตรวจสอบย้อนหลังได้

## 1. ไฟล์ที่นำมาสรุป

| กลุ่มไฟล์ | สิ่งที่ใช้จากไฟล์ |
|---|---|
| `2Jun26_การคำนวณ Fnfix_2.xlsx` | สูตรและตัวอย่างการคำนวณไนโตรเจนจากพืชตรึงไนโตรเจน เช่น ปอเทือง, ถั่วเขียว, ถั่วเหลือง, ถั่วลิสง |
| `2Jun26_คำนวณการปล่อยไนโตรเจนทางตรงและทางอ้อมตามสมการ_2.xlsx` | สูตรคำนวณ N2O จากปุ๋ยทางตรง/ทางอ้อม, baseline/project, RDC/RES, อ้อยปลูก/อ้อยตอ |
| `2Jun26_ตัวอย่างไฟล์จากไร่บริษัท การใช้ปุ๋ย_Premium_TVER2.xlsx` | รูปแบบ raw data รายแปลง/รายปี/ชนิดอ้อย/สูตรปุ๋ย และการสรุปเป็นกก./ไร่ |
| `2Jun26_ได้สูตรปุ๋ยจากไร่บริษัท MPIR มาสรุปปริมาณ_2.xlsx` | ตารางสรุปอัตราการใส่ปุ๋ยและปริมาณสัดส่วน N ต่อไร่ของ RDC/RES |
| `ts_c2919cb957.xlsx` | template คำนวณ Carbon Footprint ของปุ๋ยเคมีแบบ product/activity level โดยแยก `การได้มา` และ `การใช้ปุ๋ย` พร้อม EF ของแม่ปุ๋ยและตัวอย่างค่าผลลัพธ์ต่อ 1 kg ปุ๋ย |
| `สรุป สมการ SOC_2.pptx` | สมการ SOC ตาม T-VER-P-TOOL-01-12, การแปลง SOM เป็น SOC, การแปลง Ton C/rai เป็น Ton CO2e/rai |
| `สรุปการคำนวณปริมาณการปล่อยก๊าซไนตรัสออก_2.pptx` | flow Input -> Process -> Output สำหรับ N2O, constant ที่ควรเก็บในระบบ, สูตร FSN/FON/FNfix/Direct/Indirect |

## 2. ภาพรวมระบบที่ควรออกแบบ

ระบบควรแยกเป็น 4 ชั้นหลัก

1. ชั้นเตรียมข้อมูล: รับข้อมูลจาก activity log, import file, หรือกรอกฟอร์ม แล้ว normalize หน่วย, สูตรปุ๋ย, N, พื้นที่, ปีการผลิต, scenario
2. ชั้นสูตร: เก็บสูตรเป็น version พร้อม input schema, output schema, constants และ calculation function
3. ชั้นคำนวณ: คำนวณแบบราย record และแบบ group/batch โดย backend เป็นแหล่งผลลัพธ์จริง ส่วน frontend ใช้ preview ได้
4. ชั้นผลลัพธ์และ audit: เก็บ input snapshot, constant snapshot, formula version, result และ error เพื่อย้อนกลับมาตรวจสอบได้

แนวคิดสำคัญคือไม่ควรทำเว็บให้เหมือน Excel ทีละ cell แต่ควรแปลง Excel wide table ให้เป็น normalized records ก่อน เช่น 1 row = 1 แปลง + 1 ปี + 1 scenario + 1 สูตรปุ๋ย + 1 ปริมาณ

## 3. สูตรกลุ่มปุ๋ยและ N2O

### 3.1 Input ที่ต้องมี

| Field | ความหมาย | หมายเหตุ |
|---|---|---|
| `project_id` | โครงการหรือรอบคำนวณ | ใช้รวมผลทั้งโครงการ |
| `farm_zone` | พื้นที่/ไร่ เช่น RDC, RES | ใช้แยกสูตรหรือรายงาน |
| `plot_id` | รหัสแปลง | จำเป็นถ้าคำนวณรายแปลง |
| `crop_type` | อ้อยปลูก, อ้อยตอ, อื่น ๆ | ใช้ group/report |
| `production_year` | ปีการผลิต เช่น 2562/63 | ใช้ baseline/project |
| `scenario` | `baseline` หรือ `project` | baseline อาจมีหลายปีแล้วเอาค่าเฉลี่ย |
| `fertilizer_name` | ชื่อ/สูตรปุ๋ย เช่น `ปุ๋ย 16-8-8` | ใช้ parse ค่า N |
| `fertilizer_type` | `chemical`, `organic`, `unknown` | chemical ใช้ N จากสูตร, organic ต้องมีค่า N หรือ null |
| `amount_kg` | ปริมาณปุ๋ยรวม กก. | กรณีมาจาก raw รายแปลง |
| `area_rai` | พื้นที่ไร่ | ใช้แปลงเป็นกก./ไร่และรวม project |
| `amount_kg_per_rai` | ปริมาณปุ๋ยต่อไร่ | ถ้ามีมาแล้วให้เก็บไว้ด้วย |
| `n_percent` | เปอร์เซ็นต์ N | chemical parse จากสูตร, organic/manual อาจ null |
| `source_unit_id` | หน่วยต้นทาง | ใช้กับระบบเตรียมข้อมูล |
| `prepared_unit_id` | หน่วยหลังเตรียม | ควร normalize เป็น kg หรือ kg/rai |

### 3.2 การหา N จากสูตรปุ๋ย

สูตรปุ๋ยเคมีให้ใช้เลขตัวแรกเป็น `n_percent`

```text
ปุ๋ย 16-8-8 -> N = 16
ปุ๋ย 46-0-0 -> N = 46
ปุ๋ยน้ำ 25-0-0 -> N = 25
ปุ๋ย 0-0-60 -> N = 0
```

กรณีปุ๋ยอินทรีย์ เช่น `Fertilizer, Soilmate pellets, 50 kgs/bag` ยังไม่ควรเดาค่า N จากชื่อ ให้เก็บ `n_percent = null` ถ้าไม่มีค่าจากฐานข้อมูลหรือผู้ใช้กรอกเอง

กรณีปุ๋ยชนิดอื่นหรือชื่อไม่ชัด ให้ form ถามผู้ใช้ว่า “มีค่า N หรือไม่” ถ้ามีให้กรอก `n_percent` หรือเลือกจาก master data

### 3.3 Unit preparation สำหรับปุ๋ย

ระบบควรเตรียมปุ๋ยให้ได้อย่างน้อย 2 ค่า

```text
amount_kg = quantity * weight_per_unit_kg * unit_factor
amount_kg_per_rai = amount_kg / area_rai
```

ตัวอย่างที่เคยคุยไว้

```text
fertilizerKg = (quantity * weightPerUnitKg) * kgPerGram
kgPerGram = 1000 หรือค่าที่ผู้ใช้ตั้งตามหน่วย
```

หมายเหตุ: ชื่อ `kgPerGram` ในเชิงโปรแกรมอาจชวนสับสน ถ้าจะทำต่อแนะนำใช้ชื่อ `unitConversionFactorToKg` หรือ `sourceToKgFactor`

### 3.4 สูตร FSN/FON

ให้คำนวณจาก N เป็น “ตัน N”

```text
FSN = sum(chemical_amount_kg * n_percent / 100 / 1000)      tN
FON = sum(organic_amount_kg * n_percent / 100 / 1000)
```

ถ้าคำนวณแบบต่อไร่ ให้ใช้ `amount_kg_per_rai` แทน `amount_kg`

```text
FSN_per_rai = sum(chemical_amount_kg_per_rai * n_percent / 100 / 1000)
FON_per_rai = sum(organic_amount_kg_per_rai * n_percent / 100 / 1000)
```

ข้อควรระวัง: ในไฟล์ Excel บาง sheet ใช้ปริมาณรวมทั้งปีเป็น kg แล้วผลลัพธ์เป็น tonCO2e รวม บางส่วนสรุปเป็น kg/rai แล้วผลลัพธ์เป็นต่อไร่ ดังนั้นระบบควรเก็บทั้ง `total` และ `per_rai` และระบุ `calculation_scope` ให้ชัด

### 3.5 Constants สำหรับ N2O

| Key | Value | Unit | ควรเก็บที่ |
|---|---:|---|---|
| `EF_DIRECT` | 0.005 | tN2O/tN | formula constant version |
| `GWP_N2O` | 298 | tCO2e/tN2O | formula constant version |
| `MW_RATIO_N2O_N` | 44/28 | ratio | formula constant version |
| `FRAC_GASF` | 0.11 | ratio | formula constant version |
| `FRAC_GASM` | 0.21 | ratio | formula constant version |
| `FRAC_LEACH` | 0.24 | ratio | formula constant version |
| `EF_ATD` | 0.01 | tN2O/tN | formula constant version |
| `EF_LEACH` | 0.011 | tN2O/tN | formula constant version |

ค่าพวกนี้ไม่ควรให้ user ทั่วไปแก้จากหน้า form แต่ควรเก็บเป็น version เพราะถ้า IPCC/T-VER/อบก. เปลี่ยนค่า จะเปลี่ยนได้ที่เดียวและผลลัพธ์เก่ายังตรวจสอบได้

### 3.6 สูตร Direct/Indirect N2O

```text
N2O_Direct = (FSN + FON + FNfix) * EF_DIRECT * (44/28) * GWP_N2O     can use ////

N2O_ATD = ((FSN * FRAC_GASF) + (FON * FRAC_GASM)) * EF_ATD * (44/28) * GWP_N2O

N2O_Leaching = (FSN + FON) * FRAC_LEACH * EF_LEACH * (44/28) * GWP_N2O

N2O_Indirect = N2O_ATD + N2O_Leaching

N2O_Soil = N2O_Direct + N2O_Indirect
```

ถ้าคำนวณจาก total kg ผลลัพธ์จะเป็น `tCO2e` รวม ถ้าคำนวณจาก kg/rai ผลลัพธ์จะเป็น `tCO2e/rai`

### 3.7 Baseline/Project และการลดลง

ในไฟล์มี baseline หลายปี เช่น 2562/63 ถึง 2565/66 แล้วมี project ปี 2566/67

```text
baseline_average = average(baseline_year_results)
project_result = result(project_year)
reduction = baseline_average - project_result
reduction_percent = reduction / baseline_average * 100
```

ระบบควรเก็บ `scenario` และ `production_year` แยกกัน ไม่ควรเก็บเป็น column แบบ Excel เพราะอนาคตอาจมีปีเพิ่ม

### 3.8 สูตร Carbon Footprint ของปุ๋ยเคมีจาก `ts_c2919cb957.xlsx`

ไฟล์นี้ให้มุมมองอีกแบบหนึ่งจากชุดสูตร N2O เดิม โดยเน้นการคำนวณ `Carbon Footprint ของปุ๋ยเคมีต่อปริมาณปุ๋ยที่ใช้` แบบแยก 2 ส่วน:

1. `การได้มา (upstream / cradle-to-gate ของการผลิตปุ๋ย)`
2. `การใช้ปุ๋ย (use phase / N2O จากการใส่ปุ๋ย)`

จุดสำคัญคือไฟล์นี้เหมาะเป็น reference สำหรับทำ `product/activity emission calculator` ของปุ๋ยในโปรแกรม ไม่ใช่แทนที่สูตร field-scale N2O แบบละเอียดใน section 3.6 แต่ควรเก็บเป็นอีก formula mode หรืออีก calculation template ที่ชัดเจน

#### 3.8.1 สมมติฐานและ EF แม่ปุ๋ยจากไฟล์

| องค์ประกอบ | EF | หน่วย | ความหมาย |
|---|---:|---|---|
| ยูเรีย `as N` | `3.3036` | `kgCO2eq/kg nutrient` | ใช้คำนวณส่วน N ของการผลิตปุ๋ย |
| DAP `as P2O5` | `1.5716` | `kgCO2eq/kg nutrient` | ใช้คำนวณส่วน P ของการผลิตปุ๋ย |
| โพแทสเซียมคลอไรด์ `as K2O` | `0.4974` | `kgCO2eq/kg nutrient` | ใช้คำนวณส่วน K ของการผลิตปุ๋ย |
| Filler | `0` | `kgCO2eq/kg filler` | ไฟล์ตั้งสมมติฐานว่า filler ไม่มี EF |

ข้อสังเกตที่ควรเก็บในโปรแกรม:

- P ในสูตรปุ๋ยตีความเป็น `P2O5`
- K ในสูตรปุ๋ยตีความเป็น `K2O`
- สูตรนี้อิง `แม่ปุ๋ยหลักในประเทศไทย` ตามคำอธิบายในชีต `คำอธิบาย`
- ถ้าภายหลังเปลี่ยนฐานข้อมูล EF ของแม่ปุ๋ย ต้องทำเป็น version ใหม่ ไม่ควร overwrite ของเดิม

#### 3.8.2 สูตรการได้มา (การผลิตปุ๋ย)

ให้คำนวณจากสัดส่วน N-P2O5-K2O-Filler ในปุ๋ยผสม

```text
fertilizer_upstream_kgco2e =
  (n_fraction * EF_UREA_AS_N)
  + (p2o5_fraction * EF_DAP_AS_P2O5)
  + (k2o_fraction * EF_KCL_AS_K2O)
  + (filler_fraction * EF_FILLER)
```

ถ้ามีปริมาณปุ๋ยที่ใช้มากกว่า 1 kg:

```text
fertilizer_upstream_total_kgco2e = fertilizer_mass_kg * fertilizer_upstream_kgco2e_per_kg
```

ตัวอย่างจากไฟล์ `15-15-15`, ปริมาณ `1 kg`

```text
N = 0.15
P2O5 = 0.15
K2O = 0.15
Filler = 0.55

upstream = (0.15 * 3.3036) + (0.15 * 1.5716) + (0.15 * 0.4974) + (0.55 * 0)
         = 0.8059 kgCO2eq
```

#### 3.8.3 สูตรการใช้ปุ๋ย (use phase N2O)

ไฟล์นี้ใช้แนวคิดแบบง่ายว่า `N ที่ใส่ลงดิน 1% กลายเป็น N2O-N` แล้วแปลงเป็น `N2O` ด้วยอัตราส่วนโมเลกุล `44/28` จากนั้นคูณ `GWP`

```text
n_applied_kg = fertilizer_mass_kg * n_fraction
n2o_kg = n_applied_kg * 0.01 * (44 / 28)
use_phase_kgco2e = n2o_kg * 298
```

ถ้าระบบจะเก็บเป็น constant set:

| Key | Value | หมายเหตุ |
|---|---:|---|
| `EF_N_TO_N2O_N_SIMPLE` | `0.01` | เทียบเท่า 1% ของ N applied |
| `MW_RATIO_N2O_N` | `44/28` | แปลง N2O-N เป็น N2O |
| `GWP_N2O` | `298` | ตามค่าที่ใช้ในไฟล์ |

ตัวอย่างจากไฟล์ `15-15-15`, ปริมาณ `1 kg`

```text
n_applied_kg = 1 * 0.15 = 0.15 kg N
n2o_kg = 0.15 * 0.01 * (44/28) = 0.0024 kg N2O
use_phase_kgco2e = 0.0024 * 298 = 0.7024 kgCO2eq
```

#### 3.8.4 สูตรรวม Carbon Footprint ของปุ๋ย

```text
fertilizer_total_kgco2e =
  fertilizer_upstream_kgco2e
  + use_phase_kgco2e
```

ตัวอย่างจากไฟล์ `15-15-15`, ปริมาณ `1 kg`

```text
total = 0.8059 + 0.7024 = 1.5083 kgCO2eq
```

#### 3.8.5 ค่าตัวอย่างสูตรปุ๋ยที่ไฟล์ให้มา

| สูตรปุ๋ย | Total GHG | หน่วย |
|---|---:|---|
| `15-15-15` | `1.5083` | `kgCO2eq/kg fertilizer` |
| `16-20-0` | `1.5922` | `kgCO2eq/kg fertilizer` |
| `13-13-21` | `1.3470` | `kgCO2eq/kg fertilizer` |

ตัวเลขชุดนี้เหมาะใช้เป็น `reference check` หรือ `unit test golden values` ตอน implement โปรแกรม

#### 3.8.6 ข้อเสนอการนำไปใช้ในโปรแกรม

ถ้าจะเอาสูตรจากไฟล์นี้ไปใช้จริงในระบบ ควรแยกเป็น formula ใหม่ ไม่ปนกับสูตร N2O field/project แบบ detailed

เสนอชื่อ formula mode:

```text
fertilizer_cfp_simple
```

input ขั้นต่ำ:

| Field | ความหมาย |
|---|---|
| `fertilizer_formula_label` | เช่น `15-15-15` |
| `fertilizer_mass_kg` | ปริมาณปุ๋ยที่ใช้เป็น kg |
| `n_percent` | %N |
| `p2o5_percent` | %P2O5 |
| `k2o_percent` | %K2O |
| `filler_percent` | %Filler |
| `constant_set_version` | version ของ EF และ GWP |

output ที่ควรเก็บ:

| Field | ความหมาย |
|---|---|
| `upstream_kgco2e` | การได้มาของปุ๋ย |
| `use_phase_n2o_kg` | N2O จากการใช้ปุ๋ย |
| `use_phase_kgco2e` | GHG จากการใช้ปุ๋ย |
| `total_kgco2e` | ผลรวมทั้งหมด |
| `result_unit` | ควรเป็น `kgCO2e` |

#### 3.8.7 ข้อควรระวังเชิงวิธีวิทยา

สูตรในไฟล์นี้เป็น `simple template` ที่ดีสำหรับเริ่มทำ feature ในโปรแกรม แต่มีข้อจำกัดที่ต้องระบุไว้ชัด

1. มันใช้ค่า `EF = 1%` สำหรับการปล่อย N2O จาก N applied ซึ่งง่ายกว่า model detailed ใน section 3.6 ที่แยก Direct / ATD / Leaching
2. มันคิดการได้มาของปุ๋ยจากแม่ปุ๋ย 3 ตัวหลักและ filler = 0 ซึ่งเป็น assumption ไม่ใช่ค่าที่ใช้ได้ทุกประเทศหรือทุก supplier
3. มันเหมาะกับการคำนวณ `CF ของผลิตภัณฑ์ปุ๋ย/กิจกรรมใส่ปุ๋ย` มากกว่า `Carbon Credit baseline-project comparison`
4. ถ้าจะใช้ในโปรแกรมร่วมกับสูตร N2O detailed ต้องมี field บอก `calculation_method` ชัดเจน เช่น `simple_cfp_template` กับ `ipcc_tver_detailed`
5. สำหรับการพัฒนา phase ถัดไป ควรมีหน้าเปรียบเทียบผลของ `simple template` กับ `detailed field model` เพื่อไม่ให้ผู้ใช้สับสนว่าค่าทั้งสองชุดตั้งใจใช้คนละบริบท

## 4. สูตร Fnfix

Fnfix คือปริมาณไนโตรเจนจากพืชตรึงไนโตรเจน ใช้เสริมเข้า Direct N2O

### 4.1 Master data จากไฟล์

| พืช | น้ำหนักแห้ง kg/rai | N percent |
|---|---:|---:|
| ปอเทือง | 1296 | 1.98 |
| ถั่วเขียว | 514 | 1.85 |
| ถั่วเหลือง | 1038 | 2.71 |
| ถั่วลิสง | 273 | 1.74 |

### 4.2 สูตร

```text
dry_matter_ton_per_rai = dry_matter_kg_per_rai / 1000
n_fraction = n_percent / 100
fnfix_tN = area_rai * dry_matter_ton_per_rai * n_fraction
fnfix_tN_per_rai = dry_matter_ton_per_rai * n_fraction
```

ตัวอย่างจากไฟล์

```text
ปอเทือง 177 rai:
fnfix = 177 * 1.296 * 0.0198 = 4.54 tN
```

หน่วยมาตรฐานที่ระบบใช้ในหน้า Soil Organic Carbon:

| ค่า | หน่วยมาตรฐาน |
|---|---|
| `dry_matter_kg_per_rai` / `mc` | `kg/ไร่` |
| `n_percent` / `nc` | `%N` |
| `fnfix_tN` | `tN` |
| `fnfix_tN_per_rai` | `tN/ไร่` |

### 4.3 Input ที่ต้องมี

| Field | ความหมาย |
|---|---|
| `plot_id` หรือ `group_id` | แปลงหรือกลุ่มพื้นที่ |
| `farm_zone` | RDC/RES หรือพื้นที่อื่น |
| `production_year` | ปีการผลิต |
| `legume_crop_name` | ชนิดพืชตรึงไนโตรเจน |
| `area_rai` | พื้นที่ปลูก |
| `dry_matter_kg_per_rai` | ค่า default จาก master หรือ override |
| `n_percent` | ค่า default จาก master หรือ override |
| `fnfix_tN` | ผลลัพธ์รวม |
| `fnfix_tN_per_rai` | ผลลัพธ์ต่อไร่ |

## 5. สูตร SOC

SOC เป็นกลุ่มคำนวณ Carbon Credit/Carbon Removal ที่ควรเก็บตามรายแปลงหรือหน่วยตัวอย่าง เพราะค่ามาจากผล lab ของดินในช่วงเวลา

### 5.1 Input ที่ต้องมี

| Field | ความหมาย |
|---|---|
| `project_id` | โครงการ |
| `plot_id` หรือ `sample_unit_id` | หน่วยตัวอย่าง/แปลง |
| `sample_event_id` | รอบเก็บตัวอย่าง |
| `t_year` | ปีนับจากเริ่มโครงการ หรือปีเก็บตัวอย่าง |
| `lab_method` | เช่น Walkley and Black |
| `som_before_percent` | SOM ก่อน ถ้ามี |
| `som_after_percent` | SOM หลัง ถ้ามี |
| `soc_sample_percent` | SOC จาก lab หรือคำนวณจาก SOM |
| `bulk_density_g_cm3` | BD |
| `depth_cm` | ความลึกดิน เช่น 30 cm |
| `area_rai` | พื้นที่ที่ sample represent |
| `sample_count` | จำนวนแปลงตัวอย่างในหน่วยตัวอย่าง |

### 5.2 สูตรจากไฟล์

ถ้ามีค่า SOM ก่อน/หลัง

```text
delta_som_percent = som_after_percent - som_before_percent
delta_soc_percent = delta_som_percent / 1.724
```

คำนวณการกักเก็บคาร์บอน

```text
soc_tC_per_rai = soc_percent * bulk_density_g_cm3 * depth_cm * 0.16
soc_tCO2e_per_rai = (soc_tC_per_rai * (44/12)) / 20
soc_tCO2e_total = soc_tCO2e_per_rai * area_rai
```

หมายเหตุ: ถ้าต้องการใช้แนวคิดเฉลี่ยการกักเก็บ/เสื่อมสภาพตลอดช่วงเวลา 20 ปี ให้หาร `20` หลังแปลงจาก `Ton C/rai` เป็น `Ton CO2e/rai` เพื่อให้ผลลัพธ์อยู่ในรูป `tCO2e/rai/ปี` และ `tCO2e/ปี` ระดับทั้งแปลง

หน่วยมาตรฐานที่ระบบใช้ในหน้า Soil Organic Carbon:

| ค่า | หน่วยมาตรฐาน |
|---|---|
| `soc_sample_percent` | `%` |
| `bulk_density_g_cm3` | `g/cm3` |
| `depth_cm` | `cm` |
| `soc_tC_per_rai` | `Ton C/ไร่` |
| `soc_tCO2e_per_rai` | `tCO2e/ไร่/ปี` |
| `soc_tCO2e_total` | `tCO2e/ปี` |

ตัวอย่างจากไฟล์

```text
SOM ก่อน = 0.83%
SOM หลัง = 1.30%
delta SOM = 0.47%
delta SOC = 0.47 / 1.724 = 0.2726%
SOC stock = 0.2726 * 1.3 * 30 * 0.16 = 1.70 Ton C/rai
CO2e = 1.70 * 3.67 = 6.24 Ton CO2e/rai
```

### 5.3 วิธีเก็บ SOC ที่แนะนำ

SOC ไม่ควรเก็บปนกับ activity log ปกติ เพราะเป็นข้อมูล lab และเวลาของ sample ควรมี table แยก เช่น

```text
soil_sample_events
soil_sample_measurements
soc_calculation_results
```

เหตุผลคือ SOC ต้องย้อนดูได้ว่า sample มาจากรอบไหน, แปลงไหน, depth เท่าไร, lab method อะไร และใช้ค่า BD/SOC ใดตอนคำนวณ

## 6. Carbon Footprint vs Carbon Credit

### Carbon Footprint

เป็นการสรุป emissions เช่น

```text
total_emission = N2O_Soil + emissions_from_fuel + emissions_from_other_activities
```

ในไฟล์ชุดนี้เน้น N2O จากปุ๋ยและพืชตรึงไนโตรเจน ส่วน fuel/กิจกรรมอื่นให้ใช้ระบบ EF เดิมของเว็บต่อได้

### Carbon Credit

ควรแยกเป็นอย่างน้อย 2 แหล่งผลประโยชน์

```text
emission_reduction = baseline_emission - project_emission
carbon_removal = net_soc_increase_tCO2e
gross_credit_candidate = emission_reduction + carbon_removal
```

ก่อนใช้เป็น credit จริงควรมี field เผื่อ methodology เช่น leakage, buffer, uncertainty, permanence, verification status

## 7. ฐานข้อมูลที่แนะนำ

### 7.1 Master tables

| Table | หน้าที่ |
|---|---|
| `carbon_projects` | โครงการ/รอบคำนวณหลัก |
| `farm_zones` | RDC, RES หรือพื้นที่อื่น |
| `plots` | แปลง, รหัสแปลง, พื้นที่, zone |
| `crop_types` | อ้อยปลูก, อ้อยตอ, พักดิน, พืชตระกูลถั่ว |
| `production_years` | ปีการผลิต เช่น 2562/63 |
| `fertilizer_products` | ชื่อปุ๋ย, type, N/P/K, default unit |
| `units` | หน่วยและ conversion |
| `formula_constant_sets` | constant ตาม version/source |
| `carbon_formula_catalog` | สูตร, version, input schema, output schema |

### 7.2 Activity/input tables

| Table | หน้าที่ |
|---|---|
| `fertilizer_activity_records` | record ปุ๋ย normalized แล้ว |
| `nitrogen_fixation_records` | record พืชตรึงไนโตรเจน |
| `soil_sample_events` | รอบเก็บตัวอย่างดิน |
| `soil_sample_measurements` | ค่า lab ของ SOC/SOM/BD/depth |
| `activity_import_batches` | เก็บ metadata ของการ import/batch |

### 7.3 Calculation tables

| Table | หน้าที่ |
|---|---|
| `carbon_calculation_runs` | การคำนวณหนึ่งรอบ เช่น single/group/batch |
| `carbon_calculation_run_items` | รายการย่อยใน run |
| `carbon_calculation_results` | ผลลัพธ์ที่ query ได้ง่าย |
| `carbon_calculation_audit_logs` | input snapshot, formula snapshot, constant snapshot |

### 7.4 Data type ที่แนะนำ

| Field group | Type ที่แนะนำ |
|---|---|
| ปริมาณ/ผลลัพธ์ | `numeric(18,6)` หรือ `double precision` ถ้าระบบเดิมใช้ float |
| ค่า config/constant | `numeric(18,10)` พร้อม version |
| snapshot input/output | `jsonb` |
| formula schema | `jsonb` |
| status | enum/string เช่น `pending`, `validated`, `calculated`, `failed` |
| date/time | `timestamptz` |

หลักคือค่าที่ใช้ filter/report บ่อยควรเป็น column จริง เช่น `scenario`, `year`, `plot_id`, `n_percent`, `result_tco2e` ส่วนรายละเอียดเพื่อ audit ใช้ `jsonb`

## 8. โครงสร้าง formula registry

ควรทำ catalog ของสูตรแทน hardcode form แยกกระจัดกระจาย

```json
{
  "formulaCode": "N2O_FERTILIZER_IPCC_2019",
  "version": "1.0.0",
  "domain": "carbon_footprint",
  "scope": ["single_record", "group", "batch"],
  "inputSchema": {
    "fsn_tN": "number",
    "fon_tN": "number",
    "fnfix_tN": "number",
    "area_rai": "number"
  },
  "constantsSet": "IPCC_2019_TVER_CURRENT",
  "outputs": [
    "direct_tco2e",
    "atd_tco2e",
    "leaching_tco2e",
    "indirect_tco2e",
    "soil_tco2e"
  ]
}
```

Frontend ใช้ `inputSchema` เพื่อ render card/form และ preview calculation ได้ แต่ backend ต้องคำนวณซ้ำและเก็บผลจริง

## 9. Flow เว็บที่แนะนำ

### 9.1 Flow เตรียมข้อมูล

1. Import หรือเลือก activity records
2. Normalize unit เป็น kg หรือ kg/rai
3. Infer product type และ N จาก fertilizer name
4. Validate ค่า N/area/unit ที่ขาด
5. ให้ user แก้เฉพาะ record ที่มีปัญหา
6. ส่งเข้า calculation queue

### 9.2 Flow คำนวณราย record

1. เลือก formula card เช่น `N2O จากปุ๋ย`
2. กรอกหรือเลือก record
3. Preview input ที่ระบบเตรียมแล้ว เช่น N, kg, kg/rai, FSN/FON
4. กดคำนวณ
5. Backend สร้าง `calculation_run` และ `run_item`
6. แสดง result และ snapshot

### 9.3 Flow คำนวณแบบกลุ่ม

1. เลือก project/year/scenario/zone/crop type
2. ระบบดึง records ที่ผ่าน validation
3. Group ตาม key ที่เลือก เช่น zone + crop_type + year + scenario
4. Aggregate input เช่น total fertilizer kg, total area rai, total FSN/FON/FNfix
5. คำนวณ result กลุ่ม
6. แสดง table baseline average, project, reduction, percent reduction

### 9.4 Flow SOC

1. สร้าง sample event ตาม project/plot/sample unit
2. ใส่ค่า SOM/SOC/BD/depth/area
3. ระบบคำนวณ SOC stock และ CO2e
4. เปรียบเทียบ baseline vs monitoring year
5. ส่งผล SOC ไปหน้า Carbon Credit summary

## 10. หน้า card ที่ควรมี

| Card | ใช้ทำอะไร |
|---|---|
| `Prepare Fertilizer Data` | ตรวจหน่วย, N, product type ก่อนคำนวณ |
| `N2O Fertilizer` | คำนวณ Direct/Indirect จาก FSN/FON/FNfix |
| `Fnfix` | คำนวณไนโตรเจนจากพืชตรึง |
| `SOC` | คำนวณ carbon stock/removal จากดิน |
| `Baseline vs Project` | เปรียบเทียบ baseline average กับ project |
| `Carbon Credit Candidate` | รวม emission reduction + SOC removal |
| `Calculation Audit` | ดู input/output snapshot และสูตร version |

## 11. ข้อควรระวังจากไฟล์ต้นทาง

| ประเด็น | ความเสี่ยง | วิธีแก้ในระบบ |
|---|---|---|
| Excel เป็น wide table หลายปีหลายสูตร | ยากต่อ query และเพิ่มปีใหม่ | normalize เป็น row |
| มีทั้ง total kg และ kg/rai | ผลลัพธ์อาจสับสน total/per rai | เก็บ `calculation_scope` และทั้ง 2 ค่า |
| ปุ๋ยอินทรีย์ไม่มี N เสมอ | ถ้าเดาจะผิด | ให้ null หรือ user/master data ระบุ |
| ค่า GWP/EF อาจเปลี่ยนตามมาตรฐาน | ผลเก่า/ใหม่เทียบกันยาก | version constants |
| SOC เป็นข้อมูลราย sample | ถ้าเก็บรวมกับ activity จะ audit ยาก | แยก soil sample tables |
| สูตรบน frontend อย่างเดียวไม่พอ | เสี่ยงผลไม่ตรง/แก้ย้อนหลังไม่ได้ | backend เป็น authoritative calculator |

## 12. Roadmap ทำโปรแกรมต่อ

### Phase 1: Normalize และเตรียมข้อมูลปุ๋ย

สร้าง/ปรับ endpoint ให้รับข้อมูลจาก queue แล้วแปลงเป็น `fertilizer_activity_records` ที่มี `amount_kg`, `amount_kg_per_rai`, `n_percent`, `fertilizer_type`, `scenario`, `production_year`

### Phase 2: Formula constants และ calculation engine

สร้าง `formula_constant_sets` และ service เช่น `calculateN2OFertilizer(input, constants)` พร้อม unit test เทียบกับตัวอย่าง Excel

### Phase 3: Batch/group calculation

เพิ่ม `carbon_calculation_runs` และ `run_items` เพื่อรองรับหลาย record, retry, error message และ snapshot

### Phase 4: Fnfix module

เพิ่ม master ของพืชตรึงไนโตรเจนและ form/card สำหรับกรอกพื้นที่ปลูกต่อพืช แล้วส่งค่า `fnfix_tN` เข้า N2O calculation

### Phase 5: SOC module

เพิ่ม soil sample tables และหน้า card สำหรับ SOC โดยเริ่มจากสูตร SOM -> SOC -> Ton C/rai -> Ton CO2e/rai

### Phase 6: Carbon Credit summary

ทำหน้าเปรียบเทียบ baseline/project รวม N2O reduction และ SOC removal โดยแยกสถานะ `draft`, `verified`, `locked`

### Phase 7: Audit และ export

ทำหน้า audit สูตร/constant/result และ export report สำหรับตรวจสอบภายหลัง

## 13. ข้อสรุปเชิงออกแบบ

ระบบนี้ทำ dynamic formula บน frontend ได้ แต่ไม่ควรให้ frontend เป็นตัวจริงทั้งหมด รูปแบบที่ปลอดภัยคือ frontend dynamic form + preview, backend formula engine + versioned constants + result snapshots

การเก็บข้อมูลควรเน้น normalized records มากกว่า Excel shape เพราะโจทย์ต่อไปต้องคำนวณทั้งรายย่อยและแบบกลุ่ม ถ้าเก็บเป็น row ต่อ activity จะ group ได้อิสระ เช่น ตามแปลง, ปี, scenario, zone, crop type, fertilizer type, formula

สำหรับตอนนี้ยังไม่จำเป็นต้องแก้ database ทันทีจากเอกสารนี้ แต่แผนต่อไปที่ควรทำคือเริ่มจากปุ๋ย/N2O ก่อน เพราะเชื่อมกับ queue และ column `N` ที่มีอยู่แล้ว จากนั้นค่อยต่อ Fnfix และ SOC ซึ่งต้องใช้ตารางข้อมูลเฉพาะของตัวเอง

## 14. ตรวจสอบเพิ่มเติมจากระบบปัจจุบัน

หลังตรวจเทียบกับโค้ดปัจจุบัน หน้า Carbon Footprint ของระบบกำลังใช้ข้อมูลจาก `carbon_process_queue` และ relation ไปยัง `log_activities_detail` เป็นหลัก ดังนั้นเอกสารนี้ควรแยกให้ชัดว่า “ข้อมูลเตรียมคำนวณ” อยู่ตรงไหน และ “ผลคำนวณ” ควรเขียนกลับไปตรงไหน

### 14.1 ข้อมูล queue ที่มีอยู่ตอนนี้

| Field | ใช้ทำอะไรในระบบ Carbon Footprint | สถานะปัจจุบัน |
|---|---|---|
| `carbon_process_queue_id` | id ของรายการในคิว | ใช้เป็น key ของตาราง |
| `log_act_detail_id` | link กลับไป activity detail ต้นทาง | ใช้ดึงกิจกรรม, ปัจจัย, จำนวน, หน่วย, พื้นที่ |
| `log_act_detail_calStatus_id` | สถานะ workflow | ใช้แยกคิวเตรียมข้อมูลกับคิวพร้อมคำนวณ |
| `land_id`, `land_camp_id` | แปลง/แคมป์ | ใช้ group และ filter |
| `carbon_process_queue_dateWork` | วันที่ทำงาน | ใช้ filter/report ตามช่วงเวลา |
| `N` | ค่า nitrogen percent ของปุ๋ย | มีแล้ว เหมาะกับสูตรปุ๋ย/N2O |
| `carbon_process_queue_info` | snapshot การเตรียมข้อมูล | ปัจจุบันเป็น `String?` และเก็บ JSON แบบ string ยังไม่ใช่ `json/jsonb` จริง |
| `carbon_process_queue_resultValue` | ผลลัพธ์หลักหลังคำนวณ | มี field แล้ว แต่ workflow คำนวณเดิมยังไม่ได้บันทึกผลลง field นี้อย่างครบถ้วน |
| `unit_id_resultValue`, `unit_prefix_id_resultValue` | หน่วยของผลลัพธ์ | ควรใช้บอกว่า result เป็น kgCO2e, tCO2e หรือ tCO2e/rai |
| `carbon_process_queue_retry_count` | จำนวนครั้งที่ลองคำนวณ | ควร update ทุกครั้งที่คำนวณ fail/retry |
| `carbon_process_queue_error_message` | ข้อความปัญหาที่ user อ่านได้ | ควรเก็บ error เช่น missing EF, missing N, missing area |
| `carbon_process_queue_started_at`, `carbon_process_queue_ended_at`, `carbon_process_queue_updated_at` | audit เวลาคำนวณ | ควร update ตอนเริ่ม/จบ calculation |

### 14.2 สิ่งที่ระบบคำนวณเดิมทำอยู่

โค้ดคำนวณ generic ตอนนี้อยู่ใน `Co2eEngineService` โดยใช้แนวคิดนี้

```text
effectiveVolume = volumeAll ?? quantity * volumePerUnit

co2_contrib = effectiveVolume * EF_CO2 * GWP_CO2
ch4_contrib = effectiveVolume * EF_CH4 * GWP_CH4
n2o_contrib = effectiveVolume * EF_N2O * GWP_N2O

co2e_total = co2_contrib + ch4_contrib + n2o_contrib
```

ค่า GWP fallback ในโค้ดปัจจุบันเป็น

```text
CO2 = 1
CH4 = 28
N2O = 265
```

แต่สูตรปุ๋ย/N2O จากไฟล์สรุปใช้ `GWP_N2O = 298` ดังนั้นก่อนทำ production ต้องเลือกมาตรฐานให้ชัด เช่น IPCC version หรือ T-VER version แล้วเก็บเป็น constant set แบบมี version ไม่ควรปล่อยให้สูตรแต่ละส่วนใช้ค่าไม่ตรงกัน

### 14.3 Gap สำคัญก่อนให้หน้า Carbon Footprint คำนวณจริง

| Gap | ผลกระทบ | แนวทางแก้ |
|---|---|---|
| EF lookup ยังเลือก EF กว้างเกินไป | อาจหยิบ EF ตัวแรกที่ไม่ตรง resource/unit | filter จาก resource type, resource item, carbon footprint type, unit/prefix ให้ตรงก่อน |
| คำนวณแล้ว update แค่สถานะ activity detail เป็นหลัก | ตาราง Ready Queue ไม่เห็นผลลัพธ์จริง | เขียนผลกลับ `carbon_process_queue_resultValue`, result unit, started/ended/error |
| `carbon_process_queue_info` เป็น string JSON | query/filter รายละเอียดใน DB ยาก | ระยะสั้นใช้ต่อได้ ระยะกลางค่อยเปลี่ยนเป็น `jsonb` หรือแยก table snapshot |
| ยังไม่มี formula mode ต่อ row | ระบบไม่รู้ว่าต้องใช้สูตร EF, ปุ๋ย/N2O, SOC หรือสูตรอื่น | เพิ่มตัวแยก formula mode จาก resource type/item และ validation |
| ปุ๋ยอินทรีย์อาจไม่มีค่า N | คำนวณ FON ไม่ได้หรือผิด | ให้ `N = null` ได้ แต่ต้อง block สูตร N2O ถ้าไม่มี N และ user ต้องการคำนวณปุ๋ยอินทรีย์ |
| ผลลัพธ์มี field หลัก field เดียว | audit รายละเอียด CO2/CH4/N2O/direct/indirect ยาก | เก็บ breakdown ใน result snapshot หรือ table ใหม่ใน phase ถัดไป |

## 15. Data contract สำหรับหน้า Carbon Footprint

หน้า Carbon Footprint ควรมองข้อมูล 1 row ใน Ready Queue เป็น `Calculation Input Item` ไม่ใช่แค่ row สำหรับแสดงผล ตารางควรเตรียมข้อมูลให้ครบก่อนกดคำนวณ

### 15.1 Input ที่ต้องใช้ต่อ 1 queue row

| กลุ่มข้อมูล | Field | ใช้ทำอะไร |
|---|---|---|
| Identity | `carbon_process_queue_id`, `log_act_detail_id` | อ้างอิงรายการและ update ผลกลับ |
| Activity | `resource_used_type_id`, resource item id/name | เลือก formula mode และ EF |
| Quantity | `quantity`, `volumePerUnit`, `volumeAll` | fallback เมื่อยังไม่มี prepared amount |
| Unit | source unit/prefix, prepared unit/prefix | ตรวจว่า amount ตรงกับ EF unit หรือยัง |
| Prepared amount | `preparedVolumeAll`, `preparedVolumePerUnit`, `conversionFactor` | input หลักหลังเตรียมข้อมูล |
| Fertilizer | `N`, fertilizer type/name | ใช้คำนวณ FSN/FON และ N2O |
| Area | `log_act_detail_areawork`, `land_id`, `land_camp_id` | ใช้ kg/rai, group, baseline/project |
| Date/status | `dateWork`, calculation status | ใช้ filter และควบคุม workflow |

### 15.2 Snapshot การเตรียมข้อมูลที่ควรอยู่ใน `carbon_process_queue_info`

ระยะสั้นสามารถเก็บ JSON string ต่อได้ แต่ควรให้ schema คงที่เพื่อให้ backend/frontend อ่านตรงกัน

```json
{
  "sourceUnitId": 1,
  "sourceUnitPrefixId": null,
  "sourceVolumePerUnit": 50,
  "sourceVolumeAll": 500,
  "preparedUnitId": 1,
  "preparedUnitPrefixId": null,
  "preparedVolumePerUnit": 50,
  "preparedVolumeAll": 500,
  "conversionFactor": 1,
  "fertilizerBagWeightKg": 50,
  "soilN": 16,
  "note": "prepared from carbon queue",
  "preparedAt": "2026-06-10T00:00:00.000Z"
}
```

ถ้าจะเปลี่ยนฐานข้อมูลในอนาคต แนะนำเปลี่ยน `carbon_process_queue_info` จาก `String` เป็น `jsonb` หรือแยกเป็น table เช่น `carbon_process_queue_preparation_snapshots` เพื่อ query ได้ง่ายขึ้น แต่ยังไม่จำเป็นต้องทำทันทีถ้าเป้าหมายตอนนี้คือทำให้หน้า Carbon Footprint คำนวณออกมาก่อน

### 15.3 Output ที่ควรเขียนกลับหลังคำนวณ

| Field | ค่าที่ควรเก็บ | หมายเหตุ |
|---|---|---|
| `carbon_process_queue_resultValue` | ผลลัพธ์หลัก เช่น `tCO2e` | ควรตกลงหน่วยกลางให้ชัด แนะนำ `tCO2e` |
| `unit_id_resultValue` | id ของหน่วยผลลัพธ์ | เช่น unit ของ `tCO2e` |
| `unit_prefix_id_resultValue` | prefix ของหน่วยผลลัพธ์ | ถ้าไม่มีให้ null |
| `carbon_process_queue_retry_count` | จำนวน retry | เพิ่มเมื่อ fail หรือ retry |
| `carbon_process_queue_error_message` | ข้อความ error ที่อ่านรู้เรื่อง | เช่น `ไม่พบ EF สำหรับน้ำมันหน่วย L` |
| `carbon_process_queue_started_at` | เวลาเริ่มคำนวณ | set ก่อนเรียก engine |
| `carbon_process_queue_ended_at` | เวลาจบคำนวณ | set ทั้ง success/fail |
| `carbon_process_queue_updated_at` | เวลาล่าสุด | update ทุกครั้ง |

รายละเอียด breakdown ที่ควรเก็บในอนาคต

```json
{
  "formulaCode": "FUEL_EF_GAS_SPLIT",
  "formulaVersion": "1.0.0",
  "input": {
    "amount": 120,
    "unit": "L",
    "resource": "diesel"
  },
  "ef": {
    "id": 10,
    "co2": 2.68,
    "ch4": 0,
    "n2o": 0,
    "unit": "kgCO2e/L"
  },
  "gwp": {
    "co2": 1,
    "ch4": 28,
    "n2o": 265
  },
  "result": {
    "co2": 321.6,
    "ch4": 0,
    "n2o": 0,
    "totalKgCO2e": 321.6,
    "totalTCO2e": 0.3216
  }
}
```

## 16. รายละเอียดสูตรสำหรับหน้า Carbon Footprint

Carbon Footprint ควรคำนวณจาก Ready Queue ได้ 2 ระดับ

1. ราย row: คำนวณแต่ละ activity detail แล้วเก็บผลกลับ queue
2. แบบกลุ่ม: รวมหลาย row ตาม project/year/scenario/land/camp แล้วคำนวณหรือรวมผล

สูตรหลักแบ่งเป็น 3 กลุ่มก่อน คือ `generic EF`, `fertilizer N2O`, และ `SOC/future removal`

### 16.1 สูตร generic EF สำหรับน้ำมัน/เครื่องจักร/สารเคมี/อื่น ๆ

ใช้กับกิจกรรมที่มี EF อยู่ในตาราง `coefficients_emissions_factors` เช่น น้ำมันดีเซล, น้ำมันเบนซิน, ไฟฟ้า, สารเคมี หรือปัจจัยอื่น ๆ

```text
activity_amount = preparedVolumeAll
               ?? log_act_detail_volumeAll
               ?? log_act_detail_quatity * log_act_detail_volumePerUnit
```

กรณี EF แยกตาม gas

```text
CO2 = activity_amount * EF_CO2
CH4 = activity_amount * EF_CH4
N2O = activity_amount * EF_N2O

CO2e = (CO2 * GWP_CO2) + (CH4 * GWP_CH4) + (N2O * GWP_N2O)
```

กรณี EF เป็นค่า total CO2e อยู่แล้ว

```text
CO2e = activity_amount * EF_total
```

ข้อสำคัญคือห้ามคูณ GWP ซ้ำถ้า `EF_total` เป็น CO2e แล้ว และต้องตรวจหน่วย input ของ EF ให้ตรงกับหน่วยหลังเตรียมข้อมูล เช่น EF ต่อ L ต้องใช้ amount เป็น L, EF ต่อ kg ต้องใช้ amount เป็น kg

ตัวอย่างน้ำมัน

```text
quantity = 10
volumePerUnit = 20 L/ครั้ง
preparedVolumeAll = 200 L
EF_total = 2.70 kgCO2e/L

result = 200 * 2.70 = 540 kgCO2e = 0.540 tCO2e
```

### 16.2 สูตรปุ๋ยสำหรับ Carbon Footprint

ปุ๋ยไม่ควรมองเป็น generic EF อย่างเดียว เพราะไฟล์สรุปใช้สูตร N2O จาก nitrogen input โดยเฉพาะ

ขั้นเตรียมข้อมูล

```text
fertilizer_kg = preparedVolumeAll
n_percent = N
n_fraction = n_percent / 100
fertilizer_n_tN = fertilizer_kg * n_fraction / 1000
```

เงื่อนไขสำคัญคือ `preparedVolumeAll` ของสูตรนี้ต้องเป็น kg แล้วเท่านั้น ถ้าหน่วยหลังเตรียมเป็น g, ton, bag หรือหน่วยอื่น ต้องแปลงเป็น kg ก่อนคำนวณ N

แยกตามประเภทปุ๋ย

```text
ถ้า fertilizer_type = chemical:
  FSN = fertilizer_n_tN
  FON = 0

ถ้า fertilizer_type = organic:
  FSN = 0
  FON = fertilizer_n_tN

ถ้า fertilizer_type = unknown:
  ต้องให้ user ยืนยัน type และ N ก่อน
```

สูตร N2O ราย row

```text
N2O_Direct = (FSN + FON + FNfix) * EF_DIRECT * (44/28) * GWP_N2O

N2O_ATD = ((FSN * FRAC_GASF) + (FON * FRAC_GASM)) * EF_ATD * (44/28) * GWP_N2O

N2O_Leaching = (FSN + FON) * FRAC_LEACH * EF_LEACH * (44/28) * GWP_N2O

N2O_Soil = N2O_Direct + N2O_ATD + N2O_Leaching
```

สำหรับ row ปุ๋ยทั่วไปให้ตั้ง `FNfix = 0` ก่อน เพราะ Fnfix มาจากกิจกรรมพืชตรึงไนโตรเจน ไม่ใช่จาก row ปุ๋ยโดยตรง แต่ในการคำนวณแบบ group สามารถรวม `FNfix_tN` จาก module Fnfix เข้ามาในกลุ่มเดียวกันได้

ตัวอย่างปุ๋ยเคมี

```text
fertilizer_name = ปุ๋ยสูตร 16-8-8
fertilizer_kg = 500
N = 16

FSN = 500 * 16/100 / 1000 = 0.08 tN
FON = 0
FNfix = 0

N2O_Direct = (0.08 + 0 + 0) * 0.005 * (44/28) * 298
```

ถ้าเป็นปุ๋ยอินทรีย์และ `N = null` ให้ระบบแสดงว่า “ยังคำนวณ N2O ไม่ได้ เพราะไม่มีค่า N” ไม่ควรเดาจากชื่อ เช่น `Fertilizer, Soilmate pellets, 50 kgs/bag`

### 16.3 การคำนวณแบบต่อไร่และแบบรวม

ควรรองรับทั้งผลรวมและผลต่อไร่ เพราะไฟล์ต้นทางมีทั้ง 2 แบบ

```text
fertilizer_kg_per_rai = fertilizer_kg / area_rai
result_tCO2e_per_rai = result_tCO2e / area_rai
```

ถ้า row ไม่มี `area_rai` ให้คำนวณผลรวมได้ แต่ห้ามแสดงผลต่อไร่ และต้องขึ้น warning ใน frontend

### 16.4 SOC ยังไม่ควรปนกับ Ready Queue ปกติ

SOC เป็น carbon stock/removal ไม่ใช่ emission activity ธรรมดา จึงควรแยก flow และ table เฉพาะในอนาคต หน้า Carbon Footprint สามารถแสดง SOC summary ได้ แต่ไม่ควรเอา sample lab มาเก็บรวมกับ `log_activities_detail` โดยตรง เพราะต้อง audit ตาม sample event, depth, BD, lab method และวันที่เก็บตัวอย่าง





## 17. Plan ปรับปรุงหน้า Carbon Footprint ให้คำนวณได้จริง

แผนนี้ออกแบบให้ทำแบบ incremental คือทำให้คำนวณราย row ได้ก่อน แล้วค่อยต่อ batch/group และ audit เต็มรูปแบบ

### สถานะล่าสุดหลัง implement รอบแรก

สถานะนี้อ้างอิงจากงานที่ทำกับหน้า `คำนวณ Carbon -> Carbon Footprint` แล้วในรอบล่าสุด โดยยังไม่เปลี่ยน database schema และยังใช้ field เดิมของ `carbon_process_queue`

| Phase | สถานะ | ทำแล้ว | ยังเหลือ |
|---|---|---|---|
| Phase A: formula mode | ทำแล้วบางส่วน | backend resolve `generic_ef`, `fertilizer_n2o` และเตรียม mode `fnfix_group`, `soc_removal` ไว้ | `fnfix_group` และ `soc_removal` ยังไม่คำนวณจริง |
| Phase B: backend endpoint | ทำแล้ว | เพิ่ม `POST /activities/carbon-process-queue/:id/calculate` และ `POST /activities/carbon-process-queue/calculate/bulk` | bulk endpoint ยังตอบผลหลังจบทั้งหมด ไม่ได้ stream progress |
| Phase C: EF lookup | ทำแล้วบางส่วน | ไม่ return 0 เงียบ ๆ แล้ว และ match จาก unit + prefix + score ชื่อ resource/กลุ่ม EF | ยังไม่มี master mapping ที่ชัดเจนระหว่าง resource item กับ EF |
| Phase D: frontend table/action | ทำแล้วบางส่วน | เพิ่ม column สูตรที่จะใช้, สถานะ input, ปริมาณที่ใช้คำนวณ, หน่วยผลลัพธ์, error และปุ่มคำนวณ row/selected/all ready | ปุ่ม `คำนวณรายการที่เลือก` ยังไม่เปิด modal progress แบบหน้าเตรียมข้อมูล |
| Phase D.5: visible workflow | ยังไม่ได้ implement | มีแผนในเอกสารแล้ว | ต้องทำ modal สรุปก่อนคำนวณ, progress ทีละ row, summary success/error |
| Phase E: group calculation | ยังไม่ได้ทำ | ยังไม่มี | ต้องรวมผลหลาย row ตาม project/year/scenario/land/camp |
| Phase F: audit/result tables | ยังไม่ได้ทำ | ยังใช้ field เดิมใน queue | ยังไม่มี audit table หรือ result breakdown ถาวร |
| Phase G: tests | ทำ build check แล้ว | backend/frontend build ผ่าน | ยังไม่มี automated test case เฉพาะสูตร/queue calculation |

### Phase A: กำหนด formula mode ต่อ queue row

เพิ่ม logic ฝั่ง backend เพื่อ resolve ว่าแต่ละ row ต้องใช้สูตรอะไร

| Formula mode | ใช้กับ | เงื่อนไขขั้นต่ำ |
|---|---|---|
| `generic_ef` | น้ำมัน, เครื่องจักร, สารเคมี, อื่น ๆ | มี amount หลังเตรียมข้อมูล, มี unit, หา EF ได้ |
| `fertilizer_n2o` | ปุ๋ยเคมี/อินทรีย์ | มี fertilizer kg, มี type, มี N ยกเว้น organic ที่ยังรอข้อมูล |
| `fnfix_group` | พืชตรึงไนโตรเจน | มี crop name, area, dry matter, N percent |
| `soc_removal` | SOC/soil sample | มี sample event, SOC/SOM, BD, depth, area |

ระยะสั้น หน้า Carbon Footprint ควรเริ่มจาก `generic_ef` และ `fertilizer_n2o` ก่อน เพราะเชื่อมกับ queue ปัจจุบันได้ทันที

### Phase B: ปรับ backend calculation endpoint

ควรเพิ่ม endpoint ที่คำนวณจาก queue โดยตรง เช่น

```text
POST /activities/carbon-process-queue/:id/calculate
POST /activities/carbon-process-queue/calculate/bulk
```

เหตุผลคือ endpoint เดิม `/activities/details/:id/calculate` คำนวณจาก activity detail และ update status เป็นหลัก แต่หน้า Carbon Footprint ต้อง update result/error/timestamps กลับไปที่ `carbon_process_queue` ด้วย

ขั้นตอนใน service

1. Load queue row พร้อม relation activity detail, resource, unit, land
2. Parse `carbon_process_queue_info`
3. Resolve `formulaMode`
4. Validate input ตาม formula mode
5. Set `started_at`, clear old error
6. Calculate ด้วย formula engine
7. Save `resultValue`, result unit, status, `ended_at`
8. ถ้า error ให้เพิ่ม retry count, save error message, set status error

### Phase C: แก้ EF lookup ให้ปลอดภัย

ก่อนคำนวณน้ำมันและ activity ทั่วไป ต้องแก้การหา EF จาก “เจอตัวแรก” เป็น “เจอตัวที่ตรง”

ลำดับ match ที่แนะนำ

1. `carbonfootprint_type_id` ตรงกับ mode ที่ต้องการ
2. resource item ตรง เช่น fertilizer/equipment/chemical/other ถ้ามี mapping
3. `resource_used_type_id` หรือ group EF ตรง
4. input `unit_id` และ `unit_prefix_id` ตรงกับหน่วยหลังเตรียม
5. ถ้ามีหลายตัว ให้เลือก active/latest/reference ที่ชัดเจน
6. ถ้าไม่เจอ ให้ error ไม่ควร return 0 เงียบ ๆ

### Phase D: ปรับหน้า Carbon Footprint

สิ่งที่ควรเพิ่มในตาราง Ready Queue

| Column | เหตุผล |
|---|---|
| สูตรที่จะใช้ | ให้ user เห็นว่า row นี้จะคำนวณด้วย `generic EF` หรือ `fertilizer N2O` |
| สถานะ input | บอกว่าพร้อมคำนวณ/ขาด EF/ขาด N/ขาดหน่วย/ขาดพื้นที่ |
| ปริมาณที่ใช้คำนวณ | ลดความสับสนระหว่างปริมาณเดิมกับปริมาณหลังเตรียม |
| หน่วยผลลัพธ์ | แสดงเป็นชื่อหน่วยแทน id ถ้า relation มีข้อมูล |
| รายละเอียด error | ให้แก้ปัญหาได้จากหน้าเดียว |

Action ที่ควรมี

1. คำนวณรายการเดียว
2. คำนวณรายการที่เลือก
3. คำนวณทั้งหมดที่พร้อม
4. ดู calculation breakdown
5. retry เฉพาะรายการที่ error



### Phase D.5: Visible calculation workflow

ปรับปุ่ม `คำนวณรายการที่เลือก` ให้เปิด modal เหมือน `ทำรายการทั้งหมดจากที่เลือก` ในหน้าเตรียมข้อมูล Carbon

เป้าหมายของ phase นี้คือให้ user เห็น workflow การคำนวณตั้งแต่ก่อนเริ่ม ระหว่างทำ และหลังจบ ไม่ใช่กดแล้วรอผลลัพธ์กลับมาเงียบ ๆ

สิ่งที่ modal ต้องมี:
1. หน้าสรุปรายการที่เลือกก่อนคำนวณ
2. แยกกลุ่มตามสูตร เช่น `generic_ef`, `fertilizer_n2o`, `ยังไม่รองรับ`
3. แสดง input ที่จะใช้คำนวณ เช่น ปริมาณ, หน่วย, N, สูตรที่จะใช้, สถานะ input
4. ให้ user กดยืนยันก่อนเริ่มคำนวณ
5. ตอนคำนวณให้ run ทีละ row เพื่อแสดง progress ได้จริง
6. แสดง current item, จำนวนที่ทำแล้ว/ทั้งหมด, progress bar
7. แสดงผลราย row ว่าสำเร็จหรือ error
8. หลังจบให้ refetch queue และแสดง summary เช่น สำเร็จ 10, ไม่สำเร็จ 2

แนวทาง implementation ที่แนะนำ:

1. เพิ่ม state ใหม่ฝั่ง frontend เช่น `footprintCalculationModal`
2. เมื่อกด `คำนวณรายการที่เลือก` ให้เปิด modal preview ก่อน ไม่ยิง calculate ทันที
3. ใน modal แสดง table preview ของ row ที่จะคำนวณ โดยใช้ข้อมูลที่ frontend มีแล้ว เช่น `formulaModeLabel`, `inputStatusLabel`, `calculationAmountLabel`, `preparedUnitLabel`, `nValueLabel`
4. แยก row เป็น `readyToCalculate`, `blocked`, `unsupported`
5. ปุ่มยืนยันให้คำนวณเฉพาะ `readyToCalculate`
6. ตอน run ให้ frontend loop เรียก `POST /activities/carbon-process-queue/:id/calculate` ทีละ row เพื่อ update progress ได้จริง
7. เก็บผลระหว่างทางใน state เช่น `successRows`, `failedRows`, `currentRow`
8. เมื่อจบให้ invalidate/refetch `carbon-process-queue` แล้วค้าง modal summary ไว้ให้ user อ่าน
9. ยังไม่ต้องเพิ่ม database schema ใน phase นี้

เหตุผลที่ควรใช้ single endpoint ทีละ row แทน bulk endpoint ใน phase นี้คือ frontend จะเห็น progress รายการต่อรายการได้ทันที ส่วน bulk endpoint ปัจจุบันจะตอบกลับหลังประมวลผลครบทั้งหมด จึงเหมาะกับ background/batch มากกว่า visible workflow



### Phase E: รองรับ batch/group calculation

เมื่อราย row ทำงานแล้ว ให้เพิ่ม group calculation โดยใช้ key เหล่านี้

```text
project_id หรือ carbon_roundCal_id
production_year
scenario
land_camp_id
land_id
resource_used_type_id
formula_mode
```

การรวมผล

```text
group_total_tCO2e = sum(row_result_tCO2e)
group_area_rai = sum(unique land area หรือ selected area)
group_tCO2e_per_rai = group_total_tCO2e / group_area_rai
```

สำหรับ baseline/project

```text
baseline_average_tCO2e = average(group_total_tCO2e ของปี baseline)
project_tCO2e = group_total_tCO2e ของปี project
emission_reduction = baseline_average_tCO2e - project_tCO2e
```

### Phase F: Audit และ database phase ถัดไป

ไม่จำเป็นต้องเปลี่ยน database ก่อนเริ่มทำ calculation ราย row แต่ถ้าจะให้ระบบตรวจสอบย้อนหลังได้จริง ควรเพิ่มใน phase ถัดไป

| สิ่งที่ควรเพิ่ม | เหตุผล |
|---|---|
| `carbon_calculation_runs` | เก็บรอบคำนวณ เช่น single/bulk/group |
| `carbon_calculation_run_items` | เก็บ queue row ที่อยู่ใน run |
| `carbon_calculation_results` | เก็บผลหลักและ breakdown สำหรับ query |
| `carbon_calculation_audit_logs` | เก็บ input/formula/constant/EF snapshot |
| เปลี่ยน `carbon_process_queue_info` เป็น `jsonb` | query/debug ง่ายขึ้น |

### Phase G: Test case ที่ควรมี

| Test | สิ่งที่ต้องยืนยัน |
|---|---|
| น้ำมันมี EF ตรงหน่วย | result = amount * EF และบันทึก queue result |
| น้ำมันไม่มี EF | status เป็น error และมี error message |
| ปุ๋ย `16-8-8` | parse `N = 16` และคำนวณ FSN ได้ |
| ปุ๋ยอินทรีย์ไม่มี N | ไม่เดา N และ block calculation พร้อมข้อความชัดเจน |
| ปุ๋ยมี area | แสดงทั้ง total และ per rai |
| retry error row | retry_count เพิ่มและ timestamps ถูก update |
| bulk calculation | รายการที่สำเร็จ/ล้มเหลวไม่ทำให้ทั้ง batch หายเงียบ |



## 18. ลำดับงานถัดไปหลัง implement รอบแรก

งานที่ควรทำต่อทันทีคือทำ `Phase D.5: Visible calculation workflow` เพื่อให้ปุ่ม `คำนวณรายการที่เลือก` เห็นขั้นตอนเหมือนปุ่ม `ทำรายการทั้งหมดจากที่เลือก` ในหน้า `คิวเตรียมข้อมูล Carbon`

### 18.1 สิ่งที่ทำแล้วในรอบแรก

| งาน | สถานะ |
|---|---|
| ทำ `formulaModeResolver` สำหรับ queue row | ทำแล้ว |
| ทำ endpoint calculate จาก `carbon_process_queue` | ทำแล้ว |
| เขียนผลกลับ queue result/error/timestamps | ทำแล้ว |
| รองรับสูตร `generic_ef` | ทำแล้ว |
| รองรับสูตร `fertilizer_n2o` | ทำแล้ว |
| เพิ่ม column สูตร/input/result/error บนหน้า Carbon Footprint | ทำแล้ว |
| เพิ่มปุ่มคำนวณราย row/selected/all ready | ทำแล้ว |
| แสดง progress modal สำหรับ selected calculation | ยังไม่ได้ทำ |
| ดู calculation breakdown บนหน้าจอ | ยังไม่ได้ทำ |
| group calculation | ยังไม่ได้ทำ |
| audit/result table แยก | ยังไม่ได้ทำ |

### 18.2 งานถัดไปที่ควร implement

1. เพิ่ม modal ใหม่สำหรับ Carbon Footprint calculation เช่น `footprintCalculationModal`
2. ปุ่ม `คำนวณรายการที่เลือก` ต้องเปิด modal preview ก่อนคำนวณ
3. ปุ่ม `คำนวณทั้งหมดที่พร้อม` ก็ควรใช้ modal เดียวกัน แต่ source row มาจาก filtered ready rows
4. ใน modal ต้องแสดง row ที่พร้อมคำนวณและ row ที่ถูก block แยกกัน
5. เพิ่มปุ่ม `ยืนยันและเริ่มคำนวณ`
6. เมื่อเริ่มคำนวณให้ loop เรียก single endpoint ทีละ row เพื่อโชว์ progress
7. แสดง progress bar, current row, จำนวนสำเร็จ, จำนวนไม่สำเร็จ
8. เมื่อจบให้แสดง summary และรายชื่อ error พร้อมข้อความจาก backend
9. หลังจบให้ invalidate/refetch `carbon-process-queue`
10. ยังไม่ต้องเปลี่ยน database schema ในรอบนี้

### 18.3 Prompt สำหรับทำงานต่อ

```text
ช่วย implement Phase D.5 ใน CONCLUSION_CARBON_CAL_TABLE.md สำหรับหน้า "คำนวณ Carbon" -> "Carbon Footprint"

เป้าหมาย:
ปรับปุ่ม "คำนวณรายการที่เลือก" และ "คำนวณทั้งหมดที่พร้อม" ให้มี workflow บนหน้าจอเหมือนปุ่ม "ทำรายการทั้งหมดจากที่เลือก" ในหน้า "คิวเตรียมข้อมูล Carbon" โดยยังไม่ต้องเปลี่ยน database schema

สิ่งที่ต้องทำใน frontend:
1. เพิ่ม state modal ใหม่ เช่น footprintCalculationModal
2. เมื่อกด "คำนวณรายการที่เลือก" ห้ามยิง calculate ทันที ให้เปิด modal preview ก่อน
3. เมื่อกด "คำนวณทั้งหมดที่พร้อม" ให้เปิด modal preview โดยใช้ filtered rows ที่พร้อมคำนวณ
4. ใน modal preview ให้แสดง:
   - จำนวนรายการทั้งหมด
   - จำนวนที่พร้อมคำนวณ
   - จำนวนที่ input ยังไม่ครบ
   - จำนวนสูตรที่ยังไม่รองรับ
   - ตารางรายการพร้อมคำนวณ
   - ตารางรายการที่ถูก block พร้อมเหตุผล
5. แยกกลุ่มตาม formula mode:
   - generic_ef
   - fertilizer_n2o
   - fnfix_group / soc_removal ที่ยังไม่รองรับ
6. แสดงข้อมูลสำคัญต่อ row:
   - หัวข้อกิจกรรม
   - รายการปัจจัย
   - สูตรที่จะใช้
   - ปริมาณที่ใช้คำนวณ
   - หน่วยหลังเตรียม
   - N ถ้าเป็นปุ๋ย
   - สถานะ input
7. เพิ่มปุ่ม "ยืนยันและเริ่มคำนวณ"
8. ตอนคำนวณให้ loop เรียก single endpoint:
   POST /activities/carbon-process-queue/:id/calculate
   ทีละ row เพื่อให้แสดง progress ได้จริง
9. ระหว่างคำนวณให้ modal แสดง:
   - current row
   - progress bar
   - current/total
   - success count
   - failed count
10. เมื่อแต่ละ row สำเร็จ ให้เก็บผลใน modal state
11. เมื่อแต่ละ row error ให้เก็บ error message ใน modal state และทำรายการถัดไปต่อ
12. หลังคำนวณครบ ให้ refetch/invalidate:
   - carbon-process-queue
   - activity-details-calculate
   - activity-details
13. หลังจบให้ modal แสดง summary:
   - สำเร็จกี่รายการ
   - ไม่สำเร็จกี่รายการ
   - รายการ error พร้อมข้อความ
14. ให้ user ปิด modal เอง หรือมี countdown แบบหน้าเตรียมข้อมูลก็ได้

ข้อจำกัด:
- ยังไม่ต้องเพิ่ม WebSocket/SSE
- ยังไม่ต้องเพิ่ม table audit/result ใหม่
- ยังไม่ต้อง implement group calculation
- ยังไม่ต้อง implement SOC/Fnfix จริง
- อย่า revert งานเดิมหรือแก้ไฟล์ที่ไม่เกี่ยวข้อง

หลัง implement ให้รัน:
- backend: npm run build
- frontend: npm run build
```

## 19. สถานะฐานข้อมูลจริงและ Prisma ล่าสุด ณ 2026-06-15

ส่วนนี้เพิ่มไว้เพื่อช่วย agent หรือคนที่มาทำงานต่อให้แยกให้ออกระหว่าง:

1. สิ่งที่เอกสารนี้ “เสนอให้ระบบควรมี”
2. สิ่งที่ฐานข้อมูลจริง “มีแล้วใน snapshot ล่าสุด”
3. สิ่งที่ Prisma “รองรับแล้วแต่ logic ยังไม่ได้ implement”

### 19.1 Snapshot ที่ใช้อ้างอิงล่าสุด

ฐานข้อมูล snapshot ล่าสุดที่ถูกนำมาเทียบกับโปรเจกต์คือ:

```text
managementDataSystem_forCalculate_3.0_06152026_postgres.sql
```

และ Prisma ในโปรเจกต์ถูกปรับตาม snapshot นี้แล้วที่:

```text
backend/src/prisma/schema.prisma
```

หมายความว่า ถ้างานถัดไปต้องอ้างอิงโครงสร้าง table จริง ควรดู `schema.prisma` คู่กับ snapshot `3.0_06152026` ไม่ควรอ้างอิง snapshot เก่าตัวเดียว

### 19.2 สิ่งที่ฐานข้อมูลจริงมีเพิ่มแล้ว

จาก snapshot ล่าสุด ฐานข้อมูลจริงมีโครงสร้างที่เกี่ยวกับงาน carbon เพิ่มขึ้นแล้วบางส่วน แม้หน้าเว็บและ service หลายตัวจะยังไม่ได้ใช้จริงครบทุก table

#### 19.2.1 เทียบกับ snapshot ก่อนหน้าแบบสั้น

เมื่อเทียบกับ snapshot เดิมในโปรเจกต์ (`managementDataSystem_forCalculate_2.0_06082026_postgres.sql`) รอบ `3.0_06152026`:

- ไม่มีการลบ table เดิมออก
- มีการเพิ่ม table ใหม่ 4 ตัว
- มีการเพิ่ม foreign key / column สำคัญใน table เดิมบางตัว
- direction ของ schema ชัดเจนขึ้นว่าเริ่มแยก `Carbon Credit / SOC / Fnfix / Production Year / Camp Group` ออกจาก flow activity เดิม

| สิ่งที่มีในฐานข้อมูลจริง | ความหมายเชิงงาน |
|---|---|
| `activities_productYear` | มี master ปีการผลิตจริงใน DB แล้ว |
| `log_activities_detail.act_productYear_id` | activity detail สามารถผูกกับปีการผลิตได้ตรงขึ้น |
| `lands_camps_groups` | เริ่มมีโครงสร้าง group ของ camp |
| `lands_camps.land_camp_group_id` | camp สามารถผูกเข้ากลุ่ม camp ได้ |
| `carbon_soc` | มี table สำหรับข้อมูล SOC จริงระดับ DB แล้ว |
| `carbon_soilImprovementPlants` | มี table สำหรับข้อมูลพืชปรับปรุงดิน/Fnfix จริงระดับ DB แล้ว |
| `carbon_process_queue_resultValueCreditCalc` และ unit ของมัน | queue เริ่มแยกพื้นที่เก็บผลด้าน Carbon Credit ออกจาก result เดิมได้ |

#### 19.2.2 รายละเอียดของ table/column ใหม่ที่ควรรู้

1. `activities_productYear`

ใช้เป็น master ปีการผลิตโดยตรง แทนการเดาปีจากชื่อหรือการเก็บแบบกระจาย

field สำคัญ:
- `act_productYear_id`
- `act_productYear_name`
- `act_productYear_info`
- `act_productyear_create_at`
- `act_productYear_update_at`
- `act_productYear_update_uid`

ผลเชิงระบบ:
- งาน baseline/project และงานสรุปตามปีการผลิตเริ่มมีฐานข้อมูลรองรับชัดขึ้น
- งาน activity import / summary / comparison ในอนาคตควรพยายาม map เข้าฟิลด์นี้แทนการเก็บปีแบบ free text

2. `log_activities_detail.act_productYear_id`

เป็นการต่อ relation จาก activity detail ไปยัง master ปีการผลิต

ผลเชิงระบบ:
- row ของ activity สามารถจัดกลุ่มตาม production year ได้ตรงขึ้น
- เหมาะกับการเอาไปใช้ใน summary page, queue grouping และ baseline/project logic

3. `lands_camps_groups` และ `lands_camps.land_camp_group_id`

เป็นจุดเริ่มต้นของการมี “กลุ่ม camp” อย่างเป็นทางการในฐานข้อมูล

field หลักของ group:
- `land_camp_group_id`
- `land_camp_group_idCode`
- `land_camp_group_name`
- `land_camp_group_update_at`

ผลเชิงระบบ:
- ในอนาคตสามารถทำ report หรือ comparison ระดับกลุ่ม camp ได้
- ถ้าจะทำ dashboard, filter หรือ summary ตาม cluster ของพื้นที่ จุดนี้เป็นฐานที่ดี

4. `carbon_soc`

table นี้เป็นฐานเริ่มต้นของข้อมูล SOC ใน DB จริง

field สำคัญที่มีแล้ว:
- `land_id`
- `carbon_soc_socSampleIT`
- `carbon_soc_bdSampleIt`
- `carbon_soc_depSampleIT`
- `carbon_soc_socIT`
- `carbon_soc_numLandSample`
- `carbon_soc_numSample`
- `carbon_soc_yearBeginPro`
- unit fields ที่ผูกกับ `units`

ผลเชิงระบบ:
- DB เริ่มรองรับการเก็บค่า SOC, bulk density, depth, sample count และค่าที่เกี่ยวข้องจริง
- แต่โครงสร้างนี้ยังเป็น “input/storage layer” มากกว่า “calculation audit layer”
- ยังไม่มี sample event / before-after pair / formula snapshot / verification flow แบบเต็มตาม design ideal

5. `carbon_soilImprovementPlants`

table นี้เป็นฐานเริ่มต้นของข้อมูลพืชปรับปรุงดินและ Fnfix ใน DB จริง

field สำคัญที่มีแล้ว:
- `land_id`
- `carbon_soilImprovementPlant_mc`
- `carbon_soilImprovementPlant_nc`
- `carbon_soilImprovementPlant_fnFix`
- `unit_mc`
- `unit_nc`
- `unit_fnFix`
- `act_resourceOther_id`

ผลเชิงระบบ:
- เริ่มมีที่เก็บ input สำคัญของ Fnfix เช่น biomass / N content / fnfix result
- มีความเชื่อมกับ `activities_resourceOther` ซึ่งอาจใช้แทนชนิดพืชหรือ resource master ได้บางกรณี
- แต่ยังไม่ได้แยก methodology, factor version หรือ detailed breakdown ตามสูตรใน design note

6. `carbon_process_queue_resultValueCreditCalc` และหน่วยของมัน

queue เดิมไม่ได้เก็บพื้นที่ผลลัพธ์ Carbon Credit แยกชัดจาก result หลัก แต่ snapshot ใหม่นี้เพิ่มแล้ว

field ใหม่:
- `carbon_process_queue_resultValueCreditCalc`
- `unit_prefix_id_resultValueCreditCalc`
- `unit_id_resultValueCreditCalc`

ผลเชิงระบบ:
- ในอนาคต queue row เดียวกันอาจเก็บได้ทั้งค่าฝั่ง Carbon Footprint และค่าฝั่ง Credit/Removal
- ช่วยลดแรงกดดันที่จะต้องรีบสร้าง table ผลลัพธ์ใหม่ทันทีสำหรับทุกกรณี
- แต่ถ้าจะทำ audit จริงจัง ยังควรมี result tables แยกใน phase ถัดไป

### 19.3 สิ่งที่ Prisma รองรับแล้วหลังการ sync รอบนี้

Prisma ถูกอัปเดตให้รองรับโครงสร้างด้านบนแล้ว เพื่อให้ agent ถัดไปสามารถเริ่มเขียน service/controller/query ได้โดยไม่ต้อง sync schema ซ้ำก่อน

รายการสำคัญที่พร้อมใช้แล้วใน Prisma:

- model `activities_productYear`
- model `lands_camps_groups`
- model `carbon_soc`
- model `carbon_soilImprovementPlants`
- field `act_productYear_id` ใน `log_activities_detail`
- field `land_camp_group_id` ใน `lands_camps`
- field กลุ่ม `resultValueCreditCalc` ใน `carbon_process_queue`
- relation หลายจุดที่ผูก `units` และ `units_prefixs` สำหรับผลลัพธ์ Carbon Credit และข้อมูล SOC/Fnfix

### 19.4 ข้อสำคัญ: มี table แล้ว ไม่ได้แปลว่า flow ใช้งานจริงครบแล้ว

แม้ DB และ Prisma จะพร้อมขึ้น แต่ ณ ตอนนี้ logic ฝั่งแอปยังอยู่ประมาณนี้:

| ส่วนงาน | สถานะ |
|---|---|
| `generic_ef` | ใช้งานได้แล้ว |
| `fertilizer_n2o` / fertilizer CFP simple | ใช้งานได้แล้วบาง flow |
| `fnfix_group` | ยังเป็นแผน/ยังไม่คำนวณจริง |
| `soc_removal` | ยังเป็นแผน/ยังไม่คำนวณจริง |
| `carbon_soc` table | มีใน DB/Prisma แล้ว แต่ยังไม่ได้ทำ service + UI flow จริง |
| `carbon_soilImprovementPlants` table | มีใน DB/Prisma แล้ว แต่ยังไม่ได้ทำ service + UI flow จริง |

ดังนั้น agent ถัดไปไม่ควรสรุปว่า “SOC ทำเสร็จแล้ว” หรือ “Fnfix ใช้งานได้แล้ว” เพียงเพราะเห็น table ใน schema

### 19.5 การ map ระหว่าง design note นี้กับ table จริง

เอกสารนี้เคยเสนอ table เชิง ideal เช่น:

- `soil_sample_events`
- `soil_sample_measurements`
- `soc_calculation_results`
- `nitrogen_fixation_records`
- `carbon_calculation_runs`
- `carbon_calculation_audit_logs`

แต่ในฐานข้อมูลจริงล่าสุด ยังไม่ได้ออกมาในชื่อนี้ตรง ๆ ทั้งหมด

สำหรับงานต่อจากนี้ให้ตีความแบบ practical ดังนี้:

| แนวคิดในเอกสาร | table จริงที่อาจใช้เป็นฐานเริ่มต้น |
|---|---|
| SOC sample / SOC input | `carbon_soc` |
| Soil improvement / nitrogen fixation input | `carbon_soilImprovementPlants` |
| Production year | `activities_productYear` + `log_activities_detail.act_productYear_id` |
| Credit result บางส่วน | `carbon_process_queue_resultValueCreditCalc` และ unit fields |

แต่ถ้าจะทำ audit trail, sample event, formula snapshot, run history แบบครบตาม design จริง อาจยังต้องเพิ่ม table ใหม่ในระยะถัดไป

### 19.6 คำแนะนำสำหรับ agent ที่มาทำต่อ

ถ้าจะทำงานต่อในส่วน SOC / Fnfix / Carbon Credit ให้เริ่มตรวจ 4 จุดนี้ก่อน:

1. อ่าน `backend/src/prisma/schema.prisma` ก่อนทุกครั้ง เพื่อดูโครงสร้างจริงล่าสุด
2. แยกว่า task นั้นจะใช้ table ที่มีอยู่แล้ว (`carbon_soc`, `carbon_soilImprovementPlants`) หรือจะออกแบบ table audit/result เพิ่ม
3. อย่าสรุปจากเอกสารนี้อย่างเดียวว่า schema ต้องเป็นแบบ ideal table names ใน section 7
4. ถ้าทำ logic ใหม่ให้ระบุชัดว่าเป็น:
   - ใช้ table จริงที่มีอยู่แล้ว
   - หรือเพิ่ม phase ใหม่สำหรับ table audit/result ที่ยังไม่มี

### 19.7 สรุปสั้นสำหรับการส่งต่องาน

```text
ตอนนี้ DB snapshot 3.0 และ Prisma พร้อมสำหรับเริ่มงาน SOC/Fnfix/Credit มากขึ้นแล้ว
แต่ปัจจุบันพร้อมในระดับ schema/ORM เป็นหลัก
ยังไม่พร้อมในระดับ service + endpoint + frontend workflow + audit flow แบบครบวงจร
```
