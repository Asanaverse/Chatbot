import OpenAI from 'openai';

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
        const { query } = req.body;
        
        // Erstelle Thread
        const thread = await openai.beta.threads.create();
        
        // Sende Nachricht mit spezifischen Anweisungen
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: `${query}

Bitte antworte im folgenden JSON-Format:
[
  {
    "name": "Asana Name",
    "begruendung": "Warum dieses Asana hilfreich ist",
    "url": "Die vollständige URL zum Asana"
  }
]`
        });
        
        // Starte Run mit Assistant (der hat Zugriff auf Vector Store)
        const run = await openai.beta.threads.runs.create(thread.id, { 
            assistant_id: assistantId 
        });
        
        await waitForRunCompletion(thread.id, run.id);

        // Hole Antwort
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find(m => m.role === 'assistant');

        if (assistantResponse && assistantResponse.content[0].type === 'text') {
            const responseText = assistantResponse.content[0].text.value;
            
            try {
                // Versuche JSON zu parsen
                const aiSuggestions = JSON.parse(responseText);
                
                let htmlReply = '<p>Hier ist eine Auswahl an Asanas, die dir Orientierung geben können:</p><ul>';
                
                aiSuggestions.forEach(suggestion => {
                    htmlReply += `<li><strong>${suggestion.name}:</strong> ${suggestion.begruendung} <a href="${suggestion.url}" target="_blank">Zum Asana</a></li>`;
                });
                
                htmlReply += '</ul>';
                
                return res.status(200).json({ reply: htmlReply });
                
            } catch (parseError) {
                // Falls JSON-Parsing fehlschlägt, gib die rohe Antwort zurück
                return res.status(200).json({ reply: responseText });
            }

        } else {
            throw new Error('Keine gültige Antwort vom Assistenten erhalten.');
        }

    } catch (error) {
        console.error('API Fehler:', error);
        return res.status(500).json({ 
            message: `Fehler: ${error.message}`,
            reply: 'Entschuldigung, es gab einen technischen Fehler. Bitte versuche es erneut.'
        });
    }
}
