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

export const chartColors = ["#5BA4FF", "#72D6C9", "#B79CFF", "#FFB86B", "#FF8FA3"];

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
