"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

/**
 * Single-series charts: no legend (the card title names the measure), one
 * validated hue (brand teal #0e8f80, passes all checks on white), hairline
 * solid grid, 2px line with a 10% wash, bars <= 24px with 4px rounded ends.
 */
const SERIES = "#0e8f80";

export interface ChartPoint {
  label: string;
  revenue: number; // rupees
  orders: number;
}

const compactINR = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const fullINR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function ValueTooltip({ active, payload, label, kind }: { active?: boolean; payload?: ReadonlyArray<{ value?: unknown }>; label?: unknown; kind: "revenue" | "orders" }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-sm font-semibold text-brand-ink tabular-nums">{kind === "revenue" ? fullINR.format(value) : `${value} order${value === 1 ? "" : "s"}`}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES }} aria-hidden />
        {String(label ?? "")}
      </p>
    </div>
  );
}

const revenueConfig = { revenue: { label: "Net sales", color: SERIES } } satisfies ChartConfig;
const ordersConfig = { orders: { label: "Orders", color: SERIES } } satisfies ChartConfig;

export function RevenueChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartContainer config={revenueConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#e1ebe6" strokeWidth={1} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
        <YAxis width={56} tickLine={false} axisLine={false} tickMargin={4} tickFormatter={(v: number) => `₹${compactINR.format(v)}`} allowDecimals={false} />
        <Tooltip cursor={{ stroke: "#9fb5ab", strokeWidth: 1 }} content={(props) => <ValueTooltip active={props.active} payload={props.payload} label={props.label} kind="revenue" />} />
        <Area dataKey="revenue" type="monotone" stroke={SERIES} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={SERIES} fillOpacity={0.1} activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2, fill: SERIES }} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}

export function OrdersChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartContainer config={ordersConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#e1ebe6" strokeWidth={1} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
        <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={4} />
        <Tooltip cursor={{ fill: "#eef7f3" }} content={(props) => <ValueTooltip active={props.active} payload={props.payload} label={props.label} kind="orders" />} />
        <Bar dataKey="orders" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
