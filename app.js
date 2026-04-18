const CONFIG = {
    LIVE_URL: "https://raw.githubusercontent.com/reemt-tammeus/Grammar-Grinder/main/data_quickie.json",
    AP_URL: "./data__ap_mode.json",
    AP_TIME: 300,
    MAX_LIVES: 3
};

let state = {
    mode: null, pool: [], block: null, gapIdx: 0,
    lives: 3, time: 300, input: "", 
    attempts: 0, firstTry: true, sessionWins: 0, lock: false
};

window.onload = () => {
    document.getElementById('btn-ap').onclick = () => startApp('ap');
    document.getElementById('btn-quickie').onclick = () => startApp('quickie');
    document.getElementById('btn-menu').onclick = () => location.reload();
};

async function startApp(mode) {
    state.mode = mode;
    document.body.style.backgroundColor = mode === 'ap' ? '#0a0a0a' : '#1a1a1a';
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    const resp = await fetch(mode === 'ap' ? CONFIG.AP_URL : CONFIG.LIVE_URL);
    state.pool = await resp.json();
    
    if(mode === 'ap') initAP(); else initQuickie();
}

function initAP() {
    state.lives = CONFIG.MAX_LIVES;
    state.time = CONFIG.AP_TIME;
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    renderHUD();
    startTimer();
    renderContent();
    renderKeyboard();
}

function initQuickie() {
    state.block = state.pool[Math.floor(Math.random() * state.pool.length)];
    document.getElementById('hearts').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('keyboard-container').style.display = 'none';
    document.getElementById('mc-container').style.display = 'flex';
    renderContent();
    renderMC();
}

function renderContent() {
    const container = document.getElementById('text-display');
    const isMobile = window.innerWidth <= 768;
    container.innerHTML = "";

    // AP-Mode Smartphone-Logik: Nur den aktuellen Satz zeigen
    let textToRender = state.block.text;
    if(state.mode === 'ap' && isMobile) {
        const sentences = state.block.text.split(/(?<=[.!?])\s+/);
        textToRender = sentences.find(s => s.includes(`{${state.block.gaps[state.gapIdx].id}}`)) || state.block.text;
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
                span.innerText = g.solution[0] || g.solution;
                span.classList.add(g.wasCorrected ? 'corrected' : 'correct');
            } else if (gIdx === state.gapIdx) {
                span.innerText = state.input || "____";
                span.classList.add('active');
                document.getElementById('feedback-message').innerText = state.mode === 'ap' ? `Base: ${g.base_word.toUpperCase()}` : "";
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
    const val = state.input.toLowerCase().trim();
    const sols = (Array.isArray(gap.solution) ? gap.solution : [gap.solution]).map(s => s.toLowerCase().trim());

    if(sols.includes(val)) {
        handleSuccess();
    } else {
        // 1. Grammatik/Feedback Check
        const feedback = gap.specific_feedback ? (gap.specific_feedback[val] || Object.values(gap.specific_feedback)[0]) : "False!";
        
        // 2. Levenshtein Check (Tippfehler)
        const isTyping = sols.some(s => {
            const dist = (a, b) => {
                const dp = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
                for(let i=0;i<=a.length;i++) dp[i][0]=i; for(let j=0;j<=b.length;j++) dp[0][j]=j;
                for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
                dp[i][j] = a[i-1]===b[j-1]?dp[i-1][j-1]:Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])+1;
                return dp[a.length][b.length];
            };
            return dist(val, s) <= 2;
        });

        if(isTyping && state.attempts < 1) {
            state.attempts++;
            flash('warning', 'Typing mistake?');
            setTimeout(() => { state.lock = false; renderContent(); }, 1000);
        } else {
            state.lives--;
            state.firstTry = false;
            state.attempts = 0;
            renderHUD();
            flash('error', feedback);
            setTimeout(() => { state.lock = false; state.input = ""; renderContent(); }, 1500);
        }
    }
}

function handleSuccess() {
    flash('success', 'Correct!');
    state.block.gaps[state.gapIdx].wasCorrected = !state.firstTry;
    setTimeout(() => {
        state.gapIdx++;
        state.input = "";
        state.attempts = 0;
        state.firstTry = true;
        state.lock = false;
        if(state.gapIdx >= state.block.gaps.length) finish(); else renderContent();
    }, 1200);
}

function finish() {
    state.sessionWins++;
    launchFireworks(state.sessionWins >= 5);
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('result-screen').classList.add('active');
    document.getElementById('res-stats').innerText = `Session: ${state.sessionWins} texts completed.`;
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
            b.innerText = k === 'DEL' ? '⌫' : (k === 'GO' ? 'GO' : k);
            b.onclick = () => {
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

function startTimer() {
    const tEl = document.getElementById('timer');
    const iv = setInterval(() => {
        state.time--;
        const m = Math.floor(state.time / 60), s = state.time % 60;
        tEl.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        if(state.time < 30) tEl.classList.add('blink');
        if(state.time <= 0 || state.lives <= 0) { clearInterval(iv); location.reload(); }
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
