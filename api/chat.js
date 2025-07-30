// Dateipfad: /api/chat.js (FINALE, SCHNELLE & KORREKTE VERSION)

const ASANAS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/data/asanas.json'; 
const PROMPTS_URL = 'https://raw.githubusercontent.com/Asanaverse/Chatbot/main/prompts.json';

const asanasCache = {};
const promptsCache = {};

async function fetchData(url, cache) {
    if (cache.data) return cache.data;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Netzwerk-Antwort war nicht ok: ${response.statusText}`);
        cache.data = await response.json();
        return cache.data;
    } catch (error) {
        console.error(`Fehler beim Laden von ${url}:`, error);
        return null;
    }
}

// Suchfunktion, die die relevantesten Asanas findet
function searchAsanas(asanas, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredAsanas = asanas.map(asana => {
        let score = 0;
        const searchableText = [
            asana.Name || '',
            asana.Asana_Name_Deutsch || '',
            asana.Asana_Headertext || '',
            asana["1_Körper_Head"] || '',
            asana["1_Körper_Body"] || '',
            asana["2_Körper_Head"] || '',
            asana["2_Körper_Body"] || '',
            asana["1_Psyce_Head"] || '',
            asana["1_Psyce_Body"] || '',
            asana["2_Psyce_Head"] || '',
            asana["2_Psyce_Body"] || ''
        ].join(' ').toLowerCase();

        queryWords.forEach(word => {
            if (searchableText.includes(word)) {
                score++;
            }
        });
        return { ...asana, score };
    });

    return scoredAsanas.filter(a => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 7);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Nur POST erlaubt' });
    }

    const [allAsanas, prompts] = await Promise.all([
        fetchData(ASANAS_URL, asanasCache),
        fetchData(PROMPTS_URL, promptsCache)
    ]);

    if (!allAsanas || !prompts) {
        return res.status(500).json({ message: 'Serverfehler: Konnte die Wissensdatenbank oder Prompts nicht laden.' });
    }

    const { query } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // 1. ZUERST SUCHEN: Finde die relevantesten Asanas
    const relevantAsanas = searchAsanas(allAsanas, query);

    // 2. DANN FRAGEN: Baue einen kleinen, gezielten Prompt
    const systemPrompt = `${prompts.system_prompt}\n\nStelle deine Antwort ausschließlich aus den folgenden, relevanten Asanas zusammen:\n${JSON.stringify(relevantAsanas)}`;

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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
            throw new Error(errorData.error.message || 'DeepSeek API Fehler');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        res.status(200).json({ reply });
    } catch (error) {
        console.error('API Fehler:', error);
        res.status(500).json({ message: `Fehler bei der Kommunikation mit der KI.` });
    }
}
