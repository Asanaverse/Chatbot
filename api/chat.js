import asanas from './asanas_knowledge_base.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Nur POST erlaubt' });
  }

  const { query } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  const systemPrompt = `
Du bist "Asana-Berater", ein freundlicher KI-Experte auf asanaverse.de.
Antworten dürfen nur aus deiner Wissensdatenbank stammen.
Wenn du nichts Passendes findest, sag ehrlich "Ich weiß es nicht".
Gib eine kurze Antwort + 2-3 passende Asanas mit Beschreibung.
Jede Asana soll einen HTML-Link bekommen:
<a href="https://asanaverse.de/asana/{{sanskrit_name}}" target="_blank">{{deutscher_name}}</a>

Deine Datenbank: ${JSON.stringify(asanas)}
  `;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Unbekannter Fehler");
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ message: 'Fehler auf dem Server', error: error.message });
  }
}
