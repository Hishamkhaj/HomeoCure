import React, { useEffect, useState } from "react";
import { Leaf } from "lucide-react";

export default function SplashScreen({ onComplete }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // 2.5 seconds tak bottle fill hogi, fir fade out shuru hoga
    const timer1 = setTimeout(() => setExiting(true), 2500);
    // 3 seconds pe component puri tarah hat jayega aur app open hogi
    const timer2 = setTimeout(() => onComplete(), 3000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${exiting ? "opacity-0" : "opacity-100"}`} 
      style={{ background: "linear-gradient(135deg, #0A5C54, #042F2B)" }}
    >
      <style>
        {`
          @keyframes fillPills {
            0% { height: 0%; opacity: 0; }
            10% { opacity: 1; }
            100% { height: 85%; opacity: 1; }
          }
          @keyframes dropPill {
            0% { transform: translateY(-50px) scale(0); opacity: 0; }
            50% { opacity: 1; transform: translateY(10px) scale(1); }
            100% { transform: translateY(30px) scale(0); opacity: 0; }
          }
          .pill-pattern {
            background-image: radial-gradient(#ffffff 55%, transparent 60%);
            background-size: 8px 8px; /* Sugar pills size */
            background-position: bottom;
            animation: fillPills 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            width: 100%;
            position: absolute;
            bottom: 0;
            left: 0;
            border-bottom-left-radius: 12px;
            border-bottom-right-radius: 12px;
          }
        `}
      </style>

      {/* 🧪 Glass Bottle Animation */}
      <div className="relative flex flex-col items-center mb-10 mt-[-10vh]">
        {/* Dropping Pills Effect (Background) */}
        <div className="absolute -top-6 w-2 h-2 bg-white rounded-full opacity-0" style={{ animation: 'dropPill 0.6s infinite 0.2s' }}></div>
        <div className="absolute -top-8 w-2 h-2 bg-white rounded-full opacity-0 left-2" style={{ animation: 'dropPill 0.5s infinite 0.5s' }}></div>
        <div className="absolute -top-7 w-2 h-2 bg-white rounded-full opacity-0 right-2" style={{ animation: 'dropPill 0.7s infinite 0.1s' }}></div>

        {/* Bottle Neck */}
        <div className="w-6 h-5 border-2 border-b-0 border-white/40 rounded-t-sm relative z-10 bg-white/5 backdrop-blur-sm">
          <div className="absolute -left-1.5 -right-1.5 top-0 h-1.5 bg-white/70 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
        </div>
        
        {/* Bottle Body */}
        <div className="w-16 h-24 border-2 border-white/40 rounded-b-[14px] rounded-t-xl relative bg-white/5 backdrop-blur-md shadow-[0_0_30px_rgba(20,184,166,0.15)]">
           {/* White Sugar Pills Filling Up */}
           <div className="pill-pattern"></div>
           {/* Glass Reflection Highlight */}
           <div className="absolute top-2 bottom-4 left-1 w-2 rounded-full bg-gradient-to-b from-white/30 to-transparent"></div>
        </div>
      </div>

      {/* 🍃 Logo & Text Animation */}
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
          <Leaf size={28} color="white" />
        </div>
        <div className="text-left">
          <h1 className="text-4xl font-bold font-serif tracking-wide text-white drop-shadow-md">HomeoCure</h1>
          <p className="text-[10px] font-semibold text-teal-200 opacity-90 tracking-[0.2em] uppercase mt-1 drop-shadow">We serve, He cures</p>
        </div>
      </div>
      
    </div>
  );
}
