import React, { useState } from "react";
import { ArrowLeft, Plus, CheckCircle, RotateCcw, Calendar, Pill, IndianRupee, Pencil, Calculator as CalcIcon } from "lucide-react";
import MedicineSelector from "./MedicineSelector";
import Calculator from "./Calculator";

const inputClass =
  "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStrFromTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const emptyForm = {
  date: todayStr(),
  complaint: "",
  medicineNote: "",
  duration_days: "",
  cost: "",
  paid_amount: "",
  payment_mode: "cash",
  mr_commission: "",
};

export default function PatientDetail({ patient, onBack, onAddVisit, onEditVisit, onToggleStatus }) {
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null); // the visit ts being edited, or null
  const [form, setForm] = useState(emptyForm);
  const [medicines, setMedicines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [calcField, setCalcField] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const visits = [...(patient.visits || [])].sort((a, b) => b.ts - a.ts);
  const totalDue = visits.reduce((sum, v) => {
    const cost = v.cost || 0;
    const paid = v.paid_amount ?? cost;
    return sum + Math.max(0, cost - paid);
  }, 0);

  function openAddForm() {
    setEditingVisit(null);
    setForm(emptyForm);
    setMedicines([]);
    setShowForm(true);
  }

  function openEditForm(v) {
    setEditingVisit(v.ts);
    setForm({
      date: dateStrFromTs(v.ts),
      complaint: v.complaint || "",
      medicineNote: v.medicineNote || v.medicine || "",
      duration_days: v.duration_days ?? "",
      cost: v.cost ?? "",
      paid_amount: v.paid_amount ?? v.cost ?? "",
      payment_mode: v.payment_mode || "cash",
      mr_commission: v.mr_commission ?? "",
    });
    setMedicines(v.medicines || []);
    setShowForm(true);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editingVisit) {
      await onEditVisit(editingVisit, { ...form, medicines });
    } else {
      await onAddVisit({ ...form, medicines });
    }
    setSaving(false);
    setShowForm(false);
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "#148A7A" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>
              {patient.name}
            </h2>
            <p className="text-xs" style={{ color: "#0A5C5499" }}>
              #{patient.serial_no} {patient.contact ? `· ${patient.contact}` : ""}
            </p>
          </div>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: patient.status === "open" ? "#F59E0B1A" : "#148A7A1A",
              color: patient.status === "open" ? "#B45309" : "#0A5C54",
            }}
          >
            {patient.status === "open" ? "Open" : "Closed"}
          </span>
        </div>

        {totalDue > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <IndianRupee size={14} className="text-red-600" />
            <p className="text-xs text-red-700 font-medium">₹{totalDue} pending from this patient</p>
          </div>
        )}

        <button
          onClick={onToggleStatus}
          className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
          style={{
            borderColor: patient.status === "open" ? "#148A7A" : "#14B8A655",
            color: "#0A5C54",
          }}
        >
          {patient.status === "open" ? (
            <>
              <CheckCircle size={16} /> Mark case as closed
            </>
          ) : (
            <>
              <RotateCcw size={16} /> Reopen case
            </>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "#0A5C54" }}>
          Visit history
        </h3>
        <button
          onClick={openAddForm}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
        >
          <Plus size={14} /> Add visit
        </button>
      </div>

      <div className="space-y-3">
        {visits.map((v, i) => {
          const due = Math.max(0, (v.cost || 0) - (v.paid_amount ?? v.cost ?? 0));
          return (
            <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#0A5C5499" }}>
                  <Calendar size={12} />
                  {formatDate(v.ts)}
                </div>
                <button onClick={() => openEditForm(v)} style={{ color: "#148A7A" }}>
                  <Pencil size={13} />
                </button>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "#0A5C54" }}>
                {v.complaint}
              </p>
              {(v.medicines?.length > 0 || v.medicine) && (
                <div className="flex items-start gap-1.5 text-xs mt-1" style={{ color: "#148A7A" }}>
                  <Pill size={12} className="mt-0.5 shrink-0" />
                  <span>
                    {v.medicines?.length > 0
                      ? v.medicines.map((m) => `${m.name} ×${m.qty}`).join(", ")
                      : v.medicine}
                    {v.duration_days ? ` · ${v.duration_days} days` : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#0A5C5499" }}>
                  <IndianRupee size={12} />
                  {v.cost || 0} · {v.payment_mode || "-"}
                  {due > 0 && <span className="text-red-600 font-medium">· ₹{due} due</span>}
                </div>
                {v.mr_commission ? (
                  <span className="text-xs" style={{ color: "#0A5C5499" }}>
                    MR: ₹{v.mr_commission}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold font-serif mb-4" style={{ color: "#0A5C54" }}>
              {editingVisit ? "Edit Visit" : "New Visit"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className={labelClass} style={labelStyle}>Notes (optional)</label>
                <input value={form.medicineNote} onChange={update("medicineNote")} className={inputClass} style={inputStyle} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>Duration (days)</label>
                  <input type="number" value={form.duration_days} onChange={update("duration_days")} className={inputClass} style={inputStyle} />
                </div>
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>Total cost (₹)</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={form.cost} onChange={update("cost")} className={inputClass} style={inputStyle} />
                    <button type="button" onClick={() => setCalcField("cost")} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                      <CalcIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Amount paid (₹)</label>
                <div className="flex gap-1.5">
                  <input type="number" value={form.paid_amount} onChange={update("paid_amount")} placeholder={form.cost || "0"} className={inputClass} style={inputStyle} />
                  <button type="button" onClick={() => setCalcField("paid_amount")} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                    <CalcIcon size={16} />
                  </button>
                </div>
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
                <div className="flex gap-1.5">
                  <input type="number" value={form.mr_commission} onChange={update("mr_commission")} className={inputClass} style={inputStyle} />
                  <button type="button" onClick={() => setCalcField("mr_commission")} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#14B8A61A", color: "#0A5C54" }}>
                    <CalcIcon size={16} />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
              >
                {saving ? "Saving…" : editingVisit ? "Save changes" : "Save visit"}
              </button>
            </form>
          </div>
        </div>
      )}

      {calcField && (
        <Calculator
          label={calcField === "cost" ? "Total cost" : calcField === "paid_amount" ? "Amount paid" : "MR commission"}
          initialValue={form[calcField]}
          onClose={() => setCalcField(null)}
          onUse={(val) => {
            setForm((f) => ({ ...f, [calcField]: val }));
            setCalcField(null);
          }}
        />
      )}
    </div>
  );
}
