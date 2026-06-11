const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const camps = db.prepare(`
    SELECT c.*, u.name as organizer_name
    FROM camps c
    LEFT JOIN users u ON c.organizer_id = u.id
    WHERE c.status = 'active'
    ORDER BY c.camp_date ASC
  `).all();

  res.json({
    camps: camps.map((c) => ({
      id: c.id,
      name: c.name,
      location: c.location,
      lat: c.lat,
      lng: c.lng,
      date: c.camp_date,
      time: c.camp_time,
      seatsTotal: c.seats_total,
      seatsRegistered: c.seats_registered,
      seatsLeft: c.seats_total - c.seats_registered,
      smsEnabled: !!c.sms_enabled,
      organizer: c.organizer_name
    }))
  });
});

router.post("/:id/register", authMiddleware, (req, res) => {
  const camp = db.prepare("SELECT * FROM camps WHERE id = ?").get(req.params.id);
  if (!camp) return res.status(404).json({ error: "Camp not found" });

  if (camp.seats_registered >= camp.seats_total) {
    return res.status(400).json({ error: "Camp is full" });
  }

  db.prepare("UPDATE camps SET seats_registered = seats_registered + 1 WHERE id = ?").run(camp.id);

  res.json({
    message: `Registered for ${camp.name}`,
    camp: {
      name: camp.name,
      date: camp.camp_date,
      seatsLeft: camp.seats_total - camp.seats_registered - 1
    }
  });
});

router.post("/", authMiddleware, (req, res) => {
  if (req.user.role !== "camp" && req.user.role !== "hospital") {
    return res.status(403).json({ error: "Only camp organizers can create camps" });
  }

  const { name, location, lat, lng, campDate, campTime, seatsTotal } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: "Name and location required" });
  }

  const result = db.prepare(`
    INSERT INTO camps (organizer_id, name, location, lat, lng, camp_date, camp_time, seats_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    name,
    location,
    lat || 28.6139,
    lng || 77.2090,
    campDate || new Date().toISOString().slice(0, 10),
    campTime || "10:00 AM",
    seatsTotal || 100
  );

  res.status(201).json({ id: result.lastInsertRowid, message: "Camp created" });
});

module.exports = router;
