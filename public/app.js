// ---------- storage ----------
const KEY = 'dh_chars_v1';
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
};
const save = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));

// ---------- tiny utils ----------
const $  = (s, el=document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ---------- HP bar ----------
function hpBar(hp, max){
  const maxVal = Math.max(0, Number(max)||0);
  const curVal = Math.max(0, Math.min(maxVal, Number(hp)||0));
  const pct = maxVal>0 ? Math.round((100*curVal)/maxVal) : 0;

  let cls = 'ok';
  if (pct <= 1)       cls = 'red';
  else if (pct <= 10) cls = 'orange';
  else if (pct <= 50) cls = 'yellow';

  return `<div class="hpbar" aria-label="HP ${curVal}/${maxVal}">
            <span class="${cls}" style="width:${pct}%"></span>
          </div>`;
}

// ---------- damage logic (local, no armor in this app) ----------
function damageStep(roll, th, massiveRule=true){
  const major  = Number(th?.major)||0;
  const severe = Number(th?.severe)||0;
  const massive = 2*severe;

  if (massiveRule && roll >= massive) return {step:'massive', hp:4};
  if (roll >= severe)                 return {step:'severe',  hp:3};
  if (roll >= major)                  return {step:'major',   hp:2};
  if (roll > 0)                       return {step:'minor',   hp:1};
  return {step:'none', hp:0};
}

// ---------- dropdown data & helpers ----------
const OPTIONS = {
  heritages: ['Aetherisk', 'Clank', 'Drakona', 'Dwarf', 'Earthkin', 'Elf', 'Emberkin', 'Faerie', 'Faun', 'Firbolg', 'Fungril', 'Galapa', 'Gnome', 'Goblin', 'Halfling', 'Human', 'Infernis', 'Katari', 'Orc', 'Ribbet', 'Simiah', 'Skykin', 'Tidekin'],
  classes: {
    Assassin:   ['Executioners Guild','Prisoners Guild'],
    Bard: ['Troubador','Wordsmith'],
    Brawler: ['Juggernaut','Martial Artist'],
    Druid:  ['Warden of Renewal','Warden of the Elements'],
    Guardian: ['Stalwart','Vengeance'],
    Ranger: ['Beastbound', 'Wayfinder'],
    Rogue: ['Nightwalker', 'Syndicate'],
    Seraph: ['Divine Wielder', 'Winged Sentinel'],
    Sorcerer: ['Elemental Origin', 'Primal Origin'],
    Warlock: ['Pact of the Endless', 'Pact of the Wrathful'],
    Warrior: ['Call of the Brave', 'Call of the Slayer'],
    Witch: ['Hedge', 'Moon'],
    Wizard: ['School of Knowledge', 'School of War']
  }
};

function fillSelect(sel, items, placeholder='Select…') {
  const opts = [
    `<option value="" disabled selected>${placeholder}</option>`,
    ...items.map(v => `<option value="${esc(v)}">${esc(v)}</option>`),
    `<option value="__custom">Custom…</option>`
  ];
  sel.innerHTML = opts.join('');
}

function handleCustomSelect(sel, addToArray) {
  if (sel.value === '__custom') {
    const val = prompt('Enter custom value:','')?.trim();
    if (val) {
      // Add into the select immediately
      const opt = new Option(val, val, true, true);
      sel.add(opt);
      sel.value = val;
      // Optionally remember it in memory for this session
      if (addToArray && !addToArray.includes(val)) addToArray.push(val);
    } else {
      sel.value = '';
    }
  }
}

function setupDropdowns(){
  const heritageEl = document.getElementById('heritage');
  const klassEl    = document.getElementById('klass');
  const subEl      = document.getElementById('subclass');

  // bail out gracefully if the elements aren't present
  if (!heritageEl || !klassEl || !subEl) {
    console.warn('Dropdown elements not found. Check IDs in index.html.');
    return;
  }

  fillSelect(heritageEl, OPTIONS.heritages, 'Heritage');
  fillSelect(klassEl, Object.keys(OPTIONS.classes), 'Class');
  fillSelect(subEl, [], 'Subclass');

  klassEl.addEventListener('change', () => {
    if (klassEl.value === '__custom') {
      handleCustomSelect(klassEl, (OPTIONS.classes._custom ||= []));
      fillSelect(subEl, [], 'Subclass');
      return;
    }
    const list = OPTIONS.classes[klassEl.value] || [];
    fillSelect(subEl, list, 'Subclass');
  });

  heritageEl.addEventListener('change', () =>
    handleCustomSelect(heritageEl, OPTIONS.heritages)
  );

  subEl.addEventListener('change', () => {
    const cls = klassEl.value;
    const bucket =
      (cls && OPTIONS.classes[cls]) ? OPTIONS.classes[cls]
      : (OPTIONS.classes._custom ||= []);
    handleCustomSelect(subEl, bucket);
  });
}

// Run whether the script loads before or after DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupDropdowns);
} else {
  setupDropdowns();
}


// ---------- render ----------
function charCard(c){
  const t = c.thresholds || { major:'-', severe:'-' };
  const sev = Number(t.severe);
  const massive = Number.isFinite(sev) ? 2*sev : '-';
  const maxHp = Number.isFinite(Number(c.maxHp)) ? Number(c.maxHp) : Number(c.hp)||0;

  return `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${esc(c.name)}</div>
          <div class="sub">
            ${esc(c.pronouns||'')}${c.pronouns?' • ':''}
            ${esc(c.heritage||'')}${c.heritage?' • ':''}
            ${esc(c.klass||'')}${c.subclass?' / '+esc(c.subclass):''} • L${c.level||1}
          </div>
        </div>
        <div class="row">
          <button class="btn-sm" onclick="editChar('${c.id}')">Edit</button>
          <button class="btn-sm" onclick="removeChar('${c.id}')">Delete</button>
        </div>
      </div>

      <div class="row" style="margin-top:8px">
        <div>HP: <b>${c.hp}</b>/<span>${maxHp}</span></div>
      </div>
      ${hpBar(c.hp, maxHp)}

      <div class="sub" style="margin-top:6px">
        Thresholds — Major: ${t.major} • Severe: ${t.severe} • Massive: ${massive}
      </div>

      <!-- Simple damage roller (no armor in this app) -->
      <div class="row" style="margin-top:10px">
        <input id="roll-${c.id}" type="number" placeholder="Damage roll" min="0" step="1" style="width:140px">
        <label class="row" style="align-items:center;gap:6px">
          <input id="mass-${c.id}" type="checkbox" checked>
          <span class="small">Massive rule</span>
        </label>
        <button class="btn-sm" onclick="applyCharDamage('${c.id}')">Apply</button>
        <input id="heal-${c.id}" type="number" class="btn-sm" style="width:100px" placeholder="Heal" min="1">
        <button class="btn-sm" onclick="healChar('${c.id}')">❤️ Heal</button>
      </div>

      <div style="margin-top:12px">
        <div class="sub">Companions</div>
        <div id="comp-${c.id}" class="row" style="margin-top:6px">
          ${(c.companions||[]).map(x =>
            `<span class="chip">${esc(x.name)} (HP ${x.hp})
              <button class="ghost" style="margin-left:6px" onclick="removeComp('${c.id}','${x.id}')">✕</button>
            </span>`).join('') || `<span class="sub">None</span>`}
        </div>
        <div class="row" style="margin-top:6px">
          <input id="compName-${c.id}" placeholder="Companion name" style="width:180px">
          <input id="compHp-${c.id}" type="number" min="1" value="1" style="width:100px" placeholder="HP">
          <button class="btn-sm" onclick="addComp('${c.id}')">Add Companion</button>
        </div>
      </div>
    </div>
  `;
}

function render(){
  const data = load();
  $('#chars').innerHTML = data.map(charCard).join('') || `<div class="sub">No characters yet.</div>`;
}

// ---------- actions ----------
function uid(){ return Math.random().toString(36).slice(2,10); }

$('#charForm').onsubmit = (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const d = Object.fromEntries(fd.entries());

  const char = {
    id: uid(),
    name: d.name.trim(),
    pronouns: d.pronouns || '',
    heritage: d.heritage || '',
    klass: d.klass || '',
    subclass: d.subclass || '',
    level: Number(d.level || 1),

    hp: Number(d.hp || 0),
    maxHp: Number(d.hp || 0),

    thresholds: {
      major: Number(d.tMajor || 0),
      severe: Number(d.tSevere || 0),
    },

    attrs: {
      agility:  Number(d.agility || 0),
      strength: Number(d.strength || 0),
      finesse:  Number(d.finesse || 0),
      instinct: Number(d.instinct || 0),
      presence: Number(d.presence || 0),
      knowledge:Number(d.knowledge || 0),
    },

    companions:[]
  };

  const arr = load();
  arr.push(char);
  save(arr);
  e.target.reset();
  render();
};

window.removeChar = (id)=>{
  const arr = load().filter(c=>c.id!==id);
  save(arr); render();
};

window.editChar = (id)=>{
  const arr = load();
  const c = arr.find(x=>x.id===id); if(!c) return;
  const nm = prompt('Name', c.name); if(nm==null) return;
  c.name = nm.trim() || c.name;
  save(arr); render();
  const initial = [
    c.name,
    c.pronouns||'',
    c.heritage||'',
    c.klass||'',
    c.subclass||'',
    c.level||1,
    c.hp||0,
    c.maxHp||c.hp||0,
    (c.thresholds?.major ?? 0),
    (c.thresholds?.severe ?? 0)
  ].join(' | ');

  const input = prompt(
    'Edit fields (Name | Pronouns | Heritage | Class | Subclass | Level | HP | MaxHP | Major | Severe):',
    initial
  );
  if (input==null) return;

  const parts = input.split('|').map(s=>s.trim());
  if (parts.length < 10) return alert('Please provide all 10 fields, separated by |');

  const [name, pronouns, heritage, klass, subclass, level, hp, maxHp, maj, sev] = parts;
  c.name = name || c.name;
  c.pronouns = pronouns;
  c.heritage = heritage;
  c.klass = klass;
  c.subclass = subclass;
  c.level = Number(level)||c.level;

  c.hp = Math.max(0, Number(hp)||0);
  c.maxHp = Math.max(c.hp, Number(maxHp)||c.hp);

  c.thresholds = {
    major: Number(maj)||0,
    severe: Number(sev)||0
  };

  save(arr);
  render();
};

window.applyCharDamage = (id)=>{
  const arr = load();
  const c = arr.find(x=>x.id===id); if(!c) return;

  const rollEl = document.getElementById(`roll-${id}`);
  const massEl = document.getElementById(`mass-${id}`);
  const roll = Number(rollEl?.value || 0);
  const massiveRule = !!massEl?.checked;

  const res = damageStep(roll, c.thresholds, massiveRule);
  c.hp = Math.max(0, c.hp - res.hp);
  save(arr);
  render();
};

window.healChar = (id)=>{
  const arr = load();
  const c = arr.find(x=>x.id===id); if(!c) return;
  const el = document.getElementById(`heal-${id}`);
  const amt = Math.max(0, Number(el?.value || 0));
  c.hp = Math.min(c.maxHp, c.hp + amt);
  save(arr);
  if (el) el.value = '';
  render();
};

window.addComp = (charId)=>{
  const arr = load();
  const c = arr.find(x=>x.id===charId); if(!c) return;

  const nameEl = document.getElementById(`compName-${charId}`);
  const hpEl   = document.getElementById(`compHp-${charId}`);
  const name = nameEl?.value.trim();
  const hp = Math.max(1, Number(hpEl?.value || 1));
  if (!name) return;

  c.companions.push({ id: uid(), name, hp });
  save(arr);
  if (nameEl) nameEl.value = '';
  if (hpEl) hpEl.value = '1';
  render();
};

window.removeComp = (charId, compId)=>{
  const arr = load();
  const c = arr.find(x=>x.id===charId); if(!c) return;
  c.companions = c.companions.filter(x=>x.id!==compId);
  save(arr); render();
};

// ---------- export / import ----------
$('#exportJson').onclick = ()=>{
  const data = load();
  const blob = new Blob([JSON.stringify({version:1, characters:data}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `characters-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
};

$('#importJson').onclick = ()=> $('#importFile').click();
$('#importFile').onchange = async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  try{
    const txt = await f.text();
    const parsed = JSON.parse(txt);
    if (Array.isArray(parsed.characters)) save(parsed.characters);
    else if (Array.isArray(parsed)) save(parsed); // tolerate raw array
    render();
  }catch(err){ alert('Import failed: '+err.message); }
  finally{ e.target.value=''; }
};

// ---------- initial paint ----------
render();
