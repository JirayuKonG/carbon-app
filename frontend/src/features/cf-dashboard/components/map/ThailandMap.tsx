import React, { useMemo } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { SpatialSummaryNode } from "../../types/dashboard";

interface Props {
  nodes: SpatialSummaryNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}

function Recenter({ node }: { node?: SpatialSummaryNode }) {
  const map = useMap();
  React.useEffect(() => {
    if (node) map.flyTo([node.lat, node.lng], node.zoom, { duration: 0.8 });
  }, [map, node]);
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

export function ThailandMap({ nodes, selectedId, onSelect }: Props) {
  const selected = nodes.find((node) => node.id === selectedId);
  const visibleNodes = useMemo(() => {
    if (!selected || selected.level === "country") return nodes.filter((node) => node.parentId === "thailand");
    const children = nodes.filter((node) => node.parentId === selected.id);
    return children.length ? children : [selected];
  }, [nodes, selected]);

  return (
    <MapContainer center={[15.5, 101.2]} zoom={6} scrollWheelZoom className="map-canvas">
      <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter node={selected} />
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
