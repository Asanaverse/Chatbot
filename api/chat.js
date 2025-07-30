// Dateipfad: /api/chat.js (FINALE OPENAI ASSISTANT VERSION)

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const assistantId = process.env.OPENAI_ASSISTANT_ID;

// Hilfsfunktion, um auf den Abschluss des Assistentenlaufs zu warten
const waitForRunCompletion = async (threadId, runId) => {
    while (true) {
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);
        if (run.status === 'completed') {
            return run;
        }
        if (['failed', 'cancelled', 'expired'].includes(run.status)) {
            throw new Error(`Run failed with status: ${run.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 Sekunde warten
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Nur POST erlaubt' });
    }

    try {
        const { query } = req.body;

        // 1. Einen neuen "Gesprächs-Thread" erstellen
        const thread = await openai.beta.threads.create();

        // 2. Die Nachricht des Nutzers zum Thread hinzufügen
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: query,
        });

        // 3. Den Assistenten auf diesem Thread starten
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistantId,
        });

        // 4. Warten, bis der Assistent fertig ist
        await waitForRunCompletion(thread.id, run.id);

        // 5. Die Antworten des Assistenten abrufen
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find(m => m.role === 'assistant');

        // Sicherstellen, dass eine Antwort vorhanden ist und den Text-Inhalt extrahieren
        if (assistantResponse && assistantResponse.content[0].type === 'text') {
            const reply = assistantResponse.content[0].text.value;
            return res.status(200).json({ reply });
        } else {
            return res.status(500).json({ message: 'Keine gültige Antwort vom Assistenten erhalten.' });
        }

    } catch (error) {
        console.error('API Fehler:', error);
        return res.status(500).json({ message: 'Fehler bei der Kommunikation mit OpenAI.' });
    }
}
