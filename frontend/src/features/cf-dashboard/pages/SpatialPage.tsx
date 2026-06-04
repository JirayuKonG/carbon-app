import { useEffect, useMemo, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ProcessInputComparisonBar } from "../components/charts/ProcessInputComparisonBar";
import { sortProcessLabels } from "../components/charts/ChartRegistry";
import { ThailandMap } from "../components/map/ThailandMap";
import { SourceBadge } from "../components/common/SourceBadge";
import { getCampCarbonSummaries, getCampFieldCarbonDetails, getCfSpatialNodes } from "../services/dashboardApi";
import type { CampCarbonSummary, CampFieldCarbonDetail, DataResult, FieldCarbonDetail, ProcessActivityBreakdown, ProcessInputComparison, SpatialLevel, SpatialSummaryNode } from "../types/dashboard";
import "../cf-dashboard.css";

function isField(node: SpatialSummaryNode): node is FieldCarbonDetail {
  return node.level === "field";
}

function nodeCompare(selected: SpatialSummaryNode): { baseline: ProcessActivityBreakdown[]; current: ProcessActivityBreakdown[] } {
  return {
    baseline: [{
      year: "baseline_avg",
      process: selected.name,
      totalEmission: selected.baselineEmission,
      activities: [{ name: "Baseline avg", emission: selected.baselineEmission }],
    }],
    current: [{
      year: "project",
      process: selected.name,
      totalEmission: selected.currentEmission,
      activities: [{ name: "Project year", emission: selected.currentEmission }],
    }],
  };
}

function sumInputs(inputs: ProcessInputComparison[]) {
  return inputs.reduce(
    (sum, item) => ({
      baselineFertilizerKg: sum.baselineFertilizerKg + item.baselineFertilizerKg,
      currentFertilizerKg: sum.currentFertilizerKg + item.currentFertilizerKg,
      baselineFuelLiter: sum.baselineFuelLiter + item.baselineFuelLiter,
      currentFuelLiter: sum.currentFuelLiter + item.currentFuelLiter,
    }),
    { baselineFertilizerKg: 0, currentFertilizerKg: 0, baselineFuelLiter: 0, currentFuelLiter: 0 },
  );
}

function inputPct(base: number, current: number) {
  return base ? ((base - current) / base) * 100 : 0;
}

export function CfSpatialPage() {
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("thailand");
  const [campResult, setCampResult] = useState<DataResult<CampCarbonSummary[]>>({ data: [], source: "mock" });
  const [campFieldResult, setCampFieldResult] = useState<DataResult<CampFieldCarbonDetail[]>>({ data: [], source: "mock" });
  const [selectedCampId, setSelectedCampId] = useState<number | "all">("all");
  const [filters, setFilters] = useState<Record<Exclude<SpatialLevel, "country">, string>>({
    region: "",
    province: "",
    district: "",
    subdistrict: "",
    field: "",
  });

  useEffect(() => {
    Promise.all([getCfSpatialNodes(), getCampCarbonSummaries(), getCampFieldCarbonDetails()])
      .then(([result, campSummaryResult, campFieldsResult]) => {
        setNodes(result.data);
        setCampResult(campSummaryResult);
        setCampFieldResult(campFieldsResult);
        const root = result.data.find((node) => !node.parentId);
        if (root) setSelectedId(root.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลแผนที่ไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    getCampFieldCarbonDetails(selectedCampId === "all" ? undefined : selectedCampId)
      .then(setCampFieldResult)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลรายแปลงในแคมป์ไม่สำเร็จ"));
  }, [selectedCampId]);

  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const diff = selected ? selected.baselineEmission - selected.currentEmission : 0;
  const compare = selected ? nodeCompare(selected) : { baseline: [], current: [] };
  const spatialInputs = sortProcessLabels(selected?.processInputComparisons?.map((item) => item.process) ?? [])
    .map((process) => selected?.processInputComparisons?.find((item) => item.process === process))
    .filter((item): item is ProcessInputComparison => Boolean(item));
  const inputTotals = sumInputs(spatialInputs);
  const fertilizerDiff = inputTotals.baselineFertilizerKg - inputTotals.currentFertilizerKg;
  const fuelDiff = inputTotals.baselineFuelLiter - inputTotals.currentFuelLiter;
  const rootId = nodes.find((node) => !node.parentId)?.id ?? "thailand";
  const selectedCamp = selectedCampId === "all"
    ? undefined
    : campResult.data.find((camp) => camp.campId === selectedCampId);

  const breadcrumbs = useMemo(() => {
    const list: SpatialSummaryNode[] = [];
    let cur: SpatialSummaryNode | undefined = selected;
    while (cur) {
      list.unshift(cur);
      cur = cur.parentId ? nodes.find((node) => node.id === cur?.parentId) : undefined;
    }
    return list;
  }, [nodes, selected]);

  const optionsFor = (level: Exclude<SpatialLevel, "country">, parentId?: string) =>
    nodes.filter((node) => node.level === level && (!parentId || node.parentId === parentId));

  const selectArea = (level: keyof typeof filters, id: string) => {
    const order: (keyof typeof filters)[] = ["region", "province", "district", "subdistrict", "field"];
    const levelIndex = order.indexOf(level);
    const next = { ...filters, [level]: id };
    order.slice(levelIndex + 1).forEach((key) => {
      next[key] = "";
    });
    setFilters(next);
    setSelectedId(id || next.subdistrict || next.district || next.province || next.region || rootId);
  };

  if (!selected) {
    return <div className="cf-dash"><div className="page active"><div className="empty-state">กำลังโหลดข้อมูลแผนที่...</div></div></div>;
  }

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <p className="eyebrow">04 · Spatial Drill-down</p>
            <h1>แผนที่ประเทศไทยและรายละเอียดรายพื้นที่</h1>
          </div>
        </div>

        {error && <div className="error-panel">{error}</div>}

        <section className="card spatial-picker">
          <div>
            <div className="card-title">เลือกพื้นที่</div>
            <div className="breadcrumb">
              {breadcrumbs.map((item, index) => (
                <span key={item.id}>
                  {index > 0 && <span>›</span>}
                  <button onClick={() => setSelectedId(item.id)}>{item.name}</button>
                </span>
              ))}
            </div>
          </div>
          <div className="spatial-select-grid">
            <label>
              ภาค
              <select value={filters.region} onChange={(event) => selectArea("region", event.target.value)}>
                <option value="">ทั้งหมด</option>
                {optionsFor("region", rootId).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              จังหวัด
              <select value={filters.province} onChange={(event) => selectArea("province", event.target.value)} disabled={!filters.region}>
                <option value="">ทั้งหมด</option>
                {optionsFor("province", filters.region).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              อำเภอ / เขต
              <select value={filters.district} onChange={(event) => selectArea("district", event.target.value)} disabled={!filters.province}>
                <option value="">ทั้งหมด</option>
                {optionsFor("district", filters.province).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              ตำบล / แขวง
              <select value={filters.subdistrict} onChange={(event) => selectArea("subdistrict", event.target.value)} disabled={!filters.district}>
                <option value="">ทั้งหมด</option>
                {optionsFor("subdistrict", filters.district).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
            <label>
              แปลง
              <select value={filters.field} onChange={(event) => selectArea("field", event.target.value)} disabled={!filters.subdistrict}>
                <option value="">ทั้งหมด</option>
                {optionsFor("field", filters.subdistrict).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="card full-span">
          <div className="card-title">รายแปลงในแคมป์</div>
          <SourceBadge source={campFieldResult.source} meta={campFieldResult.meta} />
          <div className="year-tabs">
            <button className={`ytab ${selectedCampId === "all" ? "active" : ""}`} onClick={() => setSelectedCampId("all")}>เลือกแคมป์</button>
            {campResult.data.map((camp) => (
              <button key={camp.campId} className={`ytab ${selectedCampId === camp.campId ? "active" : ""}`} onClick={() => setSelectedCampId(camp.campId)}>
                {camp.campName}
              </button>
            ))}
          </div>
          {selectedCamp ? (
            <>
              <div className="mini-stat-grid wide">
                <div><strong>{selectedCamp.fieldCount.toLocaleString()}</strong><span>แปลงในแคมป์</span></div>
                <div><strong>{selectedCamp.areaRai.toLocaleString()}</strong><span>ไร่รวม</span></div>
                <div><strong>{selectedCamp.co2eTotal.toLocaleString()}</strong><span>tCO2e รวม</span></div>
                <div><strong>{selectedCamp.co2ePerRai.toFixed(3)}</strong><span>tCO2e/ไร่</span></div>
              </div>
              <div className="input-table-wrap">
                <table className="input-table">
                  <thead>
                    <tr>
                      <th>รหัสแปลง</th>
                      <th>ชื่อแปลง</th>
                      <th>เกษตรกร</th>
                      <th>พื้นที่</th>
                      <th>โฉนดที่ผูกอยู่</th>
                      <th>กิจกรรมที่บันทึก</th>
                      <th>CO2e ของแปลง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campFieldResult.data.map((field) => (
                      <tr key={field.id}>
                        <td>{field.fieldCode}</td>
                        <td>{field.fieldName}</td>
                        <td>{field.farmerName}</td>
                        <td>{field.areaRai.toLocaleString()} ไร่</td>
                        <td>{field.chanots.map((chanot) => `${chanot.chanotNo} (${chanot.areaRai} ไร่)`).join(", ") || "-"}</td>
                        <td>{field.activitiesLogged.join(", ") || "-"}</td>
                        <td>{field.co2eTotal.toLocaleString()} tCO2e</td>
                      </tr>
                    ))}
                    {!campFieldResult.data.length && (
                      <tr><td colSpan={7}>ยังไม่มี mock รายแปลงสำหรับแคมป์นี้</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">เลือกแคมป์เพื่อดูรายแปลง โฉนด กิจกรรม และ CO2e รายแปลง</div>
          )}
        </section>

        <section className="card map-card wide-map">
          <ThailandMap nodes={nodes} selectedId={selected.id} onSelect={setSelectedId} />
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title">สรุปรายละเอียดพื้นที่ · {selected.name}</div>
            <div className="mini-stat-grid wide">
              <div><strong>{selected.fields}</strong><span>แปลง</span></div>
              <div><strong>{selected.farmers}</strong><span>เกษตรกร</span></div>
              <div><strong>{selected.areaRai.toLocaleString()}</strong><span>ไร่</span></div>
              <div>
                <strong className={diff >= 0 ? "green-text" : "red-text"}>{Math.abs(diff).toFixed(2)}</strong>
                <span>{diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} tCO2e</span>
              </div>
            </div>
            <div className="carbon-compare">
              <div><span>Baseline avg</span><strong>{selected.baselineEmission.toLocaleString()} tCO2e</strong></div>
              <div><span>Project year</span><strong>{selected.currentEmission.toLocaleString()} tCO2e</strong></div>
              <div><span>Result</span><strong className={diff >= 0 ? "green-text" : "red-text"}>{diff >= 0 ? "ลดลง" : "เพิ่มขึ้น"}</strong></div>
            </div>
            {isField(selected) && (
              <div className="field-detail">
                <h3>{selected.fieldName}</h3>
                <div className="field-meta">
                  <span>รหัสแปลง: {selected.fieldCode}</span>
                  <span>เกษตรกร: {selected.farmerName}</span>
                  <span>จังหวัด: {selected.province}</span>
                  <span>อำเภอ: {selected.district}</span>
                  <span>ตำบล: {selected.subdistrict}</span>
                  <span>โทร: {selected.phone}</span>
                </div>
              </div>
            )}
          </article>

          <article className="card">
            <div className="card-title">แผนภูมิวงกลม · สัดส่วนกระบวนการในพื้นที่</div>
            <ProcessDoughnut data={selected.processBreakdown} />
          </article>
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title">สรุปการใช้ปุ๋ยและน้ำมันในพื้นที่ · {selected.name}</div>
            <div className="mini-stat-grid wide">
              <div>
                <strong>{inputTotals.baselineFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>kg ปุ๋ยปีฐาน</span>
              </div>
              <div>
                <strong>{inputTotals.currentFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>kg ปุ๋ยปีดำเนินการ</span>
              </div>
              <div>
                <strong>{inputTotals.baselineFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>L น้ำมันปีฐาน</span>
              </div>
              <div>
                <strong>{inputTotals.currentFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                <span>L น้ำมันปีดำเนินการ</span>
              </div>
            </div>
            <div className="input-insight-grid">
              <div>
                <span>ปุ๋ยเทียบปีฐาน</span>
                <strong className={fertilizerDiff >= 0 ? "green-text" : "red-text"}>
                  {fertilizerDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(fertilizerDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                </strong>
                <small>{Math.abs(inputPct(inputTotals.baselineFertilizerKg, inputTotals.currentFertilizerKg)).toFixed(1)}%</small>
              </div>
              <div>
                <span>น้ำมันเทียบปีฐาน</span>
                <strong className={fuelDiff >= 0 ? "green-text" : "red-text"}>
                  {fuelDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(fuelDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                </strong>
                <small>{Math.abs(inputPct(inputTotals.baselineFuelLiter, inputTotals.currentFuelLiter)).toFixed(1)}%</small>
              </div>
            </div>
          </article>

          <article className="card">
            <div className="card-title">กราฟเทียบปุ๋ยและน้ำมันรวม · ปีฐาน vs ปีดำเนินการ</div>
            <ProcessInputComparisonBar data={spatialInputs} mode="total" />
          </article>
        </section>

        <section className="card">
          <div className="card-title">เจาะรายกระบวนการ · ปุ๋ยและน้ำมันในพื้นที่</div>
          <div className="input-table-wrap">
            <table className="input-table">
              <thead>
                <tr>
                  <th>กระบวนการ</th>
                  <th>ปุ๋ยปีฐาน (kg)</th>
                  <th>ปุ๋ยปีดำเนินการ (kg)</th>
                  <th>ผลต่างปุ๋ย</th>
                  <th>น้ำมันปีฐาน (L)</th>
                  <th>น้ำมันปีดำเนินการ (L)</th>
                  <th>ผลต่างน้ำมัน</th>
                </tr>
              </thead>
              <tbody>
                {spatialInputs.map((item) => {
                  const processFertilizerDiff = item.baselineFertilizerKg - item.currentFertilizerKg;
                  const processFuelDiff = item.baselineFuelLiter - item.currentFuelLiter;
                  return (
                    <tr key={item.process}>
                      <td>{item.process}</td>
                      <td>{item.baselineFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td>{item.currentFertilizerKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className={processFertilizerDiff >= 0 ? "green-text" : "red-text"}>
                        {processFertilizerDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(processFertilizerDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td>{item.baselineFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td>{item.currentFuelLiter.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className={processFuelDiff >= 0 ? "green-text" : "red-text"}>
                        {processFuelDiff >= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(processFuelDiff).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!spatialInputs.length && <div className="empty-state">ยังไม่มีข้อมูลปุ๋ยและน้ำมันสำหรับพื้นที่นี้</div>}
          </div>
        </section>

        <section className="card">
          <div className="card-title">กราฟรายกระบวนการ · ปุ๋ยและน้ำมัน ปีฐาน vs ปีดำเนินการ</div>
          <ProcessInputComparisonBar data={spatialInputs} />
        </section>

        <section className="card">
          <div className="card-title">แผนภูมิแท่ง · เปรียบเทียบปีฐานและปีดำเนินการ</div>
          <ActivityGroupedBar baseline={compare.baseline} current={compare.current} />
        </section>
      </div>
    </div>
  );
}
