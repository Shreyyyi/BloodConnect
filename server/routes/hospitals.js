const express = require("express");
const db = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const hospitals = db.prepare("SELECT * FROM hospitals").all();
  const stockStmt = db.prepare("SELECT blood_group, units FROM blood_stock WHERE hospital_id = ?");

  res.json({
    hospitals: hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      phone: h.phone,
      stock: stockStmt.all(h.id).reduce((acc, s) => {
        acc[s.blood_group] = s.units;
        return acc;
      }, {})
    }))
  });
});

router.get("/:id/stock", (req, res) => {
  const hospital = db.prepare("SELECT * FROM hospitals WHERE id = ?").get(req.params.id);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const stock = db.prepare("SELECT blood_group, units FROM blood_stock WHERE hospital_id = ?").all(hospital.id);
  res.json({ hospital: { id: hospital.id, name: hospital.name }, stock });
});

router.put("/:id/stock", authMiddleware, (req, res) => {
  if (req.user.role !== "hospital") {
    return res.status(403).json({ error: "Hospital access only" });
  }

  const { bloodGroup, units } = req.body;
  if (!bloodGroup || units == null) {
    return res.status(400).json({ error: "bloodGroup and units required" });
  }

  const hospitalId = parseInt(req.params.id, 10);
  const existing = db.prepare("SELECT id FROM blood_stock WHERE hospital_id = ? AND blood_group = ?").get(hospitalId, bloodGroup);

  if (existing) {
    db.prepare("UPDATE blood_stock SET units = ? WHERE hospital_id = ? AND blood_group = ?").run(units, hospitalId, bloodGroup);
  } else {
    db.prepare("INSERT INTO blood_stock (hospital_id, blood_group, units) VALUES (?, ?, ?)").run(hospitalId, bloodGroup, units);
  }

  res.json({ message: "Stock updated", bloodGroup, units });
});

module.exports = router;
