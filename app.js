// GrammarGrinder - bereinigte Version
// WICHTIG:
// 1) Diese Datei als app.js speichern
// 2) Die HTML-Datei für GitHub Pages in index.html umbenennen
// 3) data_quickie.json und data__ap_mode.json im selben Ordner lassen

const CONFIG = {
    primaryDataUrl: "./data_quickie.json",
    fallbackDataUrl: "./data__ap_mode.json",
    shuffleBlocks: false,
    passagePauseMs: 1400,
    correctPauseMs: 900,
    wrongPauseMs: 3200
};

const state = {
    pool: [],
    currentBlockIndex: 0,
    currentGapIndex: 0,
    currentInput: "",
    lock: false
};

function $(id) {
    return document.getElementById(id);
}

function setDisplayStyle() {
    const display = $("task-display");
    display.style.textAlign = "left";
    display.style.fontSize = "1.1rem";
    display.style.alignItems = "flex-start";
    display.style.lineHeight = "1.5";
}

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${url}`);
    }
    return response.json();
}

function isValidPool(data) {
    return Array.isArray(data) && data.length > 0;
}

async function loadData() {
    const display = $("task-display");

    try {
        display.textContent = "Loading quickie data...";
        let data = await fetchJson(CONFIG.primaryDataUrl);

        if (!isValidPool(data)) {
            throw new Error("Primary JSON is empty or invalid.");
        }

        return CONFIG.shuffleBlocks ? shuffleArray(data) : data;
    } catch (primaryError) {
        console.warn("Primary data load failed:", primaryError);

        try {
            display.textContent = "Quickie data unavailable. Loading fallback data...";
            let data = await fetchJson(CONFIG.fallbackDataUrl);

            if (!isValidPool(data)) {
                throw new Error("Fallback JSON is empty or invalid.");
            }

            return CONFIG.shuffleBlocks ? shuffleArray(data) : data;
        } catch (fallbackError) {
            console.error("Fallback data load failed:", fallbackError);
            throw new Error("No usable data source could be loaded.");
        }
    }
}

function normalize(text) {
    return String(text)
        .toLowerCase()
        .replace(/['´`’]/g, "'")
        .replace(/n't\b/g, " not")
        .replace(/'m\b/g, " am")
        .replace(/'re\b/g, " are")
        .replace(/'ll\b/g, " will")
        .replace(/'ve\b/g, " have")
        // bewusst KEIN pauschales "'d" => "would"
        .trim()
        .replace(/\s+/g, " ");
}

function getSolutions(gap) {
    if (!gap || gap.solution == null) return [];

    if (Array.isArray(gap.solution)) {
        return gap.solution.map(s => String(s).trim()).filter(Boolean);
    }

    if (typeof gap.solution === "string") {
        return gap.solution
            .split("/")
            .map(s => s.trim())
            .filter(Boolean);
    }

    return [String(gap.solution).trim()].filter(Boolean);
}

function getMainSolution(gap) {
    const solutions = getSolutions(gap);
    return solutions[0] || "";
}

function getNormalizedSolutions(gap) {
    return getSolutions(gap).map(normalize);
}

function updateInputDisplay() {
    $("task-input").value = state.currentInput;
}

function triggerFlash(isSuccess) {
    const overlay = $("flash-overlay");
    overlay.className = isSuccess ? "flash-success" : "flash-error";
    setTimeout(() => {
        overlay.className = "";
    }, 300);
}

function showResultScreen() {
    $("main-game").classList.add("hidden");
    $("result-screen").classList.remove("hidden");
}

function renderCurrentTask() {
    const block = state.pool[state.currentBlockIndex];
    const gap = block.gaps[state.currentGapIndex];

    state.currentInput = "";
    state.lock = false;
    updateInputDisplay();

    let displayText = block.text;

    block.gaps.forEach((g, index) => {
        const placeholder = `{${g.id}}`;

        if (index < state.currentGapIndex) {
            const solvedText = getMainSolution(g).toUpperCase();
            displayText = displayText.replace(placeholder, solvedText);
        } else if (index === state.currentGapIndex) {
            displayText = displayText.replace(placeholder, "[ ___ ]");
        } else {
            displayText = displayText.replace(placeholder, "...");
        }
    });

    $("task-display").textContent = displayText;
    $("feedback-hint").textContent = `Base word: ${gap.base_word ?? "-"}`;
    $("feedback-hint").style.color = "var(--primary)";
}

function nextTask() {
    if (state.currentBlockIndex >= state.pool.length) {
        showResultScreen();
        return;
    }

    const block = state.pool[state.currentBlockIndex];

    if (!block || !Array.isArray(block.gaps) || block.gaps.length === 0) {
        console.warn("Invalid block skipped:", block);
        state.currentBlockIndex++;
        state.currentGapIndex = 0;
        nextTask();
        return;
    }

    if (state.currentGapIndex >= block.gaps.length) {
        state.currentBlockIndex++;
        state.currentGapIndex = 0;
        state.lock = true;

        $("task-display").textContent = "Excellent! Loading next passage...";
        $("feedback-hint").textContent = "";

        setTimeout(() => {
            state.lock = false;
            nextTask();
        }, CONFIG.passagePauseMs);

        return;
    }

    renderCurrentTask();
}

function getFeedbackMessage(gap, rawInput, normalizedInput) {
    if (gap.specific_feedback) {
        if (gap.specific_feedback[rawInput]) {
            return gap.specific_feedback[rawInput];
        }
        if (gap.specific_feedback[normalizedInput]) {
            return gap.specific_feedback[normalizedInput];
        }
    }

    if (gap.explanation) {
        return gap.explanation;
    }

    return "Wrong answer.";
}

function checkAnswer() {
    if (state.lock) return;
    if (state.currentInput.trim() === "") return;

    state.lock = true;

    const block = state.pool[state.currentBlockIndex];
    const gap = block.gaps[state.currentGapIndex];

    const rawInput = state.currentInput.trim();
    const normalizedInput = normalize(rawInput);
    const validOptions = getNormalizedSolutions(gap);
    const mainSolution = getMainSolution(gap);

    if (validOptions.includes(normalizedInput)) {
        triggerFlash(true);
        $("feedback-hint").textContent = "✓ Correct!";
        $("feedback-hint").style.color = "var(--success)";

        state.currentGapIndex++;

        setTimeout(() => {
            nextTask();
        }, CONFIG.correctPauseMs);

        return;
    }

    triggerFlash(false);

    const feedback = getFeedbackMessage(gap, rawInput, normalizedInput);
    $("feedback-hint").textContent = `✗ ${feedback} (Solution: ${mainSolution})`;
    $("feedback-hint").style.color = "var(--danger)";

    state.currentGapIndex++;

    setTimeout(() => {
        nextTask();
    }, CONFIG.wrongPauseMs);
}

function handleKeyPress(key) {
    if (state.lock) return;

    if (key === "DEL") {
        state.currentInput = state.currentInput.slice(0, -1);
    } else if (key === "ENT") {
        checkAnswer();
        return;
    } else if (key === "SPACE") {
        state.currentInput += " ";
    } else {
        state.currentInput += key;
    }

    updateInputDisplay();
}

function renderKeyboard() {
    const layout = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "'"],
        ["DEL", "z", "x", "c", "v", "b", "n", "m", "ENT"],
        ["SPACE"]
    ];

    const kbContainer = $("app-keyboard");
    kbContainer.innerHTML = "";

    layout.forEach(row => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "keyboard-row";

        row.forEach(key => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "key";

            if (key === "DEL" || key === "ENT") btn.classList.add("action");
            if (key === "ENT") btn.classList.add("enter");
            if (key === "SPACE") btn.classList.add("space");

            if (key === "SPACE") {
                btn.textContent = "SPACE";
            } else if (key === "DEL") {
                btn.textContent = "⌫";
            } else if (key === "ENT") {
                btn.textContent = "GO";
            } else {
                btn.textContent = key;
            }

            btn.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                handleKeyPress(key);
            });

            rowDiv.appendChild(btn);
        });

        kbContainer.appendChild(rowDiv);
    });
}

async function init() {
    renderKeyboard();
    setDisplayStyle();

    try {
        state.pool = await loadData();
        nextTask();
    } catch (error) {
        console.error("Critical startup error:", error);
        $("task-display").textContent = "Kritischer Fehler: Keine Daten verfügbar.";
        $("task-display").style.color = "var(--danger)";
        $("feedback-hint").textContent = "";
    }
}

document.addEventListener("DOMContentLoaded", init);
