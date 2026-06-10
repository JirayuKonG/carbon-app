import React, { Fragment, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import type { CampFieldCarbonDetail, FieldCarbonDetail, SpatialSummaryNode } from "../../types/dashboard";

type BoundaryField = CampFieldCarbonDetail | FieldCarbonDetail;

interface Props {
  nodes: SpatialSummaryNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  boundaryFields?: BoundaryField[];
  selectedBoundaryFieldId?: string;
  onSelectBoundaryField?: (id: string) => void;
}

interface TileLoadState {
  loading: number;
  loaded: number;
  failed: number;
}

function fieldBoundary(field: BoundaryField): LatLngTuple[] {
  const areaRai = Math.max(field.areaRai || 10, 2);
  const sideMeters = Math.sqrt(areaRai * 1600);
  const halfLat = (sideMeters / 2) / 111_320;
  const halfLng = halfLat / Math.max(Math.cos((field.lat * Math.PI) / 180), 0.2);
  return [
    [field.lat - halfLat, field.lng - halfLng],
    [field.lat - halfLat * 0.82, field.lng + halfLng],
    [field.lat + halfLat, field.lng + halfLng * 0.86],
    [field.lat + halfLat * 0.9, field.lng - halfLng * 0.94],
  ];
}

function Recenter({
  node,
  boundaries,
  selectedBoundary,
}: {
  node?: SpatialSummaryNode;
  boundaries: LatLngTuple[][];
  selectedBoundary?: LatLngTuple[];
}) {
  const map = useMap();
  React.useEffect(() => {
    if (selectedBoundary?.length) {
      map.fitBounds(selectedBoundary as LatLngBoundsExpression, { padding: [38, 38], animate: true });
      return;
    }
    if (boundaries.length) {
      map.fitBounds(boundaries.flat() as LatLngBoundsExpression, { padding: [38, 38], animate: true });
      return;
    }
    if (node) map.flyTo([node.lat, node.lng], node.zoom, { duration: 0.8 });
  }, [boundaries, map, node, selectedBoundary]);
  return null;
}

function formatMarkerValue(value: number) {
  if (value >= 1000) return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  return value.toLocaleString(undefined, { maximumFractionDigits: value >= 10 ? 0 : 1 });
}

function carbonDiff(item: Pick<SpatialSummaryNode, "baselineEmission" | "currentEmission">) {
  return item.baselineEmission - item.currentEmission;
}

function getCarbonTier(baseline: number, current: number): "green" | "yellow" | "red" {
  if (!baseline) return "yellow";
  const pctReduction = ((baseline - current) / baseline) * 100;
  if (pctReduction >= 15) return "green";
  if (pctReduction < -5) return "red";
  return "yellow";
}

const TIER_COLORS = {
  green: { border: "#16A34A", fill: "#22C55E", soft: "#DCFCE7", text: "#16803F" },
  yellow: { border: "#CA8A04", fill: "#EAB308", soft: "#FEF9C3", text: "#A16207" },
  red: { border: "#DC2626", fill: "#EF4444", soft: "#FFEDD5", text: "#C2410C" },
};

function carbonMarkerIcon(
  item: Pick<SpatialSummaryNode, "baselineEmission" | "currentEmission" | "fields">,
  options: { selected?: boolean; variant?: "area" | "field" } = {},
) {
  const diff = carbonDiff(item);
  const tier = getCarbonTier(item.baselineEmission, item.currentEmission);
  const { text: color, soft } = TIER_COLORS[tier];
  
  const arrow = diff > 0 ? "↓" : diff < 0 ? "↑" : "→";
  const markerClass = [
    "carbon-location-marker",
    `is-${tier}`,
    options.selected ? "is-selected" : "",
    options.variant === "field" ? "is-field" : "is-area",
  ].filter(Boolean).join(" ");
  return L.divIcon({
    className: "",
    iconSize: [78, 58],
    iconAnchor: [39, 52],
    popupAnchor: [0, -48],
    html: `
      <div class="${markerClass}" style="--carbon-marker-color:${color};--carbon-marker-soft:${soft}">
        <span class="carbon-marker-pin"><i></i></span>
        <span class="carbon-marker-trend">${arrow}</span>
        <span class="carbon-marker-value">${formatMarkerValue(Math.abs(diff))}</span>
        <span class="carbon-marker-count">${item.fields.toLocaleString()} แปลง</span>
      </div>
    `,
  });
}

export function ThailandMap({ nodes, selectedId, onSelect, boundaryFields = [], selectedBoundaryFieldId, onSelectBoundaryField }: Props) {
  const [tileState, setTileState] = useState<TileLoadState>({ loading: 0, loaded: 0, failed: 0 });
  const selected = nodes.find((node) => node.id === selectedId);
  const visibleNodes = useMemo(() => {
    if (!selected || selected.level === "country") return nodes.filter((node) => node.parentId === "thailand");
    const children = nodes.filter((node) => node.parentId === selected.id);
    return children.length ? children : [selected];
  }, [nodes, selected]);
  const fieldBoundaries = useMemo(
    () => boundaryFields.map((field) => ({ field, boundary: fieldBoundary(field) })),
    [boundaryFields],
  );
  const selectedBoundary = fieldBoundaries.find((item) => item.field.id === selectedBoundaryFieldId)?.boundary;
  const showSpatialNodeMarkers = fieldBoundaries.length === 0;
  const totalTiles = tileState.loading + tileState.loaded + tileState.failed;
  const completedTiles = tileState.loaded + tileState.failed;
  const loadPercent = totalTiles ? Math.round((completedTiles / totalTiles) * 100) : 0;
  const isLoadingTiles = tileState.loading > 0 && loadPercent < 100;

  return (
    <div className="map-shell">
    <MapContainer center={[15.5, 101.2]} zoom={6} scrollWheelZoom className="map-canvas">
      <TileLayer
        attribution=""
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          tileloadstart: () => setTileState((state) => ({ ...state, loading: state.loading + 1 })),
          tileload: () => setTileState((state) => ({ ...state, loading: Math.max(state.loading - 1, 0), loaded: state.loaded + 1 })),
          tileerror: () => setTileState((state) => ({ ...state, loading: Math.max(state.loading - 1, 0), failed: state.failed + 1 })),
          loading: () => setTileState({ loading: 0, loaded: 0, failed: 0 }),
        }}
      />
      <Recenter node={selected} boundaries={fieldBoundaries.map((item) => item.boundary)} selectedBoundary={selectedBoundary} />
      {fieldBoundaries.map(({ field, boundary }) => {
        const isSelected = field.id === selectedBoundaryFieldId;
        const tier = getCarbonTier(field.baselineEmission, field.currentEmission);
        return (
          <Fragment key={`boundary-${field.id}`}>
            <Polygon
              positions={boundary}
              pathOptions={{
                color: TIER_COLORS[tier].border,
                fillColor: TIER_COLORS[tier].fill,
                fillOpacity: isSelected ? 0.6 : 0.35,
                weight: isSelected ? 4 : 2,
              }}
              eventHandlers={{ click: () => onSelectBoundaryField?.(field.id) }}
            />
            <Marker
              position={[field.lat, field.lng]}
              icon={carbonMarkerIcon(field, { selected: isSelected, variant: "field" })}
              eventHandlers={{ click: () => onSelectBoundaryField?.(field.id) }}
            >
              <Popup>
                <strong>{field.fieldCode}</strong>
                <br />
                {field.fieldName}
                <br />
                {field.areaRai.toLocaleString()} ไร่ · {("co2eTotal" in field ? field.co2eTotal : field.currentEmission).toLocaleString()} tCO2e
                <br />
                Baseline {field.baselineEmission.toLocaleString()} → Current {field.currentEmission.toLocaleString()} tCO2e
                <br />
                เกษตรกร: {field.farmerName}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
      {showSpatialNodeMarkers && visibleNodes.map((node) => {
        const diff = node.baselineEmission - node.currentEmission;
        const pct = node.baselineEmission ? (diff / node.baselineEmission) * 100 : 0;
        const label = diff >= 0 ? "ลดลง" : "เพิ่มขึ้น";
        return (
          <Marker
            key={node.id}
            position={[node.lat, node.lng]}
            icon={carbonMarkerIcon(node, { selected: node.id === selectedId, variant: "area" })}
            eventHandlers={{ click: () => onSelect(node.id) }}
          >
            <Popup>
              <strong>{node.name}</strong>
              <br />
              {node.fields} แปลง · {node.areaRai.toLocaleString()} ไร่
              <br />
              Baseline {node.baselineEmission.toLocaleString()} → Current {node.currentEmission.toLocaleString()} tCO2e
              <br />
              {label} {Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e ({Math.abs(pct).toFixed(1)}%)
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
      <div className="map-symbol-legend" aria-label="คำอธิบายสัญลักษณ์บนแผนที่">
        <strong>สัญลักษณ์พื้นที่</strong>
        <span><i className="legend-pin" /> ตำแหน่งแปลง/พื้นที่</span>
        <div className="legend-tier-group">
          <span><i className="legend-tier-swatch green" /> ดีเยี่ยม (ลด ≥ 15%)</span>
          <span><i className="legend-tier-swatch yellow" /> ปานกลาง</span>
          <span><i className="legend-tier-swatch red" /> ต้องแก้ไข (เพิ่ม &gt; 5%)</span>
        </div>
        <span><i className="legend-arrow good">↓</i> Carbon ลดลง</span>
        <span><i className="legend-arrow bad">↑</i> Carbon เพิ่มขึ้น</span>
      </div>
      {(isLoadingTiles || tileState.failed > 0) && (
        <div className={`map-loading-overlay ${tileState.failed > 0 && !isLoadingTiles ? "warning" : ""}`}>
          <strong>{tileState.failed > 0 && !isLoadingTiles ? "โหลดแผนที่ไม่ครบ" : "กำลังโหลดแผนที่"}</strong>
          <span>{loadPercent}% · โหลดแล้ว {tileState.loaded.toLocaleString()} / {totalTiles.toLocaleString()} tile{tileState.failed ? ` · ไม่สำเร็จ ${tileState.failed.toLocaleString()}` : ""}</span>
          <div className="map-loading-track"><i style={{ width: `${loadPercent}%` }} /></div>
        </div>
      )}
    </div>
  );
}
