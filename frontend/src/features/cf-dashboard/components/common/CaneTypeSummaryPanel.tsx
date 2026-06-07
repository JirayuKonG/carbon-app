import type { CaneTypeSummary, DataResult } from "../../types/dashboard";
import { SourceBadge } from "./SourceBadge";

const caneColors = ["#5BA4FF", "#72D6C9", "#FFB86B"];

function formatRai(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatCredit(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function CaneTypeSummaryPanel({
  result,
  showSource = true,
  creditTotal,
  mode = "area",
}: {
  result: DataResult<CaneTypeSummary[]>;
  showSource?: boolean;
  creditTotal?: number;
  mode?: "area" | "footprint";
}) {
  const totalArea = result.data.reduce((sum, item) => sum + item.areaRai, 0);
  const totalCo2e = result.data.reduce((sum, item) => sum + (item.co2eTotal ?? 0), 0);
  const showCreditBreakdown = creditTotal != null;
  const showFootprintBreakdown = mode === "footprint" && !showCreditBreakdown;
  const byName = new Map(result.data.map((item) => [item.name, item]));
  const planted = byName.get("อ้อยปลูก");
  const ratoon = byName.get("อ้อยตอ");
  const fallow = byName.get("พื้นที่พักดิน");
  const valueFor = (item?: CaneTypeSummary) => showFootprintBreakdown ? (item?.co2eTotal ?? 0) : (item?.areaRai ?? 0);
  const unitLabel = showFootprintBreakdown ? "tCO2e" : "ไร่";

  return (
    <section className="card full-span cane-summary-panel">
      <div className="card-title-row">
        <div>
          <div className="card-title">สัดส่วนประเภทอ้อยและพื้นที่พักดิน</div>
          <p className="muted">
            {showCreditBreakdown
              ? "สรุปจำนวนไร่และเครดิตที่คาดว่าจะได้ตามประเภทอ้อย โดยคิดตามสัดส่วนพื้นที่โครงการ"
              : showFootprintBreakdown
              ? "สรุปปริมาณ Carbon Footprint ตามประเภทอ้อยและพื้นที่พักดิน"
              : "สรุปพื้นที่ตามประเภทอ้อยจากข้อมูลกิจกรรม เพื่อดูสัดส่วนที่ใช้ประกอบคาร์บอนเครดิตและคาร์บอนฟุตพริ้นท์"}
          </p>
        </div>
        {showSource && <SourceBadge source={result.source} meta={result.meta} />}
      </div>

      <div className="cane-kpi-grid">
        <div><strong>{formatRai(valueFor(planted))}</strong><span>{unitLabel} อ้อยปลูก · {planted?.percent.toFixed(1) ?? "0.0"}%</span></div>
        <div><strong>{formatRai(valueFor(ratoon))}</strong><span>{unitLabel} อ้อยตอ · {ratoon?.percent.toFixed(1) ?? "0.0"}%</span></div>
        <div><strong>{formatRai(valueFor(fallow))}</strong><span>{unitLabel} พื้นที่พักดิน · {fallow?.percent.toFixed(1) ?? "0.0"}%</span></div>
        <div><strong>{formatRai(showFootprintBreakdown ? totalCo2e : totalArea)}</strong><span>{showFootprintBreakdown ? "tCO2e รวม" : "ไร่รวม"}</span></div>
      </div>

      <div className="cane-share-bar" aria-label="สัดส่วนประเภทอ้อย">
        {result.data.map((item, index) => (
          <span
            key={item.name}
            style={{ width: `${item.percent}%`, background: caneColors[index % caneColors.length] }}
            title={`${item.name} ${item.percent.toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="cane-legend-grid">
        {result.data.map((item, index) => (
          <div key={item.name}>
            <span className="legend-swatch" style={{ background: caneColors[index % caneColors.length] }} />
            <strong>{item.name}</strong>
            <small>
              {showCreditBreakdown
                ? `เครดิตที่คาดว่าจะได้ ${formatCredit((creditTotal ?? 0) * (item.percent / 100))} tCO2e`
                : showFootprintBreakdown
                ? `Carbon Footprint ${formatCredit(item.co2eTotal ?? 0)} tCO2e · ${item.percent.toFixed(1)}%`
                : `${formatRai(item.areaRai)} ไร่ · ${item.percent.toFixed(1)}%${item.co2eTotal != null ? ` · ${item.co2eTotal.toLocaleString()} tCO2e` : ""}`}
            </small>
          </div>
        ))}
      </div>

      {!result.data.length && <div className="empty-state">ยังไม่มีข้อมูลประเภทอ้อยสำหรับสรุป</div>}
      {!showCreditBreakdown && totalCo2e > 0 && (
        <div className="cane-total-note">
          Carbon รวมตามประเภทอ้อย {totalCo2e.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO2e
        </div>
      )}
    </section>
  );
}
