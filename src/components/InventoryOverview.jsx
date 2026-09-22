import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Package, TrendingUp, TrendingDown, AlertCircle, Layers3, Settings2, Save, Check } from "lucide-react";

const PERIODS = [
  { key: "1m", label: "1 Month", days: 30 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "6m", label: "6 Months", days: 180 },
];

const MIN_OCCASIONS = 3;

function money(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function groupByCategory(items) {
  const groups = {};
  items.forEach((item) => {
    const key = item.category_id || "uncategorized";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

export default function InventoryOverview() {
  const [period, setPeriod] = useState("1m");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sales, setSales] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [discounts, setDiscounts] = useState({});
  const [savingCategory, setSavingCategory] = useState(null);
  const [savedCategory, setSavedCategory] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: prodData }, { data: catData }, { data: salesData }] = await Promise.all([
      supabase.from("pharmacy_products").select("*").order("created_at"),
      supabase.from("pharmacy_categories").select("*"),
      // Same sales source used by Pharmacy Analytics. We only need recent history
      // because this screen supports 1/3/6-month demand windows.
      supabase.from("pharmacy_sales").select("product_id, product_name, qty, sold_at").gte("sold_at", new Date(Date.now() - 190 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    ]);

    setProducts(prodData || []);
    const loadedCategories = catData || [];
    setCategories(loadedCategories);
    const discountMap = {};
    loadedCategories.forEach((c) => {
      discountMap[c.id] = Number(c.purchase_discount_percent) || 0;
    });
    setDiscounts(discountMap);
    setSales(salesData || []);
    setLoading(false);
  }

  const categoryNameById = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const unitProducts = useMemo(
    () => products.filter((p) => p.tracking_type === "unit"),
    [products]
  );

  const inventory = useMemo(() => {
    const categoryGroups = {};
    let totalRetailValue = 0;
    let totalPurchaseValue = 0;
    let totalPieces = 0;

    unitProducts.forEach((p) => {
      const stock = Math.max(0, Number(p.stock) || 0);
      const price = Math.max(0, Number(p.price) || 0);
      const retailValue = stock * price;
      const discount = Math.min(100, Math.max(0, Number(discounts[p.category_id]) || 0));
      const purchaseValue = retailValue * (1 - discount / 100);
      totalRetailValue += retailValue;
      totalPurchaseValue += purchaseValue;
      totalPieces += stock;

      const categoryId = p.category_id || "uncategorized";
      if (!categoryGroups[categoryId]) {
        categoryGroups[categoryId] = { id: categoryId, pieces: 0, retailValue: 0, purchaseValue: 0, products: [] };
      }
      categoryGroups[categoryId].pieces += stock;
      categoryGroups[categoryId].retailValue += retailValue;
      categoryGroups[categoryId].purchaseValue += purchaseValue;
      categoryGroups[categoryId].products.push(p);
    });

    return {
      totalRetailValue,
      totalPurchaseValue,
      totalGrossMargin: totalRetailValue - totalPurchaseValue,
      totalPieces,
      categoryGroups,
    };
  }, [unitProducts, discounts]);

  const movement = useMemo(() => {
    const selected = PERIODS.find((p) => p.key === period) || PERIODS[0];
    const cutoff = Date.now() - selected.days * 24 * 60 * 60 * 1000;
    const productIds = new Set(unitProducts.map((p) => p.id));
    const agg = {};

    sales.forEach((s) => {
      if (!productIds.has(s.product_id)) return;
      const soldAt = new Date(`${s.sold_at}T12:00:00`).getTime();
      if (!Number.isFinite(soldAt) || soldAt < cutoff) return;
      if (!s.qty) return;
      if (!agg[s.product_id]) agg[s.product_id] = { occasions: 0, qty: 0 };
      agg[s.product_id].occasions += 1;
      agg[s.product_id].qty += Number(s.qty) || 0;
    });

    const fast = [];
    const slow = [];
    const dead = [];

    unitProducts.forEach((p) => {
      const stats = agg[p.id] || { occasions: 0, qty: 0 };
      const item = {
        ...p,
        stock: Math.max(0, Number(p.stock) || 0),
        value: Math.max(0, Number(p.stock) || 0) * Math.max(0, Number(p.price) || 0),
        discount: Math.min(100, Math.max(0, Number(discounts[p.category_id]) || 0)),
        occasions: stats.occasions,
        qtySold: stats.qty,
      };

      if (stats.occasions >= MIN_OCCASIONS) fast.push(item);
      else if (stats.occasions > 0) slow.push(item);
      else dead.push(item);
    });

    const byValueDesc = (a, b) => b.value - a.value;
    fast.sort(byValueDesc);
    slow.sort(byValueDesc);
    dead.sort(byValueDesc);

    const slowValue = slow.reduce((sum, p) => sum + p.value, 0);
    const deadValue = dead.reduce((sum, p) => sum + p.value, 0);
    const tiedUpValue = slowValue + deadValue;
    const tiedUpPurchaseValue = [...slow, ...dead].reduce((sum, p) => sum + (p.value * (1 - p.discount / 100)), 0);

    return {
      label: selected.label,
      fast,
      slow,
      dead,
      fastValue: fast.reduce((sum, p) => sum + p.value, 0),
      slowValue,
      deadValue,
      tiedUpValue,
      tiedUpPurchaseValue,
      tiedUpGrossMargin: tiedUpValue - tiedUpPurchaseValue,
      tiedUpPercent: inventory.totalRetailValue > 0 ? (tiedUpValue / inventory.totalRetailValue) * 100 : 0,
    };
  }, [period, sales, unitProducts, discounts, inventory.totalRetailValue]);

  async function saveDiscount(categoryId) {
    const value = Math.min(100, Math.max(0, Number(discounts[categoryId]) || 0));
    setSavingCategory(categoryId);
    const { error } = await supabase
      .from("pharmacy_categories")
      .update({ purchase_discount_percent: value })
      .eq("id", categoryId);
    setSavingCategory(null);
    if (!error) {
      setDiscounts((prev) => ({ ...prev, [categoryId]: value }));
      setSavedCategory(categoryId);
      setTimeout(() => setSavedCategory((current) => current === categoryId ? null : current), 1800);
    } else {
      alert(error.message || "Could not save purchase discount.");
    }
  }

  function toggle(key) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading inventory overview…</p>;
  }

  const categoryList = Object.values(inventory.categoryGroups).sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
              <Package size={15} />
              <p className="text-xs font-semibold uppercase tracking-wide">Unit Inventory Value</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#0A5C54" }}>{money(inventory.totalValue)}</p>
            <p className="text-[11px] mt-1" style={{ color: "#0A5C5499" }}>
              {inventory.totalPieces.toLocaleString("en-IN")} pieces currently in stock
            </p>
          </div>
          <div className="rounded-xl px-3 py-2 text-right" style={{ background: "#14B8A61A" }}>
            <p className="text-[10px] uppercase font-semibold" style={{ color: "#148A7A" }}>Tied up</p>
            <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>{money(movement.tiedUpValue)}</p>
            <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{movement.tiedUpPercent.toFixed(0)}% of retail value</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <MiniValue label="Estimated purchase value" value={money(inventory.totalPurchaseValue)} />
          <MiniValue label="Estimated gross margin" value={money(inventory.totalGrossMargin)} />
        </div>
        <p className="text-[10px] mt-3" style={{ color: "#0A5C5466" }}>
          Purchase value is estimated from each category's MR discount rule. It is an estimate, not an invoice-level accounting cost.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricCard icon={<TrendingUp size={13} />} label="Fast moving" value={money(movement.fastValue)} detail={`${movement.fast.length} products`} />
        <MetricCard icon={<TrendingDown size={13} />} label="Slow moving" value={money(movement.slowValue)} detail={`${movement.slow.length} products`} tone="warn" />
        <MetricCard icon={<AlertCircle size={13} />} label="Dead stock" value={money(movement.deadValue)} detail={`${movement.dead.length} products`} tone="danger" />
        <MetricCard icon={<Layers3 size={13} />} label="Tied up" value={money(movement.tiedUpValue)} detail={`${movement.tiedUpPercent.toFixed(0)}% of retail value`} />
      </div>

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

      <SectionCard title="Purchase Discount Rules" subtitle="Set the MR discount once per category. Inventory purchase value and estimated margin update automatically.">
        <div className="space-y-2">
          {categories.length === 0 ? <EmptyRow text="No categories found." /> : categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 py-2 border-b last:border-b-0" style={{ borderColor: "#14B8A61A" }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#0A5C54" }}>{cat.name}</p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Current rule: {Number(discounts[cat.id]) || 0}% off</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={discounts[cat.id] ?? 0}
                  onChange={(e) => setDiscounts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  className="w-16 px-2 py-1.5 rounded-lg border text-xs text-center outline-none"
                  style={{ borderColor: "#14B8A633", color: "#0A5C54" }}
                />
                <span className="text-xs" style={{ color: "#0A5C5499" }}>%</span>
                <button
                  onClick={() => saveDiscount(cat.id)}
                  disabled={savingCategory === cat.id}
                  className="p-2 rounded-lg"
                  style={{ background: "#14B8A61A", color: "#148A7A" }}
                  title="Save discount"
                >
                  {savedCategory === cat.id ? <Check size={14} /> : savingCategory === cat.id ? <span className="text-[10px]">…</span> : <Save size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-xl" style={{ background: "#14B8A60D" }}>
          <Settings2 size={13} className="mt-0.5 shrink-0" color="#148A7A" />
          <p className="text-[10px] leading-relaxed" style={{ color: "#0A5C5499" }}>Example: 40% MR discount means a ₹100 selling-price product has an estimated purchase value of ₹60. Categories left at 0% use the full listed price as the estimate.</p>
        </div>
      </SectionCard>

      <SectionCard title="Category-wise Inventory Value" subtitle="Only individual piece-based products are counted. ml/gram tracked products are excluded.">
        {categoryList.length === 0 ? (
          <EmptyRow text="No unit-based inventory yet." />
        ) : (
          categoryList.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "#14B8A61A" }}>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#0A5C54" }}>
                  {cat.id === "uncategorized" ? "Uncategorized" : categoryNameById[cat.id] || "Uncategorized"}
                </p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{cat.pieces.toLocaleString("en-IN")} pcs</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold" style={{ color: "#148A7A" }}>{money(cat.retailValue)}</p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>Buy {money(cat.purchaseValue)}</p>
              </div>
            </div>
          ))
        )}
      </SectionCard>

      <MovementCard
        id="fast"
        title="Fast Moving Inventory"
        subtitle={`Used on ${MIN_OCCASIONS}+ separate sale occasions in the selected ${movement.label.toLowerCase()} window.`}
        items={movement.fast}
        expanded={expanded.fast}
        onToggle={() => toggle("fast")}
        tone="normal"
      />
      <MovementCard
        id="slow"
        title="Slow Moving Inventory"
        subtitle="Used on 1–2 separate sale occasions in the selected window."
        items={movement.slow}
        expanded={expanded.slow}
        onToggle={() => toggle("slow")}
        tone="warn"
      />
      <MovementCard
        id="dead"
        title="Dead Stock"
        subtitle="No unit sale occasion recorded in the selected window. New products can appear here until they build sales history."
        items={movement.dead}
        expanded={expanded.dead}
        onToggle={() => toggle("dead")}
        tone="danger"
      />
    </div>
  );
}

function MiniValue({ label, value }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: "#14B8A60D" }}>
      <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: "#0A5C54" }}>{value}</p>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone }) {
  const color = tone === "danger" ? "#DC2626" : tone === "warn" ? "#B45309" : "#148A7A";
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}<span className="text-[11px] font-medium uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold" style={{ color: "#0A5C54" }}>{value}</p>
      <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{detail}</p>
    </div>
  );
}

function MovementCard({ title, subtitle, items, expanded, onToggle, tone }) {
  const color = tone === "danger" ? "#DC2626" : tone === "warn" ? "#B45309" : "#148A7A";
  const shown = expanded ? items : items.slice(0, 5);
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            {tone === "danger" ? <AlertCircle size={13} color={color} /> : tone === "warn" ? <TrendingDown size={13} color={color} /> : <TrendingUp size={13} color={color} />}
            <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>{title}</p>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "#0A5C5499" }}>{subtitle}</p>
        </div>
        {items.length > 5 && (
          <button onClick={onToggle} className="text-[10px] font-semibold shrink-0" style={{ color }}>
            {expanded ? "Show less" : `View all (${items.length})`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyRow text={`No ${title.toLowerCase()} products in this period.`} />
      ) : (
        <div className="mt-3">
          {shown.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-xs py-2 border-b last:border-b-0" style={{ borderColor: "#14B8A61A" }}>
              <div className="min-w-0">
                <p className="truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>
                  Stock {p.stock} pcs · {p.occasions} sale{p.occasions !== 1 ? "s" : ""} · {p.qtySold} pcs sold · Buy {money(p.value * (1 - p.discount / 100))}
                </p>
              </div>
              <span className="font-semibold shrink-0" style={{ color }}>{money(p.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>{title}</p>
      {subtitle && <p className="text-[11px] mt-1 mb-2" style={{ color: "#0A5C5499" }}>{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p className="text-xs text-center py-4" style={{ color: "#0A5C5466" }}>{text}</p>;
}
