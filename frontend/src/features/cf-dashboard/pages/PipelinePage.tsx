import { BenchmarkPanel } from "../benchmark/BenchmarkPanel";
import "../cf-dashboard.css";

const offlineFlow = [
  "Gold Layer",
  "Batch Transformation",
  "Retrieval Query Dataset",
  "Batch Optimization",
  "Optimization Assets",
];

const onlineFlow = [
  "Query Analysis",
  "Strategy Selector",
  "Retrieval Execution",
  "Result Construction",
  "Result Delivery",
  "Feedback Loop",
];

const techniques = [
  "Metadata & Transactional Layer",
  "Retrieval Optimization (Batch Assets)",
  "Advanced Retrieval for DS & ML",
  "Fine-Grained Structured Retrieval (R2D2)",
  "Spatial Data Retrieval",
];

export function CfPipelinePage() {
  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="page-title">
          <div>
            <p className="eyebrow">04 · Pipeline Proof</p>
            <h1>Intelligent Retrieval Framework สำหรับ Carbon Footprint Analytics</h1>
          </div>
        </div>

        <section className="architecture-board">
          <div className="flow-column offline">
            <h2>Offline Flow · Data Preparation & Optimization</h2>
            <div className="flow-chain">
              {offlineFlow.map((step, index) => (
                <div className="architecture-step" key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="flow-column online">
            <h2>Online Flow · Runtime Query & Retrieval</h2>
            <div className="flow-chain">
              {onlineFlow.map((step, index) => (
                <div className="architecture-step" key={step}>
                  <span>{index + 6}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="technique-panel">
            <h2>Techniques</h2>
            {techniques.map((technique, index) => (
              <div className="technique-row" key={technique}>
                <span>{index + 1}</span>
                <strong>{technique}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="grid2">
          <article className="card">
            <div className="card-title">Algorithm selection</div>
            <div className="algorithm-list">
              <div><strong>1. Query Analysis</strong><span>อ่าน dashboard intent, filter, spatial level, repeated query</span></div>
              <div><strong>2. Strategy Selector</strong><span>เลือก Smart Cache, Spatial Indexing, Z-Ordering หรือ Table Slicing</span></div>
              <div><strong>3. Retrieval Execution</strong><span>route ไปยัง optimization assets หรือ fallback ไป Gold scan</span></div>
              <div><strong>4. Result Construction</strong><span>ประกอบ data + metadata + performance ให้ frontend แสดงผล</span></div>
            </div>
          </article>
          <article className="card">
            <div className="card-title">Proof objective</div>
            <p className="muted">
              หน้านี้สรุปว่าวิธีของงานนี้ดีกว่าการ query ฐานข้อมูลทั่วไป เพราะระบบเลือกเทคนิคที่เหมาะสมกับแต่ละ dashboard โดยอัตโนมัติ และส่ง metadata ให้ตรวจสอบได้ว่าใช้ route/technique ใด
            </p>
          </article>
        </section>

        <section className="card">
          <div className="card-title">Pipeline Benchmark</div>
          <BenchmarkPanel />
        </section>
      </div>
    </div>
  );
}
