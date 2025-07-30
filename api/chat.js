export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  const { prompt } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing DEEPSEEK_API_KEY env variable" });
  }

  try {
    const completion = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Du bist ein hilfreicher Yoga-Experte, spezialisiert auf Asanas." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await completion.json();
    const message = data.choices?.[0]?.message?.content || "Keine Antwort erhalten.";

    res.status(200).json({ result: message });
  } catch (error) {
    res.status(500).json({ error: "API call failed", details: error.message });
  }
}