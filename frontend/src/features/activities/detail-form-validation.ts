export type ActivityDetailFormValidationInput = {
  activities_header_id: string
  act_productYear_id: string
  act_header_type_id: string
  act_header_detail_type_id: string
  act_equipment_id: string
  act_fertilizer_id: string
  act_chemiscal_id: string
  act_resourceOther_id: string
  resource_used_type_id: string
  unit_id: string
  log_act_detail_quatity: string
  log_act_detail_areawork: string
}

type ActivityDetailValidationOptions = {
  selectedLandId: number | null
}

function hasSelectedResourceItem(form: ActivityDetailFormValidationInput) {
  return Boolean(
    form.act_fertilizer_id
    || form.act_equipment_id
    || form.act_chemiscal_id
    || form.act_resourceOther_id,
  )
}

export function validateActivityDetailForm(
  form: ActivityDetailFormValidationInput,
  options: ActivityDetailValidationOptions,
) {
  const errors: string[] = []

  if (options.selectedLandId == null) {
    errors.push('กรุณาเลือกแปลง')
  }

  if (!form.activities_header_id) {
    errors.push('กรุณาเลือกหัวข้อกิจกรรมของแปลงที่เลือก')
  }

  if (!form.act_productYear_id) {
    errors.push('กรุณาเลือกปีการผลิต')
  }

  if (!form.act_header_type_id) {
    errors.push('กรุณาเลือกประเภทกิจกรรม')
  }

  if (!form.act_header_detail_type_id) {
    errors.push('กรุณาเลือกประเภทรายละเอียดกิจกรรม')
  }

  if (!form.resource_used_type_id) {
    errors.push('กรุณาเลือกประเภทปัจจัย')
  }

  if (!hasSelectedResourceItem(form)) {
    errors.push('กรุณาเลือกอย่างน้อย 1 รายการจาก ปุ๋ย / อุปกรณ์ / สารเคมี / รายการอื่น ๆ')
  }

  if (!form.unit_id) {
    errors.push('กรุณาเลือกหน่วยนับ')
  }

  if (!form.log_act_detail_quatity.trim()) {
    errors.push('กรุณากรอกจำนวน')
  }

  if (!form.log_act_detail_areawork.trim()) {
    errors.push('กรุณากรอกพื้นที่ทำงาน')
  }

  return errors
}
