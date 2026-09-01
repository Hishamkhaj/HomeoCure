import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, Trash2, RotateCcw, Droplet } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

const emptyForm = { product_id: "", bottle_size: "", quantity: "1" };

export default function ReserveView() {
  const [reserves, setReserves] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmUse, setConfirmUse] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: res } = await supabase.from("pharmacy_reserves").select("*").order("created_at");
    const { data: prods } = await supabase.from("pharmacy_products").select("*").eq("tracking_type", "volume");
    setReserves(res || []);
    setProducts(prods || []);
    setLoading(false);
  }

  async function addReserve(e) {
    e.preventDefault();
    const payload = {
      product_id: form.product_id,
      bottle_size: Number(form.bottle_size) || 0,
      quantity: Number(form.quantity) || 1,
    };
    const { data, error } = await supabase.from("pharmacy_reserves").insert(payload).select().single();
    if (error) {
      alert("Could not add reserve: " + error.message);
      return;
    }
    setReserves((prev) => [...prev, data]);
    setForm(emptyForm);
    setShowAdd(false);
  }

  async function deleteReserve(res) {
    await supabase.from("pharmacy_reserves").delete().eq("id", res.id);
    setReserves((prev) => prev.filter((r) => r.id !== res.id));
    setConfirmDelete(null);
  }

  async function useOne(res) {
    const product = products.find((p) => p.id === res.product_id);
    if (!product) return;
    const newRemaining = (product.remaining_ml || 0) + res.bottle_size;
    await supabase.from("pharmacy_products").update({ remaining_ml: newRemaining }).eq("id", product.id);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, remaining_ml: newRemaining } : p)));

    const newQty = res.quantity - 1;
    if (newQty <= 0) {
      await supabase.from("pharmacy_reserves").delete().eq("id", res.id);
      setReserves((prev) => prev.filter((r) => r.id !== res.id));
    } else {
      await supabase.from("pharmacy_reserves").update({ quantity: newQty }).eq("id", res.id);
      setReserves((prev) => prev.map((r) => (r.id === res.id ? { ...r, quantity: newQty } : r)));
    }
    setConfirmUse(null);
  }

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading…</p>;
  }

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: "#0A5C5499" }}>
        Backup bottles kept in reserve. When a main bottle runs out, shift a reserve bottle in — its full size gets added to the main stock.
      </p>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: "#0A5C5499" }}>{reserves.length} reserve entr{reserves.length !== 1 ? "ies" : "y"}</p>
        <button
          onClick={() => {
            setForm(emptyForm);
            setShowAdd(true);
          }}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
        >
          <Plus size={14} /> Add reserve
        </button>
      </div>

      <div className="space-y-2">
        {reserves.map((res) => {
          const product = products.find((p) => p.id === res.product_id);
          return (
            <div key={res.id} className="bg-white rounded-xl p-3.5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1" style={{ color: "#0A5C54" }}>
                    <Droplet size={12} color="#148A7A" /> {product?.name || "Unknown product"}
                  </p>
                  <p className="text-xs" style={{ color: "#0A5C5499" }}>
                    {res.bottle_size}{product?.measure_unit || "ml"} × {res.quantity} bottle{res.quantity !== 1 ? "s" : ""} in reserve
                  </p>
                  {product && (
                    <p className="text-[11px] mt-0.5" style={{ color: "#0A5C5499" }}>
                      Main stock now: {product.remaining_ml ?? 0}{product.measure_unit || "ml"}
                    </p>
                  )}
                </div>
                <button onClick={() => setConfirmDelete(res)} style={{ color: "#DC2626" }} className="shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
              <button
                onClick={() => setConfirmUse(res)}
                className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 text-white"
                style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
              >
                <RotateCcw size={13} /> Shift 1 to main stock
              </button>
            </div>
          );
        })}
        {reserves.length === 0 && (
          <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>
            No reserve bottles registered yet.
          </p>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Add Reserve</h3>
              <button onClick={() => setShowAdd(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={addReserve} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Product</label>
                <select required value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} className={inputClass} style={inputStyle}>
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>Bottle size</label>
                  <input type="number" required value={form.bottle_size} onChange={(e) => setForm((f) => ({ ...f, bottle_size: e.target.value }))} className={inputClass} style={inputStyle} placeholder="e.g. 100" />
                </div>
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>How many bottles</label>
                  <input type="number" required value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className={inputClass} style={inputStyle} />
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Add reserve
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete reserve entry?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deleteReserve(confirmDelete)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmUse && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmUse(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Shift to main stock?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will add {confirmUse.bottle_size}{products.find((p) => p.id === confirmUse.product_id)?.measure_unit || "ml"} to the main stock, and reduce this reserve by one bottle.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmUse(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => useOne(confirmUse)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
