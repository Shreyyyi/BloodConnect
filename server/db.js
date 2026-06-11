const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "data.json");

const defaultData = {
  users: [],
  hospitals: [],
  blood_stock: [],
  camps: [],
  sos_requests: [],
  blood_requests: [],
  contact_messages: [],
  verification_logs: [],
  _nextId: { users: 1, hospitals: 1, blood_stock: 1, camps: 1, sos_requests: 1, blood_requests: 1, contact_messages: 1, verification_logs: 1 }
};

let data = loadData();

function loadData() {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, "utf8"));
    }
  } catch {
    /* reset on corrupt file */
  }
  return structuredClone(defaultData);
}

function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function nextId(table) {
  const id = data._nextId[table]++;
  save();
  return id;
}

const db = {
  prepare(sql) {
    return {
      get(...params) { return queryOne(sql, params); },
      all(...params) { return queryAll(sql, params); },
      run(...params) { return queryRun(sql, params); }
    };
  },
  exec() { /* tables created in memory */ }
};

function queryOne(sql, params) {
  const rows = queryAll(sql, params);
  return rows[0] || undefined;
}

function queryAll(sql, params) {
  const s = sql.replace(/\s+/g, " ").trim().toLowerCase();

  if (s.startsWith("select count(*) as c from users")) {
    if (s.includes("role = 'donor' and verified = 1")) {
      return [{ c: data.users.filter((u) => u.role === "donor" && u.verified === 1).length }];
    }
    if (s.includes("role = 'donor'")) {
      return [{ c: data.users.filter((u) => u.role === "donor").length }];
    }
    return [{ c: data.users.length }];
  }

  if (s.includes("select count(*) as c from blood_requests")) return [{ c: data.blood_requests.length }];
  if (s.includes("select count(*) as c from hospitals")) return [{ c: data.hospitals.length }];
  if (s.includes("select count(*) as c from camps")) {
    if (s.includes("status = 'active'")) return [{ c: data.camps.filter((c) => c.status === "active").length }];
    return [{ c: data.camps.length }];
  }
  if (s.includes("select coalesce(sum(units), 0) as s from blood_stock")) {
    return [{ s: data.blood_stock.reduce((a, b) => a + b.units, 0) }];
  }
  if (s.includes("select sum(seats_registered) as s from camps")) {
    return [{ s: data.camps.reduce((a, c) => a + c.seats_registered, 0) }];
  }
  if (s.includes("count(*) as c from blood_requests where date(created_at) = date('now')")) {
    const today = new Date().toISOString().slice(0, 10);
    return [{ c: data.blood_requests.filter((r) => r.created_at?.startsWith(today)).length }];
  }
  if (s.includes("count(*) as c from users where role = 'donor' and verified = 1 and blood_group =")) {
    const bg = params[0];
    return [{ c: data.users.filter((u) => u.role === "donor" && u.verified === 1 && u.blood_group === bg).length }];
  }

  if (s.includes("from users where email =")) {
    return data.users.filter((u) => u.email === params[0]);
  }
  if (s.includes("from users where id =")) {
    const id = params[0];
    if (s.includes("role = 'donor'")) {
      return data.users.filter((u) => u.id === id && u.role === "donor");
    }
    return data.users.filter((u) => u.id === id);
  }
  if (s.includes("from users where role = 'donor'")) {
    let users = data.users.filter((u) => u.role === "donor");
    if (s.includes("verified = 1")) users = users.filter((u) => u.verified === 1);
    if (s.includes("order by verified desc")) {
      users.sort((a, b) => b.verified - a.verified || b.verification_score - a.verification_score);
    }
    if (s.includes("order by reward_points desc")) {
      users.sort((a, b) => b.reward_points - a.reward_points);
    }
    if (s.includes("limit 10")) users = users.slice(0, 10);
    return users;
  }

  if (s.includes("from hospitals where user_id =")) {
    return data.hospitals.filter((h) => h.user_id === params[0]);
  }
  if (s.includes("from hospitals where id =")) {
    return data.hospitals.filter((h) => h.id === parseInt(params[0], 10));
  }
  if (s.includes("from hospitals limit 1")) return data.hospitals.slice(0, 1);
  if (s.startsWith("select * from hospitals")) return data.hospitals;

  if (s.includes("from blood_stock where hospital_id =")) {
    const hid = typeof params[0] === "object" ? params[0] : params[0];
    return data.blood_stock.filter((s) => s.hospital_id === hid);
  }
  if (s.includes("from blood_stock where hospital_id = ? and blood_group =")) {
    return data.blood_stock.filter((s) => s.hospital_id === params[0] && s.blood_group === params[1]);
  }

  if (s.includes("from camps c")) {
    return data.camps
      .filter((c) => c.status === "active")
      .sort((a, b) => a.camp_date.localeCompare(b.camp_date))
      .map((c) => {
        const org = data.users.find((u) => u.id === c.organizer_id);
        return { ...c, organizer_name: org?.name };
      });
  }
  if (s.includes("from camps where id =")) {
    return data.camps.filter((c) => c.id === parseInt(params[0], 10));
  }
  if (s.includes("from camps where organizer_id =")) {
    return data.camps.filter((c) => c.organizer_id === params[0] || c.organizer_id != null).slice(0, 1);
  }

  if (s.includes("from sos_requests where id =")) {
    return data.sos_requests.filter((r) => r.id === parseInt(params[0], 10));
  }

  if (s.includes("from blood_requests where patient_id =")) {
    return data.blood_requests
      .filter((r) => r.patient_id === params[0])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 1);
  }
  if (s.includes("from blood_requests where status = 'live'")) {
    return [{ c: data.blood_requests.filter((r) => r.status === "live").length }];
  }

  if (s.includes("from verification_logs where user_id =")) {
    return data.verification_logs
      .filter((l) => l.user_id === params[0])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10);
  }

  return [];
}

function queryRun(sql, params) {
  const s = sql.replace(/\s+/g, " ").trim().toLowerCase();

  if (s.startsWith("insert into users")) {
    const user = {
      id: nextId("users"),
      name: params[0],
      email: params[1],
      password_hash: params[2],
      phone: params[3],
      role: params[4],
      blood_group: params[5],
      lat: 28.6139,
      lng: 77.209,
      city: params[9] || "New Delhi",
      verified: params[8] ?? 0,
      verification_score: params[7] ?? 0,
      verification_status: params[6] ?? "pending",
      id_document_type: null,
      id_document_number: null,
      age: params[10] ?? null,
      weight: params[11] ?? null,
      hemoglobin: params[12] ?? null,
      last_donation_date: params[13] ?? null,
      reward_points: params[14] ?? 0,
      badges: params[15] ?? 0,
      donations_count: params[16] ?? 0,
      created_at: new Date().toISOString()
    };
    if (params.length <= 10) {
      Object.assign(user, {
        name: params[0], email: params[1], password_hash: params[2], phone: params[3],
        role: params[4], blood_group: params[5], age: params[6], weight: params[7],
        hemoglobin: params[8], city: params[9] || "New Delhi",
        verified: 0, verification_score: 0, verification_status: "pending",
        reward_points: 0, badges: 0, donations_count: 0
      });
    }
    data.users.push(user);
    save();
    return { lastInsertRowid: user.id };
  }

  if (s.startsWith("insert into hospitals")) {
    const h = { id: nextId("hospitals"), user_id: params[0], name: params[1], address: params[2], lat: params[3], lng: params[4], phone: params[5] };
    if (params.length === 5) {
      Object.assign(h, { user_id: null, name: params[0], address: params[1], lat: params[2], lng: params[3], phone: params[4] });
    }
    data.hospitals.push(h);
    save();
    return { lastInsertRowid: h.id };
  }

  if (s.startsWith("insert into blood_stock")) {
    const row = { id: nextId("blood_stock"), hospital_id: params[0], blood_group: params[1], units: params[2] };
    data.blood_stock.push(row);
    save();
    return { lastInsertRowid: row.id };
  }

  if (s.startsWith("insert into camps")) {
    const camp = {
      id: nextId("camps"),
      organizer_id: params[0],
      name: params[1],
      location: params[2],
      lat: params[3],
      lng: params[4],
      camp_date: params[5],
      camp_time: params[6],
      seats_total: params[7],
      seats_registered: 0,
      sms_enabled: 1,
      status: "active"
    };
    data.camps.push(camp);
    save();
    return { lastInsertRowid: camp.id };
  }

  if (s.startsWith("insert into sos_requests")) {
    const row = {
      id: nextId("sos_requests"),
      user_id: params[0],
      blood_group: params[1],
      urgency: params[2],
      lat: params[3],
      lng: params[4],
      hospital_name: params[5],
      contact_phone: params[6],
      donors_notified: params[7],
      status: params[8] || "active",
      created_at: new Date().toISOString()
    };
    data.sos_requests.push(row);
    save();
    return { lastInsertRowid: row.id };
  }

  if (s.startsWith("insert into blood_requests")) {
    const row = {
      id: nextId("blood_requests"),
      patient_id: params[0],
      blood_group: params[1],
      urgency: params[2],
      hospital_id: params[3],
      donors_notified: params[4],
      status: "live",
      created_at: new Date().toISOString()
    };
    data.blood_requests.push(row);
    save();
    return { lastInsertRowid: row.id };
  }

  if (s.startsWith("insert into contact_messages")) {
    const row = { id: nextId("contact_messages"), name: params[0], contact: params[1], message: params[2], created_at: new Date().toISOString() };
    data.contact_messages.push(row);
    save();
    return { lastInsertRowid: row.id };
  }

  if (s.startsWith("insert into verification_logs")) {
    const row = { id: nextId("verification_logs"), user_id: params[0], score: params[1], status: params[2], checks_json: params[3], created_at: new Date().toISOString() };
    data.verification_logs.push(row);
    save();
    return { lastInsertRowid: row.id };
  }

  if (s.startsWith("update users set")) {
    const user = data.users.find((u) => u.id === params[params.length - 1]);
    if (user) {
      if (params.length >= 12) {
        Object.assign(user, {
          verified: params[0], verification_score: params[1], verification_status: params[2],
          id_document_type: params[3], id_document_number: params[4],
          age: params[5] ?? user.age, weight: params[6] ?? user.weight,
          hemoglobin: params[7] ?? user.hemoglobin, last_donation_date: params[8] ?? user.last_donation_date,
          blood_group: params[9] ?? user.blood_group
        });
      }
      save();
    }
    return { changes: 1 };
  }

  if (s.includes("update camps set seats_registered")) {
    const camp = data.camps.find((c) => c.id === params[0]);
    if (camp) { camp.seats_registered++; save(); }
    return { changes: 1 };
  }

  if (s.includes("update blood_stock set units")) {
    const row = data.blood_stock.find((s) => s.hospital_id === params[1] && s.blood_group === params[2]);
    if (row) row.units = params[0];
    save();
    return { changes: 1 };
  }

  return { changes: 0 };
}

function seedDb() {
  const hash = bcrypt.hashSync("password123", 10);

  const donors = [
    ["Aarav Sharma", "aarav@bloodconnect.in", hash, "+91 98765 43210", "donor", "O+", "pending", 98, 1, "New Delhi", 28, 72, 14.2, "2025-03-15", 2450, 5, 12],
    ["Meera Iyer", "meera@bloodconnect.in", hash, "+91 98765 43211", "donor", "A+", "approved", 94, 1, "New Delhi", 32, 58, 13.8, "2025-04-20", 1980, 4, 9],
    ["Rohan Das", "rohan@bloodconnect.in", hash, "+91 98765 43212", "donor", "B+", "approved", 91, 1, "New Delhi", 25, 68, 14.0, "2025-02-10", 1650, 3, 7],
    ["Fatima Khan", "fatima@bloodconnect.in", hash, "+91 98765 43213", "donor", "AB-", "approved", 89, 1, "New Delhi", 30, 55, 13.5, "2025-01-05", 2100, 4, 8],
    ["Priya Nair", "priya@bloodconnect.in", hash, "+91 98765 43214", "donor", "B+", "approved", 96, 1, "New Delhi", 27, 60, 14.1, "2025-03-28", 2450, 5, 12]
  ];

  donors.forEach((d, i) => {
    const id = nextId("users");
    data.users.push({
      id, name: d[0], email: d[1], password_hash: d[2], phone: d[3], role: d[4], blood_group: d[5],
      verification_status: d[6], verification_score: d[7], verified: d[8], city: d[9],
      lat: 28.6139 + (i * 0.01), lng: 77.209 + (i * 0.008),
      age: d[10], weight: d[11], hemoglobin: d[12], last_donation_date: d[13],
      reward_points: d[14], badges: d[15], donations_count: d[16],
      id_document_type: "aadhaar", id_document_number: null, created_at: new Date().toISOString()
    });
  });

  [6, 7, 8].forEach((roleIdx, i) => {
    const roles = ["patient", "hospital", "camp"];
    const names = ["Emergency Patient", "Metro Care Admin", "Camp Organizer"];
    const emails = ["patient@bloodconnect.in", "hospital@bloodconnect.in", "camp@bloodconnect.in"];
    const id = nextId("users");
    data.users.push({
      id, name: names[i], email: emails[i], password_hash: hash, phone: `+91 90000 ${11111 + i}`,
      role: roles[i], blood_group: roles[i] === "patient" ? "O-" : null,
      verified: 1, verification_score: 100, verification_status: "approved",
      lat: 28.615 + i * 0.005, lng: 77.212, city: "New Delhi",
      reward_points: 0, badges: 0, donations_count: 0, created_at: new Date().toISOString()
    });
  });

  const hospitalId = nextId("hospitals");
  data.hospitals.push({ id: hospitalId, user_id: 7, name: "Metro Care Blood Bank", address: "Connaught Place, New Delhi", lat: 28.62, lng: 77.215, phone: "+91 11 2345 6789" });

  [["O+", 46], ["A+", 38], ["B+", 31], ["AB+", 12], ["O-", 8], ["A-", 6], ["B-", 5], ["AB-", 3]].forEach(([g, u]) => {
    data.blood_stock.push({ id: nextId("blood_stock"), hospital_id: hospitalId, blood_group: g, units: u });
  });

  data.hospitals.push({ id: nextId("hospitals"), user_id: null, name: "City General Hospital", address: "Karol Bagh, New Delhi", lat: 28.6512, lng: 77.191, phone: "+91 11 4567 8901" });

  [
    [8, "Govt. School Camp", "Sarojini Nagar, New Delhi", 28.575, 77.198, "2026-06-11", "10:00 AM", 120, 78],
    [8, "Anganwadi Health Drive", "Okhla Phase 2, New Delhi", 28.549, 77.268, "2026-06-12", "09:00 AM", 50, 32],
    [8, "City Hospital Mega Drive", "Metro Care Blood Bank", 28.62, 77.215, "2026-06-14", "08:00 AM", 200, 142]
  ].forEach(([oid, name, loc, lat, lng, date, time, total, reg]) => {
    data.camps.push({
      id: nextId("camps"), organizer_id: oid, name, location: loc, lat, lng,
      camp_date: date, camp_time: time, seats_total: total, seats_registered: reg,
      sms_enabled: 1, status: "active"
    });
  });

  save();
}

if (data.users.length === 0) seedDb();

module.exports = db;
