(() => {
    "use strict";

    const statusEl = document.getElementById("status");
    const clockEl = document.getElementById("clock");
    const connDot = document.getElementById("conn-dot");
    const connText = document.getElementById("conn-text");
    const overlay = document.getElementById("overlay");
    const startBtn = document.getElementById("start-btn");
    const langBtn = document.getElementById("lang-btn");
    const muteBtn = document.getElementById("mute-btn");
    const canvas = document.getElementById("blob");
    const ctx = canvas.getContext("2d");

    const STORAGE_KEY = "jarvis.voice.v1";
    const state = loadState();

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { lang: "en-GB", muted: false, name: "Sir", notes: [], reminders: [], ...JSON.parse(raw) };
        } catch (_) {}
        return { lang: "en-GB", muted: false, name: "Sir", notes: [], reminders: [] };
    }
    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    const isDa = () => state.lang === "da-DK";
    const t = (da, en) => isDa() ? da : en;

    langBtn.textContent = isDa() ? "DA" : "EN";
    muteBtn.textContent = state.muted ? "🔇" : "🔊";
    muteBtn.classList.toggle("muted", state.muted);

    // ---------- Status UI ----------
    let statusState = "idle";
    function setStatus(mode, text) {
        statusState = mode;
        statusEl.className = "status " + (mode !== "idle" ? mode : "");
        statusEl.textContent = text;
    }

    // ---------- Particle blob canvas ----------
    let W = 0, H = 0, CX = 0, CY = 0, dpr = 1;
    const PARTICLES = [];
    const P_COUNT = 420;
    let energy = 0;       // 0 = idle, 1 = high activity
    let energyTarget = 0;
    let hue = 205;        // base cyan/blue
    let hueTarget = 205;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        CX = W / 2;
        CY = H / 2;
    }
    window.addEventListener("resize", resize);
    resize();

    function initParticles() {
        PARTICLES.length = 0;
        for (let i = 0; i < P_COUNT; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.8 + 0.2;
            PARTICLES.push({
                a,
                r,
                rSpeed: (Math.random() - 0.5) * 0.002,
                aSpeed: (Math.random() - 0.5) * 0.004 + 0.001,
                size: Math.random() * 1.6 + 0.4,
                offset: Math.random() * Math.PI * 2
            });
        }
    }
    initParticles();

    function draw(now) {
        // smooth energy & hue
        energy += (energyTarget - energy) * 0.06;
        hue += (hueTarget - hue) * 0.06;

        // fade trail for glow
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        ctx.fillRect(0, 0, W, H);

        const baseRadius = Math.min(W, H) * 0.18;
        const maxRadius = baseRadius * (1 + energy * 0.9);
        const t = now * 0.0008;

        // central glow
        const glowR = baseRadius * (0.35 + energy * 0.4);
        const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, glowR);
        grad.addColorStop(0, `hsla(${hue}, 100%, 65%, ${0.25 + energy * 0.35})`);
        grad.addColorStop(0.4, `hsla(${hue}, 100%, 50%, ${0.08 + energy * 0.15})`);
        grad.addColorStop(1, "hsla(0,0%,0%,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(CX, CY, glowR, 0, Math.PI * 2); ctx.fill();

        // particles
        ctx.globalCompositeOperation = "lighter";
        for (const p of PARTICLES) {
            p.a += p.aSpeed * (0.3 + energy * 2.5);
            p.r += p.rSpeed;
            if (p.r < 0.1 || p.r > 1.1) p.rSpeed *= -1;

            const wobble = Math.sin(t * 2 + p.offset) * 0.25 * (0.4 + energy);
            const rr = (p.r + wobble) * maxRadius;
            const x = CX + Math.cos(p.a) * rr;
            const y = CY + Math.sin(p.a) * rr * 0.95;
            const size = p.size * (1 + energy * 1.5);
            const alpha = 0.35 + Math.random() * 0.25 + energy * 0.3;

            ctx.fillStyle = `hsla(${hue + (Math.sin(p.offset + t) * 25)}, 100%, ${60 + energy * 15}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    function setMode(mode) {
        if (mode === "listening") { energyTarget = 0.75; hueTarget = 150; setStatus("listening", t("lytter…", "listening…")); }
        else if (mode === "speaking") { energyTarget = 0.9; hueTarget = 200; setStatus("speaking", t("taler", "speaking")); }
        else if (mode === "thinking") { energyTarget = 0.55; hueTarget = 275; setStatus("thinking", t("tænker", "processing")); }
        else { energyTarget = 0.12; hueTarget = 210; setStatus("idle", t("klar", "standby")); }
    }
    setMode("idle");

    // ---------- Speech Synthesis ----------
    const synth = window.speechSynthesis;
    let voices = [];
    let selectedVoice = null;

    function pickVoice() {
        voices = synth ? synth.getVoices() : [];
        if (!voices.length) return null;
        if (isDa()) {
            const c = [/Magnus/i, /Mikkel/i, /da-DK.*male/i, /Microsoft.*Danish/i, /da-DK/i, /^da/i];
            for (const re of c) { const v = voices.find(v => re.test(v.name) || re.test(v.lang)); if (v) return v; }
        } else {
            const c = [/Daniel/i, /Oliver/i, /Arthur/i, /Google UK English Male/i, /Microsoft George/i, /Microsoft Ryan/i, /en-GB.*male/i, /en-GB/i, /Alex/i, /en-US.*male/i, /en-US/i];
            for (const re of c) { const v = voices.find(v => re.test(v.name) || re.test(v.lang)); if (v) return v; }
        }
        return voices[0];
    }
    function refreshVoice() { selectedVoice = pickVoice(); }
    if (synth) { refreshVoice(); synth.onvoiceschanged = refreshVoice; }

    let speaking = false;
    function speak(text) {
        return new Promise((resolve) => {
            if (state.muted || !synth) { resolve(); return; }
            try {
                synth.cancel();
                const u = new SpeechSynthesisUtterance(text);
                if (!selectedVoice) refreshVoice();
                if (selectedVoice) { u.voice = selectedVoice; u.lang = selectedVoice.lang; }
                else u.lang = state.lang;
                u.rate = 0.95;
                u.pitch = 0.85;
                u.volume = 1;
                u.onstart = () => { speaking = true; setMode("speaking"); };
                u.onend = () => { speaking = false; resolve(); };
                u.onerror = () => { speaking = false; resolve(); };
                synth.speak(u);
            } catch (_) { resolve(); }
        });
    }

    // ---------- Speech Recognition (continuous) ----------
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    let listening = false;
    let wantListen = false;
    let restartTimer = null;

    function buildRecognizer() {
        if (!SR) return null;
        const r = new SR();
        r.lang = state.lang;
        r.interimResults = false;
        r.continuous = false;
        r.onstart = () => { listening = true; setMode("listening"); };
        r.onresult = async (e) => {
            const text = e.results[e.results.length - 1][0].transcript.trim();
            if (!text) return;
            await handleInput(text);
        };
        r.onerror = (e) => {
            if (e.error === "not-allowed" || e.error === "service-not-allowed") {
                setStatus("error", t("mikrofon blokeret", "microphone blocked"));
                wantListen = false;
            }
        };
        r.onend = () => {
            listening = false;
            if (!speaking && statusState === "listening") setMode("idle");
            if (wantListen && !speaking) {
                clearTimeout(restartTimer);
                restartTimer = setTimeout(() => { if (wantListen && !listening && !speaking) safeStart(); }, 400);
            }
        };
        return r;
    }

    function safeStart() {
        if (!SR || listening || speaking) return;
        recognizer = buildRecognizer();
        try { recognizer.start(); } catch (_) {}
    }

    function startLoop() {
        wantListen = true;
        safeStart();
    }
    function stopLoop() {
        wantListen = false;
        if (recognizer && listening) { try { recognizer.stop(); } catch (_) {} }
    }

    // ---------- Handle input ----------
    async function handleInput(text) {
        setMode("thinking");
        await new Promise(r => setTimeout(r, 180));
        const reply = respond(text);
        if (reply) {
            await speak(reply);
        }
        if (wantListen && !listening) setTimeout(safeStart, 300);
        else setMode("idle");
    }

    const sir = () => state.name || (isDa() ? "hr." : "Sir");
    const pick = (a) => a[Math.floor(Math.random() * a.length)];

    function respond(raw) {
        const q = raw.toLowerCase().trim();
        const s = q.replace(/^(hey |hej |ok |okay )?jarvis[,!?\.\s]*/i, "").trim() || q;

        let m;

        if (/^(hjælp|help|kommandoer|what can you do|hvad kan du)/.test(s)) {
            return isDa()
                ? `${sir()}, jeg kan fortælle tid, dato, åbne sites, søge, lave noter, sætte timer, beregne og meget mere. Sig hvad De ønsker.`
                : `${sir()}, I can tell the time, open websites, search, take notes, set timers, make calculations, and more. Just speak, ${sir()}.`;
        }

        m = s.match(/^(mit navn er|kald mig|my name is|call me)\s+(.+)$/i);
        if (m) {
            state.name = m[2].replace(/[.!?]/g, "").trim();
            saveState();
            return isDa() ? `Noteret. Jeg tiltaler Dem ${state.name} fremover.` : `Very well. I shall address you as ${state.name} from now on.`;
        }

        if (/^(hej|hallo|hello|hi|yo|good (morning|afternoon|evening)|god(morgen|dag|aften))/.test(s)) {
            const h = new Date().getHours();
            return isDa()
                ? `${h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften"}, ${sir()}. Hvordan kan jeg være til tjeneste?`
                : `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${sir()}. How may I be of service?`;
        }

        if (/(hvordan har du det|how are you|alt vel)/.test(s)) {
            return isDa() ? `Alle systemer fungerer optimalt, ${sir()}.` : `All systems operating at peak efficiency, ${sir()}.`;
        }
        if (/^(tak|thanks|thank you|mange tak)/.test(s)) {
            return isDa() ? pick([`Altid en fornøjelse, ${sir()}.`, `Selv tak.`]) : pick([`Always a pleasure, ${sir()}.`, `At your service.`]);
        }
        if (/(hvem er du|who are you|what are you)/.test(s)) {
            return isDa() ? `Jeg er J.A.R.V.I.S. — Deres personlige assistent, ${sir()}.` : `I am J.A.R.V.I.S. — your personal assistant, ${sir()}.`;
        }

        if (/klokken|hvad er tiden|what time|the time/.test(s)) {
            const d = new Date();
            const time = d.toLocaleTimeString(isDa() ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" });
            return isDa() ? `Klokken er ${time}, ${sir()}.` : `The time is ${time}, ${sir()}.`;
        }

        if (/dato|hvilken dag|what.*date|what day/.test(s)) {
            const d = new Date();
            const locale = isDa() ? "da-DK" : "en-GB";
            const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            return isDa() ? `I dag er det ${date}, ${sir()}.` : `Today is ${date}, ${sir()}.`;
        }

        const sites = { youtube: "https://youtube.com", google: "https://google.com", github: "https://github.com", gmail: "https://mail.google.com", maps: "https://maps.google.com", wikipedia: "https://wikipedia.org", reddit: "https://reddit.com", twitter: "https://twitter.com", chatgpt: "https://chat.openai.com", claude: "https://claude.ai", spotify: "https://open.spotify.com", netflix: "https://netflix.com", tiktok: "https://tiktok.com", instagram: "https://instagram.com" };
        m = s.match(/^(åbn|open|launch|go to|gå til)\s+(.+)$/i);
        if (m) {
            const t2 = m[2].replace(/[.!?]/g, "").trim();
            const key = Object.keys(sites).find(k => t2.includes(k));
            if (key) { window.open(sites[key], "_blank", "noopener"); return isDa() ? `Åbner ${key}, ${sir()}.` : `Opening ${key}, ${sir()}.`; }
            const url = t2.startsWith("http") ? t2 : "https://" + t2.replace(/\s+/g, "");
            window.open(url, "_blank", "noopener");
            return isDa() ? `Forsøger at åbne ${t2}, ${sir()}.` : `Attempting to open ${t2}, ${sir()}.`;
        }

        m = s.match(/^(søg(?: efter)?|search(?: for)?|google|find)\s+(.+)$/i);
        if (m) {
            window.open("https://www.google.com/search?q=" + encodeURIComponent(m[2]), "_blank", "noopener");
            return isDa() ? `Søger efter ${m[2]}, ${sir()}.` : `Searching for ${m[2]}, ${sir()}.`;
        }

        m = s.match(/^(lav (?:en )?note|note|notér|remember|husk)\s+(.+)$/i);
        if (m) {
            state.notes.push({ text: m[2].trim(), at: Date.now() });
            saveState();
            return isDa() ? `Noteret, ${sir()}.` : `Noted, ${sir()}.`;
        }
        if (/^(vis noter|mine noter|show notes|list notes)/.test(s)) {
            if (!state.notes.length) return isDa() ? `De har ingen noter.` : `You have no notes.`;
            return (isDa() ? "Deres noter: " : "Your notes: ") + state.notes.map((n, i) => `${i + 1}, ${n.text}`).join(". ");
        }

        m = s.match(/^(påmind mig om|remind me to)\s+(.+)$/i);
        if (m) {
            state.reminders.push({ text: m[2].trim(), at: Date.now() });
            saveState();
            return isDa() ? `Jeg minder Dem om: ${m[2].trim()}.` : `I'll remind you: ${m[2].trim()}.`;
        }

        m = s.match(/^timer\s+(\d+)\s*(sekund|sekunder|second|seconds|min|minut|minutter|minute|minutes)?/i);
        if (m) {
            const n = parseInt(m[1], 10);
            const unit = (m[2] || "minutter").toLowerCase();
            const ms = /sek|sec/.test(unit) ? n * 1000 : n * 60000;
            const readable = /sek|sec/.test(unit) ? `${n} ${t("sekunder", "seconds")}` : `${n} ${t("minutter", "minutes")}`;
            setTimeout(() => {
                const done = isDa() ? `Timer færdig, ${sir()}.` : `Timer complete, ${sir()}.`;
                speak(done); beep();
            }, ms);
            return isDa() ? `Timer sat til ${readable}, ${sir()}.` : `Timer set for ${readable}, ${sir()}.`;
        }

        m = s.match(/^(beregn|calc|calculate|regn ud|what is|hvad er)\s+(.+)$/i);
        if (m) {
            try {
                const expr = m[2].replace(/x/gi, "*").replace(/plus/gi, "+").replace(/minus/gi, "-").replace(/divided by/gi, "/").replace(/times/gi, "*").replace(/[^-+*/().\d\s]/g, "");
                const val = Function(`"use strict"; return (${expr});`)();
                return `${m[2]} equals ${val}.`;
            } catch (_) { return isDa() ? `Kunne ikke beregne det, ${sir()}.` : `I couldn't evaluate that, ${sir()}.`; }
        }

        if (/vittighed|joke/.test(s)) {
            return pick(isDa()
                ? ["Hvorfor tog programmøren sin computer til lægen? Den havde en virus.", "Der findes 10 slags mennesker: dem der forstår binært, og dem der ikke gør."]
                : [`${sir()}, why did the developer go broke? He used up all his cache.`, `I'd tell you a UDP joke, ${sir()}, but you might not get it.`, `Why do programmers prefer dark mode? Because light attracts bugs.`]);
        }
        if (/terning|dice|roll/.test(s)) { const n = Math.floor(Math.random() * 6) + 1; return isDa() ? `Terningen viser ${n}.` : `The dice shows ${n}, ${sir()}.`; }
        if (/plat eller krone|coin|flip/.test(s)) { const r = Math.random() < 0.5; return isDa() ? (r ? "Krone." : "Plat.") : (r ? `Heads, ${sir()}.` : `Tails, ${sir()}.`); }

        if (/vejr|weather/.test(s)) { window.open(isDa() ? "https://www.dmi.dk/" : "https://weather.com", "_blank", "noopener"); return isDa() ? `Henter vejrdata, ${sir()}.` : `Pulling up the weather, ${sir()}.`; }
        if (/nyheder|news/.test(s)) { window.open(isDa() ? "https://dr.dk/nyheder" : "https://news.google.com", "_blank", "noopener"); return isDa() ? `Dagens overskrifter.` : `Today's headlines, ${sir()}.`; }

        if (/skift.*engelsk|switch to english|speak english/.test(s)) { state.lang = "en-GB"; langBtn.textContent = "EN"; refreshVoice(); saveState(); if (recognizer) recognizer.lang = "en-GB"; return `Switching to English, ${sir()}.`; }
        if (/switch to danish|skift.*dansk|tal dansk/.test(s)) { state.lang = "da-DK"; langBtn.textContent = "DA"; refreshVoice(); saveState(); if (recognizer) recognizer.lang = "da-DK"; return `Skifter til dansk, ${sir()}.`; }

        if (/stop|stop lytning|stop listening|pause|disengage|shut down/.test(s)) {
            stopLoop();
            setTimeout(() => setMode("idle"), 100);
            return isDa() ? `Jeg pauser, ${sir()}. Tryk for at genoptage.` : `Standing down, ${sir()}. Tap to resume.`;
        }

        if (/farvel|goodbye|bye|hej hej/.test(s)) {
            return isDa() ? `På gensyn, ${sir()}.` : `Goodbye, ${sir()}. I'll be here.`;
        }

        return pick(isDa()
            ? [`Jeg beklager, ${sir()}. Kunne De omformulere?`, `Det fangede jeg ikke helt, ${sir()}.`, `Tilgiv mig, ${sir()}.`]
            : [`I'm afraid I didn't quite catch that, ${sir()}.`, `My apologies, ${sir()} — could you rephrase?`, `Forgive me, ${sir()}, that's outside my parameters.`]);
    }

    function beep() {
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const o = ac.createOscillator(); const g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = 880;
            g.gain.setValueAtTime(0.001, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
            o.start(); o.stop(ac.currentTime + 0.55);
        } catch (_) {}
    }

    // ---------- HUD ----------
    function tick() {
        const d = new Date();
        clockEl.textContent = d.toLocaleTimeString(isDa() ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    setInterval(tick, 1000); tick();

    function updateNetwork() {
        const on = navigator.onLine;
        connDot.classList.toggle("offline", !on);
        connText.textContent = on ? "connected" : "offline";
    }
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    updateNetwork();

    // ---------- Controls ----------
    langBtn.addEventListener("click", () => {
        state.lang = isDa() ? "en-GB" : "da-DK";
        langBtn.textContent = isDa() ? "DA" : "EN";
        refreshVoice();
        saveState();
        if (recognizer) recognizer.lang = state.lang;
        const msg = isDa() ? `Skifter til dansk, ${sir()}.` : `Switching to English, ${sir()}.`;
        speak(msg);
    });

    muteBtn.addEventListener("click", () => {
        state.muted = !state.muted;
        muteBtn.textContent = state.muted ? "🔇" : "🔊";
        muteBtn.classList.toggle("muted", state.muted);
        saveState();
        if (state.muted) synth.cancel();
    });

    // Tap canvas to toggle listening
    canvas.addEventListener("click", () => {
        if (overlay.classList.contains("hidden")) {
            if (wantListen) stopLoop(); else startLoop();
        }
    });

    // ---------- Start ----------
    startBtn.addEventListener("click", async () => {
        overlay.classList.add("hidden");

        // unlock audio context (iOS) and synth on user gesture
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            if (ac.state === "suspended") await ac.resume();
        } catch (_) {}

        if (!SR) {
            setStatus("error", t("browser ikke understøttet", "browser not supported"));
            return;
        }

        const h = new Date().getHours();
        const greet = isDa()
            ? `${h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften"}, ${sir()}. J.A.R.V.I.S. online.`
            : `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${sir()}. J.A.R.V.I.S. online.`;
        await speak(greet);
        startLoop();
    });
})();
