import asanas from '../data/asanas.json';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Nur POST-Anfragen erlaubt.' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ message: 'Keine Anfrage übermittelt.' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  // Optional: Prompt aus Datei laden
  const promptPath = path.join(process.cwd(), 'prompts.json');
  const systemPrompt = fs.readFileSync(promptPath, 'utf8');

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nHier ist deine Wissensdatenbank:\n${JSON.stringify(asanas)}` },
          { role: 'user', content: query }
        ],
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("DeepSeek-Fehler:", errorData);
      throw new Error('Fehler bei der Anfrage an DeepSeek');
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Serverfehler:", error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
}