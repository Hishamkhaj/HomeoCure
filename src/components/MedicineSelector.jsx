import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Search, Plus, Minus, X } from "lucide-react";

// value: array of { product_id, name, qty }
export default function MedicineSelector({ value, onChange }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase.from("pharmacy_categories").select("*").order("created_at");
      const { data: prods } = await supabase.from("pharmacy_products").select("*").order("created_at");
      setCategories(cats || []);
      setProducts(prods || []);
      if (cats && cats.length) setActiveCategory(cats[0].id);
    })();
  }, []);

  const searching = query.trim().length > 0;
  const visible = searching
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products.filter((p) => p.category_id === activeCategory);

  function qtyFor(productId) {
    const item = value.find((v) => v.product_id === productId);
    return item ? item.qty : 0;
  }

  function setQty(product, newQty) {
    if (newQty <= 0) {
      onChange(value.filter((v) => v.product_id !== product.id));
    } else {
      const exists = value.find((v) => v.product_id === product.id);
      if (exists) {
        onChange(value.map((v) => (v.product_id === product.id ? { ...v, qty: newQty } : v)));
      } else {
        onChange([...value, { product_id: product.id, name: product.name, qty: newQty }]);
      }
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((v) => (
            <span
              key={v.product_id}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
              style={{ background: "#14B8A61A", color: "#0A5C54" }}
            >
              {v.name} × {v.qty}
              <button type="button" onClick={() => onChange(value.filter((x) => x.product_id !== v.product_id))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border rounded-xl px-3 py-2.5 text-sm text-left"
        style={{ borderColor: "#14B8A655", color: value.length ? "#0A5C54" : "#0A5C5499" }}
      >
        {value.length ? "Edit selected medicines" : "Tap to select medicines from pharmacy"}
      </button>

      {open && (
        <div className="mt-3 border rounded-xl p-3" style={{ borderColor: "#14B8A655" }}>
          <div className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 mb-2.5" style={{ border: "1px solid #14B8A633" }}>
            <Search size={14} color="#148A7A" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search medicine…"
              className="flex-1 outline-none text-sm bg-transparent"
            />
          </div>

          {!searching && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className="shrink-0 px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
                  style={{
                    background: activeCategory === c.id ? "#148A7A" : "white",
                    color: activeCategory === c.id ? "white" : "#0A5C54",
                    border: activeCategory === c.id ? "none" : "1px solid #14B8A655",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {visible.map((p) => {
              const qty = qtyFor(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-2" style={{ border: "1px solid #14B8A633" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "#0A5C54" }}>{p.name}</p>
                    <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{p.stock} in stock</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => setQty(p, qty - 1)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                      <Minus size={11} />
                    </button>
                    <span className="text-xs w-4 text-center" style={{ color: "#0A5C54" }}>{qty}</span>
                    <button type="button" onClick={() => setQty(p, qty + 1)} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#148A7A", color: "white" }}>
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: "#0A5C5466" }}>No medicines found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
                }
