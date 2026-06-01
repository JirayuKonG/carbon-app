import { useState } from "react";
import { useBenchmark } from "./usePipeline";
import type { BenchmarkResult } from "../types/pipeline";

const SCENARIOS = [
  { id: "kpi",      label: "BM1 · KPI Summary",       desc: "Smart Cache vs Gold JOIN (5 tables)" },
  { id: "province", label: "BM2 · Province Map",       desc: "Retrieval Dataset vs Gold JOIN" },
  { id: "spatial",  label: "BM3 · Spatial Drill-down", desc: "Spatial Index vs Gold JOIN" },
  { id: "process",  label: "BM4 · Process Breakdown",  desc: "Metadata Optimization vs Gold JOIN" },
];

function SpeedupPill({ x }: { x: number }) {
  const cls = x >= 5 ? "fast" : x >= 2 ? "medium" : "slow";
  return <span className={`bm-speedup-pill ${cls}`}>{x.toFixed(1)}x</span>;
}

function StatRows({ stats, label }: { stats: BenchmarkResult["without_pipeline"]; label: string }) {
  return (
    <div className="benchmark-card">
      <h3>{label}</h3>
      {([["avg_ms", "Average"], ["min_ms", "Minimum"], ["max_ms", "Maximum"], ["mem_kb", "Memory Peak"]] as const).map(
        ([key, name]) => (
          <div className="stat-row" key={key}>
            <span>{name}</span>
            <strong>{stats[key].toFixed(3)} {key === "mem_kb" ? "KB" : "ms"}</strong>
          </div>
        ),
      )}
    </div>
  );
}

export function BenchmarkPanel() {
  const [selected, setSelected] = useState("kpi");
  const [runs, setRuns] = useState(5);
  const { result, allResult, loading, progress, elapsed, mode, error, run, runAll } = useBenchmark();

  const scenario = SCENARIOS.find((s) => s.id === selected)!;
  const pct = Math.min(progress, 100).toFixed(0);

  function fmtElapsed(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${(s % 60).toFixed(1)}s`;
  }

  return (
    <div className="benchmark-panel">
      {/* Toolbar */}
      <div className="benchmark-toolbar">
        <div className="scenario-tabs">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`scenario-btn ${selected === s.id ? "active" : ""}`}
              onClick={() => setSelected(s.id)}
              disabled={loading}
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="runs-control">
          <span>Runs</span>
          <input
            type="number"
            min={1}
            max={100000}
            value={runs}
            onChange={(e) => setRuns(Math.max(1, Math.min(100000, Number(e.target.value))))}
            disabled={loading}
          />
        </label>

        <button className="run-btn" disabled={loading} onClick={() => run(selected, runs)}>
          {loading && mode === "single" ? "Running…" : "▶ Run"}
        </button>

        <button className="run-all-btn" disabled={loading} onClick={() => runAll(runs)}>
          {loading && mode === "all" ? "Running All…" : "⚡ Run All Scenarios"}
        </button>
      </div>

      {/* Scenario description */}
      {!loading && <div className="scenario-desc">{scenario.desc}</div>}

      {/* Progress bar */}
      {loading && (
        <div>
          <div className="progress-wrap">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-label">
            {mode === "all" ? "Running all 4 scenarios…" : `Running ${runs} iterations…`}
            &nbsp;{pct}%
            <span className="countdown">&nbsp;· {fmtElapsed(elapsed)}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-panel">⚠ {error} — FastAPI server ต้องรันที่ localhost:8000</div>}

      {/* ── Single scenario result ── */}
      {result && mode === "single" && !loading && (
        <div className="benchmark-result">
          <div className="speedup-card">
            <div>
              <span className="metric-label">Speedup</span>
              <strong>{result.speedup_x}x</strong>
            </div>
            <div>
              <span className="metric-label">Saved per request</span>
              <strong>{result.saved_ms.toFixed(1)} ms</strong>
            </div>
          </div>

          <div className="benchmark-grid">
            <StatRows stats={result.without_pipeline} label="Without Pipeline (Gold JOIN)" />
            <StatRows stats={result.with_pipeline} label="With Optimized Retrieval" />
          </div>

          <div className="interpretation">{result.interpretation}</div>
        </div>
      )}

      {/* ── All scenarios result ── */}
      {allResult && mode === "all" && !loading && (
        <div className="bm-summary">
          {/* Average speedup badge */}
          <div>
            <div className="bm-avg-badge">
              <span>เฉลี่ย</span>
              <span>{allResult.avg_speedup_x.toFixed(1)}x</span>
              <span style={{ fontSize: 13, fontWeight: 400 }}>เร็วกว่า Raw Gold Query</span>
            </div>
          </div>

          {/* Summary table — like notebook output */}
          <table className="bm-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Without (ms)</th>
                <th>With (ms)</th>
                <th>Saved (ms)</th>
                <th>Speedup</th>
                <th>Mem Without (KB)</th>
                <th>Mem With (KB)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(allResult.scenarios).map(([key, r]) => {
                const s = SCENARIOS.find((sc) => sc.id === key);
                return (
                  <tr key={key}>
                    <td>{s?.label ?? key}</td>
                    <td className="mono">{r.without_pipeline.avg_ms.toFixed(3)}</td>
                    <td className="mono">{r.with_pipeline.avg_ms.toFixed(3)}</td>
                    <td className="mono">{r.saved_ms.toFixed(3)}</td>
                    <td><SpeedupPill x={r.speedup_x} /></td>
                    <td className="mono">{r.without_pipeline.mem_kb.toFixed(2)}</td>
                    <td className="mono">{r.with_pipeline.mem_kb.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Per-scenario speedup cards */}
          <div className="bm-scenario-cards">
            {Object.entries(allResult.scenarios).map(([key, r]) => {
              const s = SCENARIOS.find((sc) => sc.id === key);
              return (
                <div className="bm-scenario-card" key={key}>
                  <h4>{s?.label ?? key}</h4>
                  <div className="big-speedup">{r.speedup_x.toFixed(1)}x</div>
                  <div className="sub">ประหยัด {r.saved_ms.toFixed(1)} ms/request</div>
                  <div className="sub" style={{ marginTop: 6 }}>
                    {r.without_pipeline.avg_ms.toFixed(1)} ms → {r.with_pipeline.avg_ms.toFixed(1)} ms
                  </div>
                </div>
              );
            })}
          </div>

          <div className="interpretation">{allResult.summary}</div>
        </div>
      )}

      {/* Empty state */}
      {!result && !allResult && !loading && !error && (
        <div className="empty-state">
          กด <strong>▶ Run</strong> เพื่อทดสอบ scenario เดียว หรือ <strong>⚡ Run All Scenarios</strong> เพื่อรันทั้ง 4 scenario พร้อมกัน
          และพิสูจน์ว่า Intelligent Retrieval Pipeline เร็วกว่า Raw Gold Query
        </div>
      )}
    </div>
  );
}
