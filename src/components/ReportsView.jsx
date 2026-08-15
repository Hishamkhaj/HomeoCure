import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Calendar, Package, IndianRupee, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

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
  const [expandedDate, setExpandedDate] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);

  useEffect(() => {
    if (subTab === "sales") fetchSales();
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

  const dailyMap = {};
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      const d = dateStrFromTs(v.ts);
      if (!dailyMap[d]) dailyMap[d] = [];
      dailyMap[d].push({ name: p.name, complaint: v.complaint });
    });
  });
  const dailyDates = Object.keys(dailyMap).sort((a, b) => (a < b ? 1 : -1));

  const salesByDate = {};
  sales.forEach((s) => {
    const d = s.sold_at || "unknown";
    if (!salesByDate[d]) salesByDate[d] = [];
    salesByDate[d].push(s);
  });
  const salesDates = Object.keys(salesByDate).sort((a, b) => (a < b ? 1 : -1));

  const pendingPatients = patients
    .map((p) => {
      const due = (p.visits || []).reduce((sum, v) => sum + Math.max(0, (v.cost || 0) - (v.paid_amount ?? v.cost ?? 0)), 0);
      return { ...p, due };
    })
    .filter((p) => p.due > 0)
    .sort((a, b) => b.due - a.due);
  const totalPending = pendingPatients.reduce((sum, p) => sum + p.due, 0);

  async function handleMarkPaid(patient) {
    setMarkingPaid(patient.id);
    await onMarkPaid(patient);
    setMarkingPaid(null);
  }

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
          Daily Patients
        </button>
        <button
          onClick={() => setSubTab("sales")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "sales" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "sales" ? "white" : "#0A5C54",
          }}
        >
          Sales Log
        </button>
        <button
          onClick={() => setSubTab("pending")}
          className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
          style={{
            background: subTab === "pending" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
            color: subTab === "pending" ? "white" : "#0A5C54",
          }}
        >
          Pending
        </button>
      </div>

      {subTab === "daily" && (
        <div className="space-y-2">
          {dailyDates.length === 0 && (
            <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>No visits recorded yet.</p>
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
      )}

      {subTab === "sales" && (
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
    </div>
  );
        }
