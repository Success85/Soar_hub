"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const NAVY = "#1d3d6b";
const GRID = "#e5dfcf";
const MUTED = "#4f5b6d";

function TableView({ rows, x, y }: { rows: Record<string, string | number>[]; x: string; y: string }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-semibold text-royal-700">Show data table</summary>
      <table className="mt-2 w-full text-left">
        <thead><tr><th className="py-1 pr-4">{x}</th><th className="py-1">{y}</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line"><td className="py-1 pr-4">{r.label}</td><td className="py-1">{r.value}</td></tr>)}</tbody>
      </table>
    </details>
  );
}

/** Single-series trend (one hue; title names the series, so no legend). */
export function TrendChart({ data, label }: { data: { day: string; count: number }[]; label: string }) {
  const rows = data.map((d) => ({ label: d.day, value: d.count }));
  return (
    <div>
      <div className="h-56" role="img" aria-label={`${label} per day`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: MUTED }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ stroke: MUTED, strokeDasharray: "3 3" }} contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 12 }} formatter={(v) => [v, label]} />
            <Area type="monotone" dataKey="count" stroke={NAVY} strokeWidth={2} fill={NAVY} fillOpacity={0.12} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TableView rows={rows} x="Day" y={label} />
    </div>
  );
}

/** Horizontal bars: category labels on the axis carry identity; one hue. */
export function CategoryBars({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No data yet.</p>;
  return (
    <div>
      <div style={{ height: Math.max(120, data.length * 40) }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barCategoryGap={8}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: "#0b1f3a" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "#f1ecdf" }} contentStyle={{ borderRadius: 8, borderColor: GRID, fontSize: 12 }} formatter={(v) => [v, label]} />
            <Bar dataKey="value" fill={NAVY} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fontSize: 11, fill: MUTED }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView rows={data} x="Category" y={label} />
    </div>
  );
}
