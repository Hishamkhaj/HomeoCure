import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, Pencil, Trash2, Calendar, Camera, FileImage, Loader2, ArrowUpRight, ArrowDownRight, Calculator, PieChart } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractGrandTotal(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numRegex = /(?:₹|rs\.?|inr)?\s*[\d,]+\.?\d{0,2}/gi;
  function parseNum(raw) {
    const cleaned = raw.replace(/[₹a-zA-Z,\s]/gi, "");
    const val = parseFloat(cleaned);
    return isNaN(val) || val <= 0 ? null : val;
  }
  function numsInLine(line) {
    const matches = line.match(numRegex) || [];
    return matches.map(parseNum).filter((v) => v !== null);
  }
  const keywordSets = [
    [/grand\s*total/i], [/net\s*amount/i, /net\s*payable/i],
    [/total\s*payable/i, /amount\s*payable/i], [/total\s*amount/i], [/\btotal\b/i],
  ];
  for (const patterns of keywordSets) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some((p) => p.test(line))) {
        let nums = numsInLine(line);
        if (nums.length === 0 && lines[i + 1]) nums = numsInLine(lines[i + 1]);
        if (nums.length > 0) return nums[nums.length - 1];
      }
    }
  }
  const allNums = lines.flatMap(numsInLine);
  if (allNums.length > 0) return Math.max(...allNums);
  return null;
}

const emptyForm = { order_date: todayStr(), description: "", bill_amount: "", paid_amount: "" };
export default function MRView() {
  const [mrs, setMrs] = useState([]);
  const [activeMr, setActiveMr] = useState("OVERVIEW");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddMr, setShowAddMr] = useState(false);
  const [editMr, setEditMr] = useState(null);
  const [confirmDeleteMr, setConfirmDeleteMr] = useState(null);
  const [newMrName, setNewMrName] = useState("");

  const [formType, setFormType] = useState(null);
  const [smartMode, setSmartMode] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyForm);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null);
  
  const [billFile, setBillFile] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [existingBillPath, setExistingBillPath] = useState(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrDetected, setOcrDetected] = useState(null);

  const mrTotalBill = Math.round(orders.reduce((sum, o) => sum + (Number(o.bill_amount) || 0), 0));
  const mrTotalPaid = Math.round(orders.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0));
  const netPending = Math.max(0, mrTotalBill - mrTotalPaid);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: mrList } = await supabase.from("mrs").select("*").order("created_at");
    setMrs(mrList || []);
    await loadOrders("OVERVIEW");
    setLoading(false);
  }

  async function loadOrders(mrId) {
    let query = supabase.from("mr_orders").select("*").order("order_date", { ascending: true });
    if (mrId !== "OVERVIEW") {
      query = query.eq("mr_id", mrId);
    }
    const { data } = await query;
    setOrders(data || []);
  }

  async function selectMr(id) {
    setActiveMr(id);
    await loadOrders(id);
  }

  async function addMr(e) {
    e.preventDefault();
    if (!newMrName.trim()) return;
    const { data, error } = await supabase.from("mrs").insert({ name: newMrName.trim() }).select().single();
    if (error) { alert("Could not add MR: " + error.message); return; }
    setMrs((prev) => [...prev, data]);
    setNewMrName("");
    setShowAddMr(false);
    selectMr(data.id);
  }

  async function saveEditMr(e) {
    e.preventDefault();
    const { error } = await supabase.from("mrs").update({ name: editMr.name }).eq("id", editMr.id);
    if (!error) {
      setMrs((prev) => prev.map((m) => (m.id === editMr.id ? { ...m, name: editMr.name } : m)));
      setEditMr(null);
    }
  }

  async function deleteMr(mr) {
    await supabase.from("mrs").delete().eq("id", mr.id);
    setMrs((prev) => prev.filter((m) => m.id !== mr.id));
    if (activeMr === mr.id) { setActiveMr("OVERVIEW"); await loadOrders("OVERVIEW"); }
    setConfirmDeleteMr(null);
  }

  function openForm(type, order = null) {
    setFormType(type);
    setEditOrder(order);
    setSmartMode(false);
    setBillFile(null); setBillPreview(null); setOcrText(""); setOcrDetected(null);
    
    if (order) {
      setOrderForm({
        order_date: order.order_date,
        description: order.description || "",
        bill_amount: order.bill_amount > 0 ? String(order.bill_amount) : "",
        paid_amount: order.paid_amount > 0 ? String(order.paid_amount) : "",
      });
      setExistingBillPath(order.bill_file_path || null);
    } else {
      setOrderForm(emptyForm);
      setExistingBillPath(null);
    }
  }

  async function handleBillFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBillFile(file);
    setBillPreview(URL.createObjectURL(file));
    setOcrRunning(true);
    setOcrDetected(null);
    try {
      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setOcrText(data.text || "");
      const detected = extractGrandTotal(data.text || "");
      setOcrDetected(detected);
      if (detected) {
        setOrderForm((f) => ({ ...f, bill_amount: String(detected) }));
        if (detected > netPending && netPending > 0) setSmartMode(true);
      }
    } catch (err) { console.error("OCR failed:", err); }
    setOcrRunning(false);
  }

  async function viewBill(path) {
    const { data, error } = await supabase.storage.from("homeocure-bills").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else alert("Could not open bill: " + (error?.message || "unknown error"));
  }

  async function saveTransaction(e) {
    e.preventDefault();
    let billFilePath = existingBillPath;

    if (billFile && formType === 'bill') {
      const fileExt = billFile.name.split(".").pop();
      const path = `${activeMr}/${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage.from("homeocure-bills").upload(path, billFile);
      if (uploadErr) { alert("Could not upload bill photo: " + uploadErr.message); return; }
      billFilePath = path;
    }

    let finalBillAmt = 0;
    let finalPaidAmt = 0;

    if (formType === 'bill') {
      const enteredAmt = Number(orderForm.bill_amount) || 0;
      finalBillAmt = (smartMode && !editOrder) ? Math.max(0, enteredAmt - netPending) : enteredAmt;
    } else if (formType === 'payment') {
      const enteredAmt = Number(orderForm.paid_amount) || 0;
      finalPaidAmt = (smartMode && !editOrder) ? Math.max(0, netPending - enteredAmt) : enteredAmt;
    }

    const payload = {
      mr_id: activeMr,
      order_date: orderForm.order_date,
      description: orderForm.description,
      bill_amount: Math.round(finalBillAmt),
      paid_amount: Math.round(finalPaidAmt),
      ...(billFile && formType === 'bill' ? { bill_file_path: billFilePath, ocr_grand_total: ocrDetected, ocr_raw_text: ocrText ? ocrText.slice(0, 3000) : null, bill_uploaded_at: new Date().toISOString() } : {}),
    };

    if (editOrder) {
      const { error } = await supabase.from("mr_orders").update(payload).eq("id", editOrder.id);
      if (error) { alert("Error saving: " + error.message); return; }
    } else {
      const { error } = await supabase.from("mr_orders").insert(payload);
      if (error) { alert("Error saving: " + error.message); return; }
    }
    setFormType(null); setEditOrder(null); setSmartMode(false);
    loadOrders(activeMr);
  }

  async function deleteOrder(order) {
    await supabase.from("mr_orders").delete().eq("id", order.id);
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setConfirmDeleteOrder(null);
              }
    if (loading) return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading…</p>;

  const activeMrObj = mrs.find((m) => m.id === activeMr);
  
  let currentBalance = 0;
  const ledgerData = orders.map(o => {
    currentBalance += (Number(o.bill_amount) || 0) - (Number(o.paid_amount) || 0);
    return { ...o, runningBalance: Math.round(currentBalance) };
  }).reverse();

  // Calculate Monthly Stats for Overview
  const monthlyStats = {};
  if (activeMr === "OVERVIEW") {
    orders.forEach(o => {
      const d = new Date(o.order_date);
      const monthKey = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { purchased: 0, paid: 0 };
      monthlyStats[monthKey].purchased += (Number(o.bill_amount) || 0);
      monthlyStats[monthKey].paid += (Number(o.paid_amount) || 0);
    });
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
        <div className="shrink-0 flex items-center gap-1">
          <button onClick={() => selectMr("OVERVIEW")} className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5" style={{ background: activeMr === "OVERVIEW" ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#ffffff", color: activeMr === "OVERVIEW" ? "white" : "#0A5C54", border: activeMr === "OVERVIEW" ? "none" : "1px solid #14B8A655" }}>
            <PieChart size={12}/> Overview
          </button>
        </div>
        {mrs.map((mr) => (
          <div key={mr.id} className="shrink-0 flex items-center gap-1">
            <button onClick={() => selectMr(mr.id)} className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: activeMr === mr.id ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#ffffff", color: activeMr === mr.id ? "white" : "#0A5C54", border: activeMr === mr.id ? "none" : "1px solid #14B8A655" }}>
              {mr.name}
            </button>
            {activeMr === mr.id && (
              <>
                <button onClick={() => setEditMr({ id: mr.id, name: mr.name })} className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm" style={{ color: "#148A7A", border: "1px solid #14B8A655" }}><Pencil size={11} /></button>
                <button onClick={() => setConfirmDeleteMr(mr)} className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm" style={{ color: "#DC2626", border: "1px solid #DC262655" }}><Trash2 size={11} /></button>
              </>
            )}
          </div>
        ))}
        <button onClick={() => setShowAddMr(true)} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm" style={{ color: "#148A7A", border: "1px solid #14B8A655" }}><Plus size={16} /></button>
      </div>

      {mrs.length === 0 && <p className="text-sm text-center py-10" style={{ color: "#0A5C5466" }}>No MRs yet — tap "+" above to add one.</p>}

      {(activeMrObj || activeMr === "OVERVIEW") && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-[10px] mb-1 font-medium" style={{ color: "#0A5C5499" }}>Total Purchased</p>
              <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>₹{mrTotalBill}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-[10px] mb-1 font-medium" style={{ color: "#0A5C5499" }}>Total Paid</p>
              <p className="text-sm font-bold" style={{ color: "#15803D" }}>₹{mrTotalPaid}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-[10px] mb-1 font-medium" style={{ color: "#0A5C5499" }}>Balance Due</p>
              <p className="text-sm font-bold" style={{ color: netPending > 0 ? "#DC2626" : "#0A5C54" }}>₹{netPending}</p>
            </div>
          </div>

          {activeMr === "OVERVIEW" ? (
            <div className="mt-6">
              <p className="text-xs font-bold mb-3" style={{ color: "#0A5C54" }}>Monthly Analytics (All MRs)</p>
              <div className="space-y-2">
                {Object.entries(monthlyStats).map(([month, stats]) => (
                  <div key={month} className="bg-white p-3.5 rounded-xl shadow-sm flex items-center justify-between">
                    <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>{month}</p>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#0A5C5499" }}>Purchased: <span className="font-bold" style={{ color: "#DC2626" }}>₹{Math.round(stats.purchased)}</span></p>
                      <p className="text-xs" style={{ color: "#0A5C5499" }}>Paid: <span className="font-bold" style={{ color: "#15803D" }}>₹{Math.round(stats.paid)}</span></p>
                    </div>
                  </div>
                ))}
                {Object.keys(monthlyStats).length === 0 && <p className="text-center text-xs py-5" style={{ color: "#0A5C5499" }}>No data available yet.</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button onClick={() => openForm('bill')} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-gray-200 bg-white" style={{ color: "#DC2626" }}>
                  <ArrowUpRight size={14} /> Add Bill
                </button>
                <button onClick={() => openForm('payment')} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl text-white" style={{ background: "linear-gradient(135deg, #15803D, #166534)" }}>
                  <ArrowDownRight size={14} /> Record Payment
                </button>
              </div>

              <div className="space-y-2">
                {ledgerData.map((item) => {
                  const isPayment = item.paid_amount > 0 && item.bill_amount === 0;
                  return (
                    <div key={item.id} className="bg-white rounded-xl p-3.5 shadow-sm border-l-4" style={{ borderColor: isPayment ? "#15803D" : "#DC2626" }}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs mb-0.5" style={{ color: "#0A5C5499" }}>
                            <Calendar size={11} />
                            {new Date(item.order_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: isPayment ? "#DCFCE7" : "#FEE2E2", color: isPayment ? "#15803D" : "#DC2626" }}>
                              {isPayment ? "PAYMENT" : "BILL"}
                            </span>
                          </div>
                          <p className="text-sm mt-1" style={{ color: "#0A5C54" }}>{item.description || (isPayment ? "Payment sent" : "Stock purchased")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 opacity-60">
                          <button onClick={() => openForm(isPayment ? 'payment' : 'bill', item)} style={{ color: "#148A7A" }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmDeleteOrder(item)} style={{ color: "#DC2626" }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      
                      <div className="flex items-end justify-between mt-2 pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: "#0A5C5499" }}>{isPayment ? "Amount Paid" : "New Items Amount"}</p>
                          <p className="text-base font-bold" style={{ color: isPayment ? "#15803D" : "#DC2626" }}>₹{isPayment ? item.paid_amount : item.bill_amount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: "#0A5C5499" }}>Ledger Balance</p>
                          <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>₹{item.runningBalance}</p>
                        </div>
                      </div>

                      {item.bill_file_path && !isPayment && (
                        <button onClick={() => viewBill(item.bill_file_path)} className="flex items-center gap-1 text-xs font-medium mt-3 px-3 py-1.5 bg-gray-50 rounded-lg w-max" style={{ color: "#148A7A" }}>
                          <FileImage size={12} /> View Bill Photo
                        </button>
                      )}
                    </div>
                  );
                })}
                {ledgerData.length === 0 && <p className="text-center text-sm py-8" style={{ color: "#0A5C5466" }}>No ledger entries yet.</p>}
              </div>
            </>
          )}
        </>
      )}
            {showAddMr && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowAddMr(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>New MR</h3>
              <button onClick={() => setShowAddMr(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={addMr}>
              <label className={labelClass} style={labelStyle}>MR name</label>
              <input value={newMrName} onChange={(e) => setNewMrName(e.target.value)} className={inputClass} style={inputStyle} required />
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>Add MR</button>
            </form>
          </div>
        </div>
      )}

      {editMr && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setEditMr(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>Edit MR</h3>
              <button onClick={() => setEditMr(null)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveEditMr}>
              <label className={labelClass} style={labelStyle}>MR name</label>
              <input value={editMr.name} onChange={(e) => setEditMr((m) => ({ ...m, name: e.target.value }))} className={inputClass} style={inputStyle} required />
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>Save changes</button>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteMr && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteMr(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete MR?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>This will delete <strong>{confirmDeleteMr.name}</strong> and all their ledger history. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteMr(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>Cancel</button>
              <button onClick={() => deleteMr(confirmDeleteMr)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOrder && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteOrder(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete Entry?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>Are you sure you want to delete this {confirmDeleteOrder.paid_amount > 0 ? "payment" : "bill"} entry? It will recalculate your running balance. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteOrder(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>Cancel</button>
              <button onClick={() => deleteOrder(confirmDeleteOrder)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {formType && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setFormType(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>
                {editOrder ? "Edit Entry" : (formType === 'bill' ? "Add New Bill" : "Record Payment")}
              </h3>
              <button onClick={() => setFormType(null)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            
            <form onSubmit={saveTransaction} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Date</label>
                <input type="date" required value={orderForm.order_date} onChange={(e) => setOrderForm((f) => ({ ...f, order_date: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>

              {formType === 'bill' && (
                <div>
                  <label className={labelClass} style={labelStyle}>Bill Photo / Slip (Optional)</label>
                  <label className="w-full border-2 border-dashed rounded-xl px-3 py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer" style={{ borderColor: "#14B8A655" }}>
                    {/* Yahan se capture="environment" hata diya gaya hai taaki Gallery ka option aaye */}
                    <input type="file" accept="image/*" onChange={handleBillFile} className="hidden" />
                    {billPreview ? <img src={billPreview} alt="Bill preview" className="max-h-32 rounded-lg object-contain" /> : (
                      <>
                        <Camera size={20} color="#148A7A" />
                        <span className="text-xs" style={{ color: "#0A5C5499" }}>{existingBillPath ? "Replace photo" : "Tap to upload paper slip or bill"}</span>
                      </>
                    )}
                  </label>
                  {existingBillPath && !billFile && (
                    <button type="button" onClick={() => viewBill(existingBillPath)} className="flex items-center gap-1 text-xs font-medium mt-1.5" style={{ color: "#148A7A" }}><FileImage size={12} /> View saved photo</button>
                  )}
                  {ocrRunning && <p className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "#0A5C5499" }}><Loader2 size={12} className="animate-spin" /> Scanning amount...</p>}
                </div>
              )}

              <div>
                <label className={labelClass} style={labelStyle}>{formType === 'bill' ? "Amount written on Bill (₹)" : "Amount Paid or Remaining (₹)"}</label>
                <input 
                  type="number" required min="1" step="0.01" 
                  value={formType === 'bill' ? orderForm.bill_amount : orderForm.paid_amount} 
                  onChange={(e) => setOrderForm((f) => ({ ...f, [formType === 'bill' ? 'bill_amount' : 'paid_amount']: e.target.value }))} 
                  className={inputClass} style={inputStyle} 
                />
              </div>

              {!editOrder && netPending > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-teal-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-1 accent-teal-600" checked={smartMode} onChange={(e) => setSmartMode(e.target.checked)} />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold" style={{ color: "#0A5C54" }}>
                        {formType === 'bill' ? `बिल में पुराना बैलेंस (₹${netPending}) जुड़ा है?` : `क्या ये बचा हुआ (Remaining) बैलेंस है?`}
                      </p>
                      <p className="text-[9px] mt-0.5" style={{ color: "#0A5C5499" }}>
                        {formType === 'bill' ? "सिस्टम ख़ुद सिर्फ़ नए ऑर्डर का पैसा सेव कर लेगा।" : "सिस्टम ख़ुद कैलकुलेट कर लेगा कि पेमेंट कितने का हुआ।"}
                      </p>
                    </div>
                  </label>
                  
                  {smartMode && (
                    <div className="mt-2 pt-2 border-t border-teal-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold" style={{ color: "#148A7A" }}><Calculator size={10} className="inline mr-1"/> Auto-calculated:</span>
                      <span className="text-sm font-black" style={{ color: "#0A5C54" }}>
                        ₹{formType === 'bill' 
                          ? Math.round(Math.max(0, (Number(orderForm.bill_amount) || 0) - netPending))
                          : Math.round(Math.max(0, netPending - (Number(orderForm.paid_amount) || 0)))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={labelClass} style={labelStyle}>Notes / Description (Optional)</label>
                <input value={orderForm.description} onChange={(e) => setOrderForm((f) => ({ ...f, description: e.target.value }))} placeholder={formType === 'bill' ? "e.g. 5x Arnica, etc." : "e.g. Paid via Cash/UPI"} className={inputClass} style={inputStyle} />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-4" style={{ background: formType === 'bill' ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "linear-gradient(135deg, #15803D, #166534)" }}>
                {editOrder ? "Save Changes" : (formType === 'bill' ? "Save New Bill" : "Save Payment")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
