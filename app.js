const CONFIG = {
    LIVE_URL: "./data_quickie.json",
    AP_URL: "./data_ap_mode.json",
    AP_TIME: 300,
    MAX_LIVES: 3,
    WIN_STREAK: 3,
    MAX_JOKERS: 1  // <-- Nur noch 1 Joker global für beide Modi!
};

let state = {
    mode: null, pool: [], block: null, gapIdx: 0,
    lives: 3, time: 300, input: "", 
    attempts: 0, sessionWins: 0, lock: false,
    stopwatch: 0, timerInterval: null,
    waitingForNext: false, jokersUsed: 0
};

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

window.onload = () => {
    document.getElementById('btn-ap').onclick = () => startApp('ap');
    document.getElementById('btn-quickie').onclick = () => startApp('quickie');
    document.getElementById('btn-goto-menu').onclick = () => location.reload();
};

async function startApp(mode) {
    state.mode = mode;
    document.body.className = mode === 'ap' ? 'ap-mode' : 'q-mode';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    
    // --- NOTBREMSE & FEHLERANALYSE ---
    try {
        const targetUrl = mode === 'ap' ? CONFIG.AP_URL : CONFIG.LIVE_URL;
        const resp = await fetch(targetUrl);
        if (!resp.ok) {
            throw new Error(`Datei "${targetUrl}" nicht gefunden (HTTP ${resp.status}).`);
        }
        state.pool = await resp.json();
        
        if (!state.pool || state.pool.length === 0) {
            throw new Error(`Die Datei "${targetUrl}" ist leer oder falsch formatiert.`);
        }
    } catch(e) {
        alert(`FEHLER BEIM STARTEN:\n${e.message}\n\nDie App wurde angehalten, um einen schwarzen Bildschirm zu verhindern. Drücke F12 für die Konsole.`);
        console.error("Datenfehler: ", e);
        return; // Stoppt den Startvorgang
    }
    
    if(mode === 'ap') initAP(); else initQuickie();
}

function initAP() {
    if(state.sessionWins === 0) { state.time = CONFIG.AP_TIME; startTimer(); }
    state.lives = CONFIG.MAX_LIVES; state.jokersUsed = 0;
    
    // Sicherheitscheck für den geladenen Block
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    if (!state.block || !state.block.gaps) {
        alert("FEHLER: Der geladene Textblock hat keine 'gaps' (Lücken). Überprüfe die JSON-Struktur!");
        return;
    }
    
    state.block.gaps.forEach(g => g.status = null); 
    state.gapIdx = 0;
    
    document.getElementById('ap-hud-elements').style.display = 'flex';
    document.getElementById('keyboard-container').style.display = 'flex';
    document.getElementById('mc-container').style.display = 'none';
    
    renderHUD(); renderContent(); renderKeyboard();
}

function initQuickie() {
    if(state.sessionWins === 0) {
        state.stopwatch = 0; startStopwatch();
        const best = localStorage.getItem('best_quickie');
        document.getElementById('best-time-display').innerText = best ? `Best: ${best}s` : "Best: --:--";
    }
    state.lives = CONFIG.MAX_LIVES; state.jokersUsed = 0;
    
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    if (!state.block || !state.block.gaps) {
        alert("FEHLER: Der geladene Textblock hat keine 'gaps' (Lücken). Überprüfe die JSON-Struktur!");
        return;
    }
    
    state.block.gaps.forEach(g => g.status = null);
    state.gapIdx = 0; state.waitingForNext = false;
    
    document.getElementById('q-hud-elements').style.display = 'flex';
    document.getElementById('mc-container').style.display = 'flex';
    document.getElementById('keyboard-container').style.display = 'none';
    
    renderHUD(); renderContent(); renderMC();
}

function renderContent() {
    const container = document.getElementById('text-display');
    const badge = document.getElementById('base-word-badge');
    const isMobile = window.innerWidth <= 768;
    container.innerHTML = "";

    let textToRender = state.block.text;

    if(isMobile) {
        const sentences = state.block.text.match(/[^.!?]+[.!?]*\s*/g) || [state.block.text];
        const currentGapId = state.block.gaps[state.gapIdx].id;
        const currIdx = sentences.findIndex(s => s.includes(`{${currentGapId}}`));
        if(currIdx !== -1) textToRender = (currIdx > 0 ? sentences[currIdx - 1] : "") + sentences[currIdx];
    }

    let parts = textToRender.split(/(\{\d+\})/);
    parts.forEach(p => {
        const m = p.match(/\{(\d+)\}/);
        if(m) {
            const g = state.block.gaps.find(x => x.id === m[1]);
            const gIdx = state.block.gaps.indexOf(g);
            const span = document.createElement('span');
            span.className = 'gap';
            
            if(gIdx < state.gapIdx) {
                // Abfangen, falls solution kein Array ist (für ältere JSONs)
                const sol = Array.isArray(g.solution) ? g.solution[0] : g.solution;
                span.innerText = sol.toUpperCase();
                span.classList.add(g.status || 'perfect'); 
            } else if (gIdx === state.gapIdx) {
                if(g.status === 'failed') {
                    const sol = Array.isArray(g.solution) ? g.solution[0] : g.solution;
                    span.innerText = sol.toUpperCase();
                    span.classList.add('failed');
                } else {
                    span.innerText = state.input || "____";
                    span.classList.add('active');
                }
                
                if(state.mode === 'ap' && g.base_word) {
                    badge.style.display = 'inline-block';
                    badge.innerText = g.base_word.toUpperCase();
                } else { 
                    badge.style.display = 'none'; 
                }
                setTimeout(() => span.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            } else { span.innerText = "...."; }
            container.appendChild(span);
        } else { container.appendChild(document.createTextNode(p)); }
    });
    document.getElementById('progress-bar').style.width = `${(state.gapIdx / state.block.gaps.length) * 100}%`;
}

function handleGameOver() {
    clearInterval(state.timerInterval); state.sessionWins = 0; 
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('loser-screen').classList.add('active');
    
    setTimeout(() => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('game-screen').classList.add('active');
        if(state.mode === 'ap') initAP(); else initQuickie();
    }, 3000);
}

function checkAP() {
    if(state.lock || !state.input) return;
    const gap = state.block.gaps[state.gapIdx];
    let val = state.input.toLowerCase().trim().replace(/[’´`‘]/g, "'"); 
    const solutions = (Array.isArray(gap.solution) ? gap.solution : [gap.solution]).map(s => s.toLowerCase().trim().replace(/[’´`‘]/g, "'"));

    if(solutions.includes(val)) {
        state.lock = true; if(!gap.status) gap.status = 'perfect'; 
        handleSuccess(); return; 
    } 

    let feedbackText = null;
    if(gap.specific_feedback) {
        if(gap.specific_feedback[val]) feedbackText = gap.specific_feedback[val];
        else feedbackText = Object.values(gap.specific_feedback)[0];
    }
    
    const dist = (a, b) => {
        const dp = Array.from({length
