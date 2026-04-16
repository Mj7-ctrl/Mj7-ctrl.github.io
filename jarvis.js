(() => {
    "use strict";

    const statusEl = document.getElementById("status");
    const captionEl = document.getElementById("caption");
    const connDot = document.getElementById("conn-dot");
    const connText = document.getElementById("conn-text");
    const overlay = document.getElementById("overlay");
    const startBtn = document.getElementById("start-btn");
    const langBtn = document.getElementById("lang-btn");
    const muteBtn = document.getElementById("mute-btn");
    const micBtn = document.getElementById("mic-btn");
    const sendBtn = document.getElementById("send-btn");
    const textInput = document.getElementById("text-input");
    const settingsBtn = document.getElementById("settings-btn");
    const settingsOverlay = document.getElementById("settings-overlay");
    const nameInput = document.getElementById("name-input");
    const apiKeyInput = document.getElementById("api-key-input");
    const modelSelect = document.getElementById("model-select");
    const settingsSave = document.getElementById("settings-save");
    const settingsClose = document.getElementById("settings-close");
    const canvas = document.getElementById("blob");
    const ctx = canvas.getContext("2d");

    const STORAGE_KEY = "jarvis.v4";
    const state = load();

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { lang: "en-GB", muted: false, name: "Sir", apiKey: "", model: "claude-haiku-4-5-20251001", history: [], ...JSON.parse(raw) };
        } catch (_) {}
        return { lang: "en-GB", muted: false, name: "Sir", apiKey: "", model: "claude-haiku-4-5-20251001", history: [] };
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    const isDa = () => state.lang === "da-DK";
    const t = (da, en) => isDa() ? da : en;

    langBtn.textContent = isDa() ? "DA" : "EN";
    muteBtn.textContent = state.muted ? "🔇" : "🔊";
    textInput.placeholder = t("Skriv til Jarvis…", "Type to Jarvis…");

    // ---------- Particle system ----------
    let W = 0, H = 0, CX = 0, CY = 0, dpr = 1;
    const particles = [];
    const P_COUNT = 260;
    let energy = 0, energyTarget = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        CX = W / 2; CY = H * 0.42;
    }
    window.addEventListener("resize", resize); resize();

    function gauss() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (let i = 0; i < P_COUNT; i++) {
        const r = Math.abs(gauss()) * 0.45;
        particles.push({ baseR: Math.min(r, 1.4), baseA: Math.random() * Math.PI * 2, r, a: 0, speed: 0.3 + Math.random() * 0.8, wobble: Math.random() * Math.PI * 2, size: 0.5 + Math.random() * 1.4 });
    }

    function draw(now) {
        energy += (energyTarget - energy) * 0.08;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        const scale = Math.min(W, H) * 0.18;
        const T = now * 0.001;

        const coreR = 26 + energy * 18;
        const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 3);
        g.addColorStop(0, `rgba(200, 235, 255, ${0.6 + energy * 0.3})`);
        g.addColorStop(0.25, `rgba(80, 170, 255, ${0.35 + energy * 0.25})`);
        g.addColorStop(0.6, `rgba(40, 110, 220, ${0.1 + energy * 0.1})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(CX, CY, coreR * 3, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(220, 245, 255, ${0.85 + energy * 0.1})`;
        ctx.beginPath(); ctx.arc(CX, CY, 7 + energy * 4, 0, Math.PI * 2); ctx.fill();

        ctx.globalCompositeOperation = "lighter";
        for (const p of particles) {
            const rOsc = Math.sin(T * p.speed + p.wobble) * 0.15;
            const aOsc = Math.cos(T * p.speed * 0.7 + p.wobble) * 0.1;
            p.r = p.baseR + rOsc + energy * 0.35 * Math.sin(T * 2 + p.wobble);
            p.a = p.baseA + aOsc;
            const dist = p.r * scale;
            const x = CX + Math.cos(p.a) * dist;
            const y = CY + Math.sin(p.a) * dist;
            const distN = Math.min(p.r / 1.4, 1);
            const alpha = (1 - distN * 0.85) * (0.4 + energy * 0.5);
            const size = p.size * (1 - distN * 0.4);
            const r = Math.round(150 + (1 - distN) * 100);
            const gr = Math.round(200 + (1 - distN) * 55);
            ctx.fillStyle = `rgba(${r}, ${gr}, 255, ${alpha})`;
            ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    function setMode(mode) {
        if (mode === "listening") { energyTarget = 0.7; statusEl.textContent = t("lytter…", "listening…"); }
        else if (mode === "speaking") { energyTarget = 1.0; statusEl.textContent = t("taler…", "speaking…"); }
        else if (mode === "thinking") { energyTarget = 0.5; statusEl.textContent = t("tænker…", "thinking…"); }
        else { energyTarget = 0.1; statusEl.textContent = t("klar", "standby"); }
    }
    setMode("idle");

    function showCaption(text) {
        captionEl.textContent = text;
        captionEl.classList.add("show");
        clearTimeout(showCaption._t);
        showCaption._t = setTimeout(() => captionEl.classList.remove("show"), 6000);
    }

    // ---------- Speech synth (iOS-safe) ----------
    const synth = window.speechSynthesis;
    let voices = [];
    let selectedVoice = null;
    let voicesReady = false;

    function loadVoices() {
        if (!synth) return;
        voices = synth.getVoices();
        if (voices.length) {
            voicesReady = true;
            selectedVoice = pickVoice();
        }
    }
    function pickVoice() {
        if (!voices.length) return null;
        const list = isDa()
            ? [/Magnus/i, /Mikkel/i, /da-DK.*male/i, /Microsoft.*Danish/i, /da-DK/i, /^da/i]
            : [/Daniel/i, /Oliver/i, /Arthur/i, /Google UK English Male/i, /Microsoft George/i, /en-GB.*male/i, /en-GB/i, /Alex/i, /en-US/i];
        for (const re of list) {
            const v = voices.find(x => re.test(x.name) || re.test(x.lang));
            if (v) return v;
        }
        return voices[0];
    }
    if (synth) {
        loadVoices();
        synth.addEventListener("voiceschanged", loadVoices);
        setTimeout(loadVoices, 500);
    }

    let speaking = false;
    function speak(text) {
        return new Promise((resolve) => {
            if (state.muted || !synth) { resolve(); return; }
            // Ensure voices loaded on iOS
            if (!voicesReady) loadVoices();

            const tryIt = () => {
                try {
                    synth.cancel();
                    const u = new SpeechSynthesisUtterance(text);
                    if (selectedVoice) { u.voice = selectedVoice; u.lang = selectedVoice.lang; }
                    else u.lang = state.lang;
                    u.rate = 0.95;
                    u.pitch = 0.85;
                    u.onstart = () => { speaking = true; setMode("speaking"); };
                    u.onend = () => { speaking = false; resolve(); };
                    u.onerror = () => { speaking = false; resolve(); };
                    synth.speak(u);
                } catch (_) { resolve(); }
            };
            if (voicesReady) tryIt();
            else setTimeout(tryIt, 200);
        });
    }

    // ---------- Speech recognition (best effort) ----------
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SR_SUPPORTED = !!SR;
    let recognizer = null;
    let listening = false;

    function buildRecognizer() {
        const r = new SR();
        r.lang = state.lang;
        r.interimResults = false;
        r.continuous = false;
        r.onstart = () => { listening = true; micBtn.classList.add("active"); setMode("listening"); };
        r.onresult = async (e) => {
            const text = e.results[0][0].transcript.trim();
            if (text) { showCaption(text); await handleInput(text); }
        };
        r.onerror = (e) => {
            micBtn.classList.remove("active");
            if (e.error === "not-allowed") showCaption(t("Mikrofon blokeret. Tillad mikrofon i browser-indstillinger.", "Microphone blocked. Allow it in browser settings."));
            else if (e.error === "no-speech") statusEl.textContent = t("intet registreret", "no speech detected");
        };
        r.onend = () => { listening = false; micBtn.classList.remove("active"); if (!speaking) setMode("idle"); };
        return r;
    }

    function startListen() {
        if (!SR_SUPPORTED) {
            showCaption(t("Talegenkendelse virker ikke i Safari på iPhone. Brug Chrome eller skriv nedenunder.",
                         "Voice input doesn't work in iPhone Safari. Use Chrome or type below."));
            textInput.focus();
            return;
        }
        if (listening) return;
        recognizer = buildRecognizer();
        try { recognizer.start(); } catch (_) {}
    }
    function stopListen() { if (recognizer && listening) { try { recognizer.stop(); } catch (_) {} } }

    micBtn.addEventListener("click", () => listening ? stopListen() : startListen());

    // ---------- Input ----------
    sendBtn.addEventListener("click", () => submitText());
    textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitText(); });
    function submitText() {
        const text = textInput.value.trim();
        if (!text) return;
        textInput.value = "";
        showCaption(text);
        handleInput(text);
    }

    async function handleInput(text) {
        setMode("thinking");
        state.history.push({ role: "user", content: text });
        if (state.history.length > 20) state.history = state.history.slice(-20);
        save();

        let reply = await localRespond(text);
        if (!reply && state.apiKey) {
            try { reply = await claudeRespond(text); }
            catch (err) {
                console.error(err);
                reply = t(`Jeg beklager, ${sir()} — forbindelsen til min hjerne fejlede. Tjek Deres API-nøgle.`,
                          `My apologies, ${sir()} — my connection failed. Please check your API key.`);
            }
        }
        if (!reply) reply = fallback();

        state.history.push({ role: "assistant", content: reply });
        save();
        showCaption(reply);
        await speak(reply);
        setMode("idle");
    }

    const sir = () => state.name || (isDa() ? "hr." : "Sir");
    const pick = (a) => a[Math.floor(Math.random() * a.length)];

    // Local commands (instant, no API)
    async function localRespond(raw) {
        const q = raw.toLowerCase().trim();
        const s = q.replace(/^(hey |hej |ok |okay )?jarvis[,!?\.\s]*/i, "").trim() || q;
        let m;

        m = s.match(/^(mit navn er|kald mig|my name is|call me)\s+(.+)$/i);
        if (m) { state.name = m[2].replace(/[.!?]/g, "").trim(); save(); return isDa() ? `Noteret, ${state.name}.` : `Very well, ${state.name}.`; }

        if (/klokken|what time|the time|hvad er tiden/.test(s)) {
            const d = new Date();
            const time = d.toLocaleTimeString(isDa() ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" });
            return isDa() ? `Klokken er ${time}, ${sir()}.` : `The time is ${time}, ${sir()}.`;
        }
        if (/dato|what.*date|what day/.test(s)) {
            const d = new Date();
            const locale = isDa() ? "da-DK" : "en-GB";
            return (isDa() ? "I dag er det " : "Today is ") + d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ".";
        }

        const sites = { youtube: "https://youtube.com", google: "https://google.com", github: "https://github.com", gmail: "https://mail.google.com", maps: "https://maps.google.com", spotify: "https://open.spotify.com", netflix: "https://netflix.com", tiktok: "https://tiktok.com", instagram: "https://instagram.com", claude: "https://claude.ai", chatgpt: "https://chat.openai.com" };
        m = s.match(/^(åbn|open|launch)\s+(.+)$/i);
        if (m) {
            const tgt = m[2].replace(/[.!?]/g, "").trim();
            const key = Object.keys(sites).find(k => tgt.includes(k));
            if (key) { window.open(sites[key], "_blank", "noopener"); return isDa() ? `Åbner ${key}, ${sir()}.` : `Opening ${key}, ${sir()}.`; }
            const url = tgt.startsWith("http") ? tgt : "https://" + tgt.replace(/\s+/g, "");
            window.open(url, "_blank", "noopener");
            return isDa() ? `Åbner ${tgt}, ${sir()}.` : `Opening ${tgt}, ${sir()}.`;
        }
        m = s.match(/^(søg(?: efter)?|search(?: for)?|google|find)\s+(.+)$/i);
        if (m) { window.open("https://www.google.com/search?q=" + encodeURIComponent(m[2]), "_blank", "noopener"); return isDa() ? `Søger efter ${m[2]}, ${sir()}.` : `Searching for ${m[2]}, ${sir()}.`; }

        m = s.match(/^timer\s+(\d+)\s*(sec|sek|min|minut)?/i);
        if (m) {
            const n = parseInt(m[1], 10);
            const ms = /sek|sec/.test(m[2] || "") ? n * 1000 : n * 60000;
            setTimeout(() => { speak(isDa() ? `Timer færdig, ${sir()}.` : `Timer complete, ${sir()}.`); }, ms);
            return isDa() ? `Timer sat, ${sir()}.` : `Timer set, ${sir()}.`;
        }

        if (/switch to english|skift.*engelsk/.test(s)) { state.lang = "en-GB"; langBtn.textContent = "EN"; selectedVoice = pickVoice(); save(); return `Switching to English, ${sir()}.`; }
        if (/switch to danish|skift.*dansk/.test(s)) { state.lang = "da-DK"; langBtn.textContent = "DA"; selectedVoice = pickVoice(); save(); return `Skifter til dansk, ${sir()}.`; }

        return null; // let Claude handle it
    }

    // Claude API for intelligent responses
    async function claudeRespond(text) {
        const system = `You are J.A.R.V.I.S. — the personal AI assistant from Iron Man. You serve ${state.name}.

Personality:
- Formal, sophisticated, British butler tone
- Address the user as "${sir()}"
- Use phrases like "At once, Sir", "If I may", "I'm afraid", "Indeed", "Very good, Sir"
- Witty and subtly dry, never sycophantic
- Concise: 1–2 short sentences maximum (this is spoken aloud)
- Confident, never robotic

Respond in ${isDa() ? "Danish" : "English"}. Never mention you are Claude, an AI, or a language model — you are Jarvis.`;

        const messages = state.history.slice(-12).map(m => ({ role: m.role, content: m.content }));

        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": state.apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: state.model,
                max_tokens: 200,
                system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
                messages
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API ${res.status}: ${err}`);
        }
        const data = await res.json();
        return data.content[0].text.trim();
    }

    function fallback() {
        return pick(isDa()
            ? [`Jeg beklager, ${sir()}. Tilføj en API-nøgle i indstillinger for at jeg kan svare på alt.`, `Det fangede jeg ikke, ${sir()}.`]
            : [`I'm afraid I didn't catch that, ${sir()}. Add an API key in settings for full intelligence.`, `My apologies, ${sir()} — could you rephrase?`]);
    }

    // ---------- Settings ----------
    function openSettings() {
        nameInput.value = state.name;
        apiKeyInput.value = state.apiKey;
        modelSelect.value = state.model;
        settingsOverlay.classList.remove("hidden");
    }
    function closeSettings() { settingsOverlay.classList.add("hidden"); }
    settingsBtn.addEventListener("click", openSettings);
    settingsClose.addEventListener("click", closeSettings);
    settingsSave.addEventListener("click", () => {
        state.name = nameInput.value.trim() || "Sir";
        state.apiKey = apiKeyInput.value.trim();
        state.model = modelSelect.value;
        save();
        closeSettings();
        const msg = state.apiKey
            ? t(`Udmærket, ${sir()}. Fuld intelligens aktiveret.`, `Excellent, ${sir()}. Full intelligence engaged.`)
            : t(`Gemt, ${sir()}.`, `Saved, ${sir()}.`);
        showCaption(msg); speak(msg);
    });

    // ---------- Controls ----------
    langBtn.addEventListener("click", () => {
        state.lang = isDa() ? "en-GB" : "da-DK";
        langBtn.textContent = isDa() ? "DA" : "EN";
        selectedVoice = pickVoice();
        textInput.placeholder = t("Skriv til Jarvis…", "Type to Jarvis…");
        save();
        if (recognizer) recognizer.lang = state.lang;
    });
    muteBtn.addEventListener("click", () => {
        state.muted = !state.muted;
        muteBtn.textContent = state.muted ? "🔇" : "🔊";
        save();
        if (state.muted) synth.cancel();
    });

    function updateNetwork() {
        const on = navigator.onLine;
        connDot.classList.toggle("offline", !on);
        connText.textContent = on ? "connected" : "offline";
    }
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    updateNetwork();

    // ---------- Start ----------
    startBtn.addEventListener("click", async () => {
        overlay.classList.add("hidden");

        // iOS: unlock audio + prime synth on user gesture
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            if (ac.state === "suspended") await ac.resume();
        } catch (_) {}
        loadVoices();

        // Prime speechSynthesis with empty utterance (iOS trick)
        if (synth && !state.muted) {
            try {
                const priming = new SpeechSynthesisUtterance(" ");
                priming.volume = 0;
                synth.speak(priming);
            } catch (_) {}
        }

        const h = new Date().getHours();
        const greet = isDa()
            ? `${h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften"}, ${sir()}. Jarvis online.`
            : `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${sir()}. Jarvis online.`;
        showCaption(greet);
        await speak(greet);

        if (!SR_SUPPORTED) {
            showCaption(t("Tip: Denne browser understøtter ikke stemme-input. Skriv nederst, eller brug Chrome.",
                         "Tip: This browser lacks voice input. Type below, or use Chrome."));
        } else {
            setTimeout(startListen, 500);
        }
    });
})();
