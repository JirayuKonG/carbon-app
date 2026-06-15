import {
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

export const chartColors = [
  "#FCA5A5",
  "#86EFAC",
  "#FDE68A",
  "#93C5FD",
  "#FDBA74",
  "#67E8F9",
  "#C4B5FD",
  "#BEF264",
  "#F9A8D4",
  "#A7F3D0",
  "#FCD34D",
  "#BFDBFE",
];

export const chartPalette = {
  baseline: { bg: "rgba(147,197,253,.82)", border: "#2563EB" },
  project: { bg: "rgba(252,165,165,.82)", border: "#DC2626" },
  fertilizerBaseline: { bg: "rgba(134,239,172,.78)", border: "#16A34A" },
  fertilizerProject: { bg: "rgba(253,230,138,.86)", border: "#D97706" },
  fuelBaseline: { bg: "rgba(103,232,249,.78)", border: "#0891B2" },
  fuelProject: { bg: "rgba(253,186,116,.82)", border: "#EA580C" },
  trendBaseline: "#60A5FA",
  trendAverage: "#16A34A",
  trendProject: "#F87171",
};

export function sortProcessLabels(labels: string[]) {
  return [...labels].sort((a, b) => {
    const aOrder = Number(a.match(/^(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const bOrder = Number(b.match(/^(\d+)/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b, "th");
  });
}

export const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#5B728A",
        boxWidth: 12,
        boxHeight: 12,
        font: { size: 12 },
      },
    },
    tooltip: {
      backgroundColor: "#FFFFFF",
      titleColor: "#233142",
      bodyColor: "#5B728A",
      borderColor: "#D9E7F2",
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: "#5B728A", autoSkip: false, maxRotation: 0 },
      grid: { color: "rgba(180,200,220,0.25)" },
    },
    y: {
      ticks: { color: "#5B728A" },
      grid: { color: "rgba(180,200,220,0.25)" },
    },
  },
};
