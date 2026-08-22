import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TrendingUp, TrendingDown, AlertCircle, Package, Droplet, ShoppingCart } from "lucide-react";

const PERIODS = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "1m", label: "1 Month", days: 30 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "6m", label: "6 Months", days: 180 },
];

export default function AnalyticsView() {
  const [period, setPeriod] = useState("1m");
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [recsUnit, setRecsUnit] = useState([]);
  const [recsVolume, setRecsVolume] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 185);
    const cutoffStr = sixMonthsAgo.toISOString().slice(0, 10);

    const [{ data: salesData }, { data: prodData }, { data: unitRecs }, { data: volRecs }] = await Promise.all([
      supabase.from("pharmacy_sales").select("*").gte("sold_at", cutoffStr),
      supabase.from("pharmacy_products").select("*"),
      supabase.from("product_sales_last_3_months_unit").select("*"),
      supabase.from("product_sales_last_3_months_volume").select("*"),
    ]);

    setSales(salesData || []);
    setProducts(prodData || []);
    setRecsUnit(unitRecs || []);
    setRecsVolume(volRecs || []);
    setLoading(false);
  }

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading analytics…</p>;
  }

  const periodDef = PERIODS.find((p) => p.key === period);
  const cutoff = Date.now() - periodDef.days * 24 * 60 * 60 * 1000;
  const inPeriod = sales.filter((s) => new Date(s.sold_at + "T12:00:00").getTime() >= cutoff);

  // ---- Aggregate by product for the selected period ----
  const unitAgg = {}; // product_id -> { name, qty, entries }
  const volAgg = {}; // product_id -> { name, ml, entries }
  inPeriod.forEach((s) => {
    if (s.qty) {
      if (!unitAgg[s.product_id]) unitAgg[s.product_id] = { name: s.product_name, qty: 0, entries: 0 };
      unitAgg[s.product_id].qty += s.qty;
      unitAgg[s.product_id].entries += 1;
    }
    if (s.ml_dispensed) {
      if (!volAgg[s.product_id]) volAgg[s.product_id] = { name: s.product_name, ml: 0, entries: 0 };
      volAgg[s.product_id].ml += s.ml_dispensed;
      volAgg[s.product_id].entries += 1;
    }
  });

  const unitProducts = products.filter((p) => p.tracking_type !== "volume");
  const volProducts = products.filter((p) => p.tracking_type === "volume");

  const unitList = Object.entries(unitAgg)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.qty - a.qty);
  const volList = Object.entries(volAgg)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.ml - a.ml);

  const zeroUnit = unitProducts.filter((p) => !unitAgg[p.id]);
  const zeroVol = volProducts.filter((p) => !volAgg[p.id]);

  const slowUnit = unitList.filter((u) => u.entries <= 2 && u.entries > 0);
  const slowVol = volList.filter((v) => v.entries <= 2 && v.entries > 0);

  const totalUnitsSold = unitList.reduce((s, u) => s + u.qty, 0);
  const totalMlSold = volList.reduce((s, v) => s + v.ml, 0);
  const topProductName = unitList[0]?.name || volList[0]?.name || "—";

  // ---- Recommendations (always 3-month based, regardless of period toggle) ----
  function unitRecommendation(rec) {
    const prod = products.find((p) => p.id === rec.product_id);
    if (!prod) return null;
    const totalEntries = [rec.month_1_units, rec.month_2_units, rec.month_3_units].filter((v) => v > 0).length;
    if (rec.three_month_total <= 0 || totalEntries < 1) {
      return { name: rec.product_name, insufficient: true };
    }
    const avg = rec.average_monthly_units;
    const suggested = Math.max(0, Math.ceil(avg * 1.15 - (prod.stock || 0)));
    return { name: rec.product_name, avg, stock: prod.stock, suggested };
  }

  function volRecommendation(rec) {
    const prod = products.find((p) => p.id === rec.product_id);
    if (!prod) return null;
    if (rec.three_month_total_ml <= 0) {
      return { name: rec.product_name, insufficient: true };
    }
    const avg = rec.average_monthly_ml;
    const remaining = prod.remaining_ml || 0;
    const bottleSize = prod.bottle_size_ml || 1;
    const suggestedMl = Math.max(0, avg * 1.15 - remaining);
    const suggestedBottles = Math.ceil(suggestedMl / bottleSize);
    return { name: rec.product_name, avg, remaining, unit: prod.measure_unit || "ml", bottleSize, suggestedBottles };
  }

  const unitRecommendations = recsUnit.map(unitRecommendation).filter(Boolean).filter((r) => r.insufficient || r.suggested > 0);
  const volRecommendations = recsVolume.map(volRecommendation).filter(Boolean).filter((r) => r.insufficient || r.suggestedBottles > 0);

  return (
    <div>
      {/* Period selector */}
      <div className="flex gap-1.5 mb-4 bg-white/60 rounded-xl p-1 overflow-x-auto">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: period === p.key ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: period === p.key ? "white" : "#0A5C54",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Dashboard summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <Package size={13} /><span className="text-[11px] font-medium uppercase">Units sold</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{totalUnitsSold}</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <Droplet size={13} /><span className="text-[11px] font-medium uppercase">ml/g used</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{totalMlSold}</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <TrendingUp size={13} /><span className="text-[11px] font-medium uppercase">Top seller</span>
          </div>
          <p className="text-sm font-bold truncate" style={{ color: "#0A5C54" }}>{topProductName}</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#DC2626" }}>
            <AlertCircle size={13} /><span className="text-[11px] font-medium uppercase">No sales</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{zeroUnit.length + zeroVol.length}</p>
        </div>
      </div>

      {/* Top selling — Pieces */}
      <SectionCard title="Top Selling — Pieces">
        {unitList.length === 0 ? (
          <EmptyRow text="No unit sales in this period." />
        ) : (
          unitList.slice(0, 8).map((u, i) => <RankRow key={u.id} rank={i + 1} name={u.name} value={`${u.qty} pcs`} />)
        )}
      </SectionCard>

      {/* Top selling — Measured */}
      <SectionCard title="Top Selling — Measured (ml/g)">
        {volList.length === 0 ? (
          <EmptyRow text="No measured sales in this period." />
        ) : (
          volList.slice(0, 8).map((v, i) => <RankRow key={v.id} rank={i + 1} name={v.name} value={`${v.ml} ml/g`} />)
        )}
      </SectionCard>

      {/* Slow moving */}
      <SectionCard title="Slow Moving" icon={<TrendingDown size={13} color="#B45309" />}>
        {slowUnit.length === 0 && slowVol.length === 0 ? (
          <EmptyRow text="Nothing slow-moving right now." />
        ) : (
          <>
            {slowUnit.map((u) => <RankRow key={u.id} name={u.name} value={`${u.qty} pcs · ${u.entries} sale${u.entries !== 1 ? "s" : ""}`} warn />)}
            {slowVol.map((v) => <RankRow key={v.id} name={v.name} value={`${v.ml} ml/g · ${v.entries} sale${v.entries !== 1 ? "s" : ""}`} warn />)}
          </>
        )}
      </SectionCard>

      {/* Zero sales / dead stock */}
      <SectionCard title="No Sales / Dead Stock" icon={<AlertCircle size={13} color="#DC2626" />}>
        {zeroUnit.length === 0 && zeroVol.length === 0 ? (
          <EmptyRow text="Every product has sold at least once in this period." />
        ) : (
          <>
            {zeroUnit.map((p) => <RankRow key={p.id} name={p.name} value={`Stock: ${p.stock}`} danger />)}
            {zeroVol.map((p) => <RankRow key={p.id} name={p.name} value={`Remaining: ${p.remaining_ml ?? 0}${p.measure_unit || "ml"}`} danger />)}
          </>
        )}
      </SectionCard>

      {/* Recommended next order */}
      <SectionCard title="Recommended Next Order" icon={<ShoppingCart size={13} color="#148A7A" />} subtitle="Based on last 3 months' average demand">
        {unitRecommendations.length === 0 && volRecommendations.length === 0 ? (
          <EmptyRow text="Not enough sales history yet for recommendations." />
        ) : (
          <>
            {unitRecommendations.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "#14B8A61A" }}>
                <span style={{ color: "#0A5C54" }}>{r.name}</span>
                {r.insufficient ? (
                  <span style={{ color: "#0A5C5499" }}>Insufficient history</span>
                ) : (
                  <span className="font-semibold" style={{ color: "#148A7A" }}>Order ~{r.suggested} pcs</span>
                )}
              </div>
            ))}
            {volRecommendations.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "#14B8A61A" }}>
                <span style={{ color: "#0A5C54" }}>{r.name}</span>
                {r.insufficient ? (
                  <span style={{ color: "#0A5C5499" }}>Insufficient history</span>
                ) : (
                  <span className="font-semibold" style={{ color: "#148A7A" }}>Order ~{r.suggestedBottles} bottle{r.suggestedBottles !== 1 ? "s" : ""}</span>
                )}
              </div>
            ))}
          </>
        )}
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, icon, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>{title}</p>
      </div>
      {subtitle && <p className="text-[11px] mb-2" style={{ color: "#0A5C5499" }}>{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function RankRow({ rank, name, value, warn, danger }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "#14B8A61A" }}>
      <div className="flex items-center gap-2 min-w-0">
        {rank && (
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
            {rank}
          </span>
        )}
        <span className="truncate" style={{ color: "#0A5C54" }}>{name}</span>
      </div>
      <span className="shrink-0 font-medium" style={{ color: danger ? "#DC2626" : warn ? "#B45309" : "#148A7A" }}>{value}</span>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p className="text-xs text-center py-4" style={{ color: "#0A5C5466" }}>{text}</p>;
}
