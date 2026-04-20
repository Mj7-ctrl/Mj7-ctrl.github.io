(() => {
    "use strict";

    const STORAGE_KEY = "agent-deck.v1";
    const JARVIS_KEY = "jarvis.v4";

    const AGENTS = [
        {
            id: "content",
            icon: "✍️",
            name: "Content Creator",
            tagline: "Skriver blogindlæg, LinkedIn-posts og tråde der driver trafik til tilbud.",
            defaultBrief: "Skriv 3 LinkedIn-posts og 1 blogindlægs-outline, der kan drive leads til min niche.",
            system: `You are a senior content strategist specialising in building personal brands that generate real revenue. You produce: hook-driven LinkedIn posts, X/Twitter threads, blog outlines, newsletter intros. Every piece must have a clear conversion angle (signup, DM, product link). Use short paragraphs, strong hooks in line 1, no filler. Output ready-to-publish drafts in Danish unless user writes in English.`
        },
        {
            id: "market",
            icon: "📊",
            name: "Market Researcher",
            tagline: "Finder profitable nicher, underserverede målgrupper og trending keywords.",
            defaultBrief: "Find 5 undersold micro-nicher jeg kan angribe nu, med konkret evidens for efterspørgsel.",
            system: `You are a market research analyst. Identify underserved niches, validated demand signals (reddit threads, niche subreddits, communities, search trends, marketplaces with paying customers). Give specific evidence: community names, forum threads, paid product examples, pricing. Rank by: ease of entry, revenue potential, competition. Be concrete, no fluff. Output in Danish.`
        },
        {
            id: "freelance",
            icon: "💼",
            name: "Freelance Hunter",
            tagline: "Finder konkrete gigs, pitch-templates og outreach-beskeder.",
            defaultBrief: "Giv mig 5 gig-typer jeg kan sælge i næste uge, med kolde DM-templates.",
            system: `You are a freelance sales coach. Propose specific gig types a solo operator can deliver in under a week, with:
- exact deliverable
- realistic price range (DKK/EUR)
- where to find clients (platforms, communities, cold outreach)
- ready-to-copy outreach DM/email template (Danish)
- red flags to avoid
Be tactical and ready-to-execute today. Output in Danish.`
        },
        {
            id: "copy",
            icon: "🎯",
            name: "Copywriter",
            tagline: "Højkonverterende sales-copy, landing pages, ads og email-sekvenser.",
            defaultBrief: "Skriv landing page headline + subhead + 3 bullets + CTA for mit tilbud.",
            system: `You are a direct-response copywriter in the tradition of Hopkins, Kennedy, Halbert. Structure: big promise headline, urgent subhead, bullet-benefits (feature→benefit→outcome), proof, CTA. Match the reader's internal monologue. Tight, specific, no generic adjectives. Output ready-to-paste copy in Danish.`
        },
        {
            id: "product",
            icon: "💡",
            name: "Product Ideator",
            tagline: "Konkrete digitale produkt- og SaaS-idéer baseret på din niche.",
            defaultBrief: "Giv mig 5 digitale produkter jeg kan bygge solo på <14 dage og sælge for 200-2000 kr.",
            system: `You are a product strategist specialising in small digital products (templates, notion systems, mini-SaaS, scripts, prompt packs, paid newsletters, short courses). For each idea include:
- one-line value prop
- who exactly buys this
- realistic pricing
- time-to-MVP
- first 3 distribution channels
Favour ideas that can be built solo in under 2 weeks. Output in Danish.`
        },
        {
            id: "seo",
            icon: "🔍",
            name: "SEO Strategist",
            tagline: "Keyword-clusters, content-pillar-plan og link-strategi for organisk vækst.",
            defaultBrief: "Lav et 10-ugers SEO content-plan for min niche med keyword-clusters og interne links.",
            system: `You are an SEO strategist. Produce: keyword clusters (pillar + cluster pages), search intent per keyword, monthly volume estimate category (low/med/high), content format, internal linking map, quick-win keywords (low competition). Output a structured plan in Danish.`
        },
        {
            id: "automator",
            icon: "⚙️",
            name: "Automation Finder",
            tagline: "Finder manuelle opgaver du kan automatisere og sælge som service eller script.",
            defaultBrief: "Find 5 manuelle business-tasks jeg kan automatisere og sælge som månedsservice.",
            system: `You are an automation consultant. Find real, boring, repetitive business tasks that small companies pay to get done (lead scraping, invoice processing, data entry, reporting, social media scheduling, email parsing). For each: target customer, current pain, automation stack (no-code/Python/API), price as DIY script vs monthly retainer. Output in Danish.`
        },
        {
            id: "strategy",
            icon: "🧭",
            name: "Strategy Director",
            tagline: "Prioriterer hvad du skal lave NU for maks afkast på din tid.",
            defaultBrief: "Baseret på min profil, hvad skal jeg fokusere 100% på i næste 30 dage?",
            system: `You are a ruthless strategy director. Given a solo operator's constraints, cut everything except the 1-2 highest-leverage activities for the next 30 days. Give:
- THE focus (one sentence)
- why (leverage, ease, speed to revenue)
- week-by-week milestones
- what to NOT do
Brutally honest, no motivational fluff. Output in Danish.`
        }
    ];

    const DEFAULT_STATE = {
        apiKey: "",
        model: "claude-sonnet-4-6",
        niche: "",
        goal: 5000,
        currency: "kr",
        runs: {}, // agentId -> count
        vault: [], // { id, agentId, brief, content, date }
        revenue: [], // { id, source, amount, agentId, date }
        plans: [] // { date, content }
    };

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
        } catch (_) {}
        // Try to inherit API key from jarvis
        try {
            const jarvis = JSON.parse(localStorage.getItem(JARVIS_KEY) || "{}");
            if (jarvis.apiKey) return { ...DEFAULT_STATE, apiKey: jarvis.apiKey, model: jarvis.model || DEFAULT_STATE.model };
        } catch (_) {}
        return { ...DEFAULT_STATE };
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    const state = load();

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    const uid = () => Math.random().toString(36).slice(2, 10);
    const fmt = (n) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n) + " " + state.currency;

    // ---------- Tabs ----------
    $$(".tab").forEach(t => t.addEventListener("click", () => {
        $$(".tab").forEach(x => x.classList.remove("active"));
        $$(".tab-panel").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        $("#panel-" + t.dataset.tab).classList.add("active");
    }));

    // ---------- Agent grid ----------
    function renderAgents() {
        const grid = $("#agent-grid");
        grid.innerHTML = AGENTS.map(a => `
            <div class="agent-card" data-id="${a.id}">
                <div class="agent-icon">${a.icon}</div>
                <div class="agent-name">${a.name}</div>
                <div class="agent-tagline">${a.tagline}</div>
                <div class="agent-meta">
                    <span>KØRT</span>
                    <span class="agent-runs">${state.runs[a.id] || 0}×</span>
                </div>
            </div>
        `).join("");
        grid.querySelectorAll(".agent-card").forEach(el => {
            el.addEventListener("click", () => openAgent(el.dataset.id));
        });
    }

    // ---------- Modal ----------
    let currentAgent = null;
    function openAgent(id) {
        const a = AGENTS.find(x => x.id === id);
        if (!a) return;
        currentAgent = a;
        $("#modal-title").textContent = `${a.icon}  ${a.name}`;
        $("#modal-desc").textContent = a.tagline;
        $("#modal-brief").value = "";
        $("#modal-brief").placeholder = a.defaultBrief;
        $("#modal-result").classList.remove("show");
        $("#modal-result").innerHTML = "";
        $("#modal-status").textContent = "";
        $("#modal").classList.remove("hidden");
    }
    $("#modal-close").addEventListener("click", () => $("#modal").classList.add("hidden"));
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").classList.add("hidden"); });

    $("#modal-run").addEventListener("click", async () => {
        if (!currentAgent) return;
        const brief = $("#modal-brief").value.trim() || currentAgent.defaultBrief;
        const btn = $("#modal-run");
        const status = $("#modal-status");
        const result = $("#modal-result");

        if (!state.apiKey) {
            status.textContent = "⚠ Tilføj API-nøgle under Opsæt.";
            return;
        }

        btn.disabled = true;
        status.textContent = "agent kører…";
        result.classList.remove("show");
        result.innerHTML = "";

        try {
            const content = await runAgent(currentAgent, brief);
            result.innerHTML = renderMarkdown(content);
            result.classList.add("show");
            state.runs[currentAgent.id] = (state.runs[currentAgent.id] || 0) + 1;
            state.vault.unshift({
                id: uid(),
                agentId: currentAgent.id,
                brief,
                content,
                date: new Date().toISOString()
            });
            save();
            renderAgents();
            renderVault();
            renderStats();
            status.textContent = "✓ gemt i idévault";
        } catch (err) {
            console.error(err);
            status.textContent = "✗ fejl: " + err.message;
        } finally {
            btn.disabled = false;
        }
    });

    // ---------- Claude API ----------
    async function runAgent(agent, brief) {
        const context = state.niche ? `\n\nBrugerens kontekst og mål:\n${state.niche}\n\nMånedligt indtægtsmål: ${state.goal} ${state.currency}.` : "";
        const system = agent.system + context;

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
                max_tokens: 2000,
                system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
                messages: [{ role: "user", content: brief }]
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
        }
        const data = await res.json();
        return data.content.map(b => b.text || "").join("\n").trim();
    }

    // ---------- Markdown (minimal, safe) ----------
    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    }
    function renderMarkdown(md) {
        let s = escapeHtml(md);
        s = s.replace(/^### (.+)$/gm, "<h4>$1</h4>");
        s = s.replace(/^## (.+)$/gm, "<h3>$1</h3>");
        s = s.replace(/^# (.+)$/gm, "<h3>$1</h3>");
        s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
        s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
        // Lists
        s = s.replace(/^(?:[-*] .+(?:\n|$))+/gm, block => {
            const items = block.trim().split("\n").map(l => "<li>" + l.replace(/^[-*]\s+/, "") + "</li>").join("");
            return "<ul>" + items + "</ul>";
        });
        s = s.replace(/^(?:\d+\. .+(?:\n|$))+/gm, block => {
            const items = block.trim().split("\n").map(l => "<li>" + l.replace(/^\d+\.\s+/, "") + "</li>").join("");
            return "<ol>" + items + "</ol>";
        });
        s = s.replace(/\n\n+/g, "<br><br>");
        s = s.replace(/\n/g, "<br>");
        return s;
    }

    // ---------- Vault ----------
    function renderVault() {
        const list = $("#vault-list");
        const q = ($("#vault-search").value || "").toLowerCase();
        const items = state.vault.filter(v => {
            if (!q) return true;
            return (v.content + " " + v.brief).toLowerCase().includes(q);
        });
        if (!items.length) {
            list.innerHTML = `<div class="empty-state">Ingen idéer endnu. Kør en agent på fanen "Agenter".</div>`;
            return;
        }
        list.innerHTML = items.map(v => {
            const agent = AGENTS.find(a => a.id === v.agentId);
            return `
            <div class="vault-item" data-id="${v.id}">
                <div class="vault-item-head">
                    <span class="vault-agent">${agent ? agent.icon + " " + agent.name : v.agentId}</span>
                    <span class="vault-date">${new Date(v.date).toLocaleString("da-DK")}</span>
                </div>
                <div class="vault-brief">Brief: ${escapeHtml(v.brief)}</div>
                <div class="vault-content">${renderMarkdown(v.content)}</div>
                <div class="vault-actions">
                    <button data-act="copy">Kopiér</button>
                    <button data-act="del" class="danger">Slet</button>
                </div>
            </div>`;
        }).join("");

        list.querySelectorAll(".vault-item").forEach(el => {
            const id = el.dataset.id;
            el.querySelector('[data-act="copy"]').addEventListener("click", () => {
                const item = state.vault.find(v => v.id === id);
                navigator.clipboard.writeText(item.content).then(() => {
                    el.querySelector('[data-act="copy"]').textContent = "Kopieret ✓";
                    setTimeout(() => { el.querySelector('[data-act="copy"]').textContent = "Kopiér"; }, 1500);
                });
            });
            el.querySelector('[data-act="del"]').addEventListener("click", () => {
                if (!confirm("Slet denne idé?")) return;
                state.vault = state.vault.filter(v => v.id !== id);
                save();
                renderVault();
                renderStats();
            });
        });
    }
    $("#vault-search").addEventListener("input", renderVault);
    $("#vault-export").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(state.vault, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `agent-vault-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    $("#vault-clear").addEventListener("click", () => {
        if (!confirm("Slet ALLE idéer i vaulten? Kan ikke fortrydes.")) return;
        state.vault = [];
        save();
        renderVault();
        renderStats();
    });

    // ---------- Revenue ----------
    function renderRevenueAgentSelect() {
        const sel = $("#rev-agent");
        sel.innerHTML = `<option value="">Uden agent</option>` +
            AGENTS.map(a => `<option value="${a.id}">${a.icon} ${a.name}</option>`).join("");
    }

    function renderRevenue() {
        const list = $("#revenue-list");
        const sum = $("#revenue-summary");

        const total = state.revenue.reduce((s, r) => s + r.amount, 0);
        const now = new Date();
        const monthTotal = state.revenue
            .filter(r => {
                const d = new Date(r.date);
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            })
            .reduce((s, r) => s + r.amount, 0);
        const goal = state.goal || 0;
        const pct = goal > 0 ? Math.min(100, Math.round(monthTotal / goal * 100)) : 0;

        sum.innerHTML = `
            <div class="sum-card">
                <div class="sum-label">Total optjent</div>
                <div class="sum-value">${fmt(total)}</div>
            </div>
            <div class="sum-card">
                <div class="sum-label">Denne måned</div>
                <div class="sum-value">${fmt(monthTotal)}</div>
                ${goal > 0 ? `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                <div style="font-size:11px;color:#7fa9d8;margin-top:4px;">${pct}% af mål (${fmt(goal)})</div>` : ""}
            </div>
            <div class="sum-card">
                <div class="sum-label">Indtægter</div>
                <div class="sum-value">${state.revenue.length}</div>
            </div>
        `;

        if (!state.revenue.length) {
            list.innerHTML = `<div class="empty-state">Ingen indtægter logget endnu. Log din første over.</div>`;
            return;
        }
        const sorted = [...state.revenue].sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = sorted.map(r => {
            const agent = AGENTS.find(a => a.id === r.agentId);
            return `
            <div class="revenue-item" data-id="${r.id}">
                <div class="revenue-item-head">
                    <span class="revenue-source">${escapeHtml(r.source)}</span>
                    <span class="revenue-amount">+${fmt(r.amount)}</span>
                </div>
                <div class="revenue-meta">
                    ${new Date(r.date).toLocaleDateString("da-DK")}
                    ${agent ? " · " + agent.icon + " " + agent.name : ""}
                    <button class="revenue-del" data-id="${r.id}" title="Slet">✕</button>
                </div>
            </div>`;
        }).join("");

        list.querySelectorAll(".revenue-del").forEach(btn => {
            btn.addEventListener("click", () => {
                state.revenue = state.revenue.filter(r => r.id !== btn.dataset.id);
                save();
                renderRevenue();
                renderStats();
            });
        });
    }

    $("#rev-add").addEventListener("click", () => {
        const source = $("#rev-source").value.trim();
        const amount = parseFloat($("#rev-amount").value);
        const agentId = $("#rev-agent").value;
        if (!source || !amount || amount <= 0) {
            alert("Udfyld kilde og et positivt beløb.");
            return;
        }
        state.revenue.unshift({ id: uid(), source, amount, agentId, date: new Date().toISOString() });
        save();
        $("#rev-source").value = "";
        $("#rev-amount").value = "";
        $("#rev-agent").value = "";
        renderRevenue();
        renderStats();
    });

    // ---------- Plan ----------
    $("#plan-generate").addEventListener("click", async () => {
        if (!state.apiKey) { $("#plan-status").textContent = "⚠ Tilføj API-nøgle under Opsæt."; return; }
        const btn = $("#plan-generate");
        const status = $("#plan-status");
        const out = $("#plan-output");
        btn.disabled = true;
        status.textContent = "koordinerer agenter…";

        const recent = state.vault.slice(0, 8).map(v => {
            const a = AGENTS.find(x => x.id === v.agentId);
            return `- [${a ? a.name : v.agentId}] ${v.content.slice(0, 400).replace(/\n/g, " ")}`;
        }).join("\n");

        const now = new Date();
        const monthTotal = state.revenue
            .filter(r => { const d = new Date(r.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
            .reduce((s, r) => s + r.amount, 0);

        const brief = `Lav en konkret ugeplan mandag-søndag med dag-for-dag actions der rykker brugeren mod sit månedsmål.

Brugerens profil: ${state.niche || "(ikke angivet)"}
Månedsmål: ${state.goal} ${state.currency}
Denne måned indtjent: ${monthTotal} ${state.currency}
Mangler: ${Math.max(0, state.goal - monthTotal)} ${state.currency}

Seneste agent-outputs (brug disse som input til planen):
${recent || "(ingen endnu)"}

Format:
## Ugens fokus
(1 sætning — det vigtigste)

## Dag-for-dag
- Mandag: …
- Tirsdag: …
- …

## KPI for ugen
- …

## Hvad du IKKE skal lave
- …

Vær konkret. Ingen buzzwords. Nævn specifikke handlinger og tidsestimater.`;

        try {
            const content = await runAgent({
                id: "strategy",
                system: "Du er en kompromisløs executive coach for solo-operatører. Du laver ugeplaner der er brutalt konkrete og fokuserede på indtægt, ikke aktivitet. Svar på dansk."
            }, brief);
            out.innerHTML = renderMarkdown(content);
            state.plans.unshift({ date: new Date().toISOString(), content });
            if (state.plans.length > 10) state.plans = state.plans.slice(0, 10);
            save();
            status.textContent = "✓ plan klar";
        } catch (err) {
            status.textContent = "✗ fejl: " + err.message;
        } finally {
            btn.disabled = false;
        }
    });

    function renderLatestPlan() {
        if (state.plans.length) {
            $("#plan-output").innerHTML = renderMarkdown(state.plans[0].content);
        }
    }

    // ---------- Config ----------
    function loadConfig() {
        $("#cfg-api-key").value = state.apiKey;
        $("#cfg-model").value = state.model;
        $("#cfg-niche").value = state.niche;
        $("#cfg-goal").value = state.goal;
        $("#cfg-currency").value = state.currency;
    }
    $("#cfg-save").addEventListener("click", () => {
        state.apiKey = $("#cfg-api-key").value.trim();
        state.model = $("#cfg-model").value;
        state.niche = $("#cfg-niche").value.trim();
        state.goal = parseFloat($("#cfg-goal").value) || 0;
        state.currency = ($("#cfg-currency").value || "kr").trim();
        save();
        renderStats();
        renderRevenue();
        alert("Gemt ✓");
    });
    $("#cfg-reset").addEventListener("click", () => {
        if (!confirm("Nulstil ALT? Alle idéer, indtægter og config slettes.")) return;
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    });

    // ---------- Stats ----------
    function renderStats() {
        const earned = state.revenue.reduce((s, r) => s + r.amount, 0);
        $("#stat-earned").textContent = fmt(earned);
        $("#stat-ideas").textContent = state.vault.length;

        // Pipeline = rough estimate: one idea worth ~500 kr average until realized
        const pipeline = state.vault.length * 500;
        $("#stat-pipeline").textContent = fmt(pipeline);
    }

    // ---------- Init ----------
    renderAgents();
    renderVault();
    renderRevenueAgentSelect();
    renderRevenue();
    renderLatestPlan();
    loadConfig();
    renderStats();
})();
