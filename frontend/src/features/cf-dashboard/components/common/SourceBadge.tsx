import type { DataSource, DataSourceStatus, PipelineMeta } from "../../types/dashboard";
import { useDatasourceStatusVisible } from "./DatasourceStatusToggle";

interface Props {
  source: DataSource;
  meta?: PipelineMeta;
  loading?: boolean;
}

export function SourceBadge({ source, meta, loading }: Props) {
  const visible = useDatasourceStatusVisible();
  const status: DataSourceStatus = meta?.datasourceStatus ?? (source === "api" ? "api_real" : "fallback");
  const sourceLabel = status === "api_real"
    ? "API real"
    : status === "api_partial"
    ? "API partial"
    : status === "missing"
    ? "Missing data"
    : "Demo fallback";

  if (!visible) return null;

  return (
    <div className={`source-badge ${status}`}>
      <span>{loading ? "Loading" : sourceLabel}</span>
      {meta && (
        <>
          <span>{meta.route}</span>
          <span>{meta.rowCount} rows</span>
          {meta.note && <span>{meta.note}</span>}
          {meta.elapsedMs !== undefined && <span>{meta.elapsedMs} ms</span>}
        </>
      )}
    </div>
  );
}
