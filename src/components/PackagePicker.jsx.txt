import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Package } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

// onApply receives { complaint, medicines, cost, mr_commission, duration_days }
export default function PackagePicker({ onApply }) {
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: pkgs } = await supabase.from("disease_packages").select("*").order("name");
      const { data: prods } = await supabase.from("pharmacy_products").select("*");
      setPackages(pkgs || []);
      setProducts(prods || []);
      setLoading(false);
    })();
  }, []);

  async function handlePackageChange(id) {
    setSelectedPackageId(id);
    setSelectedTierId("");
    setApplied(false);
    if (!id) {
      setTiers([]);
      return;
    }
    const { data } = await supabase
      .from("package_tiers")
      .select("*, package_tier_items(*)")
      .eq("package_id", id)
      .order("duration_days");
    setTiers(data || []);
  }

  function handleTierChange(tierId) {
    setSelectedTierId(tierId);
    setApplied(false);
    if (!tierId) return;
    const tier = tiers.find((t) => t.id === tierId);
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (!tier || !pkg) return;

    const medicines = (tier.package_tier_items || []).map((it) => {
      const prod = products.find((p) => p.id === it.product_id);
      if (prod && prod.tracking_type === "volume") {
        return { product_id: it.product_id, name: it.product_name, ml: it.amount, unit: prod.measure_unit || "ml" };
      }
      return { product_id: it.product_id, name: it.product_name, qty: it.amount };
    });

    onApply({
      complaint: pkg.name,
      medicines,
      cost: String(tier.price),
      mr_commission: String(tier.mr_commission),
      duration_days: String(tier.duration_days),
      basePrice: tier.price,
      packageProductIds: medicines.map((m) => m.product_id),
    });
    setApplied(true);
  }

  if (loading) return null;

  return (
    <div className="rounded-xl p-3 mb-1" style={{ background: "#14B8A61A" }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <Package size={13} color="#148A7A" />
        <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>Select disease package</p>
      </div>

      {packages.length === 0 ? (
        <p className="text-xs" style={{ color: "#0A5C5499" }}>
          No packages set up yet — add one in the Packages tab, or switch to Custom below.
        </p>
      ) : (
        <>
          <label className={labelClass} style={labelStyle}>Disease / package</label>
          <select
            value={selectedPackageId}
            onChange={(e) => handlePackageChange(e.target.value)}
            className={inputClass}
            style={{ ...inputStyle, marginBottom: "10px" }}
          >
            <option value="">Select a package…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selectedPackageId && (
            <>
              <label className={labelClass} style={labelStyle}>Duration</label>
              <select
                value={selectedTierId}
                onChange={(e) => handleTierChange(e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select duration…</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} ({t.duration_days} days) — ₹{t.price}</option>
                ))}
              </select>
              {tiers.length === 0 && (
                <p className="text-[11px] mt-1.5" style={{ color: "#0A5C5499" }}>
                  This package has no duration tiers yet — add one in the Packages tab.
                </p>
              )}
            </>
          )}

          {applied && (
            <p className="text-[11px] mt-2 font-medium" style={{ color: "#148A7A" }}>
              ✓ Filled in below — you can still edit anything before saving.
            </p>
          )}
        </>
      )}
    </div>
  );
}
