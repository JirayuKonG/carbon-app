import React, { Fragment, useMemo } from "react";
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

function markerIcon(node: SpatialSummaryNode) {
  const diff = node.baselineEmission - node.currentEmission;
  const good = diff >= 0;
  const color = good ? "#277B27" : "#BA0900";
  const arrow = good ? "↓" : "↑";
  return L.divIcon({
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="width:38px;height:38px;border-radius:50%;border:2px solid ${color};background:#fff;color:${color};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;box-shadow:0 6px 16px ${color}55">${arrow}</div>`,
  });
}

export function ThailandMap({ nodes, selectedId, onSelect, boundaryFields = [], selectedBoundaryFieldId, onSelectBoundaryField }: Props) {
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

  return (
    <MapContainer center={[15.5, 101.2]} zoom={6} scrollWheelZoom className="map-canvas">
      <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter node={selected} boundaries={fieldBoundaries.map((item) => item.boundary)} selectedBoundary={selectedBoundary} />
      {fieldBoundaries.map(({ field, boundary }) => {
        const isSelected = field.id === selectedBoundaryFieldId;
        return (
          <Fragment key={`boundary-${field.id}`}>
            <Polygon
              positions={boundary}
              pathOptions={{
                color: isSelected ? "#16A34A" : "#2563EB",
                fillColor: isSelected ? "#22C55E" : "#60A5FA",
                fillOpacity: isSelected ? 0.28 : 0.16,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{ click: () => onSelectBoundaryField?.(field.id) }}
            />
            <Marker position={[field.lat, field.lng]} eventHandlers={{ click: () => onSelectBoundaryField?.(field.id) }}>
              <Popup>
                <strong>{field.fieldCode}</strong>
                <br />
                {field.fieldName}
                <br />
                {field.areaRai.toLocaleString()} ไร่ · {("co2eTotal" in field ? field.co2eTotal : field.currentEmission).toLocaleString()} tCO2e
                <br />
                เกษตรกร: {field.farmerName}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
      {visibleNodes.map((node) => {
        const diff = node.baselineEmission - node.currentEmission;
        const pct = node.baselineEmission ? (diff / node.baselineEmission) * 100 : 0;
        const label = diff >= 0 ? "ลดลง" : "เพิ่มขึ้น";
        return (
          <Marker
            key={node.id}
            position={[node.lat, node.lng]}
            icon={markerIcon(node)}
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
  );
}
