// /chat.js – Client-Skript für deine Webseite

async function sendPromptToAssistant(promptText) {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText }),
    });

    const data = await res.json();

    if (data.result && data.result[0]?.text?.value) {
      const responseText = data.result[0].text.value;

      try {
        const aiSuggestions = JSON.parse(responseText);

        if (!Array.isArray(aiSuggestions) || aiSuggestions.length === 0) {
          renderOutput(`<p>Keine passenden Asanas gefunden. Versuche es mit anderen Begriffen.</p>`);
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
        console.log('JSON Parse Error:', parseError);
        renderOutput(`<p>${responseText}</p><p><em>Hinweis: Die Antwort konnte nicht als JSON gelesen werden.</em></p>`);
      }
    } else {
      renderOutput('<p>Entschuldigung, ich konnte keine Antwort generieren.</p>');
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
