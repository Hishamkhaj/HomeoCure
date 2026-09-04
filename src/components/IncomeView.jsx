import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, IndianRupee, TrendingUp, TrendingDown, Minus, Wallet, Package } from "lucide-react";
import ExpensesPanel from "./ExpensesPanel";
import MonthlyReportView from "./MonthlyReportView";

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

function weekRange(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = addDays(d, diffToMonday);
  const end = addDays(start, 7);
  return { start, end };
}

function monthRange(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

// Merge patient visits + standalone pharmacy sales into one flat list, tagged by type
// so they can be aggregated together for totals but shown separately in the UI.
function flattenEntries(patients, directSales) {
  const list = [];
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      list.push({ ts: v.ts, cost: v.cost || 0, mr: v.mr_commission || 0, payment_mode: v.payment_mode || "cash", name: p.name, type: "patient" });
    });
  });
  directSales.forEach((s) => {
    list.push({ ts: s.ts, cost: s.cost, mr: 0, payment_mode: s.payment_mode || "cash", name: s.name, type: "product" });
  });
  return list;
}

function inRange(entries, start, end) {
  return entries.filter((e) => e.ts >= start.getTime() && e.ts < end.getTime()).sort((a, b) => b.ts - a.ts);
}

function statsForRange(entries, start, end) {
  let count = 0, patientCount = 0, income = 0, mr = 0, cash = 0, upi = 0, card = 0, patientIncome = 0, productIncome = 0;
  entries.forEach((e) => {
    if (e.ts >= start.getTime() && e.ts < end.getTime()) {
      count += 1;
      if (e.type === "patient") patientCount += 1;
      income += e.cost || 0;
      mr += e.mr || 0;
      if (e.type === "patient") patientIncome += e.cost || 0;
      else productIncome += e.cost || 0;
      if (e.payment_mode === "upi") upi += e.cost || 0;
      else if (e.payment_mode === "card") card += e.cost || 0;
      else cash += e.cost || 0;
    }
  });
  return { count, patientCount, income, mr, profit: income - mr, cash, upi, card, patientIncome, productIncome };
}

function dailySeries(entries, start, days) {
  const map = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    map[dateStrFromTs(d.getTime())] = 0;
  }
  entries.forEach((e) => {
    const key = dateStrFromTs(e.ts);
    if (key in map) map[key] += e.cost || 0;
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
    <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color: up ? "#148A7A" : "#DC2626" }}>
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
          <Tooltip formatter={(v) => [isMoney ? `₹${v}` : v, ""]} contentStyle={{ borderRadius: 10, border: "1px solid #14B8A655", fontSize: 12 }} />
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
          <Tooltip formatter={(v) => [`₹${v}`, "Income"]} contentStyle={{ borderRadius: 10, border: "1px solid #14B8A655", fontSize: 12 }} />
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
      <p className="text-xs font-semibold mb-3" style={{ color: "#0A5C54" }}>Payment mode breakdown (all income)</p>
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

function PatientBreakdown({ visits }) {
  const total = visits.reduce((sum, v) => sum + v.cost, 0);
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center gap-1.5 mb-3" style={{ color: "#148A7A" }}>
        <Users size={13} />
        <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Patient payments</p>
      </div>
      {visits.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#0A5C5466" }}>No patient payments in this period.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {visits.map((v, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: "#14B8A61A" }}>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: "#0A5C54" }}>{v.name}</p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>
                  {new Date(v.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {v.payment_mode || "cash"}
                </p>
              </div>
              <span className="font-semibold shrink-0" style={{ color: "#148A7A" }}>₹{v.cost}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "#14B8A655" }}>
        <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Patient total</span>
        <span className="text-sm font-bold" style={{ color: "#0A5C54" }}>₹{total}</span>
      </div>
    </div>
  );
}

function ProductSalesBreakdown({ sales }) {
  const total = sales.reduce((sum, s) => sum + s.cost, 0);
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center gap-1.5 mb-3" style={{ color: "#148A7A" }}>
        <Package size={13} />
        <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Standalone product sales</p>
      </div>
      {sales.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#0A5C5466" }}>No walk-in product sales in this period.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {sales.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: "#14B8A61A" }}>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: "#0A5C54" }}>{s.name}</p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>
                  {new Date(s.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {s.payment_mode || "cash"}
                </p>
              </div>
              <span className="font-semibold shrink-0" style={{ color: "#148A7A" }}>₹{s.cost}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "#14B8A655" }}>
        <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Product sales total</span>
        <span className="text-sm font-bold" style={{ color: "#0A5C54" }}>₹{total}</span>
      </div>
    </div>
  );
}

export default function IncomeView({ patients }) {
  const [subTab, setSubTab] = useState("daily");
  const [directSales, setDirectSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const now = new Date();

  useEffect(() => {
    (async () => {
      const { data: sales } = await supabase
        .from("pharmacy_sales")
        .select("*")
        .is("patient_id", null)
        .not("qty", "is", null);
      if (!sales || sales.length === 0) {
        setDirectSales([]);
        return;
      }
      const productIds = [...new Set(sales.map((s) => s.product_id).filter(Boolean))];
      const { data: prods } = await supabase.from("pharmacy_products").select("id, price").in("id", productIds);
      const priceById = {};
      (prods || []).forEach((p) => {
        priceById[p.id] = p.price;
      });
      const built = sales.map((s) => ({
        ts: new Date((s.sold_at || new Date().toISOString().slice(0, 10)) + "T12:00:00").getTime(),
        name: s.product_name,
        cost: (priceById[s.product_id] || 0) * (s.qty || 1),
        payment_mode: s.payment_mode || "cash",
      }));
      setDirectSales(built);
    })();
  }, []);

  async function fetchExpenses() {
    const { data } = await supabase.from("expenses").select("*");
    setExpenses(data || []);
  }

  useEffect(() => {
    fetchExpenses();
  }, []);

  const entries = flattenEntries(patients, directSales);

  // ---- Daily ----
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);
  const todayStats = statsForRange(entries, todayStart, todayEnd);
  const yesterdayStats = statsForRange(entries, yesterdayStart, todayStart);
  const last7Trend = dailySeries(entries, addDays(todayStart, -6), 7);
  const todayEntries = inRange(entries, todayStart, todayEnd);

  // ---- Weekly ----
  const { start: weekStart, end: weekEnd } = weekRange(now);
  const prevWeekStart = addDays(weekStart, -7);
  const thisWeekStats = statsForRange(entries, weekStart, weekEnd);
  const lastWeekStats = statsForRange(entries, prevWeekStart, weekStart);
  const thisWeekEntries = inRange(entries, weekStart, weekEnd);

  // ---- Monthly ----
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const prevMonthDate = new Date(monthStart);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const { start: prevMonthStart, end: prevMonthEnd } = monthRange(prevMonthDate);
  const thisMonthStats = statsForRange(entries, monthStart, monthEnd);
  const lastMonthStats = statsForRange(entries, prevMonthStart, prevMonthEnd);
  const thisMonthEntries = inRange(entries, monthStart, monthEnd);

  const monthExpenseTotal = expenses
    .filter((e) => {
      const d = new Date(e.expense_date + "T12:00:00").getTime();
      return d >= monthStart.getTime() && d < monthEnd.getTime();
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = thisMonthStats.profit - monthExpenseTotal;

  const active =
    subTab === "daily"
      ? { current: todayStats, previous: yesterdayStats, periodLabel: "Today", entries: todayEntries }
      : subTab === "weekly"
      ? { current: thisWeekStats, previous: lastWeekStats, periodLabel: "This week", entries: thisWeekEntries }
      : { current: thisMonthStats, previous: lastMonthStats, periodLabel: "This month", entries: thisMonthEntries };

  const activePatientEntries = active.entries.filter((e) => e.type === "patient");
  const activeProductEntries = active.entries.filter((e) => e.type === "product");

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
        <button
          onClick={() => setSubTab("expenses")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "expenses" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "expenses" ? "white" : "#0A5C54",
          }}
        >
          Expenses
        </button>
        <button
          onClick={() => setSubTab("report")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "report" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "report" ? "white" : "#0A5C54",
          }}
        >
          Report
        </button>
      </div>

      {subTab === "expenses" ? (
        <ExpensesPanel expenses={expenses} onRefresh={fetchExpenses} />
      ) : subTab === "report" ? (
        <MonthlyReportView patients={patients} entries={entries} expenses={expenses} />
      ) : (
        <>
      <p className="text-xs mb-3" style={{ color: "#0A5C5499" }}>
        {active.periodLabel} vs previous {subTab === "daily" ? "day" : subTab === "weekly" ? "week" : "month"}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl p-3" style={{ background: "#F4FAF8" }}>
          <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Patient income</p>
          <p className="text-base font-bold" style={{ color: "#0A5C54" }}>₹{active.current.patientIncome}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#F4FAF8" }}>
          <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Product sales</p>
          <p className="text-base font-bold" style={{ color: "#0A5C54" }}>₹{active.current.productIncome}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard
          icon={<Users size={13} />}
          label="Patients"
          value={active.current.patientCount}
          current={active.current.patientCount}
          previous={active.previous.patientCount}
        />
        <KpiCard
          icon={<IndianRupee size={13} />}
          label="Total Income"
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

      <PatientBreakdown visits={activePatientEntries} />

      <ProductSalesBreakdown sales={activeProductEntries} />

      <PaymentBreakdown cash={active.current.cash} upi={active.current.upi} card={active.current.card} />

      <ComparisonChart title="Income comparison" current={active.current.income} previous={active.previous.income} isMoney />
      <ComparisonChart title="Profit comparison" current={active.current.profit} previous={active.previous.profit} isMoney />

      {subTab === "monthly" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-1.5 mb-2" style={{ color: "#148A7A" }}>
            <Wallet size={14} />
            <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Net Profit (after expenses)</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: "#0A5C5499" }}>
            <span>Profit (Income − MR)</span>
            <span>₹{thisMonthStats.profit}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-2" style={{ color: "#0A5C5499" }}>
            <span>Expenses this month</span>
            <span>− ₹{monthExpenseTotal}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#14B8A655" }}>
            <span className="text-sm font-semibold" style={{ color: "#0A5C54" }}>Net Profit</span>
            <span className="text-lg font-bold" style={{ color: netProfit >= 0 ? "#148A7A" : "#DC2626" }}>₹{netProfit}</span>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
