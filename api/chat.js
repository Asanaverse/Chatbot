// == Dies ist die finale, korrekte Version ==

// Die permanenten, öffentlichen URLs zu deinen Dateien auf GitHub
const ASANAS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/data/asanas.json';
const PROMPTS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/prompts.json';
// =============================================


// Eine Hilfsfunktion, um die Daten aus dem Internet zu laden und zu speichern, damit es schnell bleibt.
const asanasCache = {};
const promptsCache = {};

async function fetchData(url, cache) {
    // Wenn Daten schon im Cache sind, direkt zurückgeben
    if (cache.data) {
        return cache.data;
    }
    // Sonst, lade die Daten aus dem Netz
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Netzwerk-Antwort war nicht ok: ${response.statusText}`);
        }
        cache.data = await response.json();
        return cache.data;
    } catch (error) {
        console.error(`Fehler beim Laden von ${url}:`, error);
        return null;
    }
}


export default async function handler(req, res) {
    // Prüfen, ob es eine POST-Anfrage ist
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Nur POST erlaubt' });
    }

    // Lade beide JSON-Dateien parallel, um Zeit zu sparen
    const [asanas, prompts] = await Promise.all([
        fetchData(ASANAS_URL, asanasCache),
        fetchData(PROMPTS_URL, promptsCache)
    ]);

    // Wenn eine der Dateien nicht geladen werden konnte, sende eine Fehlermeldung
    if (!asanas || !prompts) {
        return res.status(500).json({ message: 'Serverfehler: Konnte die Wissensdatenbank oder Prompts nicht laden.' });
    }

    const { query } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // Baue den finalen System-Prompt für die KI zusammen
    const systemPrompt = `${prompts.system_prompt}\n\nHier ist deine Wissensdatenbank:\n${JSON.stringify(asanas)}`;

    try {
        // Sende die Anfrage an die DeepSeek API
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Unbekannter Fehler von der DeepSeek API');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        // Sende die Antwort der KI zurück an das Chat-Fenster
        res.status(200).json({ reply: reply });

    } catch (error) {
        console.error('API Fehler:', error);
        res.status(500).json({ message: `Fehler bei der Kommunikation mit der KI.` });
    }
}
