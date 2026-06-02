import { useEffect, useMemo, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ThailandMap } from "../components/map/ThailandMap";
import { getCfSpatialNodes } from "../services/dashboardApi";
import type { FieldCarbonDetail, ProcessActivityBreakdown, SpatialLevel, SpatialSummaryNode } from "../types/dashboard";
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

export function CfSpatialPage() {
  const [nodes, setNodes] = useState<SpatialSummaryNode[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("thailand");
  const [filters, setFilters] = useState<Record<Exclude<SpatialLevel, "country">, string>>({
    region: "",
    province: "",
    district: "",
    subdistrict: "",
    field: "",
  });

  useEffect(() => {
    getCfSpatialNodes()
      .then((result) => {
        setNodes(result.data);
        const root = result.data.find((node) => !node.parentId);
        if (root) setSelectedId(root.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลแผนที่ไม่สำเร็จ"));
  }, []);

  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const diff = selected ? selected.baselineEmission - selected.currentEmission : 0;
  const compare = selected ? nodeCompare(selected) : { baseline: [], current: [] };
  const rootId = nodes.find((node) => !node.parentId)?.id ?? "thailand";

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

        <section className="card">
          <div className="card-title">แผนภูมิแท่ง · เปรียบเทียบปีฐานและปีดำเนินการ</div>
          <ActivityGroupedBar baseline={compare.baseline} current={compare.current} />
        </section>
      </div>
    </div>
  );
}
