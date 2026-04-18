/* ==========================================================================
   CONFIG & STATE
   ========================================================================== */
const LIVE_JSON_URL = "https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json";
const LOCAL_FALLBACK_URL = "./data__ap_mode.json";

let pool = [];
let currentBlock = null;
let currentGapIndex = 0;
let gameMode = null; 
let lock = false;

// AP-Mode State
let lives = 3;
let timerValue = 300; 
let timerInterval = null;

// Quickie State
let stopwatchValue = 0;
let stopwatchInterval = null;
let sessionCount = 0; 

// Input State
let currentInput = "";

/* ==========================================================================
   INIT & NAVIGATION
   ========================================================================== */
window.onload = () => {
    document.getElementById('btn-ap').onclick = () => startMode('ap');
    document.getElementById('btn-quickie').onclick = () => startMode('quickie');
    document.getElementById('btn-goto-menu').onclick = () => location.reload();
};

async function startMode(mode) {
    gameMode = mode;
    document.body.className = mode === 'ap' ? 'ap-mode' : 'q-mode';
    switchScreen('game-screen');

    document.getElementById('ap-hud-elements').style.display = mode === 'ap' ? 'flex' : 'none';
    document.getElementById('q-hud-elements').style.display = mode === 'quickie' ? 'flex' : 'none';
    document.getElementById('keyboard-container').style.display = mode === 'ap' ? 'flex' : 'none';
    document.getElementById('mc-container').style.display = mode === 'quickie' ? 'flex' : 'none';

    await loadData();
    
    if (mode === 'ap') {
        initAPMode();
    } else {
        sessionCount = 0; // Reset session for Quickie
        initQuickieMode();
    }
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

async function loadData() {
    try {
        const response = await fetch(gameMode === 'ap' ? LOCAL_FALLBACK_URL : LIVE_JSON_URL);
        if (!response.ok) throw new Error("Fetch failed");
        pool = await response.json();
    } catch (e) {
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
    loadNextBlock();
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
    if (sessionCount === 0) {
        stopwatchValue = 0;
        startStopwatch();
    }
    loadNextBlock();
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
   GAMEPLAY CORE
   ========================================================================== */
function loadNextBlock() {
    currentBlock = pool[Math.floor(Math.random() * pool.length)];
    currentGapIndex = 0;
    currentInput = "";
    lock = false;
    renderText();
    if (gameMode === 'quickie') renderMCButtons();
    document.getElementById('feedback-message').innerText = "";
}

function renderText() {
    const display = document.getElementById('text-display');
    display.innerHTML = "";
    
    let textParts = currentBlock.text.split(/(\{\d+\})/);
    textParts.forEach(part => {
        const match = part.match(/\{(\d+)\}/);
        if (match) {
            const gapId = match[1];
            const gapData = currentBlock.gaps.find(g => g.id === gapId);
            const gapEl = document.createElement('span');
            gapEl.className = 'gap';
            
            let idx = currentBlock.gaps.indexOf(gapData);
            if (idx < currentGapIndex) {
                gapEl.innerText = (Array.isArray(gapData.solution) ? gapData.solution[0] : gapData.solution).toUpperCase();
                gapEl.classList.add('correct');
            } else if (idx === currentGapIndex) {
                gapEl.innerText = currentInput || "____";
                gapEl.classList.add('active');
                // HIER: Grundwort anzeigen
                document.getElementById('feedback-message').innerText = `Base word: ${gapData.base_word.toUpperCase()}`;
                document.getElementById('feedback-message').style.color = "var(--ap-primary)";
                setTimeout(() => gapEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            } else {
                gapEl.innerText = "....";
            }
            display.appendChild(gapEl);
        } else {
            display.appendChild(document.createTextNode(part));
        }
    });
    
    let progress = (currentGapIndex / currentBlock.gaps.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

/* ==========================================================================
   INPUTS
   ========================================================================== */
function handleKeyPress(key) {
    if (lock) return;
    if (key === 'DEL') currentInput = currentInput.slice(0, -1);
    else if (key === 'ENT') checkAnswerAP();
    else if (key === 'SPACE') currentInput += ' ';
    else currentInput += key;
    renderText();
}

function renderKeyboard() {
    const layout = [['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l', "'"],['DEL','z','x','c','v','b','n','m','ENT'],['SPACE']];
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
   LOGIC
   ========================================================================== */
function normalize(str) {
    return str.toLowerCase().trim().replace(/[’´`‘]/g, "'");
}

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

    if (solutions.includes(input)) { successStep(); return; }

    if (gap.specific_feedback && (gap.specific_feedback[input] || gap.specific_feedback[currentInput])) {
        lives--; updateHearts();
        failStep(gap.specific_feedback[input] || gap.specific_feedback[currentInput], "red");
        return;
    }

    let isTippfehler = solutions.some(s => getDistance(input, s) <= 2);
    if (isTippfehler) {
        apTippfehlerCount++;
        if (apTippfehlerCount >= 2) {
            lives--; updateHearts();
            failStep("Mistake again! Life lost.", "red");
            apTippfehlerCount = 0;
        } else { failStep("Typing mistake?", "orange"); }
    } else {
        lives--; updateHearts();
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
        }
    }, gameMode === 'ap' ? 1200 : 500);
}

function failStep(msg, color) {
    lock = true;
    triggerFlash(color === "orange" ? "warning" : "error");
    document.getElementById('feedback-message').innerText = msg;
    document.getElementById('feedback-message').style.color = color === "orange" ? "var(--warning)" : "var(--danger)";
    
    setTimeout(() => {
        lock = false;
        if (color === "red" && gameMode === 'quickie') {
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

function finishBlock() {
    if (gameMode === 'quickie') {
        sessionCount++;
        if (sessionCount < 5) {
            triggerFlash("success");
            launchFireworks(false); // Kleines Feuerwerk zwischendurch
            setTimeout(() => loadNextBlock(), 1000); // SOFORT zum nächsten Text
            return;
        }
        // Nach 5 Texten
        clearInterval(stopwatchInterval);
        const best = localStorage.getItem('best_quickie');
        if (!best || stopwatchValue < parseInt(best)) localStorage.setItem('best_quickie', stopwatchValue);
        launchFireworks(true);
    } else {
        clearInterval(timerInterval);
        launchFireworks(true);
    }

    switchScreen('result-screen');
    document.getElementById('result-stats').innerText = gameMode === 'ap' ? "AP Passage Mastered!" : `Total Time for 5 texts: ${stopwatchValue}s`;
}

function gameOver() {
    clearInterval(timerInterval);
    alert("GAME OVER! Neustart des Blocks.");
    location.reload();
}

function launchFireworks(large) {
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < (large ? 300 : 100); i++) {
        particles.push({
            x: canvas.width/2, y: canvas.height/2,
            vX: (Math.random() - 0.5) * 15, vY: (Math.random() - 0.5) * 15,
            alpha: 1, color: `hsl(${Math.random() * 360}, 100%, 50%)`
        });
    }
    function animate() {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.x += p.vX; p.y += p.vY; p.alpha -= 0.01;
            ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
            if (p.alpha <= 0) particles.splice(i, 1);
        });
        if (particles.length > 0) requestAnimationFrame(animate);
    }
    animate();
}
