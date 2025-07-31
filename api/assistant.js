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

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: prompt,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      tool_choice: { type: 'file_search' }, // ← ERZWINGT Nutzung deiner Daten
    });

    let runStatus;
    do {
      await new Promise((r) => setTimeout(r, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    } while (runStatus.status !== 'completed');

    const messages = await openai.beta.threads.messages.list(thread.id);
    const answer = messages.data.find((m) => m.role === 'assistant');

    const rawText = answer?.content?.[0]?.text?.value || '';
    res.status(200).json({ result: [{ text: { value: rawText } }] });

  } catch (err) {
    console.error('Assistant-Fehler:', err);
    res.status(500).json({ error: 'Assistant-Fehler beim Abruf' });
  }
}
