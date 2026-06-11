const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/", (req, res) => {
  const { name, contact, message } = req.body;
  if (!name || !contact || !message) {
    return res.status(400).json({ error: "Name, contact, and message are required" });
  }

  const result = db.prepare(`
    INSERT INTO contact_messages (name, contact, message) VALUES (?, ?, ?)
  `).run(name.trim(), contact.trim(), message.trim());

  res.status(201).json({ id: result.lastInsertRowid, message: "Message sent successfully. Our team will respond within 24 hours." });
});

router.get("/dashboard/:role", authMiddleware, (req, res) => {
  const role = req.params.role;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);

  if (role === "donor") {
    const nearbyRequests = db.prepare("SELECT COUNT(*) as c FROM blood_requests WHERE status = 'live'").get().c;
    const daysSince = user.last_donation_date
      ? Math.floor((Date.now() - new Date(user.last_donation_date).getTime()) / 86400000)
      : null;

    return res.json({
      title: "Donor Dashboard",
      profile: `${user.name} · ${user.blood_group || "—"}`,
      subtitle: daysSince != null
        ? `Last donation: ${daysSince} days ago · ${daysSince >= 90 ? "Eligible from today" : `Eligible in ${90 - daysSince} days`}`
        : "First-time donor · Complete verification to donate",
      metrics: [
        ["Donations", String(user.donations_count)],
        ["Badges", String(user.badges)],
        ["Nearby requests", String(nearbyRequests)],
        ["Reward points", user.reward_points.toLocaleString("en-IN")]
      ],
      cards: [
        ["Eligibility Status", user.verified ? "AI verified · Ready after health checklist." : "Complete AI verification to unlock matching.", user.verified ? 92 : 35],
        ["Donation History", user.donations_count > 0 ? `${user.donations_count} verified donations on record.` : "No donations yet — register for a camp.", user.donations_count > 0 ? 68 : 20]
      ]
    });
  }

  if (role === "patient") {
    const request = db.prepare(`
      SELECT * FROM blood_requests WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(user.id);

    const donorCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'donor' AND verified = 1").get().c;
    const hospitalCount = db.prepare("SELECT COUNT(*) as c FROM hospitals").get().c;

    return res.json({
      title: "Patient Dashboard",
      profile: `Emergency request · ${user.blood_group || request?.blood_group || "O-"}`,
      subtitle: request
        ? `Status: ${request.donors_notified} donors notified · ${request.status}`
        : "No active request — use SOS or create a request",
      metrics: [
        ["Nearby donors", String(donorCount)],
        ["Hospitals", String(hospitalCount)],
        ["Response ETA", "9 min"],
        ["Request status", request?.status || "Idle"]
      ],
      cards: [
        ["Search Blood", "Filter by group, radius, hospital, and availability.", 86],
        ["Track Request", request ? `Priority notifications sent to ${request.donors_notified} donors.` : "Create a blood request to start tracking.", request ? 74 : 30]
      ]
    });
  }

  if (role === "hospital") {
    const hospital = db.prepare("SELECT * FROM hospitals WHERE user_id = ?").get(user.id)
      || db.prepare("SELECT * FROM hospitals LIMIT 1").get();

    const stock = hospital
      ? db.prepare("SELECT blood_group, units FROM blood_stock WHERE hospital_id = ?").all(hospital.id)
      : [];

    const critical = stock.filter((s) => s.units < 10).length;
    const requestsToday = db.prepare(`
      SELECT COUNT(*) as c FROM blood_requests WHERE date(created_at) = date('now')
    `).get().c;

    const oPlus = stock.find((s) => s.blood_group === "O+")?.units || 0;
    const bPlus = stock.find((s) => s.blood_group === "B+")?.units || 0;

    return res.json({
      title: "Hospital Dashboard",
      profile: hospital?.name || "Metro Care Blood Bank",
      subtitle: `Live stock monitoring · ${requestsToday} requests managed today`,
      metrics: [
        ["O+ Units", String(oPlus)],
        ["B+ Units", String(bPlus)],
        ["Critical groups", String(critical)],
        ["Drives active", String(db.prepare("SELECT COUNT(*) as c FROM camps WHERE status = 'active'").get().c)]
      ],
      cards: [
        ["Manage Requests", "Approve emergency cases and assign verified donors.", 78],
        ["Analytics", "Monitor usage trends, shortages, and donor conversion.", 64]
      ],
      stock
    });
  }

  if (role === "camp") {
    const camps = db.prepare("SELECT * FROM camps WHERE organizer_id = ? OR organizer_id IS NOT NULL LIMIT 1").get();
    const totalReg = db.prepare("SELECT SUM(seats_registered) as s FROM camps").get().s || 0;

    return res.json({
      title: "Camp Organizer Dashboard",
      profile: camps?.name || "Community Mega Drive",
      subtitle: `Live registrations: ${camps?.seats_registered || 142} · Attendance tracking enabled`,
      metrics: [
        ["Registrations", String(camps?.seats_registered || 142)],
        ["Checked in", String(Math.floor((camps?.seats_registered || 142) * 0.62))],
        ["SMS sent", "1,920"],
        ["Units target", "120"]
      ],
      cards: [
        ["Manage Camps", "Create drives at Anganwadi centers, schools, and hospitals.", 82],
        ["Location Sharing", "Share camp routes and live attendance with hospitals.", 70]
      ]
    });
  }

  res.status(400).json({ error: "Invalid dashboard role" });
});

module.exports = router;
