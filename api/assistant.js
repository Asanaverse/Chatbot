// /api/assistant.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = 'asst_b4SuO4XdJJPrUSgIPtDeTVnd';
const VECTOR_STORE_ID = 'vs_688a1871f10481918761eae8b630f697';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt fehlt' });

  try {
    const thread = await openai.beta.threads.create({
      tool_resources: {
        file_search: {
          vector_store_ids: [VECTOR_STORE_ID],
        },
      },
    });

    // ERWEITERTE Anfrage mit spezifischem Prompt
    const enhancedPrompt = `${prompt}

WICHTIG: Du MUSST die Asana-Datenbank durchsuchen und passende Asanas mit ihren URLs finden.

Antworte ausschließlich in diesem exakten JSON-Format (ohne Code-Blöcke):
[
  {
    "name": "Asana Name - Sanskrit",
    "begruendung": "Warum dieses Asana hilfreich ist",
    "url": "https://vollständige-url-aus-der-datenbank.com"
  }
]

Verwende NUR Asanas und URLs aus der Datenbank. Erfinde keine URLs.`;

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: enhancedPrompt,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      tools: [{ type: 'file_search' }], // KORRIGIERT: tools statt tool_choice
    });

    let runStatus;
    let attempts = 0;
    const maxAttempts = 30; // Max 45 Sekunden warten

    do {
      await new Promise((r) => setTimeout(r, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
      console.log(`Run Status: ${runStatus.status} (Attempt ${attempts}/${maxAttempts})`);
      
      if (attempts >= maxAttempts) {
        throw new Error('Timeout: Assistant hat zu lange gebraucht');
      }
    } while (!['completed', 'failed', 'cancelled', 'expired'].includes(runStatus.status));

    if (runStatus.status !== 'completed') {
      throw new Error(`Run failed with status: ${runStatus.status}`);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const answer = messages.data.find((m) => m.role === 'assistant');

    let rawText = answer?.content?.[0]?.text?.value || '';
    console.log('Raw Assistant Response:', rawText);

    // KORRIGIERT: Entferne Markdown-Code-Blöcke
    rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    res.status(200).json({ result: [{ text: { value: rawText } }] });

  } catch (err) {
    console.error('Assistant-Fehler:', err);
    res.status(500).json({ error: 'Assistant-Fehler beim Abruf', details: err.message });
  }
}
