(() => {
  "use strict";

  /* ---------- Settings: edit these values ---------- */
  const CONFIG = {
    // Lead email alerts via https://web3forms.com (sends to the email you registered the key with).
    // Remove this key if you later switch email alerts to the Google script, or leads arrive twice.
    web3formsKey: "d5d6a427-611d-42f9-b91e-9dd008f8a32d",
    // LATER (optional): Web app URL from deploying google-sheets-leads.gs, to also save leads to a Google Sheet.
    googleSheetUrl: "YOUR_GOOGLE_SHEET_WEB_APP_URL",
    // Shown on the "Book my audit call" button and used as the fallback if sending fails.
    contactEmail: "hello@tricaal.com",
  };
  const $ =(s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav ---------- */
  const nav = $(".nav");
  const toggle = $(".nav__toggle");
  const menu = $("#mobile-menu");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
  };
  toggle.addEventListener("click", () => setMenu(menu.hidden));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = $$(".section__head, .service, .industry, .process__step, .pillar, .metrics, .trust__card, .honest, .plan, .faq details, .demo, .cta__copy, .intake");
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealTargets.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Workflow demo ---------- */
  // Each step lights up in the list and pushes one item into the phone feed.
  // Feed item types: in (customer), out (assistant), sys (system event), card (record summary).
  const SCENARIOS = {
    whatsapp: {
      channel: "WhatsApp", sub: "Tricaal assistant · online", avatar: "W", interest: "WhatsApp booking",
      steps: [
        { t: "Message arrives", d: "Customer asks to book an appointment.",
          feed: { type: "in", text: "Hi, can I book a check-up this Thursday evening?" } },
        { t: "AI understands", d: "Identifies intent and collects the required details.",
          feed: { type: "out", text: "Sure! May I have your full name, and is this your first visit?" } },
        { t: "Availability check", d: "Uses the connected booking calendar to check open slots.",
          feed: { type: "sys", text: "calendar.check → Thu: 17:30, 18:15 open" } },
        { t: "Booking action", d: "Creates the appointment only after the customer confirms.",
          feed: { type: "in", text: "Ananya Rao, first visit. 18:15 works 👍" } },
        { t: "Records updated", d: "Saves customer and appointment information.",
          feed: { type: "card", title: "CRM · new appointment", rows: [["Name", "Ananya Rao"], ["When", "Thu 18:15"], ["Type", "First visit"], ["Status", "Confirmed"]] } },
        { t: "Confirmation", d: "Sends a confirmation and an optional reminder.",
          feed: { type: "out", text: "You're booked for Thursday at 6:15 PM ✅ We'll remind you a day before." } },
      ],
    },
    voice: {
      channel: "Voice agent", sub: "Inbound line · within business hours", avatar: "☎", interest: "Missed call → lead",
      steps: [
        { t: "Call comes in", d: "A call is missed by staff or routed straight to the voice agent.",
          feed: { type: "sys", text: "📞 incoming call · routed to voice agent" } },
        { t: "Agent responds", d: "Answers within configured hours and identifies the request.",
          feed: { type: "out", text: "“Thanks for calling! How can I help you today?”" } },
        { t: "Collects details", d: "Gathers useful lead details and answers approved FAQs.",
          feed: { type: "in", text: "“I'm looking at the 2BHK on Lake Road — is it still available? Can I see it?”" } },
        { t: "Books or creates a task", d: "Books a consultation or creates a callback task.",
          feed: { type: "out", text: "“It is. I've booked a viewing for Saturday at 11 AM. You'll get an SMS confirmation.”" } },
        { t: "Team gets the summary", d: "Summary, contact details and the next action — sent to staff.",
          feed: { type: "card", title: "Call summary → sales team", rows: [["Lead", "Rahul M."], ["Interest", "2BHK, Lake Road"], ["Next", "Viewing Sat 11:00"], ["Owner", "Assigned: Priya"]] } },
      ],
    },
    leads: {
      channel: "Lead pipeline", sub: "Website · WhatsApp · Ads · Calls", avatar: "↗", interest: "Lead → customer",
      steps: [
        { t: "Lead arrives", d: "From your website, WhatsApp, an ad, or a call.",
          feed: { type: "sys", text: "new lead · source: website form" } },
        { t: "AI qualifies", d: "Qualifies the lead and records the key details.",
          feed: { type: "out", text: "Thanks for your interest! What size is your team, and when are you hoping to start?" } },
        { t: "CRM updated", d: "Creates or updates the lead and assigns an owner.",
          feed: { type: "card", title: "CRM · lead created", rows: [["Company", "Brightside Studio"], ["Score", "Warm · 12 staff"], ["Owner", "Arjun"], ["Stage", "Qualified"]] } },
        { t: "Follow-up scheduled", d: "Under permitted communication rules.",
          feed: { type: "sys", text: "follow-up queued · Tue 10:00 · opt-in ✓" } },
        { t: "Moves to next stage", d: "A booking or purchase advances the lead automatically.",
          feed: { type: "in", text: "Booked the onboarding call for Tuesday — see you then!" } },
        { t: "Report tracks it", d: "Response time, conversion, cost and unresolved tasks.",
          feed: { type: "card", title: "Weekly report", rows: [["Tracked", "Response time"], ["Tracked", "Conversion rate"], ["Tracked", "Cost per lead"], ["Open", "Unresolved tasks"]] } },
      ],
    },
    support: {
      channel: "Support desk", sub: "WhatsApp · email · web chat", avatar: "?", interest: "Customer support",
      steps: [
        { t: "Question arrives", d: "A customer asks about their order.",
          feed: { type: "in", text: "Where is my order #48213? It was supposed to arrive yesterday." } },
        { t: "Order looked up", d: "Checks order and shipping status in your store system.",
          feed: { type: "sys", text: "orders.lookup #48213 → out for delivery" } },
        { t: "Answer sent", d: "Replies with accurate, approved information.",
          feed: { type: "out", text: "Your order is out for delivery today and should arrive by 7 PM 📦" } },
        { t: "Exception detected", d: "Return or complaint requests are flagged for a human.",
          feed: { type: "in", text: "One item was damaged last time, I want to return it." } },
        { t: "Human hand-off", d: "Escalated to your team with the full conversation context.",
          feed: { type: "out", text: "I'm sorry about that — I've passed this to our support team, who'll reply within the hour." } },
      ],
    },
    ops: {
      channel: "Internal operations", sub: "Forms · sheets · documents · alerts", avatar: "⚙", interest: "Internal operations",
      steps: [
        { t: "Documents received", d: "A client uploads onboarding documents.",
          feed: { type: "sys", text: "form.submitted · 3 files attached" } },
        { t: "Data extracted", d: "Key fields are extracted and validated.",
          feed: { type: "card", title: "Extracted & validated", rows: [["Client", "Mehta Traders"], ["GST no.", "Valid format ✓"], ["Contract", "Signed ✓"], ["ID proof", "Missing ✗"]] } },
        { t: "Gap followed up", d: "Missing items are requested automatically.",
          feed: { type: "out", text: "Thanks! We just need a copy of your ID proof to finish onboarding." } },
        { t: "Systems updated", d: "Spreadsheet, CRM and project tool updated in one go.",
          feed: { type: "sys", text: "sheet.append ✓ · crm.update ✓ · task.create ✓" } },
        { t: "Team alerted", d: "A daily digest and alerts keep everyone in the loop.",
          feed: { type: "card", title: "Daily ops digest", rows: [["Onboarded", "4 clients"], ["Waiting on", "1 document"], ["Errors", "0 · 1 retry"], ["Escalated", "None"]] } },
      ],
    },
  };

  const stepsEl = $("#demo-steps");
  const feedEl = $("#demo-feed");
  const tabs = $$(".tab");
  let current = "whatsapp";
  let timers = [];
  let started = false;

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const feedNode = (f) => {
    const el = document.createElement("div");
    if (f.type === "card") {
      el.className = "card-msg";
      el.innerHTML = `<span class="card-msg__title">${esc(f.title)}</span><dl>${f.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
    } else {
      el.className = `bubble bubble--${f.type}`;
      el.textContent = f.text;
    }
    return el;
  };

  const scrollFeed = () => { feedEl.scrollTop = feedEl.scrollHeight; };

  const render = (key) => {
    const sc = SCENARIOS[key];
    $("#demo-channel").textContent = sc.channel;
    $("#demo-channel-sub").textContent = sc.sub;
    $("#demo-avatar").textContent = sc.avatar;
    $("#demo-cta").dataset.interest = sc.interest;
    stepsEl.innerHTML = sc.steps.map((s, i) => `
      <li class="step"><span class="step__num">${String(i + 1).padStart(2, "0")}</span>
        <div><b>${esc(s.t)}</b><p>${esc(s.d)}</p></div></li>`).join("");
    feedEl.innerHTML = "";
  };

  const play = (key) => {
    clearTimers();
    render(key);
    const sc = SCENARIOS[key];
    const items = $$(".step", stepsEl);

    if (reduceMotion) {
      items.forEach((it) => it.classList.add("is-done"));
      sc.steps.forEach((s) => feedEl.appendChild(feedNode(s.feed)));
      return;
    }

    const STEP_MS = 1600;
    sc.steps.forEach((s, i) => {
      later(() => {
        items.forEach((it, j) => {
          it.classList.toggle("is-active", j === i);
          it.classList.toggle("is-done", j < i);
        });
        const replyFromUs = s.feed.type === "out";
        if (replyFromUs) {
          const typing = document.createElement("div");
          typing.className = "typing";
          typing.innerHTML = "<i></i><i></i><i></i>";
          feedEl.appendChild(typing);
          scrollFeed();
          later(() => { typing.remove(); feedEl.appendChild(feedNode(s.feed)); scrollFeed(); }, 650);
        } else {
          feedEl.appendChild(feedNode(s.feed));
          scrollFeed();
        }
      }, i * STEP_MS);
    });
    later(() => items.forEach((it) => { it.classList.remove("is-active"); it.classList.add("is-done"); }), sc.steps.length * STEP_MS);
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => { t.classList.toggle("is-active", t === tab); t.setAttribute("aria-selected", String(t === tab)); });
      current = tab.dataset.scenario;
      started = true;
      play(current);
    });
  });
  $("#demo-replay").addEventListener("click", () => { started = true; play(current); });

  render(current);
  if ("IntersectionObserver" in window) {
    const demoIO = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started) { started = true; play(current); demoIO.disconnect(); }
    }, { threshold: 0.35 });
    demoIO.observe($(".demo"));
  } else {
    play(current);
  }

  /* ---------- Intake agent (the contact flow is itself an automation) ---------- */
  const PAINS = [
    { id: "wa", label: "Answering the same WhatsApp questions" },
    { id: "calls", label: "Missed or unanswered calls" },
    { id: "booking", label: "Booking & rescheduling" },
    { id: "followup", label: "Following up with leads" },
    { id: "data", label: "Manual data entry & updates" },
    { id: "status", label: "Order / job-status updates" },
  ];
  const INDUSTRIES = [
    { id: "clinic", label: "Clinic / healthcare" },
    { id: "realestate", label: "Real estate" },
    { id: "ecom", label: "E-commerce" },
    { id: "agency", label: "Agency / services" },
    { id: "auto", label: "Automotive / local services" },
    { id: "edu", label: "Education" },
    { id: "other", label: "Something else" },
  ];
  const BOOKING_NOUN = { clinic: "patient appointments", realestate: "property viewings", ecom: "consultations", agency: "client calls", auto: "service bookings", edu: "counselling sessions", other: "appointments" };
  const STATUS_NOUN = { clinic: "appointment & report-ready alerts", realestate: "deal-stage updates", ecom: "order updates", agency: "project updates", auto: "job-status updates", edu: "admission-status updates", other: "status updates" };
  const LEAD_NOUN = { clinic: "new patient enquiries", realestate: "property enquiries", ecom: "pre-sales enquiries", agency: "inbound leads", auto: "service enquiries", edu: "course enquiries", other: "new enquiries" };
  // Most common high-value workflows per industry: used to boost ranking and to fill the snapshot.
  const INDUSTRY_FIT = {
    clinic: ["booking", "wa", "calls"], realestate: ["followup", "calls", "booking"], ecom: ["status", "wa", "data"],
    agency: ["followup", "data", "status"], auto: ["booking", "status", "calls"], edu: ["followup", "wa", "booking"],
    other: ["wa", "followup", "data"],
  };
  // impact / ease on a 1–3 scale.
  const OPPS = {
    wa: (i) => ({ title: "WhatsApp FAQ & routing assistant", desc: "Answers repeat questions instantly and routes anything complex to your team.", impact: 3, ease: 3 }),
    calls: (i) => ({ title: "AI voice agent for missed calls", desc: `Picks up eligible calls, captures ${LEAD_NOUN[i]}, and sends your team a summary.`, impact: 3, ease: 2 }),
    booking: (i) => ({ title: `Automated ${BOOKING_NOUN[i]} + reminders`, desc: "Checks your calendar, books after confirmation, and sends reminders to cut no-shows.", impact: 3, ease: 3 }),
    followup: (i) => ({ title: "Lead qualification & follow-up", desc: `Qualifies ${LEAD_NOUN[i]}, updates your CRM, and schedules permitted follow-ups.`, impact: 3, ease: 2 }),
    data: (i) => ({ title: "Data entry & document extraction", desc: "Pulls details from forms and documents into your sheets or CRM, with validation.", impact: 2, ease: 2 }),
    status: (i) => ({ title: `Automatic ${STATUS_NOUN[i]}`, desc: "Keeps customers updated proactively, so they stop asking “any update?”.", impact: 2, ease: 3 }),
  };
  // Demo scenarios / plan buttons preselect matching bottlenecks.
  const INTEREST_PAINS = {
    "WhatsApp booking": ["wa", "booking"], "Missed call → lead": ["calls"], "Lead → customer": ["followup"],
    "Customer support": ["wa", "status"], "Internal operations": ["data"],
  };

  const feed = $("#intake-feed");
  const controls = $("#intake-controls");
  const timerEl = $("#intake-timer");
  const bar = $("#intake-bar");
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

  let st;
  let tick = null;
  let stage = 0;

  const elapsed = () => (st.startedAt ? (performance.now() - st.startedAt) / 1000 : 0);
  const fmt = (s) => `${s < 10 ? "0" : ""}${s.toFixed(1)}s`;
  const startTimer = () => {
    if (st.startedAt) return;
    st.startedAt = performance.now();
    tick = setInterval(() => { timerEl.textContent = fmt(elapsed()); }, 100);
  };
  const stopTimer = () => { clearInterval(tick); timerEl.textContent = fmt(elapsed()); };
  const progress = (p) => { bar.style.width = `${p}%`; };

  const scrollIntake = () => { feed.scrollTop = feed.scrollHeight; };
  const push = (el) => { feed.appendChild(el); scrollIntake(); return el; };
  const bubble = (type, text) => { const b = document.createElement("div"); b.className = `bubble bubble--${type}`; b.textContent = text; return push(b); };

  const agentSays = async (text, ms = 700) => {
    const t = document.createElement("div");
    t.className = "typing";
    t.innerHTML = "<i></i><i></i><i></i>";
    push(t);
    await wait(ms);
    t.remove();
    // Agent is "us" in the intake, so render on the incoming side like a real chat with a business.
    bubble("in", text);
  };

  const setControls = (html) => { controls.innerHTML = html; };

  /* Step 1: bottlenecks (multi-select) */
  const renderPains = () => {
    setControls(`
      <p class="intake__hint">Tap all that apply</p>
      <div class="chips">${PAINS.map((p) => `<button type="button" class="chip" data-pain="${p.id}" aria-pressed="${st.pains.has(p.id)}">${esc(p.label)}</button>`).join("")}</div>
      <div class="intake__actions"><span class="intake__hint" id="pain-count"></span>
        <button type="button" class="btn btn--primary btn--sm" id="pain-next">Continue →</button></div>`);
    const next = $("#pain-next");
    const sync = () => {
      next.disabled = st.pains.size === 0;
      next.style.opacity = st.pains.size ? 1 : 0.5;
      $("#pain-count").textContent = st.pains.size ? `${st.pains.size} selected` : "Pick at least one";
    };
    $$(".chip", controls).forEach((c) => c.addEventListener("click", () => {
      startTimer();
      const id = c.dataset.pain;
      st.pains.has(id) ? st.pains.delete(id) : st.pains.add(id);
      c.setAttribute("aria-pressed", String(st.pains.has(id)));
      sync();
    }));
    next.addEventListener("click", () => { if (st.pains.size) { startTimer(); askIndustry(); } });
    sync();
  };

  /* Step 2: industry (single tap advances) */
  const askIndustry = async () => {
    stage = 2;
    setControls("");
    bubble("out", PAINS.filter((p) => st.pains.has(p.id)).map((p) => p.label).join(" · "));
    progress(33);
    await agentSays(`Got it, ${st.pains.size} bottleneck${st.pains.size > 1 ? "s" : ""} noted. Which industry are you in?`);
    setControls(`<div class="chips">${INDUSTRIES.map((i) => `<button type="button" class="chip" data-ind="${i.id}">${esc(i.label)}</button>`).join("")}</div>`);
    $$(".chip", controls).forEach((c) => c.addEventListener("click", () => { st.industry = c.dataset.ind; askContact(); }));
  };

  /* Step 3: contact */
  const askContact = async () => {
    stage = 3;
    setControls("");
    bubble("out", INDUSTRIES.find((i) => i.id === st.industry).label);
    progress(66);
    await agentSays("Last one: where should our specialist reach you? Your snapshot is generated the moment you hit run.");
    setControls(`
      <div class="intake__row">
        <input type="text" id="in-name" placeholder="Your name" autocomplete="name" aria-label="Your name" />
        <input type="text" id="in-contact" placeholder="WhatsApp number or email" autocomplete="email" aria-label="WhatsApp number or email" />
      </div>
      <label class="consent"><input type="checkbox" id="in-consent" />
        <span>I agree to be contacted about this request by email, phone or WhatsApp. I can opt out anytime.</span></label>
      <input type="checkbox" id="in-botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <p class="intake__error" id="in-error" hidden></p>
      <button type="button" class="btn btn--primary btn--block" id="in-run">Run my automation ⚡</button>`);
    $("#in-name").focus({ preventScroll: true });
    const submit = () => {
      const name = $("#in-name").value.trim();
      const contact = $("#in-contact").value.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
      const isPhone = /^\+?[\d\s()-]{8,}$/.test(contact) && contact.replace(/\D/g, "").length >= 8;
      const problems = [];
      $("#in-name").classList.toggle("is-invalid", !name);
      $("#in-contact").classList.toggle("is-invalid", !(isEmail || isPhone));
      $(".consent", controls).classList.toggle("is-invalid", !$("#in-consent").checked);
      if (!name) problems.push("your name");
      if (!(isEmail || isPhone)) problems.push("a valid WhatsApp number or email");
      if (!$("#in-consent").checked) problems.push("your consent to be contacted");
      if (problems.length) {
        const err = $("#in-error");
        err.textContent = `Please add ${problems.join(", ")}.`;
        err.hidden = false;
        return;
      }
      st.name = name;
      st.contact = contact;
      st.channel = isEmail ? "email" : "WhatsApp";
      st.botcheck = $("#in-botcheck").checked; // hidden field: only bots tick it, Web3Forms then drops the message
      runAutomation();
    };
    $("#in-run").addEventListener("click", submit);
    $$("input", controls).forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); }));
  };

  const firstName = (n) => { const p = n.split(/\s+/); return (/^(dr|mr|mrs|ms|miss|prof)\.?$/i.test(p[0]) && p[1]) ? p[1] : p[0]; };

  const rankOpportunities = () => {
    const fit = INDUSTRY_FIT[st.industry];
    const score = (id) => { const o = OPPS[id](st.industry); return o.impact * 2 + o.ease + (fit.includes(id) ? 1 : 0); };
    const chosen = [...st.pains].sort((a, b) => score(b) - score(a)).slice(0, 3).map((id) => ({ id, suggested: false }));
    for (const id of fit) {
      if (chosen.length >= 3) break;
      if (!chosen.some((c) => c.id === id)) chosen.push({ id, suggested: true });
    }
    return chosen.map(({ id, suggested }) => ({ ...OPPS[id](st.industry), suggested }));
  };

  const configured = (v) => Boolean(v) && !v.startsWith("YOUR_");

  // Email via Web3Forms. Resolves true only when the email was accepted.
  const sendEmail = async (lead) => {
    if (!configured(CONFIG.web3formsKey)) return false;
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: CONFIG.web3formsKey,
        subject: `New lead: ${lead.name} (${lead.industry})`,
        from_name: "Tricaal website",
        ...(lead.channel === "email" ? { replyto: lead.contact } : {}),
        botcheck: lead.botcheck,
        "Name": lead.name,
        "Contact": lead.contact,
        "Preferred channel": lead.channel,
        "Industry": lead.industry,
        "Bottlenecks": lead.bottlenecks.join(", "),
        "Top opportunities": lead.opportunities.map((o, i) => `${i + 1}. ${o}`).join("  "),
        "Came from page": lead.page,
        "Completed in": `${lead.secondsToComplete}s`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.success !== false;
  };

  // New row in Google Sheets via the Apps Script web app (see google-sheets-leads.gs).
  // text/plain keeps this a "simple" request, which Apps Script accepts without a CORS preflight.
  const sendToSheet = async (lead) => {
    if (!configured(CONFIG.googleSheetUrl)) return false;
    const res = await fetch(CONFIG.googleSheetUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(lead),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok === true;
  };

  // Sends to every configured destination in parallel. The lead counts as delivered if any one succeeds.
  const submitLead = async (lead) => {
    lead = { ...lead, page: location.href };
    if (!configured(CONFIG.web3formsKey) && !configured(CONFIG.googleSheetUrl)) {
      console.warn("Lead not sent: add your Web3Forms key and/or Google Sheet URL to CONFIG at the top of main.js.", lead);
      return false;
    }
    const [email, sheet] = await Promise.allSettled([sendEmail(lead), sendToSheet(lead)]);
    const ok = (r) => r.status === "fulfilled" && r.value === true;
    if (configured(CONFIG.web3formsKey) && !ok(email)) console.error("Email delivery failed", email.reason || email.value);
    if (configured(CONFIG.googleSheetUrl) && !ok(sheet)) console.error("Google Sheets delivery failed", sheet.reason || sheet.value);
    return ok(email) || ok(sheet);
  };

  /* Step 4: run the workflow live */
  const runAutomation = async () => {
    stage = 4;
    setControls(`<p class="intake__hint">Running your workflow…</p>`);
    bubble("out", `${st.name} · ${st.contact}`);
    progress(85);

    const indLabel = INDUSTRIES.find((i) => i.id === st.industry).label;
    const steps = [
      "Request received & validated",
      `Qualified · ${indLabel} · ${st.pains.size} bottleneck${st.pains.size > 1 ? "s" : ""}`,
      "Opportunities ranked by impact & feasibility",
      "Routed to an automation specialist",
    ];
    const run = document.createElement("div");
    run.className = "run";
    run.innerHTML = `<span class="run__title">Workflow · intake → qualify → rank → route</span>` +
      steps.map((s) => `<div class="run__step"><i></i><span>${esc(s)}</span><span class="mono"></span></div>`).join("");
    push(run);

    const rows = $$(".run__step", run);
    const ranked = rankOpportunities();
    let sent = false;
    for (let i = 0; i < rows.length; i++) {
      rows[i].classList.add("is-running");
      let ok = true;
      if (i === 3) {
        sent = ok = await submitLead({
          name: st.name, contact: st.contact, channel: st.channel, industry: indLabel,
          bottlenecks: PAINS.filter((p) => st.pains.has(p.id)).map((p) => p.label),
          opportunities: ranked.map((o) => o.title), secondsToComplete: +elapsed().toFixed(1),
          botcheck: st.botcheck,
        });
        if (!ok) $("span", rows[i]).textContent = "Couldn't reach our team automatically";
      } else {
        await wait(550 + i * 150);
      }
      rows[i].classList.replace("is-running", ok ? "is-done" : "is-failed");
      $(".mono", rows[i]).textContent = `+${elapsed().toFixed(1)}s`;
      scrollIntake();
    }

    const tag = (o) => [
      `<span>${o.impact === 3 ? "High impact" : "Medium impact"}</span>`,
      `<span class="alt">${o.ease === 3 ? "Quick win" : "Needs integration"}</span>`,
      o.suggested ? `<span class="alt">Suggested for ${esc(indLabel)}</span>` : "",
    ].join("");
    const snap = document.createElement("div");
    snap.className = "snapshot";
    snap.innerHTML = `
      <div class="snapshot__head"><b>${esc(firstName(st.name))}'s automation snapshot</b><span>ranked live</span></div>
      ${ranked.map((o, i) => `<div class="opp"><span class="opp__rank">${i + 1}</span><div><b>${esc(o.title)}</b><p>${esc(o.desc)}</p><div class="opp__tags">${tag(o)}</div></div></div>`).join("")}
      <p class="snapshot__note">A first pass based on your answers. In your free audit we validate it against your real tools, volumes and costs.</p>`;
    await wait(300);
    push(snap);
    stopTimer();
    progress(100);

    await agentSays(sent
      ? `Done in ${elapsed().toFixed(1)} seconds ⚡ That's the speed we build into your business. A specialist will contact you ${st.channel === "email" ? "by email" : "on WhatsApp"} within one business day to book your free audit.`
      : `Your snapshot is ready, but I couldn't pass your details to our team just now. Tap the button below to email them to us directly. It's already filled in.`, 600);

    const summary = [
      "Hi Tricaal team,", "",
      `Name: ${st.name}`, `Contact: ${st.contact}`, `Industry: ${indLabel}`,
      `Bottlenecks: ${PAINS.filter((p) => st.pains.has(p.id)).map((p) => p.label).join(", ")}`,
      `Top opportunities: ${ranked.map((o) => o.title).join("; ")}`, "",
      "I'd like to book my free automation audit.",
    ].map(encodeURIComponent).join("%0D%0A");
    setControls(`
      <div class="intake__actions">
        <button type="button" class="link-btn" id="in-restart">↻ Start over</button>
        <a class="btn btn--primary btn--sm" href="mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent("Free automation audit")}&body=${summary}">${sent ? "Book my audit call now →" : "Email my details →"}</a>
      </div>`);
    $("#in-restart").addEventListener("click", startIntake);
  };

  const startIntake = () => {
    clearInterval(tick);
    st = { pains: new Set(), industry: null, name: "", contact: "", channel: "", startedAt: null };
    stage = 1;
    timerEl.textContent = fmt(0);
    progress(0);
    feed.innerHTML = "";
    bubble("in", "Hi 👋 I'm the same kind of assistant we build for our clients. Let's find what to automate first. What takes up most of your team's time?");
    renderPains();
  };
  startIntake();

  const preselect = (interest) => {
    const pains = INTEREST_PAINS[interest];
    if (!pains || stage !== 1) return;
    pains.forEach((p) => st.pains.add(p));
    renderPains();
  };
  $("#demo-cta").addEventListener("click", (e) => preselect(e.currentTarget.dataset.interest));
})();
