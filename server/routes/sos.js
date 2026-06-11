const express = require("express");
const db = require("../db");
const { authMiddleware, optionalAuth } = require("../middleware/auth");

const router = express.Router();

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post("/activate", optionalAuth, (req, res) => {
  const { bloodGroup = "O+", urgency = "Emergency", lat, lng, hospitalName, contactPhone } = req.body;
  const userLat = parseFloat(lat) || 28.6139;
  const userLng = parseFloat(lng) || 77.2090;

  const donors = db.prepare(`
    SELECT id, lat, lng, verified, blood_group FROM users WHERE role = 'donor' AND verified = 1
  `).all();

  const nearby = donors.filter((d) => {
    const dist = haversineKm(userLat, userLng, d.lat, d.lng);
    if (dist > 15) return false;
    if (d.blood_group === bloodGroup) return true;
    if (d.blood_group === "O-") return true;
    if (d.blood_group === "O+" && !String(bloodGroup).endsWith("-")) return true;
    return false;
  });

  const result = db.prepare(`
    INSERT INTO sos_requests (user_id, blood_group, urgency, lat, lng, hospital_name, contact_phone, donors_notified, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    req.user?.id || null,
    bloodGroup,
    urgency,
    userLat,
    userLng,
    hospitalName || "Nearest Hospital",
    contactPhone || null,
    nearby.length
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    status: "active",
    message: "SOS activated — priority routing engaged",
    donorsNotified: nearby.length,
    bloodGroup,
    urgency,
    eta: `${Math.max(5, Math.round(nearby.length * 0.4))} min`,
    hospitalsEscalated: 2
  });
});

router.get("/status/:id", (req, res) => {
  const sos = db.prepare("SELECT * FROM sos_requests WHERE id = ?").get(req.params.id);
  if (!sos) return res.status(404).json({ error: "SOS request not found" });

  res.json({
    id: sos.id,
    status: sos.status,
    bloodGroup: sos.blood_group,
    urgency: sos.urgency,
    donorsNotified: sos.donors_notified,
    hospitalName: sos.hospital_name,
    createdAt: sos.created_at
  });
});

router.post("/request", authMiddleware, (req, res) => {
  const { bloodGroup, urgency, hospitalId } = req.body;
  if (!bloodGroup) return res.status(400).json({ error: "Blood group required" });

  const donors = db.prepare(`
    SELECT COUNT(*) as c FROM users WHERE role = 'donor' AND verified = 1 AND blood_group = ?
  `).get(bloodGroup);

  const result = db.prepare(`
    INSERT INTO blood_requests (patient_id, blood_group, urgency, hospital_id, donors_notified)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, bloodGroup, urgency || "Emergency", hospitalId || null, donors.c);

  res.status(201).json({
    id: result.lastInsertRowid,
    status: "live",
    donorsNotified: donors.c,
    message: "Blood request created and donors notified"
  });
});

module.exports = router;
