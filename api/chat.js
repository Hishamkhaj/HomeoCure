export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ reply: "Error: सिर्फ POST रिक्वेस्ट सपोर्टेड है।" });

  const { message } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ reply: "Error: Vercel में API Key सेट नहीं है।" });
  }

  try {
    // 2026 का इकलौता चालू मॉडल: gemini-2.5-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message || "Hi" }] }]
      })
    });

    const data = await response.json();
    
    // अगर Google की तरफ से कोई एरर आता है
    if (data.error) {
       return res.status(200).json({ reply: "API Error: " + data.error.message });
    }

    // जवाब को सुरक्षित तरीके से पढ़ना
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (reply) {
      res.status(200).json({ reply });
    } else {
      res.status(200).json({ reply: "Error: AI ने कोई जवाब नहीं दिया।" });
    }
    
  } catch (error) {
    res.status(200).json({ reply: "Error: नेटवर्क में दिक्कत - " + error.message });
  }
}
