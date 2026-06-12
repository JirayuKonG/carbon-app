export type SpatialProjectGeoConfidence = "confirmed" | "partial" | "unknown";

export interface SpatialProjectGeoMapping {
  campName: string;
  province: string;
  district: string;
  subdistrict: string;
  confidence: SpatialProjectGeoConfidence;
}

const UNKNOWN_GEO = "-";

const CAMP_NAME_NORMALIZATION: Record<string, string> = {
  "หนองกระทุ ่ม1": "หนองกระทุ่ม1",
  "หนองกระทุ ่ม2": "หนองกระทุ่ม2",
  "สระบัวก ่ำ": "สระบัวก่ำ",
  "เขำแหลม": "เขาแหลม",
  "เขำประทุน": "เขาประทุน",
  "หนองยำยเงิน": "หนองยายเงิน",
  "ทัพผึ ้ง": "ทัพผึ้ง",
  "หนองมะค่ำ": "หนองมะค่า",
  "ล ำอีซู": "ลำอีซู",
  "โคกงำม": "โคกงาม",
  "โคกสะอำด": "โคกสะอาด",
  "บ้ำนเพชร": "บ้านเพชร",
  "บ้ำนแท่น": "บ้านแท่น",
  "ผำแดง": "ผาแดง",
  "ฝำยพญำนำค": "ฝายพญานาค",
  "ภูผำม่ำน": "ภูผาม่าน",
  "อ้อยงำม": "อ้อยงาม",
  "อ้อยงำม303": "อ้อยงาม303",
  "ศรีบุญเรือง1": "ศรีบุญเรือง",
  "ศรีบุญเรือง2": "ศรีบุญเรือง",
};

export const spatialProjectGeoMappings: SpatialProjectGeoMapping[] = [
  { campName: "หนองกระทุ่ม1", province: "สุพรรณบุรี", district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองกระทุ่ม2", province: "สุพรรณบุรี", district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองขอน", province: "สุพรรณบุรี", district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "สระบัวก่ำ", province: "สุพรรณบุรี", district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองยายเงิน", province: "สุพรรณบุรี", district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "เขาประทุน", province: "อุทัยธานี", district: "บ้านไร่", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "เขาแหลม", province: "อุทัยธานี", district: "บ้านไร่", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองแก", province: "อุทัยธานี", district: "บ้านไร่", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองปรือ", province: "กาญจนบุรี", district: "หนองปรือ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองเรือ", province: "กาญจนบุรี", district: "หนองปรือ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองมะค่า", province: "กาญจนบุรี", district: "หนองปรือ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "ลำอีซู", province: "กาญจนบุรี", district: "หนองปรือ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "ทัพผึ้ง", province: UNKNOWN_GEO, district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "unknown" },
  { campName: "กุดจอก", province: "ชัยภูมิ", district: "ภูเขียว", subdistrict: "โคกสะอาด", confidence: "confirmed" },
  { campName: "โคกสะอาด", province: "ชัยภูมิ", district: "ภูเขียว", subdistrict: "โคกสะอาด", confidence: "confirmed" },
  { campName: "โคกเจริญชัย", province: "ชัยภูมิ", district: "ภูเขียว", subdistrict: "โคกสะอาด", confidence: "confirmed" },
  { campName: "ภูผาม่าน", province: "ขอนแก่น", district: "ชุมแพ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "หนองไผ่เหนือ", province: "ขอนแก่น", district: "ชุมแพ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "ศรีบุญเรือง", province: "หนองบัวลำภู", district: "ศรีบุญเรือง", subdistrict: "โนนสะอาด", confidence: "confirmed" },
  { campName: "บ้านแท่น", province: "ชัยภูมิ", district: "บ้านแท่น", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "ภูเพชร", province: "ชัยภูมิ", district: "ภูเขียว", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "บ้านเพชร", province: "ชัยภูมิ", district: "ภูเขียว", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "บัวพักเกวียน", province: UNKNOWN_GEO, district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "unknown" },
  { campName: "ฝายพญานาค", province: "ชัยภูมิ", district: "แก้งคร้อ", subdistrict: "หลุบคา", confidence: "confirmed" },
  { campName: "ผาแดง", province: "ชัยภูมิ", district: "แก้งคร้อ", subdistrict: "หนองสังข์", confidence: "confirmed" },
  { campName: "อ้อยงาม", province: "ชัยภูมิ", district: "แก้งคร้อ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "อ้อยงาม303", province: "ชัยภูมิ", district: "แก้งคร้อ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "โคกงาม", province: "ชัยภูมิ", district: "แก้งคร้อ", subdistrict: UNKNOWN_GEO, confidence: "partial" },
  { campName: "โนนรัง", province: UNKNOWN_GEO, district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "unknown" },
  { campName: "หนองบัวน้อย", province: UNKNOWN_GEO, district: UNKNOWN_GEO, subdistrict: UNKNOWN_GEO, confidence: "unknown" },
];

const geoByCampName = new Map(spatialProjectGeoMappings.map((item) => [item.campName, item]));

export function normalizeProjectCampName(campName: string) {
  return CAMP_NAME_NORMALIZATION[campName] ?? campName;
}

export function getSpatialProjectGeo(campName: string): SpatialProjectGeoMapping {
  const normalizedCampName = normalizeProjectCampName(campName);
  return geoByCampName.get(normalizedCampName) ?? {
    campName: normalizedCampName,
    province: UNKNOWN_GEO,
    district: UNKNOWN_GEO,
    subdistrict: UNKNOWN_GEO,
    confidence: "unknown",
  };
}
