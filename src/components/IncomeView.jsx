import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, IndianRupee, TrendingUp, TrendingDown, Minus } from "lucide-react";

function dateStrFromTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday-start calendar week containing `date`
function weekRange(date) {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = addDays(d, diffToMonday);
  const end = addDays(start, 7); // exclusive
  return { start, end };
}

function monthRange(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

function statsForRange(patients, start, end) {
  let count = 0;
  let income = 0;
  let mr = 0;
  let cash = 0;
  let upi = 0;
  let card = 0;
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      if (v.ts >= start.getTime() && v.ts < end.getTime()) {
        count += 1;
        income += v.cost || 0;
        mr += v.mr_commission || 0;
        if (v.payment_mode === "upi") upi += v.cost || 0;
        else if (v.payment_mode === "card") card += v.cost || 0;
        else cash += v.cost || 0;
      }
    });
  });
  return { count, income, mr, profit: income - mr, cash, upi, card };
}

function dailySeries(patients, start, days) {
  const map = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    map[dateStrFromTs(d.getTime())] = 0;
  }
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      const key = dateStrFromTs(v.ts);
      if (key in map) map[key] += v.cost || 0;
    });
  });
  return Object.entries(map).map(([date, income]) => ({
    label: new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    income,
  }));
}

function Delta({ current, previous }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: "#0A5C5499" }}>
        <Minus size={11} /> no change
      </span>
    );
  }
  if (previous === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: "#148A7A" }}>
        <TrendingUp size={11} /> new
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span
      className="flex items-center gap-0.5 text-[11px] font-medium"
      style={{ color: up ? "#148A7A" : "#DC2626" }}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(pct)}% vs last
    </span>
  );
}

function KpiCard({ icon, label, value, current, previous, isMoney }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "#148A7A" }}>
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold mb-1" style={{ color: "#0A5C54" }}>
        {isMoney ? "₹" : ""}{value}
      </p>
      <Delta current={current} previous={previous} />
    </div>
  );
}

function ComparisonChart({ title, current, previous, isMoney }) {
  const data = [
    { name: "Last period", value: previous },
    { name: "This period", value: current },
  ];
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-semibold mb-3" style={{ color: "#0A5C54" }}>{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#14B8A633" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#0A5C5499" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#0A5C5499" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [isMoney ? `₹${v}` : v, ""]}
            contentStyle={{ borderRadius: 10, border: "1px solid #14B8A655", fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#148A7A" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ data }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-semibold mb-3" style={{ color: "#0A5C54" }}>Income trend</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#14B8A633" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#0A5C5499" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#0A5C5499" }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`₹${v}`, "Income"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #14B8A655", fontSize: 12 }}
          />
          <Bar dataKey="income" radius={[6, 6, 0, 0]} fill="#4FD6E8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentBreakdown({ cash, upi, card }) {
  const total = cash + upi + card || 1;
  const segments = [
    { label: "Cash", value: cash, color: "#148A7A" },
    { label: "UPI", value: upi, color: "#4FD6E8" },
    { label: "Card", value: card, color: "#F59E0B" },
  ];
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-semibold mb-3" style={{ color: "#0A5C54" }}>Payment mode breakdown</p>
      <div className="w-full h-3 rounded-full overflow-hidden flex mb-3" style={{ background: "#F4FAF8" }}>
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span style={{ color: "#0A5C54" }}>{s.label}</span>
            </div>
            <span style={{ color: "#0A5C5499" }}>₹{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncomeView({ patients }) {
  const [subTab, setSubTab] = useState("daily");
  const now = new Date();

  // ---- Daily ----
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);
  const todayStats = statsForRange(patients, todayStart, todayEnd);
  const yesterdayStats = statsForRange(patients, yesterdayStart, todayStart);
  const last7Trend = dailySeries(patients, addDays(todayStart, -6), 7);

  // ---- Weekly ----
  const { start: weekStart, end: weekEnd } = weekRange(now);
  const prevWeekStart = addDays(weekStart, -7);
  const thisWeekStats = statsForRange(patients, weekStart, weekEnd);
  const lastWeekStats = statsForRange(patients, prevWeekStart, weekStart);

  // ---- Monthly ----
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const prevMonthDate = new Date(monthStart);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const { start: prevMonthStart, end: prevMonthEnd } = monthRange(prevMonthDate);
  const thisMonthStats = statsForRange(patients, monthStart, monthEnd);
  const lastMonthStats = statsForRange(patients, prevMonthStart, prevMonthEnd);

  const active =
    subTab === "daily"
      ? { current: todayStats, previous: yesterdayStats, periodLabel: "Today" }
      : subTab === "weekly"
      ? { current: thisWeekStats, previous: lastWeekStats, periodLabel: "This week" }
      : { current: thisMonthStats, previous: lastMonthStats, periodLabel: "This month" };

  return (
    <div>
      <div className="flex gap-1.5 mb-4 bg-white/60 rounded-xl p-1">
        <button
          onClick={() => setSubTab("daily")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "daily" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "daily" ? "white" : "#0A5C54",
          }}
        >
          Daily
        </button>
        <button
          onClick={() => setSubTab("weekly")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "weekly" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "weekly" ? "white" : "#0A5C54",
          }}
        >
          Weekly
        </button>
        <button
          onClick={() => setSubTab("monthly")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "monthly" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "monthly" ? "white" : "#0A5C54",
          }}
        >
          Monthly
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: "#0A5C5499" }}>
        {active.periodLabel} vs previous {subTab === "daily" ? "day" : subTab === "weekly" ? "week" : "month"}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard
          icon={<Users size={13} />}
          label="Patients"
          value={active.current.count}
          current={active.current.count}
          previous={active.previous.count}
        />
        <KpiCard
          icon={<IndianRupee size={13} />}
          label="Income"
          value={active.current.income}
          current={active.current.income}
          previous={active.previous.income}
          isMoney
        />
        <KpiCard
          icon={<IndianRupee size={13} />}
          label="MR Payout"
          value={active.current.mr}
          current={active.current.mr}
          previous={active.previous.mr}
          isMoney
        />
        <KpiCard
          icon={<TrendingUp size={13} />}
          label="Profit"
          value={active.current.profit}
          current={active.current.profit}
          previous={active.previous.profit}
          isMoney
        />
      </div>

      {subTab === "daily" && <TrendChart data={last7Trend} />}

      <PaymentBreakdown cash={active.current.cash} upi={active.current.upi} card={active.current.card} />

      <ComparisonChart title="Income comparison" current={active.current.income} previous={active.previous.income} isMoney />
      <ComparisonChart title="Profit comparison" current={active.current.profit} previous={active.previous.profit} isMoney />
    </div>
  );
}
