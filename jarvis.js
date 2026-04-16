(() => {
    "use strict";

    const chatEl = document.getElementById("chat");
    const input = document.getElementById("input");
    const composer = document.getElementById("composer");
    const micBtn = document.getElementById("mic-btn");
    const orb = document.getElementById("orb");
    const orbLabel = document.getElementById("orb-label");
    const hint = document.getElementById("hint");
    const voiceToggle = document.getElementById("voice-toggle");
    const langSelect = document.getElementById("lang-select");
    const clearBtn = document.getElementById("clear-btn");
    const handsFreeToggle = document.getElementById("handsfree-toggle");
    const clockEl = document.getElementById("clock");
    const todayEl = document.getElementById("today");
    const userNameEl = document.getElementById("user-name");
    const langLabel = document.getElementById("lang-label");
    const batteryEl = document.getElementById("battery");
    const networkEl = document.getElementById("network");
    const connectionEl = document.getElementById("connection");

    const STORAGE_KEY = "jarvis.state.v2";
    const state = loadState();

    langSelect.value = state.lang;
    voiceToggle.checked = state.voice;
    if (handsFreeToggle) handsFreeToggle.checked = !!state.handsFree;
    userNameEl.textContent = state.name;
    langLabel.textContent = state.lang === "da-DK" ? "Dansk" : "English (Jarvis)";

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { notes: [], reminders: [], history: [], name: "Sir", lang: "en-GB", voice: true, handsFree: false, ...JSON.parse(raw) };
        } catch (_) {}
        return { notes: [], reminders: [], history: [], name: "Sir", lang: "en-GB", voice: true, handsFree: false };
    }
    function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function t(da, en) { return state.lang === "da-DK" ? da : en; }

    function addMessage(text, who = "bot") {
        const div = document.createElement("div");
        div.className = `msg ${who}`;
        div.textContent = text;
        chatEl.appendChild(div);
        chatEl.scrollTop = chatEl.scrollHeight;
        if (who !== "sys") {
            state.history.push({ who, text, at: Date.now() });
            if (state.history.length > 200) state.history.shift();
            saveState();
        }
    }

    function setOrbMode(mode, label) {
        orb.classList.remove("listening", "speaking", "thinking");
        if (mode) orb.classList.add(mode);
        orbLabel.textContent = label || t("KLAR", "STANDBY");
    }

    // ---------- Speech Synthesis (Jarvis voice) ----------
    const synth = window.speechSynthesis;
    let voices = [];
    let selectedVoice = null;

    function pickJarvisVoice() {
        voices = synth ? synth.getVoices() : [];
        if (!voices.length) return null;

        if (state.lang === "en-GB" || state.lang === "en-US") {
            // Priority: British male voices that sound like Jarvis
            const candidates = [
                /Daniel/i,                  // iOS / macOS - sounds most like Jarvis
                /Oliver/i,                  // iOS enhanced
                /Arthur/i,                  // iOS
                /Google UK English Male/i,  // Chrome desktop
                /Microsoft George/i,        // Windows UK
                /Microsoft Ryan/i,          // Windows UK
                /en-GB.*male/i,
                /en-GB/i,
                /Alex/i,                    // macOS US fallback
                /en-US/i
            ];
            for (const re of candidates) {
                const v = voices.find(v => re.test(v.name) || re.test(v.lang));
                if (v) return v;
            }
        } else {
            // Danish
            const candidates = [
                /Magnus/i, /Mikkel/i,       // iOS Danish male
                /da-DK.*male/i,
                /Microsoft.*Danish/i,
                /da-DK/i,
                /da/i
            ];
            for (const re of candidates) {
                const v = voices.find(v => re.test(v.name) || re.test(v.lang));
                if (v) return v;
            }
        }
        return voices[0];
    }

    function refreshVoice() { selectedVoice = pickJarvisVoice(); }
    if (synth) {
        refreshVoice();
        synth.onvoiceschanged = refreshVoice;
    }

    function speak(text) {
        if (!voiceToggle.checked || !synth) return;
        try {
            synth.cancel();
            const u = new SpeechSynthesisUtterance(text);
            if (!selectedVoice) refreshVoice();
            if (selectedVoice) { u.voice = selectedVoice; u.lang = selectedVoice.lang; }
            else u.lang = state.lang;
            // Jarvis-style: calm, measured, slightly lower pitch
            u.rate = 0.95;
            u.pitch = 0.85;
            u.volume = 1.0;
            u.onstart = () => setOrbMode("speaking", t("TALER", "SPEAKING"));
            u.onend = () => {
                setOrbMode(null, t("KLAR", "STANDBY"));
                if (state.handsFree && !listening) setTimeout(startListening, 400);
            };
            u.onerror = () => setOrbMode(null, t("KLAR", "STANDBY"));
            synth.speak(u);
        } catch (_) {}
    }

    // ---------- Speech Recognition ----------
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    let listening = false;
    let stopRequested = false;

    function initRecognizer() {
        if (!SR) return null;
        const r = new SR();
        r.lang = state.lang === "en-GB" ? "en-GB" : state.lang;
        r.interimResults = false;
        r.continuous = false;
        r.onstart = () => {
            listening = true;
            stopRequested = false;
            micBtn.classList.add("active");
            setOrbMode("listening", t("LYTTER", "LISTENING"));
        };
        r.onresult = (e) => {
            const text = e.results[0][0].transcript;
            handleInput(text);
        };
        r.onerror = (e) => {
            if (e.error !== "no-speech" && e.error !== "aborted") {
                addMessage(t("Fejl: ", "Error: ") + e.error, "sys");
            }
        };
        r.onend = () => {
            listening = false;
            micBtn.classList.remove("active");
            if (!orb.classList.contains("speaking") && !orb.classList.contains("thinking")) {
                setOrbMode(null, t("KLAR", "STANDBY"));
            }
            // Auto-restart in hands-free unless user stopped or we're speaking
            if (state.handsFree && !stopRequested && !synth.speaking) {
                setTimeout(() => { if (state.handsFree && !listening && !synth.speaking) startListening(); }, 300);
            }
        };
        return r;
    }

    function startListening() {
        if (!SR) {
            addMessage(t("Talegenkendelse understøttes ikke her. Brug Chrome, Edge eller Safari.",
                         "Speech recognition isn't supported here. Try Chrome, Edge or Safari."), "bot");
            return;
        }
        if (listening) return;
        recognizer = initRecognizer();
        try { recognizer.start(); } catch (_) {}
    }

    function stopListening() {
        stopRequested = true;
        if (recognizer && listening) {
            try { recognizer.stop(); } catch (_) {}
        }
        listening = false;
        micBtn.classList.remove("active");
    }

    micBtn.addEventListener("click", () => listening ? stopListening() : startListening());

    composer.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        handleInput(text);
    });

    document.querySelectorAll(".quick button").forEach(btn => {
        btn.addEventListener("click", () => handleInput(btn.dataset.cmd));
    });

    clearBtn.addEventListener("click", () => {
        state.history = [];
        chatEl.innerHTML = "";
        saveState();
        greet();
    });

    voiceToggle.addEventListener("change", () => { state.voice = voiceToggle.checked; saveState(); });

    if (handsFreeToggle) {
        handsFreeToggle.addEventListener("change", () => {
            state.handsFree = handsFreeToggle.checked;
            saveState();
            if (state.handsFree) {
                addMessage(t("Håndfri-tilstand aktiveret. Jeg lytter nu.", "Hands-free mode engaged. I'm listening now, Sir."), "sys");
                startListening();
            } else {
                addMessage(t("Håndfri-tilstand slået fra.", "Hands-free mode disengaged."), "sys");
                stopListening();
            }
        });
    }

    langSelect.addEventListener("change", () => {
        state.lang = langSelect.value;
        langLabel.textContent = state.lang === "da-DK" ? "Dansk" : "English (Jarvis)";
        refreshVoice();
        saveState();
        const msg = state.lang === "da-DK" ? "Sprog skiftet til dansk." : "Switching to English, Sir.";
        addMessage(msg, "sys");
        speak(msg);
    });

    function handleInput(raw) {
        const text = raw.trim();
        if (!text) return;
        addMessage(text, "user");
        setOrbMode("thinking", t("TÆNKER", "PROCESSING"));
        setTimeout(() => {
            const reply = respond(text);
            setOrbMode(null, t("KLAR", "STANDBY"));
            addMessage(reply, "bot");
            speak(reply);
        }, 220);
    }

    // ---------- Jarvis phrase helpers ----------
    const sir = () => state.name || (state.lang === "da-DK" ? "hr." : "Sir");
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const affirm = () => pick(state.lang === "da-DK"
        ? [`Med det samme, ${sir()}.`, `Udmærket, ${sir()}.`, `Som De ønsker, ${sir()}.`, `Naturligvis, ${sir()}.`]
        : [`Right away, ${sir()}.`, `Very good, ${sir()}.`, `As you wish, ${sir()}.`, `Certainly, ${sir()}.`, `At once, ${sir()}.`]);

    const prefix = () => pick(state.lang === "da-DK"
        ? [`${sir()}, `, `Hvis jeg må, ${sir()}, `, ``]
        : [`${sir()}, `, `If I may, ${sir()}, `, `Indeed, ${sir()} — `, ``]);

    // ---------- Command engine ----------
    function respond(text) {
        const q = text.toLowerCase().trim();
        const stripped = q.replace(/^(hey |hej |ok |okay )?jarvis[,!?\.\s]*/i, "").trim() || q;

        // In hands-free mode, require wake word "jarvis" unless it's a follow-up (optional; we'll allow all for now)

        // Hjælp
        if (/^(hjælp|help|kommandoer|commands|hvad kan du|what can you do)/.test(stripped)) {
            return state.lang === "da-DK"
                ? `${sir()}, jeg står til tjeneste med følgende:
• "hvad er klokken" / "dato"
• "åbn youtube/google/github/gmail/maps"
• "søg efter <emne>"
• "lav en note <tekst>" / "vis noter" / "slet noter"
• "påmind mig om <opgave>"
• "timer <tal> minutter"
• "beregn 12 * 7"
• "fortæl en vittighed" / "kast terning"
• "vejret" / "nyheder"
• "mit navn er <navn>"
• "skift til engelsk"
• "aktivér håndfri"`
                : `${sir()}, I am at your service. My capabilities include:
• "what time is it" / "what's the date"
• "open youtube/google/github/gmail/maps"
• "search for <topic>"
• "note <text>" / "show notes" / "clear notes"
• "remind me to <task>"
• "timer <n> minutes"
• "calculate 12 * 7"
• "tell a joke" / "roll a dice"
• "weather" / "news"
• "my name is <name>"
• "switch to Danish"
• "engage hands-free"`;
        }

        // Navn
        let m = stripped.match(/^(mit navn er|kald mig|my name is|call me)\s+(.+)$/i);
        if (m) {
            state.name = m[2].replace(/[.!?]/g, "").trim();
            userNameEl.textContent = state.name;
            saveState();
            return state.lang === "da-DK"
                ? `Noteret. Jeg tiltaler Dem ${state.name} fremover.`
                : `Noted. I shall address you as ${state.name} from now on.`;
        }

        // Hilsen
        if (/^(hej|hallo|hello|hi|yo|good morning|godmorgen|god morgen|goddag)/.test(stripped)) {
            const h = new Date().getHours();
            const greetEn = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
            const greetDa = h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften";
            return state.lang === "da-DK"
                ? `${greetDa}, ${sir()}. Hvordan kan jeg være til tjeneste?`
                : `${greetEn}, ${sir()}. How may I be of service?`;
        }

        if (/(hvordan har du det|how are you|you okay|alt vel)/.test(stripped)) {
            return state.lang === "da-DK"
                ? `Alle systemer fungerer optimalt, ${sir()}. Tak fordi De spørger.`
                : `All systems operating at peak efficiency, ${sir()}. Thank you for asking.`;
        }

        if (/^(tak|thanks|thank you|mange tak)/.test(stripped)) {
            return state.lang === "da-DK"
                ? pick([`Altid en fornøjelse, ${sir()}.`, `Selv tak, ${sir()}.`, `Til tjeneste.`])
                : pick([`Always a pleasure, ${sir()}.`, `At your service.`, `Think nothing of it, ${sir()}.`]);
        }

        if (/(hvem er du|who are you|hvad er du|what are you)/.test(stripped)) {
            return state.lang === "da-DK"
                ? `Jeg er J.A.R.V.I.S. — Just A Rather Very Intelligent System. Deres personlige assistent, ${sir()}.`
                : `I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Your personal assistant, ${sir()}.`;
        }

        // Tid
        if (/klokken|hvad er tiden|what time|current time/.test(stripped)) {
            const d = new Date();
            const time = d.toLocaleTimeString(state.lang === "da-DK" ? "da-DK" : "en-GB", { hour: "2-digit", minute: "2-digit" });
            return state.lang === "da-DK"
                ? `Klokken er ${time}, ${sir()}.`
                : `The time is ${time}, ${sir()}.`;
        }

        // Dato
        if (/dato|hvilken dag|what.*date|what day/.test(stripped)) {
            const d = new Date();
            const locale = state.lang === "da-DK" ? "da-DK" : "en-GB";
            const date = d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            return state.lang === "da-DK"
                ? `I dag er det ${date}, ${sir()}.`
                : `Today is ${date}, ${sir()}.`;
        }

        // Åbn sites
        const openMap = {
            youtube: "https://youtube.com",
            google: "https://google.com",
            github: "https://github.com",
            gmail: "https://mail.google.com",
            maps: "https://maps.google.com",
            wikipedia: "https://wikipedia.org",
            reddit: "https://reddit.com",
            twitter: "https://twitter.com",
            chatgpt: "https://chat.openai.com",
            claude: "https://claude.ai",
            spotify: "https://open.spotify.com",
            netflix: "https://netflix.com"
        };
        m = stripped.match(/^(åbn|open|gå til|go to|launch)\s+(.+)$/i);
        if (m) {
            const target = m[2].replace(/[.!?]/g, "").trim();
            const key = Object.keys(openMap).find(k => target.includes(k));
            if (key) {
                window.open(openMap[key], "_blank", "noopener");
                return state.lang === "da-DK" ? `Åbner ${key}, ${sir()}.` : `Opening ${key}, ${sir()}.`;
            }
            const url = target.startsWith("http") ? target : "https://" + target.replace(/\s+/g, "");
            window.open(url, "_blank", "noopener");
            return state.lang === "da-DK" ? `Forsøger at åbne ${target}, ${sir()}.` : `Attempting to open ${target}, ${sir()}.`;
        }

        // Søg
        m = stripped.match(/^(søg(?: efter)?|search(?: for)?|google|find)\s+(.+)$/i);
        if (m) {
            const q2 = m[2].trim();
            window.open("https://www.google.com/search?q=" + encodeURIComponent(q2), "_blank", "noopener");
            return state.lang === "da-DK" ? `Søger efter "${q2}", ${sir()}.` : `Searching for "${q2}", ${sir()}.`;
        }

        // Noter
        m = stripped.match(/^(lav (?:en )?note|note|notér|remember|husk)\s+(.+)$/i);
        if (m) {
            state.notes.push({ text: m[2].trim(), at: Date.now() });
            saveState();
            return state.lang === "da-DK"
                ? `Noteret, ${sir()}. De har nu ${state.notes.length} note(r).`
                : `Noted, ${sir()}. You have ${state.notes.length} note(s).`;
        }
        if (/^(vis noter|mine noter|show notes|list notes)/.test(stripped)) {
            if (!state.notes.length) return state.lang === "da-DK" ? `De har ingen noter, ${sir()}.` : `You have no notes, ${sir()}.`;
            return state.notes.map((n, i) => `${i + 1}. ${n.text}`).join("\n");
        }
        if (/^(slet noter|ryd noter|clear notes)/.test(stripped)) {
            state.notes = []; saveState();
            return state.lang === "da-DK" ? `Alle noter slettet, ${sir()}.` : `All notes deleted, ${sir()}.`;
        }

        // Påmindelser
        m = stripped.match(/^(påmind mig om|remind me to)\s+(.+)$/i);
        if (m) {
            state.reminders.push({ text: m[2].trim(), at: Date.now() });
            saveState();
            return state.lang === "da-DK"
                ? `Jeg minder Dem om: ${m[2].trim()}.`
                : `I'll remind you: ${m[2].trim()}.`;
        }
        if (/^(vis påmindelser|show reminders)/.test(stripped)) {
            if (!state.reminders.length) return state.lang === "da-DK" ? "Ingen påmindelser." : "No reminders.";
            return state.reminders.map((n, i) => `${i + 1}. ${n.text}`).join("\n");
        }

        // Timer
        m = stripped.match(/^timer\s+(\d+)\s*(sekund|sekunder|second|seconds|min|minut|minutter|minute|minutes)?/i);
        if (m) {
            const n = parseInt(m[1], 10);
            const unit = (m[2] || "minutter").toLowerCase();
            const ms = /sek|sec/.test(unit) ? n * 1000 : n * 60000;
            const readable = /sek|sec/.test(unit) ? `${n} ${t("sekunder", "seconds")}` : `${n} ${t("minutter", "minutes")}`;
            setTimeout(() => {
                const done = state.lang === "da-DK"
                    ? `Timer færdig, ${sir()}. ${readable} er forløbet.`
                    : `Timer complete, ${sir()}. ${readable} have elapsed.`;
                addMessage(done, "bot"); speak(done); beep();
            }, ms);
            return state.lang === "da-DK"
                ? `Timer sat til ${readable}, ${sir()}.`
                : `Timer set for ${readable}, ${sir()}.`;
        }

        // Beregn
        m = stripped.match(/^(beregn|calc|calculate|regn ud|what is|hvad er)\s+(.+)$/i);
        if (m) {
            try {
                const expr = m[2].replace(/x/gi, "*").replace(/plus/gi, "+").replace(/minus/gi, "-").replace(/divided by/gi, "/").replace(/[^-+*/().\d\s]/g, "");
                if (!expr.trim()) throw new Error("empty");
                const val = Function(`"use strict"; return (${expr});`)();
                return `${m[2]} = ${val}`;
            } catch (_) {
                return state.lang === "da-DK" ? `Jeg kunne ikke beregne det, ${sir()}.` : `I couldn't evaluate that, ${sir()}.`;
            }
        }

        // Vittighed
        if (/vittighed|joke|fortæl noget sjovt/.test(stripped)) {
            const jokesDa = [
                "Hvorfor tog programmøren sin computer til lægen? Den havde en virus.",
                "Der findes 10 slags mennesker: dem der forstår binært, og dem der ikke gør.",
                "Jeg ville fortælle en UDP-joke, men De ville alligevel ikke få den."
            ];
            const jokesEn = [
                `${sir()}, why did the developer go broke? He used up all his cache.`,
                `I'd tell you a UDP joke, ${sir()}, but you might not get it.`,
                `${sir()}, there are 10 kinds of people: those who understand binary, and those who do not.`,
                `Why do programmers prefer dark mode, ${sir()}? Because light attracts bugs.`
            ];
            return pick(state.lang === "da-DK" ? jokesDa : jokesEn);
        }

        if (/terning|dice|roll/.test(stripped)) {
            const n = Math.floor(Math.random() * 6) + 1;
            return state.lang === "da-DK" ? `Terningen viser ${n}, ${sir()}.` : `The dice shows ${n}, ${sir()}.`;
        }
        if (/plat eller krone|coin|flip/.test(stripped)) {
            const r = Math.random() < 0.5;
            return state.lang === "da-DK" ? (r ? `Krone, ${sir()}.` : `Plat, ${sir()}.`) : (r ? `Heads, ${sir()}.` : `Tails, ${sir()}.`);
        }

        if (/vejr|weather/.test(stripped)) {
            window.open(state.lang === "da-DK" ? "https://www.dmi.dk/" : "https://weather.com", "_blank", "noopener");
            return state.lang === "da-DK" ? `Henter vejrdata, ${sir()}.` : `Pulling up the weather, ${sir()}.`;
        }

        if (/nyheder|news/.test(stripped)) {
            window.open(state.lang === "da-DK" ? "https://dr.dk/nyheder" : "https://news.google.com", "_blank", "noopener");
            return state.lang === "da-DK" ? `Dagens overskrifter, ${sir()}.` : `Today's headlines, ${sir()}.`;
        }

        // Sprog
        if (/skift.*engelsk|switch to english|tal engelsk/.test(stripped)) {
            state.lang = "en-GB"; langSelect.value = "en-GB"; langLabel.textContent = "English (Jarvis)"; refreshVoice(); saveState();
            return `Switching to English, ${sir()}.`;
        }
        if (/switch to danish|skift.*dansk|tal dansk/.test(stripped)) {
            state.lang = "da-DK"; langSelect.value = "da-DK"; langLabel.textContent = "Dansk"; refreshVoice(); saveState();
            return `Skifter til dansk, ${sir()}.`;
        }

        // Hands-free
        if (/håndfri|hands.?free|always listen|bliv ved med at lytte/.test(stripped)) {
            state.handsFree = true;
            if (handsFreeToggle) handsFreeToggle.checked = true;
            saveState();
            setTimeout(() => startListening(), 800);
            return state.lang === "da-DK"
                ? `Håndfri aktiveret. Jeg lytter konstant, ${sir()}.`
                : `Hands-free engaged. I'm always listening, ${sir()}.`;
        }
        if (/stop lytning|stop listening|disengage/.test(stripped)) {
            state.handsFree = false;
            if (handsFreeToggle) handsFreeToggle.checked = false;
            saveState();
            stopListening();
            return state.lang === "da-DK" ? `Håndfri deaktiveret, ${sir()}.` : `Hands-free disengaged, ${sir()}.`;
        }

        // Ryd
        if (/^(ryd chat|clear chat)/.test(stripped)) {
            setTimeout(() => { state.history = []; chatEl.innerHTML = ""; saveState(); greet(); }, 200);
            return state.lang === "da-DK" ? `Rydder samtalen, ${sir()}.` : `Clearing the conversation, ${sir()}.`;
        }

        // Farvel
        if (/farvel|goodbye|bye|hej hej|powerdown|sluk/.test(stripped)) {
            return state.lang === "da-DK"
                ? `På gensyn, ${sir()}. Jeg er her, når De har brug for mig.`
                : `Goodbye, ${sir()}. I'll be here whenever you need me.`;
        }

        // Komplimenter
        if (/god(t)? arbejde|well done|good job|nice|du er fantastisk|smart/.test(stripped)) {
            return state.lang === "da-DK"
                ? `De er alt for venlig, ${sir()}.`
                : `You're too kind, ${sir()}.`;
        }

        // Fallback — Jarvis-style apology
        return state.lang === "da-DK"
            ? pick([
                `Jeg beklager, ${sir()}. Kunne De omformulere?`,
                `Det fangede jeg ikke helt, ${sir()}. Prøv "hjælp".`,
                `Tilgiv mig, ${sir()} — jeg er ikke sikker på, hvad De mener.`
            ])
            : pick([
                `I'm afraid I didn't quite catch that, ${sir()}. Could you rephrase?`,
                `My apologies, ${sir()} — I'm not certain I follow. Try "help".`,
                `Forgive me, ${sir()}, but that's outside my current parameters.`
            ]);
    }

    function beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880;
            g.gain.setValueAtTime(0.001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            o.start(); o.stop(ctx.currentTime + 0.65);
        } catch (_) {}
    }

    function tick() {
        const d = new Date();
        const locale = state.lang === "da-DK" ? "da-DK" : "en-GB";
        clockEl.textContent = d.toLocaleTimeString(locale);
        todayEl.textContent = d.toLocaleDateString(locale);
    }
    setInterval(tick, 1000); tick();

    function updateNetwork() {
        const on = navigator.onLine;
        connectionEl.textContent = on ? "ONLINE" : "OFFLINE";
        connectionEl.className = on ? "online" : "offline";
        networkEl.textContent = on ? t("Forbundet", "Connected") : t("Afbrudt", "Disconnected");
    }
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    updateNetwork();

    if (navigator.getBattery) {
        navigator.getBattery().then(b => {
            const render = () => { batteryEl.textContent = Math.round(b.level * 100) + "%" + (b.charging ? " ⚡" : ""); };
            render();
            b.addEventListener("levelchange", render);
            b.addEventListener("chargingchange", render);
        });
    } else {
        batteryEl.textContent = "N/A";
    }

    function greet() {
        const h = new Date().getHours();
        const greetEn = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
        const greetDa = h < 10 ? "Godmorgen" : h < 18 ? "Goddag" : "Godaften";
        const line = state.lang === "da-DK"
            ? `${greetDa}, ${sir()}. J.A.R.V.I.S. er online og til Deres tjeneste.`
            : `${greetEn}, ${sir()}. J.A.R.V.I.S. online and at your service.`;
        addMessage(line, "bot");
        speak(line);
    }

    state.history.slice(-10).forEach(h => {
        const div = document.createElement("div");
        div.className = `msg ${h.who}`;
        div.textContent = h.text;
        chatEl.appendChild(div);
    });
    chatEl.scrollTop = chatEl.scrollHeight;
    if (state.history.length === 0) greet();
    input.focus();
})();
