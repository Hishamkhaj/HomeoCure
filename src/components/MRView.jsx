import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, Pencil, Trash2, Calendar, Camera, FileImage, Loader2 } from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const inputStyle = { borderColor: "#14B8A655" };
const labelClass = "text-xs font-medium block mb-1.5";
const labelStyle = { color: "#0A5C54" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Looks for the bill's grand total using common invoice keywords, from most to
// least specific, before falling back to "the largest number on the page".
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
    [/grand\s*total/i],
    [/net\s*amount/i, /net\s*payable/i],
    [/total\s*payable/i, /amount\s*payable/i],
    [/total\s*amount/i],
    [/\btotal\b/i],
  ];

  for (const patterns of keywordSets) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some((p) => p.test(line))) {
        let nums = numsInLine(line);
        if (nums.length === 0 && lines[i + 1]) {
          nums = numsInLine(lines[i + 1]);
        }
        if (nums.length > 0) return nums[nums.length - 1];
      }
    }
  }

  const allNums = lines.flatMap(numsInLine);
  if (allNums.length > 0) return Math.max(...allNums);
  return null;
}

const emptyOrderForm = { order_date: todayStr(), description: "", bill_amount: "", paid_amount: "" };

export default function MRView() {
  const [mrs, setMrs] = useState([]);
  const [activeMr, setActiveMr] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddMr, setShowAddMr] = useState(false);
  const [editMr, setEditMr] = useState(null);
  const [confirmDeleteMr, setConfirmDeleteMr] = useState(null);
  const [newMrName, setNewMrName] = useState("");

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null);
  const [billFile, setBillFile] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [existingBillPath, setExistingBillPath] = useState(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrDetected, setOcrDetected] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: mrList } = await supabase.from("mrs").select("*").order("created_at");
    setMrs(mrList || []);
    if (mrList && mrList.length && !activeMr) {
      setActiveMr(mrList[0].id);
      await loadOrders(mrList[0].id);
    }
    setLoading(false);
  }

  async function loadOrders(mrId) {
    const { data } = await supabase.from("mr_orders").select("*").eq("mr_id", mrId).order("order_date", { ascending: false });
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
    if (error) {
      alert("Could not add MR: " + error.message);
      return;
    }
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
    if (activeMr === mr.id) {
      setActiveMr(null);
      setOrders([]);
    }
    setConfirmDeleteMr(null);
  }

  function openAddOrder() {
    setEditOrder(null);
    setOrderForm(emptyOrderForm);
    setBillFile(null);
    setBillPreview(null);
    setExistingBillPath(null);
    setOcrText("");
    setOcrDetected(null);
    setShowOrderForm(true);
  }

  function openEditOrder(order) {
    setEditOrder(order);
    setOrderForm({
      order_date: order.order_date,
      description: order.description || "",
      bill_amount: String(order.bill_amount),
      paid_amount: String(order.paid_amount),
    });
    setBillFile(null);
    setBillPreview(null);
    setExistingBillPath(order.bill_file_path || null);
    setOcrText(order.ocr_raw_text || "");
    setOcrDetected(order.ocr_grand_total || null);
    setShowOrderForm(true);
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
      }
    } catch (err) {
      console.error("OCR failed:", err);
    }
    setOcrRunning(false);
  }

  async function viewBill(path) {
    const { data, error } = await supabase.storage.from("homeocure-bills").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else alert("Could not open bill: " + (error?.message || "unknown error"));
  }

  async function saveOrder(e) {
    e.preventDefault();
    let billFilePath = existingBillPath;

    if (billFile) {
      const fileExt = billFile.name.split(".").pop();
      const path = `${activeMr}/${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage.from("homeocure-bills").upload(path, billFile);
      if (uploadErr) {
        alert("Could not upload bill photo: " + uploadErr.message);
        return;
      }
      billFilePath = path;
    }

    const payload = {
      mr_id: activeMr,
      order_date: orderForm.order_date,
      description: orderForm.description,
      bill_amount: Number(orderForm.bill_amount) || 0,
      paid_amount: Number(orderForm.paid_amount) || 0,
      ...(billFile
        ? {
            bill_file_path: billFilePath,
            ocr_grand_total: ocrDetected,
            ocr_raw_text: ocrText ? ocrText.slice(0, 3000) : null,
            bill_uploaded_at: new Date().toISOString(),
            bill_received: true,
            bill_confirmed: true,
          }
        : {}),
    };
    if (editOrder) {
      const { error } = await supabase.from("mr_orders").update(payload).eq("id", editOrder.id);
      if (error) {
        alert("Could not save order: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("mr_orders").insert(payload);
      if (error) {
        alert("Could not save order: " + error.message);
        return;
      }
    }
    setShowOrderForm(false);
    setEditOrder(null);
    loadOrders(activeMr);
  }

  async function deleteOrder(order) {
    await supabase.from("mr_orders").delete().eq("id", order.id);
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setConfirmDeleteOrder(null);
  }

  if (loading) {
    return <p className="text-sm text-center py-10" style={{ color: "#0A5C5499" }}>Loading…</p>;
  }

  const activeMrObj = mrs.find((m) => m.id === activeMr);
  const mrPending = orders.reduce((sum, o) => sum + Math.max(0, o.bill_amount - o.paid_amount), 0);
  const mrTotalBill = orders.reduce((sum, o) => sum + o.bill_amount, 0);
  const mrTotalPaid = orders.reduce((sum, o) => sum + o.paid_amount, 0);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
        {mrs.map((mr) => (
          <div key={mr.id} className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => selectMr(mr.id)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={{
                background: activeMr === mr.id ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "#ffffff",
                color: activeMr === mr.id ? "white" : "#0A5C54",
                border: activeMr === mr.id ? "none" : "1px solid #14B8A655",
              }}
            >
              {mr.name}
            </button>
            {activeMr === mr.id && (
              <>
                <button
                  onClick={() => setEditMr({ id: mr.id, name: mr.name })}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm"
                  style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => setConfirmDeleteMr(mr)}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm"
                  style={{ color: "#DC2626", border: "1px solid #DC262655" }}
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowAddMr(true)}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm"
          style={{ color: "#148A7A", border: "1px solid #14B8A655" }}
        >
          <Plus size={16} />
        </button>
      </div>

      {mrs.length === 0 && (
        <p className="text-sm text-center py-10" style={{ color: "#0A5C5466" }}>
          No MRs yet — tap "+" above to add one.
        </p>
      )}

      {activeMrObj && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-[10px] mb-1" style={{ color: "#0A5C5499" }}>Total bill</p>
              <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>₹{mrTotalBill}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-[10px] mb-1" style={{ color: "#0A5C5499" }}>Paid</p>
              <p className="text-sm font-bold" style={{ color: "#148A7A" }}>₹{mrTotalPaid}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm text-center">
              <p className="text-[10px] mb-1" style={{ color: "#0A5C5499" }}>Pending</p>
              <p className="text-sm font-bold" style={{ color: mrPending > 0 ? "#DC2626" : "#0A5C54" }}>₹{mrPending}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs" style={{ color: "#0A5C5499" }}>
              {orders.length} order{orders.length !== 1 ? "s" : ""} — {activeMrObj.name}
            </p>
            <button
              onClick={openAddOrder}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
              style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
            >
              <Plus size={14} /> Add order
            </button>
          </div>

          <div className="space-y-2">
            {orders.map((o) => {
              const pending = Math.max(0, o.bill_amount - o.paid_amount);
              return (
                <div key={o.id} className="bg-white rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "#0A5C5499" }}>
                        <Calendar size={11} />
                        {new Date(o.order_date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      {o.description && (
                        <p className="text-sm" style={{ color: "#0A5C54" }}>{o.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openEditOrder(o)} style={{ color: "#148A7A" }}>
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setConfirmDeleteOrder(o)} style={{ color: "#DC2626" }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-2 pt-2 border-t" style={{ borderColor: "#14B8A633" }}>
                    <span style={{ color: "#0A5C5499" }}>Bill: <strong style={{ color: "#0A5C54" }}>₹{o.bill_amount}</strong></span>
                    <span style={{ color: "#0A5C5499" }}>Paid: <strong style={{ color: "#148A7A" }}>₹{o.paid_amount}</strong></span>
                    {pending > 0 && (
                      <span style={{ color: "#DC2626" }}>Pending: <strong>₹{pending}</strong></span>
                    )}
                  </div>
                  {o.bill_file_path && (
                    <button
                      onClick={() => viewBill(o.bill_file_path)}
                      className="flex items-center gap-1 text-xs font-medium mt-2"
                      style={{ color: "#148A7A" }}
                    >
                      <FileImage size={12} /> View bill photo
                    </button>
                  )}
                </div>
              );
            })}
            {orders.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: "#0A5C5466" }}>
                No orders logged yet for {activeMrObj.name}.
              </p>
            )}
          </div>
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
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Add MR
              </button>
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
              <button type="submit" className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                Save changes
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteMr && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteMr(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete MR?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>
              This will delete <strong>{confirmDeleteMr.name}</strong> and all their order history. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteMr(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deleteMr(confirmDeleteMr)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showOrderForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setShowOrderForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>
                {editOrder ? "Edit Order" : "New Order"}
              </h3>
              <button onClick={() => setShowOrderForm(false)} style={{ color: "#0A5C54" }}><X size={20} /></button>
            </div>
            <form onSubmit={saveOrder} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Order date</label>
                <input type="date" required value={orderForm.order_date} onChange={(e) => setOrderForm((f) => ({ ...f, order_date: e.target.value }))} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>What was ordered (optional)</label>
                <input value={orderForm.description} onChange={(e) => setOrderForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Belladonna Q, Arnica 30 x10" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Bill photo (optional)</label>
                <label
                  className="w-full border-2 border-dashed rounded-xl px-3 py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  style={{ borderColor: "#14B8A655" }}
                >
                  <input type="file" accept="image/*" capture="environment" onChange={handleBillFile} className="hidden" />
                  {billPreview ? (
                    <img src={billPreview} alt="Bill preview" className="max-h-32 rounded-lg object-contain" />
                  ) : (
                    <>
                      <Camera size={20} color="#148A7A" />
                      <span className="text-xs" style={{ color: "#0A5C5499" }}>
                        {existingBillPath ? "Replace bill photo" : "Tap to take / upload photo"}
                      </span>
                    </>
                  )}
                </label>
                {existingBillPath && !billFile && (
                  <button type="button" onClick={() => viewBill(existingBillPath)} className="flex items-center gap-1 text-xs font-medium mt-1.5" style={{ color: "#148A7A" }}>
                    <FileImage size={12} /> View current bill photo
                  </button>
                )}
                {ocrRunning && (
                  <p className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: "#0A5C5499" }}>
                    <Loader2 size={12} className="animate-spin" /> Reading bill… this can take a few seconds
                  </p>
                )}
                {!ocrRunning && ocrDetected && (
                  <p className="text-xs mt-1.5" style={{ color: "#148A7A" }}>
                    Detected total: ₹{ocrDetected} — please confirm below before saving.
                  </p>
                )}
                {!ocrRunning && billFile && !ocrDetected && (
                  <p className="text-xs mt-1.5" style={{ color: "#B45309" }}>
                    Couldn't auto-detect the amount — please enter it manually below.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>Bill amount (₹)</label>
                  <input type="number" value={orderForm.bill_amount} onChange={(e) => setOrderForm((f) => ({ ...f, bill_amount: e.target.value }))} className={inputClass} style={inputStyle} />
                </div>
                <div className="flex-1">
                  <label className={labelClass} style={labelStyle}>Paid so far (₹)</label>
                  <input type="number" value={orderForm.paid_amount} onChange={(e) => setOrderForm((f) => ({ ...f, paid_amount: e.target.value }))} className={inputClass} style={inputStyle} />
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
                {editOrder ? "Save changes" : "Add order"}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteOrder && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmDeleteOrder(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-serif mb-2" style={{ color: "#0A5C54" }}>Delete order?</h3>
            <p className="text-sm mb-5" style={{ color: "#0A5C5499" }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteOrder(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#14B8A655", color: "#0A5C54" }}>
                Cancel
              </button>
              <button onClick={() => deleteOrder(confirmDeleteOrder)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: "#DC2626" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
