const LIVE_JSON_URL = "[https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json](https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json)";
const LOCAL_FALLBACK_URL = "./data__ap_mode.json";

let pool = [];
let currentBlockIndex = 0;
let currentGapIndex = 0;
let lock = false;
let currentInput = "";

async function init() {
    renderKeyboard();
    const display = document.getElementById("task-display");
    
    // Styling für Lückentexte
    display.style.textAlign = "left";
    display.style.fontSize = "1.1rem";
    display.style.alignItems = "flex-start";
    display.style.lineHeight = "1.5";
    
    try {
        display.innerText = "Connecting to GitHub...";
        const response = await fetch(LIVE_JSON_URL);
        if (!response.ok) throw new Error(`HTTP Fehler: ${response.status}`);
        
        pool = await response.json();
        nextTask();
        
    } catch (error) {
        console.warn("Live-Fehler, wechsle zu Lokal:", error);
        try {
            const fallbackResponse = await fetch(LOCAL_FALLBACK_URL);
            if (!fallbackResponse.ok) throw new Error("Lokale Datei fehlt");
            pool = await fallbackResponse.json();
            nextTask();
        } catch (fError) {
            display.innerText = "FEHLER: " + fError.message;
            display.style.color = "red";
        }
    }
}

function normalize(text) {
    return text.toLowerCase().trim().replace(/['´`’]/g, "'").replace(/\s+/g, ' ');
}

function nextTask() {
    if (currentBlockIndex >= pool.length) {
        document.getElementById("main-game").classList.add("hidden");
        document.getElementById("result-screen").classList.remove("hidden");
        return;
    }

    let block = pool[currentBlockIndex];
    if (currentGapIndex >= block.gaps.length) {
        currentBlockIndex++;
        currentGapIndex = 0;
        nextTask();
        return;
    }

    let gap = block.gaps[currentGapIndex];
    currentInput = "";
    updateInputDisplay();
    lock = false;

    // Text mit Lücken zusammenbauen
    let displayText = block.text;
    block.gaps.forEach((g, index) => {
        let placeholder = `{${g.id}}`;
        if (index < currentGapIndex) {
            let sol = Array.isArray(g.solution) ? g.solution[0] : g.solution;
            displayText = displayText.replace(placeholder, sol.toUpperCase());
        } else if (index === currentGapIndex) {
            displayText = displayText.replace(placeholder, " [ ___ ] ");
        } else {
            displayText = displayText.replace(placeholder, "...");
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
    let userInput = normalize(currentInput);
    
    let solutions = Array.isArray(gap.solution) ? gap.solution : [gap.solution];
    let isCorrect = solutions.some(s => normalize(s) === userInput);

    if (isCorrect) {
        triggerFlash(true);
        currentGapIndex++;
        setTimeout(nextTask, 800);
    } else {
        triggerFlash(false);
        let sol = solutions[0];
        document.getElementById("feedback-hint").innerText = `✗ ${gap.explanation || 'Wrong'}. Solution: ${sol}`;
        document.getElementById("feedback-hint").style.color = "var(--danger)";
        currentGapIndex++; // Zeige Lösung und gehe zur nächsten Lücke
        setTimeout(nextTask, 3000);
    }
}

function triggerFlash(isSuccess) {
    const overlay = document.getElementById('flash-overlay');
    overlay.className = isSuccess ? 'flash-success' : 'flash-error';
    setTimeout(() => { overlay.className = ''; }, 300);
}

function renderKeyboard() {
    const layout = [['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l', "'"],['DEL','z','x','c','v','b','n','m','ENT'],['SPACE']];
    const kbContainer = document.getElementById('app-keyboard');
    kbContainer.innerHTML = '';
    layout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        row.forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'key';
            if (key === 'DEL' || key === 'ENT') btn.classList.add('action');
            btn.innerText = key === 'SPACE' ? 'SPACE' : (key === 'DEL' ? '⌫' : (key === 'ENT' ? 'GO' : key));
            btn.onmousedown = (e) => { e.preventDefault(); handleKeyPress(key); };
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
