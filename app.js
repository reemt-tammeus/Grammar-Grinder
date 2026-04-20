let state = {
    mode: null,
    data: [],
    currentIndex: 0,
    lives: 3,
    streak: 0,
    jokerUsed: false,
    apInputText: ""
};

// --- INIT & FLOW ---
async function startGame(selectedMode) {
    state.mode = selectedMode;
    state.lives = 3;
    state.streak = 0;
    state.currentIndex = 0;
    updateStats();

    // Lädt temporäre Mock-Daten (Später durch fetch('datei.json') ersetzen)
    state.data = state.mode === 'quickie' ? await mockFetchQuickie() : await mockFetchAP();

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('stats-bar').classList.remove('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('thumb-zone').classList.remove('hidden');

    loadQuestion();
}

function loadQuestion() {
    if (state.currentIndex >= state.data.length) {
        alert("Training beendet! Alle Sätze geschafft.");
        location.reload();
        return;
    }
    
    state.jokerUsed = false;
    document.getElementById('next-btn').classList.add('hidden');
    
    const q = state.data[state.currentIndex];
    document.getElementById('text-display').innerHTML = q.text;

    if (state.mode === 'quickie') {
        document.getElementById('quickie-controls').classList.remove('hidden');
        document.getElementById('ap-controls').classList.add('hidden');
        renderQuickieButtons(q);
    } else {
        document.getElementById('quickie-controls').classList.add('hidden');
        document.getElementById('ap-controls').classList.remove('hidden');
        renderKeyboard();
    }
}

// --- QUICKIE MODE ---
function renderQuickieButtons(q) {
    const container = document.getElementById('quickie-controls');
    container.innerHTML = '';
    
    // Fisher-Yates Shuffle der Options
    let options = [...q.options];
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt;
        btn.onclick = () => handleQuickieAnswer(opt, btn);
        container.appendChild(btn);
    });
}

function handleQuickieAnswer(selected, btnElement) {
    const q = state.data[state.currentIndex];
    
    if (selected === q.solution) {
        showFlash("Korrekt!", "flash-green");
        state.streak++;
        if (state.streak % 3 === 0) triggerFireworks();
        setTimeout(loadNext, 1000);
    } else {
        state.streak = 0;
        if (!state.jokerUsed) {
            state.jokerUsed = true;
            btnElement.classList.add('disabled-btn');
            showFlash("Fehler! Joker aktiv. " + q.explanation, "flash-orange", 2000);
        } else {
            loseLife();
            document.getElementById('quickie-controls').innerHTML = '';
            showFlash("Falsch! Richtig: " + q.solution, "flash-red", 2500);
            document.getElementById('next-btn').classList.remove('hidden');
        }
    }
    updateStats();
}

// --- AP MODE ---
function renderKeyboard() {
    state.apInputText = "";
    document.getElementById('ap-input-display').textContent = "";
    document.getElementById('ap-input-display').style.color = "var(--text-color)";
    
    const kb = document.getElementById('keyboard');
    kb.innerHTML = '';
    const letters = "abcdefghijklmnopqrstuvwxyz ".split("");
    
    letters.forEach(l => {
        const key = document.createElement('div');
        key.className = 'key';
        key.textContent = l === " " ? "SPACE" : l;
        key.onclick = () => {
            state.apInputText += l;
            document.getElementById('ap-input-display').textContent = state.apInputText;
        };
        kb.appendChild(key);
    });
    
    const del = document.createElement('div');
    del.className = 'key'; 
    del.textContent = "DEL";
    del.onclick = () => {
        state.apInputText = state.apInputText.slice(0, -1);
        document.getElementById('ap-input-display').textContent = state.apInputText;
    };
    kb.appendChild(del);
}

function checkAPAnswer() {
    const q = state.data[state.currentIndex];
    const input = state.apInputText.trim().toLowerCase();
    
    let isCorrect = q.solution.includes(input);
    let distance = q.solution.map(s => levenshtein(input, s)).sort((a,b)=>a-b)[0];

    if (isCorrect) {
        showFlash("Perfekt!", "flash-green");
        state.streak++;
        if (state.streak % 3 === 0) triggerFireworks();
        setTimeout(loadNext, 1000);
    } else if (distance <= 1 && !state.jokerUsed && input.length > 2) {
        state.jokerUsed = true;
        state.streak = 0;
        showFlash("Tippfehler korrigiert (Joker)!", "flash-orange", 2000);
        document.getElementById('ap-input-display').style.color = "var(--orange)";
        setTimeout(loadNext, 1500);
    } else {
        state.streak = 0;
        // Spezifisches Feedback prüfen
        if (!state.jokerUsed && q.specific_feedback && q.specific_feedback[input]) {
            state.jokerUsed = true;
            showFlash(q.specific_feedback[input], "flash-orange", 2500);
        } else {
            loseLife();
            showFlash("Falsch! Lösung: " + q.solution[0], "flash-red", 2500);
            document.getElementById('keyboard').innerHTML = '';
            document.getElementById('next-btn').classList.remove('hidden');
        }
    }
    updateStats();
}

// --- HELPER & SYSTEM ---
function loadNext() {
    state.currentIndex++;
    loadQuestion();
}

function loseLife() {
    state.lives--;
    updateStats();
    if (state.lives <= 0) {
        document.getElementById('game-over-screen').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('game-over-screen').classList.add('hidden');
            state.lives = 3;
            state.streak = 0;
            updateStats();
            loadQuestion(); // Text reset
        }, 3000);
    }
}

function updateStats() {
    document.getElementById('lives').textContent = "❤️".repeat(state.lives);
    document.getElementById('streak').textContent = "🔥 " + state.streak;
}

function showFlash(msg, colorClass, duration = 1500) {
    const flash = document.getElementById('feedback-flash');
    flash.textContent = msg;
    flash.className = colorClass;
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), duration);
}

function triggerFireworks() { 
    console.log("🎆 FEUERWERK ANIMATION HIER 🎆"); 
}

// Levenshtein-Distanz für Tippfehler-Toleranz
function levenshtein(a, b) {
    if(a.length == 0) return b.length; 
    if(b.length == 0) return a.length; 
    var matrix = [];
    for(let i = 0; i <= b.length; i++){ matrix[i] = [i]; }
    for(let j = 0; j <= a.length; j++){ matrix[0][j] = j; }
    for(let i = 1; i <= b.length; i++){
        for(let j = 1; j <= a.length; j++){
            if(b.charAt(i-1) == a.charAt(j-1)){ matrix[i][j] = matrix[i-1][j-1]; } 
            else { matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1)); }
        }
    }
    return matrix[b.length][a.length];
}

// --- TEMPORÄRE MOCK DATEN (Für lokalen Test ohne Server) ---
async function mockFetchQuickie() { 
    return [
        {id: "t1_01", text: "If it rains, we ___ at home.", solution: "will stay", options: ["will stay", "would stay", "would have stayed"], explanation: "Type 1: If + Present -> will-Future."},
        {id: "t2_01", text: "If I won the lottery, I ___ the world.", solution: "would travel", options: ["will travel", "would travel", "would have traveled"], explanation: "Type 2: If + Past -> would + Infinitiv."}
    ]; 
}

async function mockFetchAP() { 
    return [
        {id: "t1_01_ap", text: "If it rains, we ___ (stay) at home.", base_word: "stay", solution: ["will stay"], specific_feedback: {"would stay": "Kein 'would' im Type 1!"}}
    ]; 
}
