import { useEffect, useState } from "react";
import type { DataResult } from "../types/dashboard";

export function useAsyncData<T>(loader: () => Promise<DataResult<T>>, fallback: T, deps: ReadonlyArray<unknown> = []) {
  const [result, setResult] = useState<DataResult<T>>({ data: fallback, source: "api" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setResult({
            data: fallback,
            source: "api",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...result, loading };
}
