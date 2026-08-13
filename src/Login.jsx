import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { Lock, Mail, Leaf } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(180deg, #F4FAF8 0%, #E3F3EF 50%, #F4FAF8 100%)" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
          >
            <Leaf size={40} color="white" />
          </div>
          <h1 className="text-3xl font-serif font-bold" style={{ color: "#0A5C54" }}>
            HomeoCure
          </h1>
          <p className="text-xs italic mt-1" style={{ color: "#148A7A" }}>
            We serve, He cures
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/80 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>
              Email
            </label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5" style={{ borderColor: "#14B8A655" }}>
              <Mail size={16} color="#148A7A" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 outline-none text-sm bg-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#0A5C54" }}>
              Password
            </label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2.5" style={{ borderColor: "#14B8A655" }}>
              <Lock size={16} color="#148A7A" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 outline-none text-sm bg-transparent"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-[11px] mt-6 px-4" style={{ color: "#0A5C5499" }}>
          Founded by Dr. Mohammad Nasrullah Khan — a family-led legacy of
          personalized homoeopathic care.
        </p>
      </div>
    </div>
  );
      }
