import React from "react";
import { AlertCircle, CheckCircle2, User, Clock } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

function getLastVisit(patient) {
  const visits = patient.visits || [];
  if (visits.length === 0) return null;
  return [...visits].sort((a, b) => b.ts - a.ts)[0];
}

function computeStatus(patient) {
  const last = getLastVisit(patient);
  if (!last || !last.duration_days) return null;
  const dueDate = last.ts + last.duration_days * DAY_MS;
  const daysOverdue = Math.floor((Date.now() - dueDate) / DAY_MS);
  return { last, dueDate, daysOverdue };
}

export default function FollowUpView({ patients, onSelect }) {
  const openPatients = patients.filter((p) => p.status === "open");

  const overdue = [];
  const upcoming = [];

  openPatients.forEach((p) => {
    const status = computeStatus(p);
    if (!status) return;
    if (status.daysOverdue >= 0) {
      overdue.push({ patient: p, ...status });
    } else if (status.daysOverdue >= -3) {
      upcoming.push({ patient: p, ...status });
    }
  });

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  upcoming.sort((a, b) => a.daysOverdue - b.daysOverdue);

  return (
    <div>
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
        <AlertCircle size={16} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">
          {overdue.length} patient{overdue.length !== 1 ? "s" : ""} overdue for follow-up
        </p>
      </div>

      <h3 className="text-sm font-semibold mb-2" style={{ color: "#0A5C54" }}>
        Overdue
      </h3>
      <div className="space-y-2 mb-6">
        {overdue.map(({ patient, last, daysOverdue }) => (
          <button
            key={patient.id}
            onClick={() => onSelect(patient)}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 shadow-sm text-left"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#DC26261A" }}>
              <User size={16} color="#DC2626" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>
                {patient.name}
              </p>
              <p className="text-xs" style={{ color: "#0A5C5499" }}>
                {last.medicine ? `${last.medicine} · ` : ""}
                {last.duration_days} day course
              </p>
            </div>
            <div className="text-xs font-semibold text-right shrink-0" style={{ color: "#DC2626" }}>
              {daysOverdue === 0 ? "Due today" : `${daysOverdue}d overdue`}
            </div>
          </button>
        ))}
        {overdue.length === 0 && (
          <p className="text-center text-sm py-6" style={{ color: "#0A5C5466" }}>
            No overdue patients right now.
          </p>
        )}
      </div>

      {upcoming.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-2" style={{ color: "#0A5C54" }}>
            Due soon
          </h3>
          <div className="space-y-2">
            {upcoming.map(({ patient, last, daysOverdue }) => (
              <button
                key={patient.id}
                onClick={() => onSelect(patient)}
                className="w-full flex items-center gap-3 bg-white rounded-xl p-3.5 shadow-sm text-left"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#14B8A61A" }}>
                  <Clock size={16} color="#148A7A" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>
                    {patient.name}
                  </p>
                  <p className="text-xs" style={{ color: "#0A5C5499" }}>
                    {last.medicine ? `${last.medicine} · ` : ""}
                    {last.duration_days} day course
                  </p>
                </div>
                <div className="text-xs font-semibold text-right shrink-0" style={{ color: "#148A7A" }}>
                  in {Math.abs(daysOverdue)}d
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
              }
