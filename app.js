import { CellScene } from './scene.js';

// ---------- Constante (fapte vs. ipoteze) ----------
const UR20_PAYLOAD = 20;   // kg, sarcina maximă UR20 (fapt producător)
const GRIPPER_KG = 3.5;    // kg, ipoteză
const SHIFT_H = 8;         // ore/schimb, ipoteză
const REF_5KG = 8.6;       // găleți/min, test PURATOS (fapt)
const REF_13KG = 7.4;      // găleți/min, test PURATOS (fapt)

const OFFICES = {
  'București-Ilfov': 'Dragomirești-Deal',
  'Sud-Muntenia': 'Dragomirești-Deal',
  'Sud-Est': 'Dragomirești-Deal',
  'Sud-Vest Oltenia': 'Dragomirești-Deal',
  'Centru': 'Dragomirești-Deal',
  'Nord-Est': 'Iași',
  'Vest': 'Timișoara',
  'Nord-Vest': 'Timișoara',
};
const FACTORY_LABEL = {
  panificatie: 'Ingrediente panificație și patiserie',
  umpluturi: 'Gemuri, umpluturi și creme',
  sosuri: 'Sosuri și maioneză (HoReCa)',
  lactate: 'Lactate',
  miere: 'Miere',
  'alt-aliment': 'Alt produs alimentar',
  nealimentar: 'Nealimentar (vopsele, chimice)',
};
const ROLE_LABEL = {
  'dir-productie': 'Director de producție',
  'dir-fabrica': 'Director de fabrică',
  investitii: 'Responsabil investiții / financiar',
  mentenanta: 'Șef mentenanță / inginer proces',
  hse: 'Responsabil SSM / HSE',
  altul: 'Altul',
};

const EXAMPLES = {
  normal: { factory: 'panificatie', region: 'Sud-Muntenia', kg: '13', diameter: '30', height: '32', handle: 'da', ppm: '6.5', lines: '2', operators: '2', shifts: '3' },
  errors: { factory: '', region: 'Nord-Est', kg: '-5', diameter: '', height: '250', handle: 'da', ppm: '0', lines: '2', operators: '0', shifts: '2' },
  unfit: { factory: 'sosuri', region: 'Nord-Est', kg: '20', diameter: '34', height: '38', handle: 'nu', ppm: '11', lines: '1', operators: '2', shifts: '2' },
};

// ---------- Utilitare ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (n, d = 0) => Number(n).toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return NaN;
  return parseFloat(String(v).replace(',', '.'));
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readForm(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}
function fillForm(form, values) {
  Object.entries(values).forEach(([k, v]) => {
    const els = $$(`[name="${k}"]`, form);
    els.forEach((el) => {
      if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v;
    });
  });
}

// ---------- Validare pas 1 ----------
function rangeRule(label, min, max, unit, integer = false) {
  return (v) => {
    const n = num(v);
    if (Number.isNaN(n)) return `Completează ${label}.`;
    if (n <= 0) return 'Valoarea trebuie să fie mai mare decât 0.';
    if (integer && !Number.isInteger(n)) return 'Introdu un număr întreg.';
    if (n < min || n > max) return `Valoare nerealistă: între ${fmt(min, min % 1 ? 1 : 0)} și ${fmt(max)} ${unit}.`;
    return '';
  };
}
const LINE_RULES = {
  factory: (v) => (v ? '' : 'Alege tipul fabricii.'),
  region: (v) => (v ? '' : 'Alege regiunea (pentru cel mai apropiat birou Tech-Con).'),
  kg: rangeRule('greutatea', 0.5, 30, 'kg'),
  diameter: rangeRule('diametrul', 10, 60, 'cm'),
  height: rangeRule('înălțimea', 10, 60, 'cm'),
  handle: (v) => (v ? '' : 'Alege dacă găleata are mâner.'),
  ppm: rangeRule('ritmul liniei', 0.5, 30, 'găleți/min'),
  lines: rangeRule('numărul de linii', 1, 20, 'linii', true),
  operators: rangeRule('numărul de operatori', 1, 10, 'operatori', true),
  shifts: (v) => (v ? '' : 'Alege numărul de schimburi.'),
};
const FIELD_NAME = {
  factory: 'Tipul fabricii', region: 'Regiunea', kg: 'Greutatea', diameter: 'Diametrul', height: 'Înălțimea',
  handle: 'Mânerul', ppm: 'Ritmul liniei', lines: 'Linii', operators: 'Operatori', shifts: 'Schimburi',
  company: 'Companie', role: 'Rol', email: 'E-mail', demoType: 'Tip demonstrație', date: 'Data', slot: 'Interval', consent: 'Confirmare',
};

function validate(form, rules, values) {
  const errors = {};
  Object.entries(rules).forEach(([k, rule]) => {
    const msg = rule(values[k], values);
    const field = $(`[data-f="${k}"]`, form) || $(`[data-f="${k}"]`);
    if (field) {
      field.classList.toggle('invalid', !!msg);
      const m = $('.err-msg', field);
      if (m) m.textContent = msg;
    }
    if (msg) errors[k] = msg;
  });
  return errors;
}
function showErrorBanner(banner, errors) {
  const keys = Object.keys(errors);
  if (!keys.length) { banner.hidden = true; return; }
  banner.innerHTML = `<b>⛔ ${keys.length === 1 ? 'Un câmp trebuie corectat' : `${keys.length} câmpuri trebuie corectate`} înainte de a continua:</b><ul>${keys.map((k) => `<li><b style="display:inline">${FIELD_NAME[k]}:</b> ${esc(errors[k])}</li>`).join('')}</ul>`;
  banner.hidden = false;
  banner.classList.remove('shake'); void banner.offsetWidth; banner.classList.add('shake');
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- Calcule ----------
function toData(v) {
  return {
    factory: v.factory, region: v.region,
    kg: num(v.kg), diameter: num(v.diameter), height: num(v.height),
    handle: v.handle === 'da', ppm: num(v.ppm), lines: num(v.lines), operators: num(v.operators), shifts: num(v.shifts),
  };
}
function manualLoad(d) {
  const liftsShift = d.ppm * 60 * SHIFT_H;          // per linie
  const kgShift = liftsShift * d.kg;                 // per linie
  return {
    liftsShift, kgShift,
    liftsPerOp: liftsShift / d.operators,
    kgPerOp: kgShift / d.operators,
    kgDay: kgShift * d.shifts * d.lines,
    opsExposed: d.operators * d.shifts * d.lines,
  };
}
function refRate(kg) {
  if (kg <= 5) return REF_5KG;
  if (kg >= 13) return REF_13KG;
  return REF_5KG - ((kg - 5) * (REF_5KG - REF_13KG)) / 8;
}
function evaluate(d) {
  const checks = [];
  const payload = d.kg + GRIPPER_KG;
  let ps = payload > UR20_PAYLOAD ? 'bad' : payload > 17 || d.kg > 13 ? 'warn' : 'ok';
  checks.push({
    id: 'payload', title: 'Sarcina robotului', status: ps,
    pill: ps === 'bad' ? 'Depășește' : ps === 'warn' ? 'Necesită validare' : 'În limită',
    text: ps === 'bad'
      ? `Găleata (${fmt(d.kg, 1)} kg) + gripper (~${fmt(GRIPPER_KG, 1)} kg) = ${fmt(payload, 1)} kg, peste limita de ${UR20_PAYLOAD} kg a UR20. Robotul nu poate prelua în siguranță această găleată.`
      : ps === 'warn'
        ? `${fmt(payload, 1)} kg din ${UR20_PAYLOAD} kg. Aproape de limită sau peste greutatea testată la PURATOS (13 kg); trebuie validat cu gripperul real.`
        : `${fmt(payload, 1)} kg din ${UR20_PAYLOAD} kg (găleată + gripper estimat). Similar cu PURATOS, unde s-au paletizat găleți de 5 și 13 kg.`,
    bar: { value: payload, max: 25, mark: UR20_PAYLOAD, left: '0 kg', right: `limita UR20: ${UR20_PAYLOAD} kg` },
  });

  const ref = refRate(d.kg);
  const rs = d.ppm > ref * 1.15 ? 'bad' : d.ppm > ref ? 'warn' : 'ok';
  checks.push({
    id: 'rate', title: 'Ritmul liniei', status: rs,
    pill: rs === 'bad' ? 'Prea rapid' : rs === 'warn' ? 'Peste test' : 'Acoperit',
    text: rs === 'bad'
      ? `Linia cere ${fmt(d.ppm, 1)} găleți/min, mult peste ~${fmt(ref, 1)} găleți/min măsurate la teste pentru această greutate. O singură celulă nu ține ritmul.`
      : rs === 'warn'
        ? `Linia cere ${fmt(d.ppm, 1)} găleți/min, puțin peste ~${fmt(ref, 1)} măsurate la teste. Se poate verifica printr-un test dedicat.`
        : `Linia cere ${fmt(d.ppm, 1)} găleți/min; la teste s-au obținut ~${fmt(ref, 1)} găleți/min pentru această greutate (rezultat de test, nu garanție).`,
    bar: { value: d.ppm, max: Math.max(ref * 1.6, d.ppm * 1.1), mark: ref, left: '0', right: `test: ${fmt(ref, 1)} găleți/min` },
  });

  checks.push({
    id: 'grip', title: 'Prinderea găleții', status: d.handle ? 'ok' : 'warn',
    pill: d.handle ? 'Ca la PURATOS' : 'Gripper nou',
    text: d.handle
      ? 'Găleată cu mâner: gripper dedicat și cameră 2D care verifică poziția mânerului înainte de preluare, ca în aplicația PURATOS.'
      : 'Fără mâner: gripperul PURATOS nu se aplică direct. Este nevoie de altă soluție de prindere, validată la test.',
  });

  const big = d.diameter > 45 || d.height > 50;
  const nonFood = d.factory === 'nealimentar';
  const ps2 = nonFood || big ? 'warn' : 'ok';
  checks.push({
    id: 'product', title: 'Produs și ambalaj', status: ps2,
    pill: ps2 === 'ok' ? 'Similar' : 'De validat',
    text: [
      nonFood ? 'Industrie nealimentară: cerințele tehnice (ambalaj, mediu, siguranță) se validează separat.' : 'Industrie alimentară, ca la PURATOS: atenție la cerințele de igienă.',
      big ? `Găleată mare (Ø${fmt(d.diameter)} × ${fmt(d.height)} cm): modelul de paletizare și stabilitatea trebuie verificate.` : `Ø${fmt(d.diameter)} × ${fmt(d.height)} cm: model de paletizare standard pe europalet.`,
    ].join(' '),
  });

  const status = checks.some((c) => c.status === 'bad') ? 'bad' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok';
  return { status, checks, ref, payload };
}
function computeScore(d, ev, role) {
  const reasons = [];
  let pts = 0;
  const c = ev.status === 'ok' ? 35 : ev.status === 'warn' ? 20 : 0;
  pts += c; reasons.push(`Compatibilitate ${ev.status === 'ok' ? 'bună' : ev.status === 'warn' ? 'de validat' : 'scăzută'} (+${c})`);
  const s = d.shifts >= 3 ? 20 : d.shifts === 2 ? 12 : 4;
  pts += s; reasons.push(`${d.shifts} ${d.shifts === 1 ? 'schimb' : 'schimburi'}/zi (+${s})`);
  const l = d.lines >= 3 ? 20 : d.lines === 2 ? 14 : 6;
  pts += l; reasons.push(`${d.lines} ${d.lines === 1 ? 'linie' : 'linii'}: posibil ${d.lines} ${d.lines === 1 ? 'celulă' : 'celule'} (+${l})`);
  const t = manualLoad(d).kgDay / 1000;
  const tp = t >= 20 ? 15 : t >= 8 ? 10 : 4;
  pts += tp; reasons.push(`${fmt(t, 1)} t ridicate manual/zi (+${tp})`);
  if (role) {
    const rp = ['dir-productie', 'dir-fabrica', 'investitii'].includes(role) ? 10 : 5;
    pts += rp; reasons.push(`Rol: ${ROLE_LABEL[role]} (+${rp})`);
  } else reasons.push('Rolul nu e ales încă (0)');
  const level = pts >= 70 ? { label: 'RIDICAT', color: 'var(--ok)', text: 'Prioritate mare: contact tehnic în 48 h.' }
    : pts >= 45 ? { label: 'MEDIU', color: '#D4A000', text: 'Merită o demonstrație și o discuție tehnică.' }
      : { label: 'SCĂZUT', color: 'var(--bad)', text: 'Interes informativ: urmărire prin conținut și newsletter.' };
  return { pts, reasons, ...level };
}

// ---------- Stare și navigare ----------
const state = { data: null, ev: null, scene: null, step: 1, submitted1: false, submitted4: false };

function goStep(n) {
  state.step = n;
  $('#step1').hidden = n !== 1;
  $('#stageWrap').hidden = !(n === 2 || n === 3);
  $('#step2').hidden = n !== 2;
  $('#step3').hidden = n !== 3;
  $('#step4').hidden = n !== 4;
  $$('#stepper li').forEach((li) => {
    const s = +li.dataset.step;
    li.classList.toggle('active', s === n);
    li.classList.toggle('done', s < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ensureScene() {
  if (state.scene || state.sceneFailed) return state.scene;
  try {
    state.scene = new CellScene($('#stage3d'), { onEvent: onSceneEvent });
  } catch (e) {
    state.sceneFailed = true;
    $('#stage3d').innerHTML = '<p style="padding:24px;text-align:center;color:#5B6675">Vizualizarea 3D nu este disponibilă pe acest dispozitiv. Rezultatele de mai jos rămân valabile.</p>';
    $('#stage3d').style.height = 'auto';
  }
  return state.scene;
}

let toastTimer;
function toast(msg) {
  const t = $('#stageToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function renderLive(mode, count = 0, kgManual = 0) {
  $('#stageLive').innerHTML = mode === 'human'
    ? `Ridicat manual în simulare: <b class="bad">${fmt(kgManual)} kg</b>`
    : `Găleți paletizate: <b class="good">${fmt(count)}</b> · ridicate manual: <b class="good">0 kg</b>`;
}
function onSceneEvent(e) {
  if (e.type === 'placed') renderLive(e.mode, e.count, e.kgManual);
  if (e.type === 'pallet-full') toast(e.mode === 'robot' ? 'Palet plin → robotul continuă pe poziția a doua' : 'Palet complet → schimbare manuală');
  if (e.type === 'pallet-changed') toast('Operatorul a schimbat paletul plin (manual)');
}
function setBadge(mode) {
  const b = $('#stageBadge');
  b.textContent = mode === 'robot' ? '🤖 Celula UR20' : '👷 Paletizare manuală';
  b.classList.toggle('robot', mode === 'robot');
  const sc = state.scene;
  if (sc) { sc.cycleSeconds(); $('#stageSpeed').textContent = `simulare ×${fmt(sc.speedup, 1)}`; }
}

// ---------- Pas 1 ----------
const lineForm = $('#lineForm');
$$('[data-example]').forEach((b) => b.addEventListener('click', () => {
  fillForm(lineForm, EXAMPLES[b.dataset.example]);
  if (state.submitted1 || b.dataset.example === 'errors') {
    const errs = validate(lineForm, LINE_RULES, readForm(lineForm));
    if (b.dataset.example === 'errors') { state.submitted1 = true; showErrorBanner($('#formErrors'), errs); }
    else showErrorBanner($('#formErrors'), errs);
  }
}));
lineForm.addEventListener('input', () => {
  if (!state.submitted1) return;
  const errs = validate(lineForm, LINE_RULES, readForm(lineForm));
  if (!Object.keys(errs).length) $('#formErrors').hidden = true;
});
lineForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.submitted1 = true;
  const values = readForm(lineForm);
  const errs = validate(lineForm, LINE_RULES, values);
  if (Object.keys(errs).length) { showErrorBanner($('#formErrors'), errs); return; }
  $('#formErrors').hidden = true;
  state.data = toData(values);
  state.ev = evaluate(state.data);
  renderStep2();
  goStep(2);
  const sc = ensureScene();
  if (sc) {
    sc.setMode('human', false);
    sc.setParams({ kg: state.data.kg, diameter: state.data.diameter, height: state.data.height, handle: state.data.handle, ppm: state.data.ppm });
    setBadge('human');
    renderLive('human');
    requestAnimationFrame(() => sc.resize());
  }
});

// ---------- Pas 2 ----------
function stat(cls, v, unit, label, extra = '') {
  return `<div class="stat ${cls}">${extra}<div class="v">${v} <small>${unit}</small></div><div class="l">${label}</div></div>`;
}
function renderStep2() {
  const d = state.data, m = manualLoad(d);
  $('#statsBefore').innerHTML = [
    stat('bad', fmt(m.kgShift / 1000, 1), 't', 'ridicate manual pe schimb, pe o linie'),
    stat('bad', fmt(m.kgPerOp / 1000, 1), 't', 'ridicate de fiecare operator într-un schimb'),
    stat('warn', fmt(m.liftsPerOp), 'ridicări', 'repetitive / operator / schimb'),
    stat('warn', fmt(m.opsExposed), 'operatori', 'expuși zilnic la ridicare repetitivă'),
    stat('bad wide', fmt(m.kgDay / 1000, 1), 't / zi', `ridicate manual în toată fabrica (${d.lines} ${d.lines === 1 ? 'linie' : 'linii'} × ${d.shifts} ${d.shifts === 1 ? 'schimb' : 'schimburi'})`),
  ].join('');
}

$('#toRobot').addEventListener('click', () => {
  const d = state.data, ev = state.ev;
  renderStep3();
  goStep(3);
  const sc = state.scene;
  if (ev.status === 'bad') {
    const fb = $('#failBanner');
    fb.classList.remove('shake'); void fb.offsetWidth; fb.classList.add('shake');
    if (sc) sc.shake();
    $('#stageBadge').textContent = '⛔ Rămâne manual';
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
  } else if (sc) {
    sc.setMode('robot');
    setBadge('robot');
    renderLive('robot');
  }
});

// ---------- Pas 3 ----------
function renderStep3() {
  const d = state.data, ev = state.ev, m = manualLoad(d);
  const bad = ev.checks.filter((c) => c.status === 'bad');
  const warn = ev.checks.filter((c) => c.status === 'warn');

  $('#failBanner').hidden = ev.status !== 'bad';
  $('#robotOk').hidden = ev.status === 'bad';
  if (ev.status === 'bad') {
    $('#failBanner').innerHTML = `<h3>❌ Celula UR20 de tip PURATOS nu se potrivește acestor date</h3>
      <ul>${bad.map((c) => `<li><b style="display:inline">${c.title}:</b> ${esc(c.text)}</li>`).join('')}</ul>
      <p style="margin:10px 0 0"><b style="display:inline">Ce poți face:</b> modifică datele (de exemplu găleți mai ușoare) sau cere o analiză tehnică. Tech-Con poate evalua alte variante, dar fără promisiuni înainte de test.</p>`;
    $('#toRequest').textContent = 'Cere totuși o analiză tehnică →';
  } else {
    const vb = $('#verdictBanner');
    vb.className = `banner ${ev.status}`;
    vb.innerHTML = ev.status === 'ok'
      ? '<b>✅ Compatibil orientativ cu o celulă UR20 ca la PURATOS</b>Următorul pas: evaluare tehnică și demonstrație.'
      : `<b>⚠ Posibil, dar necesită validare tehnică</b>De verificat: ${warn.map((c) => c.title.toLowerCase()).join(', ')}.`;
    $('#statsAfter').innerHTML = [
      stat('ok', '0', 't', 'ridicate manual la paletizare', `<div class="was">${fmt(m.kgShift / 1000, 1)} t / schimb</div>`),
      stat('ok', '0', 'ridicări', 'repetitive pentru operatori', `<div class="was">${fmt(m.liftsPerOp)} / schimb</div>`),
      stat('info', fmt(d.ppm, 1), 'găleți/min', `același ritm, în toate cele ${d.shifts} schimburi`),
      stat('info', fmt(d.lines), d.lines === 1 ? 'celulă' : 'celule', '1 celulă / linie (ipoteză); livrare ~4 luni'),
      stat('ok wide', '2', 'poziții de palet', 'robotul continuă pe a doua poziție cât timp operatorul schimbă paletul plin și pune separatoarele'),
    ].join('');
    $('#toRequest').textContent = 'Solicită evaluare tehnică →';
  }

  $('#checks').innerHTML = ev.checks.map((c) => `
    <div class="check-row">
      <div class="check-head"><h4>${c.title}</h4><span class="pill ${c.status}">${c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '✗'} ${c.pill}</span></div>
      <p>${esc(c.text)}</p>
      ${c.bar ? `<div class="bar"><i style="width:0;background:var(--${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'bad'})" data-w="${Math.min(100, (c.bar.value / c.bar.max) * 100)}"></i><em style="left:${(c.bar.mark / c.bar.max) * 100}%"></em></div>
      <div class="bar-legend"><span>${c.bar.left}</span><span>${c.bar.right}</span></div>` : ''}
    </div>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#checks .bar > i').forEach((i) => (i.style.width = i.dataset.w + '%'))));

  $('#bottleneckText').textContent = d.ppm <= ev.ref
    ? ` Celula urmează ritmul de ${fmt(d.ppm, 1)} găleți/min dat de umplere și transportor. Are rezervă până la ~${fmt(ev.ref, 1)} (valoare de test), dar producția crește doar dacă crește alimentarea. Verificați blocajul din amonte (umplere, transportor) și din aval (schimbarea paleților).`
    : ` Linia cere ${fmt(d.ppm, 1)} găleți/min, peste ~${fmt(ev.ref, 1)} măsurate la teste: aici celula ar putea deveni blocajul. Este nevoie de test sau de altă configurație.`;
}

$('#toRequest').addEventListener('click', () => {
  try { state.snapshot = state.scene ? state.scene.snapshot() : null; } catch { state.snapshot = null; }
  renderStep4();
  goStep(4);
});

// ---------- Pas 4 ----------
const reqForm = $('#reqForm');
const REQ_RULES = {
  company: (v) => (v && v.trim().length >= 2 ? '' : 'Completează numele companiei (fictiv).'),
  role: (v) => (v ? '' : 'Alege rolul.'),
  email: (v) => (!v ? 'Completează e-mailul (fictiv).' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Format de e-mail invalid (ex. nume@firma.ro).'),
  date: (v) => {
    if (!v) return 'Alege data demonstrației.';
    const d = new Date(v + 'T12:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d <= today) return 'Alege o dată din viitor.';
    if ([0, 6].includes(d.getDay())) return 'Alege o zi lucrătoare (luni–vineri).';
    return '';
  },
  slot: (v) => (v ? '' : 'Alege intervalul orar.'),
  consent: (v) => (v ? '' : 'Bifează confirmarea că datele sunt fictive.'),
};
function renderScore() {
  const role = $('[name="role"]', reqForm).value;
  const s = computeScore(state.data, state.ev, role);
  state.score = s;
  $('#scoreCard').innerHTML = `
    <div class="gauge" style="--p:${s.pts};--c:${s.color}"><span>${s.pts}</span></div>
    <div><h3>Scorul cererii: <span style="color:${s.color}">${s.label}</span></h3><p>${s.text}</p>
    <ul>${s.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
}
function renderStep4() {
  const office = OFFICES[state.data.region];
  $('#officeLabel').textContent = `Birou ${office}`;
  $('#confirmation').hidden = true;
  $('#requestFormWrap').hidden = false;
  $('#backTo3').hidden = false;
  renderScore();
}
reqForm.addEventListener('change', (e) => {
  if (e.target.name === 'role') renderScore();
});
reqForm.addEventListener('input', () => {
  if (!state.submitted4) return;
  const errs = validate(reqForm, REQ_RULES, readForm(reqForm));
  if (!Object.keys(errs).length) $('#reqErrors').hidden = true;
});
reqForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.submitted4 = true;
  const v = readForm(reqForm);
  const errs = validate(reqForm, REQ_RULES, v);
  if (Object.keys(errs).length) { showErrorBanner($('#reqErrors'), errs); return; }
  $('#reqErrors').hidden = true;
  renderConfirmation(v);
});

function buildSummary(v, id) {
  const d = state.data, ev = state.ev, m = manualLoad(d), s = state.score;
  const office = OFFICES[d.region];
  const demo = v.demoType === 'online' ? 'Online' : v.demoType === 'fabrica' ? 'Vizită în fabrică' : `La biroul Tech-Con ${office}`;
  const date = new Date(v.date + 'T12:00').toLocaleDateString('ro-RO');
  const st = ev.status === 'ok' ? 'compatibil orientativ' : ev.status === 'warn' ? 'posibil, necesită validare' : 'nepotrivit pentru celula standard';
  return [
    `CERERE EVALUARE TEHNICĂ ${id}: PaletCheck UR20`,
    `Companie: ${v.company.trim()} | Rol: ${ROLE_LABEL[v.role]} | E-mail: ${v.email.trim()}`,
    `Fabrică: ${FACTORY_LABEL[d.factory]} | Regiune: ${d.region} → birou Tech-Con ${office}`,
    `Găleată: ${fmt(d.kg, 1)} kg, Ø${fmt(d.diameter)} × ${fmt(d.height)} cm, ${d.handle ? 'cu' : 'fără'} mâner`,
    `Linie: ${fmt(d.ppm, 1)} găleți/min | ${d.shifts} schimburi | ${d.lines} linii | ${d.operators} operatori/schimb`,
    `Efort manual actual: ${fmt(m.kgDay / 1000, 1)} t/zi ridicate la paletizare`,
    `Compatibilitate: ${st} (sarcină ${fmt(ev.payload, 1)}/${UR20_PAYLOAD} kg; ritm ${fmt(d.ppm, 1)} vs ~${fmt(ev.ref, 1)} testat)`,
    `Scor cerere: ${s.pts}/100 (${s.label})`,
    `Demonstrație: ${demo}, ${date}, ${v.slot}`,
    `Notă: date fictive (concurs). Valorile PURATOS sunt rezultate de test, nu garanții.`,
  ].join('\n');
}
function renderConfirmation(v) {
  const id = 'TC-26-' + String(Math.floor(1000 + Math.random() * 9000));
  const summary = buildSummary(v, id);
  state.request = { v, id };
  const office = OFFICES[state.data.region];
  const demo = v.demoType === 'online' ? 'online' : v.demoType === 'fabrica' ? 'în fabrica ta' : `la biroul Tech-Con din ${office}`;
  const date = new Date(v.date + 'T12:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  const c = $('#confirmation');
  c.innerHTML = `
    <div class="card confirm">
      <div class="banner ok"><b>✅ Cerere înregistrată: ${id}</b>Demonstrație ${esc(demo)}, ${esc(date)}, ${esc(v.slot)}. (simulare: nu se trimite nimic)</div>
      <h3>Pașii următori</h3>
      <ol class="timeline">
        <li><b>${state.score.label === 'RIDICAT' ? 'În 48 de ore' : 'În 5 zile lucrătoare'}:</b> apel tehnic cu un inginer Tech-Con</li>
        <li><b>Demonstrație:</b> ${esc(demo)}, cu studiul de caz PURATOS</li>
        <li><b>Evaluare la fața locului:</b> ambalaj, debit, spațiu, siguranță, igienă</li>
        <li><b>Ofertă și plan:</b> livrare în ~4 luni (ca la PURATOS)</li>
      </ol>
      <h3>Rezumat pentru echipa Tech-Con</h3>
      <div class="summary-box" id="summaryText">${esc(summary)}</div>
      <button class="btn secondary" id="copySummary" type="button">📋 Copiază rezumatul</button>
      <button class="btn primary big" id="pdfBtn" type="button">📄 Descarcă dosarul pentru directorul financiar</button>
      <button class="btn secondary" id="icsBtn" type="button">📅 Adaugă în calendar</button>
      <button class="btn ghost" id="restart" type="button">↺ Verificare nouă</button>
    </div>`;
  $('#requestFormWrap').hidden = true;
  $('#backTo3').hidden = true;
  c.hidden = false;
  c.scrollIntoView({ behavior: 'smooth', block: 'start' });

  $('#copySummary').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(summary); }
    catch {
      const r = document.createRange(); r.selectNodeContents($('#summaryText'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy');
    }
    e.target.textContent = '✓ Copiat';
  });
  $('#pdfBtn').addEventListener('click', (e) => makeDossier(e.currentTarget));
  $('#icsBtn').addEventListener('click', () => {
    const [h1, h2] = v.slot.split('–');
    const ds = v.date.replace(/-/g, '');
    const t = (h) => h.replace(':', '') + '00';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PaletCheck//RO', 'BEGIN:VEVENT',
      `UID:${id}@paletcheck`, `DTSTART:${ds}T${t(h1)}`, `DTEND:${ds}T${t(h2)}`,
      `SUMMARY:Demonstrație paletizare UR20 (Tech-Con)`, `LOCATION:${demo}`,
      `DESCRIPTION:${summary.replace(/\n/g, '\\n')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `demo-${id}.ics`;
    a.click();
  });
  $('#restart').addEventListener('click', () => {
    reqForm.reset();
    state.submitted4 = false;
    $$('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    if (state.scene) state.scene.setMode('human', false);
    goStep(1);
  });
}

// ---------- Dosar PDF pentru directorul financiar ----------
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function dossierHTML() {
  const d = state.data, ev = state.ev, m = manualLoad(d);
  const { v, id } = state.request;
  const office = OFFICES[d.region];
  const ok = ev.status !== 'bad';
  const today = new Date().toLocaleDateString('ro-RO');
  const demoDate = new Date(v.date + 'T12:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const demo = v.demoType === 'online' ? 'online' : v.demoType === 'fabrica' ? 'în fabrica dumneavoastră' : `la biroul Tech-Con din ${office}`;
  const verdict = ev.status === 'ok'
    ? { cls: 'ok', t: 'Compatibil orientativ', s: 'Linia se aseamănă cu aplicația PURATOS. Recomandăm evaluarea tehnică.' }
    : ev.status === 'warn'
      ? { cls: 'warn', t: 'Posibil, cu validare tehnică', s: `De verificat: ${ev.checks.filter((c) => c.status === 'warn').map((c) => c.title.toLowerCase()).join(', ')}.` }
      : { cls: 'bad', t: 'Nepotrivit pentru celula standard', s: 'Este necesară o analiză tehnică separată, fără promisiuni înainte de test.' };
  const dot = (st) => `<i class="dd ${st}"></i>`;
  const row = (label, before, after, neutral = false) => `<tr><td>${label}</td><td class="${neutral ? 'n' : 'b'}">${before}</td><td class="a">${after}</td></tr>`;
  let dims = '~3,9 × 3,9 m';
  const dt = $('.ar-dims-text b'); if (dt) dims = dt.textContent;

  return `
  <div class="dz-head">
    <div><div class="dz-brand">PaletCheck <span>UR20</span></div><div class="dz-sub">Dosar de pre-evaluare · paletizarea găleților</div></div>
    <div class="dz-meta">Nr. ${esc(id)}<br>${today}</div>
  </div>
  <div class="dz-body">
    <h1>Paletizarea automată a găleților la ${esc(v.company.trim())}</h1>
    <p class="dz-lead">Pregătit pentru: <b>conducerea financiară</b> · Solicitat de: <b>${esc(ROLE_LABEL[v.role])}</b> · ${esc(FACTORY_LABEL[d.factory])}, regiunea ${esc(d.region)}</p>

    <div class="dz-top">
      <div class="dz-img">${state.snapshot ? `<img src="${state.snapshot}" alt="">` : '<div class="dz-noimg">Vizualizare 3D indisponibilă</div>'}
        <span>${ok ? 'Simulare: celula UR20 pe linia dumneavoastră' : 'Simulare: paletizarea manuală actuală'}</span></div>
      <div class="dz-verdict ${verdict.cls}">
        <div class="dz-vt">${verdict.t}</div>
        <p>${esc(verdict.s)}</p>
        <div class="dz-kpi"><b>${fmt(m.kgDay / 1000, 1)} t</b><span>ridicate manual pe zi astăzi</span></div>
        <div class="dz-kpi"><b>${ok ? '0 t' : '–'}</b><span>ridicate manual la paletizare cu UR20</span></div>
        <div class="dz-kpi"><b>${dims}</b><span>amprenta celulei, cu zona de siguranță</span></div>
      </div>
    </div>

    <div class="dz-cols">
      <div>
        <h2>Datele liniei</h2>
        <table class="dz-t">
          <tr><td>Găleată</td><td>${fmt(d.kg, 1)} kg · Ø${fmt(d.diameter)} × ${fmt(d.height)} cm · ${d.handle ? 'cu' : 'fără'} mâner</td></tr>
          <tr><td>Ritm</td><td>${fmt(d.ppm, 1)} găleți/min</td></tr>
          <tr><td>Program</td><td>${d.shifts} schimburi/zi · ${d.lines} ${d.lines === 1 ? 'linie' : 'linii'}</td></tr>
          <tr><td>Operatori</td><td>${d.operators} / schimb la paletizare</td></tr>
        </table>
        <h2>Înainte și după</h2>
        <table class="dz-t dz-ba">
          <tr><th></th><th>Acum</th><th>Cu UR20</th></tr>
          ${row('Ridicat manual / schimb / linie', `${fmt(m.kgShift / 1000, 1)} t`, ok ? '0 t' : '–')}
          ${row('Ridicări / operator / schimb', fmt(m.liftsPerOp), ok ? '0' : '–')}
          ${row('Operatori expuși zilnic', fmt(m.opsExposed), ok ? 'schimbă paleți și separatoare' : '–')}
          ${row('Ritm de paletizare', `${fmt(d.ppm, 1)} găleți/min`, ok ? `${fmt(d.ppm, 1)} găleți/min, constant` : '–', true)}
        </table>
      </div>
      <div>
        <h2>Verificări tehnice orientative</h2>
        ${ev.checks.map((c) => `<div class="dz-check">${dot(c.status)}<div><b>${c.title}: ${c.pill}</b><p>${esc(c.text)}</p></div></div>`).join('')}
      </div>
    </div>

    <div class="dz-cols">
      <div class="dz-box">
        <h2>Fapte: aplicația PURATOS (Tech-Con)</h2>
        <ul><li>2 celule UR20; găleți de 5 kg și 13 kg</li><li>Teste: 7,4 găleți/min (13 kg), 8,6 (5 kg); țintă 6</li><li>Gripper dedicat, cameră 2D, 3 scanere/celulă</li><li>Schimbarea paleților și separatoarele rămân manuale</li><li>Livrare în aproximativ 4 luni</li></ul>
      </div>
      <div class="dz-box">
        <h2>Ipoteze și limite</h2>
        <ul><li>Gripper estimat 3,5 kg; schimb de 8 h; 1 celulă/linie</li><li>Rezultatele de test nu garantează funcționarea în altă fabrică</li><li>Nu include economii salariale sau amortizare</li><li>Transportul paleților și înfolierea nu fac parte din ofertă</li></ul>
      </div>
    </div>

    <div class="dz-next">
      <h2>Pașii următori</h2>
      <ol><li><b>Apel tehnic</b> cu un inginer Tech-Con</li><li><b>Demonstrație</b> ${esc(demo)}: ${esc(demoDate)}, ${esc(v.slot)}</li><li><b>Evaluare la fața locului:</b> ambalaj, debit, spațiu, siguranță, igienă</li><li><b>Ofertă fermă</b> și plan de implementare</li></ol>
    </div>
  </div>
  <div class="dz-foot">
    <img src="qr-paletcheck.png" alt="">
    <div><b>Reverificați oricând linia: scanați codul QR.</b><br>Tech-Con · Dragomirești-Deal · Iași · Timișoara<br>Prototip de concurs (AI-Powered Business Challenge 2026), date fictive. Document orientativ, nu ofertă comercială.</div>
  </div>`;
}
async function makeDossier(btn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Se generează dosarul…';
  const host = document.createElement('div');
  host.className = 'dossier';
  try {
    await Promise.all([loadScript('vendor/html2canvas.min.js'), loadScript('vendor/jspdf.umd.min.js')]);
    host.innerHTML = dossierHTML();
    document.body.appendChild(host);
    await Promise.all([...host.querySelectorAll('img')].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    const canvas = await window.html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const w = 210, h = (canvas.height * w) / canvas.width;
    const scale = Math.min(1, 297 / h);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w * scale) / 2, 0, w * scale, h * scale);
    pdf.setProperties({ title: `Dosar pre-evaluare UR20 ${state.request.id}`, author: 'PaletCheck UR20' });
    pdf.save(`Dosar-UR20-${state.request.id}.pdf`);
    btn.textContent = '✓ Dosar descărcat';
  } catch (err) {
    console.error(err);
    btn.textContent = label;
    alert('Dosarul nu s-a putut genera. Încearcă din nou.');
  } finally {
    host.remove();
    btn.disabled = false;
  }
}

// Înapoi
$$('[data-back]').forEach((b) => b.addEventListener('click', () => {
  const n = +b.dataset.back;
  if (n === 1 && state.scene) state.scene.setMode('human', false);
  goStep(n);
  if (n === 3 && state.scene) requestAnimationFrame(() => state.scene.resize());
}));
// Pașii din antet: doar înapoi spre pașii deja parcurși
$$('#stepper li').forEach((li) => li.addEventListener('click', () => {
  const n = +li.dataset.step;
  if (n >= state.step) return;
  if (n <= 2 && state.scene) state.scene.setMode('human', false);
  if (n === 2 && state.scene) { setBadge('human'); renderLive('human'); }
  goStep(n);
  if (n >= 2 && state.scene) requestAnimationFrame(() => state.scene.resize());
}));

// ---------- Realitate augmentată ----------
let mvLoaded = null;
fetch('ar/dimensiuni.json').then((r) => r.json()).then((s) => {
  $$('.ar-dims-text').forEach((el) => (el.innerHTML = `Amprenta cu zona de siguranță: <b>~${fmt(s.x, 1)} × ${fmt(s.z, 1)} m</b> · înălțime ~${fmt(s.y, 1)} m`));
}).catch(() => {});

async function openAR() {
  const modal = $('#arModal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (!mvLoaded) mvLoaded = import('./vendor/model-viewer.min.js');
  try { await mvLoaded; } catch {
    $('#arStage').innerHTML = '<div class="ar-loading">Macheta 3D nu s-a putut încărca. Verifică internetul.</div>';
    return;
  }
  if ($('#arStage model-viewer')) return;
  const mv = document.createElement('model-viewer');
  Object.entries({
    src: 'ar/celula-ur20.glb',
    'ios-src': 'ar/celula-ur20.usdz',
    alt: 'Celulă de paletizare UR20 la scară reală',
    ar: '',
    'ar-modes': 'webxr scene-viewer quick-look',
    'ar-placement': 'floor',
    'ar-scale': 'fixed',
    'camera-controls': '',
    'touch-action': 'none',
    'auto-rotate': '',
    'auto-rotate-delay': '0',
    'rotation-per-second': '12deg',
    'shadow-intensity': '1',
    'shadow-softness': '0.8',
    exposure: '1.1',
    'environment-image': 'neutral',
    'camera-orbit': '35deg 62deg auto',
    'interaction-prompt': 'none',
  }).forEach(([k, v]) => mv.setAttribute(k, v));
  mv.innerHTML = '<button slot="ar-button" class="ar-go" type="button">📱 Pune celula în hala ta</button>';
  $('#arStage').innerHTML = '';
  $('#arStage').appendChild(mv);
  mv.addEventListener('load', () => {
    if (!mv.canActivateAR) {
      const n = document.createElement('div');
      n.className = 'ar-noar';
      n.innerHTML = 'Realitatea augmentată merge pe telefon: <b>Android → Chrome</b>, <b>iPhone → Safari</b>, pe linkul public. Aici poți roti macheta 3D cu degetul sau cu mouse-ul.';
      $('#arStage').appendChild(n);
    }
  });
  mv.addEventListener('ar-status', (e) => {
    if (e.detail.status === 'failed') alert('AR nu a pornit pe acest telefon. Încearcă din Chrome (Android) sau Safari (iPhone), în lumină bună, îndreptând camera spre podea.');
  });
}
$$('[data-open-ar]').forEach((b) => b.addEventListener('click', openAR));
$('#closeAR').addEventListener('click', () => {
  $('#arModal').hidden = true;
  document.body.style.overflow = '';
});

// ---------- PWA ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
let installPrompt = null;
const installBtn = $('#install');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.style.display = 'block';
});
installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installBtn.style.display = 'none';
});
