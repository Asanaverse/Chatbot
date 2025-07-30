import OpenAI from 'openai';

const ASANAS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/data/asanas_full_cleaned.json';
const asanasCache = {};

// Funktion, um unsere eigene Asana-Datenbank zu laden
async function getAsanaDatabase() {
    if (asanasCache.data) return asanasCache.data;
    try {
        const response = await fetch(ASANAS_URL);
        asanasCache.data = await response.json();
        // Erstelle eine schnelle Suchkarte (Map) für den sofortigen Zugriff
        asanasCache.map = new Map(asanasCache.data.map(item => [item.Name, item]));
        return asanasCache.data;
    } catch (error) {
        console.error("Fehler beim Laden der Asana-Datenbank:", error);
        return null;
    }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const assistantId = process.env.OPENAI_ASSISTANT_ID;

const waitForRunCompletion = async (threadId, runId) => {
    while (true) {
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);
        if (run.status === 'completed') return run;
        if (['failed', 'cancelled', 'expired'].includes(run.status)) {
            throw new Error(`Run failed: ${run.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Nur POST erlaubt' });
    }

    try {
        // Stelle sicher, dass unsere eigene Datenbank geladen ist
        await getAsanaDatabase();
        if (!asanasCache.map) {
            throw new Error("Asana-Wissensdatenbank konnte nicht geladen werden.");
        }

        const { query } = req.body;
        const thread = await openai.beta.threads.create();
        
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: query,
        });
        
        const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });
        await waitForRunCompletion(thread.id, run.id);

        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find(m => m.role === 'assistant');

        if (assistantResponse && assistantResponse.content[0].type === 'text') {
            const rawJsonString = assistantResponse.content[0].text.value;
            const aiSuggestions = JSON.parse(rawJsonString);
            
            let htmlReply = '<p>Hier ist eine Auswahl an Asanas, die dir Orientierung geben können:</p><ul>';
            
            // Gehe durch die Vorschläge der KI
            aiSuggestions.forEach(suggestion => {
                // FINDE DIE KORREKTEN DATEN IN UNSERER DATENBANK
                const correctAsana = asanasCache.map.get(suggestion.name);
                
                if (correctAsana) {
                    // Baue das HTML mit der 100% KORREKTEN URL
                    htmlReply += `<li><strong>${correctAsana.Name}:</strong> ${suggestion.begruendung} <a href="https://
${correctAsana.URL}" target="_blank">Zum Asana</a></li>`;
                }
            });
            
            htmlReply += '</ul>';

            return res.status(200).json({ reply: htmlReply });

        } else {
            throw new Error('Keine gültige Antwort vom Assistenten erhalten.');
        }

    } catch (error) {
        console.error('API Fehler:', error);
        return res.status(500).json({ message: error.message });
    }
}
