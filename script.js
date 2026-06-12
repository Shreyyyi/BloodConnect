/* ── Mock Backend Database (localStorage) ── */
const MockDB = {
  get(key) {
    return JSON.parse(localStorage.getItem(`bc_${key}`) || "[]");
  },
  set(key, data) {
    localStorage.setItem(`bc_${key}`, JSON.stringify(data));
  },
  init() {
    if (!localStorage.getItem("bc_initialized")) {
      this.seed();
      localStorage.setItem("bc_initialized", "true");
    }
  },
  seed() {
    const users = [
      { id: 1, name: "Aarav Sharma", email: "aarav@bloodconnect.in", password: "password123", phone: "+91 98765 43210", role: "donor", bloodGroup: "O+", verified: true, score: 98, status: "approved", donations: 12, badges: 5, points: 2450, lastDonation: "2025-03-15" },
      { id: 2, name: "Meera Iyer", email: "meera@bloodconnect.in", password: "password123", phone: "+91 98765 43211", role: "donor", bloodGroup: "A+", verified: true, score: 94, status: "approved", donations: 9, badges: 4, points: 1980, lastDonation: "2025-04-20" },
      { id: 3, name: "Priya Nair", email: "priya@bloodconnect.in", password: "password123", phone: "+91 98765 43214", role: "donor", bloodGroup: "B+", verified: true, score: 96, status: "approved", donations: 12, badges: 5, points: 2450, lastDonation: "2025-03-28" },
      { id: 4, name: "Metro Care Admin", email: "hospital@bloodconnect.in", password: "password123", role: "hospital", phone: "+91 90000 11112", verified: true }
    ];
    this.set("users", users);
    this.set("camps", [
      { id: 1, name: "Govt. School Camp", location: "Sarojini Nagar, New Delhi", date: "2026-06-11", time: "10:00 AM", seatsTotal: 120, seatsRegistered: 78, smsEnabled: true },
      { id: 2, name: "Anganwadi Health Drive", location: "Okhla Phase 2, New Delhi", date: "2026-06-12", time: "09:00 AM", seatsTotal: 50, seatsRegistered: 32, smsEnabled: true },
      { id: 3, name: "City Hospital Mega Drive", location: "Metro Care Blood Bank", date: "2026-06-14", time: "08:00 AM", seatsTotal: 200, seatsRegistered: 142, smsEnabled: true }
    ]);
  }
};

MockDB.init();

const state = {
  token: localStorage.getItem("bloodconnect-token"),
  user: JSON.parse(localStorage.getItem("bloodconnect-user") || "null"),
  coords: { lat: 28.6139, lng: 77.2090 }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ── API Mock ── */
async function api(path, options = {}) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 400));

  const body = options.body ? JSON.parse(options.body) : {};
  const users = MockDB.get("users");

  if (path === "/auth/login") {
    const user = users.find(u => u.email === body.email && u.password === body.password);
    if (!user) throw new Error("Invalid email or password");
    return { token: "mock_token_" + user.id, user };
  }

  if (path === "/auth/me") {
    const userId = parseInt(state.token.replace("mock_token_", ""), 10);
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("Session expired");
    return { user };
  }

  if (path === "/auth/register") {
    if (users.some(u => u.email === body.email)) throw new Error("Email already registered");
    const newUser = { ...body, id: Date.now(), verified: false, score: 0, status: "pending", donations: 0, badges: 0, points: 0 };
    users.push(newUser);
    MockDB.set("users", users);
    return { token: "mock_token_" + newUser.id, user: newUser };
  }

  if (path === "/auth/verify") {
    const userIndex = users.findIndex(u => u.id === state.user.id);
    if (userIndex === -1) throw new Error("User not found");

    // Simulate AI Verification Logic
    const score = Math.floor(Math.random() * 20) + 80; // 80-100
    const verification = {
      score,
      status: "approved",
      aiSummary: "ID document matched and health metrics within safe donation range.",
      checks: [
        { name: "Identity Match", pass: true, detail: "Document photo matches profile name." },
        { name: "Age Verification", pass: true, detail: "Donor age is within 18-65 range." },
        { name: "Eligibility Interval", pass: true, detail: "No recent donations within 90 days." }
      ]
    };

    users[userIndex] = { ...users[userIndex], ...verification, verified: true };
    MockDB.set("users", users);
    return { verification, user: users[userIndex] };
  }

  if (path.startsWith("/donors/search")) {
    const params = new URLSearchParams(path.split("?")[1]);
    const bg = params.get("bloodGroup");
    const matches = users.filter(u => u.role === "donor" && (!bg || u.bloodGroup === bg)).map(u => ({
      ...u,
      distance: (Math.random() * 5 + 0.5).toFixed(1) + " km",
      score: u.score + "%"
    }));
    return { matches };
  }

  if (path === "/camps") {
    return { camps: MockDB.get("camps") };
  }

  if (path === "/stats") {
    return { registeredDonors: 48210, livesSaved: 12654, activeCamps: 318, bloodUnitsAvailable: 8942 };
  }

  if (path.startsWith("/contact/dashboard/")) {
    const role = path.split("/").pop();
    const u = state.user;
    if (!u) throw new Error("Not logged in");

    // Generate dashboard data based on user type
    if (role === "donor") {
      return {
        title: "Donor Dashboard",
        profile: `${u.name} · ${u.bloodGroup}`,
        subtitle: u.verified ? "Verified Donor · Eligible to donate" : "Account active · Complete AI verification",
        metrics: [["Donations", u.donations || 0], ["Badges", u.badges || 0], ["Nearby requests", "5"], ["Reward points", (u.points || 0).toLocaleString()]],
        cards: [["Eligibility Status", u.verified ? "Ready to donate." : "Pending verification.", u.verified ? 100 : 30], ["Contribution", "Your donations have helped save lives.", 60]]
      };
    }
    // Simple fallbacks for other roles in this mock
    return { title: role.charAt(0).toUpperCase() + role.slice(1) + " Dashboard", profile: u.name, subtitle: "Dashboard active", metrics: [["Activity", "High"], ["Status", "Live"]], cards: [["Overview", "System checking...", 80]] };
  }

  throw new Error(`API route not found: ${path}`);
}

function toast(message, type = "info") {
  const container = $("#toastContainer");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("bloodconnect-token", token);
  localStorage.setItem("bloodconnect-user", JSON.stringify(user));
  updateAuthUI();
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("bloodconnect-token");
  localStorage.removeItem("bloodconnect-user");
  updateAuthUI();
}

function updateAuthUI() {
  const authButtons = $("#authButtons");
  const userMenu = $("#userMenu");
  const userBadge = $("#userBadge");
  const verifyBtn = $("#verifyBtn");

  if (state.user) {
    authButtons.classList.add("hidden");
    userMenu.classList.remove("hidden");
    const verified = state.user.verified ? " ✓" : "";
    userBadge.textContent = `${state.user.name.split(" ")[0]} · ${state.user.role}${verified}`;
    verifyBtn.classList.toggle("hidden", state.user.verified);
  } else {
    authButtons.classList.remove("hidden");
    userMenu.classList.add("hidden");
  }
}

function openModal(id) {
  $(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  $(id).classList.add("hidden");
  document.body.style.overflow = "";
}

/* ── Navigation ── */
const navToggle = $(".nav-toggle");
const navbar = $(".navbar");
const themeToggle = $(".theme-toggle");

if (localStorage.getItem("bloodconnect-theme") === "dark") {
  document.body.classList.add("dark");
}

navToggle.addEventListener("click", () => {
  const isOpen = navbar.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

$$(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navbar.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("bloodconnect-theme", document.body.classList.contains("dark") ? "dark" : "light");
});

/* ── Auth Modal ── */
let authMode = "login";

$("#loginBtn").addEventListener("click", () => {
  authMode = "login";
  setAuthMode("login");
  openModal("#authModal");
});

$("#registerBtn").addEventListener("click", () => {
  authMode = "register";
  setAuthMode("register");
  openModal("#authModal");
});

$("#closeAuthModal").addEventListener("click", () => closeModal("#authModal"));

$$(".modal-tab").forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.mode));
});

function setAuthMode(mode) {
  authMode = mode;
  $$(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  $("#registerFields").classList.toggle("hidden", mode === "login");
  $("#authSubmit").textContent = mode === "login" ? "Log In" : "Create Account";
  $("#authModalTitle").textContent = mode === "login" ? "Welcome back" : "Join BloodConnect";
}

$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;

  // Common Validations
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return toast("Please enter a valid email address", "error");
  }
  if (password.length < 6) {
    return toast("Password must be at least 6 characters", "error");
  }

  try {
    if (authMode === "login") {
      const { token, user } = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      saveSession(token, user);
      closeModal("#authModal");
      toast(`Welcome back, ${user.name}!`, "success");
    } else {
      const name = $("#regName").value.trim();
      const phone = $("#regPhone").value.trim();
      const role = $("#regRole").value;
      const bloodGroup = $("#regBloodGroup").value || null;

      // Registration Validations
      if (name.length < 2) return toast("Please enter your full name", "error");
      if (!/^\+?[\d\s-]{10,}$/.test(phone)) {
        return toast("Please enter a valid phone number", "error");
      }

      const body = { name, email, password, role, bloodGroup, phone };

      const { token, user } = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(body)
      });
      saveSession(token, user);
      closeModal("#authModal");
      toast("Account created! Complete AI verification.", "success");
      openModal("#verifyModal");
    }
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#logoutBtn").addEventListener("click", () => {
  clearSession();
  toast("Logged out", "info");
});

/* ── AI Verification ── */
$("#verifyBtn").addEventListener("click", () => openModal("#verifyModal"));
$("#closeVerifyModal").addEventListener("click", () => closeModal("#verifyModal"));

$("#verifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.token) return toast("Please log in first", "error");

  try {
    const { verification, user } = await api("/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        documentType: $("#docType").value,
        documentNumber: $("#docNumber").value.trim(),
        age: parseInt($("#verifyAge").value, 10) || null,
        weight: parseFloat($("#verifyWeight").value) || null,
        hemoglobin: parseFloat($("#verifyHb").value) || null,
        lastDonationDate: $("#verifyLastDonation").value || null
      })
    });

    saveSession(state.token, user);
    showVerificationResult(verification);
    toast(verification.status === "approved" ? "AI verification passed!" : `Status: ${verification.status}`, verification.status === "approved" ? "success" : "info");
  } catch (err) {
    toast(err.message, "error");
  }
});

function showVerificationResult(v) {
  const result = $("#verifyResult");
  result.classList.remove("hidden");

  const ring = $("#verifyScoreRing");
  const color = v.status === "approved" ? "var(--green)" : v.status === "review" ? "var(--blue)" : "var(--red)";
  ring.innerHTML = `
    <svg viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="8"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${326 * v.score / 100} 326" stroke-linecap="round" transform="rotate(-90 60 60)"/>
    </svg>
    <strong>${v.score}%</strong>
    <span>${v.status.toUpperCase()}</span>
  `;

  $("#verifySummary").textContent = v.aiSummary;
  $("#verifyChecks").innerHTML = v.checks.map((c) => `
    <li class="${c.pass ? "pass" : "fail"}">
      <span class="check-icon">${c.pass ? "✓" : "✗"}</span>
      <div><strong>${c.name}</strong><p>${c.detail}</p></div>
    </li>
  `).join("");
}

/* ── Donor Search ── */
const matchButton = $("#matchButton");
const matchList = $("#matchList");
const bloodGroup = $("#bloodGroup");
const urgency = $("#urgency");

async function renderMatches() {
  matchList.innerHTML = `<p class="match-loading"><span class="spinner"></span> Searching nearby donors…</p>`;

  try {
    const params = new URLSearchParams({
      bloodGroup: bloodGroup.value,
      urgency: urgency.value,
      lat: state.coords.lat,
      lng: state.coords.lng
    });
    const { matches } = await api(`/donors/search?${params}`);

    if (!matches.length) {
      matchList.innerHTML = `<p class="empty-state">No donors found nearby. Try a different blood group.</p>`;
      return;
    }

    matchList.innerHTML = matches.map((donor) => `
      <article class="match-item">
        <span class="blood-badge">${donor.bloodGroup}</span>
        <div>
          <strong>${donor.name} ${donor.verified ? '<span class="verified-tag">Verified</span>' : ""}</strong>
          <p>${donor.distance} away · ${donor.status} · ${urgency.value} match ${donor.score}</p>
        </div>
        <button class="button button-secondary connect-btn" type="button" data-phone="${donor.phone || ""}">Connect</button>
      </article>
    `).join("");

    $$(".connect-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const phone = btn.dataset.phone;
        if (phone) {
          toast(`Connecting to ${phone}…`, "success");
        } else {
          toast("Donor notified — they'll respond shortly", "success");
        }
      });
    });
  } catch (err) {
    matchList.innerHTML = `<p class="empty-state error">${err.message}</p>`;
  }
}

matchButton.addEventListener("click", renderMatches);

/* ── Camps ── */
async function loadCamps() {
  const campList = $("#campList");
  try {
    const { camps } = await api("/camps");
    campList.innerHTML = `<h3>Active Donation Camps</h3>` + camps.map((c) => `
      <article>
        <strong>${c.name}</strong>
        <span>${c.date}, ${c.time} · ${c.seatsRegistered} registrations · ${c.seatsLeft} seats left${c.smsEnabled ? " · SMS enabled" : ""}</span>
        <button class="button button-secondary camp-register" data-id="${c.id}" type="button">Register</button>
      </article>
    `).join("");

    $$(".camp-register").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!state.token) return toast("Log in to register for a camp", "error");
        try {
          const data = await api(`/camps/${btn.dataset.id}/register`, { method: "POST" });
          toast(data.message, "success");
          loadCamps();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  } catch {
    campList.innerHTML = `<h3>Active Donation Camps</h3><p class="empty-state">Unable to load camps</p>`;
  }
}

/* ── SOS ── */
const sosButton = $("#sosButton");
const voiceButton = $("#voiceButton");
const sosStatus = $("#sosStatus");

sosButton.addEventListener("click", async () => {
  sosButton.disabled = true;
  sosButton.textContent = "Activating…";

  try {
    const data = await api("/sos/activate", {
      method: "POST",
      body: JSON.stringify({
        bloodGroup: bloodGroup.value,
        urgency: "Emergency",
        lat: state.coords.lat,
        lng: state.coords.lng,
        contactPhone: state.user?.phone
      })
    });

    const dot = sosStatus.querySelector(".status-dot");
    dot.classList.add("active");
    sosStatus.querySelector("strong").textContent = "SOS Activated";
    sosStatus.querySelector("p").textContent =
      `${data.donorsNotified} nearby verified donors notified. ETA ~${data.eta}. Hospital escalation active.`;
    toast("Emergency SOS activated!", "success");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    sosButton.disabled = false;
    sosButton.textContent = "Activate SOS";
  }
});

voiceButton.addEventListener("click", () => {
  sosStatus.querySelector("strong").textContent = "Voice Assist Ready";
  sosStatus.querySelector("p").textContent = "Voice-guided request flow enabled for low-connectivity support.";
  if ("speechSynthesis" in window) {
    const utter = new SpeechSynthesisUtterance("BloodConnect voice assist ready. Say your blood group and location.");
    speechSynthesis.speak(utter);
  }
  toast("Voice assist enabled", "info");
});

/* ── Dashboards ── */
const dashboardShell = $("#dashboardShell");
const tabs = $$(".tab");

async function renderDashboard(role) {
  dashboardShell.innerHTML = `<div class="dashboard-loading"><span class="spinner"></span> Loading dashboard…</div>`;

  try {
    const dashboard = state.token
      ? await api(`/contact/dashboard/${role}`)
      : getFallbackDashboard(role);

    dashboardShell.innerHTML = `
      <div class="dashboard-grid">
        <aside class="profile-card">
          <p>${dashboard.title}</p>
          <h3>${dashboard.profile}</h3>
          <p>${dashboard.subtitle}</p>
        </aside>
        <div class="dashboard-metrics">
          ${dashboard.metrics.map(([label, value]) => `
            <div class="metric"><strong>${value}</strong><span>${label}</span></div>
          `).join("")}
        </div>
        ${dashboard.cards.map(([title, text, progress]) => `
          <article class="mini-card">
            <h3>${title}</h3>
            <p>${text}</p>
            <div class="progress" aria-label="${title} progress"><span style="width:${progress}%"></span></div>
          </article>
        `).join("")}
        ${dashboard.stock ? `
          <div class="mini-card stock-card">
            <h3>Live Blood Stock</h3>
            <div class="stock-grid">
              ${dashboard.stock.map((s) => `
                <div class="stock-item ${s.units < 10 ? "critical" : ""}">
                  <strong>${s.blood_group}</strong><span>${s.units} units</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  } catch {
    dashboardShell.innerHTML = `<p class="empty-state">Log in to view your personalized dashboard</p>`;
  }
}

function getFallbackDashboard(role) {
  const fallbacks = {
    donor: { title: "Donor Dashboard", profile: "Guest · —", subtitle: "Log in to see your profile", metrics: [["Donations", "—"], ["Badges", "—"], ["Nearby requests", "—"], ["Reward points", "—"]], cards: [["Eligibility", "Log in and verify.", 20], ["History", "—", 10]] },
    patient: { title: "Patient Dashboard", profile: "Guest", subtitle: "Log in to create requests", metrics: [["Nearby donors", "5"], ["Hospitals", "2"], ["Response ETA", "—"], ["Status", "Idle"]], cards: [["Search Blood", "Use the finder above.", 50], ["Track Request", "—", 20]] },
    hospital: { title: "Hospital Dashboard", profile: "Metro Care Blood Bank", subtitle: "Demo view", metrics: [["O+ Units", "46"], ["B+ Units", "31"], ["Critical groups", "2"], ["Drives active", "3"]], cards: [["Manage Requests", "Approve emergency cases.", 78], ["Analytics", "Monitor trends.", 64]] },
    camp: { title: "Camp Organizer Dashboard", profile: "Community Mega Drive", subtitle: "Demo view", metrics: [["Registrations", "142"], ["Checked in", "88"], ["SMS sent", "1,920"], ["Units target", "120"]], cards: [["Manage Camps", "Create drives.", 82], ["Location Sharing", "Share routes.", 70]] }
  };
  return fallbacks[role];
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    renderDashboard(tab.dataset.dashboard);
  });
});

/* ── Contact ── */
$("#contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/contact", {
      method: "POST",
      body: JSON.stringify({
        name: $("#contactName").value.trim(),
        contact: $("#contactInfo").value.trim(),
        message: $("#contactMessage").value.trim()
      })
    });
    toast(data.message, "success");
    e.target.reset();
  } catch (err) {
    toast(err.message, "error");
  }
});

/* ── Stats ── */
async function loadStats() {
  try {
    const stats = await api("/stats");
    $$("[data-count]").forEach((el) => {
      el.dataset.count = stats[
        el.nextElementSibling?.textContent.includes("Donors") ? "registeredDonors"
          : el.nextElementSibling?.textContent.includes("Saved") ? "livesSaved"
            : el.nextElementSibling?.textContent.includes("Camps") ? "activeCamps"
              : "bloodUnitsAvailable"
      ];
    });
  } catch { /* use defaults */ }
}

/* ── Animations ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

$$(".reveal").forEach((el) => revealObserver.observe(el));

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const number = entry.target;
    const target = Number(number.dataset.count);
    const duration = 1100;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      number.textContent = Math.floor(target * (1 - Math.pow(1 - progress, 3))).toLocaleString("en-IN");
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    statObserver.unobserve(number);
  });
}, { threshold: 0.45 });

$$("[data-count]").forEach((n) => statObserver.observe(n));

/* ── Geolocation ── */
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => { state.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
    () => { }
  );
}

/* ── Init ── */
updateAuthUI();
renderMatches();
loadCamps();
renderDashboard("donor");
loadStats();

if (state.token) {
  api("/auth/me").then(({ user }) => saveSession(state.token, user)).catch(() => clearSession());
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal("#authModal");
    closeModal("#verifyModal");
  }
});

$$(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(`#${overlay.id}`);
  });
});
let tl = gsap.timeline();
tl.from("#logo", {
  opacity: 0,
  x: 1050,
  duration: 1,
  stagger: 0.1,
  ease: "power1.inOut",
});
tl.from(".nav-actions button", {
  opacity: 0,
  stagger: 0.1,
  ease: "power1.inOut",
})
tl.from(".nav-links h5", {
  opacity: 0,
  y: -100,
  stagger: 0.1,
  ease: "power1.inOut",
})
tl.from("#logotext", {
  opacity: 0,
  y: " 50%",
  stagger: 0.1,
  ease: "power1.inOut",
})




