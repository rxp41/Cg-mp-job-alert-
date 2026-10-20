require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("ERROR: Set SESSION_SECRET to a random string of at least 32 characters in .env");
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD === "replace-this-with-a-strong-unique-password") {
  console.error("ERROR: Set ADMIN_USERNAME and a strong ADMIN_PASSWORD in .env");
  process.exit(1);
}
if (process.env.ADMIN_PASSWORD.length < 12) {
  console.error("ERROR: ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const dbFile = path.resolve(process.env.DATABASE_FILE || "./data/jobs.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    organization TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Government','Private')),
    state TEXT NOT NULL CHECK(state IN ('Chhattisgarh','Madhya Pradesh','Other')),
    location TEXT NOT NULL,
    qualification TEXT NOT NULL,
    last_date TEXT,
    official_url TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const adminCount = db.prepare("SELECT COUNT(*) AS n FROM admins").get().n;
if (adminCount === 0) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(process.env.ADMIN_USERNAME, hash);
  console.log("Initial admin account created from environment variables.");
} else {
  console.log("Existing admin account retained. Change credentials through a secure server-side maintenance process.");
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

if (isProduction) app.set("trust proxy", 1);
app.use(session({
  name: "cgmp.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 4
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "बहुत अधिक login प्रयास हुए। 15 मिनट बाद दोबारा प्रयास करें।" }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: "पहले admin login करें।" });
}
function cleanString(value, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch { return false; }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "CG MP Job Alert API" }));

app.post("/api/admin/login", loginLimiter, (req, res, next) => {
  const username = cleanString(req.body.username, 100);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const admin = db.prepare("SELECT id, username, password_hash FROM admins WHERE username = ?").get(username);

  // Use a dummy hash comparison when username doesn't exist to reduce timing differences.
  const dummyHash = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.6xM6pD5l9YwX5lVxK6M1oL8QX2f2d1u";
  const matches = bcrypt.compareSync(password, admin ? admin.password_hash : dummyHash);
  if (!admin || !matches) return res.status(401).json({ error: "Username या password गलत है।" });

  req.session.regenerate(err => {
    if (err) return next(err);
    req.session.adminId = admin.id;
    req.session.username = admin.username;
    req.session.save(err2 => {
      if (err2) return next(err2);
      res.json({ ok: true, username: admin.username });
    });
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie("cgmp.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    res.json({ ok: true });
  });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, username: req.session.username });
});

app.get("/api/jobs", (req, res) => {
  const q = cleanString(req.query.q, 120);
  const state = cleanString(req.query.state, 40);
  const category = cleanString(req.query.category, 20);
  let sql = "SELECT id, title, organization, category, state, location, qualification, last_date, official_url, description, created_at FROM jobs WHERE 1=1";
  const args = [];
  if (q) {
    sql += " AND (title LIKE ? OR organization LIKE ? OR qualification LIKE ?)";
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (["Chhattisgarh", "Madhya Pradesh", "Other"].includes(state)) { sql += " AND state = ?"; args.push(state); }
  if (["Government", "Private"].includes(category)) { sql += " AND category = ?"; args.push(category); }
  sql += " ORDER BY id DESC LIMIT 200";
  res.json(db.prepare(sql).all(...args));
});

app.post("/api/admin/jobs", requireAdmin, (req, res) => {
  const body = req.body || {};
  const job = {
    title: cleanString(body.title, 180),
    organization: cleanString(body.organization, 180),
    category: cleanString(body.category, 20),
    state: cleanString(body.state, 40),
    location: cleanString(body.location, 180),
    qualification: cleanString(body.qualification, 300),
    last_date: cleanString(body.last_date, 20),
    official_url: cleanString(body.official_url, 1000),
    description: cleanString(body.description, 5000)
  };

  const required = ["title", "organization", "category", "state", "location", "qualification", "official_url", "description"];
  if (required.some(k => !job[k])) return res.status(400).json({ error: "सभी आवश्यक fields भरें।" });
  if (!["Government", "Private"].includes(job.category)) return res.status(400).json({ error: "Category गलत है।" });
  if (!["Chhattisgarh", "Madhya Pradesh", "Other"].includes(job.state)) return res.status(400).json({ error: "State गलत है।" });
  if (!validHttpUrl(job.official_url)) return res.status(400).json({ error: "Official URL http:// या https:// से शुरू होना चाहिए।" });
  if (job.last_date && !/^\d{4}-\d{2}-\d{2}$/.test(job.last_date)) return res.status(400).json({ error: "Last date YYYY-MM-DD format में दें।" });

  const result = db.prepare(`
    INSERT INTO jobs (title, organization, category, state, location, qualification, last_date, official_url, description)
    VALUES (@title, @organization, @category, @state, @location, @qualification, @last_date, @official_url, @description)
  `).run(job);
  res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
});

app.delete("/api/admin/jobs/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid job ID." });
  const result = db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Job नहीं मिली।" });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server में समस्या हुई।" });
});

app.listen(PORT, () => {
  console.log(`CG MP Job Alert running at http://localhost:${PORT}`);
  console.log("Admin page: http://localhost:" + PORT + "/admin.html");
});
