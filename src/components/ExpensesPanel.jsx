import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, Pencil, Trash2, Receipt } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CATEGORIES = ["Pharmacy", "Clinic", "Staff", "Courier", "Electricity", "Rent", "Miscellaneous"];

const emptyForm = { expense_date: todayStr(), description: "", category: "Miscellaneous", amount: "" };

export default function ExpensesPanel({ expenses, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function openAdd() {
    setEditExpense(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(exp) {
    setEditExpense(exp);
    setForm({
      expense_date: exp.expense_date,
      description: exp.description || "",
      category: exp.category || "Miscellaneous",
      amount: String(exp.amount),
    });
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      expense_date: form.expense_date,
      description: form.description,
      category: form.category,
      amount: Number(form.amount) || 0,
    };
    if (editExpense) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editExpense.id);
      if (error) {
        alert("Could not save: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) {
        alert("Could not save: " + error.message);
        return;
      }
    }
    setShowForm(false);
    onRefresh();
  }

  async function del(exp) {
    await supabase.from("expenses").delete().eq("id", exp.id);
    setConfirmDelete(null);
    onRefresh();
  }

  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const sorted = [...expenses].sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1));

  return (
    <div>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-3 flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#0A5C54" }}>Total expenses</span>
        <span className="text-lg font-bold" style={{ color: "#DC2626" }}>₹{total}</span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: "#0A5C5499" }}>{expenses.length} entries</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
        >
          <Plus size={14} /> Add expense
        </button>
      </div>

      <div className="space-y-2">
        {sorted.map((exp) => (
          <div key={exp.id} className="bg-white rounded-xl p-3.5 shadow-sm flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-2">
              <Receipt size={14} color="#148A7A" className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>{exp.description || exp.category}</p>
                <p className="text-xs" style={{ color: "#0A5C5499" }}>
                  {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {exp.category ? ` · ${exp.category}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold" style={{ color: "#0A5C54" }}>₹{exp.amount}</span>
              <button onClick={() => openEdit(exp)} style={{ color: "#148A7A" }}><Pencil size={14} /></button>
              <button onClick={() => setConfirmDelete(exp)} style={{ color: "#DC2626" }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>No expenses logged yet.</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>
                {editExpense ? "Edit Expense" : "New Expense"}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Date</label>
                <input type="date" required value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Category</label>
                <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputClass} style={inputStyle}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Description (optional)</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. August rent" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Amount (₹)</label>
                <input type="number" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                {editExpense ? "Save changes" : "Add expense"}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete expense?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => del(confirmDelete)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
