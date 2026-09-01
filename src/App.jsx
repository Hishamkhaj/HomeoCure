import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import PinLock, { INCOME_PIN } from "./components/PinLock";
import PatientList from "./components/PatientList";
import AddPatient from "./components/AddPatient";
import PatientDetail from "./components/PatientDetail";
import AboutModal from "./components/AboutModal";
import PharmacyView from "./components/PharmacyView";
import FollowUpView from "./components/FollowUpView";
import ReportsView from "./components/ReportsView";
import IncomeView from "./components/IncomeView";
import PackagesView from "./components/PackagesView";
import MRView from "./components/MRView";
import AnalyticsView from "./components/AnalyticsView";
import { LogOut, Leaf, Lock } from "lucide-react";

function dateStrToTs(dateStr) {
  return new Date(dateStr + "T12:00:00").getTime();
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("homeocure-unlocked") === "true");
  const [incomeUnlocked, setIncomeUnlocked] = useState(() => sessionStorage.getItem("homeocure-income-unlocked") === "true");
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [tab, setTab] = useState("patients");

  useEffect(() => {
    if (unlocked) fetchPatients();
  }, [unlocked]);

  async function fetchPatients() {
    setLoadingPatients(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("serial_no", { ascending: false });
    if (!error) setPatients(data || []);
    setLoadingPatients(false);
  }

  async function syncPharmacyForMedicines(medicines, patientId, soldAtDateStr) {
    if (!medicines || medicines.length === 0) return;
    for (const m of medicines) {
      if (m.ml) {
        const { data: prodRows, error: fetchErr } = await supabase
          .from("pharmacy_products")
          .select("id, remaining_ml")
          .eq("id", m.product_id);
        if (!fetchErr && prodRows && prodRows.length > 0) {
          const currentRemaining = prodRows[0].remaining_ml || 0;
          const newRemaining = Math.max(0, currentRemaining - m.ml);
          await supabase.from("pharmacy_products").update({ remaining_ml: newRemaining }).eq("id", m.product_id);
        }
        await supabase.from("pharmacy_sales").insert({
          product_id: m.product_id,
          product_name: m.name,
          patient_id: patientId,
          ml_dispensed: m.ml,
          sold_at: soldAtDateStr,
        });
      } else {
        const { data: prodRows, error: fetchErr } = await supabase
          .from("pharmacy_products")
          .select("id, stock")
          .eq("id", m.product_id);
        if (!fetchErr && prodRows && prodRows.length > 0) {
          const currentStock = prodRows[0].stock;
          const newStock = Math.max(0, currentStock - m.qty);
          await supabase.from("pharmacy_products").update({ stock: newStock }).eq("id", m.product_id);
        }
        await supabase.from("pharmacy_sales").insert({
          product_id: m.product_id,
          product_name: m.name,
          patient_id: patientId,
          qty: m.qty,
          sold_at: soldAtDateStr,
        });
      }
    }
  }

  function buildVisit(form) {
    return {
      ts: dateStrToTs(form.date),
      complaint: form.complaint,
      medicines: form.medicines || [],
      medicineNote: form.medicineNote || "",
      duration_days: form.duration_days ? Number(form.duration_days) : null,
      cost: form.cost ? Number(form.cost) : 0,
      paid_amount: form.paid_amount !== "" && form.paid_amount != null ? Number(form.paid_amount) : (form.cost ? Number(form.cost) : 0),
      payment_mode: form.payment_mode,
      mr_commission: form.mr_commission ? Number(form.mr_commission) : 0,
    };
  }

  async function handleAddPatient(form) {
    const firstVisit = buildVisit(form);
    const { data, error } = await supabase
      .from("patients")
      .insert({
        name: form.name,
        contact: form.contact,
        status: "open",
        visits: [firstVisit],
      })
      .select()
      .single();
    if (!error) {
      await syncPharmacyForMedicines(firstVisit.medicines, data.id, form.date);
      setShowAdd(false);
      fetchPatients();
    }
  }

  async function handleAddVisit(form) {
    const newVisit = buildVisit(form);
    const updatedVisits = [...(selected.visits || []), newVisit];
    const { error } = await supabase
      .from("patients")
      .update({ visits: updatedVisits })
      .eq("id", selected.id);
    if (!error) {
      await syncPharmacyForMedicines(newVisit.medicines, selected.id, form.date);
      const updated = { ...selected, visits: updatedVisits };
      setSelected(updated);
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  async function handleEditVisit(originalTs, form) {
    const updatedVisit = buildVisit(form);
    const updatedVisits = (selected.visits || []).map((v) => (v.ts === originalTs ? updatedVisit : v));
    const { error } = await supabase
      .from("patients")
      .update({ visits: updatedVisits })
      .eq("id", selected.id);
    if (!error) {
      const updated = { ...selected, visits: updatedVisits };
      setSelected(updated);
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  async function handleToggleStatus() {
    const newStatus = selected.status === "open" ? "closed" : "open";
    const { error } = await supabase
      .from("patients")
      .update({ status: newStatus })
      .eq("id", selected.id);
    if (!error) {
      const updated = { ...selected, status: newStatus };
      setSelected(updated);
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  async function handleEditPatient(id, form) {
    const { error } = await supabase.from("patients").update({ name: form.name, contact: form.contact }).eq("id", id);
    if (!error) {
      setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...form } : p)));
    }
  }

  async function handleDeletePatient(id) {
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (!error) {
      setPatients((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) setSelected(null);
    }
  }

  async function handleMarkPaid(patient) {
    const updatedVisits = (patient.visits || []).map((v) => ({ ...v, paid_amount: v.cost || 0 }));
    const { error } = await supabase.from("patients").update({ visits: updatedVisits }).eq("id", patient.id);
    if (!error) {
      setPatients((prev) => prev.map((p) => (p.id === patient.id ? { ...p, visits: updatedVisits } : p)));
    }
  }

  async function handleMarkLost() {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("patients").update({ status: "lost", lost_at: nowIso }).eq("id", selected.id);
    if (!error) {
      const updated = { ...selected, status: "lost", lost_at: nowIso };
      setSelected(updated);
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  async function handleReactivate() {
    const { error } = await supabase.from("patients").update({ status: "open", lost_at: null }).eq("id", selected.id);
    if (!error) {
      const updated = { ...selected, status: "open", lost_at: null };
      setSelected(updated);
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  }

  function goToPatientFromFollowUp(p) {
    setTab("patients");
    setSelected(p);
  }

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  const overdueCount = patients.filter((p) => {
    if (p.status !== "open") return false;
    const visits = p.visits || [];
    if (visits.length === 0) return false;
    const last = [...visits].sort((a, b) => b.ts - a.ts)[0];
    if (!last.duration_days) return false;
    const dueDate = last.ts + last.duration_days * 24 * 60 * 60 * 1000;
    return Date.now() >= dueDate;
  }).length;

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ background: "linear-gradient(180deg, #F4FAF8 0%, #EAF6F2 100%)", fontFamily: "system-ui, sans-serif" }}
    >
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowAbout(true)} className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
            >
              <Leaf size={18} color="white" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold font-serif leading-tight" style={{ color: "#0A5C54" }}>
                HomeoCure
              </h1>
              <p className="text-[10px] italic -mt-0.5" style={{ color: "#148A7A" }}>
                We serve, He cures
              </p>
            </div>
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("homeocure-unlocked");
              setUnlocked(false);
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/70 shadow-sm"
            style={{ color: "#0A5C54" }}
            aria-label="Lock"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="flex gap-1.5 mb-5 bg-white/60 rounded-xl p-1 overflow-x-auto">
          <button
            onClick={() => {
              setTab("patients");
              setSelected(null);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === "patients" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "patients" ? "white" : "#0A5C54",
            }}
          >
            Patients
          </button>
          <button
            onClick={() => setTab("followup")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition relative whitespace-nowrap"
            style={{
              background: tab === "followup" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "followup" ? "white" : "#0A5C54",
            }}
          >
            Follow-up
            {overdueCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center text-white font-bold"
                style={{ background: "#DC2626" }}
              >
                {overdueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("pharmacy")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === "pharmacy" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "pharmacy" ? "white" : "#0A5C54",
            }}
          >
            Pharmacy
          </button>
          <button
            onClick={() => setTab("reports")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === "reports" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "reports" ? "white" : "#0A5C54",
            }}
          >
            Reports
          </button>
          <button
            onClick={() => setTab("analytics")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === "analytics" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "analytics" ? "white" : "#0A5C54",
            }}
          >
            Analytics
          </button>
          <button
            onClick={() => setTab("mr")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === "mr" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "mr" ? "white" : "#0A5C54",
            }}
          >
            MR
          </button>
          <button
            onClick={() => setTab("packages")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === "packages" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "packages" ? "white" : "#0A5C54",
            }}
          >
            Packages
          </button>
          <button
            onClick={() => setTab("income")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 whitespace-nowrap"
            style={{
              background: tab === "income" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "income" ? "white" : "#0A5C54",
            }}
          >
            <Lock size={10} /> Income
          </button>
        </div>

        {tab === "patients" &&
          (selected ? (
            <PatientDetail
              patient={selected}
              onBack={() => setSelected(null)}
              onAddVisit={handleAddVisit}
              onEditVisit={handleEditVisit}
              onToggleStatus={handleToggleStatus}
              onMarkLost={handleMarkLost}
              onReactivate={handleReactivate}
            />
          ) : loadingPatients ? (
            <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>
              Loading patients…
            </p>
          ) : (
            <PatientList
              patients={patients}
              onSelect={setSelected}
              onAddNew={() => setShowAdd(true)}
              onEdit={handleEditPatient}
              onDelete={handleDeletePatient}
            />
          ))}

        {tab === "followup" && <FollowUpView patients={patients} onSelect={goToPatientFromFollowUp} />}

        {tab === "pharmacy" && <PharmacyView />}

        {tab === "reports" && <ReportsView patients={patients} onMarkPaid={handleMarkPaid} />}

        {tab === "packages" && <PackagesView />}

        {tab === "mr" && <MRView />}

        {tab === "analytics" && <AnalyticsView />}

        {tab === "income" &&
          (incomeUnlocked ? (
            <IncomeView patients={patients} />
          ) : (
            <div className="-mx-4 -mt-2">
              <PinLock
                pin={INCOME_PIN}
                storageKey="homeocure-income-unlocked"
                title="Income"
                subtitle="Enter Income PIN to continue"
                icon={<Lock size={30} color="white" />}
                onUnlock={() => setIncomeUnlocked(true)}
                fullScreen={false}
              />
            </div>
          ))}
      </div>

      {showAdd && <AddPatient onClose={() => setShowAdd(false)} onSave={handleAddPatient} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
