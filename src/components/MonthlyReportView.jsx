import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Printer, TrendingUp, TrendingDown, Users, IndianRupee, Package, Droplet, AlertCircle, Lightbulb } from "lucide-react";

function monthRangeFromKey(key) {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

function prevMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const { start } = monthRangeFromKey(key);
  return start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function MonthlyReportView({ patients, entries, expenses }) {
  const now = new Date();
  const defaultKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [monthKey, setMonthKey] = useState(defaultKey);
  const [pharmacyProducts, setPharmacyProducts] = useState([]);
  const [pharmacySales, setPharmacySales] = useState([]);
  const [mrs, setMrs] = useState([]);
  const [mrOrders, setMrOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: sales }, { data: mrList }, { data: orders }] = await Promise.all([
        supabase.from("pharmacy_products").select("*"),
        supabase.from("pharmacy_sales").select("*"),
        supabase.from("mrs").select("*"),
        supabase.from("mr_orders").select("*"),
      ]);
      setPharmacyProducts(prods || []);
      setPharmacySales(sales || []);
      setMrs(mrList || []);
      setMrOrders(orders || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading report…</p>;
  }

  const { start, end } = monthRangeFromKey(monthKey);
  const prevKey = prevMonthKey(monthKey);
  const { start: prevStart, end: prevEnd } = monthRangeFromKey(prevKey);

  // ---- Income ----
  function incomeStats(s, e) {
    let count = 0, income = 0, mr = 0, cash = 0, upi = 0, card = 0;
    entries.forEach((en) => {
      if (en.ts >= s.getTime() && en.ts < e.getTime()) {
        count += 1;
        income += en.cost || 0;
        mr += en.mr || 0;
        if (en.payment_mode === "upi") upi += en.cost || 0;
        else if (en.payment_mode === "card") card += en.cost || 0;
        else cash += en.cost || 0;
      }
    });
    return { count, income, mr, profit: income - mr, cash, upi, card };
  }
  const thisStats = incomeStats(start, end);
  const prevStats = incomeStats(prevStart, prevEnd);
  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.expense_date + "T12:00:00").getTime();
    return d >= start.getTime() && d < end.getTime();
  });
  const totalExpenses = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = thisStats.profit - totalExpenses;

  // ---- Patients ----
  const visitsThisMonth = [];
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      if (v.ts >= start.getTime() && v.ts < end.getTime()) visitsThisMonth.push({ patient: p, visit: v });
    });
  });
  const patientIdsThisMonth = [...new Set(visitsThisMonth.map((v) => v.patient.id))];
  let newPatients = 0, returningPatients = 0, closedCount = 0, openCount = 0;
  patientIdsThisMonth.forEach((id) => {
    const p = patients.find((pp) => pp.id === id);
    const allVisits = (p.visits || []).map((v) => v.ts).sort((a, b) => a - b);
    const firstEver = allVisits[0];
    if (firstEver >= start.getTime()) newPatients += 1;
    else returningPatients += 1;
    if (p.status === "closed") closedCount += 1;
    else openCount += 1;
  });

  const overduePatients = patients.filter((p) => {
    if (p.status !== "open") return false;
    const visits = p.visits || [];
    if (visits.length === 0) return false;
    const last = [...visits].sort((a, b) => b.ts - a.ts)[0];
    if (!last.duration_days) return false;
    const dueDate = last.ts + last.duration_days * 24 * 60 * 60 * 1000;
    return Date.now() >= dueDate;
  });

  // ---- Pharmacy (this month) ----
  const productById = {};
  pharmacyProducts.forEach((p) => (productById[p.id] = p));
  const salesThisMonth = pharmacySales.filter((s) => {
    const d = new Date(s.sold_at + "T12:00:00").getTime();
    return d >= start.getTime() && d < end.getTime();
  });
  const unitAgg = {}, volAgg = {};
  salesThisMonth.forEach((s) => {
    const prod = productById[s.product_id];
    const isVol = prod ? prod.tracking_type === "volume" : s.ml_dispensed != null;
    if (!isVol && s.qty) {
      unitAgg[s.product_id] = unitAgg[s.product_id] || { name: s.product_name, qty: 0 };
      unitAgg[s.product_id].qty += s.qty;
    } else if (isVol && s.ml_dispensed) {
      volAgg[s.product_id] = volAgg[s.product_id] || { name: s.product_name, ml: 0 };
      volAgg[s.product_id].ml += s.ml_dispensed;
    }
  });
  const topUnit = Object.values(unitAgg).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topVol = Object.values(volAgg).sort((a, b) => b.ml - a.ml).slice(0, 5);

  const unitProducts = pharmacyProducts.filter((p) => p.tracking_type !== "volume");
  const volProducts = pharmacyProducts.filter((p) => p.tracking_type === "volume");
  const deadUnit = unitProducts.filter((p) => !unitAgg[p.id]);
  const deadVol = volProducts.filter((p) => !volAgg[p.id]);

  const lowStock = pharmacyProducts.filter((p) => {
    if (p.tracking_type === "volume") return (p.remaining_ml ?? 0) <= (p.low_volume_threshold_ml ?? 50);
    return p.stock <= (p.low_stock_threshold ?? 2);
  });

  // ---- MR ----
  const mrOrdersThisMonth = mrOrders.filter((o) => {
    const d = new Date(o.order_date + "T12:00:00").getTime();
    return d >= start.getTime() && d < end.getTime();
  });
  const mrSummary = mrs.map((mr) => {
    const monthOrders = mrOrdersThisMonth.filter((o) => o.mr_id === mr.id);
    const bill = monthOrders.reduce((s, o) => s + (o.bill_amount || 0), 0);
    const paid = monthOrders.reduce((s, o) => s + (o.paid_amount || 0), 0);
    const allOrders = mrOrders.filter((o) => o.mr_id === mr.id);
    const totalPending = allOrders.reduce((s, o) => s + Math.max(0, (o.bill_amount || 0) - (o.paid_amount || 0)), 0);
    return { name: mr.name, bill, paid, pending: bill - paid, totalPending };
  }).filter((m) => m.bill > 0 || m.totalPending > 0);
  const grandMrPending = mrs.reduce((s, mr) => {
    const allOrders = mrOrders.filter((o) => o.mr_id === mr.id);
    return s + allOrders.reduce((ss, o) => ss + Math.max(0, (o.bill_amount || 0) - (o.paid_amount || 0)), 0);
  }, 0);

  // ---- Expenses by category ----
  const expenseByCategory = {};
  monthExpenses.forEach((e) => {
    const cat = e.category || "Miscellaneous";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (e.amount || 0);
  });

  // ---- Progress ----
  const patientChange = pctChange(thisStats.count, prevStats.count);
  const incomeChange = pctChange(thisStats.income, prevStats.income);

  // ---- Advice ----
  const advice = [];
  if (deadUnit.length + deadVol.length > 0) {
    advice.push(`${deadUnit.length + deadVol.length} products had zero sales this month — review whether to keep stocking them.`);
  }
  if (lowStock.length > 0) {
    advice.push(`${lowStock.length} products are running low — check the Analytics/Orders section to reorder.`);
  }
  if (overduePatients.length > 0) {
    advice.push(`${overduePatients.length} patients are overdue for follow-up — check the Follow-up tab.`);
  }
  if (incomeChange !== null) {
    advice.push(`Income is ${incomeChange >= 0 ? "up" : "down"} ${Math.abs(incomeChange)}% compared to last month.`);
  }
  if (grandMrPending > 0) {
    advice.push(`₹${grandMrPending} is pending payment to MRs across all orders.`);
  }
  if (advice.length === 0) {
    advice.push("Everything looks steady this month — no urgent items to flag.");
  }

  // list of month options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .report-printable, .report-printable * { visibility: visible; }
          .report-printable { position: absolute; top: 0; left: 0; width: 100%; padding: 16px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center gap-2 mb-4 no-print">
        <select
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
          style={{ borderColor: "#14B8A655" }}
        >
          {monthOptions.map((k) => (
            <option key={k} value={k}>{monthLabel(k)}</option>
          ))}
        </select>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shrink-0"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
        >
          <Printer size={16} /> Save PDF
        </button>
      </div>

      <div className="report-printable">
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <h2 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>HomeoCure — Monthly Report</h2>
          <p className="text-xs" style={{ color: "#0A5C5499" }}>{monthLabel(monthKey)}</p>
        </div>

        {/* Income */}
        <ReportSection title="Income & Profit" icon={<IndianRupee size={13} />}>
          <Row label="Total income" value={`₹${thisStats.income}`} />
          <Row label="MR commission" value={`₹${thisStats.mr}`} />
          <Row label="Profit (Income − MR)" value={`₹${thisStats.profit}`} />
          <Row label="Expenses" value={`₹${totalExpenses}`} />
          <Row label="Net Profit" value={`₹${netProfit}`} bold color={netProfit >= 0 ? "#148A7A" : "#DC2626"} />
          <Row label="Cash / UPI / Card" value={`₹${thisStats.cash} / ₹${thisStats.upi} / ₹${thisStats.card}`} />
        </ReportSection>

        {/* Patients */}
        <ReportSection title="Patients" icon={<Users size={13} />}>
          <Row label="Total patients seen" value={patientIdsThisMonth.length} />
          <Row label="New patients" value={newPatients} />
          <Row label="Returning patients" value={returningPatients} />
          <Row label="Cases closed (of this month's)" value={closedCount} />
          <Row label="Cases still open (of this month's)" value={openCount} />
          <Row label="Overdue for follow-up (overall)" value={overduePatients.length} color={overduePatients.length > 0 ? "#DC2626" : undefined} />
        </ReportSection>

        {/* Pharmacy */}
        <ReportSection title="Pharmacy — Top Sellers" icon={<Package size={13} />}>
          {topUnit.length === 0 && topVol.length === 0 ? (
            <p className="text-xs" style={{ color: "#0A5C5499" }}>No sales this month.</p>
          ) : (
            <>
              {topUnit.map((u, i) => <Row key={i} label={u.name} value={`${u.qty} pcs`} />)}
              {topVol.map((v, i) => <Row key={i} label={v.name} value={`${v.ml} ml/g`} />)}
            </>
          )}
        </ReportSection>

        <ReportSection title="Pharmacy — Attention Needed" icon={<Droplet size={13} />}>
          <Row label="Dead stock (0 sales this month)" value={deadUnit.length + deadVol.length} />
          <Row label="Low stock / needs reorder" value={lowStock.length} color={lowStock.length > 0 ? "#DC2626" : undefined} />
        </ReportSection>

        {/* MR */}
        {mrSummary.length > 0 && (
          <ReportSection title="MR / Procurement" icon={<Package size={13} />}>
            {mrSummary.map((m, i) => (
              <Row key={i} label={m.name} value={`Bill ₹${m.bill} · Paid ₹${m.paid} · Pending ₹${m.pending}`} />
            ))}
            <Row label="Total pending (all-time, all MRs)" value={`₹${grandMrPending}`} bold color={grandMrPending > 0 ? "#DC2626" : undefined} />
          </ReportSection>
        )}

        {/* Expenses */}
        {Object.keys(expenseByCategory).length > 0 && (
          <ReportSection title="Expenses by Category" icon={<IndianRupee size={13} />}>
            {Object.entries(expenseByCategory).map(([cat, amt]) => (
              <Row key={cat} label={cat} value={`₹${amt}`} />
            ))}
          </ReportSection>
        )}

        {/* Progress */}
        <ReportSection title="Clinic Progress vs Last Month" icon={patientChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}>
          <Row label="Patients" value={patientChange === null ? "New activity" : `${patientChange >= 0 ? "+" : ""}${patientChange}%`} />
          <Row label="Income" value={incomeChange === null ? "New activity" : `${incomeChange >= 0 ? "+" : ""}${incomeChange}%`} />
        </ReportSection>

        {/* Advice */}
        <ReportSection title="Advice & Suggestions" icon={<Lightbulb size={13} />}>
          {advice.map((a, i) => (
            <p key={i} className="text-xs mb-1.5 flex items-start gap-1.5" style={{ color: "#0A5C54" }}>
              <span style={{ color: "#148A7A" }}>•</span> {a}
            </p>
          ))}
        </ReportSection>
      </div>
    </div>
  );
}

function ReportSection({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
      <div className="flex items-center gap-1.5 mb-2.5" style={{ color: "#148A7A" }}>
        {icon}
        <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b" style={{ borderColor: "#14B8A61A" }}>
      <span style={{ color: "#0A5C5499" }}>{label}</span>
      <span className={bold ? "font-bold" : "font-medium"} style={{ color: color || "#0A5C54" }}>{value}</span>
    </div>
  );
}
