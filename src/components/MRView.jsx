import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  Upload,
  FileText,
  IndianRupee,
  ShoppingCart,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Save,
} from "lucide-react";
import { supabase } from "../supabaseClient";

const inputClass =
  "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";
const labelClass = "text-xs font-medium block mb-1.5";
const teal = "#0A5C54";
const teal2 = "#148A7A";

const emptyMR = {
  name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

const emptyOrder = {
  order_date: new Date().toISOString().slice(0, 10),
  expected_delivery_date: "",
  description: "",
  notes: "",
  status: "ordered",
  paid_amount: "",
  payment_date: "",
  payment_mode: "",
};

const emptyItem = {
  product_name: "",
  pharmacy_product_id: "",
  product_type: "unit",
  quantity: "1",
  unit_label: "piece",
  unit_price: "",
  discount: "0",
  tax: "0",
  notes: "",
};

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status) {
  return {
    draft: "Draft",
    ordered: "Ordered",
    partially_received: "Partially Received",
    delivered: "Delivered",
    cancelled: "Cancelled",
  }[status] || status;
}

function statusClasses(status) {
  return {
    draft: "bg-slate-100 text-slate-700",
    ordered: "bg-blue-50 text-blue-700",
    partially_received: "bg-amber-50 text-amber-700",
    delivered: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  }[status] || "bg-slate-100 text-slate-700";
}

function itemTotal(item) {
  return Math.max(
    0,
    Number(item.quantity || 0) * Number(item.unit_price || 0) -
      Number(item.discount || 0) +
      Number(item.tax || 0)
  );
}

export default function MRView() {
  const [mrs, setMRs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [selectedMR, setSelectedMR] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  const [showMRForm, setShowMRForm] = useState(false);
  const [editingMR, setEditingMR] = useState(null);
  const [mrForm, setMRForm] = useState(emptyMR);

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [itemDraft, setItemDraft] = useState(emptyItem);

  const [showBill, setShowBill] = useState(false);
  const [billOrder, setBillOrder] = useState(null);
  const [billAmount, setBillAmount] = useState("");
  const [billFile, setBillFile] = useState(null);
  const [uploadingBill, setUploadingBill] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    setError("");

    const [mrRes, orderRes, productRes, summaryRes] = await Promise.all([
      supabase.from("mrs").select("*").order("name"),
      supabase
        .from("mr_orders")
        .select("*, mrs(name, company)")
        .order("order_date", { ascending: false }),
      supabase.from("pharmacy_products").select("id, name, tracking_type, measure_unit"),
      supabase.from("mr_summary").select("*"),
    ]);

    if (mrRes.error) setError(mrRes.error.message);
    if (orderRes.error) setError(orderRes.error.message);
    if (summaryRes.error) setError(summaryRes.error.message);

    setMRs(mrRes.data || []);
    setOrders(orderRes.data || []);
    setProducts(productRes.data || []);
    setSummary(summaryRes.data || []);
    setLoading(false);
  }

  async function fetchOrderItems(orderId) {
    const { data, error: fetchError } = await supabase
      .from("mr_order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at");

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setOrderItems(data || []);
  }

  const filteredMRs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mrs.filter((m) => m.is_active !== false);
    return mrs.filter((m) =>
      [m.name, m.company, m.phone].filter(Boolean).some((x) =>
        String(x).toLowerCase().includes(q)
      )
    );
  }, [mrs, query]);

  const selectedSummary =
    summary.find((x) => x.id === selectedMR?.id) || null;

  const selectedOrders = selectedMR
    ? orders.filter((o) => o.mr_id === selectedMR.id)
    : [];

  const orderTotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + itemTotal(item), 0),
    [orderItems]
  );

  function openAddMR() {
    setEditingMR(null);
    setMRForm(emptyMR);
    setShowMRForm(true);
  }

  function openEditMR(mr) {
    setEditingMR(mr);
    setMRForm({
      name: mr.name || "",
      company: mr.company || "",
      phone: mr.phone || "",
      email: mr.email || "",
      address: mr.address || "",
      notes: mr.notes || "",
      is_active: mr.is_active !== false,
    });
    setShowMRForm(true);
  }

  async function saveMR(e) {
    e.preventDefault();
    if (!mrForm.name.trim()) return;

    setSaving(true);
    setError("");

    const payload = {
      ...mrForm,
      name: mrForm.name.trim(),
      company: mrForm.company.trim() || null,
      phone: mrForm.phone.trim() || null,
      email: mrForm.email.trim() || null,
      address: mrForm.address.trim() || null,
      notes: mrForm.notes.trim() || null,
    };

    const result = editingMR
      ? await supabase.from("mrs").update(payload).eq("id", editingMR.id).select().single()
      : await supabase.from("mrs").insert(payload).select().single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (editingMR) {
      setMRs((prev) =>
        prev.map((x) => (x.id === editingMR.id ? result.data : x))
      );
      if (selectedMR?.id === editingMR.id) setSelectedMR(result.data);
    } else {
      setMRs((prev) => [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedMR(result.data);
    }

    setShowMRForm(false);
    setEditingMR(null);
    setMRForm(emptyMR);
    setSaving(false);
    await fetchAll();
  }

  async function deactivateMR(mr) {
    if (!window.confirm(`Deactivate ${mr.name}? Existing orders will remain safe.`)) return;

    const { error: updateError } = await supabase
      .from("mrs")
      .update({ is_active: false })
      .eq("id", mr.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (selectedMR?.id === mr.id) setSelectedMR(null);
    await fetchAll();
  }

  function openAddOrder() {
    if (!selectedMR) return;
    setSelectedOrder(null);
    setOrderForm(emptyOrder);
    setOrderItems([]);
    setItemDraft(emptyItem);
    setShowOrderForm(true);
  }

  async function openOrder(order) {
    setSelectedOrder(order);
    setOrderForm({
      order_date: order.order_date || "",
      expected_delivery_date: order.expected_delivery_date || "",
      description: order.description || "",
      notes: order.notes || "",
      status: order.status || "ordered",
      paid_amount: String(order.paid_amount ?? ""),
      payment_date: order.payment_date || "",
      payment_mode: order.payment_mode || "",
    });
    await fetchOrderItems(order.id);
  }

  function addItemDraft() {
    if (!itemDraft.product_name.trim()) return;

    const newItem = {
      ...itemDraft,
      product_name: itemDraft.product_name.trim(),
      quantity: Number(itemDraft.quantity) || 1,
      unit_price: Number(itemDraft.unit_price) || 0,
      discount: Number(itemDraft.discount) || 0,
      tax: Number(itemDraft.tax) || 0,
      pharmacy_product_id: itemDraft.pharmacy_product_id || null,
    };

    setOrderItems((prev) => [...prev, { ...newItem, __temp: true, id: `temp-${Date.now()}` }]);
    setItemDraft(emptyItem);
  }

  function removeItem(item) {
    setOrderItems((prev) => prev.filter((x) => x.id !== item.id));
  }

  async function saveOrder(e) {
    e.preventDefault();
    if (!selectedMR) return;

    setSaving(true);
    setError("");

    const payload = {
      mr_id: selectedMR.id,
      order_date: orderForm.order_date || new Date().toISOString().slice(0, 10),
      expected_delivery_date: orderForm.expected_delivery_date || null,
      description: orderForm.description.trim() || null,
      notes: orderForm.notes.trim() || null,
      status: orderForm.status,
      paid_amount: Number(orderForm.paid_amount) || 0,
      payment_date: orderForm.payment_date || null,
      payment_mode: orderForm.payment_mode.trim() || null,
    };

    let result;

    if (selectedOrder) {
      result = await supabase
        .from("mr_orders")
        .update(payload)
        .eq("id", selectedOrder.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("mr_orders")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const orderId = result.data.id;

    if (selectedOrder) {
      await supabase.from("mr_order_items").delete().eq("order_id", orderId);
    }

    const cleanItems = orderItems.map(({ __temp, id, ...item }) => ({
      ...item,
      order_id: orderId,
    }));

    if (cleanItems.length) {
      const itemsResult = await supabase.from("mr_order_items").insert(cleanItems);
      if (itemsResult.error) {
        setError(itemsResult.error.message);
        setSaving(false);
        return;
      }
    }

    setShowOrderForm(false);
    setSelectedOrder(null);
    setOrderItems([]);
    setSaving(false);

    await fetchAll();
  }

  async function deleteOrder(order) {
    if (!window.confirm("Delete this order? Its order items will also be removed.")) return;

    const { error: deleteError } = await supabase
      .from("mr_orders")
      .delete()
      .eq("id", order.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (selectedOrder?.id === order.id) setSelectedOrder(null);
    await fetchAll();
  }

  function openBill(order) {
    setBillOrder(order);
    setBillAmount(order.bill_amount ?? "");
    setBillFile(null);
    setShowBill(true);
  }

  async function saveBill(e) {
    e.preventDefault();
    if (!billOrder) return;

    setUploadingBill(true);
    setError("");

    let filePath = billOrder.bill_file_path || null;

    if (billFile) {
      const safeName = billFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${billOrder.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("homeocure-bills")
        .upload(path, billFile, {
          upsert: true,
          contentType: billFile.type || "application/octet-stream",
        });

      if (uploadError) {
        setError(uploadError.message);
        setUploadingBill(false);
        return;
      }

      filePath = path;
    }

    const amount = Number(billAmount) || 0;

    const { error: updateError } = await supabase
      .from("mr_orders")
      .update({
        bill_amount: amount,
        bill_received: true,
        bill_confirmed: true,
        bill_uploaded_at: new Date().toISOString(),
        bill_file_path: filePath,
      })
      .eq("id", billOrder.id);

    if (updateError) {
      setError(updateError.message);
      setUploadingBill(false);
      return;
    }

    setShowBill(false);
    setBillOrder(null);
    setBillFile(null);
    setBillAmount("");
    setUploadingBill(false);
    await fetchAll();
  }

  async function markPaid(order) {
    const amount =
      Number(order.bill_amount ?? order.order_amount ?? 0) || 0;

    const paymentMode = window.prompt(
      `Enter payment mode (e.g. UPI, Cash, Bank Transfer):`,
      order.payment_mode || ""
    );

    if (paymentMode === null) return;

    const { error: updateError } = await supabase
      .from("mr_orders")
      .update({
        paid_amount: amount,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_mode: paymentMode || null,
      })
      .eq("id", order.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchAll();
  }

  async function savePartialPayment(order) {
    const maxAmount = Number(order.bill_amount ?? order.order_amount ?? 0);
    const current = Number(order.paid_amount || 0);

    const value = window.prompt(
      `Current paid: ${money(current)}\nEnter new total paid amount:`,
      String(current)
    );

    if (value === null) return;

    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > maxAmount) {
      alert(`Enter an amount between 0 and ${money(maxAmount)}.`);
      return;
    }

    const { error: updateError } = await supabase
      .from("mr_orders")
      .update({
        paid_amount: amount,
        payment_date:
          amount > current
            ? new Date().toISOString().slice(0, 10)
            : order.payment_date,
      })
      .eq("id", order.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchAll();
  }

  function getPending(order) {
    const total = Number(order.bill_amount ?? order.order_amount ?? 0);
    return Math.max(0, total - Number(order.paid_amount || 0));
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: `${teal}99` }}>
        Loading MR & procurement…
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {!selectedMR ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: teal }}>
                MR & Procurement
              </h2>
              <p className="text-xs mt-1" style={{ color: `${teal}88` }}>
                Manage medical representatives, orders, bills and payments.
              </p>
            </div>

            <button
              onClick={openAddMR}
              className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-white flex items-center gap-2"
              style={{ background: `linear-gradient(135deg, ${teal2}, ${teal})` }}
            >
              <Plus size={16} />
              Add MR
            </button>
          </div>

          <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm mb-4 flex items-center gap-2 border border-teal-100">
            <Search size={16} color={teal2} />
            <input
              className="flex-1 outline-none text-sm"
              placeholder="Search MR, company or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-2xl p-4 border border-teal-100">
              <p className="text-xs text-slate-500">Active MRs</p>
              <p className="text-2xl font-semibold mt-1" style={{ color: teal }}>
                {mrs.filter((x) => x.is_active !== false).length}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-teal-100">
              <p className="text-xs text-slate-500">Total Pending</p>
              <p className="text-2xl font-semibold mt-1 text-red-600">
                {money(summary.reduce((s, x) => s + Number(x.total_pending || 0), 0))}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {filteredMRs.map((mr) => {
              const s = summary.find((x) => x.id === mr.id);
              return (
                <button
                  key={mr.id}
                  onClick={() => setSelectedMR(mr)}
                  className="w-full text-left bg-white rounded-2xl p-4 border border-teal-100 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold" style={{ color: teal }}>
                        {mr.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {mr.company || "No company added"}
                      </p>
                      {mr.phone && (
                        <p className="text-xs text-slate-500 mt-1">{mr.phone}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-slate-500">Pending</p>
                      <p className="font-semibold text-red-600">
                        {money(s?.total_pending)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[11px] text-slate-500">Orders</p>
                      <p className="font-semibold text-sm">{s?.total_orders || 0}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[11px] text-slate-500">Billed</p>
                      <p className="font-semibold text-sm">{money(s?.total_billed)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-[11px] text-slate-500">Paid</p>
                      <p className="font-semibold text-sm text-emerald-700">
                        {money(s?.total_paid)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredMRs.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-teal-200">
                <ShoppingCart size={30} className="mx-auto mb-2" color="#148A7A" />
                <p className="text-sm font-medium" style={{ color: teal }}>
                  No MR found
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Add your first medical representative.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setSelectedMR(null);
                setSelectedOrder(null);
              }}
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: teal2 }}
            >
              <ChevronLeft size={18} />
              All MRs
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditMR(selectedMR)}
                className="w-9 h-9 rounded-xl bg-white border border-teal-100 flex items-center justify-center"
                style={{ color: teal2 }}
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => deactivateMR(selectedMR)}
                className="w-9 h-9 rounded-xl bg-white border border-red-100 flex items-center justify-center text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-teal-100 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: teal }}>
                  {selectedMR.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedMR.company || "Company not added"}
                </p>
                {selectedMR.phone && (
                  <p className="text-xs text-slate-500 mt-1">{selectedMR.phone}</p>
                )}
              </div>

              <button
                onClick={openAddOrder}
                className="rounded-xl px-3 py-2 text-xs font-medium text-white flex items-center gap-1.5"
                style={{ background: teal2 }}
              >
                <Plus size={14} />
                New Order
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-500">Total Orders</p>
                <p className="font-semibold">{selectedSummary?.total_orders || 0}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-[11px] text-red-600">Pending</p>
                <p className="font-semibold text-red-700">
                  {money(selectedSummary?.total_pending)}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-[11px] text-emerald-700">Paid</p>
                <p className="font-semibold text-emerald-700">
                  {money(selectedSummary?.total_paid)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-[11px] text-blue-700">Billed</p>
                <p className="font-semibold text-blue-700">
                  {money(selectedSummary?.total_billed)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {selectedOrders.map((order) => {
              const pending = getPending(order);
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-teal-100 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      className="text-left flex-1"
                      onClick={() => openOrder(order)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold" style={{ color: teal }}>
                          Order · {formatDate(order.order_date)}
                        </p>
                        <span
                          className={`text-[11px] px-2 py-1 rounded-full ${statusClasses(
                            order.status
                          )}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-1">
                        {order.description || "No description"}
                      </p>
                    </button>

                    <button
                      onClick={() => deleteOrder(order)}
                      className="text-red-500 p-1"
                      title="Delete order"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div>
                      <p className="text-[11px] text-slate-500">Order/Bill</p>
                      <p className="text-sm font-semibold">
                        {money(order.bill_amount ?? order.order_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Paid</p>
                      <p className="text-sm font-semibold text-emerald-700">
                        {money(order.paid_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Pending</p>
                      <p className="text-sm font-semibold text-red-600">
                        {money(pending)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 flex-wrap">
                    <button
                      onClick={() => openOrder(order)}
                      className="px-3 py-2 rounded-xl text-xs font-medium border border-teal-100"
                      style={{ color: teal2 }}
                    >
                      View / Edit
                    </button>

                    <button
                      onClick={() => openBill(order)}
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 flex items-center gap-1.5"
                      style={{ color: teal }}
                    >
                      <Upload size={13} />
                      {order.bill_received ? "Update Bill" : "Upload Bill"}
                    </button>

                    {pending > 0 && (
                      <>
                        <button
                          onClick={() => savePartialPayment(order)}
                          className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-700"
                        >
                          Update Paid
                        </button>
                        <button
                          onClick={() => markPaid(order)}
                          className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700"
                        >
                          Mark Fully Paid
                        </button>
                      </>
                    )}
                  </div>

                  {order.bill_file_path && (
                    <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
                      <FileText size={12} />
                      Bill saved in Supabase Storage
                    </p>
                  )}
                </div>
              );
            })}

            {selectedOrders.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-teal-200">
                <ShoppingCart size={30} className="mx-auto mb-2" color="#148A7A" />
                <p className="text-sm font-medium" style={{ color: teal }}>
                  No orders yet
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Tap “New Order” to create the first order.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {showMRForm && (
        <Modal
          title={editingMR ? "Edit MR" : "Add Medical Representative"}
          onClose={() => setShowMRForm(false)}
        >
          <form onSubmit={saveMR} className="space-y-4">
            <Field label="MR Name *">
              <input
                className={inputClass}
                value={mrForm.name}
                onChange={(e) => setMRForm({ ...mrForm, name: e.target.value })}
                placeholder="e.g. Ahmed Khan"
                required
              />
            </Field>

            <Field label="Company">
              <input
                className={inputClass}
                value={mrForm.company}
                onChange={(e) => setMRForm({ ...mrForm, company: e.target.value })}
                placeholder="e.g. XYZ Pharma"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input
                  className={inputClass}
                  value={mrForm.phone}
                  onChange={(e) => setMRForm({ ...mrForm, phone: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  value={mrForm.email}
                  onChange={(e) => setMRForm({ ...mrForm, email: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Address">
              <textarea
                className={inputClass}
                rows={2}
                value={mrForm.address}
                onChange={(e) => setMRForm({ ...mrForm, address: e.target.value })}
              />
            </Field>

            <Field label="Notes">
              <textarea
                className={inputClass}
                rows={2}
                value={mrForm.notes}
                onChange={(e) => setMRForm({ ...mrForm, notes: e.target.value })}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMRForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm text-white flex items-center gap-2"
                style={{ background: teal2 }}
              >
                <Save size={15} />
                {saving ? "Saving…" : "Save MR"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showOrderForm && (
        <Modal
          title={selectedOrder ? "Edit Order" : `New Order — ${selectedMR?.name}`}
          onClose={() => setShowOrderForm(false)}
          wide
        >
          <form onSubmit={saveOrder} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Order Date">
                <input
                  className={inputClass}
                  type="date"
                  value={orderForm.order_date}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, order_date: e.target.value })
                  }
                />
              </Field>

              <Field label="Expected Delivery">
                <input
                  className={inputClass}
                  type="date"
                  value={orderForm.expected_delivery_date}
                  onChange={(e) =>
                    setOrderForm({
                      ...orderForm,
                      expected_delivery_date: e.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  className={inputClass}
                  value={orderForm.status}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, status: e.target.value })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="ordered">Ordered</option>
                  <option value="partially_received">Partially Received</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>

              <Field label="Initial Paid Amount">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={orderForm.paid_amount}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, paid_amount: e.target.value })
                  }
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Description">
              <input
                className={inputClass}
                value={orderForm.description}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, description: e.target.value })
                }
                placeholder="e.g. Monthly medicine order"
              />
            </Field>

            <div className="border border-teal-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: teal }}>
                    Order Items
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Add unit or volume-based products.
                  </p>
                </div>
                <p className="font-semibold" style={{ color: teal }}>
                  {money(orderTotal)}
                </p>
              </div>

              {orderItems.length > 0 && (
                <div className="space-y-2 mb-4">
                  {orderItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-slate-50 p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.product_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.quantity} {item.unit_label || "piece"} ×{" "}
                          {money(item.unit_price)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{money(itemTotal(item))}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="text-red-500"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="Product name"
                  value={itemDraft.product_name}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, product_name: e.target.value })
                  }
                  list="homeocure-pharmacy-products"
                />

                <select
                  className={inputClass}
                  value={itemDraft.pharmacy_product_id}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setItemDraft({
                      ...itemDraft,
                      pharmacy_product_id: e.target.value,
                      product_name: p?.name || itemDraft.product_name,
                      product_type: p?.tracking_type === "volume" ? "volume" : "unit",
                      unit_label:
                        p?.tracking_type === "volume"
                          ? p?.measure_unit || "ml"
                          : "piece",
                    });
                  }}
                >
                  <option value="">Link pharmacy product (optional)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClass}
                  value={itemDraft.product_type}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, product_type: e.target.value })
                  }
                >
                  <option value="unit">Unit product</option>
                  <option value="volume">Volume product</option>
                </select>

                <input
                  className={inputClass}
                  placeholder="Unit (piece / bottle / ml)"
                  value={itemDraft.unit_label}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, unit_label: e.target.value })
                  }
                />

                <input
                  className={inputClass}
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Quantity"
                  value={itemDraft.quantity}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, quantity: e.target.value })
                  }
                />

                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit price"
                  value={itemDraft.unit_price}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, unit_price: e.target.value })
                  }
                />

                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Discount"
                  value={itemDraft.discount}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, discount: e.target.value })
                  }
                />

                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Tax"
                  value={itemDraft.tax}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, tax: e.target.value })
                  }
                />
              </div>

              <button
                type="button"
                onClick={addItemDraft}
                className="mt-3 px-3 py-2 rounded-xl text-xs font-medium border border-teal-200"
                style={{ color: teal2 }}
              >
                + Add Item
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment Date">
                <input
                  className={inputClass}
                  type="date"
                  value={orderForm.payment_date}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, payment_date: e.target.value })
                  }
                />
              </Field>

              <Field label="Payment Mode">
                <input
                  className={inputClass}
                  value={orderForm.payment_mode}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, payment_mode: e.target.value })
                  }
                  placeholder="UPI / Cash / Bank"
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                className={inputClass}
                rows={2}
                value={orderForm.notes}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, notes: e.target.value })
                }
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOrderForm(false)}
                className="px-4 py-2.5 rounded-xl text-sm bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm text-white flex items-center gap-2"
                style={{ background: teal2 }}
              >
                <Save size={15} />
                {saving ? "Saving…" : "Save Order"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBill && (
        <Modal title="Upload Supplier Bill" onClose={() => setShowBill(false)}>
          <form onSubmit={saveBill} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Order amount</p>
              <p className="font-semibold mt-1" style={{ color: teal }}>
                {money(billOrder?.order_amount)}
              </p>
            </div>

            <Field label="Grand Total on Bill *">
              <div className="relative">
                <IndianRupee
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className={`${inputClass} pl-9`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="Enter bill grand total"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                OCR can be connected later. For now confirm the grand total manually.
              </p>
            </Field>

            <Field label="Bill Photo / PDF">
              <label className="border-2 border-dashed border-teal-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-teal-50/30">
                <Upload size={24} color={teal2} />
                <p className="text-sm font-medium mt-2" style={{ color: teal }}>
                  {billFile ? billFile.name : "Choose bill photo or PDF"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  JPG, PNG, WEBP or PDF
                </p>
                <input
                  className="hidden"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                />
              </label>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBill(false)}
                className="px-4 py-2.5 rounded-xl text-sm bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={uploadingBill}
                className="px-4 py-2.5 rounded-xl text-sm text-white flex items-center gap-2"
                style={{ background: teal2 }}
              >
                <Upload size={15} />
                {uploadingBill ? "Uploading…" : "Save Bill"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: teal }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${
          wide ? "max-w-3xl" : "max-w-lg"
        } max-h-[92vh] overflow-y-auto`}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: teal }}>
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
