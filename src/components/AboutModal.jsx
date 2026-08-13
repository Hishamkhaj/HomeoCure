import React from "react";
import { X } from "lucide-react";

export default function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src="/founder.jpg"
            alt="Dr. Mohammad Nasrullah Khan"
            className="w-full h-64 object-cover object-top"
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 40%, #0A5C54DD 100%)" }}
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
            style={{ color: "#0A5C54" }}
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <p className="text-white text-lg font-serif font-bold leading-tight">
              Dr. Mohammad Nasrullah Khan
            </p>
            <p className="text-white/80 text-xs italic mt-0.5">Founder, HomeoCure</p>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-serif font-bold mb-2" style={{ color: "#0A5C54" }}>
            Our Legacy
          </h3>
          <p className="text-xs leading-relaxed mb-3" style={{ color: "#0A5C5499" }}>
            HomeoCure carries forward a legacy of dedicated homoeopathic care built on
            experience, compassion, and trust. Founded by Dr. Mohammad Nasrullah Khan, the
            clinic has grown with a vision of making thoughtful and personalized homoeopathic
            care accessible to every patient.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "#0A5C5499" }}>
            Over the years, the practice has evolved into a family-led healthcare institution,
            where knowledge, clinical experience, and values are passed from one generation to
            the next — continuing this legacy today with the same commitment to patient care.
          </p>
          <div className="flex items-center gap-2 mt-5 pt-4 border-t" style={{ borderColor: "#14B8A633" }}>
            <div className="h-px flex-1" style={{ background: "#14B8A655" }} />
            <p className="text-xs italic px-2" style={{ color: "#148A7A" }}>
              We serve, He cures
            </p>
            <div className="h-px flex-1" style={{ background: "#14B8A655" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
