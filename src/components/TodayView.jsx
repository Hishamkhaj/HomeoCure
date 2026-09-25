import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  CloudSun,
  Clock3,
  IndianRupee,
  MapPin,
  RefreshCw,
  Sun,
  Thermometer,
  Users,
  WalletCards,
  Wind,
} from "lucide-react";
import { supabase } from "../supabaseClient";

const DAY_MS = 24 * 60 * 60 * 1000;
const TEAL = "#0A5C54";
const TEAL2 = "#148A7A";
const MUTED = "#0A5C5499";
const RED = "#DC2626";
const AMBER = "#B45309";

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateTs(dateStr) {
  return new Date(`${dateStr}T12:00:00`).getTime();
}

function money(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function median(values) {
  const clean = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function visitCollection(visit) {
  if (Array.isArray(visit?.payment_log) && visit.payment_log.length) {
    return visit.payment_log.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);
  }
  const paid = Number(visit?.paid_amount);
  if (Number.isFinite(paid) && paid > 0) return paid;
  return Math.max(0, Number(visit?.cost) || 0);
}

function sortedVisits(patient) {
  return [...(patient?.visits || [])]
    .filter((v) => Number(v.ts))
    .sort((a, b) => a.ts - b.ts);
}

function lastVisit(patient) {
  const visits = sortedVisits(patient);
  return visits[visits.length - 1] || null;
}

function dueTsForPatient(patient) {
  const last = lastVisit(patient);
  if (!last?.duration_days) return null;
  return last.ts + Number(last.duration_days) * DAY_MS;
}

function isFollowupVisit(visits, index) {
  const previous = index > 0 ? visits[index - 1] : null;
  if (!previous?.duration_days) return false;
  const due = previous.ts + Number(previous.duration_days) * DAY_MS;
  return visits[index].ts >= due - DAY_MS && visits[index].ts <= due + 7 * DAY_MS;
}

function attendanceStats(patient) {
  const visits = sortedVisits(patient);
  let successful = 0;
  let observed = 0;
  for (let i = 0; i < visits.length - 1; i += 1) {
    if (!visits[i].duration_days) continue;
    const due = visits[i].ts + Number(visits[i].duration_days) * DAY_MS;
    observed += 1;
    if (visits[i + 1].ts >= due - DAY_MS && visits[i + 1].ts <= due + 7 * DAY_MS) successful += 1;
  }
  return { successful, observed };
}

function expectedPatientCollection(patient) {
  const amounts = sortedVisits(patient)
    .slice(-4)
    .reverse()
    .map(visitCollection)
    .filter((x) => x > 0);
  return median(amounts) || visitCollection(lastVisit(patient) || {}) || 0;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysFromNow(ts, now) {
  return Math.round((ts - now.getTime()) / DAY_MS);
}

function SectionTitle({ icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#14B8A61A", color: TEAL2 }}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: TEAL }}>{title}</p>
          {subtitle && <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Metric({ icon, label, value, sub, onClick }) {
  const C = onClick ? "button" : "div";
  return (
    <C
      onClick={onClick}
      className={`bg-white rounded-2xl p-3.5 shadow-sm text-left ${onClick ? "w-full active:scale-[0.99] transition" : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: TEAL2 }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: TEAL }}>{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: MUTED }}>{sub}</p>}
    </C>
  );
}

export default function TodayView({ patients = [], onSelect, onSelectPatient, onNavigate }) {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [pharmacyAlerts, setPharmacyAlerts] = useState({ low: 0, refills: 0 });
  const [todayPayments, setTodayPayments] = useState(null);
  const [todayPharmacyIncome, setTodayPharmacyIncome] = useState(0);

  const selectPatient = onSelectPatient || onSelect;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSupportData() {
      const today = localDateKey(now);

      const [{ data: sales }, { data: products }] = await Promise.all([
        supabase.from("pharmacy_sales").select("product_id, product_name, qty, sold_at").eq("sold_at", today),
        supabase.from("pharmacy_products").select("stock, low_stock_threshold, tracking_type, remaining_ml, low_volume_threshold_ml"),
      ]);

      if (cancelled) return;

      const low = (products || []).filter((p) => {
        if (p.tracking_type === "volume") return Number(p.remaining_ml || 0) <= Number(p.low_volume_threshold_ml ?? 50);
        return Number(p.stock || 0) <= Number(p.low_stock_threshold ?? 2);
      }).length;

      setPharmacyAlerts({ low, refills: (products || []).filter((p) => p.tracking_type === "volume" && Number(p.remaining_ml || 0) <= Number(p.low_volume_threshold_ml ?? 50)).length });

      // pharmacy_sales does not always contain price. Income is therefore only
      // included when a reliable product price can be resolved.
      const productMap = new Map((products || []).map((p) => [p.id, p]));
      const { data: priceRows } = await supabase.from("pharmacy_products").select("id, price").in("id", (sales || []).map((s) => s.product_id).filter(Boolean));
      const priceMap = new Map((priceRows || []).map((p) => [p.id, Number(p.price) || 0]));
      const pharmacyTotal = (sales || []).reduce((sum, s) => {
        if (s.ml_dispensed) return sum;
        return sum + (Number(s.qty) || 0) * (priceMap.get(s.product_id) || productMap.get(s.product_id)?.price || 0);
      }, 0);
      setTodayPharmacyIncome(pharmacyTotal);

      // payment_log is optional across older HomeoCure versions. If the table
      // is not available, the dashboard falls back to patient visit payments.
      const { data: payments } = await supabase.from("payment_log").select("*").gte("payment_date", today).lte("payment_date", today);
      if (!cancelled) setTodayPayments(payments || null);
    }

    loadSupportData().catch(() => {
      if (!cancelled) setTodayPayments(null);
    });

    return () => { cancelled = true; };
  }, [localDateKey(now)]);

  // Weather is intentionally contextual. It does not modify the rupee forecast.
  // If a server-side /api/weather endpoint is later added, this component will
  // consume it without changing the forecast model.
  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      setWeatherLoading(true);
      setWeatherError("");
      try {
        const response = await fetch("/api/weather?city=Gonda&country=India", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Weather service unavailable");
        const data = await response.json();
        if (!cancelled) setWeather(data);
      } catch (e) {
        if (!cancelled) setWeatherError("Live weather not connected yet");
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }
    loadWeather();
    return () => { cancelled = true; };
  }, [localDateKey(now)]);

  const todayKey = localDateKey(now);

  const visitsToday = useMemo(() => {
    const rows = [];
    patients.forEach((patient) => {
      sortedVisits(patient).forEach((visit) => {
        if (localDateKey(new Date(visit.ts)) === todayKey) rows.push({ patient, visit });
      });
    });
    return rows.sort((a, b) => a.visit.ts - b.visit.ts);
  }, [patients, todayKey]);

  const dueToday = useMemo(() => {
    return patients.filter((patient) => {
      if (patient.status !== "open") return false;
      const due = dueTsForPatient(patient);
      return due && localDateKey(new Date(due)) === todayKey;
    });
  }, [patients, todayKey]);

  const overdue = useMemo(() => {
    return patients
      .map((patient) => ({ patient, due: dueTsForPatient(patient) }))
      .filter(({ patient, due }) => patient.status === "open" && due && due < dateTs(todayKey));
  }, [patients, todayKey]);

  const actualPatientIncome = useMemo(() => {
    if (Array.isArray(todayPayments)) {
      const total = todayPayments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);
      if (total > 0) return total;
    }
    return visitsToday.reduce((sum, row) => sum + visitCollection(row.visit), 0);
  }, [todayPayments, visitsToday]);

  const actualIncome = actualPatientIncome + todayPharmacyIncome;

  const forecast = useMemo(() => {
    let clinicSuccess = 0;
    let clinicObserved = 0;
    patients.forEach((p) => {
      const s = attendanceStats(p);
      clinicSuccess += s.successful;
      clinicObserved += s.observed;
    });

    const clinicRate = clinicObserved >= 5 ? clinicSuccess / clinicObserved : 0.6;

    const scheduled = dueToday.map((patient) => {
      const stats = attendanceStats(patient);
      const probability = stats.observed > 0
        ? (stats.successful + clinicRate * 2) / (stats.observed + 2)
        : clinicRate;
      const expectedCollection = expectedPatientCollection(patient);
      return { patient, probability, expectedCollection, expectedIncome: expectedCollection * probability };
    });

    const attendedIds = new Set(visitsToday.map((x) => x.patient.id));
    const pendingScheduled = scheduled.filter((x) => !attendedIds.has(x.patient.id));
    const scheduledExpectedIncome = pendingScheduled.reduce((s, x) => s + x.expectedIncome, 0);

    const weekday = now.getDay();
    const buckets = {};
    patients.forEach((patient) => {
      const visits = sortedVisits(patient);
      visits.forEach((visit, index) => {
        const d = new Date(visit.ts);
        if (d.getDay() !== weekday || localDateKey(d) === todayKey || d > now) return;
        const key = localDateKey(d);
        if (!buckets[key]) buckets[key] = { count: 0, income: 0 };
        if (!isFollowupVisit(visits, index)) {
          buckets[key].count += 1;
          buckets[key].income += visitCollection(visit);
        }
      });
    });

    const days = Object.values(buckets);
    const avgWalkInIncome = days.length ? days.reduce((s, d) => s + d.income, 0) / days.length : 0;
    const todayScheduledIds = new Set(dueToday.filter((p) => attendedIds.has(p.id)).map((p) => p.id));
    const todayScheduledCount = todayScheduledIds.size;
    const todayNonScheduledCount = Math.max(0, visitsToday.length - todayScheduledCount);
    const avgWalkInPatients = days.length ? days.reduce((s, d) => s + d.count, 0) / days.length : 0;
    const remainingWalkInIncome = Math.max(0, avgWalkInIncome - Math.max(0, actualPatientIncome - scheduled.filter((x) => attendedIds.has(x.patient.id)).reduce((s, x) => s + visitCollection(lastVisit(x.patient) || {}), 0)));
    const remainingWalkInPatients = Math.max(0, avgWalkInPatients - todayNonScheduledCount);

    const expectedRemainingIncome = Math.round(scheduledExpectedIncome + remainingWalkInIncome);
    const fullDay = Math.round(actualIncome + expectedRemainingIncome);
    const comparableDays = days.length;
    const confidence = comparableDays >= 8 && clinicObserved >= 12 ? "Good" : comparableDays >= 3 || clinicObserved >= 5 ? "Moderate" : "Early";

    return {
      scheduled,
      pendingScheduled,
      scheduledExpectedIncome: Math.round(scheduledExpectedIncome),
      remainingWalkInIncome: Math.round(remainingWalkInIncome),
      expectedRemainingIncome,
      fullDay,
      remainingPatients: Math.max(0, Math.round(scheduled.reduce((s, x) => s + x.probability, 0) + remainingWalkInPatients)),
      clinicRate,
      comparableDays,
      clinicObserved,
      confidence,
    };
  }, [patients, dueToday, visitsToday, actualPatientIncome, actualIncome, now, todayKey]);

  const typicalWeekday = useMemo(() => {
    const weekday = now.getDay();
    const counts = [];
    patients.forEach((p) => {
      sortedVisits(p).forEach((v) => {
        const d = new Date(v.ts);
        if (d.getDay() === weekday && localDateKey(d) !== todayKey && d < now) counts.push({ date: localDateKey(d), id: p.id });
      });
    });
    const byDay = new Map();
    counts.forEach((x) => byDay.set(x.date, (byDay.get(x.date) || new Set()).add(x.id)));
    const vals = [...byDay.values()].map((s) => s.size);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [patients, now, todayKey]);

  const flowDifference = typicalWeekday ? visitsToday.length - typicalWeekday : null;
  const flowPct = typicalWeekday ? Math.round((flowDifference / typicalWeekday) * 100) : null;

  const attention = useMemo(() => {
    const rows = [];
    dueToday.forEach((p) => rows.push({ patient: p, type: "Due today", tone: AMBER, due: dueTsForPatient(p) }));
    overdue.slice(0, 8).forEach(({ patient, due }) => rows.push({ patient, type: "Overdue", tone: RED, due }));
    patients.filter((p) => p.status === "open" && !dueTsForPatient(p)).slice(0, 5).forEach((p) => rows.push({ patient: p, type: "No follow-up set", tone: TEAL2, due: null }));
    return rows.slice(0, 10);
  }, [patients, dueToday, overdue]);

  const clinicState = useMemo(() => {
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins >= 10 * 60 && mins < 14 * 60) return { label: "Clinic open", detail: "Morning session", live: true };
    if (mins >= 14 * 60 && mins < 17 * 60) return { label: "Break", detail: "Between clinic sessions", live: false };
    if (mins >= 17 * 60 && mins < 21 * 60) return { label: "Clinic open", detail: "Evening session", live: true };
    return { label: "Clinic closed", detail: "Outside clinic hours", live: false };
  }, [now]);

  const weatherIcon = weather?.condition?.toLowerCase?.().includes("rain") ? <CloudRain size={17} /> : weather?.condition ? <CloudSun size={17} /> : <CloudSun size={17} />;

  return (
    <div className="space-y-4 pb-4">
      {/* Header: no fake morning/evening greeting; always useful */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TEAL2 }}>Today at {formatTime(now)}</p>
          <h1 className="text-xl font-bold font-serif leading-tight" style={{ color: TEAL }}>{formatDate(now)}</h1>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-full bg-white shadow-sm" style={{ color: clinicState.live ? TEAL2 : AMBER }}>
          <span className={`w-1.5 h-1.5 rounded-full ${clinicState.live ? "bg-emerald-500" : "bg-amber-500"}`} />
          {clinicState.label}
        </div>
      </div>

      {/* Command center */}
      <div className="bg-white rounded-3xl p-4 shadow-sm">
        <SectionTitle
          icon={<Activity size={16} />}
          title="Today's control panel"
          subtitle={clinicState.detail}
        />
        <div className="grid grid-cols-2 gap-3">
          <Metric icon={<Users size={14} />} label="Patients today" value={visitsToday.length} sub={typicalWeekday ? `Typical ${now.toLocaleDateString("en-IN", { weekday: "long" })}: ~${Math.round(typicalWeekday)}` : "Building history"} />
          <Metric icon={<WalletCards size={14} />} label="Collected" value={money(actualIncome)} sub="Actual recorded collection" />
          <Metric icon={<CalendarClock size={14} />} label="Due today" value={dueToday.length} sub={`${forecast.pendingScheduled.length} still pending`} onClick={() => onNavigate?.("followup")} />
          <Metric icon={<AlertTriangle size={14} />} label="Attention" value={attention.length} sub={`${overdue.length} overdue`} onClick={() => onNavigate?.("followup")} />
        </div>
      </div>

      {/* Income outlook */}
      <div className="rounded-3xl p-4 shadow-sm" style={{ background: "linear-gradient(135deg, #0A5C54, #148A7A)" }}>
        <div className="flex items-start justify-between gap-3 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Today's income outlook</p>
            <p className="text-3xl font-bold mt-1">{money(forecast.fullDay)}</p>
            <p className="text-[11px] opacity-75 mt-1">Expected full-day collection</p>
          </div>
          <div className="px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-white/15">{forecast.confidence} confidence</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-2xl bg-white/10 p-2.5">
            <p className="text-[10px] opacity-70">Already collected</p>
            <p className="text-sm font-bold mt-1">{money(actualIncome)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-2.5">
            <p className="text-[10px] opacity-70">Scheduled</p>
            <p className="text-sm font-bold mt-1">{money(forecast.scheduledExpectedIncome)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-2.5">
            <p className="text-[10px] opacity-70">Walk-ins</p>
            <p className="text-sm font-bold mt-1">{money(forecast.remainingWalkInIncome)}</p>
          </div>
        </div>
        <p className="text-[10px] opacity-70 mt-3">Uses patient attendance history, recent collections and same-weekday demand. Forecast ≠ guarantee.</p>
      </div>

      {/* Flow + weather */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2" style={{ color: TEAL2 }}><Activity size={14} /><span className="text-[10px] font-semibold uppercase">Patient flow</span></div>
          <p className="text-xl font-bold" style={{ color: TEAL }}>{visitsToday.length} so far</p>
          {flowDifference !== null ? (
            <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold" style={{ color: flowDifference >= 0 ? "#15803D" : RED }}>
              {flowDifference >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(flowDifference).toFixed(0)} vs typical ({flowPct > 0 ? "+" : ""}{flowPct}%)
            </div>
          ) : <p className="text-[10px] mt-1" style={{ color: MUTED }}>Not enough history yet</p>}
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2" style={{ color: TEAL2 }}>{weatherIcon}<span className="text-[10px] font-semibold uppercase">Weather</span></div>
          {weather ? (
            <>
              <p className="text-xl font-bold" style={{ color: TEAL }}>{weather.temperature ?? "—"}°</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>{weather.condition || "Current conditions"}{weather.rain_probability != null ? ` · ${weather.rain_probability}% rain` : ""}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold" style={{ color: TEAL }}>{weatherLoading ? "Loading…" : "Weather context"}</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>{weatherError || "Live weather service not connected"}</p>
            </>
          )}
        </div>
      </div>

      {/* Weather is context, not an arbitrary income penalty */}
      {weather?.rain_probability >= 60 && (
        <div className="rounded-2xl p-3.5 bg-white shadow-sm border" style={{ borderColor: "#F59E0B55" }}>
          <div className="flex gap-2">
            <CloudRain size={16} color={AMBER} className="mt-0.5" />
            <div>
              <p className="text-xs font-semibold" style={{ color: AMBER }}>Possible walk-in disruption</p>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>Rain is high today. HomeoCure is showing this as a context signal only — it is not automatically reducing the rupee forecast without clinic-specific historical evidence.</p>
            </div>
          </div>
        </div>
      )}

      {/* What needs action */}
      <div className="bg-white rounded-3xl p-4 shadow-sm">
        <SectionTitle icon={<AlertTriangle size={16} />} title="Needs attention" subtitle="The patients most likely to need action today" right={onNavigate ? <button onClick={() => onNavigate("followup")} className="text-[10px] font-bold" style={{ color: TEAL2 }}>Open follow-up</button> : null} />
        {attention.length ? (
          <div className="space-y-2">
            {attention.map((row) => (
              <button
                key={`${row.patient.id}-${row.type}`}
                onClick={() => selectPatient?.(row.patient)}
                className="w-full flex items-center gap-3 rounded-2xl p-3 text-left active:scale-[0.99] transition"
                style={{ background: "#F4FAF8" }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "#14B8A61A", color: TEAL2 }}>
                  {(row.patient.name || "?").trim().slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: TEAL }}>{row.patient.name || "Unnamed patient"}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{row.type}{row.due ? ` · ${daysFromNow(row.due, now) === 0 ? "today" : `${Math.abs(daysFromNow(row.due, now))}d`}` : ""}</p>
                </div>
                <ChevronRight size={15} color={row.tone} />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl p-4 text-center" style={{ background: "#F4FAF8" }}>
            <CheckCircle2 size={22} color={TEAL2} className="mx-auto mb-1" />
            <p className="text-sm font-semibold" style={{ color: TEAL }}>Nothing urgent right now</p>
            <p className="text-[10px] mt-1" style={{ color: MUTED }}>Keep the day moving.</p>
          </div>
        )}
      </div>

      {/* Expected patients */}
      <div className="bg-white rounded-3xl p-4 shadow-sm">
        <SectionTitle icon={<Clock3 size={16} />} title={`Expected around today (${forecast.pendingScheduled.length})`} subtitle="Scheduled patients still pending" />
        {forecast.pendingScheduled.length ? (
          <div className="space-y-2">
            {forecast.pendingScheduled.slice(0, 8).map((row) => (
              <button key={row.patient.id} onClick={() => selectPatient?.(row.patient)} className="w-full flex items-center gap-3 py-2 text-left border-b last:border-0" style={{ borderColor: "#14B8A61A" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "#14B8A61A", color: TEAL2 }}>{(row.patient.name || "?").slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate" style={{ color: TEAL }}>{row.patient.name || "Unnamed patient"}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{Math.round(row.probability * 100)}% estimated return · {money(row.expectedCollection)} typical collection</p>
                </div>
                <p className="text-xs font-bold" style={{ color: TEAL }}>{money(row.expectedIncome)}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs py-3 text-center" style={{ color: MUTED }}>No scheduled follow-ups remain pending.</p>
        )}
      </div>

      {/* Day snapshot */}
      <div className="bg-white rounded-3xl p-4 shadow-sm">
        <SectionTitle icon={<IndianRupee size={16} />} title="Day snapshot" subtitle="What the dashboard currently knows" />
        <div className="grid grid-cols-2 gap-2.5">
          <Mini label="Expected more patients" value={forecast.remainingPatients} />
          <Mini label="Expected full-day patients" value={Math.max(visitsToday.length, visitsToday.length + forecast.remainingPatients)} />
          <Mini label="Comparable weekdays" value={forecast.comparableDays} />
          <Mini label="Clinic return history" value={`${Math.round(forecast.clinicRate * 100)}%`} />
          <Mini label="Low-stock / refill alerts" value={pharmacyAlerts.low} />
          <Mini label="Pharmacy collected" value={money(todayPharmacyIncome)} />
        </div>
        <p className="text-[10px] mt-3" style={{ color: MUTED }}>
          The forecast deliberately separates scheduled follow-ups from unscheduled demand so the same patient is not counted twice.
        </p>
      </div>

      <div className="px-1 text-center">
        <p className="text-[9px]" style={{ color: "#0A5C5466" }}>
          HomeoCure Today is a decision-support dashboard. Forecasts are estimates based on recorded clinic data, not guarantees.
        </p>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: "#F4FAF8" }}>
      <p className="text-[10px]" style={{ color: MUTED }}>{label}</p>
      <p className="text-sm font-bold mt-1" style={{ color: TEAL }}>{value}</p>
    </div>
  );
}
