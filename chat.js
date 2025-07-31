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
        
        const thread = await openai.beta.threads.create();
        
        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: `${query}

Bitte antworte im folgenden JSON-Format und nutze die Daten aus dem Vector Store:
[
  {
    "name": "Asana Name",
    "begruendung": "Warum dieses Asana hilfreich ist",
    "url": "Die vollständige URL zum Asana"
  }
]`
        });
        
        const run = await openai.beta.threads.runs.create(thread.id, { 
            assistant_id: assistantId 
        });
        
        await waitForRunCompletion(thread.id, run.id);

        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantResponse = messages.data.find(m => m.role === 'assistant');

        if (!assistantResponse || !assistantResponse.content[0]) {
            return res.status(200).json({ 
                reply: 'Entschuldigung, ich konnte keine passenden Asanas finden. Bitte formuliere deine Frage anders oder versuche es erneut.' 
            });
        }

        if (assistantResponse.content[0].type === 'text') {
            const responseText = assistantResponse.content[0].text.value;
            
            console.log('=== DEBUG: Assistant Response ===');
            console.log(responseText);
            console.log('=== END DEBUG ===');
            
            try {
                const aiSuggestions = JSON.parse(responseText);
                
                if (!Array.isArray(aiSuggestions) || aiSuggestions.length === 0) {
                    return res.status(200).json({ 
                        reply: 'Ich konnte keine passenden Asanas für deine Anfrage finden. Versuche es mit anderen Begriffen.' 
                    });
                }
                
                let htmlReply = '<p>Hier ist eine Auswahl an Asanas, die dir Orientierung geben können:</p><ul>';
                
                aiSuggestions.forEach(suggestion => {
                    const name = suggestion.name || 'Unbekanntes Asana';
                    const begruendung = suggestion.begruendung || 'Hilfreich für deine Praxis';
                    const url = suggestion.url || '#';
                    
                    htmlReply += `<li><strong>${name}:</strong> ${begruendung} <a href="${url}" target="_blank">Zum Asana</a></li>`;
                });
                
                htmlReply += '</ul>';
                
                return res.status(200).json({ reply: htmlReply });
                
            } catch (parseError) {
                console.log('JSON Parse Error:', parseError);
                return res.status(200).json({ 
                    reply: `<p>${responseText}</p><p><em>Hinweis: Die Antwort konnte nicht optimal formatiert werden.</em></p>` 
                });
            }

        } else {
            return res.status(200).json({ 
                reply: 'Entschuldigung, ich habe eine unerwartete Antwort erhalten. Bitte versuche es erneut.' 
            });
        }

    } catch (error) {
        console.error('API Fehler:', error);
        return res.status(500).json({ 
            message: `Fehler: ${error.message}`,
            reply: 'Entschuldigung, es gab einen technischen Fehler. Bitte versuche es in einem Moment erneut.' 
        });
    }
}
