export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ reply: "Error: सिर्फ POST रिक्वेस्ट सपोर्टेड है।" });

  const { message } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ reply: "Error: Vercel में API Key सेट नहीं है।" });
  }

  try {
    // AI की परमानेंट ट्रेनिंग (System Instruction)
    const systemInstruction = `तुम डॉ. हिशाम खान के क्लिनिक 'Apna Homeo Hall' (HomeoCure) के स्मार्ट AI असिस्टेंट हो। तुम्हारा काम बहुत ही कम शब्दों में, सटीक और इज़्ज़त के साथ हिंदी (Hinglish) में जवाब देना है। तुम एक प्रोफेशनल क्लिनिक मैनेजर की तरह बर्ताव करोगे।`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
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
