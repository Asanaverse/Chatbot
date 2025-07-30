// Dateipfad: /api/chat.js (FINALE VERSION)

// == DEINE ANPASSUNGEN HIER ==
// 1. Ersetze diese URL mit deiner "Raw"-URL zur asanas.json
const ASANAS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/data/asanas.json'; 

// 2. Ersetze diese URL mit deiner "Raw"-URL zur prompts.json (falls du sie nutzt)
const PROMPTS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/prompts.json';
// =============================


// Hilfsfunktion, um die Daten aus dem Internet zu laden und zu speichern, damit es schnell bleibt.
const asanasCache = {};
const promptsCache = {};

async function fetchData(url, cache) {
    if (cache.data) {
        return cache.data; // Wenn schon geladen, direkt zurückgeben
    }
    try {
        const response = await fetch(url);
        if (!response.ok) { // Prüft, ob der Link funktioniert
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
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Nur POST erlaubt' });
    }

    // Lade beide JSON-Dateien parallel (das ist schneller)
    const [asanas, prompts] = await Promise.all([
        fetchData(ASANAS_URL, asanasCache),
        fetchData(PROMPTS_URL, promptsCache)
    ]);

    // Wenn eine der Dateien nicht geladen werden konnte, sende eine Fehlermeldung
    if (!asanas || !prompts) {
        return res.status(500).json({ message: 'Serverfehler: Konnte die Wissensdatenbank oder Prompts nicht laden.' });
    }

    const { query } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY; // Holt den Schlüssel sicher von Vercel

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
        res.status(500).json({ message: 'Fehler bei der Kommunikation mit der KI.' });
    }
}
