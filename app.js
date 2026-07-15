/* ---------- Iconos propios (SVG inline, sin depender de internet) ---------- */
const ICONS = {
  carrot: '<path d="M12 8l4 12-8 0z"/><path d="M12 8V3"/><path d="M9 4l2 2"/><path d="M15 4l-2 2"/>',
  apple: '<circle cx="12" cy="13" r="7"/><path d="M12 6V3"/><path d="M12 4c1.5-1.5 3-1.5 4 0"/>',
  bread: '<rect x="3" y="9" width="18" height="10" rx="5"/><path d="M8 9c0-3 1-6 4-6s4 3 4 6"/>',
  seeding: '<circle cx="12" cy="17" r="2"/><path d="M12 15V9"/><path d="M12 9c-3 0-5-2-5-5 3 0 5 2 5 5z"/>',
  meat: '<path d="M8 3c4-2 9 1 9 6 0 3-2 5-5 6l-3 6-3-1 2-5c-2-1-3-3-3-6 0-2 1-4 3-6z"/>',
  milk: '<path d="M9 2h6v3l2 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-3z"/>',
  droplet: '<path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13z"/>',
  candy: '<rect x="9" y="9" width="6" height="6" transform="rotate(45 12 12)"/>'
};

function iconSvg(name, size) {
  const s = size || 18;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ---------- Estado y persistencia ---------- */
const STORAGE_KEY = 'nutriTrackData';

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function defaultData() {
  return {
    profile: {
      setupComplete: false,
      sex: 'M',
      age: 28,
      height: 175,
      targetWeight: 74,
      pace: 0.5,
      restingHR: null
    },
    weights: [],
    meals: [],
    workouts: [],
    smaeLog: []
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultData(), parsed, {
      profile: Object.assign(defaultData().profile, parsed.profile || {})
    });
  } catch (e) {
    return defaultData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();

/* ---------- Utilidades de fecha ---------- */
function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekDates(date = new Date()) {
  const start = startOfWeek(date);
  const arr = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(todayStr(d));
  }
  return arr;
}

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/* ---------- Calculos nutricionales ---------- */
function getLatestWeight() {
  if (state.weights.length === 0) return null;
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1].kg;
}

function calcBMR(profile, weightKg) {
  const base = 10 * weightKg + 6.25 * profile.height - 5 * profile.age;
  return profile.sex === 'M' ? base + 5 : base - 161;
}

function workoutsThisWeekCount() {
  const days = weekDates();
  const daysWithWorkout = new Set(
    state.workouts.filter(w => days.includes(w.date)).map(w => w.date)
  );
  return daysWithWorkout.size;
}

function activityFactor(count) {
  if (count >= 5) return 1.725;
  if (count >= 3) return 1.55;
  if (count >= 1) return 1.375;
  return 1.2;
}

function calcDeficitPerDay(profile) {
  return (profile.pace * 7700) / 7;
}

function calcPlan() {
  const profile = state.profile;
  const weight = getLatestWeight() || profile.targetWeight;
  const bmr = calcBMR(profile, weight);
  const factor = activityFactor(workoutsThisWeekCount());
  const tdee = bmr * factor;
  const deficitPerDay = calcDeficitPerDay(profile);
  let dailyGoal;
  let direction = 0;
  if (profile.targetWeight < weight - 0.1) {
    dailyGoal = tdee - deficitPerDay;
    direction = -1;
  } else if (profile.targetWeight > weight + 0.1) {
    dailyGoal = tdee + deficitPerDay;
    direction = 1;
  } else {
    dailyGoal = tdee;
    direction = 0;
  }
  dailyGoal = Math.max(1200, Math.round(dailyGoal));

  const proteinG = Math.round((dailyGoal * 0.3) / 4);
  const carbsG = Math.round((dailyGoal * 0.4) / 4);
  const fatG = Math.round((dailyGoal * 0.3) / 9);
  const cerealesPortions = Math.max(1, Math.round(carbsG / 15));
  const lacteosPortions = Math.max(1, Math.round((2 * dailyGoal) / 2000));
  const verdurasPortions = 4;
  const frutasPortions = 3;
  const leguminosasPortions = 1;
  const animalPortions = Math.max(1, Math.round(proteinG / 7));
  const aceitesPortions = Math.max(1, Math.round((dailyGoal * 0.3) / (9 * 5)));
  const azucaresPortions = 2;

  const weightDiff = Math.abs(weight - profile.targetWeight);
  const daysToGoal =
    deficitPerDay > 0 && weightDiff > 0.1
      ? Math.ceil((weightDiff * 7700) / deficitPerDay)
      : 0;

  const maxHR = 208 - 0.7 * profile.age;
  let hrLow, hrHigh;
  if (profile.restingHR) {
    hrLow = Math.round(profile.restingHR + 0.6 * (maxHR - profile.restingHR));
    hrHigh = Math.round(profile.restingHR + 0.75 * (maxHR - profile.restingHR));
  } else {
    hrLow = Math.round(maxHR * 0.6);
    hrHigh = Math.round(maxHR * 0.75);
  }

  return {
    weight, bmr: Math.round(bmr), tdee: Math.round(tdee), deficitPerDay: Math.round(deficitPerDay),
    dailyGoal, direction, proteinG, carbsG, fatG,
    cerealesPortions, lacteosPortions, verdurasPortions, frutasPortions,
    leguminosasPortions, animalPortions, aceitesPortions, azucaresPortions,
    daysToGoal, hrLow, hrHigh
  };
}

/* ---------- Totales del dia ---------- */
function mealsForDate(date) {
  return state.meals.filter(m => m.date === date);
}

function dayTotals(date) {
  const meals = mealsForDate(date);
  return meals.reduce(
    (acc, m) => {
      acc.kcal += m.kcal || 0;
      acc.protein += m.protein || 0;
      acc.carbs += m.carbs || 0;
      acc.fat += m.fat || 0;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function smaeCountForDate(date, group) {
  return state.smaeLog
    .filter(s => s.date === date && s.group === group)
    .reduce((acc, s) => acc + s.count, 0);
}

function workoutsForDate(date) {
  return state.workouts.filter(w => w.date === date);
}

function METS() {
  return {
    Pecho: 5, Biceps: 4, Triceps: 4, Pierna: 6,
    Espalda: 5, Hombro: 4, Cardio: 8, Natacion: 9
  };
}

function estimateKcalBurned(muscles, durationMin, weightKg) {
  const mets = METS();
  if (!muscles.length) return 0;
  const avgMet = muscles.reduce((a, m) => a + (mets[m] || 5), 0) / muscles.length;
  return Math.round((avgMet * 3.5 * weightKg / 200) * durationMin);
}

/* ---------- Render: dot indicators ---------- */
function dots(current, goal) {
  const total = 5;
  const filled = Math.max(0, Math.min(total, Math.round((current / goal) * total)));
  return '●'.repeat(filled) + '○'.repeat(total - filled);
}

/* ---------- Navegacion ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.tab-item[data-target="${id}"]`);
  if (tab) tab.classList.add('active');
  if (id === 'screen-dashboard') renderDashboard();
  if (id === 'screen-groups') renderGroups();
  if (id === 'screen-history') renderHistory();
  if (id === 'screen-settings') renderSettings();
  window.scrollTo(0, 0);
}

/* ---------- Render: Dashboard ---------- */
function renderDashboard() {
  const plan = calcPlan();
  const today = todayStr();
  const totals = dayTotals(today);

  const pct = Math.max(0, Math.min(1, totals.kcal / plan.dailyGoal));
  const circumference = 326.7;
  const offset = circumference * (1 - pct);
  document.getElementById('ring-progress').setAttribute('stroke-dashoffset', offset.toFixed(1));
  document.getElementById('ring-kcal').textContent = Math.round(totals.kcal);
  document.getElementById('ring-goal').textContent = `de ${plan.dailyGoal} kcal`;

  document.getElementById('macro-protein-dots').textContent = dots(totals.protein, plan.proteinG);
  document.getElementById('macro-carbs-dots').textContent = dots(totals.carbs, plan.carbsG);
  document.getElementById('macro-fat-dots').textContent = dots(totals.fat, plan.fatG);
  document.getElementById('macro-cereales-dots').textContent = dots(smaeCountForDate(today, 'Cereales y tuberculos'), plan.cerealesPortions);
  document.getElementById('macro-lacteos-dots').textContent = dots(smaeCountForDate(today, 'Leche'), plan.lacteosPortions);

  document.getElementById('macro-protein-detail').textContent = `${Math.round(totals.protein)}g de ${plan.proteinG}g · quedan ${Math.max(0, plan.proteinG - Math.round(totals.protein))}g`;
  document.getElementById('macro-carbs-detail').textContent = `${Math.round(totals.carbs)}g de ${plan.carbsG}g · quedan ${Math.max(0, plan.carbsG - Math.round(totals.carbs))}g`;
  document.getElementById('macro-fat-detail').textContent = `${Math.round(totals.fat)}g de ${plan.fatG}g · quedan ${Math.max(0, plan.fatG - Math.round(totals.fat))}g`;
  const cerealesNow = smaeCountForDate(today, 'Cereales y tuberculos');
  document.getElementById('macro-cereales-detail').textContent = `${cerealesNow} de ${plan.cerealesPortions} porciones · quedan ${Math.max(0, plan.cerealesPortions - cerealesNow)}`;
  const lacteosNow = smaeCountForDate(today, 'Leche');
  document.getElementById('macro-lacteos-detail').textContent = `${lacteosNow} de ${plan.lacteosPortions} porciones · quedan ${Math.max(0, plan.lacteosPortions - lacteosNow)}`;

  document.getElementById('weight-value').textContent = plan.weight ? `${plan.weight.toFixed(1)} kg` : 'Sin datos';
  const wSpark = document.getElementById('weight-sparkline');
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  if (sorted.length > 1) {
    const vals = sorted.map(w => w.kg);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = sorted.map((w, i) => {
      const x = (i / (sorted.length - 1)) * 100;
      const y = 24 - ((w.kg - min) / range) * 20 - 2;
      return `${x},${y.toFixed(1)}`;
    }).join(' ');
    wSpark.setAttribute('points', pts);
  } else {
    wSpark.setAttribute('points', '0,14 100,14');
  }

  document.getElementById('hr-zone').textContent = `${plan.hrLow}-${plan.hrHigh}`;

  document.getElementById('days-to-goal').textContent = plan.daysToGoal > 0 ? `${plan.daysToGoal} dias para tu meta` : 'Meta alcanzada';

  const streakEl = document.getElementById('streak-list');
  streakEl.innerHTML = '';
  const days = weekDates();
  let weekKcal = 0;
  days.forEach((d, i) => {
    const workouts = workoutsForDate(d);
    const trained = workouts.length > 0;
    const muscles = [...new Set(workouts.flatMap(w => w.muscles))];
    const kcalDay = workouts.reduce((a, w) => a + (w.kcal || 0), 0);
    weekKcal += kcalDay;
    const row = document.createElement('div');
    row.className = 'streak-row';
    row.innerHTML = `
      <div class="day-badge ${trained ? 'trained' : ''}">${DAY_LETTERS[i]}</div>
      <div class="streak-chips">${trained ? muscles.map(m => `<span class="chip">${m}</span>`).join('') : '<span class="muted-text">Descanso</span>'}</div>
      <span class="streak-kcal">${trained ? kcalDay + ' kcal' : '-'}</span>
    `;
    streakEl.appendChild(row);
  });
  document.getElementById('week-kcal-total').textContent = `Semana: ${Math.round(weekKcal)} kcal`;
  document.getElementById('week-objective').textContent = `Objetivo -${Math.round(plan.deficitPerDay * 7)} kcal/sem`;

  renderProgressChart(plan);
}

/* ---------- Grafica de progreso global (peso vs meta, en el tiempo) ---------- */
function renderProgressChart(plan) {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const W = 340, H = 110, PAD = 6;
  const line = document.getElementById('progress-line');
  const area = document.getElementById('progress-area');
  const goalLine = document.getElementById('progress-goal-line');
  const startLabel = document.getElementById('progress-start-label');
  const goalLabel = document.getElementById('progress-goal-label');
  const summary = document.getElementById('progress-summary');

  if (sorted.length < 2) {
    line.setAttribute('points', '');
    area.setAttribute('d', '');
    goalLine.setAttribute('y1', H / 2);
    goalLine.setAttribute('y2', H / 2);
    startLabel.textContent = 'Registra tu peso varios dias';
    goalLabel.textContent = `Meta: ${state.profile.targetWeight} kg`;
    summary.textContent = 'Agrega mas registros de peso para ver tu progreso graficado en el tiempo.';
    return;
  }

  const vals = sorted.map(w => w.kg).concat([state.profile.targetWeight]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max - min) || 1;
  const yFor = kg => H - PAD - ((kg - min) / range) * (H - PAD * 2);

  const pts = sorted.map((w, i) => {
    const x = (i / (sorted.length - 1)) * W;
    return `${x.toFixed(1)},${yFor(w.kg).toFixed(1)}`;
  });
  line.setAttribute('points', pts.join(' '));

  const areaPath = `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
  area.setAttribute('d', areaPath);

  const goalY = yFor(state.profile.targetWeight);
  goalLine.setAttribute('y1', goalY.toFixed(1));
  goalLine.setAttribute('y2', goalY.toFixed(1));

  const first = sorted[0].kg;
  const current = sorted[sorted.length - 1].kg;
  startLabel.textContent = `Inicio: ${first.toFixed(1)} kg`;
  goalLabel.textContent = `Meta: ${state.profile.targetWeight} kg`;

  const totalToLose = Math.abs(first - state.profile.targetWeight);
  const doneSoFar = Math.abs(first - current);
  const pctDone = totalToLose > 0 ? Math.min(100, Math.round((doneSoFar / totalToLose) * 100)) : 100;
  const direction = state.profile.targetWeight < first ? 'perdido' : 'ganado';
  summary.textContent = `Has ${direction} ${doneSoFar.toFixed(1)} kg de ${totalToLose.toFixed(1)} kg (${pctDone}% de tu meta)`;
}

/* ---------- Toggle de macros (mostrar gramos al tocar) ---------- */
document.addEventListener('click', e => {
  const macro = e.target.closest('.macro');
  if (macro) {
    const detail = macro.querySelector('.macro-detail');
    if (detail) detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
  }
});

/* ---------- Render: Grupos y equivalentes ---------- */
const SMAE_GROUPS = [
  { key: 'Verduras', label: 'Verduras', icon: 'carrot', example: '1 porcion ≈ 1 taza cruda' },
  { key: 'Frutas', label: 'Frutas', icon: 'apple', example: '1 porcion ≈ 1 pieza mediana' },
  { key: 'Cereales y tuberculos', label: 'Cereales y tuberculos', icon: 'bread', example: '1 porcion ≈ 1 tortilla o 1/2 taza' },
  { key: 'Leguminosas', label: 'Leguminosas', icon: 'seeding', example: '1 porcion ≈ 1/2 taza cocida' },
  { key: 'Origen animal', label: 'Origen animal', icon: 'meat', example: '1 porcion ≈ 30g carne/pollo/pescado' },
  { key: 'Leche', label: 'Leche', icon: 'milk', example: '1 porcion ≈ 1 taza (240ml)' },
  { key: 'Aceites y grasas', label: 'Aceites y grasas', icon: 'droplet', example: '1 porcion ≈ 1 cucharadita' },
  { key: 'Azucares', label: 'Azucares', icon: 'candy', example: '1 porcion ≈ 1 cucharada' }
];

function goalForGroup(plan, key) {
  const map = {
    'Verduras': plan.verdurasPortions,
    'Frutas': plan.frutasPortions,
    'Cereales y tuberculos': plan.cerealesPortions,
    'Leguminosas': plan.leguminosasPortions,
    'Origen animal': plan.animalPortions,
    'Leche': plan.lacteosPortions,
    'Aceites y grasas': plan.aceitesPortions,
    'Azucares': plan.azucaresPortions
  };
  return map[key] || 1;
}

function renderGroups() {
  const plan = calcPlan();
  const today = todayStr();
  const list = document.getElementById('groups-list');
  list.innerHTML = '';
  SMAE_GROUPS.forEach(g => {
    const goal = goalForGroup(plan, g.key);
    const current = smaeCountForDate(today, g.key);
    const row = document.createElement('div');
    row.className = 'group-row';
    row.innerHTML = `
      <span class="group-icon">${iconSvg(g.icon, 18)}</span>
      <div class="group-info">
        <p class="group-name">${g.label}</p>
        <p class="group-example">${g.example}</p>
      </div>
      <span class="group-count">${current}/${goal}</span>
      <button class="add-portion-btn" data-group="${g.key}" aria-label="Agregar porcion de ${g.label}">+</button>
    `;
    list.appendChild(row);
  });
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.add-portion-btn');
  if (btn) {
    state.smaeLog.push({ date: todayStr(), group: btn.dataset.group, count: 1 });
    saveData();
    renderGroups();
  }
});

/* ---------- Render: Historial de peso ---------- */
function renderHistory() {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last30 = sorted.slice(-30);
  const chart = document.getElementById('history-chart');
  if (last30.length > 1) {
    const vals = last30.map(w => w.kg);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = last30.map((w, i) => {
      const x = (i / (last30.length - 1)) * 340;
      const y = 80 - ((w.kg - min) / range) * 70;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    chart.setAttribute('points', pts);
  } else {
    chart.setAttribute('points', '0,60 340,60');
  }

  const current = getLatestWeight();
  document.getElementById('hist-current').textContent = current ? `${current.toFixed(1)} kg` : '-';
  document.getElementById('hist-target').textContent = `${state.profile.targetWeight} kg`;
  let changeText = '-';
  if (sorted.length > 0) {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = todayStr(monthAgo);
    const before = sorted.filter(w => w.date <= monthAgoStr).slice(-1)[0];
    if (before && current) {
      const diff = current - before.kg;
      changeText = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg`;
    }
  }
  document.getElementById('hist-month-change').textContent = changeText;

  const list = document.getElementById('history-list');
  list.innerHTML = '';
  [...sorted].reverse().slice(0, 15).forEach(w => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `<span class="muted-text">${w.date}</span><span>${w.kg.toFixed(1)} kg</span>`;
    list.appendChild(row);
  });
}

/* ---------- Render: Ajustes ---------- */
function renderSettings() {
  const p = state.profile;
  document.getElementById('set-sex').value = p.sex;
  document.getElementById('set-age').value = p.age;
  document.getElementById('set-height').value = p.height;
  document.getElementById('set-target').value = p.targetWeight;
  document.getElementById('set-pace').value = p.pace;
  document.getElementById('set-hr').value = p.restingHR || '';
}

function saveSettingsForm(prefix) {
  state.profile.sex = document.getElementById(prefix + '-sex').value;
  state.profile.age = Number(document.getElementById(prefix + '-age').value) || state.profile.age;
  state.profile.height = Number(document.getElementById(prefix + '-height').value) || state.profile.height;
  state.profile.targetWeight = Number(document.getElementById(prefix + '-target').value) || state.profile.targetWeight;
  state.profile.pace = Number(document.getElementById(prefix + '-pace').value) || state.profile.pace;
  const hr = Number(document.getElementById(prefix + '-hr').value);
  state.profile.restingHR = hr > 0 ? hr : null;
  const w = Number(document.getElementById(prefix + '-weight')?.value);
  if (w > 0) {
    state.weights.push({ date: todayStr(), kg: w });
  }
  state.profile.setupComplete = true;
  saveData();
}

/* ---------- Base de datos local de alimentos ---------- */
/* [nombre, grupo, kcal/100g, proteina/100g, carbos/100g, grasa/100g, porcion sugerida en gramos] */
const FOOD_DB = [
  ['Manzana', 'Frutas', 52, 0.3, 14, 0.2, 150],
  ['Platano', 'Frutas', 89, 1.1, 23, 0.3, 120],
  ['Naranja', 'Frutas', 47, 0.9, 12, 0.1, 150],
  ['Fresa', 'Frutas', 32, 0.7, 8, 0.3, 100],
  ['Uva', 'Frutas', 69, 0.7, 18, 0.2, 100],
  ['Sandia', 'Frutas', 30, 0.6, 8, 0.2, 150],
  ['Melon', 'Frutas', 34, 0.8, 8, 0.2, 150],
  ['Papaya', 'Frutas', 43, 0.5, 11, 0.3, 150],
  ['Mango', 'Frutas', 60, 0.8, 15, 0.4, 120],
  ['Piña', 'Frutas', 50, 0.5, 13, 0.1, 120],
  ['Pera', 'Frutas', 57, 0.4, 15, 0.1, 150],
  ['Kiwi', 'Frutas', 61, 1.1, 15, 0.5, 80],
  ['Durazno', 'Frutas', 39, 0.9, 10, 0.3, 120],
  ['Guayaba', 'Frutas', 68, 2.6, 14, 1, 100],
  ['Mandarina', 'Frutas', 53, 0.8, 13, 0.3, 100],
  ['Limon', 'Frutas', 29, 1.1, 9, 0.3, 50],
  ['Toronja', 'Frutas', 42, 0.8, 11, 0.1, 150],
  ['Ciruela', 'Frutas', 46, 0.7, 11, 0.3, 60],
  ['Higo', 'Frutas', 74, 0.8, 19, 0.3, 60],
  ['Zarzamora', 'Frutas', 43, 1.4, 10, 0.5, 100],
  ['Arandano', 'Frutas', 57, 0.7, 14, 0.3, 100],
  ['Guanabana', 'Frutas', 66, 1, 17, 0.3, 150],
  ['Mamey', 'Frutas', 92, 1.6, 22, 0.5, 100],

  ['Lechuga', 'Verduras', 15, 1.4, 3, 0.2, 80],
  ['Jitomate', 'Verduras', 18, 0.9, 4, 0.2, 100],
  ['Zanahoria', 'Verduras', 41, 0.9, 10, 0.2, 80],
  ['Pepino', 'Verduras', 15, 0.7, 4, 0.1, 100],
  ['Brocoli', 'Verduras', 34, 2.8, 7, 0.4, 90],
  ['Coliflor', 'Verduras', 25, 1.9, 5, 0.3, 90],
  ['Espinaca', 'Verduras', 23, 2.9, 4, 0.4, 60],
  ['Calabacita', 'Verduras', 17, 1.2, 3, 0.3, 100],
  ['Chayote', 'Verduras', 19, 0.8, 4, 0.1, 100],
  ['Apio', 'Verduras', 16, 0.7, 3, 0.2, 60],
  ['Champiñon', 'Verduras', 22, 3.1, 3, 0.3, 80],
  ['Pimiento', 'Verduras', 31, 1, 6, 0.3, 80],
  ['Cebolla', 'Verduras', 40, 1.1, 9, 0.1, 50],
  ['Col', 'Verduras', 25, 1.3, 6, 0.1, 80],
  ['Betabel', 'Verduras', 43, 1.6, 10, 0.2, 80],
  ['Ejote', 'Verduras', 31, 1.8, 7, 0.1, 80],
  ['Nopal', 'Verduras', 16, 1.3, 3, 0.1, 100],
  ['Rabano', 'Verduras', 16, 0.7, 3, 0.1, 50],

  ['Tortilla de maiz', 'Cereales y tuberculos', 218, 5.7, 44, 2.3, 30],
  ['Tortilla de harina', 'Cereales y tuberculos', 312, 8, 50, 8, 35],
  ['Pan blanco', 'Cereales y tuberculos', 265, 9, 49, 3.2, 30],
  ['Pan integral', 'Cereales y tuberculos', 247, 13, 41, 3.4, 30],
  ['Arroz cocido', 'Cereales y tuberculos', 130, 2.7, 28, 0.3, 150],
  ['Pasta cocida', 'Cereales y tuberculos', 131, 5, 25, 1.1, 150],
  ['Avena', 'Cereales y tuberculos', 389, 17, 66, 7, 40],
  ['Papa cocida', 'Cereales y tuberculos', 87, 2, 20, 0.1, 150],
  ['Camote', 'Cereales y tuberculos', 86, 1.6, 20, 0.1, 120],
  ['Elote', 'Cereales y tuberculos', 96, 3.4, 21, 1.5, 100],
  ['Galletas marias', 'Cereales y tuberculos', 433, 8, 75, 10, 25],
  ['Cereal de caja', 'Cereales y tuberculos', 380, 7, 84, 1, 30],

  ['Frijol cocido', 'Leguminosas', 127, 8.7, 23, 0.5, 120],
  ['Garbanzo cocido', 'Leguminosas', 164, 8.9, 27, 2.6, 120],
  ['Lenteja cocida', 'Leguminosas', 116, 9, 20, 0.4, 120],
  ['Haba cocida', 'Leguminosas', 110, 7.6, 20, 0.5, 120],
  ['Soya cocida', 'Leguminosas', 173, 16.6, 9.9, 9, 100],

  ['Pechuga de pollo', 'Origen animal', 165, 31, 0, 3.6, 100],
  ['Carne de res molida', 'Origen animal', 250, 26, 0, 15, 100],
  ['Huevo', 'Origen animal', 155, 13, 1.1, 11, 50],
  ['Atun en agua', 'Origen animal', 116, 26, 0, 1, 80],
  ['Salmon', 'Origen animal', 208, 20, 0, 13, 100],
  ['Pescado blanco', 'Origen animal', 96, 20, 0, 1.5, 100],
  ['Camaron', 'Origen animal', 99, 24, 0.2, 0.3, 90],
  ['Jamon', 'Origen animal', 145, 18, 2, 7, 40],
  ['Queso panela', 'Origen animal', 250, 18, 2, 19, 40],
  ['Queso oaxaca', 'Origen animal', 344, 25, 2, 27, 30],
  ['Tofu', 'Origen animal', 76, 8, 1.9, 4.8, 100],

  ['Leche entera', 'Leche', 61, 3.2, 4.8, 3.3, 240],
  ['Leche descremada', 'Leche', 34, 3.4, 5, 0.1, 240],
  ['Yogurt natural', 'Leche', 61, 3.5, 4.7, 3.3, 200],
  ['Yogurt griego', 'Leche', 59, 10, 3.6, 0.4, 170],
  ['Leche de almendra', 'Leche', 17, 0.6, 0.6, 1.2, 240],

  ['Aceite de oliva', 'Aceites y grasas', 884, 0, 0, 100, 13],
  ['Aceite vegetal', 'Aceites y grasas', 884, 0, 0, 100, 13],
  ['Aguacate', 'Aceites y grasas', 160, 2, 9, 15, 60],
  ['Mantequilla', 'Aceites y grasas', 717, 0.9, 0.1, 81, 10],
  ['Mayonesa', 'Aceites y grasas', 680, 1, 2, 75, 15],
  ['Crema', 'Aceites y grasas', 292, 2.2, 3, 30, 15],
  ['Almendra', 'Aceites y grasas', 579, 21, 22, 50, 15],
  ['Cacahuate', 'Aceites y grasas', 567, 26, 16, 49, 15],
  ['Nuez', 'Aceites y grasas', 654, 15, 14, 65, 15],

  ['Azucar', 'Azucares', 387, 0, 100, 0, 10],
  ['Miel', 'Azucares', 304, 0.3, 82, 0, 15],
  ['Mermelada', 'Azucares', 250, 0.4, 65, 0.1, 20],
  ['Chocolate', 'Azucares', 546, 4.9, 61, 31, 20]
];

function normalizeText(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function searchLocalFoods(query) {
  const q = normalizeText(query);
  return FOOD_DB.filter(f => normalizeText(f[0]).includes(q)).slice(0, 15);
}

/* ---------- Agregar comida ---------- */
let selectedFood = null;

function foodRow(name, kcal100, grams, onAdd) {
  const row = document.createElement('div');
  row.className = 'food-row';
  row.innerHTML = `
    <div class="food-info">
      <p class="food-name">${name}</p>
      <p class="group-example">${Math.round(kcal100)} kcal / 100g</p>
    </div>
    <button class="add-food-btn">Agregar</button>
  `;
  row.querySelector('.add-food-btn').addEventListener('click', onAdd);
  return row;
}

async function searchFood(query) {
  const resultsEl = document.getElementById('food-results');
  resultsEl.innerHTML = '';

  const local = searchLocalFoods(query);
  local.forEach(f => {
    const [name, group, kcal100, protein100, carbs100, fat100, defGrams] = f;
    const product = {
      product_name: name,
      nutriments: {
        'energy-kcal_100g': kcal100,
        'proteins_100g': protein100,
        'carbohydrates_100g': carbs100,
        'fat_100g': fat100
      }
    };
    resultsEl.appendChild(foodRow(name, kcal100, defGrams, () => openFoodQtyModal(product, defGrams)));
  });

  if (local.length === 0) {
    resultsEl.innerHTML = '<p class="muted-text" style="padding:8px 4px;">Sin resultados locales. Buscando en linea...</p>';
  }

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8`;
    const res = await fetch(url);
    const data = await res.json();
    const products = (data.products || []).filter(p => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g']);
    if (local.length === 0) resultsEl.innerHTML = '';
    products.slice(0, 8).forEach(p => {
      const kcal100 = p.nutriments['energy-kcal_100g'] || 0;
      resultsEl.appendChild(foodRow(p.product_name, kcal100, 100, () => openFoodQtyModal(p, 100)));
    });
    if (local.length === 0 && products.length === 0) {
      resultsEl.innerHTML = '<p class="muted-text" style="padding:8px 4px;">Sin resultados. Prueba otro termino o agrega manual abajo.</p>';
    }
  } catch (err) {
    if (local.length === 0) {
      resultsEl.innerHTML = '<p class="muted-text" style="padding:8px 4px;">Sin resultados locales y sin conexion. Prueba otro termino o agrega manual abajo.</p>';
    }
  }
}

let pendingProduct = null;

function openFoodQtyModal(product, defGrams) {
  pendingProduct = product;
  document.getElementById('qty-modal-title').textContent = product.product_name;
  document.getElementById('qty-input').value = defGrams || 100;
  document.getElementById('qty-modal').classList.add('open');
  document.getElementById('qty-input').focus();
}

function closeQtyModal() {
  document.getElementById('qty-modal').classList.remove('open');
  pendingProduct = null;
}

function confirmQtyModal() {
  if (!pendingProduct) return;
  const g = Number(document.getElementById('qty-input').value);
  if (!g || g <= 0) {
    toast('Escribe una cantidad valida.');
    return;
  }
  const n = pendingProduct.nutriments;
  const factor = g / 100;
  const meal = {
    date: todayStr(),
    name: pendingProduct.product_name,
    kcal: Math.round((n['energy-kcal_100g'] || 0) * factor),
    protein: Math.round((n['proteins_100g'] || 0) * factor),
    carbs: Math.round((n['carbohydrates_100g'] || 0) * factor),
    fat: Math.round((n['fat_100g'] || 0) * factor)
  };
  state.meals.push(meal);
  saveData();
  renderRecentMeals();
  renderDashboard();
  toast(`Agregado: ${meal.name} (${meal.kcal} kcal)`);
  closeQtyModal();
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function renderRecentMeals() {
  const today = todayStr();
  const list = document.getElementById('recent-meals');
  list.innerHTML = '';
  mealsForDate(today).slice().reverse().forEach(m => {
    const row = document.createElement('div');
    row.className = 'food-row';
    row.innerHTML = `<span class="food-name">${m.name}</span><span class="group-example">${m.kcal} kcal</span>`;
    list.appendChild(row);
  });
}

function addManualFood() {
  const name = document.getElementById('manual-name').value.trim();
  const kcal = Number(document.getElementById('manual-kcal').value);
  const protein = Number(document.getElementById('manual-protein').value) || 0;
  const carbs = Number(document.getElementById('manual-carbs').value) || 0;
  const fat = Number(document.getElementById('manual-fat').value) || 0;
  if (!name || !kcal) {
    toast('Escribe al menos el nombre y las calorias.');
    return;
  }
  state.meals.push({ date: todayStr(), name, kcal, protein, carbs, fat });
  saveData();
  renderRecentMeals();
  document.getElementById('manual-name').value = '';
  document.getElementById('manual-kcal').value = '';
  document.getElementById('manual-protein').value = '';
  document.getElementById('manual-carbs').value = '';
  document.getElementById('manual-fat').value = '';
}

/* ---------- Registrar entrenamiento ---------- */
let selectedMuscles = [];

function toggleMuscle(chip) {
  const m = chip.dataset.muscle;
  if (selectedMuscles.includes(m)) {
    selectedMuscles = selectedMuscles.filter(x => x !== m);
    chip.classList.remove('selected');
  } else {
    selectedMuscles.push(m);
    chip.classList.add('selected');
  }
  updateWorkoutEstimate();
}

function updateWorkoutEstimate() {
  const duration = Number(document.getElementById('workout-duration').value) || 0;
  const weight = getLatestWeight() || 75;
  const est = estimateKcalBurned(selectedMuscles, duration, weight);
  document.getElementById('workout-kcal-input').value = est;
}

function saveWorkout() {
  if (selectedMuscles.length === 0) {
    toast('Selecciona al menos un musculo o cardio.');
    return;
  }
  const duration = Number(document.getElementById('workout-duration').value) || 0;
  const kcal = Number(document.getElementById('workout-kcal-input').value) || 0;
  state.workouts.push({
    date: todayStr(), muscles: [...selectedMuscles], duration, kcal
  });
  saveData();
  selectedMuscles = [];
  document.querySelectorAll('.muscle-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('workout-duration').value = '';
  document.getElementById('workout-kcal-input').value = '';
  toast('Entrenamiento guardado.');
  showScreen('screen-dashboard');
}

/* ---------- Export / Import ---------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutritrack-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = Object.assign(defaultData(), parsed);
      saveData();
      toast('Respaldo restaurado.');
      showScreen('screen-dashboard');
    } catch (e) {
      toast('Archivo invalido.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Inicializacion ---------- */
function init() {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => showScreen(tab.dataset.target));
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.nav));
  });

  document.getElementById('food-search-input').addEventListener('input', e => {
    const q = e.target.value.trim();
    if (q.length >= 3) searchFood(q);
    else document.getElementById('food-results').innerHTML = '';
  });
  document.getElementById('manual-add-btn').addEventListener('click', addManualFood);

  document.querySelectorAll('.muscle-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleMuscle(chip));
  });
  document.getElementById('workout-duration').addEventListener('input', updateWorkoutEstimate);
  document.getElementById('save-workout-btn').addEventListener('click', saveWorkout);

  document.getElementById('weight-card').addEventListener('click', () => showScreen('screen-history'));

  document.getElementById('settings-save-btn').addEventListener('click', () => {
    saveSettingsForm('set');
    showScreen('screen-dashboard');
  });

  document.getElementById('qty-modal-cancel').addEventListener('click', closeQtyModal);
  document.getElementById('qty-modal-confirm').addEventListener('click', confirmQtyModal);

  document.getElementById('export-btn').addEventListener('click', exportBackup);
  document.getElementById('import-input').addEventListener('change', e => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
  });

  document.getElementById('onboarding-save-btn').addEventListener('click', () => {
    saveSettingsForm('ob');
    showScreen('screen-dashboard');
  });

  if (!state.profile.setupComplete) {
    showScreen('screen-onboarding');
  } else {
    showScreen('screen-dashboard');
  }
  renderRecentMeals();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
