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
        
        const thread = await openai.beta.threads.create();
        
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: query,
        });
        
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistantId,
        });
        
        await waitForRunCompletion(thread.id, run.id);
        
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find(m => m.role === 'assistant');

        if (assistantResponse && assistantResponse.content[0].type === 'text') {
            let rawJsonString = assistantResponse.content[0].text.value;
            
            // NEUER TEIL: Wir "packen" die Antwort aus dem Markdown-Block aus.
            if (rawJsonString.startsWith('```json')) {
                rawJsonString = rawJsonString.substring(7, rawJsonString.length - 3).trim();
            } else if (rawJsonString.startsWith('```')) {
                rawJsonString = rawJsonString.substring(3, rawJsonString.length - 3).trim();
            }
            
            try {
                const asanaData = JSON.parse(rawJsonString);
                
                let htmlReply = '<p>Hier ist eine Auswahl an Asanas, die dir Orientierung geben können:</p><ul>';
                
                asanaData.forEach(asana => {
                    htmlReply += `<li><strong>${asana.name}:</strong> ${asana.begruendung} <a href="https://
${asana.url}" target="_blank">Zum Asana</a></li>`;
                });
                
                htmlReply += '</ul>';

                return res.status(200).json({ reply: htmlReply });

            } catch (jsonError) {
                console.error("Fehler beim Parsen der JSON-Antwort von der KI:", jsonError);
                return res.status(200).json({ reply: `<p>Die KI hat in einem unerwarteten Format geantwortet. Versuche es bitte erneut.</p><p>Debug-Info: ${rawJsonString}</p>` });
            }

        } else {
            throw new Error('Keine gültige Antwort vom Assistenten erhalten.');
        }
    } catch (error) {
        console.error('API Fehler:', error);
        return res.status(500).json({ message: error.message });
    }
}
