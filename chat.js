// /chat.js – Client-Skript für deine Webseite

async function sendPromptToAssistant(promptText) {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText }),
    });

    const data = await res.json();

    // Erwartet: JSON-String als Assistant-Antwort im Format: "[{ name, begruendung, url }, ...]"
    const rawText = data.result?.[0]?.text?.value;

    if (!rawText) {
      renderOutput('<p>Ich konnte leider keine passende Antwort erzeugen.</p>');
      return;
    }

    try {
      const aiSuggestions = JSON.parse(rawText);

      if (!Array.isArray(aiSuggestions) || aiSuggestions.length === 0) {
        renderOutput('<p>Keine passenden Asanas gefunden. Versuche es mit anderen Begriffen.</p>');
        return;
      }

      let htmlReply = '<p>Hier ist eine Auswahl an Asanas, die dir Orientierung geben können:</p><ul>';

      aiSuggestions.forEach(suggestion => {
        const name = suggestion.name || 'Unbekanntes Asana';
        const begruendung = suggestion.begruendung || 'Hilfreich für deine Praxis';
        const url = suggestion.url || '#';

        htmlReply += `<li><strong>${name}:</strong> ${begruendung} <a href="${url}" target="_blank">Zum Asana</a></li>`;
      });

      htmlReply += '</ul>';
      renderOutput(htmlReply);

    } catch (parseError) {
      console.error('Fehler beim Parsen der JSON-Antwort:', parseError);
      renderOutput(`<p>${rawText}</p><p><em>Hinweis: Die Antwort konnte nicht als JSON gelesen werden.</em></p>`);
    }

  } catch (error) {
    console.error('Frontend API Fehler:', error);
    renderOutput('<p>Es gab einen technischen Fehler. Bitte versuche es später erneut.</p>');
  }
}

// Diese Funktion hängt die Antwort in ein div mit id="output"
function renderOutput(html) {
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = html;
}
