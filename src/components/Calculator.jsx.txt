import React, { useState } from "react";
import { X, Delete } from "lucide-react";

// Simple 4-function calculator modal with percentage support. onUse(value) is
// called with the final number when the user confirms.
export default function Calculator({ label, initialValue, onClose, onUse }) {
  const [display, setDisplay] = useState(initialValue && initialValue !== "0" ? initialValue : "0");
  const [pending, setPending] = useState(null); // { value, op }
  const [justEvaluated, setJustEvaluated] = useState(false);

  function inputDigit(d) {
    if (justEvaluated) {
      setDisplay(d);
      setJustEvaluated(false);
      return;
    }
    setDisplay((prev) => (prev === "0" ? d : prev + d));
  }

  function inputDot() {
    if (justEvaluated) {
      setDisplay("0.");
      setJustEvaluated(false);
      return;
    }
    if (!display.includes(".")) setDisplay((prev) => prev + ".");
  }

  function clearAll() {
    setDisplay("0");
    setPending(null);
    setJustEvaluated(false);
  }

  function backspace() {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }

  function applyOp(op) {
    // Pressing an operator twice in a row without typing a new number should
    // just switch the pending operator, not silently recompute with 0.
    if (pending && display === "0" && !justEvaluated) {
      setPending((p) => ({ ...p, op }));
      return;
    }
    const current = parseFloat(display);
    if (pending) {
      const result = compute(pending.value, current, pending.op);
      setPending({ value: result, op });
    } else {
      setPending({ value: current, op });
    }
    setJustEvaluated(false);
    setDisplay("0");
  }

  function compute(a, b, op) {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  }

  function equals() {
    if (!pending) return;
    const current = parseFloat(display);
    const result = compute(pending.value, current, pending.op);
    setDisplay(String(result));
    setPending(null);
    setJustEvaluated(true);
  }

  // Matches common phone-calculator behaviour: "105 - 30%" resolves immediately
  // to 73.5 (105 minus 30% of 105), no need to press "=" afterward.
  function applyPercent() {
    const current = parseFloat(display) || 0;
    if (pending && (pending.op === "+" || pending.op === "-")) {
      const percentValue = (pending.value * current) / 100;
      const result = compute(pending.value, percentValue, pending.op);
      setDisplay(String(result));
      setPending(null);
      setJustEvaluated(true);
      return;
    }
    if (pending) {
      // for × or ÷, % just means "divide this number by 100" before continuing
      setDisplay(String(current / 100));
      return;
    }
    setDisplay(String(current / 100));
  }

  function handleUse() {
    const val = pending ? compute(pending.value, parseFloat(display), pending.op) : parseFloat(display);
    onUse(String(Math.round(val * 100) / 100));
  }

  const btnClass =
    "h-14 rounded-xl text-lg font-semibold flex items-center justify-center active:scale-95 transition";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-serif" style={{ color: "#0A5C54" }}>
            Calculator {label ? `— ${label}` : ""}
          </h3>
          <button onClick={onClose} style={{ color: "#0A5C54" }}>
            <X size={20} />
          </button>
        </div>

        <div
          className="rounded-xl px-4 py-4 mb-4 text-right overflow-x-auto"
          style={{ background: "#F4FAF8", color: "#0A5C54" }}
        >
          {pending && !justEvaluated && (
            <p className="text-xs mb-1" style={{ color: "#0A5C5499" }}>
              {pending.value} {pending.op}
            </p>
          )}
          <p className="text-3xl font-bold">{display}</p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <button onClick={applyPercent} className={btnClass} style={{ background: "#14B8A61A", color: "#0A5C54" }}>%</button>
          <button onClick={clearAll} className={btnClass} style={{ background: "#DC26261A", color: "#DC2626" }}>C</button>
          <button onClick={backspace} className={btnClass} style={{ background: "#14B8A61A", color: "#0A5C54" }}>
            <Delete size={18} />
          </button>
          <button onClick={() => applyOp("÷")} className={btnClass} style={{ background: "#14B8A61A", color: "#0A5C54" }}>÷</button>

          {["7", "8", "9"].map((n) => (
            <button key={n} onClick={() => inputDigit(n)} className={btnClass} style={{ background: "#F4FAF8", color: "#0A5C54" }}>{n}</button>
          ))}
          <button onClick={() => applyOp("×")} className={btnClass} style={{ background: "#14B8A61A", color: "#0A5C54" }}>×</button>

          {["4", "5", "6"].map((n) => (
            <button key={n} onClick={() => inputDigit(n)} className={btnClass} style={{ background: "#F4FAF8", color: "#0A5C54" }}>{n}</button>
          ))}
          <button onClick={() => applyOp("-")} className={btnClass} style={{ background: "#14B8A61A", color: "#0A5C54" }}>−</button>

          {["1", "2", "3"].map((n) => (
            <button key={n} onClick={() => inputDigit(n)} className={btnClass} style={{ background: "#F4FAF8", color: "#0A5C54" }}>{n}</button>
          ))}
          <button onClick={() => applyOp("+")} className={btnClass} style={{ background: "#14B8A61A", color: "#0A5C54" }}>+</button>

          <button onClick={() => inputDigit("0")} className={btnClass + " col-span-2"} style={{ background: "#F4FAF8", color: "#0A5C54" }}>0</button>
          <button onClick={inputDot} className={btnClass} style={{ background: "#F4FAF8", color: "#0A5C54" }}>.</button>
          <button
            onClick={equals}
            className={btnClass}
            style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)", color: "white" }}
          >
            =
          </button>
        </div>

        <button
          onClick={handleUse}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm"
          style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
        >
          Use this value
        </button>
      </div>
    </div>
  );
}
