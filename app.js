const CONFIG = {
    LIVE_URL: "./data_quickie.json",
    AP_URL: "./data_ap_mode.json",
    AP_TIME: 300,
    MAX_LIVES: 3,
    WIN_STREAK: 3,
    MAX_JOKERS: 1
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
        return;
    }
    
    if(mode === 'ap') initAP(); else initQuickie();
}

function initAP() {
    if(state.sessionWins === 0) { state.time = CONFIG.AP_TIME; startTimer(); }
    state.lives = CONFIG.MAX_LIVES; state.jokersUsed = 0;
    
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    if (!state.block || !state.block.gaps) {
        alert("FEHLER: Der geladene Textblock hat keine 'gaps' (Lücken).");
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
        alert("FEHLER: Der geladene Textblock hat keine 'gaps' (Lücken).");
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
        const dp = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
        for(let i=0;i<=a.length;i++) dp[i][0]=i; for(let j=0;j<=b.length;j++) dp[0][j]=j;
        for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
        dp[i][j] = a[i-1]===b[j-1]?dp[i-1][j-1]:Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])+1;
        return dp[a.length][b.length];
    };
    
    const isTypingMistake = solutions.some(s => dist(val, s) <= 1);

    if(isTypingMistake && state.attempts < 1) {
        state.attempts++; flash('warning', 'Typing mistake?'); renderContent();
    } else {
        if(state.jokersUsed < CONFIG.MAX_JOKERS) {
            state.jokersUsed++; gap.status = 'corrected'; 
            flash('warning', `TIP: ${feedbackText || 'False! Try again.'} (Joker used)`);
            state.input = ""; renderContent();
        } else {
            state.lives--; gap.status = 'failed'; renderHUD();
            flash('error', `FALSE! The correct answer is: ${solutions[0].toUpperCase()}`);
            state.input = ""; state.waitingForNext = true; renderContent();
            if (state.lives <= 0) { state.lock = true; setTimeout(handleGameOver, 1500); }
        }
    }
}

function checkQuickie(opt, btnElement) {
    if(state.lock) return;
    const gap = state.block.gaps[state.gapIdx];
    const correctOpt = (Array.isArray(gap.solution) ? gap.solution[0] : gap.solution).toLowerCase().trim();
    
    if(opt.toLowerCase().trim() === correctOpt) {
        state.lock = true; if(!gap.status) gap.status = 'perfect'; handleSuccess();
    } else {
        if(state.jokersUsed < CONFIG.MAX_JOKERS) {
            state.jokersUsed++; gap.status = 'corrected';
            flash('warning', `TIP: ${gap.explanation || 'False!'} (Joker used)`);
            btnElement.style.opacity = "0.3";
            btnElement.style.pointerEvents = "none";
        } else {
            state.lives--; gap.status = 'failed'; renderHUD();
            flash('error', `FALSE! The correct answer is: ${correctOpt.toUpperCase()}`);
            state.waitingForNext = true; renderContent(); renderMC(); 
            if (state.lives <= 0) { state.lock = true; setTimeout(handleGameOver, 1500); }
        }
    }
}

function handleSuccess() {
    flash('success', 'CORRECT!');
    setTimeout(() => {
        state.gapIdx++; state.input = ""; state.attempts = 0; state.lock = false;
        document.getElementById('feedback-message').innerText = ""; 
        if(state.gapIdx >= state.block.gaps.length) finish(); 
        else { renderContent(); if(state.mode === 'quickie') renderMC(); }
    }, 1000);
}

function finish() {
    state.sessionWins++;
    if(state.sessionWins < CONFIG.WIN_STREAK) {
        launchFireworks(false); 
        setTimeout(() => {
            if(state.mode === 'ap') {
                state.jokersUsed = 0; state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
                state.block.gaps.forEach(g => g.status = null); state.gapIdx = 0; renderContent();
            } else { initQuickie(); }
        }, 1000); 
        return;
    }
    clearInterval(state.timerInterval);
    if(state.mode === 'quickie') {
        const best = localStorage.getItem('best_quickie');
        if(!best || state.stopwatch < parseInt(best)) localStorage.setItem('best_quickie', state.stopwatch);
    }
    launchFireworks(true);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('result-screen').classList.add('active');
    document.getElementById('res-stats').innerText = state.mode === 'ap' ? `Passage Mastered! (3 Texts)` : `Time: ${state.stopwatch}s (3 Texts)`;
}

function flash(type, msg) {
    const o = document.getElementById('flash-overlay'); const f = document.getElementById('feedback-message');
    let color = type === 'success' ? '#2ecc71' : (type === 'warning' ? '#f39c12' : '#e74c3c');
    o.style.backgroundColor = color; o.style.opacity = "0.3";
    f.innerText = msg; f.style.color = color;
    setTimeout(() => o.style.opacity = "0", 200); 
}

function renderKeyboard() {
    const keys = [['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l',"'"],['DEL','z','x','c','v','b','n','m','GO'],['SPACE']];
    const cont = document.getElementById('keyboard-container'); cont.innerHTML = "";
    keys.forEach(row => {
        const div = document.createElement('div'); div.className = 'kb-row';
        row.forEach(k => {
            const b = document.createElement('button'); b.className = 'key';
            if(k.length > 1) b.classList.add('wide'); if(k === 'SPACE') b.classList.add('space');
            b.innerText = k === 'DEL' ? '⌫' : (k === 'GO' ? 'GO' : (k === 'SPACE' ? ' ' : k));
            b.onmousedown = (e) => {
                e.preventDefault(); if(state.lock) return;
                if(state.waitingForNext) {
                    state.waitingForNext = false; document.getElementById('feedback-message').innerText = "";
                    state.gapIdx++; if(state.gapIdx >= state.block.gaps.length) finish(); else renderContent();
                    return;
                }
                document.getElementById('feedback-message').innerText = "";
                if(k === 'DEL') { state.input = state.input.slice(0,-1); renderContent(); }
                else if(k === 'GO') { checkAP(); }
                else if(k === 'SPACE') { state.input += " "; renderContent(); }
                else { state.input += k; renderContent(); }
            };
            div.appendChild(b);
        });
        cont.appendChild(div);
    });
}

function renderMC() {
    const cont = document.getElementById('mc-container'); cont.innerHTML = "";
    if(state.waitingForNext) {
        const b = document.createElement('button'); b.className = 'mc-btn'; b.innerText = "WEITER ➔";
        b.style.borderColor = "var(--ap-primary)";
        b.onclick = () => {
            state.waitingForNext = false; document.getElementById('feedback-message').innerText = "";
            state.gapIdx++; if(state.gapIdx >= state.block.gaps.length) finish(); else { renderContent(); renderMC(); }
        };
        cont.appendChild(b); return;
    }
    const gap = state.block.gaps[state.gapIdx];
    let options = shuffleArray([...gap.options]); 
    options.forEach(opt => {
        const b = document.createElement('button'); b.className = 'mc-btn'; b.innerText = opt;
        b.onclick = () => checkQuickie(opt, b);
        cont.appendChild(b);
    });
}

function startTimer() {
    clearInterval(state.timerInterval); const tEl = document.getElementById('timer');
    state.timerInterval = setInterval(() => {
        if(document.getElementById('game-screen').classList.contains('active')) {
            state.time--; const m = Math.floor(state.time / 60), s = state.time % 60;
            tEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
            if(state.time < 30) tEl.classList.add('blink');
            if(state.time <= 0) { clearInterval(state.timerInterval); handleGameOver(); }
        }
    }, 1000);
}

function startStopwatch() {
    clearInterval(state.timerInterval); const sEl = document.getElementById('stopwatch-display');
    state.timerInterval = setInterval(() => {
        if(document.getElementById('game-screen').classList.contains('active')) {
            state.stopwatch++; const m = Math.floor(state.stopwatch / 60), s = state.stopwatch % 60;
            sEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        }
    }, 1000);
}

function renderHUD() { document.getElementById('hearts').innerText = "❤️".repeat(state.lives); }

function launchFireworks(big) {
    const c = document.getElementById('fireworks-canvas'), ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    let p = Array.from({length: big ? 400 : 100}, () => ({ x: c.width/2, y: c.height/2, vX: (Math.random()-0.5)*15, vY: (Math.random()-0.5)*15, a: 1, c: `hsl(${Math.random()*360},100%,50%)` }));
    function anim() {
        ctx.clearRect(0,0,c.width,c.height);
        p.forEach((x, i) => {
            x.x += x.vX; x.y += x.vY; x.a -= 0.01;
            ctx.globalAlpha = x.a; ctx.fillStyle = x.c; ctx.beginPath(); ctx.arc(x.x, x.y, 3, 0, 7); ctx.fill();
            if(x.a <= 0) p.splice(i, 1);
        });
        if(p.length > 0) requestAnimationFrame(anim);
    }
    anim();
}
