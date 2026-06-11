const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { authMiddleware, signToken } = require("../middleware/auth");
const { runAiVerification } = require("../services/aiVerification");

const router = express.Router();

function userToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    bloodGroup: row.blood_group,
    city: row.city,
    verified: !!row.verified,
    verificationScore: row.verification_score,
    verificationStatus: row.verification_status,
    age: row.age,
    weight: row.weight,
    hemoglobin: row.hemoglobin,
    lastDonationDate: row.last_donation_date,
    rewardPoints: row.reward_points,
    badges: row.badges,
    donationsCount: row.donations_count
  };
}

router.post("/register", (req, res) => {
  const { name, email, password, phone, role, bloodGroup, age, weight, hemoglobin, city } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password, and role are required" });
  }

  const validRoles = ["donor", "patient", "hospital", "camp"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, phone, role, blood_group, age, weight, hemoglobin, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    email.toLowerCase().trim(),
    hash,
    phone || null,
    role,
    bloodGroup || null,
    age || null,
    weight || null,
    hemoglobin || null,
    city || "New Delhi"
  );

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.status(201).json({ token, user: userToPublic(user), message: "Registration successful. Complete AI verification to get verified." });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.json({ token, user: userToPublic(user) });
});

router.get("/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: userToPublic(user) });
});

router.post("/verify", authMiddleware, (req, res) => {
  const { documentType, documentNumber, age, weight, hemoglobin, lastDonationDate, bloodGroup } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const verificationInput = {
    name: user.name,
    role: user.role,
    bloodGroup: bloodGroup || user.blood_group,
    documentType: documentType || "aadhaar",
    documentNumber,
    age: age ?? user.age,
    weight: weight ?? user.weight,
    hemoglobin: hemoglobin ?? user.hemoglobin,
    lastDonationDate: lastDonationDate || user.last_donation_date
  };

  const result = runAiVerification(verificationInput);

  db.prepare(`
    UPDATE users SET
      verified = ?,
      verification_score = ?,
      verification_status = ?,
      id_document_type = ?,
      id_document_number = ?,
      age = COALESCE(?, age),
      weight = COALESCE(?, weight),
      hemoglobin = COALESCE(?, hemoglobin),
      last_donation_date = COALESCE(?, last_donation_date),
      blood_group = COALESCE(?, blood_group)
    WHERE id = ?
  `).run(
    result.verified,
    result.score,
    result.status,
    documentType || "aadhaar",
    documentNumber || null,
    age ?? null,
    weight ?? null,
    hemoglobin ?? null,
    lastDonationDate || null,
    bloodGroup || null,
    req.user.id
  );

  db.prepare(`
    INSERT INTO verification_logs (user_id, score, status, checks_json)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, result.score, result.status, JSON.stringify(result.checks));

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);

  res.json({
    verification: result,
    user: userToPublic(updated)
  });
});

router.get("/verification-history", authMiddleware, (req, res) => {
  const logs = db.prepare(`
    SELECT id, score, status, checks_json, created_at
    FROM verification_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(req.user.id);

  res.json({
    history: logs.map((l) => ({
      ...l,
      checks: JSON.parse(l.checks_json || "[]")
    }))
  });
});

module.exports = router;
