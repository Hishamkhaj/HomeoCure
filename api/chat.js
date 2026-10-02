export default async function handler(req, res) {
  // यह सिर्फ POST रिक्वेस्ट को एक्सेप्ट करेगा
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Vercel से तुम्हारी चाबी उठाएगा

  if (!apiKey) {
    return res.status(500).json({ error: "API Key नहीं मिली" });
  }

  try {
    // Gemini AI को मैसेज भेजना
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();
    const reply = data.candidates[0].content.parts[0].text;
    
    // AI का जवाब ऐप को वापस भेजना
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ error: "AI से कनेक्ट नहीं हो पाया" });
  }
}
