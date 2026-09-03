import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, AlertTriangle, Pencil, Trash2, Search, RotateCcw, Droplet, Pill, EyeOff, Filter } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

const emptyProductForm = {
  name: "",
  price: "",
  unit_label: "",
  stock: "",
  low_stock_threshold: "2",
  tracking_type: "unit",
  measure_unit: "ml",
  bottle_size_ml: "",
  low_volume_threshold_ml: "50",
  source_product_id: "",
};

function parseThreshold(value, fallback) {
  return value === "" || value === null || value === undefined ? fallback : Number(value);
}

export default function PharmacyView() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryVisible, setNewCategoryVisible] = useState(true);
  const [newCategoryShowInRefills, setNewCategoryShowInRefills] = useState(false);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [productForm, setProductForm] = useState(emptyProductForm);

  const [dispenseDrafts, setDispenseDrafts] = useState({});
  const [confirmRefill, setConfirmRefill] = useState(null);
  const [confirmSale, setConfirmSale] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: cats } = await supabase.from("pharmacy_categories").select("*").order("created_at");
    const { data: prods } = await supabase.from("pharmacy_products").select("*").order("created_at");
    setCategories(cats || []);
    setProducts(prods || []);
    if (cats && cats.length && !activeCategory) setActiveCategory(cats[0].id);
    setLoading(false);
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { data, error } = await supabase
      .from("pharmacy_categories")
      .insert({ name: newCategoryName.trim(), patient_visible: newCategoryVisible, show_in_refills: newCategoryShowInRefills })
      .select()
      .single();
    if (!error) {
      setCategories((prev) => [...prev, data]);
      setActiveCategory(data.id);
      setNewCategoryName("");
      setNewCategoryVisible(true);
      setNewCategoryShowInRefills(false);
      setShowAddCategory(false);
    }
  }

  async function saveEditCategory(e) {
    e.preventDefault();
    const { error } = await supabase
      .from("pharmacy_categories")
      .update({ name: editCategory.name, patient_visible: editCategory.patient_visible, show_in_refills: editCategory.show_in_refills })
      .eq("id", editCategory.id);
    if (!error) {
      setCategories((prev) => prev.map((c) => (c.id === editCategory.id ? { ...c, ...editCategory } : c)));
      setEditCategory(null);
    }
  }

  async function deleteCategory(cat) {
    await supabase.from("pharmacy_products").delete().eq("category_id", cat.id);
    const { error } = await supabase.from("pharmacy_categories").delete().eq("id", cat.id);
    if (!error) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setProducts((prev) => prev.filter((p) => p.category_id !== cat.id));
      if (activeCategory === cat.id) setActiveCategory(null);
    }
    setConfirmDeleteCategory(null);
  }

  function buildProductPayload() {
    const isVolume = productForm.tracking_type === "volume";
    return {
      name: productForm.name,
      price: Number(productForm.price) || 0,
      unit_label: productForm.unit_label,
      stock: isVolume ? 0 : Number(productForm.stock) || 0,
      low_stock_threshold: parseThreshold(productForm.low_stock_threshold, 2),
      tracking_type: productForm.tracking_type,
      measure_unit: isVolume ? productForm.measure_unit : null,
      bottle_size_ml: isVolume ? Number(productForm.bottle_size_ml) || 0 : null,
      remaining_ml: isVolume ? Number(productForm.bottle_size_ml) || 0 : null,
      low_volume_threshold_ml: isVolume ? parseThreshold(productForm.low_volume_threshold_ml, 50) : null,
      source_product_id: isVolume && productForm.source_product_id ? productForm.source_product_id : null,
    };
  }

  async function addProduct(e) {
    e.preventDefault();
    const payload = { ...buildProductPayload(), category_id: activeCategory };
    const { data, error } = await supabase.from("pharmacy_products").insert(payload).select().single();
    if (error) {
      alert("Could not add product: " + error.message);
      return;
    }
    setProducts((prev) => [...prev, data]);
    setProductForm(emptyProductForm);
    setShowAddProduct(false);
  }

  function openEditProduct(p) {
    setEditProduct(p);
    setProductForm({
      name: p.name,
      price: String(p.price),
      unit_label: p.unit_label || "",
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold ?? 2),
      tracking_type: p.tracking_type || "unit",
      measure_unit: p.measure_unit || "ml",
      bottle_size_ml: String(p.bottle_size_ml ?? ""),
      low_volume_threshold_ml: String(p.low_volume_threshold_ml ?? 50),
      source_product_id: p.source_product_id || "",
    });
  }

  async function saveEditProduct(e) {
    e.preventDefault();
    const isVolume = productForm.tracking_type === "volume";
    const updates = {
      name: productForm.name,
      price: Number(productForm.price) || 0,
      unit_label: productForm.unit_label,
      stock: isVolume ? editProduct.stock : Number(productForm.stock) || 0,
      low_stock_threshold: parseThreshold(productForm.low_stock_threshold, 2),
      tracking_type: productForm.tracking_type,
      measure_unit: isVolume ? productForm.measure_unit : null,
      bottle_size_ml: isVolume ? Number(productForm.bottle_size_ml) || 0 : null,
      remaining_ml: isVolume ? (editProduct.remaining_ml ?? (Number(productForm.bottle_size_ml) || 0)) : null,
      low_volume_threshold_ml: isVolume ? parseThreshold(productForm.low_volume_threshold_ml, 50) : null,
      source_product_id: isVolume && productForm.source_product_id ? productForm.source_product_id : null,
    };
    const { error } = await supabase.from("pharmacy_products").update(updates).eq("id", editProduct.id);
    if (!error) {
      setProducts((prev) => prev.map((p) => (p.id === editProduct.id ? { ...p, ...updates } : p)));
      setEditProduct(null);
    }
  }

  async function deleteProduct(p) {
    const { error } = await supabase.from("pharmacy_products").delete().eq("id", p.id);
    if (!error) setProducts((prev) => prev.filter((x) => x.id !== p.id));
    setConfirmDeleteProduct(null);
  }

  async function sellOne(product, paymentMode) {
    if (product.stock <= 0) return;
    const newStock = product.stock - 1;
    const { error } = await supabase.from("pharmacy_products").update({ stock: newStock }).eq("id", product.id);
    if (!error) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p)));
      await supabase.from("pharmacy_sales").insert({ product_id: product.id, product_name: product.name, qty: 1, payment_mode: paymentMode });
    }
    setConfirmSale(null);
  }

  async function addStock(product) {
    const newStock = product.stock + 1;
    const { error } = await supabase.from("pharmacy_products").update({ stock: newStock }).eq("id", product.id);
    if (!error) setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p)));
  }

  async function dispenseMl(product) {
    const amt = Number(dispenseDrafts[product.id]);
    if (!amt || amt <= 0) return;
    const newRemaining = Math.max(0, (product.remaining_ml || 0) - amt);
    const { error } = await supabase.from("pharmacy_products").update({ remaining_ml: newRemaining }).eq("id", product.id);
    if (!error) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, remaining_ml: newRemaining } : p)));
      await supabase.from("pharmacy_sales").insert({ product_id: product.id, product_name: product.name, ml_dispensed: amt });
      setDispenseDrafts((d) => ({ ...d, [product.id]: "" }));
    }
  }

  async function refillProduct(product) {
    const full = product.bottle_size_ml || 0;
    const { error } = await supabase.from("pharmacy_products").update({ remaining_ml: full }).eq("id", product.id);
    if (error) {
      setConfirmRefill(null);
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, remaining_ml: full } : p)));

    if (product.source_product_id) {
      const source = products.find((p) => p.id === product.source_product_id);
      if (source) {
        const newSourceRemaining = Math.max(0, (source.remaining_ml || 0) - full);
        const { error: srcErr } = await supabase
          .from("pharmacy_products")
          .update({ remaining_ml: newSourceRemaining })
          .eq("id", source.id);
        if (!srcErr) {
          setProducts((prev) => prev.map((p) => (p.id === source.id ? { ...p, remaining_ml: newSourceRemaining } : p)));
        }
      }
    }
    setConfirmRefill(null);
  }

  function isLowStock(p) {
    if (p.tracking_type === "volume") return (p.remaining_ml ?? 0) <= (p.low_volume_threshold_ml ?? 50);
    return p.stock <= (p.low_stock_threshold ?? 2);
  }

  const searching = query.trim().length > 0;
  let visibleProducts = searching
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products.filter((p) => p.category_id === activeCategory);
  if (showLowStockOnly) visibleProducts = visibleProducts.filter(isLowStock);

  const lowStockCount = products.filter(isLowStock).length;

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading pharmacy…</p>;
  }

  return (
    <div>
      {lowStockCount > 0 && (
        <button
          onClick={() => setShowLowStockOnly((s) => !s)}
          className="w-full flex items-center gap-2 rounded-2xl px-3.5 py-3 mb-4 text-left transition"
          style={{
            background: showLowStockOnly ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#FEF3C7",
            border: showLowStockOnly ? "none" : "1px solid #FDE68A",
          }}
        >
          <AlertTriangle size={16} className="shrink-0" color={showLowStockOnly ? "white" : "#B45309"} />
          <p className="text-xs flex-1" style={{ color: showLowStockOnly ? "white" : "#92400E" }}>
            {lowStockCount} product{lowStockCount > 1 ? "s" : ""} running low
            {showLowStockOnly ? " — showing only these" : " — tap to filter"}
          </p>
          <Filter size={14} color={showLowStockOnly ? "white" : "#B45309"} />
        </button>
      )}

      <div
        className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-3 shadow-sm mb-4"
        style={{ border: "1px solid #14B8A633" }}
      >
        <Search size={16} color="#148A7A" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search medicine across all categories…"
          className="flex-1 outline-none text-sm bg-transparent"
        />
      </div>

      {!searching && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
          {categories.map((c) => (
            <div key={c.id} className="shrink-0 flex items-center gap-1">
              <button
                onClick={() => setActiveCategory(c.id)}
                className="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition"
                style={{
                  background: activeCategory === c.id ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#ffffff",
                  color: activeCategory === c.id ? "white" : "#0A5C54",
                  border: activeCategory === c.id ? "none" : "1px solid #14B8A655",
                  boxShadow: activeCategory === c.id ? "0 2px 6px rgba(10,92,84,0.25)" : "none",
                }}
              >
                {c.patient_visible === false && <EyeOff size={10} />}
                {c.name}
              </button>
              {activeCategory === c.id && (
                <>
                  <button
                    onClick={() => setEditCategory({ id: c.id, name: c.name, patient_visible: c.patient_visible !== false, show_in_refills: c.show_in_refills === true })}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-white shadow-sm"
                    style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteCategory(c)}
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-white shadow-sm"
                    style={{ color: "#DC2626", border: "1px solid #DC262655" }}
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </div>
          ))}
          <button
            onClick={() => setShowAddCategory(true)}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-sm"
            style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
            aria-label="Add category"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {categories.length === 0 && !searching && (
        <p className="text-sm text-center py-10" style={{ color: "#0A5C5466" }}>
          No categories yet — tap "+" above to add one (e.g. Mother Tincture, Dilution, Biochemic).
        </p>
      )}

      {(categories.length > 0 || searching) && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: "#0A5C5499" }}>
              {visibleProducts.length} product{visibleProducts.length !== 1 ? "s" : ""}
              {searching ? " found" : showLowStockOnly ? " low on stock" : ""}
            </p>
            {!searching && (
              <button
                onClick={() => {
                  setProductForm(emptyProductForm);
                  setShowAddProduct(true);
                }}
                className="flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-full text-white"
                style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)", boxShadow: "0 2px 6px rgba(10,92,84,0.25)" }}
              >
                <Plus size={14} /> Add product
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {visibleProducts.map((p) => {
              const isVolume = p.tracking_type === "volume";
              if (isVolume) {
                const unit = p.measure_unit || "ml";
                const remaining = p.remaining_ml ?? 0;
                const size = p.bottle_size_ml || 1;
                const pct = Math.max(0, Math.min(100, Math.round((remaining / size) * 100)));
                const low = remaining <= (p.low_volume_threshold_ml ?? 50);
                return (
                  <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex items-start gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: low ? "#DC26261A" : "#14B8A61A" }}
                        >
                          <Droplet size={15} color={low ? "#DC2626" : "#148A7A"} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                          <p className="text-xs" style={{ color: "#0A5C5499" }}>
                            ₹{p.price} · {remaining}{unit} / {p.bottle_size_ml}{unit}
                          </p>
                        </div>
                      </div>
                      <div
                        className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: low ? "#DC26261A" : "#148A7A1A", color: low ? "#DC2626" : "#0A5C54" }}
                      >
                        {pct}%
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: low ? "#DC2626" : "#148A7A" }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="number"
                        placeholder={`${unit} dispensed`}
                        value={dispenseDrafts[p.id] || ""}
                        onChange={(e) => setDispenseDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        className="flex-1 border rounded-xl px-3 py-2 text-xs outline-none"
                        style={{ borderColor: "#14B8A655" }}
                      />
                      <button
                        onClick={() => dispenseMl(p)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
                      >
                        Dispense
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmRefill(p)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
                        style={{ background: "#14B8A61A", color: "#0A5C54" }}
                      >
                        <RotateCcw size={12} /> Refill / Reset
                      </button>
                      <button
                        onClick={() => openEditProduct(p)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "#F4FAF8", color: "#148A7A" }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteProduct(p)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "#FEF2F2", color: "#DC2626" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              }

              const threshold = p.low_stock_threshold ?? 2;
              const low = p.stock <= threshold;
              return (
                <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: low ? "#DC26261A" : "#14B8A61A" }}
                      >
                        <Pill size={15} color={low ? "#DC2626" : "#148A7A"} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "#0A5C5499" }}>
                          {p.unit_label ? `${p.unit_label} · ` : ""}₹{p.price} · alert at ≤{threshold}
                        </p>
                      </div>
                    </div>
                    <div
                      className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: low ? "#DC26261A" : "#148A7A1A", color: low ? "#DC2626" : "#0A5C54" }}
                    >
                      {p.stock} in stock
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmSale(p)}
                      disabled={p.stock <= 0}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
                    >
                      Sold 1 pc
                    </button>
                    <button
                      onClick={() => addStock(p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "#14B8A61A", color: "#0A5C54" }}
                      aria-label="Add stock"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      onClick={() => openEditProduct(p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "#F4FAF8", color: "#148A7A" }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteProduct(p)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "#FEF2F2", color: "#DC2626" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            {visibleProducts.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: "#0A5C5466" }}>
                {searching ? "No matching products." : showLowStockOnly ? "Nothing low on stock here 🎉" : "No products in this category yet."}
              </p>
            )}
          </div>
        </>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowAddCategory(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>New Category</h3>
              <button onClick={() => setShowAddCategory(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={addCategory}>
              <label className={labelClass} style={labelStyle}>Category name</label>
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Mother Tincture" className={inputClass} style={inputStyle} required />
              <label className="flex items-center gap-2 mt-4 text-sm" style={{ color: "#0A5C54" }}>
                <input type="checkbox" checked={newCategoryVisible} onChange={(e) => setNewCategoryVisible(e.target.checked)} />
                Show this category in patient medicine list
              </label>
              <p className="text-[11px] mt-1" style={{ color: "#0A5C5499" }}>
                Uncheck for pharmacy-only stock (e.g. Dilution bottles used only to refill smaller bottles).
              </p>
              <label className="flex items-center gap-2 mt-4 text-sm" style={{ color: "#0A5C54" }}>
                <input type="checkbox" checked={newCategoryShowInRefills} onChange={(e) => setNewCategoryShowInRefills(e.target.checked)} />
                Show low bottles from this category in Refills list
              </label>
              <p className="text-[11px] mt-1" style={{ color: "#0A5C5499" }}>
                Check this only for working bottles you refill often (e.g. 100ml Dilution). Leave off for Mother Tincture, Biochemic, large Dilution bottles.
              </p>
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Add category
              </button>
            </form>
          </div>
        </div>
      )}

      {editCategory && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setEditCategory(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Edit Category</h3>
              <button onClick={() => setEditCategory(null)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveEditCategory}>
              <label className={labelClass} style={labelStyle}>Category name</label>
              <input value={editCategory.name} onChange={(e) => setEditCategory((c) => ({ ...c, name: e.target.value }))} className={inputClass} style={inputStyle} required />
              <label className="flex items-center gap-2 mt-4 text-sm" style={{ color: "#0A5C54" }}>
                <input type="checkbox" checked={editCategory.patient_visible} onChange={(e) => setEditCategory((c) => ({ ...c, patient_visible: e.target.checked }))} />
                Show this category in patient medicine list
              </label>
              <label className="flex items-center gap-2 mt-4 text-sm" style={{ color: "#0A5C54" }}>
                <input type="checkbox" checked={editCategory.show_in_refills} onChange={(e) => setEditCategory((c) => ({ ...c, show_in_refills: e.target.checked }))} />
                Show low bottles from this category in Refills list
              </label>
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Save changes
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteCategory && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteCategory(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete category?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will delete <strong>{confirmDeleteCategory.name}</strong> and all products inside it. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCategory(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deleteCategory(confirmDeleteCategory)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowAddProduct(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>New Product</h3>
              <button onClick={() => setShowAddProduct(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={addProduct} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Product name</label>
                <input required value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Track by</label>
                <select
                  value={productForm.tracking_type}
                  onChange={(e) => setProductForm((f) => ({ ...f, tracking_type: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="unit">Pieces (bottles, tablets, packets)</option>
                  <option value="volume">Measured (ml or grams)</option>
                </select>
              </div>

              {productForm.tracking_type === "unit" ? (
                <>
                  <div>
                    <label className={labelClass} style={labelStyle}>Quantity / size (e.g. 30ml, 10 tabs)</label>
                    <input value={productForm.unit_label} onChange={(e) => setProductForm((f) => ({ ...f, unit_label: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={labelClass} style={labelStyle}>Price (₹)</label>
                      <input type="number" value={productForm.price} onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} className={inputClass} style={inputStyle} />
                    </div>
                    <div className="flex-1">
                      <label className={labelClass} style={labelStyle}>Current stock</label>
                      <input type="number" value={productForm.stock} onChange={(e) => setProductForm((f) => ({ ...f, stock: e.target.value }))} className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Alert when stock is at or below</label>
                    <input type="number" value={productForm.low_stock_threshold} onChange={(e) => setProductForm((f) => ({ ...f, low_stock_threshold: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass} style={labelStyle}>Unit</label>
                    <select value={productForm.measure_unit} onChange={(e) => setProductForm((f) => ({ ...f, measure_unit: e.target.value }))} className={inputClass} style={inputStyle}>
                      <option value="ml">ml (Mother Tincture, Dilution)</option>
                      <option value="g">grams (Biochemic tablets)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Price (₹, per bottle/box)</label>
                    <input type="number" value={productForm.price} onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>
                      Bottle/box size ({productForm.measure_unit})
                    </label>
                    <input type="number" required value={productForm.bottle_size_ml} onChange={(e) => setProductForm((f) => ({ ...f, bottle_size_ml: e.target.value }))} className={inputClass} style={inputStyle} placeholder="e.g. 500" />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Alert when remaining is at or below ({productForm.measure_unit})</label>
                    <input type="number" value={productForm.low_volume_threshold_ml} onChange={(e) => setProductForm((f) => ({ ...f, low_volume_threshold_ml: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Refill source (optional)</label>
                    <select value={productForm.source_product_id} onChange={(e) => setProductForm((f) => ({ ...f, source_product_id: e.target.value }))} className={inputClass} style={inputStyle}>
                      <option value="">None — track independently</option>
                      {products.filter((p) => p.tracking_type === "volume").map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] mt-1" style={{ color: "#0A5C5499" }}>
                      When you refill this bottle, the same amount is deducted from the linked bottle above (e.g. link a 100ml working bottle to its 500ml Dilution source).
                    </p>
                  </div>
                </>
              )}

              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Add product
              </button>
            </form>
          </div>
        </div>
      )}

      {editProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setEditProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Edit Product</h3>
              <button onClick={() => setEditProduct(null)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveEditProduct} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Product name</label>
                <input required value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Track by</label>
                <select
                  value={productForm.tracking_type}
                  onChange={(e) => setProductForm((f) => ({ ...f, tracking_type: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="unit">Pieces (bottles, tablets, packets)</option>
                  <option value="volume">Measured (ml or grams)</option>
                </select>
              </div>

              {productForm.tracking_type === "unit" ? (
                <>
                  <div>
                    <label className={labelClass} style={labelStyle}>Quantity / size</label>
                    <input value={productForm.unit_label} onChange={(e) => setProductForm((f) => ({ ...f, unit_label: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={labelClass} style={labelStyle}>Price (₹)</label>
                      <input type="number" value={productForm.price} onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} className={inputClass} style={inputStyle} />
                    </div>
                    <div className="flex-1">
                      <label className={labelClass} style={labelStyle}>Current stock</label>
                      <input type="number" value={productForm.stock} onChange={(e) => setProductForm((f) => ({ ...f, stock: e.target.value }))} className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Alert when stock is at or below</label>
                    <input type="number" value={productForm.low_stock_threshold} onChange={(e) => setProductForm((f) => ({ ...f, low_stock_threshold: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass} style={labelStyle}>Unit</label>
                    <select value={productForm.measure_unit} onChange={(e) => setProductForm((f) => ({ ...f, measure_unit: e.target.value }))} className={inputClass} style={inputStyle}>
                      <option value="ml">ml (Mother Tincture, Dilution)</option>
                      <option value="g">grams (Biochemic tablets)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Price (₹, per bottle/box)</label>
                    <input type="number" value={productForm.price} onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Bottle/box size ({productForm.measure_unit})</label>
                    <input type="number" required value={productForm.bottle_size_ml} onChange={(e) => setProductForm((f) => ({ ...f, bottle_size_ml: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Alert when remaining is at or below ({productForm.measure_unit})</label>
                    <input type="number" value={productForm.low_volume_threshold_ml} onChange={(e) => setProductForm((f) => ({ ...f, low_volume_threshold_ml: e.target.value }))} className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelClass} style={labelStyle}>Refill source (optional)</label>
                    <select value={productForm.source_product_id} onChange={(e) => setProductForm((f) => ({ ...f, source_product_id: e.target.value }))} className={inputClass} style={inputStyle}>
                      <option value="">None — track independently</option>
                      {products.filter((p) => p.tracking_type === "volume" && p.id !== editProduct?.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] mt-1" style={{ color: "#0A5C5499" }}>
                      When you refill this bottle, the same amount is deducted from the linked bottle above.
                    </p>
                  </div>
                  <p className="text-[11px]" style={{ color: "#0A5C5499" }}>
                    Changing bottle/box size doesn't reset current remaining amount — use "Refill / Reset" on the product card for that.
                  </p>
                </>
              )}

              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Save changes
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteProduct(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete product?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will permanently delete <strong>{confirmDeleteProduct.name}</strong>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteProduct(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deleteProduct(confirmDeleteProduct)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRefill && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmRefill(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Refill / Reset?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will reset <strong>{confirmRefill.name}</strong> back to full — {confirmRefill.bottle_size_ml}{confirmRefill.measure_unit || "ml"}. Use this when you open a new bottle/box.
            </p>
            {confirmRefill.source_product_id && (
              <p className="text-xs mb-3" style={{ color: "#148A7A" }}>
                This will also deduct {confirmRefill.bottle_size_ml}{confirmRefill.measure_unit || "ml"} from{" "}
                {products.find((p) => p.id === confirmRefill.source_product_id)?.name || "the linked bottle"}.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmRefill(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => refillProduct(confirmRefill)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Refill
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSale && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmSale(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Payment mode?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              Selling 1 <strong>{confirmSale.name}</strong> — ₹{confirmSale.price}. How was it paid?
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => sellOne(confirmSale, "cash")} className="py-3 rounded-xl text-sm font-semibold" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                Cash
              </button>
              <button onClick={() => sellOne(confirmSale, "upi")} className="py-3 rounded-xl text-sm font-semibold" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                UPI
              </button>
              <button onClick={() => sellOne(confirmSale, "card")} className="py-3 rounded-xl text-sm font-semibold" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                Card
              </button>
            </div>
            <button onClick={() => setConfirmSale(null)} className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
