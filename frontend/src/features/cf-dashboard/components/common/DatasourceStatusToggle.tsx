import { useEffect, useState } from "react";

const DATASOURCE_STATUS_KEY = "cf-dashboard-show-datasource-status";
const DATASOURCE_STATUS_EVENT = "cf-dashboard-datasource-status-change";

function readDatasourceStatusVisible() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DATASOURCE_STATUS_KEY) === "true";
}

function writeDatasourceStatusVisible(value: boolean) {
  window.localStorage.setItem(DATASOURCE_STATUS_KEY, value ? "true" : "false");
  window.dispatchEvent(new CustomEvent(DATASOURCE_STATUS_EVENT, { detail: value }));
}

export function useDatasourceStatusVisible() {
  const [visible, setVisible] = useState(readDatasourceStatusVisible);

  useEffect(() => {
    const sync = () => setVisible(readDatasourceStatusVisible());
    window.addEventListener(DATASOURCE_STATUS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DATASOURCE_STATUS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return visible;
}

export function DatasourceStatusToggle() {
  const visible = useDatasourceStatusVisible();

  return (
    <button
      type="button"
      className={`datasource-status-toggle${visible ? " active" : ""}`}
      aria-pressed={visible}
      title={visible ? "Hide datasource status" : "Show datasource status"}
      onClick={() => writeDatasourceStatusVisible(!visible)}
    >
      DS
    </button>
  );
}
