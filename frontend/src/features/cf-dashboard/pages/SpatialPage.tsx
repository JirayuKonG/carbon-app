import { useEffect, useMemo, useState } from "react";
import { ActivityGroupedBar } from "../components/charts/ActivityGroupedBar";
import { ProcessDoughnut } from "../components/charts/ProcessDoughnut";
import { ThailandMap } from "../components/map/ThailandMap";
import { getCfSpatialNodes } from "../services/dashboardApi";
import type { FieldCarbonDetail, ProcessActivityBreakdown, SpatialSummaryNode } from "../types/dashboard";
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
  const children = selected ? nodes.filter((node) => node.parentId === selected.id) : [];
  const siblings = selected?.parentId ? nodes.filter((node) => node.parentId === selected.parentId) : [];
  const pickerNodes = children.length ? children : siblings;
  const diff = selected ? selected.baselineEmission - selected.currentEmission : 0;
  const compare = selected ? nodeCompare(selected) : { baseline: [], current: [] };

  const breadcrumbs = useMemo(() => {
    const list: SpatialSummaryNode[] = [];
    let cur: SpatialSummaryNode | undefined = selected;
    while (cur) {
      list.unshift(cur);
      cur = cur.parentId ? nodes.find((node) => node.id === cur?.parentId) : undefined;
    }
    return list;
  }, [nodes, selected]);

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
          <div className="region-pills">
            <button className="ytab" onClick={() => setSelectedId(nodes.find((node) => !node.parentId)?.id ?? "thailand")}>
              ทั้งประเทศ
            </button>
            {pickerNodes.map((node) => (
              <button key={node.id} className={`ytab ${node.id === selected.id ? "active" : ""}`} onClick={() => setSelectedId(node.id)}>
                {node.name}
              </button>
            ))}
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
