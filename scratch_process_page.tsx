Created At: 2026-06-15T07:08:03Z
Completed At: 2026-06-15T07:08:03Z
File Path: `file:///c:/Project_Tesis/carbon-app/frontend/src/features/cf-dashboard/pages/ProcessPage.tsx`
Total Lines: 1549
Total Bytes: 83723
Showing lines 147 to 250
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
147:       })),
148:       { name: CHEMICAL_ACTIVITY_NAME, emission: chemicalEmission },
149:     ],
150:   };
151: }
152: 
153: function withDetailedActivities(rows: ProcessActivityBreakdown[]): ProcessActivityBreakdown[] {
154:   return rows.map((row) => {
155:     const usableActivities = row.activities.filter((activity) => activity.emission > 0);
156:     const onlyProcessTotal = usableActivities.length <= 1 && (!usableActivities[0] || usableActivities[0].name === row.process);
157:     const detailedRow = onlyProcessTotal
158:       ? {
159:         ...row,
160:         activities: fallbackActivitiesForProcess(row),
161:       }
162:       : {
163:       ...row,
164:         activities: usableActivities,
165:       };
166:     return ensureChemicalActivity(detailedRow);
167:   });
168: }
169: 
170: interface FootprintComparisonTarget {
171:   id: string;
172:   name: string;
173:   detail: string;
174:   areaRai: number;
175:   fieldCount: number;
176:   soilType: string;
177:   baseline: number;
178:   current: number;
179:   baselineRows: ProcessActivityBreakdown[];
180:   currentRows: ProcessActivityBreakdown[];
181: }
182: 
183: interface OrganicMaterialDefinition {
184:   key: string;
185:   name: string;
186:   unit: string;
187:   baseCoveragePct: number;
188:   amountPerRai: number;
189:   shareWeight: number;
190: }
191: 
192: interface OrganicMaterialArea {
193:   id: string;
194:   name: string;
195:   level: "แคมป์" | "แปลง";
196:   areaRai: number;
197:   socBaselinePct: number;
1
<truncated 381 bytes>
lDefinition[] = [
213:   { key: "compost", name: "ปุ๋ยอินทรีย์/ปุ๋ยหมัก", unit: "kg", baseCoveragePct: 48, amountPerRai: 120, shareWeight: 34 },
214:   { key: "filter-cake", name: "ฟิลเตอร์เค้ก", unit: "ตัน", baseCoveragePct: 32, amountPerRai: 0.42, shareWeight: 24 },
215:   { key: "vinasse", name: "น้ำกากส่า/Vinasse", unit: "ลิตร", baseCoveragePct: 28, amountPerRai: 160, shareWeight: 22 },
216:   { key: "trash", name: "ใบอ้อยคลุมดิน", unit: "kg", baseCoveragePct: 42, amountPerRai: 95, shareWeight: 20 },
217: ];
218: 
219: function toKgProcessRows(rows: ProcessActivityBreakdown[]): ProcessActivityBreakdown[] {
220:   return rows.map((row) => ({
221:     ...row,
222:     totalEmission: Number((row.totalEmission * 1000).toFixed(2)),
223:     activities: row.activities.map((activity) => ({
224:       ...activity,
225:       emission: Number((activity.emission * 1000).toFixed(2)),
226:     })),
227:   }));
228: }
229: 
230: function kgCo2e(value: number) {
231:   return value * 1000;
232: }
233: 
234: function stablePercentSeed(key: string) {
235:   let hash = 0;
236:   for (let index = 0; index < key.length; index += 1) {
237:     hash = ((hash * 31) + key.charCodeAt(index)) % 9973;
238:   }
239:   return hash;
240: }
241: 
242: function clampValue(value: number, min: number, max: number) {
243:   return Math.min(Math.max(value, min), max);
244: }
245: 
246: function materialUsagesForArea(id: string, areaRai: number): OrganicMaterialUsage[] {
247:   const weights = organicMaterialDefinitions.map((definition, index) => {
248:     const seed = stablePercentSeed(`${id}:${definition.key}`);
249:     return Math.max(definition.shareWeight + (seed % 11) - 5 + index, 5);
250:   });
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
