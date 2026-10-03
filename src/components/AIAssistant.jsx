import React, { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Bot } from "lucide-react";
import { supabase } from "../supabaseClient"; 

const TEAL = "#0A5C54";

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello Dr. Hisham! ✨ Apna Homeo Hall का एडवांस्ड AI मैनेजर तैयार है। आज कुल मरीज़ देखने हैं या किसी खास मरीज़ की फाइल निकालनी है?",
    },
  ]);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setIsTyping(true);

    try {
      let clinicContext = "Apna Homeo Hall Clinic Live Data:\n";
      
      try {
        // 1. कुल मरीज़ और कमाई का डेटा
        const { count: patientCount } = await supabase.from('patients').select('*', { count: 'exact', head: true });
        const { data: payments } = await supabase.from('payments').select('amount');
        let totalCollection = payments ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : 0;

        clinicContext += `- Total Patients Registered: ${patientCount || 0}\n`;
        clinicContext += `- Total Revenue: ₹${totalCollection}\n\n`;

        // 2. हाल ही में आए 5 मरीज़ों का डेटा (ताकि AI को ताज़ा जानकारी रहे)
        const { data: recentPatients } = await supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(5);
        if (recentPatients && recentPatients.length > 0) {
          clinicContext += `Recent 5 Patients:\n`;
          recentPatients.forEach(p => {
            const details = Object.entries(p).filter(([k]) => !k.includes('at')).map(([k, v]) => `${k}: ${v}`).join(', ');
            clinicContext += `{ ${details} }\n`;
          });
        }

        // 3. स्मार्ट सर्च (अगर यूज़र ने किसी का नाम या नंबर टाइप किया है)
        const words = userText.split(' ').filter(w => w.length > 2);
        if (words.length > 0) {
          let query = supabase.from('patients').select('*').limit(5);
          let orQuery = words.map(w => `name.ilike.%${w}%,phone.ilike.%${w}%`).join(',');
          const { data: searchResults } = await query.or(orQuery);

          if (searchResults && searchResults.length > 0) {
            clinicContext += `\nSearch Results for query:\n`;
            searchResults.forEach(p => {
              const details = Object.entries(p).filter(([k]) => !k.includes('at')).map(([k, v]) => `${k}: ${v}`).join(', ');
              clinicContext += `{ ${details} }\n`;
            });
          }
        }
      } catch (dbErr) {
        clinicContext += "Database tables sync pending.";
      }

      // डेटा AI को भेजना
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, clinicContext }),
      });
      
      const data = await res.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply || "माफ़ करना, कुछ गड़बड़ हो गई।" }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "कनेक्शन में दिक्कत आ रही है।" }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 hover:scale-105" style={{ background: "linear-gradient(135deg, #148A7A, #0A5C54)" }}>
          <Sparkles className="animate-pulse" size={24}/>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm h-[80vh] sm:h-[600px] bg-white rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between text-white shadow-md z-10" style={{ background: "linear-gradient(135deg, #0A5C54, #148A7A)" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30"><Sparkles size={16}/></div>
                <div>
                  <h3 className="text-sm font-bold font-serif leading-tight">HomeoCure AI</h3>
                  <p className="text-[10px] opacity-80">Connected to Supabase DB</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" style={{ backgroundImage: 'radial-gradient(#14B8A611 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                  {msg.role === "assistant" && <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1" style={{ background: "#14B8A61A", color: TEAL }}><Bot size={12}/></div>}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[80%] shadow-sm whitespace-pre-wrap ${msg.role === "user" ? "rounded-br-sm text-white" : "rounded-bl-sm bg-white border border-teal-100"}`} style={msg.role === "user" ? { background: "linear-gradient(135deg, #148A7A, #0A5C54)" } : { color: TEAL }}>{msg.text}</div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start items-end gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1" style={{ background: "#14B8A61A", color: TEAL }}><Bot size={12}/></div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white border border-teal-100 shadow-sm flex items-center gap-1.5 text-teal-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-teal-50">
              <form onSubmit={handleSend} className="flex items-center gap-2 bg-gray-50 border rounded-full px-2 py-1.5 transition-all" style={{ borderColor: "#14B8A644" }}>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="मरीज़ का नाम सर्च करें या सवाल पूछें..." className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" style={{ color: TEAL }}/>
                <button type="submit" disabled={!input.trim() || isTyping} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors" style={{ background: input.trim() ? TEAL : "#14B8A622", color: input.trim() ? "white" : TEAL }}>
                  <Send size={16} className={input.trim() ? "ml-0.5" : ""} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
                              }
