import { useState, useCallback, useRef } from "react";
import { runBenchmark, runAllBenchmarks } from "./apiClient";
import type { AllBenchmarkResult } from "./apiClient";
import type { BenchmarkResult } from "../types/pipeline";

export type BenchmarkMode = "single" | "all";

export function useBenchmark() {
  const [result, setResult]       = useState<BenchmarkResult | null>(null);
  const [allResult, setAllResult] = useState<AllBenchmarkResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);    // 0–100
  const [elapsed, setElapsed]     = useState(0);    // ms since start
  const [mode, setMode]           = useState<BenchmarkMode>("single");
  const [error, setError]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  function startProgress() {
    setProgress(0);
    setElapsed(0);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startRef.current;
      setElapsed(ms);
      // fill up to 90% over first estimate window, then crawl to 99%
      setProgress((prev) => (prev >= 90 ? Math.min(99, prev + 0.02) : Math.min(90, prev + 1)));
    }, 80);
  }

  function finishProgress() {
    clearInterval(timerRef.current!);
    setElapsed(Date.now() - startRef.current);
    setProgress(100);
  }

  const run = useCallback(async (scenario: string, runs = 5) => {
    setLoading(true);
    setError(null);
    setAllResult(null);
    setMode("single");
    startProgress();
    try {
      const res = await runBenchmark(scenario, runs);
      setResult(res);
      finishProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark failed");
      setProgress(0);
      setElapsed(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAll = useCallback(async (runs = 3) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMode("all");
    startProgress();
    try {
      const res = await runAllBenchmarks(runs);
      setAllResult(res);
      finishProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark failed");
      setProgress(0);
      setElapsed(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, allResult, loading, progress, elapsed, mode, error, run, runAll };
}
