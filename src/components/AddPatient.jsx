import React, { useState } from "react";
import { X } from "lucide-react";
import MedicineSelector from "./MedicineSelector";

const inputClass =
  "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddPatient({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    contact: "",
    date: todayStr(),
    complaint: "",
    medicineNote: "",
    duration_days: "",
    cost: "",
    paid_amount: "",
    payment_mode: "cash",
    mr_commission: "",
  });
  const [medicines, setMedicines] = useState([]);
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, medicines });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: "#0A5C54" }}>
            New Patient
          </h3>
          <button onClick={onClose} style={{ color: "#0A5C54" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass} style={labelStyle}>Name</label>
            <input required value={form.name} onChange={update("name")} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Contact number</label>
            <input value={form.contact} onChange={update("contact")} className={inputClass} style={inputStyle} />
          </div>
          <div className="border-t pt-4" style={{ borderColor: "#14B8A633" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "#148A7A" }}>First visit details</p>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Visit date</label>
            <input type="date" required value={form.date} onChange={update("date")} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Complaint / diagnosis</label>
            <input required value={form.complaint} onChange={update("complaint")} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Medicines given</label>
            <MedicineSelector value={medicines} onChange={setMedicines} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Notes (optional, e.g. dosage instructions)</label>
            <input value={form.medicineNote} onChange={update("medicineNote")} className={inputClass} style={inputStyle} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Duration (days)</label>
              <input type="number" value={form.duration_days} onChange={update("duration_days")} className={inputClass} style={inputStyle} />
            </div>
            <div className="flex-1">
              <label className={labelClass} style={labelStyle}>Total cost (₹)</label>
              <input type="number" value={form.cost} onChange={update("cost")} className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Amount paid (₹) — leave blank if paid in full</label>
            <input type="number" value={form.paid_amount} onChange={update("paid_amount")} placeholder={form.cost || "0"} className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Payment mode</label>
            <select value={form.payment_mode} onChange={update("payment_mode")} className={inputClass} style={inputStyle}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>MR commission (₹, optional)</label>
            <input type="number" value={form.mr_commission} onChange={update("mr_commission")} className={inputClass} style={inputStyle} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-2 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
          >
            {saving ? "Saving…" : "Save patient"}
          </button>
        </form>
      </div>
    </div>
  );
            }
