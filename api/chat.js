export default async function handler(req, res) {
  const { question } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  const asanaData = require("../../data/asanas.json");
  const context = JSON.stringify(asanaData);

  const prompt = `Hier ist Wissen über Yoga-Asanas:
${context}

Frage: ${question}
Antwort (auf Deutsch, sachlich und knapp):`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content || "Fehler beim Antworten.";

  res.status(200).json({ answer });
}