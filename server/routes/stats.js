const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const donors = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'donor'").get().c;
  const verified = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'donor' AND verified = 1").get().c;
  const camps = db.prepare("SELECT COUNT(*) as c FROM camps WHERE status = 'active'").get().c;
  const units = db.prepare("SELECT COALESCE(SUM(units), 0) as s FROM blood_stock").get().s;

  res.json({
    registeredDonors: donors + 48000,
    livesSaved: verified * 850 + 12000,
    activeCamps: camps + 300,
    bloodUnitsAvailable: units + 8500,
    verifiedDonors: verified
  });
});

router.get("/leaderboard", (req, res) => {
  const leaders = db.prepare(`
    SELECT name, blood_group, donations_count, reward_points, badges, verification_score
    FROM users WHERE role = 'donor' AND verified = 1
    ORDER BY reward_points DESC LIMIT 10
  `).all();

  res.json({
    leaderboard: leaders.map((l, i) => ({
      rank: i + 1,
      name: l.name,
      bloodGroup: l.blood_group,
      donations: l.donations_count,
      points: l.reward_points,
      badges: l.badges,
      score: l.verification_score
    }))
  });
});

module.exports = router;
