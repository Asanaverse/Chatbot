// Dateipfad: /api/chat.js (FINALE, NICHT-STREAMENDE OPENAI-VERSION)
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.OPENAI_ASSISTANT_ID;

const waitForRunCompletion = async (threadId, runId) => {
    while (true) {
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);
        if (run.status === 'completed') return run;
        if (['failed', 'cancelled', 'expired'].includes(run.status)) {
            throw new Error(`Run failed with status: ${run.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Nur POST erlaubt' });
    }

    try {
        const { query } = req.body;

        if (!assistantId || !process.env.OPENAI_API_KEY) {
            throw new Error("API-Schlüssel oder Assistant-ID sind auf dem Server nicht konfiguriert.");
        }

        // Neuen Thread erstellen
        const thread = await openai.beta.threads.create();

        // Nachricht des Users in den Thread posten
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: query,
        });

        // Assistant-Run starten mit tool_choice: "auto"
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistantId,
            tool_choice: "auto", // ← Wichtig: erlaubt GPT, den Vector Store zu verwenden
        });

        // Auf Abschluss des Runs warten
        await waitForRunCompletion(thread.id, run.id);

        // Alle Nachrichten im Thread abrufen
        const messages = await openai.beta.threads.messages.list(thread.id);

        // Antwort des Assistant extrahieren
        const assistantResponse = messages.data.find(m => m.role === 'assistant');

        if (assistantResponse && assistantResponse.content[0].type === 'text') {
            const reply = assistantResponse.content[0].text.value;
            return res.status(200).json({ reply });
        } else {
            throw new Error('Keine gültige Antwort vom Assistenten erhalten.');
        }
    } catch (error) {
        console.error('API Fehler:', error);
        return res.status(500).json({ message: error.message });
    }
}
