// Konfiguration der Datenquellen
const LIVE_JSON_URL = "https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json";
const LOCAL_FALLBACK_URL = "./data__ap_mode.json"; // Relativer Pfad für den AP-Modus

let pool = [];
let lock = false;
let currentInput = "";

async function init() {
    renderKeyboard();
    const display = document.getElementById("task-display");
    
    try {
        // Versuch 1: Live-Daten laden
        display.innerText = "Connecting to GitHub...";
        const response = await fetch(LIVE_JSON_URL);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        pool = data.sort(() => Math.random() - 0.5);
        nextTask();
        
    } catch (error) {
        console.warn("Live-Verbindung fehlgeschlagen, wechsle in den AP-Modus:", error);
        
        try {
            // Versuch 2: Lokales Fallback (AP-Modus)
            display.innerText = "Offline. Lade AP-Modus Daten...";
            const fallbackResponse = await fetch(LOCAL_FALLBACK_URL);
            
            if (!fallbackResponse.ok) throw new Error("Lokale Datei nicht gefunden.");
            
            const localData = await fallbackResponse.json();
            pool = localData.sort(() => Math.random() - 0.5);
            
            // Kurze Bestätigung für den User, dass er im AP-Modus ist
            setTimeout(nextTask, 800);
            
        } catch (fallbackError) {
            // Wenn beides fehlschlägt, ist die App tot.
            console.error("Totalausfall:", fallbackError);
            display.innerText = "Kritischer Fehler: Weder Live- noch lokale Daten verfügbar.";
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
    if (pool.length === 0) {
        document.getElementById("main-game").classList.add("hidden");
        document.getElementById("result-screen").classList.remove("hidden");
        return;
    }
    
    currentInput = "";
    updateInputDisplay();
    // Sicherheits-Fix: innerText statt innerHTML verhindert Code-Injection
    document.getElementById("task-display").innerText = pool[0].q;
    document.getElementById("feedback-hint").innerText = "Fill the gap";
    document.getElementById("feedback-hint").style.color = "var(--text-muted)";
    lock = false;
}

function checkAnswer() {
    if (lock || currentInput.trim() === "") return;
    lock = true;
    
    const normalizedInput = normalize(currentInput);
    const validOptions = pool[0].a.split('/').map(x => normalize(x));

    if (validOptions.includes(normalizedInput)) {
        triggerFlash(true);
        document.getElementById("feedback-hint").innerText = "✓ Correct";
        document.getElementById("feedback-hint").style.color = "var(--success)";
        pool.shift();
        setTimeout(nextTask, 800);
    } else {
        triggerFlash(false);
        document.getElementById("feedback-hint").innerText = "✗ Solution: " + pool[0].a;
        document.getElementById("feedback-hint").style.color = "var(--danger)";
        let currentItem = pool.shift();
        pool.push(currentItem);
        setTimeout(nextTask, 2500);
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