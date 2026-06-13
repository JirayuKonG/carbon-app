import type { DataSource, PipelineMeta } from "../../types/dashboard";

interface Props {
  source: DataSource;
  meta?: PipelineMeta;
  loading?: boolean;
}

export function SourceBadge({ source, meta, loading }: Props) {
  const sourceLabel = source === "api" ? "API data" : "ไร่จริง + คำนวณสมมุติ";

  return (
    <div className={`source-badge ${source === "api" ? "api" : "mock"}`}>
      <span>{loading ? "Loading" : sourceLabel}</span>
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
