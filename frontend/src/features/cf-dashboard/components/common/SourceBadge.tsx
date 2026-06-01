import type { DataSource, PipelineMeta } from "../../types/dashboard";

interface Props {
  source: DataSource;
  meta?: PipelineMeta;
  loading?: boolean;
}

export function SourceBadge({ source, meta, loading }: Props) {
  return (
    <div className={`source-badge ${source === "api" ? "api" : "mock"}`}>
      <span>{loading ? "Loading" : source === "api" ? "API data" : "Mock fallback"}</span>
      {meta && (
        <>
          <span>{meta.route}</span>
          <span>{meta.rowCount} rows</span>
          {meta.elapsedMs !== undefined && <span>{meta.elapsedMs} ms</span>}
        </>
      )}
    </div>
  );
}
