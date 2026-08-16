import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Calendar, Package, IndianRupee, ChevronDown, ChevronUp, CheckCircle, Droplet, RotateCcw, Search } from "lucide-react";

const SUGGESTION_THRESHOLD = 30;

function dateStrFromTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateStr(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReportsView({ patients, onMarkPaid }) {
  const [subTab, setSubTab] = useState("daily");
  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [pharmacyProducts, setPharmacyProducts] = useState([]);
  const [pharmacyCategories, setPharmacyCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [refilling, setRefilling] = useState(null);
  const [dailyQuery, setDailyQuery] = useState("");
  const [salesQuery, setSalesQuery] = useState("");

  useEffect(() => {
    if (subTab === "sales") fetchSales();
    if (subTab === "refills" || subTab === "orders") fetchProducts();
  }, [subTab]);

  async function fetchSales() {
    setLoadingSales(true);
    const { data } = await supabase
      .from("pharmacy_sales")
      .select("*")
      .order("sold_at", { ascending: false });
    setSales(data || []);
    setLoadingSales(false);
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    const { data: prods } = await supabase.from("pharmacy_products").select("*");
    const { data: cats } = await supabase.from("pharmacy_categories").select("*");
    setPharmacyProducts(prods || []);
    setPharmacyCategories(cats || []);
    setLoadingProducts(false);
  }

  const dailyMap = {};
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      const d = dateStrFromTs(v.ts);
      if (!dailyMap[d]) dailyMap[d] = [];
      dailyMap[d].push({ name: p.name, complaint: v.complaint });
    });
  });
  const dailyQueryLower = dailyQuery.trim().toLowerCase();
  const dailyDates = Object.keys(dailyMap)
    .filter((d) => {
      if (!dailyQueryLower) return true;
      if (formatDateStr(d).toLowerCase().includes(dailyQueryLower)) return true;
      return dailyMap[d].some((v) => v.name.toLowerCase().includes(dailyQueryLower));
    })
    .sort((a, b) => (a < b ? 1 : -1));

  const salesByDate = {};
  sales.forEach((s) => {
    const d = s.sold_at || "unknown";
    if (!salesByDate[d]) salesByDate[d] = [];
    salesByDate[d].push(s);
  });
  const salesQueryLower = salesQuery.trim().toLowerCase();
  const salesDates = Object.keys(salesByDate)
    .filter((d) => {
      if (!salesQueryLower) return true;
      if (d !== "unknown" && formatDateStr(d).toLowerCase().includes(salesQueryLower)) return true;
      return salesByDate[d].some((s) => (s.product_name || "").toLowerCase().includes(salesQueryLower));
    })
    .sort((a, b) => (a < b ? 1 : -1));

  const pendingPatients = patients
    .map((p) => {
      const due = (p.visits || []).reduce((sum, v) => sum + Math.max(0, (v.cost || 0) - (v.paid_amount ?? v.cost ?? 0)), 0);
      return { ...p, due };
    })
    .filter((p) => p.due > 0)
    .sort((a, b) => b.due - a.due);
  const totalPending = pendingPatients.reduce((sum, p) => sum + p.due, 0);

  const refillEnabledCategoryIds = new Set(pharmacyCategories.filter((c) => c.show_in_refills === true).map((c) => c.id));
  const refillList = pharmacyProducts
    .filter((p) => p.tracking_type === "volume" && refillEnabledCategoryIds.has(p.category_id))
    .map((p) => {
      const remaining = p.remaining_ml ?? 0;
      const ownThreshold = p.low_volume_threshold_ml ?? 50;
      const due = remaining <= ownThreshold;
      const suggested = !due && remaining <= SUGGESTION_THRESHOLD;
      return { ...p, remaining, due, suggested };
    })
    .filter((p) => p.due || p.suggested)
    .sort((a, b) => a.remaining - b.remaining);

  const categoryNameById = {};
  pharmacyCategories.forEach((c) => {
    categoryNameById[c.id] = c.name;
  });

  const unitOrderList = pharmacyProducts
    .filter((p) => p.tracking_type !== "volume" && p.stock <= (p.low_stock_threshold ?? 2))
    .sort((a, b) => a.stock - b.stock);

  const measuredOrderList = pharmacyProducts
    .filter((p) => p.tracking_type === "volume" && (p.remaining_ml ?? 0) <= (p.low_volume_threshold_ml ?? 50))
    .sort((a, b) => (a.remaining_ml ?? 0) - (b.remaining_ml ?? 0));

  async function handleMarkPaid(patient) {
    setMarkingPaid(patient.id);
    await onMarkPaid(patient);
    setMarkingPaid(null);
  }

  async function handleRefill(product) {
    setRefilling(product.id);
    const full = product.bottle_size_ml || 0;
    const { error } = await supabase.from("pharmacy_products").update({ remaining_ml: full }).eq("id", product.id);
    if (!error) {
      let updated = pharmacyProducts.map((p) => (p.id === product.id ? { ...p, remaining_ml: full } : p));
      if (product.source_product_id) {
        const source = pharmacyProducts.find((p) => p.id === product.source_product_id);
        if (source) {
          const newSourceRemaining = Math.max(0, (source.remaining_ml || 0) - full);
          await supabase.from("pharmacy_products").update({ remaining_ml: newSourceRemaining }).eq("id", source.id);
          updated = updated.map((p) => (p.id === source.id ? { ...p, remaining_ml: newSourceRemaining } : p));
        }
      }
      setPharmacyProducts(updated);
    }
    setRefilling(null);
  }

  const refillDueCount = refillList.filter((p) => p.due).length;

  return (
    <div>
      <div className="flex gap-1.5 mb-4 bg-white/60 rounded-xl p-1 overflow-x-auto">
        <button
          onClick={() => setSubTab("daily")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
          style={{
            background: subTab === "daily" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "daily" ? "white" : "#0A5C54",
          }}
        >
          Daily
        </button>
        <button
          onClick={() => setSubTab("sales")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
          style={{
            background: subTab === "sales" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "sales" ? "white" : "#0A5C54",
          }}
        >
          Sales
        </button>
        <button
          onClick={() => setSubTab("pending")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
          style={{
            background: subTab === "pending" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "pending" ? "white" : "#0A5C54",
          }}
        >
          Pending
        </button>
        <button
          onClick={() => setSubTab("refills")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition relative whitespace-nowrap"
          style={{
            background: subTab === "refills" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "refills" ? "white" : "#0A5C54",
          }}
        >
          Refills
          {refillDueCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white font-bold"
              style={{ background: "#DC2626" }}
            >
              {refillDueCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("orders")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition relative whitespace-nowrap"
          style={{
            background: subTab === "orders" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "orders" ? "white" : "#0A5C54",
          }}
        >
          Orders
          {(unitOrderList.length + measuredOrderList.length) > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white font-bold"
              style={{ background: "#DC2626" }}
            >
              {unitOrderList.length + measuredOrderList.length}
            </span>
          )}
        </button>
      </div>

      {subTab === "daily" && (
        <div>
          <div
            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm mb-3"
            style={{ border: "1px solid #14B8A633" }}
          >
            <Search size={16} color="#148A7A" />
            <input
              value={dailyQuery}
              onChange={(e) => setDailyQuery(e.target.value)}
              placeholder="Search by patient name or date…"
              className="flex-1 outline-none text-sm bg-transparent"
            />
          </div>
          <div className="space-y-2">
          {dailyDates.length === 0 && (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>No visits found.</p>
          )}
          {dailyDates.map((d) => (
            <div key={d} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedDate(expandedDate === d ? null : d)}
                className="w-full flex items-center justify-between p-3.5"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={14} color="#148A7A" />
                  <span className="text-sm font-medium" style={{ color: "#0A5C54" }}>{formatDateStr(d)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                    {dailyMap[d].length} patient{dailyMap[d].length !== 1 ? "s" : ""}
                  </span>
                  {expandedDate === d ? <ChevronUp size={14} color="#0A5C5499" /> : <ChevronDown size={14} color="#0A5C5499" />}
                </div>
              </button>
              {expandedDate === d && (
                <div className="px-3.5 pb-3.5 space-y-1.5">
                  {dailyMap[d].map((v, i) => (
                    <div key={i} className="text-xs flex items-center justify-between border-t pt-1.5" style={{ borderColor: "#14B8A633" }}>
                      <span style={{ color: "#0A5C54" }}>{v.name}</span>
                      <span style={{ color: "#0A5C5499" }}>{v.complaint}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {subTab === "sales" && (
        <div>
          <div
            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm mb-3"
            style={{ border: "1px solid #14B8A633" }}
          >
            <Search size={16} color="#148A7A" />
            <input
              value={salesQuery}
              onChange={(e) => setSalesQuery(e.target.value)}
              placeholder="Search by product name or date…"
              className="flex-1 outline-none text-sm bg-transparent"
            />
          </div>
          <div className="space-y-2">
          {loadingSales ? (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5499" }}>Loading…</p>
          ) : salesDates.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>No sales recorded yet.</p>
          ) : (
            salesDates.map((d) => (
              <div key={d} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedDate(expandedDate === `sale-${d}` ? null : `sale-${d}`)}
                  className="w-full flex items-center justify-between p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <Package size={14} color="#148A7A" />
                    <span className="text-sm font-medium" style={{ color: "#0A5C54" }}>
                      {d === "unknown" ? "Unknown date" : formatDateStr(d)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                      {salesByDate[d].length} sold
                    </span>
                    {expandedDate === `sale-${d}` ? <ChevronUp size={14} color="#0A5C5499" /> : <ChevronDown size={14} color="#0A5C5499" />}
                  </div>
                </button>
                {expandedDate === `sale-${d}` && (
                  <div className="px-3.5 pb-3.5 space-y-1.5">
                    {salesByDate[d].map((s, i) => (
                      <div key={i} className="text-xs flex items-center justify-between border-t pt-1.5" style={{ borderColor: "#14B8A633" }}>
                        <span style={{ color: "#0A5C54" }}>{s.product_name}</span>
                        <span style={{ color: "#0A5C5499" }}>
                          {s.ml_dispensed ? `${s.ml_dispensed} used` : `× ${s.qty}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          </div>
        </div>
      )}

      {subTab === "pending" && (
        <div>
          <div className="bg-white rounded-xl p-4 shadow-sm mb-3 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "#0A5C54" }}>Total pending</span>
            <span className="text-lg font-bold" style={{ color: "#DC2626" }}>₹{totalPending}</span>
          </div>
          <div className="space-y-2">
            {pendingPatients.length === 0 && (
              <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>No pending payments 🎉</p>
            )}
            {pendingPatients.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: "#DC2626" }}>
                    <IndianRupee size={11} /> {p.due} due
                  </p>
                </div>
                <button
                  onClick={() => handleMarkPaid(p)}
                  disabled={markingPaid === p.id}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white shrink-0 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
                >
                  <CheckCircle size={12} /> {markingPaid === p.id ? "…" : "Mark Paid"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "refills" && (
        <div>
          <p className="text-xs mb-3" style={{ color: "#0A5C5499" }}>
            Bottles due for refill, plus nearby bottles under {SUGGESTION_THRESHOLD}ml/g worth refilling while the cabinet is open.
          </p>
          {loadingProducts ? (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5499" }}>Loading…</p>
          ) : refillList.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>Nothing needs refilling right now 🎉</p>
          ) : (
            <div className="space-y-2">
              {refillList.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <Droplet size={14} color={p.due ? "#DC2626" : "#B45309"} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                      <p className="text-xs" style={{ color: p.due ? "#DC2626" : "#B45309" }}>
                        {p.remaining}{p.measure_unit || "ml"} left {p.due ? "· due" : "· suggested"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRefill(p)}
                    disabled={refilling === p.id}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white shrink-0 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
                  >
                    <RotateCcw size={12} /> {refilling === p.id ? "…" : "Mark Refilled"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "orders" && (
        <div>
          <p className="text-xs mb-4" style={{ color: "#0A5C5499" }}>
            Auto-generated from current stock — items disappear once you update stock in Pharmacy after restocking.
          </p>

          {loadingProducts ? (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5499" }}>Loading…</p>
          ) : (
            <>
              {/* Pieces section */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1" style={{ background: "#14B8A655" }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#0A5C54" }}>
                  Pieces to order
                </p>
                <div className="h-px flex-1" style={{ background: "#14B8A655" }} />
              </div>
              {unitOrderList.length === 0 ? (
                <p className="text-center text-xs py-6" style={{ color: "#0A5C5466" }}>Nothing to order 🎉</p>
              ) : (
                <div className="space-y-2 mb-6">
                  {unitOrderList.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "#0A5C5499" }}>
                          {categoryNameById[p.category_id] || ""}
                        </p>
                      </div>
                      <div
                        className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: "#DC26261A", color: "#DC2626" }}
                      >
                        {p.stock} left
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Measured section */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1" style={{ background: "#14B8A655" }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#0A5C54" }}>
                  Measured to order (ml / g)
                </p>
                <div className="h-px flex-1" style={{ background: "#14B8A655" }} />
              </div>
              {measuredOrderList.length === 0 ? (
                <p className="text-center text-xs py-6" style={{ color: "#0A5C5466" }}>Nothing to order 🎉</p>
              ) : (
                <div className="space-y-2">
                  {measuredOrderList.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center justify-between">
                      <div className="min-w-0 flex items-center gap-2">
                        <Droplet size={13} color="#DC2626" className="shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                          <p className="text-xs" style={{ color: "#0A5C5499" }}>
                            {categoryNameById[p.category_id] || ""}
                          </p>
                        </div>
                      </div>
                      <div
                        className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: "#DC26261A", color: "#DC2626" }}
                      >
                        {p.remaining_ml ?? 0}{p.measure_unit || "ml"} left
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
