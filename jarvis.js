(() => {
    "use strict";

    const statusEl = document.getElementById("status");
    const connDot = document.getElementById("conn-dot");
    const connText = document.getElementById("conn-text");
    const overlay = document.getElementById("overlay");
    const startBtn = document.getElementById("start-btn");
    const langBtn = document.getElementById("lang-btn");
    const muteBtn = document.getElementById("mute-btn");
    const canvas = document.getElementById("blob");
    const ctx = canvas.getContext("2d");

    const STORAGE_KEY = "jarvis.v3";
    const state = load();

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { lang: "en-GB", muted: false, name: "Sir", notes: [], reminders: [], ...JSON.parse(raw) };
        } catch (_) {}
        return { lang: "en-GB", muted: false, name: "Sir", notes: [], reminders: [] };
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    const isDa = () => state.lang === "da-DK";
    const t = (da, en) => isDa() ? da : en;

    langBtn.textContent = isDa() ? "DA" : "EN";
    muteBtn.textContent = state.muted ? "off" : "on";

    // ---------- Particle system (matches reference image) ----------
    let W = 0, H = 0, CX = 0, CY = 0, dpr = 1;
    const particles = [];
    const P_COUNT = 260;
    let energy = 0;
    let energyTarget = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        CX = W / 2;
        CY = H * 0.42;
    }
    window.addEventListener("resize", resize);
    resize();

    // gaussian distribution — most particles near center, few far out
    function gauss() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function spawnParticles() {
        particles.length = 0;
        for (let i = 0; i < P_COUNT; i++) {
            const r = Math.abs(gauss()) * 0.45;          // 0..~1.5, biased near 0
            const a = Math.random() * Math.PI * 2;
            particles.push({
                baseR: Math.min(r, 1.4),
                baseA: a,
                r: r,
                a: a,
                speed: 0.3 + Math.random() * 0.8,         // radial oscillation speed
                wobble: Math.random() * Math.PI * 2,
                size: 0.5 + Math.random() * 1.4,
                life: Math.random()
            });
        }
    }
    spawnParticles();

    function draw(now) {
        energy += (energyTarget - energy) * 0.08;

        // full clear (no trail) for clean sparkly look
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);

        const scale = Math.min(W, H) * 0.18;  // compact cluster
        const T = now * 0.001;

        // bright core glow
        const coreR = 26 + energy * 18;
        const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR * 3);
        grad.addColorStop(0, `rgba(200, 235, 255, ${0.6 + energy * 0.3})`);
        grad.addColorStop(0.25, `rgba(80, 170, 255, ${0.35 + energy * 0.25})`);
        grad.addColorStop(0.6, `rgba(40, 110, 220, ${0.1 + energy * 0.1})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(CX, CY, coreR * 3, 0, Math.PI * 2); ctx.fill();

        // inner dense nucleus
        ctx.fillStyle = `rgba(220, 245, 255, ${0.85 + energy * 0.1})`;
        ctx.beginPath(); ctx.arc(CX, CY, 7 + energy * 4, 0, Math.PI * 2); ctx.fill();

        ctx.globalCompositeOperation = "lighter";

        for (const p of particles) {
            // subtle movement: each particle oscillates around its base position
            const rOsc = Math.sin(T * p.speed + p.wobble) * 0.15;
            const aOsc = Math.cos(T * p.speed * 0.7 + p.wobble) * 0.1;
            p.r = p.baseR + rOsc + energy * 0.35 * Math.sin(T * 2 + p.wobble);
            p.a = p.baseA + aOsc;

            const dist = p.r * scale;
            const x = CX + Math.cos(p.a) * dist;
            const y = CY + Math.sin(p.a) * dist;

            // fade with distance from center: inner = bright, outer = dust
            const distN = Math.min(p.r / 1.4, 1);
            const alpha = (1 - distN * 0.85) * (0.4 + energy * 0.5);
            const size = p.size * (1 - distN * 0.4);

            // color: core = white/cyan, outer = faint blue dust
            const r = Math.round(150 + (1 - distN) * 100);
            const g = Math.round(200 + (1 - distN) * 55);
            const b = 255;

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // occasional sparkle highlight for bright particles
            if (distN < 0.15 && Math.random() < 0.02) {
                ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
                ctx.beginPath();
                ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
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

    // ---------- Speech synth ----------
    const synth = window.speechSynthesis;
    let voices = [];
    let selectedVoice = null;

    function pickVoice() {
        voices = synth ? synth.getVoices() : [];
        if (!voices.length) return null;
        const list = isDa()
            ? [/Magnus/i, /Mikkel/i, /da-DK.*male/i, /Microsoft.*Danish/i, /da-DK/i, /^da/i]
            : [/Daniel/i, /Oliver/i, /Arthur/i, /Google UK English Male/i, /Microsoft George/i, /Microsoft Ryan/i, /en-GB.*male/i, /en-GB/i, /Alex/i, /en-US/i];
        for (const re of list) {
            const v = voices.find(x => re.test(x.name) || re.test(x.lang));
            if (v) return v;
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
                u.onstart = () => { speaking = true; setMode("speaking"); };
                u.onend = () => { speaking = false; resolve(); };
                u.onerror = () => { speaking = false; resolve(); };
                synth.speak(u);
            } catch (_) { resolve(); }
        });
    }

    // ---------- Speech recognition ----------
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    let listening = false;
    let wantListen = false;
    let restartTimer = null;

    function build() {
        if (!SR) return null;
        const r = new SR();
        r.lang = state.lang;
        r.interimResults = false;
        r.continuous = false;
        r.onstart = () => { listening = true; setMode("listening"); };
        r.onresult = async (e) => {
            const text = e.results[e.results.length - 1][0].transcript.trim();
            if (text) await handleInput(text);
        };
        r.onerror = (e) => {
            if (e.error === "not-allowed" || e.error === "service-not-allowed") {
                statusEl.textContent = t("mikrofon blokeret", "mic blocked");
                wantListen = false;
            }
        };
        r.onend = () => {
            listening = false;
            if (!speaking) setMode("idle");
            if (wantListen && !speaking) {
                clearTimeout(restartTimer);
                restartTimer = setTimeout(() => { if (wantListen && !listening && !speaking) safeStart(); }, 400);
            }
        };
        return r;
    }

    function safeStart() {
        if (!SR || listening || speaking) return;
        recognizer = build();
        try { recognizer.start(); } catch (_) {}
    }
    function startLoop() { wantListen = true; safeStart(); }
    function stopLoop() { wantListen = false; if (recognizer && listening) { try { recognizer.stop(); } catch (_) {} } }

    async function handleInput(text) {
        setMode("thinking");
        await new Promise(r => setTimeout(r, 150));
        const reply = respond(text);
        if (reply) await speak(reply);
        if (wantListen && !listening) setTimeout(safeStart, 300);
        else setMode("idle");
    }

    const sir = () => state.name || (isDa() ? "hr." : "Sir");
    const pick = (a) => a[Math.floor(Math.random() * a.length)];

    function respond(raw) {
        const q = raw.toLowerCase().trim();
        const s = q.replace(/^(hey |hej |ok |okay )?jarvis[,!?\.\s]*/i, "").trim() || q;
        let m;

        if (/^(hjælp|help|what can you do|hvad kan du)/.test(s)) {
            return isDa()
                ? `${sir()}, jeg kan fortælle tid, dato, åbne sites, søge, lave noter, sætte timer og mere.`
                : `${sir()}, I can tell the time, open websites, search, take notes, set timers and more.`;
        }
        m = s.match(/^(mit navn er|kald mig|my name is|call me)\s+(.+)$/i);
        if (m) { state.name = m[2].replace(/[.!?]/g, "").trim(); save(); return isDa() ? `Noteret, ${state.name}.` : `Very well, ${state.name}.`; }

        if (/^(hej|hallo|hello|hi|good (morning|afternoon|evening)|god(morgen|dag|aften))/.test(s)) {
            const h = new Date().getHours();
            return isDa()
                ? `${h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften"}, ${sir()}. Hvordan kan jeg være til tjeneste?`
                : `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${sir()}. How may I be of service?`;
        }
        if (/(how are you|hvordan har du det)/.test(s)) return isDa() ? `Alle systemer fungerer optimalt, ${sir()}.` : `All systems operating at peak efficiency, ${sir()}.`;
        if (/^(tak|thanks|thank you)/.test(s)) return pick(isDa() ? [`Altid en fornøjelse, ${sir()}.`] : [`Always a pleasure, ${sir()}.`, `At your service.`]);
        if (/(who are you|hvem er du)/.test(s)) return isDa() ? `Jeg er Jarvis — Deres personlige assistent.` : `I am Jarvis — your personal assistant, ${sir()}.`;

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

        const sites = { youtube: "https://youtube.com", google: "https://google.com", github: "https://github.com", gmail: "https://mail.google.com", maps: "https://maps.google.com", wikipedia: "https://wikipedia.org", spotify: "https://open.spotify.com", netflix: "https://netflix.com", tiktok: "https://tiktok.com", instagram: "https://instagram.com", claude: "https://claude.ai", chatgpt: "https://chat.openai.com" };
        m = s.match(/^(åbn|open|launch)\s+(.+)$/i);
        if (m) {
            const tgt = m[2].replace(/[.!?]/g, "").trim();
            const key = Object.keys(sites).find(k => tgt.includes(k));
            if (key) { window.open(sites[key], "_blank", "noopener"); return isDa() ? `Åbner ${key}.` : `Opening ${key}, ${sir()}.`; }
            const url = tgt.startsWith("http") ? tgt : "https://" + tgt.replace(/\s+/g, "");
            window.open(url, "_blank", "noopener");
            return isDa() ? `Åbner ${tgt}.` : `Opening ${tgt}, ${sir()}.`;
        }
        m = s.match(/^(søg(?: efter)?|search(?: for)?|google|find)\s+(.+)$/i);
        if (m) { window.open("https://www.google.com/search?q=" + encodeURIComponent(m[2]), "_blank", "noopener"); return isDa() ? `Søger efter ${m[2]}.` : `Searching for ${m[2]}, ${sir()}.`; }

        m = s.match(/^(note|lav (?:en )?note|notér|remember|husk)\s+(.+)$/i);
        if (m) { state.notes.push({ text: m[2].trim(), at: Date.now() }); save(); return isDa() ? `Noteret, ${sir()}.` : `Noted, ${sir()}.`; }
        if (/(vis noter|show notes)/.test(s)) return state.notes.length ? state.notes.map((n,i) => `${i+1}. ${n.text}`).join(". ") : (isDa() ? "Ingen noter." : "No notes.");

        m = s.match(/^timer\s+(\d+)\s*(sec|sek|min|minut)?/i);
        if (m) {
            const n = parseInt(m[1], 10);
            const ms = /sek|sec/.test(m[2] || "") ? n * 1000 : n * 60000;
            setTimeout(() => { speak(isDa() ? `Timer færdig, ${sir()}.` : `Timer complete, ${sir()}.`); beep(); }, ms);
            return isDa() ? `Timer sat.` : `Timer set, ${sir()}.`;
        }

        m = s.match(/^(calculate|beregn|what is|hvad er)\s+(.+)$/i);
        if (m) {
            try {
                const expr = m[2].replace(/x|times/gi, "*").replace(/plus/gi, "+").replace(/minus/gi, "-").replace(/divided by/gi, "/").replace(/[^-+*/().\d\s]/g, "");
                const val = Function(`"use strict";return(${expr});`)();
                return `${m[2]} equals ${val}.`;
            } catch (_) { return isDa() ? `Kunne ikke beregne det.` : `I couldn't evaluate that.`; }
        }

        if (/vittighed|joke/.test(s)) return pick(isDa()
            ? ["Hvorfor tog programmøren sin computer til lægen? Den havde en virus."]
            : [`${sir()}, why did the developer go broke? He used up all his cache.`, `I'd tell you a UDP joke, but you might not get it.`]);
        if (/dice|terning/.test(s)) { const n = Math.floor(Math.random()*6)+1; return isDa() ? `Terningen viser ${n}.` : `The dice shows ${n}, ${sir()}.`; }
        if (/coin|plat eller krone/.test(s)) { const r = Math.random() < 0.5; return isDa() ? (r?"Krone.":"Plat.") : (r?`Heads, ${sir()}.`:`Tails, ${sir()}.`); }

        if (/vejr|weather/.test(s)) { window.open(isDa() ? "https://dmi.dk" : "https://weather.com", "_blank"); return isDa() ? `Henter vejret.` : `Pulling up weather, ${sir()}.`; }
        if (/nyheder|news/.test(s)) { window.open(isDa() ? "https://dr.dk/nyheder" : "https://news.google.com", "_blank"); return isDa() ? `Dagens nyheder.` : `Today's headlines, ${sir()}.`; }

        if (/switch to english|skift.*engelsk/.test(s)) { state.lang = "en-GB"; langBtn.textContent = "EN"; refreshVoice(); save(); if (recognizer) recognizer.lang = "en-GB"; return `Switching to English, ${sir()}.`; }
        if (/switch to danish|skift.*dansk/.test(s)) { state.lang = "da-DK"; langBtn.textContent = "DA"; refreshVoice(); save(); if (recognizer) recognizer.lang = "da-DK"; return `Skifter til dansk.`; }

        if (/stop listening|pause|stop lytning/.test(s)) { stopLoop(); return isDa() ? `Jeg pauser, ${sir()}.` : `Standing down, ${sir()}.`; }
        if (/farvel|goodbye|bye/.test(s)) return isDa() ? `På gensyn, ${sir()}.` : `Goodbye, ${sir()}.`;

        return pick(isDa()
            ? [`Jeg beklager, ${sir()}. Kunne De omformulere?`, `Det fangede jeg ikke, ${sir()}.`]
            : [`I'm afraid I didn't catch that, ${sir()}.`, `My apologies, ${sir()} — could you rephrase?`]);
    }

    function beep() {
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const o = ac.createOscillator(); const g = ac.createGain();
            o.connect(g); g.connect(ac.destination);
            o.frequency.value = 880;
            g.gain.setValueAtTime(0.001, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
            o.start(); o.stop(ac.currentTime + 0.55);
        } catch (_) {}
    }

    function updateNetwork() {
        const on = navigator.onLine;
        connDot.classList.toggle("offline", !on);
        connText.textContent = on ? "connected" : "offline";
    }
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    updateNetwork();

    langBtn.addEventListener("click", () => {
        state.lang = isDa() ? "en-GB" : "da-DK";
        langBtn.textContent = isDa() ? "DA" : "EN";
        refreshVoice(); save();
        if (recognizer) recognizer.lang = state.lang;
    });
    muteBtn.addEventListener("click", () => {
        state.muted = !state.muted;
        muteBtn.textContent = state.muted ? "off" : "on";
        save();
        if (state.muted) synth.cancel();
    });

    canvas.addEventListener("click", () => {
        if (overlay.classList.contains("hidden")) {
            if (wantListen) stopLoop(); else startLoop();
        }
    });

    startBtn.addEventListener("click", async () => {
        overlay.classList.add("hidden");
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            if (ac.state === "suspended") await ac.resume();
        } catch (_) {}
        if (!SR) { statusEl.textContent = t("browser ikke understøttet", "browser not supported"); return; }

        const h = new Date().getHours();
        const greet = isDa()
            ? `${h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften"}, ${sir()}.`
            : `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${sir()}.`;
        await speak(greet);
        startLoop();
    });
})();
