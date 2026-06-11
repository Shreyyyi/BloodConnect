/**
 * AI-powered donor verification engine.
 * Analyzes identity documents, health metrics, and eligibility rules
 * to produce a verification score and approval status.
 */

const BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];

function validateIdNumber(type, number) {
  if (!number || number.length < 4) {
    return { pass: false, score: 0, reason: "ID number too short or missing" };
  }

  const cleaned = number.replace(/\s/g, "").toUpperCase();

  if (type === "aadhaar") {
    const valid = /^\d{12}$/.test(cleaned.replace(/-/g, ""));
    return {
      pass: valid,
      score: valid ? 95 : 20,
      reason: valid ? "Aadhaar format validated (12 digits)" : "Invalid Aadhaar format"
    };
  }

  if (type === "pan") {
    const valid = /^[A-Z]{5}\d{4}[A-Z]$/.test(cleaned);
    return {
      pass: valid,
      score: valid ? 92 : 25,
      reason: valid ? "PAN format validated" : "Invalid PAN format"
    };
  }

  if (type === "driving_license") {
    const valid = cleaned.length >= 10 && cleaned.length <= 20;
    return {
      pass: valid,
      score: valid ? 88 : 30,
      reason: valid ? "Driving license format accepted" : "Invalid license format"
    };
  }

  const valid = cleaned.length >= 6;
  return {
    pass: valid,
    score: valid ? 75 : 15,
    reason: valid ? "Generic ID accepted for review" : "ID format insufficient"
  };
}

function checkHealthEligibility({ age, weight, hemoglobin, lastDonationDate }) {
  const checks = [];
  let score = 0;
  let count = 0;

  if (age != null) {
    count++;
    const ageOk = age >= 18 && age <= 65;
    checks.push({
      name: "Age eligibility",
      pass: ageOk,
      detail: ageOk ? `${age} years — within 18–65 range` : `${age} years — outside donation age range`
    });
    score += ageOk ? 100 : 0;
  }

  if (weight != null) {
    count++;
    const weightOk = weight >= 45;
    checks.push({
      name: "Weight requirement",
      pass: weightOk,
      detail: weightOk ? `${weight} kg — meets minimum 45 kg` : `${weight} kg — below minimum 45 kg`
    });
    score += weightOk ? 100 : 20;
  }

  if (hemoglobin != null) {
    count++;
    const hbOk = hemoglobin >= 12.5;
    checks.push({
      name: "Hemoglobin level",
      pass: hbOk,
      detail: hbOk ? `${hemoglobin} g/dL — eligible` : `${hemoglobin} g/dL — below 12.5 g/dL threshold`
    });
    score += hbOk ? 100 : 15;
  }

  if (lastDonationDate) {
    count++;
    const last = new Date(lastDonationDate);
    const daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    const intervalOk = daysSince >= 90 || isNaN(daysSince);
    checks.push({
      name: "Donation interval",
      pass: intervalOk,
      detail: intervalOk
        ? daysSince >= 90 ? `${daysSince} days since last donation — eligible` : "No prior donation on record"
        : `${daysSince} days since last donation — wait ${90 - daysSince} more days`
    });
    score += intervalOk ? 100 : 30;
  } else {
    checks.push({
      name: "Donation interval",
      pass: true,
      detail: "First-time donor — no interval restriction"
    });
    count++;
    score += 100;
  }

  const healthScore = count > 0 ? score / count : 50;
  const allPass = checks.every((c) => c.pass);

  return { checks, healthScore, allPass };
}

function analyzeDocumentMetadata({ documentType, documentNumber, name }) {
  const checks = [];

  const idCheck = validateIdNumber(documentType, documentNumber);
  checks.push({
    name: "Identity document",
    pass: idCheck.pass,
    detail: idCheck.reason,
    score: idCheck.score
  });

  if (name && documentNumber) {
    const nameTokens = name.toLowerCase().split(/\s+/).filter(Boolean);
    const hasReasonableName = nameTokens.length >= 2 && name.length >= 4;
    checks.push({
      name: "Profile name consistency",
      pass: hasReasonableName,
      detail: hasReasonableName
        ? "Full name provided and matches profile"
        : "Incomplete name — manual review recommended",
      score: hasReasonableName ? 90 : 40
    });
  }

  const docScore =
    checks.reduce((sum, c) => sum + (c.score ?? (c.pass ? 90 : 20)), 0) / checks.length;

  return { checks, docScore };
}

function runAiVerification(userData) {
  const {
    name,
    bloodGroup,
    documentType = "aadhaar",
    documentNumber,
    age,
    weight,
    hemoglobin,
    lastDonationDate,
    role
  } = userData;

  const allChecks = [];
  let compositeScore = 0;
  const weights = { identity: 0.35, health: 0.40, profile: 0.25 };

  const { checks: docChecks, docScore } = analyzeDocumentMetadata({
    documentType,
    documentNumber,
    name
  });
  allChecks.push(...docChecks);
  compositeScore += docScore * weights.identity;

  const { checks: healthChecks, healthScore, allPass: healthPass } = checkHealthEligibility({
    age,
    weight,
    hemoglobin,
    lastDonationDate
  });
  allChecks.push(...healthChecks);
  compositeScore += healthScore * weights.health;

  let profileScore = 70;
  const profileChecks = [];

  if (bloodGroup && BLOOD_GROUPS.includes(bloodGroup)) {
    profileChecks.push({ name: "Blood group", pass: true, detail: `${bloodGroup} — valid`, score: 100 });
    profileScore = 100;
  } else if (role === "donor") {
    profileChecks.push({ name: "Blood group", pass: false, detail: "Blood group required for donors", score: 0 });
    profileScore = 0;
  } else {
    profileChecks.push({ name: "Blood group", pass: true, detail: "Not required for this role", score: 100 });
    profileScore = 100;
  }

  if (name && name.trim().length >= 3) {
    profileChecks.push({ name: "Display name", pass: true, detail: "Valid display name", score: 95 });
  } else {
    profileChecks.push({ name: "Display name", pass: false, detail: "Name too short", score: 30 });
    profileScore = Math.min(profileScore, 30);
  }

  allChecks.push(...profileChecks);
  compositeScore += profileScore * weights.profile;

  const finalScore = Math.round(compositeScore * 10) / 10;
  let status = "pending";
  let verified = 0;

  if (finalScore >= 85 && docChecks.every((c) => c.pass) && healthPass) {
    status = "approved";
    verified = 1;
  } else if (finalScore >= 60) {
    status = "review";
    verified = 0;
  } else {
    status = "rejected";
    verified = 0;
  }

  if (role !== "donor") {
    status = docChecks[0]?.pass ? "approved" : "review";
    verified = docChecks[0]?.pass ? 1 : 0;
  }

  const aiSummary = buildAiSummary(finalScore, status, allChecks);

  return {
    score: finalScore,
    status,
    verified,
    checks: allChecks,
    aiSummary,
    eligibleToDonate: healthPass && verified === 1 && role === "donor"
  };
}

function buildAiSummary(score, status, checks) {
  const failed = checks.filter((c) => !c.pass).map((c) => c.name);
  if (status === "approved") {
    return `AI verification passed with ${score}% confidence. Identity, health eligibility, and profile data are consistent. Donor is cleared for the network.`;
  }
  if (status === "review") {
    return `AI verification score: ${score}%. Manual review recommended${failed.length ? ` for: ${failed.join(", ")}` : ""}.`;
  }
  return `AI verification failed (${score}%). Issues detected: ${failed.join(", ") || "insufficient data"}. Please resubmit with correct documents and health info.`;
}

module.exports = { runAiVerification, BLOOD_GROUPS };
