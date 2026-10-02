export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ reply: "Error: सिर्फ POST रिक्वेस्ट सपोर्टेड है।" });

  const { message } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ reply: "Error: Vercel में API Key सेट नहीं है।" });
  }

  try {
    const systemInstruction = `तुम डॉ. हिशाम खान के क्लिनिक 'Apna Homeo Hall' के स्मार्ट AI असिस्टेंट हो। बहुत ही कम शब्दों में, सटीक और इज़्ज़त के साथ Hinglish में जवाब देना।`;

    // Google के बताए गए ऑफिशियल 3.8-flash मॉडल का इस्तेमाल
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: message || "Hi" }] }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
       return res.status(200).json({ reply: "API Error: " + data.error.message });
    }

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
