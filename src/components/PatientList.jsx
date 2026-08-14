import React, { useState } from "react";
import { Search, Plus, User, Circle, Pencil, Trash2, X } from "lucide-react";

export default function PatientList({ patients, onSelect, onAddNew, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", contact: "" });

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      String(p.serial_no).includes(query) ||
      (p.contact || "").includes(query)
  );

  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditing(p);
    setEditForm({ name: p.name, contact: p.contact || "" });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    await onEdit(editing.id, editForm);
    setEditing(null);
  };

  const dueFor = (p) =>
    (p.visits || []).reduce((sum, v) => sum + Math.max(0, (v.cost || 0) - (v.paid_amount ?? v.cost ?? 0)), 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="flex-1 flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm"
          style={{ border: "1px solid #14B8A633" }}
        >
          <Search size={16} color="#148A7A" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, or phone…"
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
        <button
          onClick={onAddNew}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
          aria-label="Add patient"
        >
          <Plus size={20} />
        </button>
      </div>

      <p className="text-xs mb-3" style={{ color: "#0A5C5499" }}>
        {filtered.length} patient{filtered.length !== 1 ? "s" : ""}
      </p>

      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="w-full flex items-center gap-2 bg-white rounded-xl p-3.5 shadow-sm">
            <button onClick={() => onSelect(p)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "#14B8A61A" }}
              >
                <User size={18} color="#148A7A" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>
                  {p.name}
                </p>
                <p className="text-xs" style={{ color: "#0A5C5499" }}>
                  #{p.serial_no} {p.contact ? `· ${p.contact}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium shrink-0 mr-1">
                <Circle
                  size={8}
                  fill={p.status === "open" ? "#F59E0B" : "#148A7A"}
                  color={p.status === "open" ? "#F59E0B" : "#148A7A"}
                />
                <span style={{ color: p.status === "open" ? "#B45309" : "#0A5C54" }}>
                  {p.status === "open" ? "Open" : "Closed"}
                </span>
              </div>
              {dueFor(p) > 0 && (
                <span className="text-[10px] font-semibold text-red-600 shrink-0 mr-1">
                  ₹{dueFor(p)} due
                </span>
              )}
            </button>
            <button onClick={(e) => openEdit(p, e)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: "#148A7A" }}>
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(p);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ color: "#DC2626" }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>
            No patients found.
          </p>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Edit Patient</h3>
              <button onClick={() => setEditing(null)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Name</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "#14B8A655" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>Contact</label>
                <input
                  value={editForm.contact}
                  onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "#14B8A655" }}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
              >
                Save changes
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete patient?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will permanently delete <strong>{confirmDelete.name}</strong> and their entire visit history. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "#14B8A655", color: "#0A5C54" }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDelete(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#DC2626" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
                                               }
