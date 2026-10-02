export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ reply: "सिर्फ POST रिक्वेस्ट सपोर्टेड है।" });

  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ reply: "Vercel में API Key सेट नहीं है। कृपया चेक करें।" });
  }

  try {
    // सबसे भरोसेमंद और स्टेबल मॉडल (gemini-pro) का इस्तेमाल
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
       return res.status(200).json({ reply: "API Error: " + data.error.message });
    }

    const reply = data.candidates[0].content.parts[0].text;
    res.status(200).json({ reply });
    
  } catch (error) {
    res.status(200).json({ reply: "AI से कनेक्ट नहीं हो पाया। कोड में कोई दिक्कत है।" });
  }
}
