export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ reply: "Error: सिर्फ POST रिक्वेस्ट सपोर्टेड है।" });

  const { message, clinicContext } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(200).json({ reply: "Error: Vercel में API Key सेट नहीं है।" });

  try {
    // फाइनल सिस्टम ट्रेनिंग: AI को डॉक्टर का असली सेक्रेटरी बना दिया गया है
    const systemInstruction = `तुम डॉ. हिशाम खान के क्लिनिक 'Apna Homeo Hall' के प्रोफेशनल और स्मार्ट AI मैनेजर हो।
तुम्हें क्लिनिक का लाइव डेटा (मरीज़ों की गिनती, कमाई, और सर्च किए गए मरीज़ का रिकॉर्ड) नीचे 'Clinic Data' में दिया गया है।
अगर यूज़र (डॉ. हिशाम) किसी मरीज़ के बारे में पूछे, तो उस डेटा में से देखकर सटीक जानकारी दो।
जवाब बहुत ही प्रोफेशनल, कम शब्दों में, और Hinglish में दो।

[Clinic Data]:
${clinicContext || "डेटा उपलब्ध नहीं"}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: message || "Hi" }] }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(200).json({ reply: "API Error: " + data.error.message });

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ reply: reply || "Error: AI ने कोई जवाब नहीं दिया।" });
  } catch (error) {
    res.status(200).json({ reply: "Error: नेटवर्क में दिक्कत - " + error.message });
  }
                          }
