// Thin Chart.js wrappers: destroy-before-recreate (so repeated view
// activation never leaks canvases/tooltips) + a shared, dataviz-skill
// validated color palette.
const chartInstances = new Map(); // canvasId -> Chart instance

export const PALETTE = {
  blue: "#2a78d6",
  green: "#008300",
  magenta: "#e87ba4",
  yellow: "#eda100",
  aqua: "#1baf7a",
  orange: "#eb6834",
  violet: "#4a3aa7",
  red: "#e34948",
  gridline: "#e1e0d9",
  axis: "#c3c2b7",
  mutedText: "#898781",
  ink: "#0b0b0b",
};

export function destroyChart(canvasId) {
  const existing = chartInstances.get(canvasId);
  if (existing) {
    existing.destroy();
    chartInstances.delete(canvasId);
  }
}

export function destroyAllCharts() {
  for (const id of Array.from(chartInstances.keys())) destroyChart(id);
}

function register(canvasId, chart) {
  destroyChart(canvasId);
  chartInstances.set(canvasId, chart);
  return chart;
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: PALETTE.ink, usePointStyle: true, boxWidth: 8 } },
      tooltip: { backgroundColor: "#202942", padding: 10, cornerRadius: 6 },
    },
    scales: {
      x: { grid: { color: PALETTE.gridline }, ticks: { color: PALETTE.mutedText } },
      y: { grid: { color: PALETTE.gridline }, ticks: { color: PALETTE.mutedText }, beginAtZero: true },
    },
  };
}

export function createLineChart(canvasId, { labels, datasets }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;
  const opts = baseOptions();
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: datasets.map((d) => ({
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        fill: false,
        backgroundColor: d.color,
        borderColor: d.color,
        ...d,
      })),
    },
    options: {
      ...opts,
      plugins: { ...opts.plugins, legend: { ...opts.plugins.legend, display: datasets.length > 1 } },
    },
  });
  return register(canvasId, chart);
}

export function createBarChart(canvasId, { labels, datasets, horizontal = false, stacked = false }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;
  const opts = baseOptions();
  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d) => ({ borderRadius: 4, borderSkipped: false, backgroundColor: d.color, ...d })),
    },
    options: {
      ...opts,
      indexAxis: horizontal ? "y" : "x",
      plugins: { ...opts.plugins, legend: { ...opts.plugins.legend, display: datasets.length > 1 } },
      scales: {
        x: { ...opts.scales.x, stacked },
        y: { ...opts.scales.y, stacked, beginAtZero: true },
      },
    },
  });
  return register(canvasId, chart);
}
