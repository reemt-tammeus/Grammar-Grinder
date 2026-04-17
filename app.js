// Konfiguration der Datenquellen
const LIVE_JSON_URL = "https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json";
const LOCAL_FALLBACK_URL = "./data__ap_mode.json";

let pool = [];
let currentBlockIndex = 0;
let currentGapIndex = 0;
let lock = false;
let currentInput = "";

async function init() {
    renderKeyboard();
    const display = document.getElementById("task-display");
    
    // CSS-Anpassungen via JS, damit lange Lückentexte besser lesbar sind
    display.style.textAlign = "left";
    display.style.fontSize = "1.1rem";
    display.style.alignItems = "flex-start";
    display.style.lineHeight = "1.5";
    
    try {
        display.innerText = "Connecting to GitHub...";
        const response = await fetch(LIVE_JSON_URL);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        pool = await response.json();
        
        // Optional: pool = pool.sort(() => Math.random() - 0.5); // Blöcke mischen
        nextTask();
        
    } catch (error) {
        console.warn("Live-Verbindung fehlgeschlagen, wechsle in den AP-Modus:", error);
        try {
            display.innerText = "Offline. Lade AP-Modus Daten...";
            const fallbackResponse = await fetch(LOCAL_FALLBACK_URL);
            
            if (!fallbackResponse.ok) throw new Error("Lokale Datei nicht gefunden.");
            pool = await fallbackResponse.json();
            
            setTimeout(nextTask, 800);
            
        } catch (fallbackError) {
            console.error("Totalausfall:", fallbackError);
            display.innerText = "Kritischer Fehler: Keine Daten verfügbar.";
            display.style.color = "var(--danger)";
        }
    }
}

function normalize(text) {
    let n = text.toLowerCase().replace(/['´`’]/g, "'");
    n = n.replace(/n't\b/g, " not").replace(/'m\b/g, " am").replace(/'re\b/g, " are");
    n = n.replace(/'ll\b/g, " will").replace(/'ve\b/g, " have").replace(/'d\b/g, " would");
    return n.trim().replace(/\s+/g, ' ');
}

function nextTask() {
    // Prüfen ob alle Text-Blöcke durchgespielt sind
    if (currentBlockIndex >= pool.length) {
        document.getElementById("main-game").classList.add("hidden");
        document.getElementById("result-screen").classList.remove("hidden");
        return;
    }

    let block = pool[currentBlockIndex];

    // Prüfen ob der aktuelle Text fertig ausgefüllt ist
    if (currentGapIndex >= block.gaps.length) {
        currentBlockIndex++;
        currentGapIndex = 0;
        
        lock = true;
        document.getElementById("task-display").innerText = "Excellent! Loading next passage...";
        document.getElementById("feedback-hint").innerText = "";
        
        // Kurze Pause, bevor der nächste Paragraph geladen wird
        setTimeout(() => { lock = false; nextTask(); }, 1500);
        return;
    }

    let gap = block.gaps[currentGapIndex];
    currentInput = "";
    updateInputDisplay();
    lock = false;

    // Den Paragraph dynamisch rendern
    let displayText = block.text;
    block.gaps.forEach((g, index) => {
        let placeholder = `{${g.id}}`;
        if (index < currentGapIndex) {
            // Lücke wurde bereits gelöst -> Wort im Text anzeigen (Hervorgehoben)
            let solText = Array.isArray(g.solution) ? g.solution[0] : g.solution;
            displayText = displayText.replace(placeholder, solText.toUpperCase());
        } else if (index === currentGapIndex) {
            // Das ist die aktuelle Lücke
            displayText = displayText.replace(placeholder, `[ ___ ]`);
        } else {
            // Zukünftige Lücken bleiben neutral
            displayText = displayText.replace(placeholder, `...`);
        }
    });

    document.getElementById("task-display").innerText = displayText;
    document.getElementById("feedback-hint").innerText = `Base word: ${gap.base_word}`;
    document.getElementById("feedback-hint").style.color = "var(--primary)";
}

function checkAnswer() {
    if (lock || currentInput.trim() === "") return;
    lock = true;
    
    let block = pool[currentBlockIndex];
    let gap = block.gaps[currentGapIndex];
    let normalizedInput = normalize(currentInput);

    // Mismatch beheben: Arrays (AP Mode) vs Strings (Quickie) zusammenführen
    let validOptions = [];
    if (Array.isArray(gap.solution)) {
        validOptions = gap.solution.map(x => normalize(x));
    } else {
        validOptions = gap.solution.split('/').map(x => normalize(x));
    }
    
    // Die primäre Lösung für die Anzeige
    let mainSolution = Array.isArray(gap.solution) ? gap.solution[0] : gap.solution;

    if (validOptions.includes(normalizedInput)) {
        // RICHTIG
        triggerFlash(true);
        document.getElementById("feedback-hint").innerText = "✓ Correct!";
        document.getElementById("feedback-hint").style.color = "var(--success)";
        currentGapIndex++;
        setTimeout(nextTask, 1000);
    } else {
        // FALSCH
        triggerFlash(false);
        
        let feedbackMessage = `✗ Wrong.`;
        
        // Schlaue Fehleranalyse: Gibt es ein spezifisches Feedback in den JSONs?
        if (gap.specific_feedback) {
            if (gap.specific_feedback[currentInput]) {
                feedbackMessage = `✗ ${gap.specific_feedback[currentInput]}`;
            } else if (gap.specific_feedback[normalizedInput]) {
                feedbackMessage = `✗ ${gap.specific_feedback[normalizedInput]}`;
            }
        } else if (gap.explanation) {
            feedbackMessage = `✗ ${gap.explanation}`;
        }

        document.getElementById("feedback-hint").innerText = `${feedbackMessage} (Solution: ${mainSolution})`;
        document.getElementById("feedback-hint").style.color = "var(--danger)";
        
        // Wir decken die Lücke auf und gehen zur nächsten weiter. 
        // Längere Pause (3.5s), damit der User die ausführliche Erklärung lesen kann!
        currentGapIndex++;
        setTimeout(nextTask, 3500);
    }
}

function triggerFlash(isSuccess) {
    const overlay = document.getElementById('flash-overlay');
    overlay.className = isSuccess ? 'flash-success' : 'flash-error';
    setTimeout(() => { overlay.className = ''; }, 300);
}

function renderKeyboard() {
    const layout = [
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l', "'"],
        ['DEL','z','x','c','v','b','n','m','ENT'],
        ['SPACE']
    ];

    const kbContainer = document.getElementById('app-keyboard');
    kbContainer.innerHTML = '';

    layout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        row.forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'key';
            if (key === 'DEL' || key === 'ENT') btn.classList.add('action');
            if (key === 'ENT') btn.classList.add('enter');
            if (key === 'SPACE') btn.classList.add('space');

            btn.innerText = key === 'SPACE' ? 'SPACE' : (key === 'DEL' ? '⌫' : (key === 'ENT' ? 'GO' : key));
            
            const handleTap = (e) => { e.preventDefault(); handleKeyPress(key); };
            btn.addEventListener('touchstart', handleTap, {passive: false});
            btn.addEventListener('mousedown', handleTap);
            
            rowDiv.appendChild(btn);
        });
        kbContainer.appendChild(rowDiv);
    });
}

function handleKeyPress(key) {
    if (lock) return;
    if (key === 'DEL') currentInput = currentInput.slice(0, -1);
    else if (key === 'ENT') checkAnswer();
    else if (key === 'SPACE') currentInput += ' ';
    else currentInput += key;
    updateInputDisplay();
}

function updateInputDisplay() {
    document.getElementById('task-input').value = currentInput;
}

window.onload = init;