import React, { useState } from "react";
import { Leaf, Delete } from "lucide-react";

// Change this to whatever 4-digit PIN you want
const APP_PIN = "1234";

export default function PinLock({ onUnlock }) {
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  const handlePress = (digit) => {
    setError(false);
    const next = entered + digit;
    if (next.length <= 4) setEntered(next);
    if (next.length === 4) {
      if (next === APP_PIN) {
        sessionStorage.setItem("homeocure-unlocked", "true");
        setTimeout(() => onUnlock(), 150);
      } else {
        setError(true);
        setTimeout(() => setEntered(""), 400);
      }
    }
  };

  const handleDelete = () => setEntered((e) => e.slice(0, -1));

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(180deg, #F4FAF8 0%, #E3F3EF 50%, #F4FAF8 100%)" }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg"
        style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
      >
        <Leaf size={34} color="white" />
      </div>
      <h1 className="text-2xl font-serif font-bold mb-1" style={{ color: "#0A5C54" }}>
        HomeoCure
      </h1>
      <p className="text-xs mb-8" style={{ color: "#0A5C5499" }}>
        Enter PIN to continue
      </p>

      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full transition"
            style={{
              background: i < entered.length ? (error ? "#DC2626" : "#148A7A") : "#14B8A633",
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => handlePress(String(n))}
            className="aspect-square rounded-full text-xl font-semibold bg-white shadow-sm active:scale-95 transition"
            style={{ color: "#0A5C54" }}
          >
            {n}
          </button>
        ))}
        <div />
        <button
          onClick={() => handlePress("0")}
          className="aspect-square rounded-full text-xl font-semibold bg-white shadow-sm active:scale-95 transition"
          style={{ color: "#0A5C54" }}
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="aspect-square rounded-full flex items-center justify-center bg-white shadow-sm active:scale-95 transition"
          style={{ color: "#0A5C54" }}
        >
          <Delete size={18} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-6">Wrong PIN, try again</p>
      )}
    </div>
  );
            }
