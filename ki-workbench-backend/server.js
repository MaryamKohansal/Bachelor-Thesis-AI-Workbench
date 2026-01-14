// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const DB_PATH = path.join(__dirname, "db.json");
const PORT = 4000;

// Simple helper: read DB (tools & artefacts)
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial = { tools: [], artefacts: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.error("readDb error:", err);
    return { tools: [], artefacts: [] };
  }
}

// Simple helper: write DB
function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors()); // allow frontend localhost
app.use(bodyParser.json({ limit: "10mb" })); // accept base64 image payloads

// Simple id generation for server-side created items if needed
const uid = () => `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/* -------------------------
   Tools endpoints
---------------------------*/
// GET /tools
app.get("/tools", (req, res) => {
  const db = readDb();
  res.json(db.tools || []);
});

// POST /tools
app.post("/tools", (req, res) => {
  const db = readDb();
  const tool = req.body;
  // ensure id
  if (!tool.id) tool.id = uid();
  db.tools = [tool, ...(db.tools || [])];
  writeDb(db);
  res.status(201).json(tool);
});

// PUT /tools/:id
app.put("/tools/:id", (req, res) => {
  const db = readDb();
  const id = req.params.id;
  const incoming = req.body;
  const idx = (db.tools || []).findIndex((t) => t.id === id);
  if (idx === -1) {
    // if not found, create
    db.tools = [incoming, ...(db.tools || [])];
    writeDb(db);
    return res.json(incoming);
  }
  db.tools[idx] = incoming;
  writeDb(db);
  res.json(incoming);
});

// DELETE /tools/:id
app.delete("/tools/:id", (req, res) => {
  const db = readDb();
  const id = req.params.id;
  db.tools = (db.tools || []).filter((t) => t.id !== id);
  // don't delete artefacts here - they stay unless user deletes artefacts.
  writeDb(db);
  res.json({ ok: true });
});

/* -------------------------
   Artefacts endpoints
---------------------------*/
// GET /artefacts
app.get("/artefacts", (req, res) => {
  const db = readDb();
  res.json(db.artefacts || []);
});

// POST /artefacts
app.post("/artefacts", (req, res) => {
  const db = readDb();
  const a = req.body;
  if (!a.id) a.id = uid();
  db.artefacts = [a, ...(db.artefacts || [])];
  writeDb(db);
  res.status(201).json(a);
});

// PUT /artefacts/:id
app.put("/artefacts/:id", (req, res) => {
  const db = readDb();
  const id = req.params.id;
  const incoming = req.body;
  const idx = (db.artefacts || []).findIndex((x) => x.id === id);
  if (idx === -1) {
    db.artefacts = [incoming, ...(db.artefacts || [])];
    writeDb(db);
    return res.json(incoming);
  }
  db.artefacts[idx] = incoming;
  writeDb(db);
  res.json(incoming);
});

// DELETE /artefacts/:id
app.delete("/artefacts/:id", (req, res) => {
  const db = readDb();
  const id = req.params.id;
  db.artefacts = (db.artefacts || []).filter((a) => a.id !== id);
  // unlink it from all tools
  db.tools = (db.tools || []).map((t) => ({
    ...t,
    inputIds: (t.inputIds || []).filter((x) => x !== id),
    outputIds: (t.outputIds || []).filter((x) => x !== id),
  }));
  writeDb(db);
  res.json({ ok: true });
});

/* -------------------------
   Health & static check
---------------------------*/
app.get("/", (req, res) => {
  res.send("KI Workbench Backend is running 🚀");
});

/* -------------------------
   Start server
---------------------------*/
app.listen(PORT, () => {
  console.log(`KI Workbench Backend is running 🚀 on http://localhost:${PORT}`);
});
