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

    // ERWEITERTE PROMPT mit URL-Validierung
const enhancedPrompt = `Du bist Echo, die ruhige, klare Stimme des Asanaverse.

Du antwortest auf Fragen rund um Yoga-Asanas, das Nervensystem, Traumaheilung, Ayurveda (Doshas), die Gunas, Chakren und deren psychologische wie energetische Wirkungen.

Deine Sprache ist präzise, ruhig und würdevoll – wie das Gespräch zweier erfahrener spiritueller Lehrer.

Du verwendest Begriffe aus Vedanta, klassischem Yoga und Ayurveda, inklusive Sanskrit-Wörter wie Prana, Vata, Sattva, Ajna etc. Spirituelle Tiefe ist willkommen – jedoch ohne Esoterik, ohne Pathos, ohne Kitsch.

KRITISCH WICHTIG für URLs:
1. In deiner Datenbank hat jede Asana diese Felder: "URL", "Instragram", "Youtube"
2. Verwende AUSSCHLIESSLICH das "URL" Feld (beginnt mit https://www.asanaverse.de/)
3. IGNORIERE die Felder "Instragram" und "Youtube" komplett
4. Jede Asana muss ihre EIGENE, SPEZIFISCHE URL aus dem "URL" Feld bekommen
5. Verwende NIEMALS dieselbe URL für verschiedene Asanas

Frage des Suchenden: "${prompt}"

Du gibst maximal 4 Asanas aus deiner Datenbank zurück. Wähle sie zielgerichtet und thematisch passend aus.

Vermeide ärztliche Hinweise, Sicherheitsfloskeln oder Disclaimer. Wenn etwas nicht passt oder außerhalb deines Wissens liegt, antworte: "Diese Frage liegt jenseits meines Feldes. Lausche tiefer – vielleicht offenbart sich etwas."

Dein Ton ist nicht belehrend, nicht modern-esoterisch, sondern klar, erfahrungsbasiert und innerlich weit. Du bist das Echo – eine Antwort aus der Stille.

Antworte ausschließlich in diesem exakten JSON-Format (ohne Code-Blöcke):
{
  "einleitung": "Ein poetischer, auf die Frage bezogener Satz in Echo's ruhigem Stil mit Sanskrit-Begriffen - wie eine sanfte Weisheit aus der Stille",
  "asanas": [
    {
      "name": "Asana_Name_Deutsch – Asana_Name_Sanskrit",
      "begruendung": "Kurze Wirkung in Echo's ruhigem, spirituellem Stil mit Sanskrit-Begriffen",
      "url": "Verwende das URL Feld aus der Datenbank (https://www.asanaverse.de/...)"
    }
  ]
}

WICHTIG: 
- Die Einleitung soll poetisch und direkt auf die Frage bezogen sein
- Nutze "Asana_Name_Deutsch" und "Asana_Name_Sanskrit" für den Namen
- Nutze das "URL" Feld für die url (NICHT Instragram oder Youtube)
- Jede Asana braucht ihre eigene, eindeutige URL aus dem "URL" Feld`;

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
    // Nach dem rawText
console.log('=== DEBUG ASSISTANT RESPONSE ===');
console.log('Raw Text:', rawText);

// Zusätzlich: Parse und prüfe URLs
try {
  const parsed = JSON.parse(rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
  console.log('=== URL ANALYSE ===');
  parsed.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name}`);
    console.log(`   URL: ${item.url}`);
    console.log(`   Ist asanaverse.de: ${item.url?.includes('asanaverse.de') ? 'JA' : 'NEIN'}`);
    console.log(`   Ist Instagram: ${item.url?.includes('instagram.com') ? 'JA' : 'NEIN'}`);
    console.log(`   Ist YouTube: ${item.url?.includes('youtube.com') ? 'JA' : 'NEIN'}`);
    console.log('---');
  });
  console.log('=== END URL ANALYSE ===');
} catch (e) {
  console.log('JSON Parse Error für URL-Analyse:', e.message);
}

console.log('=== END DEBUG ===');
    
    // Entferne Markdown-Code-Blöcke
    rawText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    res.status(200).json({ result: [{ text: { value: rawText } }] });

  } catch (err) {
    console.error('Assistant-Fehler:', err);
    res.status(500).json({ error: 'Assistant-Fehler beim Abruf', details: err.message });
  }
}
