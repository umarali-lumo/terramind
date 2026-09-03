"use client";

/** Reusable Recharts wrappers for farm intelligence visualisations. */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ForecastHour, TrendPoint } from "@/lib/types";

const GRID_COLOR = "#1c4a32";
const AXIS_COLOR = "#7dab8e";

const tooltipStyle = {
  backgroundColor: "#0e2a1d",
  border: "1px solid #275c3f",
  borderRadius: "12px",
  color: "#e4f3ea",
  fontSize: "12px",
  padding: "8px 12px",
} as const;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric" });
}

/** 30-day health score trend with optimal band. */
export function HealthTrendChart({ points, height = 240 }: { points: TrendPoint[]; height?: number }) {
  const data = points.map((p) => ({
    ...p,
    day: dayLabel(p.recorded_at),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#a3c9b2" }}
          formatter={(value) => [`${Number(value ?? 0).toFixed(0)} / 100`, "Health"] as [string, string]}
        />
        <Area
          type="monotone"
          dataKey="health_score"
          stroke="#4ade80"
          strokeWidth={2}
          fill="url(#healthFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#4ade80" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Multi-metric trend: soil moisture (%) and air temperature (°C). */
export function ConditionsTrendChart({ points, height = 240 }: { points: TrendPoint[]; height?: number }) {
  const data = points.map((p) => ({
    ...p,
    day: dayLabel(p.recorded_at),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#a3c9b2" }}
          formatter={(value, name) => {
            const label = name === "Soil moisture" ? "Soil moisture" : "Air temperature";
            const text =
              name === "Soil moisture"
                ? `${Number(value ?? 0).toFixed(0)}%`
                : `${Number(value ?? 0).toFixed(1)}°C`;
            return [text, label] as [string, string];
          }}
        />
        <Line
          type="monotone"
          dataKey="soil_moisture"
          name="Soil moisture"
          stroke="#5ba8f5"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="air_temperature"
          name="Air temperature"
          stroke="#f5b942"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Hourly forecast: temperature line + rain probability bars. */
export function HourlyForecastChart({ hours, height = 240 }: { hours: ForecastHour[]; height?: number }) {
  const data = hours.map((h) => ({
    ...h,
    hour: hourLabel(h.time),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#a3c9b2" }}
          formatter={(value, name) => {
            if (name === "Temperature") {
              return [`${Number(value ?? 0).toFixed(0)}°C`, "Temperature"] as [string, string];
            }
            if (name === "Rain chance") {
              return [`${Number(value ?? 0).toFixed(0)}%`, "Rain chance"] as [string, string];
            }
            return [`${Number(value ?? 0).toFixed(1)} mm`, String(name)] as [string, string];
          }}
        />
        <Line
          type="monotone"
          dataKey="temperature"
          name="Temperature"
          stroke="#f5b942"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="rain_probability"
          name="Rain chance"
          stroke="#5ba8f5"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Top-3 disease prediction confidence bars. */
export function PredictionBars({
  predictions,
}: {
  predictions: { label: string; disease: string; confidence: number }[];
}) {
  const data = predictions.map((p) => ({
    name: p.disease,
    confidence: Number(p.confidence.toFixed(1)),
  }));
  const colors = ["#4ade80", "#7dab8e", "#5f8d72"];

  return (
    <ResponsiveContainer width="100%" height={26 * data.length + 8}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={128}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(28, 74, 50, 0.25)" }}
          formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Confidence"] as [string, string]}
        />
        <Bar dataKey="confidence" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
