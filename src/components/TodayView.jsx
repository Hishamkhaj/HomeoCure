import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Sun, Users, Package, IndianRupee, CheckCircle2, Clock, AlertTriangle, ListChecks, TrendingUp, TrendingDown, Wallet, Smartphone, Banknote, CreditCard } from "lucide-react";

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

function dateStrFromTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dueDateOf(patient) {
  const visits = patient.visits || [];
  if (visits.length === 0) return null;
  const last = [...visits].sort((a, b) => b.ts - a.ts)[0];
  if (!last.duration_days) return null;
  return last.ts + last.duration_days * 24 * 60 * 60 * 1000;
}

export default function TodayView({ patients, onSelect }) {
  const [pharmacyProducts, setPharmacyProducts] = useState([]);
  const [mrOrders, setMrOrders] = useState([]);
  const [directSalesToday, setDirectSalesToday] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const todayKey = dateStrFromTs(startOfDay(new Date()).getTime());
      const [{ data: prods }, { data: orders }, { data: sales }] = await Promise.all([
        supabase.from("pharmacy_products").select("*"),
        supabase.from("mr_orders").select("*"),
        supabase.from("pharmacy_sales").select("*").is("patient_id", null).not("qty", "is", null).eq("sold_at", todayKey),
      ]);
      setPharmacyProducts(prods || []);
      setMrOrders(orders || []);

      if (sales && sales.length > 0) {
        const productIds = [...new Set(sales.map((s) => s.product_id).filter(Boolean))];
        const { data: priceProds } = await supabase.from("pharmacy_products").select("id, price").in("id", productIds);
        const priceById = {};
        (priceProds || []).forEach((p) => (priceById[p.id] = p.price));
        setDirectSalesToday(sales.map((s) => ({ name: s.product_name, cost: (priceById[s.product_id] || 0) * (s.qty || 1) })));
      }

      setLoading(false);
    })();
  }, []);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const todayStr = dateStrFromTs(todayStart.getTime());
  const weekday = now.toLocaleDateString("en-IN", { weekday: "long" });
  const dateLabel = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  // ---- Follow-ups ----
  const yesterdayStart = addDays(todayStart, -1);
  const tomorrowStart = addDays(todayStart, 1);
  const tomorrowEnd = addDays(todayStart, 2);

  const openPatients = patients.filter((p) => p.status === "open");

  function dueBucket(p) {
    const due = dueDateOf(p);
    if (due === null) return null;
    if (due >= todayStart.getTime() && due < todayEnd.getTime()) return "today";
    if (due >= yesterdayStart.getTime() && due < todayStart.getTime()) return "yesterday";
    if (due >= tomorrowStart.getTime() && due < tomorrowEnd.getTime()) return "tomorrow";
    if (due < yesterdayStart.getTime()) return "older";
    return null;
  }

  const dueToday = openPatients.filter((p) => dueBucket(p) === "today");
  const dueYesterday = openPatients.filter((p) => dueBucket(p) === "yesterday");
  const dueTomorrow = openPatients.filter((p) => dueBucket(p) === "tomorrow");
  const overdueBefore = openPatients.filter((p) => dueBucket(p) === "older");
  const expectedAroundToday = [...dueYesterday, ...dueToday, ...dueTomorrow];

  // ---- Today's actual visits ----
  const visitsToday = [];
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      if (v.ts >= todayStart.getTime() && v.ts < todayEnd.getTime()) {
        visitsToday.push({ patient: p, visit: v });
      }
    });
  });
  const patientIdsVisitedToday = new Set(visitsToday.map((v) => v.patient.id));

  const dueTodayAttended = expectedAroundToday.filter((p) => patientIdsVisitedToday.has(p.id));
  const dueTodayPending = expectedAroundToday.filter((p) => !patientIdsVisitedToday.has(p.id));

  // ---- Historical average for this weekday (live — improves as data grows) ----
  const dailyCounts = {};
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      const key = dateStrFromTs(v.ts);
      dailyCounts[key] = (dailyCounts[key] || 0) + 1;
    });
  });
  const sameWeekdayCounts = Object.entries(dailyCounts)
    .filter(([dateStr]) => dateStr !== todayStr)
    .filter(([dateStr]) => new Date(dateStr + "T12:00:00").getDay() === now.getDay())
    .map(([, count]) => count);
  const hasEnoughHistory = sameWeekdayCounts.length >= 3;
  const weekdayAverage = hasEnoughHistory
    ? Math.round(sameWeekdayCounts.reduce((a, b) => a + b, 0) / sameWeekdayCounts.length)
    : null;

  // ---- Pharmacy alerts ----
  const lowStockCount = pharmacyProducts.filter((p) => {
    if (p.tracking_type === "volume") return (p.remaining_ml ?? 0) <= (p.low_volume_threshold_ml ?? 50);
    return p.stock <= (p.low_stock_threshold ?? 2);
  }).length;

  // ---- Finance ----
  const pendingCollection = patients.reduce((sum, p) => {
    return sum + (p.visits || []).reduce((s, v) => s + Math.max(0, (v.cost || 0) - (v.paid_amount ?? v.cost ?? 0)), 0);
  }, 0);
  const mrPending = mrOrders.reduce((sum, o) => sum + Math.max(0, (o.bill_amount || 0) - (o.paid_amount || 0)), 0);

  // ---- Today's income ----
  let incomeToday = 0, mrToday = 0, cashAmt = 0, upiAmt = 0, cardAmt = 0, cashCount = 0, upiCount = 0, cardCount = 0;
  visitsToday.forEach(({ visit: v }) => {
    incomeToday += v.cost || 0;
    mrToday += v.mr_commission || 0;
    const mode = v.payment_mode || "cash";
    if (mode === "upi") { upiAmt += v.cost || 0; upiCount += 1; }
    else if (mode === "card") { cardAmt += v.cost || 0; cardCount += 1; }
    else { cashAmt += v.cost || 0; cashCount += 1; }
  });
  const directSalesTotal = directSalesToday.reduce((s, d) => s + d.cost, 0);
  incomeToday += directSalesTotal;
  cashAmt += directSalesTotal; // walk-in pharmacy sales assumed cash unless tracked otherwise
  const profitToday = incomeToday - mrToday;

  // ---- Priorities ----
  const priorities = [];
  if (dueTodayPending.length > 0) priorities.push(`Follow up with ${dueTodayPending.length} patient${dueTodayPending.length !== 1 ? "s" : ""} due today`);
  if (overdueBefore.length > 0) priorities.push(`${overdueBefore.length} patient${overdueBefore.length !== 1 ? "s are" : " is"} still overdue from before`);
  if (lowStockCount > 0) priorities.push(`Check ${lowStockCount} low-stock product${lowStockCount !== 1 ? "s" : ""}`);
  if (mrPending > 0) priorities.push(`₹${mrPending} pending payment to MRs`);
  if (priorities.length === 0) priorities.push("Nothing urgent — clinic is on track today.");

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading today's overview…</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Sun size={18} color="#F59E0B" />
        <h2 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Good day, HomeoCure</h2>
      </div>
      <p className="text-xs mb-4" style={{ color: "#0A5C5499" }}>{weekday} · {dateLabel}</p>

      {/* Live patient count */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
        <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
          <Users size={13} />
          <span className="text-[11px] font-medium uppercase tracking-wide">Patients today</span>
        </div>
        <p className="text-2xl font-bold" style={{ color: "#0A5C54" }}>{visitsToday.length}</p>
        <p className="text-xs mt-1" style={{ color: "#0A5C5499" }}>
          {hasEnoughHistory ? `Typical ${weekday}: ~${weekdayAverage} patients` : "Not enough history yet to show a typical-day comparison"}
        </p>
      </div>

      {/* Expected vs actual — the "closing" comparison, live all day */}
      {hasEnoughHistory && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-1.5 mb-2.5" style={{ color: "#148A7A" }}>
            {visitsToday.length >= weekdayAverage ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Today vs a typical {weekday}</p>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span style={{ color: "#0A5C5499" }}>Typical {weekday}</span>
            <span style={{ color: "#0A5C54" }}>{weekdayAverage} patients</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span style={{ color: "#0A5C5499" }}>Today so far</span>
            <span style={{ color: "#0A5C54" }}>{visitsToday.length} patients</span>
          </div>
          <div className="flex items-center justify-between pt-2 mt-1 border-t" style={{ borderColor: "#14B8A655" }}>
            <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Difference</span>
            <span
              className="text-sm font-bold"
              style={{ color: visitsToday.length - weekdayAverage >= 0 ? "#148A7A" : "#DC2626" }}
            >
              {visitsToday.length - weekdayAverage >= 0 ? "+" : ""}
              {visitsToday.length - weekdayAverage}
              {weekdayAverage > 0 ? ` (${Math.round(((visitsToday.length - weekdayAverage) / weekdayAverage) * 100)}%)` : ""}
            </span>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "#0A5C5499" }}>
            Updates live through the day — check back this evening for the full picture.
          </p>
        </div>
      )}

      {/* Follow-ups */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
        <div className="flex items-center gap-1.5 mb-2.5" style={{ color: "#148A7A" }}>
          <Clock size={13} />
          <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>
            Expected around today ({expectedAroundToday.length})
          </p>
        </div>
        {expectedAroundToday.length === 0 ? (
          <p className="text-xs" style={{ color: "#0A5C5499" }}>No follow-ups due yesterday, today, or tomorrow.</p>
        ) : (
          <div className="space-y-1.5">
            {dueTodayPending.map((p) => {
              const bucket = dueBucket(p);
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect && onSelect(p)}
                  className="w-full flex items-center justify-between text-xs py-1.5 border-b text-left"
                  style={{ borderColor: "#14B8A61A" }}
                >
                  <span style={{ color: "#0A5C54" }}>{p.name}</span>
                  <span style={{ color: "#B45309" }}>
                    {bucket === "yesterday" ? "Due yesterday" : bucket === "tomorrow" ? "Due tomorrow" : "Due today"}
                  </span>
                </button>
              );
            })}
            {dueTodayAttended.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "#14B8A61A" }}>
                <span style={{ color: "#0A5C54" }}>{p.name}</span>
                <span className="flex items-center gap-1" style={{ color: "#148A7A" }}>
                  <CheckCircle2 size={11} /> Visited
                </span>
              </div>
            ))}
          </div>
        )}
        {overdueBefore.length > 0 && (
          <p className="text-xs mt-2.5 pt-2.5 border-t" style={{ color: "#DC2626", borderColor: "#14B8A633" }}>
            + {overdueBefore.length} more patient{overdueBefore.length !== 1 ? "s" : ""} overdue by more than a day
          </p>
        )}
      </div>

      {/* Today's income */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
        <div className="flex items-center gap-1.5 mb-2.5" style={{ color: "#148A7A" }}>
          <Wallet size={13} />
          <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Today's income</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl p-2.5" style={{ background: "#F4FAF8" }}>
            <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Income</p>
            <p className="text-base font-bold" style={{ color: "#0A5C54" }}>₹{incomeToday}</p>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "#F4FAF8" }}>
            <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Profit (− MR)</p>
            <p className="text-base font-bold" style={{ color: "#0A5C54" }}>₹{profitToday}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5" style={{ color: "#0A5C5499" }}>
              <Banknote size={12} /> Cash
            </span>
            <span style={{ color: "#0A5C54" }}>₹{cashAmt} <span style={{ color: "#0A5C5499" }}>({cashCount})</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5" style={{ color: "#0A5C5499" }}>
              <Smartphone size={12} /> UPI
            </span>
            <span style={{ color: "#0A5C54" }}>₹{upiAmt} <span style={{ color: "#0A5C5499" }}>({upiCount})</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5" style={{ color: "#0A5C5499" }}>
              <CreditCard size={12} /> Card
            </span>
            <span style={{ color: "#0A5C54" }}>₹{cardAmt} <span style={{ color: "#0A5C5499" }}>({cardCount})</span></span>
          </div>
        </div>
        {directSalesToday.length > 0 && (
          <p className="text-[11px] mt-2 pt-2 border-t" style={{ color: "#0A5C5499", borderColor: "#14B8A633" }}>
            Includes ₹{directSalesTotal} from {directSalesToday.length} walk-in pharmacy sale{directSalesToday.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Pharmacy */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
        <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
          <Package size={13} />
          <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Pharmacy</span>
        </div>
        <p className="text-xs" style={{ color: lowStockCount > 0 ? "#DC2626" : "#0A5C5499" }}>
          {lowStockCount > 0 ? `${lowStockCount} product${lowStockCount !== 1 ? "s" : ""} running low` : "All stock levels look fine"}
        </p>
      </div>

      {/* Finance */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
        <div className="flex items-center gap-1.5 mb-2" style={{ color: "#148A7A" }}>
          <IndianRupee size={13} />
          <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Finance snapshot</span>
        </div>
        <div className="flex items-center justify-between text-xs py-1">
          <span style={{ color: "#0A5C5499" }}>Pending collection (all patients)</span>
          <span className="font-semibold" style={{ color: pendingCollection > 0 ? "#DC2626" : "#0A5C54" }}>₹{pendingCollection}</span>
        </div>
        <div className="flex items-center justify-between text-xs py-1">
          <span style={{ color: "#0A5C5499" }}>MR payments pending</span>
          <span className="font-semibold" style={{ color: mrPending > 0 ? "#DC2626" : "#0A5C54" }}>₹{mrPending}</span>
        </div>
      </div>

      {/* Priorities */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
        <div className="flex items-center gap-1.5 mb-2" style={{ color: "#148A7A" }}>
          <ListChecks size={13} />
          <span className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Today's priorities</span>
        </div>
        {priorities.map((p, i) => (
          <p key={i} className="text-xs mb-1 flex items-start gap-1.5" style={{ color: "#0A5C54" }}>
            <span style={{ color: "#148A7A" }}>{i + 1}.</span> {p}
          </p>
        ))}
      </div>
    </div>
  );
}
