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
    const clockEl = document.getElementById("clock");
    const todayEl = document.getElementById("today");
    const userNameEl = document.getElementById("user-name");
    const langLabel = document.getElementById("lang-label");
    const batteryEl = document.getElementById("battery");
    const networkEl = document.getElementById("network");
    const connectionEl = document.getElementById("connection");

    const STORAGE_KEY = "jarvis.state.v1";
    const state = loadState();

    langSelect.value = state.lang;
    voiceToggle.checked = state.voice;
    userNameEl.textContent = state.name;
    langLabel.textContent = state.lang === "da-DK" ? "Dansk" : "English";

    // ---------- Utility ----------
    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { notes: [], reminders: [], history: [], name: "Sir", lang: "da-DK", voice: true, ...JSON.parse(raw) };
        } catch (_) {}
        return { notes: [], reminders: [], history: [], name: "Sir", lang: "da-DK", voice: true };
    }
    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function t(da, en) { return state.lang === "da-DK" ? da : en; }

    // ---------- Chat UI ----------
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
        orbLabel.textContent = label || "KLAR";
    }

    // ---------- Speech Synthesis ----------
    const synth = window.speechSynthesis;
    let voices = [];
    function refreshVoices() { voices = synth ? synth.getVoices() : []; }
    if (synth) {
        refreshVoices();
        synth.onvoiceschanged = refreshVoices;
    }

    function speak(text) {
        if (!voiceToggle.checked || !synth) return;
        try {
            synth.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = state.lang;
            const match = voices.find(v => v.lang === state.lang)
                || voices.find(v => v.lang && v.lang.startsWith(state.lang.slice(0, 2)));
            if (match) u.voice = match;
            u.rate = 1.0;
            u.pitch = 1.0;
            u.onstart = () => setOrbMode("speaking", t("TALER", "SPEAKING"));
            u.onend = () => setOrbMode(null, t("KLAR", "READY"));
            synth.speak(u);
        } catch (_) {}
    }

    // ---------- Speech Recognition ----------
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    let listening = false;

    function initRecognizer() {
        if (!SR) return null;
        const r = new SR();
        r.lang = state.lang;
        r.interimResults = false;
        r.continuous = false;
        r.onstart = () => {
            listening = true;
            micBtn.classList.add("active");
            setOrbMode("listening", t("LYTTER", "LISTENING"));
        };
        r.onresult = (e) => {
            const text = e.results[0][0].transcript;
            input.value = text;
            handleInput(text);
        };
        r.onerror = (e) => {
            addMessage(t("Jeg kunne ikke høre dig: ", "I couldn't hear you: ") + e.error, "sys");
            stopListening();
        };
        r.onend = () => stopListening();
        return r;
    }

    function startListening() {
        if (!SR) {
            addMessage(t("Talegenkendelse understøttes ikke i denne browser. Brug Chrome eller Edge.",
                         "Speech recognition isn't supported in this browser. Try Chrome or Edge."), "bot");
            return;
        }
        if (listening) return;
        recognizer = initRecognizer();
        try { recognizer.start(); } catch (_) {}
    }

    function stopListening() {
        listening = false;
        micBtn.classList.remove("active");
        if (!orb.classList.contains("speaking") && !orb.classList.contains("thinking")) {
            setOrbMode(null, t("KLAR", "READY"));
        }
    }

    micBtn.addEventListener("click", () => listening ? recognizer && recognizer.stop() : startListening());

    // ---------- Input handling ----------
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

    voiceToggle.addEventListener("change", () => {
        state.voice = voiceToggle.checked;
        saveState();
    });

    langSelect.addEventListener("change", () => {
        state.lang = langSelect.value;
        langLabel.textContent = state.lang === "da-DK" ? "Dansk" : "English";
        saveState();
        addMessage(t("Sprog skiftet til dansk.", "Language switched to English."), "sys");
    });

    function handleInput(raw) {
        const text = raw.trim();
        if (!text) return;
        addMessage(text, "user");
        setOrbMode("thinking", t("TÆNKER", "THINKING"));
        setTimeout(() => {
            const reply = respond(text);
            setOrbMode(null, t("KLAR", "READY"));
            addMessage(reply, "bot");
            speak(reply);
        }, 220);
    }

    // ---------- Command engine ----------
    function respond(text) {
        const q = text.toLowerCase().trim();

        // Wake-word stripping
        const stripped = q.replace(/^(hey |hej |ok |okay )?jarvis[,!? ]*/i, "").trim() || q;

        // 1. Hjælp / help
        if (/^(hjælp|help|kommandoer|commands|hvad kan du)/.test(stripped)) {
            return t(
`Jeg kan hjælpe med følgende:
• "hvad er klokken" / "dato"
• "åbn youtube/google/github/gmail/maps"
• "søg efter <emne>"
• "lav en note <tekst>" / "vis noter" / "slet noter"
• "påmind mig om <opgave>" / "vis påmindelser"
• "timer <tal> minutter/sekunder"
• "beregn 12 * 7"
• "fortæl en vittighed" / "kast terning" / "slå plat eller krone"
• "vejret" / "nyheder"
• "mit navn er <navn>"
• "skift sprog til engelsk"
• "ryd chat"`,
`I can help with:
• "what time is it" / "what's the date"
• "open youtube/google/github/gmail/maps"
• "search for <topic>"
• "note <text>" / "show notes" / "clear notes"
• "remind me to <task>" / "show reminders"
• "timer <n> minutes/seconds"
• "calculate 12 * 7"
• "tell a joke" / "roll a dice" / "flip a coin"
• "weather" / "news"
• "my name is <name>"
• "switch to danish"
• "clear chat"`);
        }

        // 2. Navn
        let m = stripped.match(/^(mit navn er|kald mig|my name is|call me)\s+(.+)$/i);
        if (m) {
            state.name = m[2].replace(/[.!?]/g, "").trim();
            userNameEl.textContent = state.name;
            saveState();
            return t(`Fornemt, ${state.name}. Jeg husker dit navn.`, `Noted, ${state.name}. I'll remember your name.`);
        }

        // 3. Tid
        if (/klokken|hvad er tiden|what time/.test(stripped)) {
            const d = new Date();
            return t(`Klokken er ${d.toLocaleTimeString("da-DK")}.`, `It's ${d.toLocaleTimeString("en-US")}.`);
        }

        // 4. Dato
        if (/dato|hvilken dag|what.*date|what day/.test(stripped)) {
            const d = new Date();
            return t(`I dag er det ${d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
                     `Today is ${d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`);
        }

        // 5. Åbn sites
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
            claude: "https://claude.ai"
        };
        m = stripped.match(/^(åbn|open|gå til|go to)\s+(.+)$/i);
        if (m) {
            const target = m[2].replace(/[.!?]/g, "").trim();
            const key = Object.keys(openMap).find(k => target.includes(k));
            if (key) {
                window.open(openMap[key], "_blank", "noopener");
                return t(`Åbner ${key}, ${state.name}.`, `Opening ${key}, ${state.name}.`);
            }
            const url = target.startsWith("http") ? target : "https://" + target.replace(/\s+/g, "");
            window.open(url, "_blank", "noopener");
            return t(`Forsøger at åbne ${target}.`, `Trying to open ${target}.`);
        }

        // 6. Søg
        m = stripped.match(/^(søg(?: efter)?|search(?: for)?|google)\s+(.+)$/i);
        if (m) {
            const q2 = m[2].trim();
            window.open("https://www.google.com/search?q=" + encodeURIComponent(q2), "_blank", "noopener");
            return t(`Søger efter "${q2}".`, `Searching for "${q2}".`);
        }

        // 7. Noter
        m = stripped.match(/^(lav (?:en )?note|note|notér|remember|husk)\s+(.+)$/i);
        if (m) {
            state.notes.push({ text: m[2].trim(), at: Date.now() });
            saveState();
            return t(`Noteret. Du har nu ${state.notes.length} note(r).`, `Noted. You have ${state.notes.length} note(s).`);
        }
        if (/^(vis noter|mine noter|show notes|list notes)/.test(stripped)) {
            if (!state.notes.length) return t("Du har ingen noter.", "You have no notes.");
            return state.notes.map((n, i) => `${i + 1}. ${n.text}`).join("\n");
        }
        if (/^(slet noter|ryd noter|clear notes)/.test(stripped)) {
            state.notes = [];
            saveState();
            return t("Alle noter slettet.", "All notes cleared.");
        }

        // 8. Påmindelser
        m = stripped.match(/^(påmind mig om|remind me to)\s+(.+)$/i);
        if (m) {
            state.reminders.push({ text: m[2].trim(), at: Date.now() });
            saveState();
            return t(`Jeg minder dig om: ${m[2].trim()}`, `I'll remember: ${m[2].trim()}`);
        }
        if (/^(vis påmindelser|show reminders)/.test(stripped)) {
            if (!state.reminders.length) return t("Ingen påmindelser.", "No reminders.");
            return state.reminders.map((n, i) => `${i + 1}. ${n.text}`).join("\n");
        }

        // 9. Timer
        m = stripped.match(/^timer\s+(\d+)\s*(sekund|sekunder|second|seconds|min|minut|minutter|minute|minutes)?/i);
        if (m) {
            const n = parseInt(m[1], 10);
            const unit = (m[2] || "minutter").toLowerCase();
            const ms = /sek|sec/.test(unit) ? n * 1000 : n * 60000;
            const readable = /sek|sec/.test(unit) ? `${n} ${t("sekunder", "seconds")}` : `${n} ${t("minutter", "minutes")}`;
            setTimeout(() => {
                const done = t(`Timer færdig: ${readable}.`, `Timer done: ${readable}.`);
                addMessage(done, "bot");
                speak(done);
                beep();
            }, ms);
            return t(`Timer sat til ${readable}.`, `Timer set for ${readable}.`);
        }

        // 10. Beregn
        m = stripped.match(/^(beregn|calc|calculate|regn ud)\s+(.+)$/i);
        if (m) {
            try {
                const expr = m[2].replace(/[^-+*/().\d\s]/g, "");
                if (!expr) throw new Error("empty");
                // eslint-disable-next-line no-new-func
                const val = Function(`"use strict"; return (${expr});`)();
                return `${m[2]} = ${val}`;
            } catch (_) {
                return t("Kunne ikke beregne udtrykket.", "Couldn't evaluate that expression.");
            }
        }

        // 11. Vittighed
        if (/vittighed|joke/.test(stripped)) {
            const jokesDa = [
                "Hvorfor tog programmøren sin computer til lægen? — Den havde en virus.",
                "Hvad sagde nul til otte? — Flot bælte.",
                "Jeg ville fortælle en UDP-joke, men du ville alligevel ikke få den.",
                "Der findes 10 slags mennesker: dem der forstår binært, og dem der ikke gør."
            ];
            const jokesEn = [
                "Why did the developer go broke? Because he used up all his cache.",
                "I told a UDP joke, but you might not get it.",
                "There are 10 kinds of people: those who understand binary and those who don't.",
                "Why do programmers prefer dark mode? Because light attracts bugs."
            ];
            const arr = state.lang === "da-DK" ? jokesDa : jokesEn;
            return arr[Math.floor(Math.random() * arr.length)];
        }

        // 12. Terning
        if (/terning|dice|roll/.test(stripped)) {
            const n = Math.floor(Math.random() * 6) + 1;
            return t(`Terningen viser ${n}.`, `The dice shows ${n}.`);
        }

        // 13. Plat eller krone
        if (/plat eller krone|coin|flip/.test(stripped)) {
            const r = Math.random() < 0.5;
            return t(r ? "Krone." : "Plat.", r ? "Heads." : "Tails.");
        }

        // 14. Vejret
        if (/vejr|weather/.test(stripped)) {
            window.open("https://www.dmi.dk/", "_blank", "noopener");
            return t("Åbner DMI for dig.", "Opening weather for you.");
        }

        // 15. Nyheder
        if (/nyheder|news/.test(stripped)) {
            window.open(state.lang === "da-DK" ? "https://dr.dk/nyheder" : "https://news.google.com", "_blank", "noopener");
            return t("Åbner nyhederne.", "Opening the news.");
        }

        // 16. Sprog
        if (/skift sprog til engelsk|switch to english/.test(stripped)) {
            state.lang = "en-US"; langSelect.value = "en-US"; langLabel.textContent = "English"; saveState();
            return "Language switched to English.";
        }
        if (/switch to danish|skift sprog til dansk/.test(stripped)) {
            state.lang = "da-DK"; langSelect.value = "da-DK"; langLabel.textContent = "Dansk"; saveState();
            return "Sprog skiftet til dansk.";
        }

        // 17. Ryd chat
        if (/^(ryd chat|clear chat)/.test(stripped)) {
            setTimeout(() => { state.history = []; chatEl.innerHTML = ""; saveState(); greet(); }, 200);
            return t("Rydder samtalen...", "Clearing conversation...");
        }

        // 18. Hilsener / smalltalk
        if (/^(hej|hallo|hello|hi|yo)/.test(stripped)) {
            return t(`Godt at høre fra dig, ${state.name}. Hvordan kan jeg hjælpe?`,
                     `Good to hear from you, ${state.name}. How can I help?`);
        }
        if (/hvordan har du det|how are you/.test(stripped)) {
            return t("Alle systemer kører optimalt, tak fordi du spørger.", "All systems nominal, thank you for asking.");
        }
        if (/tak|thanks|thank you/.test(stripped)) {
            return t("Altid en fornøjelse.", "Always a pleasure.");
        }
        if (/(hvem er du|who are you)/.test(stripped)) {
            return t("Jeg er Jarvis — din personlige assistent, bygget til at tjene.",
                     "I am Jarvis — your personal assistant, built to serve.");
        }

        // fallback
        return t(
            `Jeg fangede ikke helt det, ${state.name}. Prøv "hjælp" for at se mine kommandoer.`,
            `I didn't quite catch that, ${state.name}. Try "help" to see my commands.`
        );
    }

    // ---------- Small beep ----------
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
            o.start();
            o.stop(ctx.currentTime + 0.65);
        } catch (_) {}
    }

    // ---------- Status widgets ----------
    function tick() {
        const d = new Date();
        clockEl.textContent = d.toLocaleTimeString(state.lang === "da-DK" ? "da-DK" : "en-US");
        todayEl.textContent = d.toLocaleDateString(state.lang === "da-DK" ? "da-DK" : "en-US");
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

    // ---------- Init ----------
    function greet() {
        const hour = new Date().getHours();
        const part = state.lang === "da-DK"
            ? (hour < 10 ? "God morgen" : hour < 18 ? "God dag" : "God aften")
            : (hour < 10 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
        const greeting = t(
            `${part}, ${state.name}. Jarvis er online. Sig "hjælp" for at se hvad jeg kan.`,
            `${part}, ${state.name}. Jarvis is online. Say "help" to see what I can do.`
        );
        addMessage(greeting, "bot");
        speak(greeting);
    }

    // Replay last few history items (without speaking)
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
