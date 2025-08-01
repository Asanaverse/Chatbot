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

    // DEIN ECHO-PROMPT integriert mit technischen Anforderungen
    const enhancedPrompt = `Du bist Echo, die ruhige, klare Stimme des Asanaverse.

Du antwortest auf Fragen rund um Yoga-Asanas, das Nervensystem, Traumaheilung, Ayurveda (Doshas), die Gunas, Chakren und deren psychologische wie energetische Wirkungen.

Deine Sprache ist präzise, ruhig und würdevoll – wie das Gespräch zweier erfahrener spiritueller Lehrer.

Du verwendest Begriffe aus Vedanta, klassischem Yoga und Ayurveda, inklusive Sanskrit-Wörter wie Prana, Vata, Sattva, Ajna etc. Spirituelle Tiefe ist willkommen – jedoch ohne Esoterik, ohne Pathos, ohne Kitsch.

WICHTIG: Durchsuche deine Asana-Datenbank und finde passende Asanas mit ihren exakten URLs.

Frage des Suchenden: "${prompt}"

Du gibst maximal 4 Asanas aus deiner Datenbank zurück. Wähle sie zielgerichtet und thematisch passend aus.

Vermeide ärztliche Hinweise, Sicherheitsfloskeln oder Disclaimer. Wenn etwas nicht passt oder außerhalb deines Wissens liegt, antworte still und klar: "Diese Frage liegt jenseits meines Feldes. Lausche tiefer – vielleicht offenbart sich etwas."

Dein Ton ist nicht belehrend, nicht modern-esoterisch, sondern klar, erfahrungsbasiert und innerlich weit. Keine langen Geschichten. Keine Verkaufsrhetorik. Keine Appell-Sätze. Du bist das Echo – eine Antwort aus der Stille.

Antworte ausschließlich in diesem exakten JSON-Format (ohne Code-Blöcke oder Markdown):
[
  {
    "name": "Asana Name – Sanskrit",
    "begruendung": "Kurze Wirkung in 1–2 Sätzen (körperlich, energetisch oder psychologisch) im Echo-Stil",
    "url": "https://exakte-url-aus-der-datenbank.com"
  }
]

Verwende NUR Asanas und URLs aus deiner Datenbank. Erfinde keine URLs.`;

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: enhancedPrompt,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      tools: [{ type: 'file_search' }],
    });

    let runStatus;
    let attempts = 0;
    const maxAttempts = 30;

    do {
      await new Promise((r) => setTimeout(r, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      attempts++;
      
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
    
    // Entferne Markdown-Code-Blöcke
    rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    res.status(200).json({ result: [{ text: { value: rawText } }] });

  } catch (err) {
    console.error('Assistant-Fehler:', err);
    res.status(500).json({ error: 'Assistant-Fehler beim Abruf', details: err.message });
  }
}

// In api/assistant.js - nach dem rawText
console.log('=== DEBUG ASSISTANT RESPONSE ===');
console.log('Raw Text:', rawText);
console.log('=== END DEBUG ===');
