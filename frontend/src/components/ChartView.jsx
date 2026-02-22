import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell
} from "recharts";

const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"];

const isDate = (value) => {
  return !isNaN(Date.parse(value));
};

const ChartView = ({ data }) => {
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);
  if (keys.length < 2) return null;

  const xKey = keys[0];
  const yKey = keys[1];

  const firstValue = data[0][xKey];

  // Detect chart type
  let chartType = "bar";

  if (isDate(firstValue)) {
    chartType = "line";
  } else if (data.length <= 6) {
    chartType = "pie";
  }

  return (
    <div style={{ width: "100%", height: 350 }}>
      <ResponsiveContainer>

        {chartType === "line" && (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Line dataKey={yKey} stroke="#60a5fa" />
          </LineChart>
        )}

        {chartType === "bar" && (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={yKey} fill="#60a5fa" />
          </BarChart>
        )}

        {chartType === "pie" && (
          <PieChart>
            <Tooltip />
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              outerRadius={120}
              label
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}

      </ResponsiveContainer>
    </div>
  );
};

export default ChartView;