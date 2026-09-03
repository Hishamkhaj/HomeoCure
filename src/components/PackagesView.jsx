import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, Pencil, Trash2, Layers, IndianRupee, Clock, Calculator as CalcIcon } from "lucide-react";
import MedicineSelector from "./MedicineSelector";
import Calculator from "./Calculator";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

const emptyTierForm = { label: "", duration_days: "7", price: "", mr_commission: "" };

export default function PackagesView() {
  const [packages, setPackages] = useState([]);
  const [activePackage, setActivePackage] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddPackage, setShowAddPackage] = useState(false);
  const [editPackage, setEditPackage] = useState(null);
  const [confirmDeletePackage, setConfirmDeletePackage] = useState(null);
  const [newPackageName, setNewPackageName] = useState("");

  const [showTierForm, setShowTierForm] = useState(false);
  const [editTier, setEditTier] = useState(null); // tier being edited, or null for new
  const [tierForm, setTierForm] = useState(emptyTierForm);
  const [tierItems, setTierItems] = useState([]);
  const [confirmDeleteTier, setConfirmDeleteTier] = useState(null);
  const [calcField, setCalcField] = useState(null); // "price" | "mr_commission" | null

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: pkgs } = await supabase.from("disease_packages").select("*").order("created_at");
    const { data: prods } = await supabase.from("pharmacy_products").select("*");
    setPackages(pkgs || []);
    setProducts(prods || []);
    if (pkgs && pkgs.length && !activePackage) {
      setActivePackage(pkgs[0].id);
      await loadTiers(pkgs[0].id);
    }
    setLoading(false);
  }

  async function loadTiers(packageId) {
    const { data } = await supabase
      .from("package_tiers")
      .select("*, package_tier_items(*)")
      .eq("package_id", packageId)
      .order("duration_days");
    setTiers(data || []);
  }

  async function selectPackage(id) {
    setActivePackage(id);
    await loadTiers(id);
  }

  async function addPackage(e) {
    e.preventDefault();
    if (!newPackageName.trim()) return;
    const { data, error } = await supabase.from("disease_packages").insert({ name: newPackageName.trim() }).select().single();
    if (!error) {
      setPackages((prev) => [...prev, data]);
      setNewPackageName("");
      setShowAddPackage(false);
      selectPackage(data.id);
    }
  }

  async function saveEditPackage(e) {
    e.preventDefault();
    const { error } = await supabase.from("disease_packages").update({ name: editPackage.name }).eq("id", editPackage.id);
    if (!error) {
      setPackages((prev) => prev.map((p) => (p.id === editPackage.id ? { ...p, name: editPackage.name } : p)));
      setEditPackage(null);
    }
  }

  async function deletePackage(pkg) {
    await supabase.from("disease_packages").delete().eq("id", pkg.id);
    setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
    if (activePackage === pkg.id) {
      setActivePackage(null);
      setTiers([]);
    }
    setConfirmDeletePackage(null);
  }

  function openAddTier() {
    setEditTier(null);
    setTierForm(emptyTierForm);
    setTierItems([]);
    setShowTierForm(true);
  }

  function openEditTier(tier) {
    setEditTier(tier);
    setTierForm({
      label: tier.label,
      duration_days: String(tier.duration_days),
      price: String(tier.price),
      mr_commission: String(tier.mr_commission),
    });
    const items = (tier.package_tier_items || []).map((it) => {
      const prod = products.find((p) => p.id === it.product_id);
      if (prod && prod.tracking_type === "volume") {
        return { product_id: it.product_id, name: it.product_name, ml: it.amount, unit: prod.measure_unit || "ml" };
      }
      return { product_id: it.product_id, name: it.product_name, qty: it.amount };
    });
    setTierItems(items);
    setShowTierForm(true);
  }

  async function saveTier(e) {
    e.preventDefault();
    const payload = {
      package_id: activePackage,
      label: tierForm.label,
      duration_days: Number(tierForm.duration_days) || 7,
      price: Number(tierForm.price) || 0,
      mr_commission: Number(tierForm.mr_commission) || 0,
    };

    let tierId = editTier?.id;
    if (editTier) {
      const { error } = await supabase.from("package_tiers").update(payload).eq("id", editTier.id);
      if (error) {
        alert("Could not save tier: " + error.message);
        return;
      }
      await supabase.from("package_tier_items").delete().eq("tier_id", editTier.id);
    } else {
      const { data, error } = await supabase.from("package_tiers").insert(payload).select().single();
      if (error) {
        alert("Could not save tier: " + error.message);
        return;
      }
      tierId = data.id;
    }

    if (tierItems.length > 0) {
      const rows = tierItems.map((it) => ({
        tier_id: tierId,
        product_id: it.product_id,
        product_name: it.name,
        amount: it.ml ?? it.qty ?? 1,
      }));
      await supabase.from("package_tier_items").insert(rows);
    }

    setShowTierForm(false);
    setEditTier(null);
    loadTiers(activePackage);
  }

  async function deleteTier(tier) {
    await supabase.from("package_tiers").delete().eq("id", tier.id);
    setTiers((prev) => prev.filter((t) => t.id !== tier.id));
    setConfirmDeleteTier(null);
  }

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading packages…</p>;
  }

  const activePkgObj = packages.find((p) => p.id === activePackage);

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: "#0A5C5499" }}>
        Set up disease packages once — each with duration tiers that auto-fill medicines, price, and MR commission at patient visit time.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
        {packages.map((pkg) => (
          <div key={pkg.id} className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => selectPackage(pkg.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={{
                background: activePackage === pkg.id ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#ffffff",
                color: activePackage === pkg.id ? "white" : "#0A5C54",
                border: activePackage === pkg.id ? "none" : "1px solid #14B8A655",
              }}
            >
              {pkg.name}
            </button>
            {activePackage === pkg.id && (
              <>
                <button
                  onClick={() => setEditPackage({ id: pkg.id, name: pkg.name })}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm"
                  style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => setConfirmDeletePackage(pkg)}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm"
                  style={{ color: "#DC2626", border: "1px solid #DC262655" }}
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowAddPackage(true)}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm"
          style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
        >
          <Plus size={16} />
        </button>
      </div>

      {packages.length === 0 && (
        <p className="text-sm text-center py-10" style={{ color: "#0A5C5466" }}>
          No packages yet — tap "+" above to add one (e.g. "Kidney Stone – Right").
        </p>
      )}

      {activePkgObj && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: "#0A5C5499" }}>
              {tiers.length} tier{tiers.length !== 1 ? "s" : ""} for {activePkgObj.name}
            </p>
            <button
              onClick={openAddTier}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
              style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
            >
              <Plus size={14} /> Add tier
            </button>
          </div>

          <div className="space-y-2">
            {tiers.map((tier) => (
              <div key={tier.id} className="bg-white rounded-xl p-3.5 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#0A5C54" }}>{tier.label}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#0A5C5499" }}>
                        <Clock size={11} /> {tier.duration_days} days
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#0A5C5499" }}>
                        <IndianRupee size={11} /> {tier.price}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#0A5C5499" }}>
                        <Layers size={11} /> {(tier.package_tier_items || []).length} items
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEditTier(tier)} style={{ color: "#148A7A" }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setConfirmDeleteTier(tier)} style={{ color: "#DC2626" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {tier.package_tier_items && tier.package_tier_items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t" style={{ borderColor: "#14B8A633" }}>
                    {tier.package_tier_items.map((it) => (
                      <span key={it.id} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                        {it.product_name} × {it.amount}
                      </span>
                    ))}
                  </div>
                )}
                {tier.mr_commission > 0 && (
                  <p className="text-[11px] mt-2" style={{ color: "#0A5C5499" }}>MR commission: ₹{tier.mr_commission}</p>
                )}
              </div>
            ))}
            {tiers.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: "#0A5C5466" }}>
                No duration tiers yet — add one (e.g. "1 Week").
              </p>
            )}
          </div>
        </>
      )}

      {showAddPackage && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowAddPackage(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>New Package</h3>
              <button onClick={() => setShowAddPackage(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={addPackage}>
              <label className={labelClass} style={labelStyle}>Disease / package name</label>
              <input value={newPackageName} onChange={(e) => setNewPackageName(e.target.value)} placeholder="e.g. Kidney Stone – Right" className={inputClass} style={inputStyle} required />
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Add package
              </button>
            </form>
          </div>
        </div>
      )}

      {editPackage && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setEditPackage(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Edit Package</h3>
              <button onClick={() => setEditPackage(null)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveEditPackage}>
              <label className={labelClass} style={labelStyle}>Disease / package name</label>
              <input value={editPackage.name} onChange={(e) => setEditPackage((p) => ({ ...p, name: e.target.value }))} className={inputClass} style={inputStyle} required />
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Save changes
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDeletePackage && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeletePackage(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete package?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will delete <strong>{confirmDeletePackage.name}</strong> and all its duration tiers. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeletePackage(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deletePackage(confirmDeletePackage)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteTier && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteTier(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete tier?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will delete <strong>{confirmDeleteTier.label}</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteTier(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deleteTier(confirmDeleteTier)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showTierForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowTierForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>
                {editTier ? "Edit Tier" : "New Tier"}
              </h3>
              <button onClick={() => setShowTierForm(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveTier} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Tier label</label>
                <input required value={tierForm.label} onChange={(e) => setTierForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. 1 Week" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Duration (days)</label>
                <input type="number" required value={tierForm.duration_days} onChange={(e) => setTierForm((f) => ({ ...f, duration_days: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>Price (₹)</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={tierForm.price} onChange={(e) => setTierForm((f) => ({ ...f, price: e.target.value }))} className={inputClass} style={inputStyle} />
                    <button type="button" onClick={() => setCalcField("price")} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                      <CalcIcon size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>MR commission (₹)</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={tierForm.mr_commission} onChange={(e) => setTierForm((f) => ({ ...f, mr_commission: e.target.value }))} className={inputClass} style={inputStyle} />
                    <button type="button" onClick={() => setCalcField("mr_commission")} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                      <CalcIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Medicines in this tier</label>
                <MedicineSelector value={tierItems} onChange={setTierItems} />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                {editTier ? "Save changes" : "Add tier"}
              </button>
            </form>
          </div>
        </div>
      )}

      {calcField && (
        <Calculator
          label={calcField === "price" ? "Price" : "MR commission"}
          initialValue={tierForm[calcField]}
          onClose={() => setCalcField(null)}
          onUse={(val) => {
            setTierForm((f) => ({ ...f, [calcField]: val }));
            setCalcField(null);
          }}
        />
      )}
    </div>
  );
}
