/* ==========================================================================
   CONFIG & STATE
   ========================================================================== */
const LIVE_JSON_URL = "https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json";
const LOCAL_FALLBACK_URL = "./data__ap_mode.json";

let pool = [];
let currentBlock = null;
let currentGapIndex = 0;
let gameMode = null; // 'ap' or 'quickie'
let lock = false;

// AP-Mode State
let lives = 3;
let timerValue = 300; // 5 Minuten
let timerInterval = null;

// Quickie State
let stopwatchValue = 0;
let stopwatchInterval = null;
let sessionCount = 0; // Für das große Feuerwerk (5 Texte)

// Input State
let currentInput = "";

/* ==========================================================================
   INIT & NAVIGATION
   ========================================================================== */
window.onload = () => {
    // Event-Listener für Start-Buttons
    document.getElementById('btn-ap').onclick = () => startMode('ap');
    document.getElementById('btn-quickie').onclick = () => startMode('quickie');
    document.getElementById('btn-goto-menu').onclick = () => location.reload();
};

async function startMode(mode) {
    gameMode = mode;
    document.body.className = mode === 'ap' ? 'ap-mode' : 'q-mode';
    switchScreen('game-screen');

    // UI-Elemente umschalten
    document.getElementById('ap-hud-elements').style.display = mode === 'ap' ? 'flex' : 'none';
    document.getElementById('q-hud-elements').style.display = mode === 'quickie' ? 'flex' : 'none';
    document.getElementById('keyboard-container').style.display = mode === 'ap' ? 'flex' : 'none';
    document.getElementById('mc-container').style.display = mode === 'quickie' ? 'flex' : 'none';

    await loadData();
    
    if (mode === 'ap') {
        initAPMode();
    } else {
        initQuickieMode();
    }
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

/* ==========================================================================
   DATA LOADING
   ========================================================================== */
async function loadData() {
    const display = document.getElementById('text-display');
    try {
        const response = await fetch(gameMode === 'ap' ? LOCAL_FALLBACK_URL : LIVE_JSON_URL);
        if (!response.ok) throw new Error("Fetch failed");
        pool = await response.json();
    } catch (e) {
        console.warn("Ladefehler, wechsle zu lokalem Fallback", e);
        const fallback = await fetch(LOCAL_FALLBACK_URL);
        pool = await fallback.json();
    }
}

/* ==========================================================================
   AP-MODE LOGIC
   ========================================================================== */
function initAPMode() {
    lives = 3;
    timerValue = 300;
    updateHearts();
    startTimer();
    
    // Zufälligen Block wählen
    currentBlock = pool[Math.floor(Math.random() * pool.length)];
    currentGapIndex = 0;
    
    renderKeyboard();
    renderText();
}

function startTimer() {
    clearInterval(timerInterval);
    const timerDisplay = document.getElementById('timer-display');
    timerInterval = setInterval(() => {
        timerValue--;
        let mins = Math.floor(timerValue / 60);
        let secs = timerValue % 60;
        timerDisplay.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        
        if (timerValue <= 30) timerDisplay.classList.add('warning');
        if (timerValue <= 0) {
            clearInterval(timerInterval);
            // AP-Konsequenz: Timer abgelaufen (Note am Ende oder Siegel)
        }
    }, 1000);
}

function updateHearts() {
    const container = document.getElementById('hearts-container');
    container.innerHTML = '❤️'.repeat(lives);
    if (lives <= 0) gameOver();
}

/* ==========================================================================
   QUICKIE LOGIC
   ========================================================================== */
function initQuickieMode() {
    stopwatchValue = 0;
    startStopwatch();
    
    // Zufälligen Block wählen
    currentBlock = pool[Math.floor(Math.random() * pool.length)];
    currentGapIndex = 0;
    
    // Bestzeit laden
    const best = localStorage.getItem('best_quickie');
    document.getElementById('best-time-display').innerText = best ? `Best: ${best}s` : "Best: --:--";
    
    renderText();
    renderMCButtons();
}

function startStopwatch() {
    clearInterval(stopwatchInterval);
    stopwatchInterval = setInterval(() => {
        stopwatchValue++;
        let m = Math.floor(stopwatchValue / 60);
        let s = stopwatchValue % 60;
        document.getElementById('stopwatch-display').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }, 1000);
}

/* ==========================================================================
   CORE RENDERING
   ========================================================================== */
function renderText() {
    const display = document.getElementById('text-display');
    display.innerHTML = "";
    
    // Text parsen und Gaps als Spans einfügen
    let textParts = currentBlock.text.split(/(\{\d+\})/);
    
    textParts.forEach(part => {
        const match = part.match(/\{(\d+)\}/);
        if (match) {
            const gapId = match[1];
            const gapData = currentBlock.gaps.find(g => g.id === gapId);
            const gapEl = document.createElement('span');
            gapEl.className = 'gap';
            gapEl.id = `gap-${gapId}`;
            
            let currentGapIdxInArray = currentBlock.gaps.indexOf(gapData);
            
            if (currentGapIdxInArray < currentGapIndex) {
                // Gelöst
                gapEl.innerText = (Array.isArray(gapData.solution) ? gapData.solution[0] : gapData.solution).toUpperCase();
                gapEl.classList.add('correct');
            } else if (currentGapIdxInArray === currentGapIndex) {
                // Aktiv
                gapEl.innerText = currentInput || "____";
                gapEl.classList.add('active');
                setTimeout(() => gapEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            } else {
                // Zukünftig
                gapEl.innerText = "....";
            }
            display.appendChild(gapEl);
        } else {
            display.appendChild(document.createTextNode(part));
        }
    });
    
    // Progress
    let progress = (currentGapIndex / currentBlock.gaps.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

/* ==========================================================================
   INPUT HANDLING (AP & QUICKIE)
   ========================================================================== */
function handleKeyPress(key) {
    if (lock) return;
    if (key === 'DEL') currentInput = currentInput.slice(0, -1);
    else if (key === 'ENT') checkAnswerAP();
    else if (key === 'SPACE') currentInput += ' ';
    else currentInput += key;
    
    renderText(); // Update Lücke live
}

function renderKeyboard() {
    const layout = [
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l', "'"],
        ['DEL','z','x','c','v','b','n','m','ENT'],
        ['SPACE']
    ];
    const container = document.getElementById('keyboard-container');
    container.innerHTML = "";
    layout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'kb-row';
        row.forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'key';
            if (['DEL', 'ENT', 'SPACE'].includes(key)) btn.classList.add('wide');
            if (key === 'SPACE') btn.classList.add('space');
            btn.innerText = key === 'DEL' ? '⌫' : (key === 'ENT' ? 'GO' : key);
            btn.onmousedown = (e) => { e.preventDefault(); handleKeyPress(key); };
            rowDiv.appendChild(btn);
        });
        container.appendChild(rowDiv);
    });
}

function renderMCButtons() {
    const container = document.getElementById('mc-container');
    container.innerHTML = "";
    const gap = currentBlock.gaps[currentGapIndex];
    gap.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'mc-btn glow-q';
        btn.innerText = opt;
        btn.onclick = () => checkAnswerQuickie(opt);
        container.appendChild(btn);
    });
}

/* ==========================================================================
   LOGIC: CHECK ANSWERS
   ========================================================================== */
function normalize(str) {
    // Egal-Regel für Apostrophe & Full Forms
    let n = str.toLowerCase().trim();
    n = n.replace(/[’´`‘]/g, "'");
    // Optionale Full-Form Normalisierung hier möglich
    return n;
}

// Levenshtein für Tippfehler
function getDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}

let apTippfehlerCount = 0;

function checkAnswerAP() {
    if (lock || !currentInput) return;
    const gap = currentBlock.gaps[currentGapIndex];
    const input = normalize(currentInput);
    const solutions = (Array.isArray(gap.solution) ? gap.solution : [gap.solution]).map(s => normalize(s));

    // 1. Korrekt?
    if (solutions.includes(input)) {
        successStep();
        return;
    }

    // 2. Grammatikfehler (JSON Priority)?
    if (gap.specific_feedback && (gap.specific_feedback[input] || gap.specific_feedback[currentInput])) {
        failStep(gap.specific_feedback[input] || gap.specific_feedback[currentInput], "red");
        return;
    }

    // 3. Tippfehler (Levenshtein)?
    let isTippfehler = solutions.some(s => getDistance(input, s) <= 2);
    if (isTippfehler) {
        apTippfehlerCount++;
        if (apTippfehlerCount >= 2) {
            lives--;
            updateHearts();
            failStep("Typing mistake again! Life lost.", "red");
            apTippfehlerCount = 0;
        } else {
            failStep("Typing mistake?", "orange");
        }
    } else {
        // Komplett falsch
        lives--;
        updateHearts();
        failStep("False!", "red");
    }
}

function checkAnswerQuickie(opt) {
    if (lock) return;
    const gap = currentBlock.gaps[currentGapIndex];
    if (normalize(opt) === normalize(gap.solution)) {
        successStep();
    } else {
        failStep(`False! ${gap.explanation}`, "red");
    }
}

/* ==========================================================================
   FEEDBACK EFFECTS
   ========================================================================== */
function successStep() {
    lock = true;
    triggerFlash("success");
    document.getElementById('feedback-message').innerText = "✓ Correct";
    document.getElementById('feedback-message').style.color = "var(--success)";
    
    setTimeout(() => {
        currentGapIndex++;
        currentInput = "";
        apTippfehlerCount = 0;
        if (currentGapIndex >= currentBlock.gaps.length) {
            finishBlock();
        } else {
            lock = false;
            renderText();
            if (gameMode === 'quickie') renderMCButtons();
            document.getElementById('feedback-message').innerText = "";
        }
    }, gameMode === 'ap' ? 1200 : 500);
}

function failStep(msg, color) {
    lock = true;
    triggerFlash(color === "orange" ? "warning" : "error");
    document.getElementById('feedback-message').innerText = msg;
    document.getElementById('feedback-message').style.color = color === "orange" ? "var(--warning)" : "var(--danger)";
    
    // AP-Mode: Wenn wir Hilfe/Lösung zeigen (nach dem 3. Versuch), 
    // ist der Timer länger oder wir springen weiter. 
    // Hier vereinfacht: User muss es nochmal versuchen.
    setTimeout(() => {
        lock = false;
        if (color === "red" && gameMode === 'quickie') {
             // Quickie: Lösung zeigen und weiter
             currentGapIndex++;
             if (currentGapIndex >= currentBlock.gaps.length) finishBlock();
             else { renderText(); renderMCButtons(); }
        }
        renderText();
    }, 1500);
}

function triggerFlash(type) {
    const f = document.getElementById('flash-overlay');
    f.style.backgroundColor = type === 'success' ? 'var(--success)' : (type === 'warning' ? 'var(--warning)' : 'var(--danger)');
    f.style.opacity = "0.3";
    setTimeout(() => f.style.opacity = "0", 200);
}

/* ==========================================================================
   GAME END & FIREWORKS
   ========================================================================== */
function finishBlock() {
    clearInterval(timerInterval);
    clearInterval(stopwatchInterval);
    
    if (gameMode === 'quickie') {
        sessionCount++;
        // Highscore speichern
        const currentBest = localStorage.getItem('best_quickie');
        if (!currentBest || stopwatchValue < parseInt(currentBest)) {
            localStorage.setItem('best_quickie', stopwatchValue);
        }
    }

    switchScreen('result-screen');
    document.getElementById('result-stats').innerText = gameMode === 'ap' ? "Passage Mastered!" : `Time: ${stopwatchValue}s (Session: ${sessionCount}/5)`;
    
    if (gameMode === 'quickie' && sessionCount >= 5) {
        launchFireworks(true); // Groß
        sessionCount = 0;
    } else {
        launchFireworks(false); // Klein
    }
}

function gameOver() {
    clearInterval(timerInterval);
    alert("GAME OVER! Neustart des Blocks.");
    currentGapIndex = 0;
    lives = 3;
    startMode('ap');
}

/* ==========================================================================
   FIREWORKS (Datenschutzkonform - Canvas)
   ========================================================================== */
function launchFireworks(large) {
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    let particles = [];
    function createParticle(x, y) {
        return {
            x, y,
            vX: (Math.random() - 0.5) * 10,
            vY: (Math.random() - 0.5) * 10,
            alpha: 1,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        };
    }

    for (let i = 0; i < (large ? 300 : 100); i++) {
        particles.push(createParticle(canvas.width/2, canvas.height/2));
    }

    function animate() {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.x += p.vX; p.y += p.vY; p.alpha -= 0.01;
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
            if (p.alpha <= 0) particles.splice(i, 1);
        });
        if (particles.length > 0) requestAnimationFrame(animate);
    }
    animate();
}
