// Simple Character Sheet server (CommonJS) -------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// -------------------- tiny utils & state --------------------------
function nanoid(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

let state = { characters: [] };

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!state || typeof state !== 'object') state = { characters: [] };
      if (!Array.isArray(state.characters)) state.characters = [];
    }
  } catch (e) {
    console.error('Failed to load data.json:', e);
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data.json:', e);
  }
}

load();

// -------------------- express setup --------------------------------
const app = express();
app.use(express.json());

// Loosen caching for dev
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Make sure `public` exists so the server can start cleanly
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);

// Serve static files from /public
app.use((req,res,next)=>{ console.log('[REQ]', req.method, req.url); next(); });
app.use(express.static(PUBLIC_DIR));

// -------------------- Characters API -------------------------------
// Model (flexible):
// Character {
//   id, name, ancestry, class, level, stats, hp, stress, hope, experience, weapons, armor,
//   notes, companions:[{ id, name, role, notes }]
// }

app.get('/api/characters', (_req, res) => {
  res.json(state.characters);
});

app.post('/api/characters', (req, res) => {
  const body = req.body || {};
  const c = {
    id: nanoid(),
    name: String(body.name || 'Unnamed'),
    ancestry: String(body.ancestry || ''),
    class: String(body.class || ''),
    level: Number(body.level || 1),
    stats: body.stats || {},
    hp: Number(body.hp || 0),
    stress: Number(body.stress || 0),
    hope: Number(body.hope || 0),
    experience: body.experience || [],
    weapons: body.weapons || [],
    armor: body.armor || {},
    notes: String(body.notes || ''),
    companions: Array.isArray(body.companions) ? body.companions.map(x => ({ id: nanoid(), ...x })) : []
  };
  state.characters.push(c);
  save();
  res.json(c);
});

app.get('/api/characters/:id', (req, res) => {
  const c = state.characters.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  res.json(c);
});

app.put('/api/characters/:id', (req, res) => {
  const i = state.characters.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.sendStatus(404);
  const prev = state.characters[i];
  const next = { ...prev, ...req.body, id: prev.id };
  // Normalize companions if provided
  if (Array.isArray(req.body?.companions)) {
    next.companions = req.body.companions.map(x => ({ id: x.id || nanoid(), ...x }));
  }
  state.characters[i] = next;
  save();
  res.json(next);
});

app.delete('/api/characters/:id', (req, res) => {
  const i = state.characters.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.sendStatus(404);
  const [removed] = state.characters.splice(i, 1);
  save();
  res.json({ ok: true, removed: removed.id });
});

// -------------------- Companions subresources ----------------------
app.get('/api/characters/:id/companions', (req, res) => {
  const c = state.characters.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  res.json(c.companions || []);
});

app.post('/api/characters/:id/companions', (req, res) => {
  const c = state.characters.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  if (!Array.isArray(c.companions)) c.companions = [];
  const body = req.body || {};
  const comp = { id: nanoid(), name: String(body.name || 'Companion'), role: String(body.role || ''), notes: String(body.notes || '') };
  c.companions.push(comp);
  save();
  res.json(comp);
});

app.put('/api/characters/:id/companions/:cid', (req, res) => {
  const c = state.characters.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  const i = (c.companions || []).findIndex(x => x.id === req.params.cid);
  if (i === -1) return res.sendStatus(404);
  c.companions[i] = { ...c.companions[i], ...req.body, id: c.companions[i].id };
  save();
  res.json(c.companions[i]);
});

app.delete('/api/characters/:id/companions/:cid', (req, res) => {
  const c = state.characters.find(x => x.id === req.params.id);
  if (!c) return res.sendStatus(404);
  const i = (c.companions || []).findIndex(x => x.id === req.params.cid);
  if (i === -1) return res.sendStatus(404);
  const [removed] = c.companions.splice(i, 1);
  save();
  res.json({ ok: true, removed: removed.id });
});

// -------------------- Health check ---------------------------------
app.get('/health', (_req, res) => res.json({ ok: true }));

// -------------------- start ----------------------------------------
app.listen(PORT, () =>
  console.log(`[OK] Character Sheet server running at http://localhost:${PORT}`)
);
