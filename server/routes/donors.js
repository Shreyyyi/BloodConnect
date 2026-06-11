const express = require("express");
const db = require("../db");
const { optionalAuth } = require("../middleware/auth");

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

function computeMatchScore(donor, bloodGroup, urgency) {
  let score = donor.verification_score || 70;
  if (donor.blood_group === bloodGroup) score += 15;
  else if (isCompatible(donor.blood_group, bloodGroup)) score += 8;
  if (donor.verified) score += 10;
  if (urgency === "Emergency") score += 5;
  return Math.min(99, Math.round(score));
}

function isCompatible(donorGroup, neededGroup) {
  const universal = { "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] };
  if (donorGroup === "O-") return true;
  if (donorGroup === "O+") return !neededGroup.endsWith("-") || neededGroup === "O+";
  return donorGroup === neededGroup;
}

function eligibilityStatus(donor) {
  if (!donor.verified) return "Pending verification";
  if (donor.last_donation_date) {
    const days = Math.floor((Date.now() - new Date(donor.last_donation_date).getTime()) / 86400000);
    if (days < 90) return `Eligible in ${90 - days} days`;
  }
  return "Eligible now";
}

router.get("/search", optionalAuth, (req, res) => {
  const { bloodGroup = "O+", urgency = "Emergency", lat, lng, radius = 50 } = req.query;
  const userLat = parseFloat(lat) || 28.6139;
  const userLng = parseFloat(lng) || 77.2090;

  const donors = db.prepare(`
    SELECT id, name, blood_group, lat, lng, city, verified, verification_score,
           verification_status, last_donation_date, phone, donations_count
    FROM users WHERE role = 'donor'
    ORDER BY verified DESC, verification_score DESC
  `).all();

  const matches = donors
    .map((d) => {
      const distance = haversineKm(userLat, userLng, d.lat, d.lng);
      return {
        id: d.id,
        name: d.name,
        bloodGroup: d.blood_group,
        distance: `${distance.toFixed(1)} km`,
        distanceKm: distance,
        status: eligibilityStatus(d),
        verified: !!d.verified,
        score: `${computeMatchScore(d, bloodGroup, urgency)}%`,
        scoreNum: computeMatchScore(d, bloodGroup, urgency),
        phone: d.phone,
        city: d.city,
        donationsCount: d.donations_count
      };
    })
    .filter((d) => d.distanceKm <= parseFloat(radius))
    .sort((a, b) => b.scoreNum - a.scoreNum || a.distanceKm - b.distanceKm)
    .slice(0, 20);

  res.json({ bloodGroup, urgency, matches, total: matches.length });
});

router.get("/:id", (req, res) => {
  const donor = db.prepare(`
    SELECT id, name, blood_group, city, verified, verification_score, verification_status,
           last_donation_date, reward_points, badges, donations_count, phone
    FROM users WHERE id = ? AND role = 'donor'
  `).get(req.params.id);

  if (!donor) return res.status(404).json({ error: "Donor not found" });

  res.json({
    donor: {
      id: donor.id,
      name: donor.name,
      bloodGroup: donor.blood_group,
      city: donor.city,
      verified: !!donor.verified,
      verificationScore: donor.verification_score,
      status: eligibilityStatus(donor),
      lastDonationDate: donor.last_donation_date,
      rewardPoints: donor.reward_points,
      badges: donor.badges,
      donationsCount: donor.donations_count,
      phone: donor.phone
    }
  });
});

module.exports = router;
