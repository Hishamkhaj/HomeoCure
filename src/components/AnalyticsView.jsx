import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TrendingUp, TrendingDown, AlertCircle, Package, Droplet, ShoppingCart } from "lucide-react";

const PERIODS = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "1m", label: "1 Month", days: 30 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "6m", label: "6 Months", days: 180 },
];

function groupByCategory(list) {
  const groups = {};
  list.forEach((item) => {
    const catId = item.category_id || "uncategorized";
    if (!groups[catId]) groups[catId] = [];
    groups[catId].push(item);
  });
  return groups;
}

export default function AnalyticsView() {
  const [period, setPeriod] = useState("1m");
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
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

    const [{ data: salesData }, { data: prodData }, { data: catData }, { data: unitRecs }, { data: volRecs }] = await Promise.all([
      supabase.from("pharmacy_sales").select("*").gte("sold_at", cutoffStr),
      supabase.from("pharmacy_products").select("*"),
      supabase.from("pharmacy_categories").select("*"),
      supabase.from("product_sales_last_3_months_unit").select("*"),
      supabase.from("product_sales_last_3_months_volume").select("*"),
    ]);

    setSales(salesData || []);
    setProducts(prodData || []);
    setCategories(catData || []);
    setRecsUnit(unitRecs || []);
    setRecsVolume(volRecs || []);
    setLoading(false);
  }

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading analytics…</p>;
  }

  const categoryNameById = {};
  categories.forEach((c) => {
    categoryNameById[c.id] = c.name;
  });

  const periodDef = PERIODS.find((p) => p.key === period);
  const cutoff = Date.now() - periodDef.days * 24 * 60 * 60 * 1000;
  const inPeriod = sales.filter((s) => new Date(s.sold_at + "T12:00:00").getTime() >= cutoff);

  const productById = {};
  products.forEach((p) => {
    productById[p.id] = p;
  });

  const unitAgg = {};
  const volAgg = {};
  inPeriod.forEach((s) => {
    const prod = productById[s.product_id];
    const isVolumeProduct = prod ? prod.tracking_type === "volume" : s.ml_dispensed != null;

    if (!isVolumeProduct && s.qty) {
      if (!unitAgg[s.product_id]) unitAgg[s.product_id] = { id: s.product_id, name: s.product_name, qty: 0, entries: 0, category_id: prod?.category_id || null };
      unitAgg[s.product_id].qty += s.qty;
      unitAgg[s.product_id].entries += 1;
    } else if (isVolumeProduct && s.ml_dispensed) {
      if (!volAgg[s.product_id]) volAgg[s.product_id] = { id: s.product_id, name: s.product_name, ml: 0, entries: 0, category_id: prod?.category_id || null };
      volAgg[s.product_id].ml += s.ml_dispensed;
      volAgg[s.product_id].entries += 1;
    }
  });

  const unitProducts = products.filter((p) => p.tracking_type !== "volume");
  const volProducts = products.filter((p) => p.tracking_type === "volume");

  const unitList = Object.values(unitAgg).sort((a, b) => b.qty - a.qty);
  const volList = Object.values(volAgg).sort((a, b) => b.entries - a.entries || b.ml - a.ml);

  // A product needs at least this many separate occasions (patients/days) in the
  // window to count as a genuine repeating-demand item. Below this, even a large
  // one-off dispense (e.g. someone taking a 2-month course home at once) doesn't
  // reflect real recurring demand and shouldn't be treated as a top seller or
  // drive a confident reorder number.
  const MIN_OCCASIONS = 3;

  const zeroUnit = unitProducts.filter((p) => !unitAgg[p.id]);
  const zeroVol = volProducts.filter((p) => !volAgg[p.id]);

  const regularUnit = unitList.filter((u) => u.entries >= MIN_OCCASIONS);
  const regularVol = volList.filter((v) => v.entries >= MIN_OCCASIONS);
  const slowUnit = unitList.filter((u) => u.entries > 0 && u.entries < MIN_OCCASIONS);
  const slowVol = volList.filter((v) => v.entries > 0 && v.entries < MIN_OCCASIONS);

  const totalUnitsSold = unitList.reduce((s, u) => s + u.qty, 0);
  const totalMlSold = volList.reduce((s, v) => s + v.ml, 0);
  const topProductName = regularUnit[0]?.name || regularVol[0]?.name || unitList[0]?.name || volList[0]?.name || "—";

  const unitByCategory = groupByCategory(regularUnit);
  const volByCategory = groupByCategory(regularVol);
  const slowUnitByCategory = groupByCategory(slowUnit);
  const slowVolByCategory = groupByCategory(slowVol);
  const zeroUnitByCategory = groupByCategory(zeroUnit);
  const zeroVolByCategory = groupByCategory(zeroVol);

  // True occasion counts (last 90 days) for both unit and volume products — this is
  // what decides whether a product has a genuine repeating pattern, as opposed to
  // one big one-off dispense (e.g. a patient taking a 2-month course home at once).
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const unitFrequency3mo = {};
  const volFrequency3mo = {};
  sales.forEach((s) => {
    if (new Date(s.sold_at + "T12:00:00").getTime() < ninetyDaysAgo) return;
    const prod = productById[s.product_id];
    const isVol = prod ? prod.tracking_type === "volume" : s.ml_dispensed != null;
    if (isVol && s.ml_dispensed) {
      volFrequency3mo[s.product_id] = (volFrequency3mo[s.product_id] || 0) + 1;
    } else if (!isVol && s.qty) {
      unitFrequency3mo[s.product_id] = (unitFrequency3mo[s.product_id] || 0) + 1;
    }
  });

  // Frequently-used items get a bigger safety margin — running out affects more
  // patients, so it's worth ordering a bit extra to avoid a stockout.
  function safetyBuffer(occasions) {
    if (occasions >= 10) return 1.3;
    return 1.15;
  }

  function unitRecommendation(rec) {
    const prod = products.find((p) => p.id === rec.product_id);
    if (!prod || prod.tracking_type === "volume") return null;
    const occasions = unitFrequency3mo[rec.product_id] || 0;
    if (occasions < MIN_OCCASIONS) return null; // irregular one-off — already visible under Slow Moving
    const avg = rec.average_monthly_units;
    const suggested = Math.max(0, Math.ceil(avg * safetyBuffer(occasions) - (prod.stock || 0)));
    if (suggested <= 0) return null;
    return { name: rec.product_name, category_id: prod.category_id, avg, stock: prod.stock, suggested, occasions };
  }

  function volRecommendation(rec) {
    const prod = products.find((p) => p.id === rec.product_id);
    if (!prod || prod.tracking_type !== "volume") return null;
    const occasions = volFrequency3mo[rec.product_id] || 0;
    if (occasions < MIN_OCCASIONS) return null;
    const avg = rec.average_monthly_ml;
    const remaining = prod.remaining_ml || 0;
    const bottleSize = prod.bottle_size_ml || 1;
    const suggestedMl = Math.max(0, avg * safetyBuffer(occasions) - remaining);
    const suggestedBottles = Math.ceil(suggestedMl / bottleSize);
    if (suggestedBottles <= 0) return null;
    return { name: rec.product_name, category_id: prod.category_id, avg, remaining, unit: prod.measure_unit || "ml", bottleSize, suggestedBottles, occasions };
  }

  const unitRecommendations = recsUnit.map(unitRecommendation).filter(Boolean);
  const volRecommendations = recsVolume.map(volRecommendation).filter(Boolean);
  const unitRecsByCategory = groupByCategory(unitRecommendations);
  const volRecsByCategory = groupByCategory(volRecommendations);

  return (
    <div>
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

      <SectionCard title="Top Selling — Pieces" subtitle={`Only medicines used on ${MIN_OCCASIONS}+ separate occasions — genuine repeat demand, not one big one-off order.`}>
        <CategoryGroups groups={unitByCategory} categoryNameById={categoryNameById} emptyText="No products with a regular usage pattern yet." renderItem={(u, i) => <RankRow key={u.id} rank={i + 1} name={u.name} value={`${u.qty} pcs · ${u.entries}× used`} />} />
      </SectionCard>

      <SectionCard title="Top Selling — Measured (ml/g)" subtitle={`Only medicines used on ${MIN_OCCASIONS}+ separate occasions, ranked by how often — a low-dose medicine given to many patients ranks above a rarely-used large-dose one.`}>
        <CategoryGroups groups={volByCategory} categoryNameById={categoryNameById} emptyText="No products with a regular usage pattern yet." renderItem={(v, i) => <RankRow key={v.id} rank={i + 1} name={v.name} value={`${v.entries}× used · ${v.ml} ml/g total`} />} />
      </SectionCard>

      <SectionCard title="Slow Moving" icon={<TrendingDown size={13} color="#B45309" />} subtitle="Used only 1-2 times — includes rare one-off bulk dispenses that aren't a real pattern yet.">
        {Object.keys(slowUnitByCategory).length === 0 && Object.keys(slowVolByCategory).length === 0 ? (
          <EmptyRow text="Nothing slow-moving right now." />
        ) : (
          <>
            <CategoryGroups groups={slowUnitByCategory} categoryNameById={categoryNameById} renderItem={(u) => <RankRow key={u.id} name={u.name} value={`${u.qty} pcs · ${u.entries} sale${u.entries !== 1 ? "s" : ""}`} warn />} />
            <CategoryGroups groups={slowVolByCategory} categoryNameById={categoryNameById} renderItem={(v) => <RankRow key={v.id} name={v.name} value={`${v.ml} ml/g · ${v.entries} sale${v.entries !== 1 ? "s" : ""}`} warn />} />
          </>
        )}
      </SectionCard>

      <SectionCard title="No Sales / Dead Stock" icon={<AlertCircle size={13} color="#DC2626" />}>
        {Object.keys(zeroUnitByCategory).length === 0 && Object.keys(zeroVolByCategory).length === 0 ? (
          <EmptyRow text="Every product has sold at least once in this period." />
        ) : (
          <>
            <CategoryGroups groups={zeroUnitByCategory} categoryNameById={categoryNameById} renderItem={(p) => <RankRow key={p.id} name={p.name} value={`Stock: ${p.stock}`} danger />} />
            <CategoryGroups groups={zeroVolByCategory} categoryNameById={categoryNameById} renderItem={(p) => <RankRow key={p.id} name={p.name} value={`Remaining: ${p.remaining_ml ?? 0}${p.measure_unit || "ml"}`} danger />} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Recommended Next Order" icon={<ShoppingCart size={13} color="#148A7A" />} subtitle={`Only for medicines with a regular pattern (used on ${MIN_OCCASIONS}+ separate occasions in the last 3 months). One-off bulk dispenses (e.g. a patient taking a 2-month course home at once) show up under Slow Moving instead, not here.`}>
        {Object.keys(unitRecsByCategory).length === 0 && Object.keys(volRecsByCategory).length === 0 ? (
          <EmptyRow text="Nothing needs ordering right now, or not enough regular-use history yet." />
        ) : (
          <>
            <CategoryGroups
              groups={unitRecsByCategory}
              categoryNameById={categoryNameById}
              renderItem={(r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "#14B8A61A" }}>
                  <div className="min-w-0">
                    <p style={{ color: "#0A5C54" }}>{r.name}</p>
                    <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Used {r.occasions}× in last 3 months</p>
                  </div>
                  <span className="font-semibold shrink-0" style={{ color: "#148A7A" }}>Order ~{r.suggested} pcs</span>
                </div>
              )}
            />
            <CategoryGroups
              groups={volRecsByCategory}
              categoryNameById={categoryNameById}
              renderItem={(r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: "#14B8A61A" }}>
                  <div className="min-w-0">
                    <p style={{ color: "#0A5C54" }}>{r.name}</p>
                    <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Used {r.occasions}× in last 3 months</p>
                  </div>
                  <span className="font-semibold shrink-0" style={{ color: "#148A7A" }}>Order ~{r.suggestedBottles} bottle{r.suggestedBottles !== 1 ? "s" : ""}</span>
                </div>
              )}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}

function CategoryGroups({ groups, categoryNameById, renderItem, emptyText }) {
  const catIds = Object.keys(groups).sort((a, b) => {
    if (a === "uncategorized") return 1;
    if (b === "uncategorized") return -1;
    return (categoryNameById[a] || "").localeCompare(categoryNameById[b] || "");
  });
  if (catIds.length === 0) return emptyText ? <EmptyRow text={emptyText} /> : null;
  return (
    <>
      {catIds.map((catId) => (
        <div key={catId} className="mb-3 last:mb-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#148A7A" }}>
            {catId === "uncategorized" ? "Uncategorized" : categoryNameById[catId] || "Uncategorized"}
          </p>
          {groups[catId].map(renderItem)}
        </div>
      ))}
    </>
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
