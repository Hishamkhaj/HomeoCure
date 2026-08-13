import React, { useState } from "react";
import { ArrowLeft, Plus, CheckCircle, RotateCcw, Calendar, Pill, IndianRupee } from "lucide-react";

const inputClass =
  "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PatientDetail({ patient, onBack, onAddVisit, onToggleStatus }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    complaint: "",
    medicine: "",
    duration_days: "",
    cost: "",
    payment_mode: "cash",
    mr_commission: "",
  });
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const visits = [...(patient.visits || [])].sort((a, b) => b.ts - a.ts);

  const handleAddVisit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onAddVisit(form);
    setSaving(false);
    setShowForm(false);
    setForm({ complaint: "", medicine: "", duration_days: "", cost: "", payment_mode: "cash", mr_commission: "" });
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
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
        >
          <Plus size={14} /> Add visit
        </button>
      </div>

      <div className="space-y-3">
        {visits.map((v, i) => (
          <div key={i} className="bg-white rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: "#0A5C5499" }}>
              <Calendar size={12} />
              {formatDate(v.ts)}
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "#0A5C54" }}>
              {v.complaint}
            </p>
            {v.medicine && (
              <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "#148A7A" }}>
                <Pill size={12} />
                {v.medicine} {v.duration_days ? `· ${v.duration_days} days` : ""}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#0A5C5499" }}>
                <IndianRupee size={12} />
                {v.cost || 0} · {v.payment_mode || "-"}
              </div>
              {v.mr_commission ? (
                <span className="text-xs" style={{ color: "#0A5C5499" }}>
                  MR: ₹{v.mr_commission}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold font-serif mb-4" style={{ color: "#0A5C54" }}>
              New Visit
            </h3>
            <form onSubmit={handleAddVisit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Complaint / diagnosis</label>
                <input required value={form.complaint} onChange={update("complaint")} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Medicine given</label>
                <input value={form.medicine} onChange={update("medicine")} className={inputClass} style={inputStyle} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Duration (days)</label>
                  <input type="number" value={form.duration_days} onChange={update("duration_days")} className={inputClass} style={inputStyle} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Cost (₹)</label>
                  <input type="number" value={form.cost} onChange={update("cost")} className={inputClass} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Payment mode</label>
                <select value={form.payment_mode} onChange={update("payment_mode")} className={inputClass} style={inputStyle}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>MR commission (₹, optional)</label>
                <input type="number" value={form.mr_commission} onChange={update("mr_commission")} className={inputClass} style={inputStyle} />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
              >
                {saving ? "Saving…" : "Save visit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
                    }
