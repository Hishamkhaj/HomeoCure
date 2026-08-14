import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import PinLock from "./components/PinLock";
import PatientList from "./components/PatientList";
import AddPatient from "./components/AddPatient";
import PatientDetail from "./components/PatientDetail";
import AboutModal from "./components/AboutModal";
import PharmacyView from "./components/PharmacyView";
import FollowUpView from "./components/FollowUpView";
import { LogOut, Leaf } from "lucide-react";

function dateStrToTs(dateStr) {
  return new Date(dateStr + "T12:00:00").getTime();
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("homeocure-unlocked") === "true");
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
      const { data: prod } = await supabase.from("pharmacy_products").select("stock").eq("id", m.product_id).single();
      if (prod) {
        const newStock = Math.max(0, prod.stock - m.qty);
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

        <div className="flex gap-1.5 mb-5 bg-white/60 rounded-xl p-1">
          <button
            onClick={() => {
              setTab("patients");
              setSelected(null);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
            style={{
              background: tab === "patients" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "patients" ? "white" : "#0A5C54",
            }}
          >
            Patients
          </button>
          <button
            onClick={() => setTab("followup")}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition relative"
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
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
            style={{
              background: tab === "pharmacy" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: tab === "pharmacy" ? "white" : "#0A5C54",
            }}
          >
            Pharmacy
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
      </div>

      {showAdd && <AddPatient onClose={() => setShowAdd(false)} onSave={handleAddPatient} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
                                             }
