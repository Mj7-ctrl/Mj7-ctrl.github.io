(() => {
    "use strict";

    const KEY = "ivans-block.v1";
    const START_CHIPS = 1000;

    const wallet = load();
    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return { chips: START_CHIPS, handsPlayed: 0, biggestWin: 0, totalWagered: 0, lastBonus: 0, ...JSON.parse(raw) };
        } catch (_) {}
        return { chips: START_CHIPS, handsPlayed: 0, biggestWin: 0, totalWagered: 0, lastBonus: 0 };
    }
    function save() { localStorage.setItem(KEY, JSON.stringify(wallet)); }

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    // Fair RNG using crypto when available
    function rng() {
        if (window.crypto && crypto.getRandomValues) {
            const a = new Uint32Array(1);
            crypto.getRandomValues(a);
            return a[0] / 4294967296;
        }
        return Math.random();
    }
    const randInt = (n) => Math.floor(rng() * n);

    function setChips(n) {
        wallet.chips = Math.max(0, Math.round(n));
        $("#chip-balance").textContent = wallet.chips.toLocaleString("da-DK");
        save();
    }
    function recordWager(amount) { wallet.totalWagered += amount; }
    function recordWin(net) { if (net > wallet.biggestWin) wallet.biggestWin = net; }

    setChips(wallet.chips);

    // ---------- Tabs ----------
    $$(".gtab").forEach(t => t.addEventListener("click", () => {
        $$(".gtab").forEach(x => x.classList.remove("active"));
        $$(".game-panel").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        $("#game-" + t.dataset.game).classList.add("active");
        if (t.dataset.game === "stats") renderStats();
    }));

    // ============================================================
    // BLACKJACK
    // ============================================================
    const SUITS = [["♠", false], ["♥", true], ["♦", true], ["♣", false]];
    const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

    let bjDeck = [], bjPlayer = [], bjDealer = [], bjBet = 0, bjState = "idle", bjDoubled = false;

    function freshDeck() {
        const d = [];
        for (const [suit, red] of SUITS) for (const rank of RANKS) d.push({ rank, suit, red });
        // Fisher-Yates fair shuffle
        for (let i = d.length - 1; i > 0; i--) {
            const j = randInt(i + 1);
            [d[i], d[j]] = [d[j], d[i]];
        }
        return d;
    }
    function cardValue(c) {
        if (c.rank === "A") return 11;
        if (["K", "Q", "J"].includes(c.rank)) return 10;
        return parseInt(c.rank, 10);
    }
    function handValue(hand) {
        let total = 0, aces = 0;
        for (const c of hand) { total += cardValue(c); if (c.rank === "A") aces++; }
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
    }
    function cardHtml(c, hidden) {
        if (hidden) return `<div class="card back"></div>`;
        const cls = c.red ? "card red" : "card";
        return `<div class="${cls}"><span class="rank-t">${c.rank}${c.suit}</span><span class="rank-b">${c.rank}${c.suit}</span></div>`;
    }
    function renderBj(revealDealer) {
        $("#bj-player-cards").innerHTML = bjPlayer.map(c => cardHtml(c, false)).join("");
        $("#bj-dealer-cards").innerHTML = bjDealer.map((c, i) => cardHtml(c, !revealDealer && i === 1)).join("");
        $("#bj-player-score").textContent = bjPlayer.length ? handValue(bjPlayer) : "";
        $("#bj-dealer-score").textContent = bjDealer.length ? (revealDealer ? handValue(bjDealer) : cardValue(bjDealer[0])) : "";
    }
    function bjMsg(text, cls) {
        const el = $("#bj-msg");
        el.textContent = text;
        el.className = "table-msg" + (cls ? " " + cls : "");
    }
    function bjButtons(state) {
        $("#bj-deal").disabled = state !== "idle";
        $("#bj-hit").disabled = state !== "play";
        $("#bj-stand").disabled = state !== "play";
        $("#bj-double").disabled = !(state === "play" && bjPlayer.length === 2 && wallet.chips >= bjBet);
        $$("#game-blackjack .chip-btn, #bj-clear").forEach(b => b.disabled = state !== "idle");
    }

    $$("#game-blackjack .chip-btn").forEach(b => b.addEventListener("click", () => {
        if (bjState !== "idle") return;
        const v = parseInt(b.dataset.bet, 10);
        if (wallet.chips < bjBet + v) { bjMsg("Ikke nok chips til den indsats."); return; }
        bjBet += v;
        $("#bj-bet").textContent = bjBet;
    }));
    $("#bj-clear").addEventListener("click", () => { if (bjState === "idle") { bjBet = 0; $("#bj-bet").textContent = 0; } });

    $("#bj-deal").addEventListener("click", () => {
        if (bjBet <= 0) { bjMsg("Sæt en indsats først."); return; }
        if (wallet.chips < bjBet) { bjMsg("Ikke nok chips."); return; }
        setChips(wallet.chips - bjBet);
        recordWager(bjBet);
        bjDoubled = false;
        bjDeck = freshDeck();
        bjPlayer = [bjDeck.pop(), bjDeck.pop()];
        bjDealer = [bjDeck.pop(), bjDeck.pop()];
        bjState = "play";
        renderBj(false);
        bjMsg("Hit, stand eller double?");
        bjButtons("play");

        if (handValue(bjPlayer) === 21) bjStand(true);
    });

    $("#bj-hit").addEventListener("click", () => {
        bjPlayer.push(bjDeck.pop());
        renderBj(false);
        if (handValue(bjPlayer) > 21) { settleBj(); }
        else bjButtons("play");
    });

    $("#bj-double").addEventListener("click", () => {
        if (wallet.chips < bjBet) return;
        setChips(wallet.chips - bjBet);
        recordWager(bjBet);
        bjBet *= 2;
        bjDoubled = true;
        bjPlayer.push(bjDeck.pop());
        renderBj(false);
        if (handValue(bjPlayer) > 21) settleBj();
        else bjStand();
    });

    function bjStand(isBlackjack) { bjStand_(isBlackjack); }
    $("#bj-stand").addEventListener("click", () => bjStand_());

    function bjStand_(isBlackjack) {
        bjState = "dealer";
        bjButtons("dealer");
        // Dealer draws to 17 (stands on soft 17)
        while (handValue(bjDealer) < 17) bjDealer.push(bjDeck.pop());
        settleBj(isBlackjack);
    }

    function settleBj(isBlackjack) {
        renderBj(true);
        const p = handValue(bjPlayer), d = handValue(bjDealer);
        let payout = 0, cls = "", msg = "";

        if (p > 21) { msg = `Bust! Du tabte ${bjBet}.`; cls = "lose"; }
        else if (isBlackjack && bjPlayer.length === 2) {
            payout = Math.round(bjBet * 2.5); // 3:2 + stake back
            msg = `Blackjack! Du vandt ${payout - bjBet}.`; cls = "win";
        }
        else if (d > 21) { payout = bjBet * 2; msg = `Dealer bust! Du vandt ${bjBet}.`; cls = "win"; }
        else if (p > d) { payout = bjBet * 2; msg = `Du vandt ${bjBet}!`; cls = "win"; }
        else if (p === d) { payout = bjBet; msg = "Push — du får din indsats igen."; }
        else { msg = `Dealer vinder. Du tabte ${bjBet}.`; cls = "lose"; }

        if (payout > 0) {
            setChips(wallet.chips + payout);
            recordWin(payout - bjBet);
        }
        wallet.handsPlayed++;
        save();
        bjMsg(msg, cls);
        bjBet = 0; $("#bj-bet").textContent = 0;
        bjState = "idle";
        bjButtons("idle");
    }
    renderBj(false);
    bjButtons("idle");

    // ============================================================
    // ROULETTE (European single-zero, fair)
    // ============================================================
    const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    const colorOf = (n) => n === 0 ? "green" : (RED_NUMS.has(n) ? "red" : "black");

    const ROULETTE_BETS = [
        { id: "red", label: "Rød", payout: 1, cls: "red-bet", test: n => colorOf(n) === "red" },
        { id: "black", label: "Sort", payout: 1, cls: "black-bet", test: n => colorOf(n) === "black" },
        { id: "even", label: "Lige", payout: 1, test: n => n !== 0 && n % 2 === 0 },
        { id: "odd", label: "Ulige", payout: 1, test: n => n % 2 === 1 },
        { id: "low", label: "1–18", payout: 1, test: n => n >= 1 && n <= 18 },
        { id: "high", label: "19–36", payout: 1, test: n => n >= 19 && n <= 36 },
        { id: "d1", label: "1. dusin", payout: 2, test: n => n >= 1 && n <= 12 },
        { id: "d2", label: "2. dusin", payout: 2, test: n => n >= 13 && n <= 24 },
        { id: "d3", label: "3. dusin", payout: 2, test: n => n >= 25 && n <= 36 },
        { id: "zero", label: "0 (35:1)", payout: 35, test: n => n === 0 },
    ];
    let rChip = 10;
    const rStakes = {}; // id -> amount

    function renderRouletteBets() {
        $("#roulette-bets").innerHTML = ROULETTE_BETS.map(b => `
            <button class="rbet ${b.cls || ""}" data-id="${b.id}">
                ${b.label}
                <span class="payout">udbetaler ${b.payout}:1</span>
                ${rStakes[b.id] ? `<span class="placed">${rStakes[b.id]}</span>` : ""}
            </button>`).join("");
        $$("#roulette-bets .rbet").forEach(el => el.addEventListener("click", () => {
            const id = el.dataset.id;
            const total = Object.values(rStakes).reduce((s, x) => s + x, 0);
            if (wallet.chips < total + rChip) { $("#roulette-msg").textContent = "Ikke nok chips."; return; }
            rStakes[id] = (rStakes[id] || 0) + rChip;
            updateRouletteStaked();
            renderRouletteBets();
        }));
    }
    function updateRouletteStaked() {
        $("#roulette-staked").textContent = Object.values(rStakes).reduce((s, x) => s + x, 0);
    }
    $$("#game-roulette .chip-btn").forEach(b => {
        b.addEventListener("click", () => {
            rChip = parseInt(b.dataset.bet, 10);
            $("#roulette-chip").textContent = rChip;
            $$("#game-roulette .chip-btn").forEach(x => x.classList.remove("sel"));
            b.classList.add("sel");
        });
    });
    $("#roulette-clear").addEventListener("click", () => {
        for (const k in rStakes) delete rStakes[k];
        updateRouletteStaked();
        renderRouletteBets();
    });

    $("#roulette-spin").addEventListener("click", () => {
        const staked = Object.values(rStakes).reduce((s, x) => s + x, 0);
        if (staked <= 0) { $("#roulette-msg").textContent = "Læg en indsats først."; return; }
        if (wallet.chips < staked) { $("#roulette-msg").textContent = "Ikke nok chips."; return; }

        setChips(wallet.chips - staked);
        recordWager(staked);
        $("#roulette-spin").disabled = true;

        const result = randInt(37); // 0-36 fair
        const wheel = $("#roulette-wheel");
        wheel.classList.remove("spinning");
        void wheel.offsetWidth;
        wheel.classList.add("spinning");

        setTimeout(() => {
            const numEl = $("#roulette-result");
            numEl.textContent = result;
            numEl.className = "wheel-number " + colorOf(result);

            let payout = 0;
            for (const b of ROULETTE_BETS) {
                const stake = rStakes[b.id];
                if (stake && b.test(result)) payout += stake * (b.payout + 1);
            }
            wallet.handsPlayed++;
            if (payout > 0) {
                setChips(wallet.chips + payout);
                recordWin(payout - staked);
                $("#roulette-msg").textContent = `${result} ${colorOf(result)} — du vandt ${payout}!`;
                $("#roulette-msg").className = "table-msg win";
            } else {
                $("#roulette-msg").textContent = `${result} ${colorOf(result)} — ingen gevinst.`;
                $("#roulette-msg").className = "table-msg lose";
            }
            save();
            for (const k in rStakes) delete rStakes[k];
            updateRouletteStaked();
            renderRouletteBets();
            $("#roulette-spin").disabled = false;
        }, 1200);
    });
    renderRouletteBets();

    // ============================================================
    // SLOTS (3-reel, fair weighted)
    // ============================================================
    const SLOT_SYMBOLS = [
        { s: "🍒", weight: 30, three: 4, two: 1 },
        { s: "🍋", weight: 25, three: 6, two: 0 },
        { s: "🔔", weight: 18, three: 10, two: 0 },
        { s: "⭐", weight: 12, three: 20, two: 0 },
        { s: "💎", weight: 9, three: 50, two: 0 },
        { s: "7️⃣", weight: 6, three: 100, two: 0 },
    ];
    const SLOT_POOL = [];
    SLOT_SYMBOLS.forEach(sym => { for (let i = 0; i < sym.weight; i++) SLOT_POOL.push(sym.s); });
    let slotBet = 10;

    $("#slots-paytable").innerHTML = SLOT_SYMBOLS.slice().reverse().map(sym =>
        `<div class="pt-row"><span>${sym.s} ${sym.s} ${sym.s}</span><b>${sym.three}×</b></div>`
    ).join("") + `<div class="pt-row"><span>🍒 🍒 (par)</span><b>1×</b></div>`;

    $$("#game-slots .chip-btn").forEach(b => b.addEventListener("click", () => {
        slotBet = parseInt(b.dataset.bet, 10);
        $("#slots-bet").textContent = slotBet;
        $$("#game-slots .chip-btn").forEach(x => x.classList.remove("sel"));
        b.classList.add("sel");
    }));

    $("#slots-spin").addEventListener("click", () => {
        if (wallet.chips < slotBet) { $("#slots-msg").textContent = "Ikke nok chips."; return; }
        setChips(wallet.chips - slotBet);
        recordWager(slotBet);
        $("#slots-spin").disabled = true;

        const reels = $$("#slots-reels .reel");
        reels.forEach(r => r.classList.add("spin"));

        const result = [0, 1, 2].map(() => SLOT_POOL[randInt(SLOT_POOL.length)]);

        reels.forEach((r, i) => {
            setTimeout(() => {
                r.classList.remove("spin");
                r.textContent = result[i];
                if (i === 2) settleSlots(result);
            }, 400 + i * 350);
        });
    });

    function settleSlots(result) {
        let payout = 0, msg = "Ingen gevinst — prøv igen.", cls = "lose";
        if (result[0] === result[1] && result[1] === result[2]) {
            const sym = SLOT_SYMBOLS.find(x => x.s === result[0]);
            payout = slotBet * sym.three;
            msg = `${result[0]}${result[0]}${result[0]} — JACKPOT! +${payout}`;
            cls = "win";
        } else if (result.filter(s => s === "🍒").length === 2) {
            payout = slotBet * 1;
            msg = `To 🍒 — du får ${payout} tilbage.`;
            cls = "win";
        }
        wallet.handsPlayed++;
        if (payout > 0) { setChips(wallet.chips + payout); recordWin(payout - slotBet); }
        save();
        $("#slots-msg").textContent = msg;
        $("#slots-msg").className = "table-msg " + cls;
        $("#slots-spin").disabled = false;
    }

    // ============================================================
    // STATS / WALLET
    // ============================================================
    function renderStats() {
        $("#stats-grid").innerHTML = `
            <div class="stat-card"><div class="label">Chips</div><div class="value">${wallet.chips.toLocaleString("da-DK")}</div></div>
            <div class="stat-card"><div class="label">Spil spillet</div><div class="value">${wallet.handsPlayed}</div></div>
            <div class="stat-card"><div class="label">Største gevinst</div><div class="value">${wallet.biggestWin.toLocaleString("da-DK")}</div></div>
            <div class="stat-card"><div class="label">Total indsat</div><div class="value">${wallet.totalWagered.toLocaleString("da-DK")}</div></div>
        `;
        const cool = Date.now() - wallet.lastBonus < 60000;
        $("#bonus-btn").disabled = cool;
        $("#bonus-btn").textContent = cool ? "Bonus om lidt…" : "Hent gratis chips (+500)";
    }

    $("#bonus-btn").addEventListener("click", () => {
        if (Date.now() - wallet.lastBonus < 60000) return;
        wallet.lastBonus = Date.now();
        setChips(wallet.chips + 500);
        renderStats();
    });

    $("#reset-wallet").addEventListener("click", () => {
        if (!confirm("Nulstil wallet til 1000 chips? Stats slettes.")) return;
        wallet.chips = START_CHIPS;
        wallet.handsPlayed = 0;
        wallet.biggestWin = 0;
        wallet.totalWagered = 0;
        wallet.lastBonus = 0;
        save();
        setChips(START_CHIPS);
        renderStats();
    });

    // Auto top-up when broke (so the fun never ends — it's play money)
    function checkBroke() {
        if (wallet.chips <= 0) {
            setTimeout(() => {
                alert("Du løb tør for chips! Her er 500 gratis chips — det er jo kun for sjov.");
                setChips(500);
            }, 300);
        }
    }
    setInterval(checkBroke, 1500);
})();
