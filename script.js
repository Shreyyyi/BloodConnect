const donorMatches = [
  { name: "Aarav Sharma", group: "O+", distance: "1.8 km", status: "Eligible now", score: "98%" },
  { name: "Meera Iyer", group: "A+", distance: "2.4 km", status: "Available today", score: "94%" },
  { name: "Rohan Das", group: "B+", distance: "3.1 km", status: "Verified donor", score: "91%" },
  { name: "Fatima Khan", group: "AB-", distance: "4.6 km", status: "Emergency responder", score: "89%" }
];

const dashboards = {
  donor: {
    title: "Donor Dashboard",
    profile: "Priya Nair · B+",
    subtitle: "Last donation: 74 days ago · Eligible from today",
    metrics: [
      ["Donations", "12"],
      ["Badges", "5"],
      ["Nearby requests", "8"],
      ["Reward points", "2,450"]
    ],
    cards: [
      ["Eligibility Status", "Ready to donate after completing the health checklist.", 92],
      ["Donation History", "City Hospital, Govt. School Camp, Red Cross Drive.", 68]
    ]
  },
  patient: {
    title: "Patient Dashboard",
    profile: "Emergency request · O-",
    subtitle: "Status: 6 donors notified · Hospital verification pending",
    metrics: [
      ["Nearby donors", "23"],
      ["Hospitals", "5"],
      ["Response ETA", "9 min"],
      ["Request status", "Live"]
    ],
    cards: [
      ["Search Blood", "Filter by group, radius, hospital, and availability.", 86],
      ["Track Request", "Priority notifications sent to verified O- donors.", 74]
    ]
  },
  hospital: {
    title: "Hospital Dashboard",
    profile: "Metro Care Blood Bank",
    subtitle: "Live stock monitoring · 14 requests managed today",
    metrics: [
      ["O+ Units", "46"],
      ["B+ Units", "31"],
      ["Critical groups", "2"],
      ["Drives active", "4"]
    ],
    cards: [
      ["Manage Requests", "Approve emergency cases and assign verified donors.", 78],
      ["Analytics", "Monitor usage trends, shortages, and donor conversion.", 64]
    ]
  },
  camp: {
    title: "Camp Organizer Dashboard",
    profile: "Community Mega Drive",
    subtitle: "Live registrations: 142 · Attendance tracking enabled",
    metrics: [
      ["Registrations", "142"],
      ["Checked in", "88"],
      ["SMS sent", "1,920"],
      ["Units target", "120"]
    ],
    cards: [
      ["Manage Camps", "Create drives at Anganwadi centers, schools, and hospitals.", 82],
      ["Location Sharing", "Share camp routes and live attendance with hospitals.", 70]
    ]
  }
};

const navToggle = document.querySelector(".nav-toggle");
const navbar = document.querySelector(".navbar");
const themeToggle = document.querySelector(".theme-toggle");
const matchButton = document.querySelector("#matchButton");
const matchList = document.querySelector("#matchList");
const bloodGroup = document.querySelector("#bloodGroup");
const urgency = document.querySelector("#urgency");
const sosButton = document.querySelector("#sosButton");
const voiceButton = document.querySelector("#voiceButton");
const sosStatus = document.querySelector("#sosStatus");
const dashboardShell = document.querySelector("#dashboardShell");
const tabs = document.querySelectorAll(".tab");

const savedTheme = localStorage.getItem("bloodconnect-theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
}

navToggle.addEventListener("click", () => {
  const isOpen = navbar.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    navbar.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("bloodconnect-theme", document.body.classList.contains("dark") ? "dark" : "light");
});

function renderMatches() {
  const selectedGroup = bloodGroup.value;
  const selectedUrgency = urgency.value;
  const matches = donorMatches.map((donor, index) => ({
    ...donor,
    group: index === 0 ? selectedGroup : donor.group
  }));

  matchList.innerHTML = matches.map((donor) => `
    <article class="match-item">
      <span class="blood-badge">${donor.group}</span>
      <div>
        <strong>${donor.name}</strong>
        <p>${donor.distance} away · ${donor.status} · ${selectedUrgency} match ${donor.score}</p>
      </div>
      <button class="button button-secondary" type="button">Connect</button>
    </article>
  `).join("");
}

matchButton.addEventListener("click", renderMatches);
renderMatches();

sosButton.addEventListener("click", () => {
  const dot = sosStatus.querySelector(".status-dot");
  dot.classList.add("active");
  sosStatus.querySelector("strong").textContent = "SOS Activated";
  sosStatus.querySelector("p").textContent = "28 nearby verified donors notified. Location matching and hospital escalation are active.";
});

voiceButton.addEventListener("click", () => {
  sosStatus.querySelector("strong").textContent = "Voice Assist Ready";
  sosStatus.querySelector("p").textContent = "Voice-guided request flow enabled for low-connectivity support.";
});

function renderDashboard(key) {
  const dashboard = dashboards[key];
  dashboardShell.innerHTML = `
    <div class="dashboard-grid">
      <aside class="profile-card">
        <p>${dashboard.title}</p>
        <h3>${dashboard.profile}</h3>
        <p>${dashboard.subtitle}</p>
      </aside>
      <div class="dashboard-metrics">
        ${dashboard.metrics.map(([label, value]) => `
          <div class="metric">
            <strong>${value}</strong>
            <span>${label}</span>
          </div>
        `).join("")}
      </div>
      ${dashboard.cards.map(([title, text, progress]) => `
        <article class="mini-card">
          <h3>${title}</h3>
          <p>${text}</p>
          <div class="progress" aria-label="${title} progress">
            <span style="width: ${progress}%"></span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    renderDashboard(tab.dataset.dashboard);
  });
});

renderDashboard("donor");

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const number = entry.target;
    const target = Number(number.dataset.count);
    const duration = 1100;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.floor(target * (1 - Math.pow(1 - progress, 3)));
      number.textContent = value.toLocaleString("en-IN");
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    statObserver.unobserve(number);
  });
}, { threshold: 0.45 });

document.querySelectorAll("[data-count]").forEach((number) => statObserver.observe(number));
