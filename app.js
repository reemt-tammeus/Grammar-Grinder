const CONFIG = {
    LIVE_URL: "https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json",
    AP_URL: "./data__ap_mode.json",
    AP_TIME: 300,
    MAX_LIVES: 3
};

let state = {
    mode: null, pool: [], block: null, gapIdx: 0,
    lives: 3, time: 300, input: "", 
    attempts: 0, firstTry: true, sessionWins: 0, lock: false,
    stopwatch: 0, timerInterval: null
};

window.onload = () => {
    document.getElementById('btn-ap').onclick = () => startApp('ap');
    document.getElementById('btn-quickie').onclick = () => startApp('quickie');
    document.getElementById('btn-goto-menu').onclick = () => location.reload();
};

async function startApp(mode) {
    state.mode = mode;
    document.body.className = mode === 'ap' ? 'ap-mode' : 'q-mode';
    if(mode === 'quickie') {
        document.body.style.background = "linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url('logo.jpg') center / cover";
    }
    
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    try {
        const resp = await fetch(mode === 'ap' ? CONFIG.AP_URL : CONFIG.LIVE_URL);
        state.pool = await resp.json();
    } catch(e) {
        console.error("Datenfehler: ", e);
    }
    
    if(mode === 'ap') initAP(); else initQuickie();
}

function initAP() {
    state.lives = CONFIG.MAX_LIVES;
    state.time = CONFIG.AP_TIME;
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    state.gapIdx = 0;
    
    document.getElementById('ap-hud-elements').style.display = 'flex';
    document.getElementById('keyboard-container').style.display = 'flex';
    
    renderHUD();
    startTimer();
    renderContent();
    renderKeyboard();
}

function initQuickie() {
    if(state.sessionWins === 0) {
        state.stopwatch = 0;
        startStopwatch();
        const best = localStorage.getItem('best_quickie');
        document.getElementById('best-time-display').innerText = best ? `Best: ${best}s` : "Best: --:--";
    }
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    state.gapIdx = 0;
    
    document.getElementById('q-hud-elements').style.display = 'flex';
    document.getElementById('mc-container').style.display = 'flex';
    
    renderContent();
    renderMC();
}

function renderContent() {
    const container = document.getElementById('text-display');
    const badge = document.getElementById('base-word-badge');
    const feedback = document.getElementById('feedback-message');
    feedback.innerText = ""; // Clear old feedback
    
    const isMobile = window.innerWidth <= 768;
    container.innerHTML = "";

    let textToRender = state.block.text;

    // DIE SCHLAUE LOGIK: Mobile zeigt Vorherigen + Aktuellen Satz
    if(isMobile) {
        const sentences = state.block.text.match(/[^.!?]+[.!?]*\s*/g) || [state.block.text];
        const currentGapId = state.block.gaps[state.gapIdx].id;
        const currIdx = sentences.findIndex(s => s.includes(`{${currentGapId}}`));
        
        if(currIdx !== -1) {
            textToRender = (currIdx > 0 ? sentences[currIdx - 1] : "") + sentences[currIdx];
        }
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
                span.innerText = (Array.isArray(g.solution) ? g.solution[0] : g.solution).toUpperCase();
                span.classList.add(g.wasCorrected ? 'corrected' : 'correct');
            } else if (gIdx === state.gapIdx) {
                span.innerText = state.input || "____";
                span.classList.add('active');
                
                // Basiswort in das Badge pushen
                if(state.mode === 'ap' && g.base_word) {
                    badge.style.display = 'inline-block';
                    badge.innerText = g.base_word.toUpperCase();
                } else {
                    badge.style.display = 'none';
                }
                
                setTimeout(() => span.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            } else {
                span.innerText = "....";
            }
            container.appendChild(span);
        } else {
            container.appendChild(document.createTextNode(p));
        }
    });
    document.getElementById('progress-bar').style.width = `${(state.gapIdx / state.block.gaps.length) * 100}%`;
}

function checkAP() {
    if(state.lock || !state.input) return;
    state.lock = true;
    const gap = state.block.gaps[state.gapIdx];
    
    let val = state.input.toLowerCase().trim();
    val = val.replace(/[’´`‘]/g, "'"); // iOS Apostroph Fix
    
    const solutions = (Array.isArray(gap.solution) ? gap.solution : [gap.solution]).map(s => s.toLowerCase().trim().replace(/[’´`‘]/g, "'"));

    if(solutions.includes(val)) {
        handleSuccess();
    } else {
        const feedback = gap.specific_feedback ? (gap.specific_feedback[val] || Object.values(gap.specific_feedback)[0]) : null;
        
        const dist = (a, b) => {
            const dp = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
            for(let i=0;i<=a.length;i++) dp[i][0]=i; for(let j=0;j<=b.length;j++) dp[0][j]=j;
            for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
            dp[i][j] = a[i-1]===b[j-1]?dp[i-1][j-1]:Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])+1;
            return dp[a.length][b.length];
        };
        const isTypingMistake = solutions.some(s => dist(val, s) <= 2);

        if(feedback && !isTypingMistake) {
            state.lives--; state.firstTry = false; gap.wasCorrected = true;
            renderHUD();
            flash('error', `TIP: ${feedback}`);
            setTimeout(() => { state.lock = false; state.input = ""; renderContent(); }, 1500);
        } else if(isTypingMistake && state.attempts < 1) {
            state.attempts++;
            flash('warning', 'Typing mistake?');
            setTimeout(() => { state.lock = false; renderContent(); }, 1000);
        } else {
            state.lives--; state.firstTry = false; gap.wasCorrected = true;
            renderHUD();
            flash('error', 'FALSE!');
            setTimeout(() => { state.lock = false; state.input = ""; renderContent(); }, 1500);
        }
    }
}

function checkQuickie(opt) {
    if(state.lock) return;
    state.lock = true;
    const gap = state.block.gaps[state.gapIdx];
    
    if(opt.toLowerCase().trim() === (Array.isArray(gap.solution) ? gap.solution[0] : gap.solution).toLowerCase().trim()) {
        handleSuccess();
    } else {
        flash('error', gap.explanation || 'False!');
        setTimeout(() => {
            state.gapIdx++;
            state.lock = false;
            if(state.gapIdx >= state.block.gaps.length) finish(); else { renderContent(); renderMC(); }
        }, 1500);
    }
}

function handleSuccess() {
    flash('success', 'CORRECT!');
    const gap = state.block.gaps[state.gapIdx];
    if(!state.firstTry) gap.wasCorrected = true;
    
    setTimeout(() => {
        state.gapIdx++;
        state.input = "";
        state.attempts = 0;
        state.firstTry = true;
        state.lock = false;
        if(state.gapIdx >= state.block.gaps.length) finish(); 
        else { renderContent(); if(state.mode === 'quickie') renderMC(); }
    }, 1000);
}

function finish() {
    state.sessionWins++;
    
    if(state.mode === 'quickie' && state.sessionWins < 5) {
        launchFireworks(false);
        setTimeout(() => initQuickie(), 1000); // Direkt weiter
        return;
    }

    clearInterval(state.timerInterval);
    if(state.mode === 'quickie') {
        const best = localStorage.getItem('best_quickie');
        if(!best || state.stopwatch < parseInt(best)) localStorage.setItem('best_quickie', state.stopwatch);
    }

    launchFireworks(true);
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('result-screen').classList.add('active');
    
    let msg = state.mode === 'ap' ? "Passage Mastered!" : `Time: ${state.stopwatch}s (5 Texts)`;
    document.getElementById('res-stats').innerText = msg;
}

function flash(type, msg) {
    const o = document.getElementById('flash-overlay');
    const f = document.getElementById('feedback-message');
    o.style.backgroundColor = type === 'success' ? '#2ecc71' : (type === 'warning' ? '#f39c12' : '#e74c3c');
    o.style.opacity = "0.3";
    f.innerText = msg;
    f.style.color = o.style.backgroundColor;
    setTimeout(() => o.style.opacity = "0", 200);
}

function renderKeyboard() {
    const keys = [['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l',"'"],['DEL','z','x','c','v','b','n','m','GO'],['SPACE']];
    const cont = document.getElementById('keyboard-container');
    cont.innerHTML = "";
    keys.forEach(row => {
        const div = document.createElement('div'); div.className = 'kb-row';
        row.forEach(k => {
            const b = document.createElement('button'); b.className = 'key';
            if(k.length > 1) b.classList.add('wide');
            if(k === 'SPACE') b.classList.add('space');
            b.innerText = k === 'DEL' ? '⌫' : (k === 'GO' ? 'GO' : (k === 'SPACE' ? ' ' : k));
            b.onmousedown = (e) => {
                e.preventDefault();
                if(k === 'DEL') state.input = state.input.slice(0,-1);
                else if(k === 'GO') checkAP();
                else if(k === 'SPACE') state.input += " ";
                else state.input += k;
                renderContent();
            };
            div.appendChild(b);
        });
        cont.appendChild(div);
    });
}

function renderMC() {
    const cont = document.getElementById('mc-container');
    cont.innerHTML = "";
    const gap = state.block.gaps[state.gapIdx];
    gap.options.forEach(opt => {
        const b = document.createElement('button');
        b.className = 'mc-btn';
        b.innerText = opt;
        b.onclick = () => checkQuickie(opt);
        cont.appendChild(b);
    });
}

function startTimer() {
    clearInterval(state.timerInterval);
    const tEl = document.getElementById('timer');
    state.timerInterval = setInterval(() => {
        if(document.getElementById('game-screen').classList.contains('active')) {
            state.time--;
            const m = Math.floor(state.time / 60), s = state.time % 60;
            tEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
            if(state.time < 30) tEl.classList.add('blink');
            if(state.time <= 0 || state.lives <= 0) { clearInterval(state.timerInterval); location.reload(); }
        }
    }, 1000);
}

function startStopwatch() {
    clearInterval(state.timerInterval);
    const sEl = document.getElementById('stopwatch-display');
    state.timerInterval = setInterval(() => {
        if(document.getElementById('game-screen').classList.contains('active')) {
            state.stopwatch++;
            const m = Math.floor(state.stopwatch / 60), s = state.stopwatch % 60;
            sEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        }
    }, 1000);
}

function renderHUD() { document.getElementById('hearts').innerText = "❤️".repeat(state.lives); }

function launchFireworks(big) {
    const c = document.getElementById('fireworks-canvas'), ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    let p = Array.from({length: big ? 400 : 100}, () => ({
        x: c.width/2, y: c.height/2, vX: (Math.random()-0.5)*15, vY: (Math.random()-0.5)*15,
        a: 1, c: `hsl(${Math.random()*360},100%,50%)`
    }));
    function anim() {
        ctx.clearRect(0,0,c.width,c.height);
        p.forEach((x, i) => {
            x.x += x.vX; x.y += x.vY; x.a -= 0.01;
            ctx.globalAlpha = x.a; ctx.fillStyle = x.c;
            ctx.beginPath(); ctx.arc(x.x, x.y, 3, 0, 7); ctx.fill();
            if(x.a <= 0) p.splice(i, 1);
        });
        if(p.length > 0) requestAnimationFrame(anim);
    }
    anim();
}
