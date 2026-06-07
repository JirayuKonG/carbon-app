import type { BenchmarkResult } from "../types/pipeline";

const BASE = import.meta.env.VITE_CF_API_URL ?? "http://localhost:8000/api";
const FALLBACK = "http://127.0.0.1:8001/api";

async function request<T>(base: string, path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const opts: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  try {
    return await request<T>(BASE, path, opts);
  } catch {
    return request<T>(FALLBACK, path, opts);
  }
}

async function get<T>(path: string): Promise<T> {
  const opts: RequestInit = { method: "GET" };
  try {
    return await request<T>(BASE, path, opts);
  } catch {
    return request<T>(FALLBACK, path, opts);
  }
}

export interface AllBenchmarkResult {
  scenarios: Record<string, BenchmarkResult & { scenario?: string }>;
  avg_speedup_x: number;
  summary: string;
}

export const runBenchmark = (scenario: string, runs = 5) =>
  post<BenchmarkResult>("/benchmark/run", { scenario, runs });

export const runAllBenchmarks = (runs = 3) =>
  get<AllBenchmarkResult>(`/benchmark/all?runs=${runs}`);
