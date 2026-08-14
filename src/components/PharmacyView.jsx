import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, AlertTriangle, Pencil, Trash2, Search } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

export default function PharmacyView() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", price: "", unit_label: "", stock: "", low_stock_threshold: "2" });

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
    const { data, error } = await supabase.from("pharmacy_categories").insert({ name: newCategoryName.trim() }).select().single();
    if (!error) {
      setCategories((prev) => [...prev, data]);
      setActiveCategory(data.id);
      setNewCategoryName("");
      setShowAddCategory(false);
    }
  }

  async function saveEditCategory(e) {
    e.preventDefault();
    const { error } = await supabase.from("pharmacy_categories").update({ name: editCategory.name }).eq("id", editCategory.id);
    if (!error) {
      setCategories((prev) => prev.map((c) => (c.id === editCategory.id ? { ...c, name: editCategory.name } : c)));
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

  async function addProduct(e) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("pharmacy_products")
      .insert({
        category_id: activeCategory,
        name: productForm.name,
        price: Number(productForm.price) || 0,
        unit_label: productForm.unit_label,
        stock: Number(productForm.stock) || 0,
        low_stock_threshold: Number(productForm.low_stock_threshold) || 2,
      })
      .select()
      .single();
    if (!error) {
      setProducts((prev) => [...prev, data]);
      setProductForm({ name: "", price: "", unit_label: "", stock: "", low_stock_threshold: "2" });
      setShowAddProduct(false);
    }
  }

  function openEditProduct(p) {
    setEditProduct(p);
    setProductForm({
      name: p.name,
      price: String(p.price),
      unit_label: p.unit_label || "",
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold ?? 2),
    });
  }

  async function saveEditProduct(e) {
    e.preventDefault();
    const updates = {
      name: productForm.name,
      price: Number(productForm.price) || 0,
      unit_label: productForm.unit_label,
      stock: Number(productForm.stock) || 0,
      low_stock_threshold: Number(productForm.low_stock_threshold) || 2,
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

  async function sellOne(product) {
    if (product.stock <= 0) return;
    const newStock = product.stock - 1;
    const { error } = await supabase.from("pharmacy_products").update({ stock: newStock }).eq("id", product.id);
    if (!error) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p)));
      await supabase.from("pharmacy_sales").insert({ product_id: product.id, product_name: product.name, qty: 1 });
    }
  }

  async function addStock(product) {
    const newStock = product.stock + 1;
    const { error } = await supabase.from("pharmacy_products").update({ stock: newStock }).eq("id", product.id);
    if (!error) setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p)));
  }

  const searching = query.trim().length > 0;
  const visibleProducts = searching
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products.filter((p) => p.category_id === activeCategory);
  const lowStockCount = products.filter((p) => p.stock <= (p.low_stock_threshold ?? 2)).length;

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading pharmacy…</p>;
  }

  return (
    <div>
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            {lowStockCount} product{lowStockCount > 1 ? "s" : ""} running low — reorder soon
          </p>
        </div>
      )}

      <div
        className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm mb-4"
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
                className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                style={{
                  background: activeCategory === c.id ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#ffffff",
                  color: activeCategory === c.id ? "white" : "#0A5C54",
                  border: activeCategory === c.id ? "none" : "1px solid #14B8A655",
                }}
              >
                {c.name}
              </button>
              {activeCategory === c.id && (
                <>
                  <button
                    onClick={() => setEditCategory({ id: c.id, name: c.name })}
                    className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm"
                    style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteCategory(c)}
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
            onClick={() => setShowAddCategory(true)}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm"
            style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
            aria-label="Add category"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {categories.length === 0 && !searching && (
        <p className="text-sm text-center py-10" style={{ color: "#0A5C5466" }}>
          No categories yet — tap "+" above to add one (e.g. Mother Tincture, Dilution, Syrup).
        </p>
      )}

      {(categories.length > 0 || searching) && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: "#0A5C5499" }}>
              {visibleProducts.length} product{visibleProducts.length !== 1 ? "s" : ""}
              {searching ? " found" : ""}
            </p>
            {!searching && (
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
              >
                <Plus size={14} /> Add product
              </button>
            )}
          </div>

          <div className="space-y-2">
            {visibleProducts.map((p) => {
              const threshold = p.low_stock_threshold ?? 2;
              const low = p.stock <= threshold;
              return (
                <div key={p.id} className="bg-white rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>
                        {p.name}
                      </p>
                      <p className="text-xs" style={{ color: "#0A5C5499" }}>
                        {p.unit_label ? `${p.unit_label} · ` : ""}₹{p.price} · alert at ≤{threshold}
                      </p>
                    </div>
                    <div
                      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: low ? "#DC26261A" : "#148A7A1A", color: low ? "#DC2626" : "#0A5C54" }}
                    >
                      {p.stock} in stock
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sellOne(p)}
                      disabled={p.stock <= 0}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
                    >
                      Sold 1 pc
                    </button>
                    <button
                      onClick={() => addStock(p)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "#14B8A61A", color: "#0A5C54" }}
                      aria-label="Add stock"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      onClick={() => openEditProduct(p)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: "#148A7A" }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteProduct(p)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: "#DC2626" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            {visibleProducts.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: "#0A5C5466" }}>
                {searching ? "No matching products." : "No products in this category yet."}
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
    </div>
  );
            }
