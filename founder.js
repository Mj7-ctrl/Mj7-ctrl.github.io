(() => {
    "use strict";

    const STORAGE_KEY = "founder.v1";
    const DEFAULTS = {
        name: "",
        apiKey: "",
        model: "claude-sonnet-4-6",
        lang: "da",
        tab: "generate",
        form: { skills: "", time: "side", capital: "low", market: "global" },
        ideas: [],
        archive: [],
        currentIdea: null,
        currentValidation: null,
        currentPitch: null
    };

    const state = load();

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
        } catch (_) {}
        return structuredClone(DEFAULTS);
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }

    const L = {
        da: {
            tagline: "AI business copilot",
            heroGenTitle: "Find din næste forretning.",
            heroGenSub: "Fortæl AI'en om dig — så leverer den 5 skræddersyede idéer med indtægtsestimater og vurderinger.",
            skillsLbl: "Dine skills & interesser",
            skillsPh: "Fx: jeg er udvikler med 5 års erfaring, interesseret i fitness, kan skrive på engelsk, har erfaring med SaaS…",
            timeLbl: "Tid pr. uge",
            capitalLbl: "Startkapital",
            marketLbl: "Marked",
            timeOpts: { side: "Side-projekt (5-10t)", half: "Halvtid (20t)", full: "Fuldtid (40t+)" },
            capitalOpts: { zero: "0 kr", low: "< 10.000", mid: "10-100k", high: "100k+" },
            marketOpts: { dk: "Danmark", scan: "Skandinavien", eu: "Europa", global: "Globalt" },
            generate: "✦ Generér 5 idéer",
            regenerate: "↻ Generér igen",
            validate: "Validér",
            save: "Gem",
            saved: "Gemt",
            needApi: "Tilføj din API-nøgle i indstillinger ⚙ for at bruge AI'en.",
            thinking: "AI'en tænker dybt…",
            validateTitle: "Dyb validering",
            validateSub: "Indsæt din idé — jeg analyserer marked, konkurrence, risici og giver dig en konkret MVP-plan.",
            validatePh: "Beskriv din idé så præcist du kan. Hvem er kunden? Hvilket problem løser det?",
            analyze: "◎ Analysér",
            pitchTitle: "Auto-pitch",
            pitchSub: "Vælg en idé fra arkivet eller indtast en ny — jeg bygger en 6-slides pitch på 10 sekunder.",
            buildPitch: "◈ Byg pitch",
            pickFromArchive: "Vælg fra arkiv:",
            or: "— eller —",
            archiveTitle: "Dit arkiv",
            archiveSub: "Gemte idéer og valideringer.",
            archiveEmpty: "Endnu ingen gemte idéer. Generér nogle på ✦ Generér-fanen.",
            generateEmpty: "Udfyld formularen og tryk generér for at se 5 skræddersyede forretningsidéer.",
            confirmReset: "Sikker? Alt slettes lokalt.",
            confirmDelete: "Slet denne idé?",
            exportCopied: "Data kopieret til clipboard.",
            estimated: "Estimeret",
            perMonth: "/md",
            potential: "Potentiale",
            effort: "Indsats",
            fit: "Pasform",
            verdictLbl: "Samlet score",
            scoring: "Scorer idé…",
            error: "Kunne ikke nå AI'en. Tjek din nøgle og prøv igen."
        },
        en: {
            tagline: "AI business copilot",
            heroGenTitle: "Find your next venture.",
            heroGenSub: "Tell the AI about you — get 5 tailored ideas with revenue estimates and scores.",
            skillsLbl: "Your skills & interests",
            skillsPh: "E.g. I'm a developer with 5 years' experience, into fitness, write well in English, have SaaS experience…",
            timeLbl: "Time per week",
            capitalLbl: "Starting capital",
            marketLbl: "Market",
            timeOpts: { side: "Side (5-10h)", half: "Part (20h)", full: "Full-time (40h+)" },
            capitalOpts: { zero: "$0", low: "< $1.5k", mid: "$1.5-15k", high: "$15k+" },
            marketOpts: { dk: "Denmark", scan: "Scandinavia", eu: "Europe", global: "Global" },
            generate: "✦ Generate 5 ideas",
            regenerate: "↻ Generate again",
            validate: "Validate",
            save: "Save",
            saved: "Saved",
            needApi: "Add your API key in settings ⚙ to use the AI.",
            thinking: "AI is thinking deeply…",
            validateTitle: "Deep validation",
            validateSub: "Paste your idea — I'll analyze market, competition, risks and give you a concrete MVP plan.",
            validatePh: "Describe your idea precisely. Who is the customer? What problem does it solve?",
            analyze: "◎ Analyze",
            pitchTitle: "Auto-pitch",
            pitchSub: "Pick an idea from archive or type a new one — I'll build a 6-slide pitch in 10 seconds.",
            buildPitch: "◈ Build pitch",
            pickFromArchive: "Pick from archive:",
            or: "— or —",
            archiveTitle: "Your archive",
            archiveSub: "Saved ideas & validations.",
            archiveEmpty: "No saved ideas yet. Generate some on the ✦ Generate tab.",
            generateEmpty: "Fill the form and tap generate to see 5 tailored business ideas.",
            confirmReset: "Sure? All data will be wiped locally.",
            confirmDelete: "Delete this idea?",
            exportCopied: "Data copied to clipboard.",
            estimated: "Est.",
            perMonth: "/mo",
            potential: "Potential",
            effort: "Effort",
            fit: "Fit",
            verdictLbl: "Overall score",
            scoring: "Scoring idea…",
            error: "Could not reach the AI. Check your key and try again."
        }
    };
    const t = () => L[state.lang] || L.da;

    // ---------- DOM refs ----------
    const view = document.getElementById("view");
    const tabs = document.querySelectorAll(".tab");
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const nameInput = document.getElementById("name-input");
    const apiKeyInput = document.getElementById("api-key-input");
    const modelSelect = document.getElementById("model-select");
    const langSelect = document.getElementById("lang-select");
    const settingsSave = document.getElementById("settings-save");
    const settingsClose = document.getElementById("settings-close");
    const exportBtn = document.getElementById("export-btn");
    const resetBtn = document.getElementById("reset-btn");
    const toastEl = document.getElementById("toast");
    const brandSub = document.getElementById("brand-sub");

    // ---------- Background canvas ----------
    const canvas = document.getElementById("bg");
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    const stars = [];
    const N = 90;
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize); resize();
    for (let i = 0; i < N; i++) {
        stars.push({
            x: Math.random(), y: Math.random(),
            r: Math.random() * 1.2 + 0.2,
            a: Math.random() * 0.5 + 0.15,
            s: Math.random() * 0.00008 + 0.00002,
            p: Math.random() * Math.PI * 2
        });
    }
    function tick(now) {
        ctx.clearRect(0, 0, W, H);
        // gradient wash
        const g = ctx.createRadialGradient(W * 0.15, H * 0.2, 0, W * 0.15, H * 0.2, Math.max(W, H) * 0.8);
        g.addColorStop(0, "rgba(244, 194, 107, 0.08)");
        g.addColorStop(0.35, "rgba(162, 128, 255, 0.04)");
        g.addColorStop(1, "rgba(7, 8, 12, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
            const x = s.x * W;
            const y = s.y * H + Math.sin(now * s.s + s.p) * 4;
            const a = s.a * (0.6 + 0.4 * Math.sin(now * 0.001 + s.p));
            ctx.beginPath();
            ctx.arc(x, y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 235, 200, ${a})`;
            ctx.fill();
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // ---------- Toast ----------
    let toastTimer;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
    }

    // ---------- Router ----------
    function setTab(name) {
        state.tab = name;
        tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
        render();
        save();
    }
    tabs.forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

    function render() {
        view.innerHTML = "";
        view.classList.remove("view-enter");
        void view.offsetWidth;
        view.classList.add("view-enter");
        const fn = {
            generate: renderGenerate,
            validate: renderValidate,
            pitch: renderPitch,
            archive: renderArchive
        }[state.tab] || renderGenerate;
        fn();
    }

    // ---------- Generate view ----------
    function renderGenerate() {
        const x = t();
        const container = document.createElement("div");
        container.innerHTML = `
            <div class="hero">
                <h1>${x.heroGenTitle}</h1>
                <p>${x.heroGenSub}</p>
            </div>

            <div class="card">
                <div class="field">
                    <label>${x.skillsLbl}</label>
                    <textarea id="f-skills" placeholder="${x.skillsPh}"></textarea>
                </div>
                <div class="field">
                    <label>${x.timeLbl}</label>
                    <div class="chips" id="f-time">
                        ${Object.entries(x.timeOpts).map(([k, v]) =>
                            `<div class="chip" data-v="${k}">${v}</div>`).join("")}
                    </div>
                </div>
                <div class="field">
                    <label>${x.capitalLbl}</label>
                    <div class="chips" id="f-capital">
                        ${Object.entries(x.capitalOpts).map(([k, v]) =>
                            `<div class="chip" data-v="${k}">${v}</div>`).join("")}
                    </div>
                </div>
                <div class="field">
                    <label>${x.marketLbl}</label>
                    <div class="chips" id="f-market">
                        ${Object.entries(x.marketOpts).map(([k, v]) =>
                            `<div class="chip" data-v="${k}">${v}</div>`).join("")}
                    </div>
                </div>
                <button class="btn primary" id="gen-btn">
                    ${state.ideas.length ? x.regenerate : x.generate}
                </button>
            </div>

            <div id="gen-results"></div>
        `;
        view.appendChild(container);

        const skillsInput = container.querySelector("#f-skills");
        skillsInput.value = state.form.skills || "";
        skillsInput.addEventListener("input", e => { state.form.skills = e.target.value; save(); });

        ["time", "capital", "market"].forEach(field => {
            const chipRow = container.querySelector(`#f-${field}`);
            chipRow.querySelectorAll(".chip").forEach(chip => {
                if (chip.dataset.v === state.form[field]) chip.classList.add("active");
                chip.addEventListener("click", () => {
                    chipRow.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
                    chip.classList.add("active");
                    state.form[field] = chip.dataset.v;
                    save();
                });
            });
        });

        container.querySelector("#gen-btn").addEventListener("click", generateIdeas);

        const results = container.querySelector("#gen-results");
        if (state.ideas.length) {
            results.innerHTML = "";
            state.ideas.forEach((idea, i) => results.appendChild(buildIdeaCard(idea, i)));
        } else {
            results.innerHTML = `<div class="empty"><div class="empty-ico">✦</div><p>${x.generateEmpty}</p></div>`;
        }
    }

    function buildIdeaCard(idea, i) {
        const x = t();
        const el = document.createElement("div");
        el.className = "idea";
        el.style.animationDelay = `${i * 60}ms`;
        el.innerHTML = `
            <div class="idea-head">
                <div class="idea-name">${escapeHtml(idea.name)}</div>
                <div class="idea-rev">${escapeHtml(idea.revenue || "—")}${x.perMonth}</div>
            </div>
            <div class="idea-pitch">${escapeHtml(idea.pitch)}</div>
            <div class="scores">
                <div class="score">
                    <div class="score-lbl">${x.potential}</div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${idea.potential * 10}%"></div></div>
                    <div class="score-val">${idea.potential}/10</div>
                </div>
                <div class="score">
                    <div class="score-lbl">${x.effort}</div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${idea.effort * 10}%"></div></div>
                    <div class="score-val">${idea.effort}/10</div>
                </div>
                <div class="score">
                    <div class="score-lbl">${x.fit}</div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${idea.fit * 10}%"></div></div>
                    <div class="score-val">${idea.fit}/10</div>
                </div>
            </div>
            <div class="idea-actions">
                <button class="primary" data-act="validate">${x.validate}</button>
                <button data-act="save">${isSaved(idea) ? "✓ " + x.saved : x.save}</button>
            </div>
        `;
        el.querySelector('[data-act="validate"]').addEventListener("click", () => {
            state.currentIdea = idea;
            state.currentValidation = null;
            setTab("validate");
        });
        el.querySelector('[data-act="save"]').addEventListener("click", (e) => {
            if (isSaved(idea)) return;
            state.archive.unshift({ ...idea, savedAt: Date.now(), id: genId() });
            save();
            e.target.textContent = "✓ " + x.saved;
            toast(x.saved);
        });
        return el;
    }

    function isSaved(idea) {
        return state.archive.some(a => a.name === idea.name && a.pitch === idea.pitch);
    }

    // ---------- Validate view ----------
    function renderValidate() {
        const x = t();
        const prefill = state.currentIdea
            ? `${state.currentIdea.name}: ${state.currentIdea.pitch}`
            : "";
        const container = document.createElement("div");
        container.innerHTML = `
            <div class="hero">
                <h1>${x.validateTitle}</h1>
                <p>${x.validateSub}</p>
            </div>
            <div class="card">
                <div class="field">
                    <textarea id="v-input" placeholder="${x.validatePh}">${escapeHtml(prefill)}</textarea>
                </div>
                <button class="btn primary" id="v-btn">${x.analyze}</button>
            </div>
            <div id="v-results"></div>
        `;
        view.appendChild(container);

        container.querySelector("#v-btn").addEventListener("click", () => {
            const text = container.querySelector("#v-input").value.trim();
            if (!text) return toast(x.validatePh);
            validateIdea(text);
        });

        if (state.currentValidation) {
            renderValidation(container.querySelector("#v-results"), state.currentValidation);
        }
    }

    function renderValidation(target, v) {
        const x = t();
        target.innerHTML = "";
        const out = document.createElement("div");

        if (v.score != null) {
            const verdict = document.createElement("div");
            verdict.className = "verdict";
            verdict.innerHTML = `
                <div class="verdict-score">${v.score}<span class="pct">/100</span></div>
                <div class="verdict-lbl">${x.verdictLbl}</div>
                ${v.verdict ? `<div class="verdict-note">"${escapeHtml(v.verdict)}"</div>` : ""}
            `;
            out.appendChild(verdict);
        }

        const sections = [
            ["P", "Problem", v.problem],
            ["L", "Løsning / Solution", v.solution],
            ["M", "Marked / Market", v.market],
            ["C", "Konkurrence / Competition", v.competition],
            ["R", "Risici / Risks", v.risks],
            ["G", "Go-to-market", v.gtm],
            ["V", "MVP — 2 uger", v.mvp],
            ["N", "Næste skridt / Next steps", v.nextSteps]
        ];
        sections.forEach(([ico, title, body]) => {
            if (!body) return;
            const s = document.createElement("div");
            s.className = "section";
            s.innerHTML = `
                <div class="section-head">
                    <div class="section-ico">${ico}</div>
                    <div class="section-title">${title}</div>
                </div>
                <div class="section-body">${formatSection(body)}</div>
            `;
            out.appendChild(s);
        });
        target.appendChild(out);
    }

    function formatSection(v) {
        if (Array.isArray(v)) {
            return `<ul>${v.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
        }
        return escapeHtml(String(v));
    }

    // ---------- Pitch view ----------
    function renderPitch() {
        const x = t();
        const container = document.createElement("div");
        container.innerHTML = `
            <div class="hero">
                <h1>${x.pitchTitle}</h1>
                <p>${x.pitchSub}</p>
            </div>
            <div class="card">
                ${state.archive.length ? `
                    <div class="field">
                        <label>${x.pickFromArchive}</label>
                        <select id="p-pick">
                            <option value="">—</option>
                            ${state.archive.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="field"><label>${x.or}</label></div>
                ` : ""}
                <div class="field">
                    <textarea id="p-input" placeholder="${t().validatePh}"></textarea>
                </div>
                <button class="btn primary" id="p-btn">${x.buildPitch}</button>
            </div>
            <div id="p-results"></div>
        `;
        view.appendChild(container);

        const pick = container.querySelector("#p-pick");
        const inp = container.querySelector("#p-input");
        if (pick) pick.addEventListener("change", () => {
            const a = state.archive.find(x => x.id === pick.value);
            if (a) inp.value = `${a.name}: ${a.pitch}`;
        });

        container.querySelector("#p-btn").addEventListener("click", () => {
            const text = inp.value.trim();
            if (!text) return toast(x.validatePh);
            buildPitch(text);
        });

        if (state.currentPitch) renderPitchResult(container.querySelector("#p-results"), state.currentPitch);
    }

    function renderPitchResult(target, pitch) {
        target.innerHTML = "";
        pitch.slides.forEach((s, i) => {
            const el = document.createElement("div");
            el.className = "slide";
            el.style.animationDelay = `${i * 80}ms`;
            el.innerHTML = `
                <div class="slide-num">Slide ${i + 1} / ${pitch.slides.length}</div>
                <div class="slide-title">${escapeHtml(s.title)}</div>
                <div class="slide-body">${escapeHtml(s.body)}</div>
            `;
            target.appendChild(el);
        });
    }

    // ---------- Archive view ----------
    function renderArchive() {
        const x = t();
        const container = document.createElement("div");
        container.innerHTML = `
            <div class="hero">
                <h1>${x.archiveTitle}</h1>
                <p>${x.archiveSub}</p>
            </div>
            <div id="arc-list"></div>
        `;
        view.appendChild(container);
        const list = container.querySelector("#arc-list");
        if (!state.archive.length) {
            list.innerHTML = `<div class="empty"><div class="empty-ico">◨</div><p>${x.archiveEmpty}</p></div>`;
            return;
        }
        state.archive.forEach(a => {
            const el = document.createElement("div");
            el.className = "arc-item";
            el.innerHTML = `
                <div class="arc-body">
                    <div class="arc-name">${escapeHtml(a.name)}</div>
                    <div class="arc-pitch">${escapeHtml(a.pitch)}</div>
                </div>
                <div class="arc-rev">${escapeHtml(a.revenue || "—")}${x.perMonth}</div>
                <button class="arc-del" title="Slet">×</button>
            `;
            el.addEventListener("click", (e) => {
                if (e.target.classList.contains("arc-del")) return;
                state.currentIdea = a;
                state.currentValidation = null;
                setTab("validate");
            });
            el.querySelector(".arc-del").addEventListener("click", (e) => {
                e.stopPropagation();
                if (!confirm(x.confirmDelete)) return;
                state.archive = state.archive.filter(i => i.id !== a.id);
                save();
                render();
            });
            list.appendChild(el);
        });
    }

    // ---------- AI calls ----------
    async function callAI(systemPrompt, userPrompt, maxTokens = 2000) {
        if (!state.apiKey) throw new Error("no-api-key");
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
                max_tokens: maxTokens,
                system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
                messages: [{ role: "user", content: userPrompt }]
            })
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API ${res.status}: ${err}`);
        }
        const data = await res.json();
        return data.content[0].text.trim();
    }

    function extractJson(text) {
        // Strip code fences if present
        const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fence) text = fence[1];
        // Find first { or [ and last matching
        const firstBrace = text.indexOf("{");
        const firstBracket = text.indexOf("[");
        let start = -1, endChar = "";
        if (firstBrace === -1 && firstBracket === -1) throw new Error("no-json");
        if (firstBrace === -1) { start = firstBracket; endChar = "]"; }
        else if (firstBracket === -1) { start = firstBrace; endChar = "}"; }
        else if (firstBracket < firstBrace) { start = firstBracket; endChar = "]"; }
        else { start = firstBrace; endChar = "}"; }
        const end = text.lastIndexOf(endChar);
        if (end <= start) throw new Error("bad-json");
        return JSON.parse(text.slice(start, end + 1));
    }

    async function generateIdeas() {
        const x = t();
        if (!state.apiKey) { toast(x.needApi); openSettings(); return; }
        const results = document.getElementById("gen-results");
        results.innerHTML = `<div class="thinking"><div class="orb"></div><p>${x.thinking}</p></div>`;

        const lang = state.lang === "da" ? "Danish" : "English";
        const time = x.timeOpts[state.form.time];
        const cap = x.capitalOpts[state.form.capital];
        const mkt = x.marketOpts[state.form.market];
        const skills = state.form.skills || "(none specified)";

        const system = `You are a world-class startup strategist with deep knowledge of 2026 markets, AI tools, emerging niches, and proven business models. You generate exceptional, non-obvious business ideas tailored precisely to the user's profile. You favor ideas with strong unit economics, real monthly revenue potential within 12 months, and clear paths to scale.

Respond ONLY with valid JSON, no prose, no markdown. Write the "name", "pitch", and "revenue" fields in ${lang}.`;

        const user = `Generate exactly 5 highly tailored business ideas for this founder. Each idea must be specific (not generic), plausible in 2026, and leverage the founder's skills.

Founder profile:
- Skills / interests: ${skills}
- Available time: ${time}
- Starting capital: ${cap}
- Target market: ${mkt}

Return JSON with this EXACT shape:
{
  "ideas": [
    {
      "name": "Short punchy name (max 5 words)",
      "pitch": "One-sentence pitch that explains the product, customer, and why it will win (max 35 words)",
      "revenue": "Realistic monthly revenue after 12 months as a short string like '€5k-15k' or 'DKK 30-80k'",
      "potential": 1-10 integer (market upside),
      "effort": 1-10 integer (higher = more effort),
      "fit": 1-10 integer (match to founder profile)
    }
  ]
}

Be concrete, specific, and ambitious. Avoid generic advice like "start a blog". Every idea should feel like a real opportunity a smart founder could start this weekend.`;

        try {
            const raw = await callAI(system, user, 1500);
            const parsed = extractJson(raw);
            const ideas = (parsed.ideas || []).slice(0, 5).map(i => ({
                name: String(i.name || "").slice(0, 80),
                pitch: String(i.pitch || "").slice(0, 400),
                revenue: String(i.revenue || ""),
                potential: clamp(i.potential, 1, 10),
                effort: clamp(i.effort, 1, 10),
                fit: clamp(i.fit, 1, 10)
            }));
            state.ideas = ideas;
            save();
            render();
        } catch (e) {
            console.error(e);
            results.innerHTML = `<div class="error">${x.error}<br><small>${escapeHtml(String(e.message || e))}</small></div>`;
        }
    }

    async function validateIdea(ideaText) {
        const x = t();
        if (!state.apiKey) { toast(x.needApi); openSettings(); return; }
        const results = document.getElementById("v-results");
        results.innerHTML = `<div class="thinking"><div class="orb"></div><p>${x.thinking}</p></div>`;

        const lang = state.lang === "da" ? "Danish" : "English";
        const system = `You are a rigorous startup validator with investor-grade judgment. You analyze ideas honestly, identify real risks, size markets with realistic numbers, and propose concrete MVP plans. You are never vague. You are never sycophantic.

Respond ONLY with valid JSON, no prose, no markdown. All string values in ${lang}.`;

        const user = `Deeply validate this startup idea:

"""
${ideaText}
"""

Return JSON with this EXACT shape (no other fields):
{
  "score": 0-100 integer (honest overall viability),
  "verdict": "One short sentence — your honest take",
  "problem": "2-3 sentences: is the problem real? How acute?",
  "solution": "2-3 sentences: is the solution a good fit? What's the unique angle?",
  "market": "2-3 sentences with concrete TAM/SAM numbers (or ranges) and growth",
  "competition": ["3-5 bullet points: actual competitors or alternatives with one-line differentiation"],
  "risks": ["The top 3-4 real risks, each as one concrete sentence"],
  "gtm": ["4-6 concrete go-to-market tactics, each as one actionable sentence"],
  "mvp": ["A 2-week MVP plan as 5-7 concrete daily/sub-weekly milestones"],
  "nextSteps": ["The 3 very next actions to take this week, each as one action verb + outcome"]
}

Be brutally honest. If the idea is weak, score it low and say why. If it's strong, show exactly why.`;

        try {
            const raw = await callAI(system, user, 2500);
            const parsed = extractJson(raw);
            state.currentValidation = parsed;
            save();
            render();
        } catch (e) {
            console.error(e);
            results.innerHTML = `<div class="error">${x.error}<br><small>${escapeHtml(String(e.message || e))}</small></div>`;
        }
    }

    async function buildPitch(ideaText) {
        const x = t();
        if (!state.apiKey) { toast(x.needApi); openSettings(); return; }
        const results = document.getElementById("p-results");
        results.innerHTML = `<div class="thinking"><div class="orb"></div><p>${x.thinking}</p></div>`;

        const lang = state.lang === "da" ? "Danish" : "English";
        const system = `You are an elite startup pitch coach who has helped unicorns raise billions. You build tight, investor-ready pitch narratives that are specific, compelling, and credible.

Respond ONLY with valid JSON. All text in ${lang}.`;

        const user = `Build a 6-slide investor pitch for this idea:

"""
${ideaText}
"""

Return JSON:
{
  "slides": [
    {"title": "The problem", "body": "..."},
    {"title": "The solution", "body": "..."},
    {"title": "Why now (2026)", "body": "..."},
    {"title": "Market & model", "body": "..."},
    {"title": "Traction & moat", "body": "..."},
    {"title": "The ask", "body": "..."}
  ]
}

Each body: 3-5 punchy sentences. Concrete numbers where plausible. No buzzwords. Specific, credible, persuasive.`;

        try {
            const raw = await callAI(system, user, 2000);
            const parsed = extractJson(raw);
            state.currentPitch = parsed;
            save();
            render();
        } catch (e) {
            console.error(e);
            results.innerHTML = `<div class="error">${x.error}<br><small>${escapeHtml(String(e.message || e))}</small></div>`;
        }
    }

    // ---------- Settings ----------
    function openSettings() {
        nameInput.value = state.name;
        apiKeyInput.value = state.apiKey;
        modelSelect.value = state.model;
        langSelect.value = state.lang;
        settingsModal.classList.remove("hidden");
    }
    function closeSettings() { settingsModal.classList.add("hidden"); }

    settingsBtn.addEventListener("click", openSettings);
    settingsClose.addEventListener("click", closeSettings);
    settingsModal.addEventListener("click", e => { if (e.target === settingsModal) closeSettings(); });

    settingsSave.addEventListener("click", () => {
        state.name = nameInput.value.trim();
        state.apiKey = apiKeyInput.value.trim();
        state.model = modelSelect.value;
        state.lang = langSelect.value;
        save();
        applyLang();
        closeSettings();
        render();
        toast("✓");
    });

    exportBtn.addEventListener("click", async () => {
        const data = JSON.stringify(state, null, 2);
        try {
            await navigator.clipboard.writeText(data);
            toast(t().exportCopied);
        } catch (_) {
            const blob = new Blob([data], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "founder-export.json";
            a.click();
        }
    });

    resetBtn.addEventListener("click", () => {
        if (!confirm(t().confirmReset)) return;
        const kept = { apiKey: state.apiKey, model: state.model, lang: state.lang };
        Object.assign(state, structuredClone(DEFAULTS), kept);
        save();
        closeSettings();
        render();
    });

    function applyLang() {
        brandSub.textContent = t().tagline;
        document.documentElement.lang = state.lang;
    }

    // ---------- Utils ----------
    function clamp(v, lo, hi) { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : lo; }
    function escapeHtml(s) {
        return String(s ?? "").replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
    function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

    // ---------- Init ----------
    applyLang();
    setTab(state.tab || "generate");
})();
