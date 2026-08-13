import React, { useState } from "react";
import { Search, Plus, User, Circle } from "lucide-react";

export default function PatientList({ patients, onSelect, onAddNew }) {
  const [query, setQuery] = useState("");

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      String(p.serial_no).includes(query) ||
      (p.contact || "").includes(query)
  );

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
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 shadow-sm text-left active:scale-[0.99] transition"
          >
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
            <div className="flex items-center gap-1 text-xs font-medium shrink-0">
              <Circle
                size={8}
                fill={p.status === "open" ? "#F59E0B" : "#148A7A"}
                color={p.status === "open" ? "#F59E0B" : "#148A7A"}
              />
              <span style={{ color: p.status === "open" ? "#B45309" : "#0A5C54" }}>
                {p.status === "open" ? "Open" : "Closed"}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm py-10" style={{ color: "#0A5C5466" }}>
            No patients found.
          </p>
        )}
      </div>
    </div>
  );
        }
