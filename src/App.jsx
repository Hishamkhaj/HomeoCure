import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import PatientList from "./components/PatientList";
import AddPatient from "./components/AddPatient";
import PatientDetail from "./components/PatientDetail";
import { LogOut, Leaf } from "lucide-react";

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchPatients();
  }, [session]);

  async function fetchPatients() {
    setLoadingPatients(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("serial_no", { ascending: false });
    if (!error) setPatients(data || []);
    setLoadingPatients(false);
  }

  async function handleAddPatient(form) {
    const firstVisit = {
      ts: Date.now(),
      complaint: form.complaint,
      medicine: form.medicine,
      duration_days: form.duration_days ? Number(form.duration_days) : null,
      cost: form.cost ? Number(form.cost) : 0,
      payment_mode: form.payment_mode,
      mr_commission: form.mr_commission ? Number(form.mr_commission) : 0,
    };
    const { error } = await supabase.from("patients").insert({
      name: form.name,
      contact: form.contact,
      status: "open",
      visits: [firstVisit],
    });
    if (!error) {
      setShowAdd(false);
      fetchPatients();
    }
  }

  async function handleAddVisit(form) {
    const newVisit = {
      ts: Date.now(),
      complaint: form.complaint,
      medicine: form.medicine,
      duration_days: form.duration_days ? Number(form.duration_days) : null,
      cost: form.cost ? Number(form.cost) : 0,
      payment_mode: form.payment_mode,
      mr_commission: form.mr_commission ? Number(form.mr_commission) : 0,
    };
    const updatedVisits = [...(selected.visits || []), newVisit];
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

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4FAF8" }}>
        <p className="text-sm" style={{ color: "#0A5C54" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ background: "linear-gradient(180deg, #F4FAF8 0%, #EAF6F2 100%)", fontFamily: "system-ui, sans-serif" }}
    >
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
            >
              <Leaf size={18} color="white" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-serif leading-tight" style={{ color: "#0A5C54" }}>
                HomeoCure
              </h1>
              <p className="text-[10px] italic -mt-0.5" style={{ color: "#148A7A" }}>
                We serve, He cures
              </p>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/70 shadow-sm"
            style={{ color: "#0A5C54" }}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>

        {selected ? (
          <PatientDetail
            patient={selected}
            onBack={() => setSelected(null)}
            onAddVisit={handleAddVisit}
            onToggleStatus={handleToggleStatus}
          />
        ) : loadingPatients ? (
          <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>
            Loading patients…
          </p>
        ) : (
          <PatientList patients={patients} onSelect={setSelected} onAddNew={() => setShowAdd(true)} />
        )}
      </div>

      {showAdd && <AddPatient onClose={() => setShowAdd(false)} onSave={handleAddPatient} />}
    </div>
  );
      }
