import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

export const chartColors = [
  "#f69988",
  "#f8bbd0",
  "#ce93d8",
  "#b39ddb",
  "#9fa8da",
  "#b3e5fc",
  "#b2ebf2",
  "#c5e1a5",
  "#fff59d",
  "#ffcc80",
  "#d7ccc8",
  "#b0bec5",
];

export const chartPalette = {
  baseline: { bg: "rgba(175,191,255,.78)", border: "#7986cb" },
  project: { bg: "rgba(246,153,136,.78)", border: "#f36c60" },
  fertilizerBaseline: { bg: "rgba(209,196,233,.72)", border: "#b39ddb" },
  fertilizerProject: { bg: "rgba(248,187,208,.76)", border: "#f48fb1" },
  fuelBaseline: { bg: "rgba(179,229,252,.72)", border: "#81d4fa" },
  fuelProject: { bg: "rgba(178,235,242,.76)", border: "#80deea" },
  trendBaseline: "#afbfff",
  trendAverage: "#ce93d8",
  trendProject: "#f69988",
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
        boxWidth: 10,
        font: { size: 11 },
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
      ticks: { color: "#5B728A" },
      grid: { color: "rgba(180,200,220,0.25)" },
    },
    y: {
      ticks: { color: "#5B728A" },
      grid: { color: "rgba(180,200,220,0.25)" },
    },
  },
};
