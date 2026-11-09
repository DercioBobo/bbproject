/* BB Projectos — custos e receitas, projecto a projecto.
   Os dados são um único documento JSON guardado pelo api.php, com cópia offline no localStorage. */
'use strict';

/* ======================================================================
   Utilitários
   ====================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const sum = (arr, fn = x => x) => round2(arr.reduce((s, x) => s + fn(x), 0));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ymNow = () => todayISO().slice(0, 7);
const ymOf = iso => iso.slice(0, 7);
const ymAdd = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const ymShort = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`; };
const isoToDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const dateToISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayDiff = (a, b) => Math.round((isoToDate(a) - isoToDate(b)) / 86400000);
const dateShort = iso => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; };
const dateLong = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${y}`; };

/** Separador de milhares em PT-MZ: espaço (o Intl em pt-MZ não agrupa números de 4 dígitos). */
const groupInt = s => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function fmtNumber(n) {
  const d = S.data?.settings.decimals ?? 2;
  const [int, dec] = Math.abs(n).toFixed(d).split('.');
  return groupInt(int) + (dec ? `,${dec}` : '');
}

/** "1 250,00 MT". sign: mostra + também nos valores positivos. */
function money(n, sign = false) {
  const v = round2(n);
  const pre = v < 0 ? '−' : (sign && v > 0 ? '+' : '');
  return `${pre}${fmtNumber(v)} ${S.data?.settings.currency || 'MT'}`;
}

function moneyBig(n) {
  const v = round2(n);
  const [int, dec] = fmtNumber(v).split(',');
  return `${v < 0 ? '−' : ''}${int}${dec ? `<span class="dec">,${dec}</span>` : ''}<span class="cur">${esc(S.data.settings.currency)}</span>`;
}

const compact = n => new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Aceita "1500", "1 500,50", "1,500.50", "1.500,50" e "1.500" (milhares com ponto). */
function parseAmount(raw) {
  let s = String(raw).replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/,(?=.*,)/g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? round2(Math.abs(n)) : NaN;
}

/** Valor para pôr num campo de edição: "1250,5". */
const inputNum = v => (Number(v) ? String(round2(v)).replace('.', ',') : '');

const P = {
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 7a3.5 3.5 0 0 0 6 0Z"/><path d="m19 7-3 7a3.5 3.5 0 0 0 6 0Z"/>',
};

const ic = (name, size = 20) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b'];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

/* ======================================================================
   Estado e modelo de dados
   ====================================================================== */

const S = {
  data: null,
  rev: 0,
  pid: null,      // projecto aberto; null = página inicial
  view: 'home',
  filter: 'all',
  search: '',
  dirty: false,
  saving: false,
  syncing: false,
  offline: false,
  push: 'unknown', // lembretes neste dispositivo: unknown | on | off | denied | unsupported
  seq: 0,
  undo: null,
  charts: [],
  sel: null,      // Set de movimentos escolhidos para somar; null = sem selecção
  selKey: '',
  calc: '',       // expressão da calculadora, mantida entre aberturas
  calcPrev: '',   // a expressão acabada de resolver com "="
};

const CACHE_KEY = 'bbproject.cache';

/** Tipos de projecto: só definem as categorias iniciais e a sugestão de receitas. */
const KINDS = {
  agro: {
    label: 'Agricultura', placeholder: 'Ex.: Machamba de milho 2026', earnings: true,
    expense: ['Sementes e mudas', 'Tractor e lavoura', 'Sacha (pessoas)', 'Rega (pessoas)', 'Colheita (pessoas)', 'Água', 'Diesel e combustível', 'Adubos e pesticidas', 'Transporte', 'Sacos e embalagem', 'Outras despesas'],
    income: ['Venda da colheita', 'Outras receitas'],
  },
  obra: {
    label: 'Construção', placeholder: 'Ex.: Casa em Marracuene', earnings: false,
    expense: ['Terreno e licenças', 'Projecto e fiscalização', 'Cimento e blocos', 'Areia, brita e pedra', 'Ferro e varões', 'Madeira e cobertura', 'Canalização', 'Electricidade', 'Portas e janelas', 'Pintura e acabamentos', 'Mão-de-obra', 'Transporte', 'Outras despesas'],
    income: ['Outras receitas'],
  },
  outro: {
    label: 'Outro', placeholder: 'Ex.: Festa de casamento', earnings: false,
    expense: ['Materiais', 'Mão-de-obra', 'Serviços', 'Transporte', 'Outras despesas'],
    income: ['Vendas', 'Outras receitas'],
  },
};

const newCategories = kind => {
  const k = KINDS[kind] || KINDS.outro;
  const make = (names, type, shift) => names.map((name, i) => ({ id: uid() + i + type[0], name, type, color: COLORS[(i * 4 + shift) % COLORS.length], budget: 0 }));
  return [...make(k.expense, 'expense', 0), ...make(k.income, 'income', 4)];
};

function defaultData() {
  return {
    version: 1,
    settings: { currency: 'MT', decimals: 2, theme: 'auto', remindHour: 8, remindDayBefore: false },
    projects: [],
  };
}

/** Preenche o que faltar, para que ficheiros antigos ou importados funcionem sempre. */
function normalize(d) {
  const base = defaultData();
  d = d && typeof d === 'object' ? d : {};
  return {
    version: 1,
    settings: { ...base.settings, ...(d.settings || {}) },
    projects: (Array.isArray(d.projects) ? d.projects : []).map(p => ({
      kind: 'outro', color: COLORS[7], status: 'open', closedAt: null, start: todayISO(),
      estCost: 0, earnings: false, estEarnings: 0, earnDate: null, created: 0, ...p,
      categories: Array.isArray(p.categories) ? p.categories : [],
      entries: Array.isArray(p.entries) ? p.entries : [],
      notes: (Array.isArray(p.notes) ? p.notes : []).map(n => ({ text: '', remind: null, done: false, ...n })),
    })),
  };
}

/** O projecto aberto. */
const cur = () => S.data.projects.find(p => p.id === S.pid);
/** O projecto aberto, dentro do documento que está a ser alterado. */
const proj = d => d.projects.find(p => p.id === S.pid);
const isClosed = p => p.status === 'closed';
/** Um projecto "com receitas": configurado assim, ou porque já tem alguma registada. */
const hasEarn = p => !!p.earnings || p.entries.some(e => e.type === 'income');

/** Até duas iniciais: "Mão-de-obra" → "MO", "Sementes e mudas" → "SM". */
function initials(name) {
  const words = String(name).match(/[\p{L}\p{N}]+/gu) || ['?'];
  const main = words.filter(w => w.length > 2);
  return (main.length ? main : words).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
const glyph = c => `<b class="ini">${esc(initials(c.name))}</b>`;

const UNCATEGORIZED = { id: '', name: 'Sem categoria', color: '#94a3b8', type: 'expense', budget: 0 };
const cat = (id, p = cur()) => p.categories.find(c => c.id === id) || UNCATEGORIZED;
const catsOf = (type, p = cur()) => p.categories.filter(c => c.type === type);
/** A categoria inicial de um movimento novo: nas receitas a principal (ex.: Venda da colheita), nas despesas "Outras…". */
const otherCat = (type, p = cur()) => {
  const list = catsOf(type, p);
  if (type === 'income') return list[0]?.id || '';
  return (list.find(c => /^outr/i.test(c.name)) || list[list.length - 1])?.id || '';
};
/** Quadrado da categoria; com type acrescenta um pequeno ↓ receita / ↑ despesa no canto. */
const catIcon = (c, cls = '', type = '') => `<span class="cat-ic ${cls}" style="--c:${esc(c.color)}"${type ? ` data-t="${type}"` : ''}>${glyph(c)}</span>`;
const signed = e => (e.type === 'income' ? e.amount : -e.amount);

/**
 * As contas de um projecto. Pago/recebido é o que aconteceu; por pagar/receber é o que está previsto.
 * Num projecto encerrado os previstos que sobraram já não contam.
 */
function totals(p) {
  const today = todayISO();
  const closed = isClosed(p);
  const paid = p.entries.filter(e => e.paid);
  const open = closed ? [] : p.entries.filter(e => !e.paid);
  const byType = (list, type) => sum(list.filter(e => e.type === type), e => e.amount);
  const spent = byType(paid, 'expense');
  const received = byType(paid, 'income');
  const toPay = byType(open, 'expense');
  const toReceive = byType(open, 'income');
  const committed = round2(spent + toPay);
  const estCost = Number(p.estCost) || 0;
  const estIn = Number(p.estEarnings) || 0;
  const expectedCost = Math.max(committed, estCost);
  const expectedIn = Math.max(round2(received + toReceive), estIn);
  return {
    spent, received, toPay, toReceive, committed, estCost, estIn, expectedCost, expectedIn,
    open, overdue: open.filter(e => e.date < today).length,
    leftovers: closed ? p.entries.filter(e => !e.paid) : [],
    result: round2(received - spent),
    expectedResult: round2(expectedIn - expectedCost),
    margin: received > 0 ? Math.round(((received - spent) / received) * 100) : null,
  };
}

/** Texto do resultado: lucro, prejuízo ou empate. */
const resultWord = v => (v > 0 ? 'Lucro' : v < 0 ? 'Prejuízo' : 'Sem lucro nem prejuízo');

/* ======================================================================
   Armazenamento e sincronização
   ====================================================================== */

async function api(action, body) {
  const opts = { method: body ? 'POST' : 'GET', headers: { 'X-BBProject': '1' }, credentials: 'same-origin', cache: 'no-store' };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`api.php?action=${action}`, opts);
  let json = {};
  try { json = await res.json(); } catch (e) { /* página de erro sem JSON */ }
  if (!res.ok) {
    const err = new Error(json.error || `Erro no servidor (${res.status})`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
}

function writeCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rev: S.rev, dirty: S.dirty, data: S.data })); } catch (e) { /* armazenamento cheio ou bloqueado */ }
}

let saveTimer = null;

function persist() {
  S.dirty = true;
  S.seq++;
  writeCache();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
  updateSync();
}

async function flush() {
  if (!S.dirty || S.saving) return;
  S.saving = true;
  const seq = S.seq;
  updateSync();
  try {
    const res = await api('save', { rev: S.rev, data: S.data });
    S.rev = res.rev;
    S.offline = false;
    if (S.seq === seq) S.dirty = false;
    writeCache();
  } catch (e) {
    if (e.status === 409) {
      S.data = normalize(e.body.data);
      S.rev = e.body.rev;
      S.dirty = false;
      writeCache();
      render();
      toast('Alterado noutro dispositivo — carregada a versão mais recente.');
    } else if (e.status === 401) {
      showAuth('login');
    } else {
      S.offline = true;
    }
  } finally {
    S.saving = false;
    updateSync();
    if (S.dirty && !S.offline) flush();
  }
}

/** Traz alterações feitas noutro dispositivo (ex.: telemóvel → computador). */
async function refresh() {
  if (!S.data || S.dirty || S.saving || !$('#sheet').hidden) return;
  try {
    const res = await api('load');
    S.offline = false;
    if (res.rev !== S.rev && res.data) {
      S.data = normalize(res.data);
      S.rev = res.rev;
      writeCache();
      render();
    }
  } catch (e) {
    if (e.status === 401) showAuth('login'); else S.offline = true;
  }
  updateSync();
}

/* ---------- lembretes de pagamento (Web Push, enviados pelo cron-reminders.php) ---------- */

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;

/** Verifica se este dispositivo está subscrito; volta a desenhar as Definições se mudou. */
async function checkPush() {
  let state = 'unsupported';
  if (pushSupported()) {
    if (Notification.permission === 'denied') state = 'denied';
    else {
      const reg = await navigator.serviceWorker.getRegistration();
      state = reg && await reg.pushManager.getSubscription() ? 'on' : 'off';
    }
  }
  if (state !== S.push) {
    S.push = state;
    if (S.view === 'settings' && $('#sheet').hidden) render();
  }
}

const b64urlBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function pushOn() {
  try {
    // Tem de ser pedido logo no toque (o iOS exige).
    if (await Notification.requestPermission() !== 'granted') {
      S.push = 'denied';
      render();
      return toast('As notificações estão bloqueadas para esta aplicação');
    }
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api('push-key');
    const serverKey = b64urlBytes(key);
    let sub = await reg.pushManager.getSubscription();
    const sameKey = sub?.options.applicationServerKey &&
      new Uint8Array(sub.options.applicationServerKey).every((b, i) => b === serverKey[i]);
    if (sub && !sameKey) { await sub.unsubscribe(); sub = null; }
    sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
    await api('push-subscribe', { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    S.push = 'on';
    render();
    toast('Lembretes activos neste dispositivo');
  } catch (e) {
    toast(e.status === 401 ? 'Inicie sessão novamente' : `Não foi possível activar os lembretes${e.message ? ` — ${e.message}` : ''}`);
  }
}

async function pushOff() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('push-unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    S.push = 'off';
    render();
    toast('Lembretes desactivados neste dispositivo');
  } catch (e) {
    toast('Não foi possível desactivar os lembretes');
  }
}

async function pushTest() {
  try {
    const { sent } = await api('push-test', {});
    toast(sent ? `Teste enviado para ${plural(sent, 'dispositivo', 'dispositivos')}` : 'Nenhum dispositivo recebeu — active novamente os lembretes');
  } catch (e) {
    toast(e.message || 'Não foi possível enviar o teste');
  }
}

function remindersCard() {
  const st = S.data.settings;
  const hours = Array.from({ length: 17 }, (_, i) => i + 5)
    .map(h => `<option value="${h}" ${Number(st.remindHour ?? 8) === h ? 'selected' : ''}>${pad(h)}:00</option>`).join('');
  const status = {
    unknown: '<span class="hint">A verificar…</span>',
    on: '<span class="tag green">Activo neste dispositivo</span>',
    off: '<span class="tag">Desactivado neste dispositivo</span>',
    denied: '<span class="tag red">Bloqueado</span>',
    unsupported: '<span class="tag">Indisponível aqui</span>',
  }[S.push];
  let action = '';
  if (S.push === 'off') action = `<button class="btn btn-primary" data-action="push-on">${ic('bell', 18)} Activar lembretes</button>`;
  if (S.push === 'on') action = `<button class="btn" data-action="push-test">${ic('bell', 18)} Enviar teste</button><button class="btn btn-ghost" data-action="push-off">Desactivar</button>`;
  let note = 'Uma notificação nos dias em que há pagamentos previstos, com o projecto, o quê e quanto.';
  if (S.push === 'denied') note = 'As notificações estão bloqueadas para esta aplicação. Permita-as nas definições do telemóvel ou do navegador e volte aqui.';
  if (S.push === 'unsupported') note = isIOS()
    ? 'No iPhone, adicione primeiro o BB Projectos ao ecrã principal (Partilhar → Adicionar ao ecrã principal) e abra-o a partir daí. Requer iOS 16.4 ou mais recente.'
    : 'Este navegador não recebe notificações. Abra o BB Projectos em https no Chrome, Edge, Firefox ou Safari.';
  return `
      <section class="card">
        <header class="card-head"><h2>Lembretes de pagamento</h2>${status}</header>
        <p class="hint" style="margin-bottom:12px">${note}</p>
        ${action ? `<div class="btn-row" style="margin-bottom:8px">${action}</div>` : ''}
        <div class="set-row"><span class="lbl">Lembrar às<small>A mesma hora em todos os dispositivos</small></span><select data-setting="remindHour">${hours}</select></div>
        <div class="set-row"><span class="lbl">Também na véspera<small>Aviso dos pagamentos de amanhã</small></span>
          <select data-setting="remindDayBefore"><option value="" ${st.remindDayBefore ? '' : 'selected'}>Não</option><option value="1" ${st.remindDayBefore ? 'selected' : ''}>Sim</option></select></div>
      </section>`;
}

/** Sincronização completa: envia o que está pendente e volta sempre a carregar a cópia do servidor. */
async function syncNow() {
  if (!S.data || S.syncing) return;
  S.syncing = true;
  S.offline = false;
  clearTimeout(saveTimer);
  updateSync();
  try {
    while (S.saving) await new Promise(r => setTimeout(r, 100));
    await flush();
    if (S.dirty) {
      toast(S.offline ? 'Sem ligação — as alterações sincronizam quando voltar' : 'Não foi possível sincronizar, tente novamente');
      return;
    }
    const res = await api('load');
    S.offline = false;
    // Se houve uma edição durante o carregamento, ela guarda-se sozinha.
    if (res.data && !S.dirty) {
      const changed = res.rev !== S.rev;
      S.data = normalize(res.data);
      S.rev = res.rev;
      writeCache();
      if ($('#sheet').hidden) render();
      toast(changed ? 'Sincronizado — carregadas as últimas alterações' : 'Tudo actualizado');
    }
  } catch (e) {
    if (e.status === 401) showAuth('login');
    else { S.offline = true; toast('Sem ligação — a mostrar a cópia guardada'); }
  } finally {
    S.syncing = false;
    updateSync();
  }
}

/** Vai buscar os ficheiros mais recentes da aplicação, sem cache, e recarrega. Os dados mantêm-se. */
async function forceUpdate() {
  if (S.syncing) return;
  toast('A actualizar…');
  if (S.data && S.dirty) await syncNow();
  if (S.offline) return toast('Sem ligação — ligue-se para actualizar a aplicação');
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if ('caches' in window) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    await Promise.all(['./', 'index.html', 'css/style.css', 'js/app.js', 'sw.js'].map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
  } catch (e) { /* recarrega na mesma */ }
  location.reload();
}

function updateSync() {
  const text = S.syncing ? 'A sincronizar…' : S.saving ? 'A guardar…' : S.offline ? (S.dirty ? 'Sem ligação · por sincronizar' : 'Sem ligação') : S.dirty ? 'A guardar…' : 'Tudo guardado';
  const cls = S.syncing || S.saving || (S.dirty && !S.offline) ? 'saving' : S.offline ? 'offline' : '';
  $$('.sync').forEach(el => { el.className = `sync ${cls}`; el.textContent = text; });
}

/** Faz uma alteração, guarda, volta a desenhar e oferece Anular. */
function mutate(fn, message) {
  const before = JSON.stringify(S.data);
  fn(S.data);
  persist();
  render();
  if (message) {
    toast(message, () => {
      S.data = JSON.parse(before);
      persist();
      render();
    });
  }
}

/* ======================================================================
   Estrutura e desenho
   ====================================================================== */

const VIEWS = {
  resumo: { label: 'Resumo', icon: 'home' },
  movimentos: { label: 'Movimentos', icon: 'list' },
  notas: { label: 'Notas', icon: 'note' },
  balanco: { label: 'Balanço', icon: 'scale' },
};
const TITLES = { home: 'Projectos', settings: 'Definições', resumo: 'Resumo', movimentos: 'Movimentos', notas: 'Notas', balanco: 'Balanço' };

function renderShell() {
  $('#app').innerHTML = `
    <div class="ptr" id="ptr" aria-hidden="true">${ic('refresh')}</div>
    <aside class="sidebar">
      <div class="brand"><img src="icon.svg" alt=""><div><b>BB Projectos</b><small>Custos e receitas</small></div></div>
      <div id="side-project" class="side-project"></div>
      <nav class="nav" id="nav"></nav>
      <div class="sidebar-foot">
        <button class="btn btn-sm" id="install-side" data-action="install" ${canInstall() ? '' : 'hidden'}>${ic('download', 16)} Instalar aplicação</button>
        <span class="sync"></span>
        <span class="kbd-hint"><kbd>N</kbd> novo movimento · <kbd>C</kbd> calculadora</span>
      </div>
    </aside>
    <div class="content">
      <header class="topbar">
        <div class="brand-mini" id="top-left"></div>
        <h1 id="title-desk" class="desk-title"></h1>
        <div class="top-actions">
          <button class="icon-btn" data-action="calc" aria-label="Calculadora" title="Calculadora (C)">${ic('calc', 22)}</button>
          <button class="icon-btn mobile-only" data-action="go" data-view="settings" aria-label="Definições">${ic('settings', 22)}</button>
        </div>
      </header>
      <main id="main"></main>
    </div>
    <div class="selbar" id="selbar" role="status" aria-live="polite" hidden></div>
    <nav class="tabbar" id="tabbar"></nav>`;
}

/** Barra lateral, título e separadores: mudam consoante há ou não um projecto aberto. */
function renderChrome(p) {
  const navItem = (view, label, icon) => `<button class="nav-item ${S.view === view ? 'active' : ''}" data-action="go" data-view="${view}">${ic(icon)}<span>${label}</span></button>`;
  const dueDot = p && notesDue(p) > 0;
  const projectNav = Object.entries(VIEWS).map(([k, v]) => navItem(k, v.label, v.icon)).join('');
  $('#nav').innerHTML = (p ? projectNav : navItem('home', 'Projectos', 'folder')) + navItem('settings', 'Definições', 'settings');

  $('#side-project').innerHTML = p ? `
    <button class="link sm side-back" data-action="home">${ic('left', 16)} Todos os projectos</button>
    <div class="side-name" style="--c:${esc(p.color)}"><b>${esc(p.name)}</b><small>${esc(KINDS[p.kind]?.label || '')}${isClosed(p) ? ' · Encerrado' : ''}</small></div>
    ${isClosed(p) ? '' : `<button class="btn btn-primary btn-lg btn-block" data-action="add">${ic('plus')} Novo movimento</button>`}`
    : `<button class="btn btn-primary btn-lg btn-block" data-action="new-project">${ic('plus')} Novo projecto</button>`;

  const inner = S.view === 'settings' || p;
  $('#top-left').innerHTML = inner
    ? `<button class="icon-btn back" data-action="up" aria-label="Voltar">${ic('left', 22)}</button>
       <div class="titles"><h1 class="top-title">${esc(S.view === 'settings' ? 'Definições' : p.name)}</h1>${S.view === 'settings' ? '' : `<small>${TITLES[S.view]}${isClosed(p) ? ' · Encerrado' : ''}</small>`}</div>`
    : `<img src="icon.svg" alt=""><h1>BB Projectos</h1>`;
  $('#title-desk').textContent = TITLES[S.view];

  const tabbar = $('#tabbar');
  tabbar.hidden = !p;
  if (p) {
    const tab = k => `<button class="tab ${S.view === k ? 'active' : ''} ${k === 'notas' && dueDot ? 'has-dot' : ''}" data-action="go" data-view="${k}">${ic(VIEWS[k].icon, 22)}<span>${VIEWS[k].label}</span></button>`;
    tabbar.innerHTML = `${tab('resumo')}${tab('movimentos')}
      <div class="fab-wrap">${isClosed(p) ? '' : `<button class="fab" data-action="add" aria-label="Novo movimento">${ic('plus', 26)}</button>`}</div>
      ${tab('notas')}${tab('balanco')}`;
  }
}

function render() {
  if (!S.data) return;
  // O projecto pode ter desaparecido (anular, restauro, outro dispositivo).
  if (S.pid && !cur()) { S.pid = null; S.view = S.view === 'settings' ? 'settings' : 'home'; }
  applyTheme();
  destroyCharts();
  const p = S.pid ? cur() : null;
  renderChrome(p);

  // Uma selecção pertence a um ecrã de um projecto: ao sair, limpa-se.
  const key = `${S.pid}/${S.view}`;
  if (S.selKey !== key) { S.sel = null; S.selKey = key; }
  if (S.sel) { const pool = selPool(); for (const id of S.sel) if (!pool.has(id)) S.sel.delete(id); }

  $('#main').innerHTML = { home: viewHome, resumo: viewResumo, movimentos: viewMovimentos, notas: viewNotas, balanco: viewBalanco, settings: viewSettings }[S.view]();
  if (S.view === 'balanco') drawCharts();
  updateSync();
  updateSelBar();
  syncBack();
}

/** Tudo o que altera um projecto encerrado passa por aqui. */
function blockedIfClosed() {
  if (!isClosed(cur())) return false;
  toast('Projecto encerrado — reabra-o para alterar');
  return true;
}

/* ---------- Página inicial: escolher o projecto ---------- */

function projectCard(p) {
  const t = totals(p);
  const closed = isClosed(p);
  const earn = hasEarn(p);
  const scale = Math.max(t.estCost, t.committed) || 1;
  const bar = t.estCost
    ? `<span class="bar"><span class="spent" style="width:${(t.spent / scale) * 100}%"></span><span class="planned" style="width:${(t.toPay / scale) * 100}%"></span></span>` : '';
  const over = t.estCost && t.committed > t.estCost;
  const estLine = t.estCost ? `de ${money(t.estCost)} estimados` : 'Sem custo estimado';
  let earnLine = '';
  if (closed && earn) earnLine = `${resultWord(t.result)}${t.result ? ` <b>${money(Math.abs(t.result))}</b>` : ''}`;
  else if (earn) earnLine = t.received ? `Recebido <b>${money(t.received)}</b>` : 'Receitas ainda por vir';
  const tags = [
    `<span class="tag">${esc(KINDS[p.kind]?.label || 'Outro')}</span>`,
    t.overdue ? `<span class="tag red">${t.overdue} em atraso</span>` : '',
    over && !closed ? '<span class="tag red">Acima do estimado</span>' : '',
  ].join('');
  return `
    <button class="proj-card ${closed ? 'closed' : ''}" data-action="open-project" data-id="${esc(p.id)}" style="--c:${esc(p.color)}">
      <span class="proj-top"><span class="proj-name">${esc(p.name)}</span>${ic('right', 18)}</span>
      <span class="proj-tags">${tags}</span>
      <span class="proj-amt num">${money(t.spent)}<small>${closed ? 'custo final' : 'gasto até agora'}</small></span>
      ${bar}
      <span class="proj-foot"><span>${estLine}</span>${earnLine ? `<span>${earnLine}</span>` : ''}</span>
    </button>`;
}

function viewHome() {
  const byNewest = (a, b) => (b.created || 0) - (a.created || 0);
  const open = S.data.projects.filter(p => !isClosed(p)).sort(byNewest);
  const closed = S.data.projects.filter(isClosed).sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''));
  return `
    <div class="stack">
      ${installBanner()}
      <div class="home-head">
        <div><h2>Escolha um projecto</h2><span class="hint">${open.length ? plural(open.length, 'projecto em curso', 'projectos em curso') : 'Ainda não há projectos em curso'}</span></div>
        <button class="btn btn-primary mobile-only" data-action="new-project">${ic('plus', 18)} Novo</button>
      </div>
      ${open.length ? `<div class="proj-grid">${open.map(projectCard).join('')}</div>` : `
        <section class="card"><div class="empty">
          Cada projecto tem as suas despesas e, se quiser, as suas receitas — uma machamba, a construção de uma casa, um evento.<br><br>
          <button class="btn btn-primary" data-action="new-project">${ic('plus', 18)} Criar o primeiro projecto</button>
        </div></section>`}
      ${closed.length ? `
        <section class="card">
          <details class="archived">
            <summary><h2>Projectos encerrados</h2><span class="pill">${closed.length}</span></summary>
            <div class="proj-grid">${closed.map(projectCard).join('')}</div>
          </details>
        </section>` : ''}
    </div>`;
}

/* ---------- Resumo ---------- */

function heroClosed(p, t) {
  const earn = hasEarn(p);
  const days = dayDiff(p.closedAt, p.start);
  const foot = `Encerrado a <b>${dateLong(p.closedAt)}</b>${days > 0 ? ` · ${plural(days, 'dia', 'dias')} de projecto` : ''}`;
  if (earn) {
    return `
    <section class="card hero o1">
      <div class="hero-top"><span class="hero-label">${resultWord(t.result)}</span><span class="hero-open">Resultado final</span></div>
      <div class="hero-amount">${moneyBig(Math.abs(t.result))}</div>
      <div class="hero-legend">
        <div><small>Custos</small><b>${money(t.spent)}</b></div>
        <div><small>Receitas</small><b>${money(t.received)}</b></div>
        <div class="${t.result < 0 ? 'short' : ''}"><small>Margem</small><b>${t.margin === null ? '—' : `${t.margin}%`}</b></div>
      </div>
      <div class="hero-foot">${foot}</div>
    </section>`;
  }
  const diff = round2(t.spent - t.estCost);
  return `
    <section class="card hero o1">
      <div class="hero-top"><span class="hero-label">Custo final</span><span class="hero-open">Projecto encerrado</span></div>
      <div class="hero-amount">${moneyBig(t.spent)}</div>
      ${t.estCost ? `<div class="hero-legend">
        <div><small>Estimado</small><b>${money(t.estCost)}</b></div>
        <div class="${diff > 0 ? 'short' : ''}"><small>${diff > 0 ? 'Acima' : 'Poupado'}</small><b>${money(Math.abs(diff))}</b></div>
      </div>` : ''}
      <div class="hero-foot">${foot}</div>
    </section>`;
}

function heroCard(p, t) {
  if (isClosed(p)) return heroClosed(p, t);
  const est = t.estCost;
  const over = est && t.committed > est;
  const left = round2(est - t.committed);
  const scale = Math.max(est, t.committed) || 1;
  const w = v => `${Math.max(0, (v / scale) * 100)}%`;
  let line = 'Sem custo estimado — o total vai crescendo com os movimentos';
  if (est) line = over ? `Com o que falta pagar, fica <b>${money(-left)}</b> acima do estimado` : `<b>${Math.round((t.spent / est) * 100)}%</b> do custo estimado de ${money(est)}`;

  let foot = '';
  if (hasEarn(p)) {
    const parts = [];
    if (t.received) parts.push(`Recebido <b>${money(t.received)}</b>`);
    else parts.push(`Receitas ainda por vir${p.earnDate ? `, esperadas em ${ymLabel(p.earnDate)}` : ''}`);
    if (t.expectedIn) parts.push(`${t.expectedResult >= 0 ? 'Lucro' : 'Prejuízo'} previsto <b>${money(Math.abs(t.expectedResult))}</b>`);
    foot = `<div class="hero-foot">${parts.join(' · ')}</div>`;
  }
  return `
    <section class="card hero o1">
      <div class="hero-top"><span class="hero-label">Gasto até agora</span><span class="hero-open">${t.toPay ? `${money(t.toPay)} por pagar` : ''}</span></div>
      <div class="hero-amount">${moneyBig(t.spent)}</div>
      <div class="hero-proj">${line}</div>
      ${est || t.committed ? `<div class="hero-bar split ${est ? '' : 'noleft'}" role="img" aria-label="Pago ${money(t.spent)}, por pagar ${money(t.toPay)}">
        <span class="spent" style="width:${w(t.spent)}"></span><span class="topay" style="width:${w(t.toPay)}"></span>
      </div>` : ''}
      <div class="hero-legend">
        <div><small><i class="spent"></i>Pago</small><b>${money(t.spent)}</b></div>
        <div><small><i class="topay"></i>Por pagar</small><b>${money(t.toPay)}</b></div>
        ${est
          ? `<div class="${over ? 'short' : ''}"><small><i class="left"></i>${over ? 'Acima' : 'Margem'}</small><b>${money(Math.abs(left))}</b></div>`
          : `<div><small>Total</small><b>${money(t.committed)}</b></div>`}
      </div>
      ${foot}
    </section>`;
}

/** Uma linha de movimento. Os previstos têm o visto para os marcar como pagos. */
function entryRow(e, p) {
  const c = cat(e.category, p);
  const closed = isClosed(p);
  const today = todayISO();
  const label = esc(e.note || c.name);
  let tag = '';
  if (!e.paid) {
    if (closed) tag = '<span class="tag">Não realizado</span>';
    else if (e.date < today) tag = '<span class="tag red">Em atraso</span>';
    else if (e.date === today) tag = '<span class="tag green">Hoje</span>';
    else tag = '<span class="tag">Previsto</span>';
  }
  const amount = e.amount > 0 ? `<span class="amt ${e.type}">${money(signed(e), true)}</span>` : '<span class="amt zero">Sem valor</span>';
  return `
    <li class="row${selClass(e.id)}" data-sel="${esc(e.id)}">
      ${!e.paid && !closed ? `<button class="check ${e.type}" data-action="quickpay" data-id="${esc(e.id)}" aria-label="Marcar ${label} como ${e.type === 'income' ? 'recebido' : 'pago'}">${ic('check', 15)}</button>` : ''}
      <button class="row-btn" data-action="edit-tx" data-id="${esc(e.id)}">
        ${catIcon(c, '', e.type)}
        <span class="row-text">
          <span class="row-title">${label}</span>
          <span class="row-sub">${dateShort(e.date)}${e.note ? ` · ${esc(c.name)}` : ''} ${tag}</span>
        </span>
        ${amount}
      </button>
    </li>`;
}

const PENDING_SHOWN = 6;

function pendingCard(p, t) {
  if (!t.open.length) return '';
  const byDate = (a, b) => a.date.localeCompare(b.date) || b.amount - a.amount;
  const groups = [
    { key: 'income', title: 'Por receber', icon: 'down', items: t.open.filter(e => e.type === 'income').sort(byDate) },
    { key: 'other', title: 'Por pagar', icon: 'up', items: t.open.filter(e => e.type === 'expense').sort(byDate) },
  ].filter(g => g.items.length);
  const hidden = groups.reduce((n, g) => n + Math.max(0, g.items.length - PENDING_SHOWN), 0);
  const body = groups.map(g => `
      <div class="pgroup ${g.key}">
        <div class="pgroup-head">
          <span class="pgroup-ic">${ic(g.icon, 14)}</span>
          <span class="pgroup-title">${g.title} <span class="pgroup-count">${g.items.length}</span></span>
          <span class="pgroup-total num">${g.key === 'income' ? '+' : '−'}${fmtNumber(sum(g.items, e => e.amount))}</span>
        </div>
        <ul class="list">${g.items.slice(0, PENDING_SHOWN).map(e => entryRow(e, p)).join('')}</ul>
      </div>`).join('');
  return `
    <section class="card o2">
      <header class="card-head"><h2>Previsto</h2><span class="head-end">${selBtn()}<span class="pill ${t.overdue ? 'warn' : ''}">${t.open.length}</span></span></header>
      ${body}
      ${hidden ? `<div class="pgroup-foot"><button class="link sm" data-action="see-planned">Ver os ${t.open.length} previstos →</button></div>` : ''}
    </section>`;
}

/** Por categoria: quanto já foi, quanto falta e, se houver, o valor estimado. Tocar numa categoria edita-a. */
function categoryCard(p, type, order) {
  const closed = isClosed(p);
  const entries = p.entries.filter(e => e.type === type && (e.paid || !closed));
  const rowsData = catsOf(type, p).map(c => {
    const mine = entries.filter(e => e.category === c.id);
    return { c, done: sum(mine.filter(e => e.paid), e => e.amount), planned: sum(mine.filter(e => !e.paid), e => e.amount), est: Number(c.budget) || 0 };
  });
  // Movimentos cuja categoria foi eliminada continuam a contar.
  const orphans = entries.filter(e => !p.categories.some(c => c.id === e.category));
  if (orphans.length) rowsData.push({ c: UNCATEGORIZED, done: sum(orphans.filter(e => e.paid), e => e.amount), planned: sum(orphans.filter(e => !e.paid), e => e.amount), est: 0 });

  const row = ({ c, done, planned, est }) => {
    const total = round2(done + planned);
    const scale = Math.max(est, total) || 1;
    const over = est && total > est;
    const sub = est ? `${fmtNumber(total)} de ${fmtNumber(est)} estimados` : (planned ? `${fmtNumber(planned)} ${type === 'income' ? 'por receber' : 'por pagar'}` : '');
    return `
      <div class="budget ${over ? 'over' : ''}">
        <button class="row-btn budget-top" ${c.id ? `data-action="edit-cat" data-id="${esc(c.id)}"` : 'disabled'}>
          ${catIcon(c, 'sm')}
          <span class="row-text"><span class="row-title">${esc(c.name)}</span>${sub ? `<span class="row-sub num">${sub}</span>` : ''}</span>
          <span class="amt ${total ? '' : 'zero'}">${total || est ? money(total) : '—'}${over ? `<small>${money(total - est)} acima</small>` : ''}</span>
        </button>
        ${est ? `<div class="bar"><span class="spent" style="width:${(done / scale) * 100}%"></span><span class="planned" style="width:${(planned / scale) * 100}%"></span></div>` : ''}
      </div>`;
  };

  const used = rowsData.filter(r => r.done || r.planned || r.est).sort((a, b) => (b.done + b.planned) - (a.done + a.planned));
  const unused = rowsData.filter(r => !(r.done || r.planned || r.est));
  const title = type === 'income' ? 'Receitas por categoria' : 'Despesas por categoria';
  return `
    <section class="card ${order}">
      <header class="card-head"><div><h2>${title}</h2><span class="sub num">${money(sum(rowsData, r => r.done + r.planned))}</span></div>
        ${closed ? '' : `<button class="btn btn-sm" data-action="new-cat" data-type="${type}">${ic('plus', 16)} Categoria</button>`}</header>
      ${used.length ? used.map(row).join('') : '<div class="empty small">Ainda sem valores.</div>'}
      ${unused.length && !closed ? `<details class="archived more-cats"><summary><span class="link sm">Categorias sem movimentos</span><span class="pill">${unused.length}</span></summary>${unused.map(row).join('')}</details>` : ''}
    </section>`;
}

function viewResumo() {
  const p = cur();
  const t = totals(p);
  const first = !p.entries.length && !isClosed(p) ? `
    <section class="card o2"><div class="empty">
      Registe a primeira despesa, ou cole de uma vez a lista do que há para pagar.<br><br>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-primary" data-action="add">${ic('plus', 18)} Novo movimento</button>
        <button class="btn" data-action="list-paste">${ic('copy', 18)} Colar lista</button>
      </div>
    </div></section>` : '';
  return `
    <div class="grid-month">
      <div class="col">
        ${heroCard(p, t)}
        ${first}
        ${pendingCard(p, t)}
      </div>
      <div class="col">
        ${categoryCard(p, 'expense', 'o3')}
        ${hasEarn(p) ? categoryCard(p, 'income', 'o4') : ''}
      </div>
    </div>`;
}

/* ---------- Movimentos ---------- */

const entryPasses = e => S.filter === 'all' || (S.filter === 'planned' ? !e.paid : e.type === S.filter);

function txListInner(p) {
  const q = S.search.trim().toLowerCase();
  let list = p.entries.filter(entryPasses);
  if (q) list = list.filter(e => `${e.note || ''} ${cat(e.category, p).name} ${e.amount}`.toLowerCase().includes(q));
  if (!list.length) {
    return p.entries.length
      ? '<div class="empty small">Nada encontrado.</div>'
      : `<div class="empty">Ainda não há movimentos.${isClosed(p) ? '' : '<br><button class="link" data-action="add">+ Adicionar o primeiro</button>'}</div>`;
  }
  const months = new Map();
  for (const e of [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0))) {
    const k = ymOf(e.date);
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(e);
  }
  return [...months].map(([ym, items]) => `
      <div class="day-head"><span>${ymLabel(ym)}</span><span class="num">${money(sum(items, signed), true)}</span></div>
      <ul class="list">${items.map(e => entryRow(e, p)).join('')}</ul>`).join('');
}

function viewMovimentos() {
  const p = cur();
  const t = totals(p);
  const earn = hasEarn(p);
  const chip = (k, label) => `<button class="chip ${k} ${S.filter === k ? 'active' : ''}" data-action="filter" data-filter="${k}">${label}</button>`;
  const box = (cls, icon, label, value) => `<div class="inout-box ${cls}"><span class="inout-ic">${ic(icon, 14)}</span><span><small>${label}</small><b class="num">${fmtNumber(value)}</b></span></div>`;
  return `
    <section class="card">
      <header class="card-head"><h2>Movimentos</h2><span class="head-end"><span class="sub">${p.entries.length}</span>${p.entries.length ? selBtn() : ''}</span></header>
      <div class="inout">
        ${box('expense', 'up', 'Pago', t.spent)}
        ${earn ? box('income', 'down', 'Recebido', t.received) : box('expense', 'up', 'Por pagar', t.toPay)}
      </div>
      <div class="tx-tools">
        <div class="chips">${chip('all', 'Todos')}${chip('expense', 'Despesas')}${earn ? chip('income', 'Receitas') : ''}${chip('planned', 'Previstos')}</div>
        <label class="search">${ic('search', 16)}<input id="tx-search" type="search" placeholder="Procurar" value="${esc(S.search)}" aria-label="Procurar movimentos"></label>
      </div>
      <div id="tx-list">${txListInner(p)}</div>
    </section>`;
}

/* ---------- seleccionar movimentos para os somar ---------- */
// Toque longo numa linha (ou botão direito / Ctrl+clique no computador), ou "Seleccionar", e depois tocar nas linhas.

const selPool = () => new Map((S.pid && cur() ? cur().entries : []).map(e => [e.id, signed(e)]));
const selClass = id => (S.sel?.has(id) ? ' sel' : '');
const selBtn = () => `<button class="link sm" data-action="sel-start">${S.sel ? 'Concluir' : 'Seleccionar'}</button>`;

function selToggle(id) {
  S.sel = S.sel || new Set();
  if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id);
  updateSelBar();
}

function selEnd() {
  S.sel = null;
  updateSelBar();
}

/** Valores seleccionados; quando são todos despesas (ou todos receitas) somam como positivos. */
function selValues() {
  const pool = selPool();
  const vals = [...(S.sel || [])].map(id => pool.get(id)).filter(v => v != null);
  const mixed = vals.some(v => v > 0) && vals.some(v => v < 0);
  return { vals: mixed ? vals : vals.map(Math.abs), mixed };
}

function updateSelBar() {
  const bar = $('#selbar');
  if (!bar) return;
  $$('[data-sel]').forEach(el => el.classList.toggle('sel', !!S.sel?.has(el.dataset.sel)));
  $$('[data-action="sel-start"]').forEach(b => { b.textContent = S.sel ? 'Concluir' : 'Seleccionar'; });
  document.body.classList.toggle('selecting', !!S.sel);
  bar.hidden = !S.sel;
  if (!S.sel) return;
  const { vals, mixed } = selValues();
  const close = `<button class="icon-btn" data-action="sel-end" aria-label="Parar de seleccionar">${ic('x', 18)}</button>`;
  if (!vals.length) {
    bar.innerHTML = `<span class="selbar-text"><small>Seleccionar</small><b>Toque nos movimentos para somar</b></span>${close}`;
    return;
  }
  const inc = sum(vals.filter(v => v > 0));
  const out = sum(vals.filter(v => v < 0), v => -v);
  bar.innerHTML = `
    <span class="selbar-text">
      <small>${plural(vals.length, 'seleccionado', 'seleccionados')}${mixed ? ` · entra ${fmtNumber(inc)} · sai ${fmtNumber(out)}` : ''}</small>
      <b class="num">${money(sum(vals), mixed)}</b>
    </span>
    <button class="btn btn-sm" data-action="sel-calc">${ic('calc', 16)} Calc</button>
    ${close}`;
}

/* ---------- Notas ---------- */

const notesDue = p => p.notes.filter(n => !n.done && n.remind && n.remind <= todayISO()).length;

function remindTag(iso) {
  const diff = dayDiff(iso, todayISO());
  if (diff < 0) return `<span class="tag red">${ic('bell', 12)} Em atraso · ${dateShort(iso)}</span>`;
  if (diff === 0) return `<span class="tag red">${ic('bell', 12)} Hoje</span>`;
  return `<span class="tag">${ic('bell', 12)} ${diff === 1 ? 'Amanhã' : dateShort(iso)}</span>`;
}

function noteRow(n) {
  return `
    <div class="goal note ${n.done ? 'finished' : ''}">
      <div class="goal-top">
        <button class="row-btn" data-action="edit-note" data-id="${esc(n.id)}">
          <span class="row-text"><span class="row-title">${esc(n.title)}</span>${n.remind && !n.done ? `<span class="row-sub">${remindTag(n.remind)}</span>` : ''}</span>
        </button>
      </div>
      ${n.text ? `<p class="note-text">${esc(n.text)}</p>` : ''}
    </div>`;
}

function viewNotas() {
  const { notes } = cur();
  // Primeiro os lembretes (o mais próximo em cima), depois os mais recentes.
  const order = (a, b) => (a.remind || '9999').localeCompare(b.remind || '9999') || (b.created || 0) - (a.created || 0);
  const open = notes.filter(n => !n.done).sort(order);
  const done = notes.filter(n => n.done).sort((a, b) => (b.created || 0) - (a.created || 0));
  return `
    <div class="stack">
      <div class="btn-row"><button class="btn btn-primary" data-action="new-note">${ic('plus', 18)} Nova nota</button></div>
      <div class="grid-2">
        <section class="card">
          <header class="card-head"><h2>Notas</h2><span class="pill">${open.length}</span></header>
          ${open.length ? open.map(noteRow).join('') : '<div class="empty small">O que não pode esquecer neste projecto — um contacto, o que ficou combinado, a data de uma tarefa.<br><button class="link" data-action="new-note">+ Escrever uma nota</button></div>'}
        </section>
        ${done.length ? `<section class="card"><header class="card-head"><h2>Concluídas</h2><span class="pill">${done.length}</span></header>${done.map(noteRow).join('')}</section>` : ''}
      </div>
      <p class="hint">As notas não entram nas contas. Com uma data, o lembrete diário inclui-as.</p>
    </div>`;
}

/* ---------- Balanço: custos vs receitas ---------- */

/** Acumulado por mês, só com o que realmente aconteceu. */
function monthSeries(p) {
  const paid = p.entries.filter(e => e.paid && e.amount > 0);
  if (!paid.length) return [];
  const last = [...paid.map(e => ymOf(e.date)), isClosed(p) && p.closedAt ? ymOf(p.closedAt) : ymNow()].sort().pop();
  let ym = [...paid.map(e => ymOf(e.date)), ymOf(p.start)].sort()[0];
  const rows = [];
  let cost = 0, income = 0;
  for (let i = 0; i < 240 && ym <= last; i++, ym = ymAdd(ym, 1)) {
    for (const e of paid) {
      if (ymOf(e.date) !== ym) continue;
      if (e.type === 'income') income += e.amount; else cost += e.amount;
    }
    rows.push({ ym, cost: round2(cost), income: round2(income) });
  }
  return rows;
}

function compareCard(p, t, earn) {
  const rows = [{ label: earn ? 'Custos' : 'Custo real', done: t.spent, planned: t.toPay, c: 'var(--chart-cost)' }];
  if (earn) rows.push({ label: 'Receitas', done: t.received, planned: t.toReceive, c: 'var(--chart-in)' });
  if (t.estCost) rows.push({ label: 'Custo estimado', done: t.estCost, planned: 0, c: 'var(--muted)' });
  if (earn && t.estIn) rows.push({ label: 'Receita estimada', done: t.estIn, planned: 0, c: 'var(--muted)' });
  if (rows.length < 2) return '';
  const scale = Math.max(...rows.map(r => r.done + r.planned)) || 1;
  const body = rows.map(r => `
      <div class="cmp" style="--c:${r.c}">
        <div class="cmp-top"><span>${r.label}</span><b class="num">${money(r.done)}${r.planned ? `<small> + ${fmtNumber(r.planned)} previsto</small>` : ''}</b></div>
        <div class="bar"><span class="spent" style="width:${(r.done / scale) * 100}%"></span><span class="planned" style="width:${(r.planned / scale) * 100}%"></span></div>
      </div>`).join('');
  let verdict = '';
  if (earn) {
    const v = isClosed(p) ? t.result : t.expectedResult;
    const shown = isClosed(p) || t.expectedIn;
    if (shown) verdict = `<div class="pend-total"><span>${isClosed(p) ? 'Resultado final' : 'Resultado previsto'}</span><span class="num ${v >= 0 ? 'pos' : 'neg'}">${resultWord(v)} ${money(Math.abs(v))}</span></div>`;
  } else if (t.estCost) {
    const diff = round2(t.expectedCost - t.estCost);
    verdict = `<div class="pend-total"><span>${diff > 0 ? 'Acima do estimado' : 'Dentro do estimado'}</span><span class="num ${diff > 0 ? 'neg' : 'pos'}">${diff > 0 ? money(diff) : money(t.estCost - t.committed)}${diff > 0 ? '' : ' de margem'}</span></div>`;
  }
  return `<section class="card"><header class="card-head"><h2>${earn ? 'Custos vs receitas' : 'Estimado vs real'}</h2></header>${body}${verdict}</section>`;
}

function timeCard(p, t, earn) {
  const rows = monthSeries(p);
  const noChart = typeof Chart === 'undefined';
  let body;
  if (rows.length < 2) body = '<div class="empty small">O gráfico aparece quando houver movimentos em mais do que um mês.</div>';
  else if (noChart) body = '<div class="empty small">O gráfico precisa de ligação à internet para carregar.</div>';
  else body = '<div class="chart-box tall"><canvas id="ch-time"></canvas></div>';
  const legend = rows.length >= 2 && !noChart ? `<div class="chart-legend">
      <span><i class="line" style="background:var(--chart-cost)"></i>Custos</span>
      ${earn ? '<span><i class="line" style="background:var(--chart-in)"></i>Receitas</span>' : ''}
      ${t.estCost ? '<span><i class="line dashed"></i>Custo estimado</span>' : ''}
    </div>` : '';
  const table = rows.length >= 2 ? `
      <details class="archived chart-table"><summary><span class="link sm">Ver como tabela</span></summary>
        <table class="tbl"><thead><tr><th>Mês</th><th>Custos acum.</th>${earn ? '<th>Receitas acum.</th>' : ''}</tr></thead>
        <tbody>${rows.map(r => `<tr><td>${ymShort(r.ym)}</td><td class="num">${fmtNumber(r.cost)}</td>${earn ? `<td class="num">${fmtNumber(r.income)}</td>` : ''}</tr>`).join('')}</tbody></table>
      </details>` : '';
  return `<section class="card"><header class="card-head"><h2>Ao longo do tempo</h2>${legend}</header>${body}${table}</section>`;
}

function viewBalanco() {
  const p = cur();
  const t = totals(p);
  const earn = hasEarn(p);
  const closed = isClosed(p);
  const kpi = (label, value, note = '', cls = '') => `<div class="sum kpi"><small>${label}</small><b class="${cls}">${value}</b><div class="delta">${note || '&nbsp;'}</div></div>`;
  const kpis = earn
    ? kpi('Custos', money(t.spent), t.toPay ? `+ ${fmtNumber(t.toPay)} por pagar` : '') +
      kpi('Receitas', money(t.received), t.toReceive ? `+ ${fmtNumber(t.toReceive)} por receber` : '') +
      kpi(closed ? resultWord(t.result) : 'Resultado até agora', money(Math.abs(t.result)), closed ? '' : (t.result < 0 ? 'Investido, ainda por recuperar' : ''), t.result < 0 && closed ? 'neg' : '') +
      kpi('Margem', t.margin === null ? '—' : `${t.margin}%`, 'Sobre as receitas')
    : kpi(closed ? 'Custo final' : 'Pago', money(t.spent)) +
      kpi('Por pagar', money(t.toPay), t.open.length ? plural(t.open.length, 'previsto', 'previstos') : '') +
      kpi('Custo estimado', t.estCost ? money(t.estCost) : '—', t.estCost ? '' : 'Não definido') +
      kpi('Movimentos', String(p.entries.filter(e => e.paid).length), `Desde ${dateLong(p.start)}`);
  const leftovers = t.leftovers.length
    ? `<p class="hint">${plural(t.leftovers.length, 'previsto não realizado fica', 'previstos não realizados ficam')} de fora destas contas.</p>` : '';
  return `
    <div class="stack">
      <div class="kpis">${kpis}</div>
      <div class="grid-2">
        ${compareCard(p, t, earn)}
        ${timeCard(p, t, earn)}
        ${categoryCard(p, 'expense', '')}
        ${earn ? categoryCard(p, 'income', '') : ''}
      </div>
      ${leftovers}
      <section class="card">
        <header class="card-head"><h2>Projecto</h2><span class="sub">${closed ? `Encerrado a ${dateLong(p.closedAt)}` : `Desde ${dateLong(p.start)}`}</span></header>
        <div class="btn-row">
          ${closed
            ? `<button class="btn" data-action="project-reopen">${ic('refresh', 18)} Reabrir projecto</button>`
            : `<button class="btn btn-primary" data-action="project-close">${ic('lock', 18)} Encerrar projecto</button>`}
          <button class="btn" data-action="edit-project">${ic('edit', 18)} Editar</button>
          <button class="btn" data-action="export-csv">${ic('download', 18)} Exportar CSV</button>
        </div>
      </section>
    </div>`;
}

function destroyCharts() {
  S.charts.forEach(c => c.destroy());
  S.charts = [];
}

function drawCharts() {
  const el = $('#ch-time');
  if (typeof Chart === 'undefined' || !el) return;
  const p = cur();
  const earn = hasEarn(p);
  const estCost = Number(p.estCost) || 0;
  const rows = monthSeries(p);
  const css = getComputedStyle(document.documentElement);
  const v = name => css.getPropertyValue(name).trim();
  Chart.defaults.font.family = v('--font');
  Chart.defaults.font.weight = 600;
  Chart.defaults.color = v('--muted');

  const line = (label, data, color) => ({
    label, data, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0,
    pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: v('--surface'), direct: true,
  });
  const datasets = [line('Custos', rows.map(r => r.cost), v('--chart-cost'))];
  if (earn) datasets.push(line('Receitas', rows.map(r => r.income), v('--chart-in')));
  if (estCost) datasets.push({ ...line('Custo estimado', rows.map(() => estCost), v('--muted')), borderDash: [5, 4], direct: false, pointHoverRadius: 0 });

  // Linha vertical sob o cursor e nome da série no fim de cada linha.
  const overlay = {
    id: 'overlay',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: area } = chart;
      ctx.save();
      const active = chart.tooltip?.getActiveElements?.() || [];
      if (active.length) {
        ctx.strokeStyle = v('--border');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(active[0].element.x, area.top);
        ctx.lineTo(active[0].element.x, area.bottom);
        ctx.stroke();
      }
      ctx.fillStyle = v('--muted');
      ctx.font = `700 12px ${v('--font')}`;
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((d, i) => {
        if (!d.direct) return;
        const pt = chart.getDatasetMeta(i).data.at(-1);
        if (pt) ctx.fillText(d.label, pt.x + 8, pt.y);
      });
      ctx.restore();
    },
  };

  S.charts.push(new Chart(el, {
    type: 'line',
    data: { labels: rows.map(r => ymShort(r.ym)), datasets },
    plugins: [overlay],
    options: {
      maintainAspectRatio: false,
      layout: { padding: { right: 66 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', padding: 10, cornerRadius: 10, boxPadding: 4,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: true, grid: { color: v('--border') }, border: { display: false }, ticks: { callback: compact, maxTicksLimit: 6 } },
      },
    },
  }));
}

/* ---------- Definições ---------- */

function viewSettings() {
  const st = S.data.settings;
  const themes = { auto: 'Igual ao dispositivo', light: 'Claro', dark: 'Escuro' };
  return `
    <div class="grid-2">
      <section class="card">
        <header class="card-head"><h2>Geral</h2></header>
        <div class="set-row"><span class="lbl">Símbolo da moeda<small>Aparece depois de cada valor</small></span><input data-setting="currency" value="${esc(st.currency)}" maxlength="6"></div>
        <div class="set-row"><span class="lbl">Casas decimais<small>Mostrar centavos ou não</small></span>
          <select data-setting="decimals"><option value="2" ${st.decimals == 2 ? 'selected' : ''}>1 250,00</option><option value="0" ${st.decimals == 0 ? 'selected' : ''}>1 250</option></select></div>
        <div class="set-row"><span class="lbl">Aparência</span>
          <select data-setting="theme">${Object.entries(themes).map(([k, label]) => `<option value="${k}" ${st.theme === k ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      </section>

      <section class="card">
        <header class="card-head"><h2>Cópia de segurança</h2></header>
        <p class="hint" style="margin-bottom:12px">Os dados ficam no seu servidor em <b>data/projects.json</b>, com cópias automáticas de hora a hora. Também pode guardar a sua própria cópia.</p>
        <div class="btn-row">
          <button class="btn" data-action="export-json">${ic('download', 18)} Guardar cópia (JSON)</button>
          <label class="btn">${ic('upload', 18)} Restaurar<input type="file" id="import-file" accept=".json,application/json" hidden></label>
        </div>
        <div class="set-row" style="margin-top:12px"><span class="lbl">Estado<small>No telemóvel, puxe qualquer página para baixo para sincronizar</small></span><span class="sync"></span></div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn" data-action="sync-now">${ic('refresh', 18)} Sincronizar</button>
          <button class="btn" data-action="force-update">${ic('download', 18)} Actualizar aplicação</button>
        </div>
      </section>

      ${remindersCard()}

      ${installCard()}

      <section class="card">
        <header class="card-head"><h2>Segurança</h2></header>
        <div class="btn-row">
          <button class="btn" data-action="change-password">${ic('lock', 18)} Alterar palavra-passe</button>
          <button class="btn btn-danger" data-action="logout">${ic('logout', 18)} Terminar sessão</button>
        </div>
      </section>
    </div>`;
}

/* ======================================================================
   Painéis (formulários)
   ====================================================================== */

let sheetTimer = null;
let sheetOpen = false;

function openSheet(title, body) {
  clearTimeout(sheetTimer);
  const sheet = $('#sheet');
  $('.sheet-panel', sheet).innerHTML = `
    <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Fechar">${ic('x')}</button></header>
    ${body}`;
  sheet.hidden = false;
  sheetOpen = true;
  document.body.classList.add('noscroll');
  syncBack();
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('open')));
  // Focar já, ainda dentro do toque: o iOS só abre o teclado para foco iniciado pelo utilizador.
  const focus = $('[autofocus]', sheet);
  if (focus) {
    focus.focus({ preventScroll: true });
    setTimeout(() => { if (document.activeElement !== focus) focus.focus({ preventScroll: true }); }, 60);
  }
}

function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheetOpen = false;
  if (sheet.contains(document.activeElement)) document.activeElement.blur(); // o teclado sai com o painel
  sheet.classList.remove('open');
  document.body.classList.remove('noscroll');
  syncBack();
  sheetTimer = setTimeout(() => { sheet.hidden = true; $('.sheet-panel', sheet).innerHTML = ''; }, 260);
}

/** Despesa/Receita. Num projecto só de despesas não há escolha a fazer. */
const typeSeg = (type, p = cur()) => (hasEarn(p) ? `
  <div class="seg">
    <label class="t-expense"><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}><span>${ic('up', 16)} Despesa</span></label>
    <label class="t-income"><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}><span>${ic('down', 16)} Receita</span></label>
  </div>` : `<input type="hidden" name="type" value="${esc(type)}">`);

function catGrid(type, selected) {
  const list = catsOf(type);
  const sel = [selected, otherCat(type)].find(id => id && list.some(c => c.id === id)) || list[0]?.id;
  return list.map(c => `
    <label class="cat-chip" style="--c:${esc(c.color)}">
      <input type="radio" name="category" value="${esc(c.id)}" ${c.id === sel ? 'checked' : ''}>
      <span><i>${glyph(c)}</i>${esc(c.name)}</span>
    </label>`).join('') +
    `<button type="button" class="cat-chip cat-new" data-action="inline-cat" data-type="${type}"><span><i>＋</i>Nova</span></button>`;
}

/** Selector de categoria colapsado: mostra a escolhida; opcionalmente fecha a grelha. */
function syncCatPick(close = false) {
  const pick = $('#cat-pick');
  if (!pick) return;
  const c = cat($('input[name="category"]:checked', pick)?.value || '');
  $('#cat-current', pick).innerHTML = `<i style="--c:${esc(c.color)}"></i>${esc(c.name)}`;
  if (close) pick.open = false;
}

/** Pequeno editor que substitui o chip "Nova", para criar uma categoria a meio de um movimento. */
function inlineCatEditor(type) {
  return `
    <div class="inline-cat" data-type="${type}">
      <input class="ic-name" placeholder="Nova categoria de ${type === 'income' ? 'receita' : 'despesa'}" maxlength="40" aria-label="Nome da categoria">
      <button type="button" class="btn btn-primary btn-sm" data-action="inline-cat-save">Adicionar</button>
      <button type="button" class="icon-btn" data-action="inline-cat-cancel" aria-label="Cancelar">${ic('x', 18)}</button>
    </div>`;
}

/** O campo grande do valor cresce com o conteúdo, para a moeda ficar logo ao lado do número. */
const amountWidth = text => `${Math.max(1, text.length) + 0.4}ch`;

const amountField = (type, value, focus = true) => `
  <label class="amount-field ${type}">
    <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${inputNum(value)}" style="width:${amountWidth(inputNum(value))}" ${focus ? 'autofocus' : ''} aria-label="Valor">
    <span class="cur">${esc(S.data.settings.currency)}</span>
  </label>`;

const paidWord = type => (type === 'income' ? 'Recebido' : 'Pago');

const datePaidFields = e => `
      <div class="date-paid">
        <label class="field"><span class="label" id="tx-date-label">${e.paid ? 'Data' : 'Data prevista'}</span><input type="date" name="date" value="${esc(e.date)}" required></label>
        <label class="field paid-toggle"><span class="label" id="tx-paid-label">${paidWord(e.type)}</span>
          <span class="switch"><input type="checkbox" name="paid" ${e.paid ? 'checked' : ''}><span class="track"></span></span></label>
      </div>`;

const catPickField = (label, type, selected) => `
      <div class="field"><span class="label">${label}</span>
        <details class="cat-pick" id="cat-pick">
          <summary><span id="cat-current"></span>${ic('chevron', 18)}</summary>
          <div class="cat-grid" id="cat-grid">${catGrid(type, selected)}</div>
        </details>
      </div>`;

function initCatPick() {
  syncCatPick();
  // Ao abrir o selector, trazer a grelha inteira para cima do botão Adicionar.
  $('#cat-pick')?.addEventListener('toggle', e => {
    if (e.target.open) e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function txForm(e) {
  const isNew = !e;
  // Num projecto, a maioria do que se regista já aconteceu. Uma data futura passa a "previsto" sozinha.
  e = e || { type: 'expense', amount: '', category: '', date: todayISO(), note: '', paid: true };
  openSheet(isNew ? 'Novo movimento' : 'Editar movimento', `
    <form class="form" data-form="tx">
      <input type="hidden" name="id" value="${esc(e.id || '')}">
      ${typeSeg(e.type)}
      ${amountField(e.type, e.amount, isNew || !(e.amount > 0))}
      <p class="hint" style="text-align:center;margin-top:-10px" id="tx-amount-hint" ${e.paid ? 'hidden' : ''}>Ainda sem preço? Pode deixar em branco e pôr o valor depois.</p>
      <label class="field"><span class="label">Descrição</span><input name="note" value="${esc(e.note || '')}" placeholder="Ex.: 12 pessoas para a sacha" maxlength="80" autocomplete="off" enterkeyhint="done"></label>
      ${datePaidFields(e)}
      ${catPickField('Categoria', e.type, e.category)}
      ${isNew ? `
      <div class="field-row">
        <label class="field"><span class="label">Repetir</span>
          <select name="repeat"><option value="">Não repetir</option><option value="week">Todas as semanas</option><option value="month">Todos os meses</option></select></label>
        <label class="field" id="repeat-times" hidden><span class="label">Quantas vezes no total</span><input type="number" name="times" min="2" max="52" value="4" inputmode="numeric"></label>
      </div>` : ''}
      <div class="sheet-actions">
        ${isNew
          ? `<button type="button" class="btn" data-action="list-paste">${ic('copy', 18)} Colar lista</button>`
          : `<button type="button" class="btn btn-danger" data-action="delete-tx" data-id="${esc(e.id)}">${ic('trash', 18)} Eliminar</button>`}
        <button class="btn btn-primary btn-lg">${isNew ? 'Adicionar' : 'Guardar'}</button>
      </div>
    </form>`);
  initCatPick();
}

/** A data da n-ésima repetição, mantendo o dia do mês (limitado ao tamanho do mês). */
function repeatDate(iso, mode, n) {
  if (mode === 'week') {
    const d = isoToDate(iso);
    d.setDate(d.getDate() + 7 * n);
    return dateToISO(d);
  }
  const ym = ymAdd(ymOf(iso), n);
  return `${ym}-${pad(Math.min(Number(iso.slice(8)), daysIn(ym)))}`;
}

/* ---------- colar uma lista: um movimento por linha, todos na mesma categoria ---------- */

const NOTE_MAX = 80;

/** Linhas de uma lista colada, sem vazios nem marcadores ("- x", "• x", "1. x"). Um "1 pá" no início é quantidade e fica. */
const listLines = text => String(text).split(/[\r\n]+/)
  .map(l => l.replace(/^\s*(?:[-–—•*·]\s+|\d+[.)]\s+)/, '').trim().slice(0, NOTE_MAX))
  .filter(Boolean);

function listPasteForm() {
  openSheet('Colar uma lista', `
    <form class="form" data-form="list-paste">
      <label class="field"><span class="label">Um item por linha</span>
        <textarea name="text" rows="8" autofocus autocomplete="off" placeholder="200 blocos de 15&#10;8 sacos de cimento&#10;12 pessoas para a sacha"></textarea></label>
      <div class="sheet-actions"><button class="btn btn-primary btn-lg">Pôr preços</button></div>
    </form>`);
}

const listRow = (note = '') => `
        <li class="list-row">
          <input name="note" value="${esc(note)}" maxlength="${NOTE_MAX}" placeholder="Item" autocomplete="off" enterkeyhint="next" aria-label="Item">
          <input name="price" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="next" aria-label="Preço de ${esc(note || 'item')}">
          <button type="button" class="icon-btn" data-action="list-remove" aria-label="Remover ${esc(note || 'item')}">${ic('x', 16)}</button>
          <button type="button" class="list-unit" data-action="list-unit" aria-pressed="false" hidden></button>
        </li>`;

/** Quantidade no início da linha: "200 blocos" → 200, "1,5 kg" → 1.5, "1.000 blocos" → 1000. Sem número → 1. */
function lineQty(note) {
  const m = /^\d+(?:[.,]\d+)*/.exec(String(note).trim());
  if (!m) return 1;
  const n = Number(/^\d{1,3}(?:[.,]\d{3})+$/.test(m[0]) ? m[0].replace(/[.,]/g, '') : m[0].replace(',', '.'));
  return n > 0 ? n : 1;
}

/** O valor que a linha vai ter: o preço escrito, vezes a quantidade se "Por unidade" estiver ligado. */
function listRowAmount(row) {
  const price = parseAmount($('[name="price"]', row).value) || 0;
  return round2(price * (row.classList.contains('unit') ? lineQty($('[name="note"]', row).value) : 1));
}

function listPriceForm(lines) {
  // Uma lista costuma ser o que ainda há para comprar: começa como previsto.
  const e = { type: 'expense', category: '', date: todayISO(), paid: false };
  openSheet('Pôr preços', `
    <form class="form" data-form="list">
      ${typeSeg(e.type)}
      ${catPickField('Categoria de todas as linhas', e.type, e.category)}
      ${datePaidFields(e)}
      <div class="field"><span class="label">Preço de cada linha (${esc(S.data.settings.currency)})</span>
        <ul class="list-rows">${lines.map(listRow).join('')}</ul>
        <button type="button" class="link sm list-more" data-action="list-add-row">+ Adicionar linha</button>
      </div>
      <div class="sheet-actions"><button class="btn btn-primary btn-lg" id="list-add"></button></div>
    </form>`);
  initCatPick();
  updateListTotal();
}

function updateListTotal() {
  const rows = $$('#sheet .list-row');
  for (const row of rows) {
    const qty = lineQty($('[name="note"]', row).value);
    const on = row.classList.contains('unit');
    const btn = $('.list-unit', row);
    btn.hidden = qty === 1; // nada a multiplicar
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? `Por unidade × ${qty} = ${fmtNumber(listRowAmount(row))}` : `Por unidade? × ${qty}`;
  }
  const n = rows.length;
  $('#list-add').textContent = `Adicionar ${plural(n, 'movimento', 'movimentos')} · ${money(sum(rows, listRowAmount))}`;
}

/** Enter desce pelos preços, para escrever uma lista inteira sem tocar em cada caixa. */
function listEnter(input) {
  const row = input.closest('.list-row');
  const price = $('[name="price"]', row);
  const next = input === price ? row.nextElementSibling && $('[name="price"]', row.nextElementSibling) : price;
  if (!next) return input.blur();
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'nearest' });
}

/* ---------- projecto: criar, editar, encerrar ---------- */

function projectForm(p) {
  const isNew = !p;
  const kind = p?.kind || 'agro';
  p = p || { name: '', kind, color: randomColor(), start: todayISO(), estCost: 0, earnings: KINDS[kind].earnings, estEarnings: 0, earnDate: '' };
  const cur_ = esc(S.data.settings.currency);
  openSheet(isNew ? 'Novo projecto' : 'Editar projecto', `
    <form class="form" data-form="project">
      <input type="hidden" name="id" value="${esc(p.id || '')}">
      ${isNew ? `
      <div class="field"><span class="label">Tipo de projecto</span>
        <div class="seg three">${Object.entries(KINDS).map(([k, v]) => `<label><input type="radio" name="kind" value="${k}" ${k === kind ? 'checked' : ''}><span>${v.label}</span></label>`).join('')}</div>
        <span class="hint">Define as categorias iniciais. Pode alterá-las depois.</span></div>` : ''}
      <label class="field"><span class="label">Nome</span><input name="name" value="${esc(p.name)}" placeholder="${esc(KINDS[kind]?.placeholder || '')}" required maxlength="50" autocomplete="off" ${isNew ? 'autofocus' : ''}></label>
      <label class="field"><span class="label">Data de início</span><input type="date" name="start" value="${esc(p.start)}" required></label>
      <label class="field"><span class="label">Custo estimado (${cur_})</span><input name="estCost" inputmode="decimal" value="${inputNum(p.estCost)}" placeholder="Em branco se ainda não souber" autocomplete="off"></label>
      <div class="field"><span class="label">Este projecto vai ter receitas?</span>
        <div class="seg">
          <label><input type="radio" name="earn" value="0" ${p.earnings ? '' : 'checked'}><span>Só despesas</span></label>
          <label class="t-income"><input type="radio" name="earn" value="1" ${p.earnings ? 'checked' : ''}><span>Com receitas</span></label>
        </div>
        <span class="hint" id="earn-hint">${p.earnings ? 'Ex.: a venda da colheita. Podem entrar só no fim do projecto.' : 'Sem receitas: no fim vê apenas quanto custou.'}</span></div>
      <div class="field-row" id="earn-fields" ${p.earnings ? '' : 'hidden'}>
        <label class="field"><span class="label">Receita estimada</span><input name="estEarnings" inputmode="decimal" value="${inputNum(p.estEarnings)}" placeholder="Opcional" autocomplete="off"></label>
        <label class="field"><span class="label">Esperada em</span><input type="month" name="earnDate" value="${esc(p.earnDate || '')}" placeholder="AAAA-MM" pattern="\\d{4}-\\d{2}"></label>
      </div>
      <div class="field"><span class="label">Cor</span><input type="hidden" name="color" value="${esc(p.color)}">
        <div class="swatches">${COLORS.map(x => `<button type="button" class="${x === p.color ? 'sel' : ''}" style="--c:${x}" data-action="pick-color" data-color="${x}" aria-label="${x}"></button>`).join('')}</div></div>
      <div class="sheet-actions">
        ${isNew ? '' : `<button type="button" class="btn btn-danger" data-action="delete-project">${ic('trash', 18)} Eliminar</button>`}
        <button class="btn btn-primary btn-lg">${isNew ? 'Criar projecto' : 'Guardar'}</button>
      </div>
    </form>`);
}

/** O último passo: mostra as contas finais antes de encerrar. */
function closeForm(p) {
  const t = totals(p);
  const earn = hasEarn(p);
  const warns = [];
  if (t.open.length) warns.push(`<b>${plural(t.open.length, 'previsto', 'previstos')}</b> (${money(t.toPay + t.toReceive)}) não vão contar no resultado. Marque como pagos ou recebidos os que já aconteceram.`);
  if (t.open.some(e => !(e.amount > 0))) warns.push('Há previstos ainda sem valor.');
  if (earn && !t.received) warns.push('Ainda não há receitas registadas neste projecto.');
  openSheet('Encerrar projecto', `
    <form class="form" data-form="close">
      <div class="sum-grid">
        <div class="sum out"><small>Custos</small><b>${money(t.spent)}</b></div>
        ${earn ? `<div class="sum in"><small>Receitas</small><b>${money(t.received)}</b></div>
        <div class="sum accent"><small>${resultWord(t.result)}</small><b>${money(Math.abs(t.result))}</b></div>`
          : (t.estCost ? `<div class="sum"><small>Estimado</small><b>${money(t.estCost)}</b></div>` : '')}
      </div>
      ${warns.map(w => `<p class="warn-box">${w}</p>`).join('')}
      <label class="field"><span class="label">Data de encerramento</span><input type="date" name="date" value="${todayISO()}" required></label>
      <p class="hint">Um projecto encerrado fica só para consulta. Pode reabri-lo quando precisar.</p>
      <div class="sheet-actions"><button class="btn btn-primary btn-lg">${ic('lock', 18)} Encerrar projecto</button></div>
    </form>`);
}

function catForm(c, type) {
  const isNew = !c;
  c = c || { name: '', color: randomColor(), type, budget: 0 };
  openSheet(isNew ? 'Nova categoria' : 'Editar categoria', `
    <form class="form" data-form="category">
      <input type="hidden" name="id" value="${esc(c.id || '')}">
      <input type="hidden" name="ctype" value="${esc(c.type)}">
      <label class="field"><span class="label">Nome</span><input name="name" value="${esc(c.name)}" required maxlength="40" autofocus></label>
      <div class="field"><span class="label">Cor</span><input type="hidden" name="color" value="${esc(c.color)}">
        <div class="swatches">${COLORS.map(x => `<button type="button" class="${x === c.color ? 'sel' : ''}" style="--c:${x}" data-action="pick-color" data-color="${x}" aria-label="${x}"></button>`).join('')}</div></div>
      <label class="field"><span class="label">Valor estimado (${esc(S.data.settings.currency)})</span><input name="budget" inputmode="decimal" value="${inputNum(c.budget)}" placeholder="Opcional"><span class="hint">Se souber, compara o estimado com o real nesta categoria.</span></label>
      <div class="sheet-actions">
        ${isNew ? '' : `<button type="button" class="btn btn-danger" data-action="delete-cat" data-id="${esc(c.id)}">${ic('trash', 18)} Eliminar</button>`}
        <button class="btn btn-primary btn-lg">${isNew ? 'Criar' : 'Guardar'}</button>
      </div>
    </form>`);
}

function passwordForm() {
  openSheet('Alterar palavra-passe', `
    <form class="form" data-form="password">
      <label class="field"><span class="label">Palavra-passe actual</span><input type="password" name="current" autocomplete="current-password" required autofocus></label>
      <label class="field"><span class="label">Nova palavra-passe</span><input type="password" name="next" autocomplete="new-password" minlength="6" required></label>
      <label class="field"><span class="label">Repetir a nova palavra-passe</span><input type="password" name="confirm" autocomplete="new-password" minlength="6" required></label>
      <p class="form-error" id="pw-error"></p>
      <button class="btn btn-primary btn-lg">Actualizar palavra-passe</button>
      <p class="hint">Os outros dispositivos terão de iniciar sessão novamente.</p>
    </form>`);
}

function noteForm(n) {
  const isNew = !n;
  n = n || { title: '', text: '', remind: '', done: false };
  openSheet(isNew ? 'Nova nota' : 'Nota', `
    <form class="form" data-form="note">
      <input type="hidden" name="id" value="${esc(n.id || '')}">
      <label class="field"><span class="label">Título</span><input name="title" value="${esc(n.title)}" placeholder="Ex.: Combinar o tractor com o Sr. Mário" required maxlength="60" ${isNew ? 'autofocus' : ''}></label>
      <label class="field"><span class="label">Nota</span><textarea name="text" rows="4" maxlength="2000" placeholder="O que convém lembrar">${esc(n.text)}</textarea></label>
      <label class="field"><span class="label">Lembrar em</span><input type="date" name="remind" value="${esc(n.remind || '')}"></label>
      ${isNew ? '' : `<button type="button" class="btn btn-block" data-action="note-done" data-id="${esc(n.id)}">${n.done ? `${ic('refresh', 18)} Reabrir` : `${ic('check', 18)} Marcar como concluída`}</button>`}
      <div class="sheet-actions">
        ${isNew ? '' : `<button type="button" class="btn btn-danger" data-action="delete-note" data-id="${esc(n.id)}">${ic('trash', 18)} Eliminar</button>`}
        <button class="btn btn-primary btn-lg">Guardar</button>
      </div>
    </form>`);
}

/* ---------- calculadora ---------- */

/**
 * Calcula "12.5+3*(4-1)" sem eval. "a+b%" soma b por cento de a (1000+15% = 1150), como no telemóvel.
 * Devolve NaN se a expressão estiver incompleta ou inválida.
 */
function calcEval(src) {
  const toks = String(src).match(/\d+\.?\d*|\.\d+|[-+*/()%]/g) || [];
  if (toks.join('') !== String(src).replace(/\s+/g, '')) return NaN;
  let i = 0;
  const factor = () => {
    const t = toks[i++];
    if (t === '-' || t === '+') { const f = factor(); return { v: t === '-' ? -f.v : f.v, pct: f.pct }; }
    let v;
    if (t === '(') { v = expr(); if (toks[i++] !== ')') return { v: NaN }; } else v = Number(t);
    if (toks[i] === '%') { i++; return { v: v / 100, pct: true }; }
    return { v, pct: false };
  };
  const term = () => {
    let f = factor();
    while (toks[i] === '*' || toks[i] === '/') {
      const op = toks[i++];
      const r = factor().v;
      f = { v: op === '*' ? f.v * r : f.v / r, pct: false };
    }
    return f;
  };
  function expr() {
    let v = term().v;
    while (toks[i] === '+' || toks[i] === '-') {
      const op = toks[i++];
      const t = term();
      const r = t.pct ? v * t.v : t.v;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  return i === toks.length && Number.isFinite(v) ? Math.round(v * 1e8) / 1e8 : NaN;
}

/** Resultado enquanto se escreve: ignora um operador no fim e fecha parênteses abertos. */
function calcValue(expr = S.calc) {
  const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
  return calcEval(expr.replace(/[-+*/(]+$/, '') + ')'.repeat(Math.max(0, open)));
}

function calcFmt(v) {
  const [int, dec] = String(Math.abs(v)).split('.');
  return (v < 0 ? '−' : '') + groupInt(int) + (dec ? `,${dec}` : '');
}
const calcPretty = expr => esc(expr)
  .replace(/(\d+)(\.\d*)?/g, (m, int, dec = '') => groupInt(int) + dec.replace('.', ','))
  .replace(/[-+*/]/g, op => ` ${{ '-': '−', '+': '+', '*': '×', '/': '÷' }[op]} `);

const CALC_KEYS = [
  ['clear', 'C', 'fn'], ['back', '⌫', 'fn'], ['%', '%', 'fn'], ['/', '÷', 'op'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['*', '×', 'op'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['-', '−', 'op'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+', 'op'],
  ['0', '0', 'wide'], ['.', ','], ['=', '=', 'eq'],
];

function calcSheet() {
  const canUse = S.pid && cur() && !isClosed(cur());
  openSheet('Calculadora', `
    <div class="calc" id="calc">
      <div class="calc-screen">
        <div class="calc-expr" id="calc-expr"></div>
        <div class="calc-res num" id="calc-res"></div>
      </div>
      <div class="calc-keys">${CALC_KEYS.map(([k, label, cls = '']) =>
        `<button type="button" class="calc-key ${cls}" data-action="calc-key" data-k="${k}" aria-label="${k === 'back' ? 'Apagar' : k === 'clear' ? 'Limpar' : label}">${label}</button>`).join('')}</div>
      <div class="btn-row calc-actions">
        <button type="button" class="btn" data-action="calc-copy">${ic('copy', 18)} Copiar</button>
        ${canUse ? `<button type="button" class="btn btn-primary" data-action="calc-use">${ic('plus', 18)} Novo movimento</button>` : ''}
      </div>
    </div>`);
  updateCalc();
}

function updateCalc() {
  const exprEl = $('#calc-expr');
  if (!exprEl) return;
  const v = calcValue();
  exprEl.innerHTML = S.calcPrev ? `${calcPretty(S.calcPrev)} =` : calcPretty(S.calc) || '&nbsp;';
  $('#calc-res').textContent = Number.isNaN(v) ? (S.calc ? '…' : '0') : calcFmt(v);
}

function calcPress(k) {
  let e = S.calc;
  const last = e.slice(-1);
  const isOp = c => '+-*/'.includes(c) && c !== '';
  // Depois de "=", um número recomeça; um operador continua a partir do resultado.
  if (S.calcPrev && (/[\d.(]/.test(k))) e = '';
  S.calcPrev = '';
  if (/\d/.test(k)) {
    if (last === ')' || last === '%') e += '*';
    e += k;
  } else if (k === '.') {
    const num = e.match(/[\d.]*$/)[0];
    if (!num.includes('.')) e += num ? '.' : (last === ')' || last === '%' ? '*0.' : '0.');
  } else if (isOp(k)) {
    if (!e) e = k === '-' ? '-' : '';
    else if (isOp(last)) e = (k === '-' && '*/'.includes(last)) ? e + k : e.replace(/[-+*/]+$/, '') + k;
    else if (last === '(') e += k === '-' ? '-' : '';
    else e += k;
  } else if (k === '%') {
    if (/[\d)]/.test(last)) e += '%';
  } else if (k === '(') {
    if (/[\d)%]/.test(last)) e += '*';
    e += '(';
  } else if (k === ')') {
    const open = (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;
    if (open > 0 && /[\d)%]/.test(last)) e += ')';
  } else if (k === 'back') {
    e = e.slice(0, -1);
  } else if (k === 'clear') {
    e = '';
  } else if (k === '=') {
    const v = calcValue(e);
    if (!Number.isNaN(v) && e && String(v) !== e) { S.calcPrev = e; e = String(v); }
  }
  S.calc = e;
  updateCalc();
}

/** Tecla → tecla da calculadora, ou null. */
function calcKeyOf(key) {
  if (/^[\d.+\-*/%()]$/.test(key)) return key;
  return { ',': '.', x: '*', X: '*', '×': '*', '÷': '/', Enter: '=', '=': '=', Backspace: 'back', Delete: 'clear', c: 'clear', C: 'clear' }[key] || null;
}

/* ======================================================================
   Acções e formulários
   ====================================================================== */

const findEntry = id => cur().entries.find(e => e.id === id);

function goHome() {
  S.pid = null;
  S.view = 'home';
  closeSheet();
  render();
  window.scrollTo(0, 0);
}

/** Um passo atrás: Definições → onde estava; separador → Resumo; Resumo → página inicial. */
function stepBack() {
  if (S.view === 'settings') S.view = S.pid ? 'resumo' : 'home';
  else if (S.pid && S.view !== 'resumo') S.view = 'resumo';
  else { S.pid = null; S.view = 'home'; }
  render();
  window.scrollTo(0, 0);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projecto';

const ACTIONS = {
  go: el => { S.view = el.dataset.view; closeSheet(); render(); window.scrollTo(0, 0); },
  home: goHome,
  up: () => { if (S.view === 'settings') stepBack(); else goHome(); },
  add: () => { if (!blockedIfClosed()) txForm(); },
  'list-paste': listPasteForm,
  'new-project': () => projectForm(),
  'open-project': el => {
    S.pid = el.dataset.id;
    S.view = 'resumo';
    S.filter = 'all';
    S.search = '';
    render();
    window.scrollTo(0, 0);
  },
  'edit-project': () => projectForm(cur()),
  'project-close': () => { if (!blockedIfClosed()) closeForm(cur()); },
  'project-reopen': () => mutate(d => { const p = proj(d); p.status = 'open'; p.closedAt = null; }, 'Projecto reaberto'),
  'delete-project': () => {
    const p = cur();
    const n = p.entries.length;
    if (!confirm(`Eliminar o projecto "${p.name}"${n ? ` e os seus ${plural(n, 'movimento', 'movimentos')}` : ''}?\n\nSe o trabalho terminou, é melhor encerrá-lo: fica guardado para consulta.`)) return;
    const id = p.id;
    closeSheet();
    S.pid = null;
    S.view = 'home';
    mutate(d => { d.projects = d.projects.filter(x => x.id !== id); }, 'Projecto eliminado');
  },
  'see-planned': () => { S.filter = 'planned'; S.view = 'movimentos'; render(); window.scrollTo(0, 0); },
  'list-add-row': () => {
    $('#sheet .list-rows').insertAdjacentHTML('beforeend', listRow());
    $('#sheet .list-row:last-child input').focus();
    updateListTotal();
  },
  'list-unit': el => {
    el.closest('.list-row').classList.toggle('unit');
    updateListTotal();
  },
  'list-remove': el => {
    el.closest('.list-row').remove();
    if ($('#sheet .list-row')) updateListTotal(); else listPasteForm();
  },
  'close-sheet': closeSheet,
  filter: el => { S.filter = el.dataset.filter; render(); },
  'edit-tx': el => { if (!blockedIfClosed()) txForm(findEntry(el.dataset.id)); },
  'delete-tx': el => {
    closeSheet();
    mutate(d => { const p = proj(d); p.entries = p.entries.filter(e => e.id !== el.dataset.id); }, 'Movimento eliminado');
  },
  quickpay: el => {
    const e = findEntry(el.dataset.id);
    if (!e) return;
    // Sem valor ainda: pede-o antes de dar como pago.
    const today = todayISO();
    if (!(e.amount > 0)) return txForm({ ...e, paid: true, date: e.date > today ? today : e.date });
    mutate(d => {
      const x = proj(d).entries.find(y => y.id === e.id);
      x.paid = true;
      if (x.date > today) x.date = today; // ninguém paga no futuro
    }, e.type === 'income' ? 'Marcado como recebido' : 'Marcado como pago');
  },
  'new-cat': el => { if (!blockedIfClosed()) catForm(null, el.dataset.type); },
  'edit-cat': el => { if (!blockedIfClosed()) catForm(cur().categories.find(c => c.id === el.dataset.id)); },
  'delete-cat': el => {
    const id = el.dataset.id;
    const used = cur().entries.filter(e => e.category === id).length;
    if (used && !confirm(`Esta categoria tem ${plural(used, 'movimento', 'movimentos')}, que passam a "Sem categoria". Eliminar na mesma?`)) return;
    closeSheet();
    mutate(d => { const p = proj(d); p.categories = p.categories.filter(c => c.id !== id); }, 'Categoria eliminada');
  },
  install: async () => {
    if (!installPrompt) return installHelp();
    const prompt = installPrompt;
    installPrompt = null;
    prompt.prompt();
    await prompt.userChoice;
    updateInstallUI();
  },
  'install-dismiss': () => {
    try { localStorage.setItem('bbproject.installDismissed', '1'); } catch (e) { /* ignorar */ }
    render();
  },
  'install-help': installHelp,
  'sync-now': syncNow,
  'push-on': pushOn,
  'push-off': pushOff,
  'push-test': pushTest,
  'force-update': forceUpdate,
  'inline-cat': el => {
    el.outerHTML = inlineCatEditor(el.dataset.type);
    $('#sheet .inline-cat .ic-name').focus();
  },
  'inline-cat-cancel': el => {
    const box = el.closest('.inline-cat');
    const grid = box.closest('.cat-grid');
    grid.innerHTML = catGrid(box.dataset.type, $('input[name="category"]:checked', grid)?.value);
  },
  'inline-cat-save': el => {
    const box = el.closest('.inline-cat');
    const name = $('.ic-name', box).value.trim();
    if (!name) { $('.ic-name', box).focus(); return; }
    const c = { id: uid(), name, color: randomColor(), type: box.dataset.type, budget: 0 };
    mutate(d => proj(d).categories.push(c));
    toast(`Categoria "${name}" adicionada`);
    const grid = box.closest('.cat-grid');
    grid.innerHTML = catGrid(c.type, c.id);
    syncCatPick(true);
  },
  'pick-color': el => {
    $('#sheet [name="color"]').value = el.dataset.color;
    $$('#sheet .swatches button').forEach(b => b.classList.toggle('sel', b === el));
  },
  'new-note': () => noteForm(),
  'edit-note': el => noteForm(cur().notes.find(n => n.id === el.dataset.id)),
  'note-done': el => {
    const id = el.dataset.id;
    const done = !cur().notes.find(x => x.id === id).done;
    closeSheet();
    mutate(d => { proj(d).notes.find(x => x.id === id).done = done; }, done ? 'Nota concluída' : 'Nota reaberta');
  },
  'delete-note': el => {
    const n = cur().notes.find(x => x.id === el.dataset.id);
    if (!confirm(`Eliminar a nota "${n.title}"?`)) return;
    closeSheet();
    mutate(d => { const p = proj(d); p.notes = p.notes.filter(x => x.id !== n.id); }, 'Nota eliminada');
  },
  calc: calcSheet,
  'calc-key': el => calcPress(el.dataset.k),
  'calc-copy': () => {
    const v = calcValue();
    if (Number.isNaN(v)) return;
    navigator.clipboard?.writeText(String(v).replace('.', ',')).then(() => toast(`Copiado ${calcFmt(v)}`), () => toast('Não foi possível copiar'));
  },
  'calc-use': () => {
    const v = round2(Math.abs(calcValue()));
    txForm();
    const input = $('#sheet [name="amount"]');
    if (input && v > 0) { input.value = inputNum(v); input.style.width = amountWidth(input.value); }
  },
  'sel-start': () => {
    if (S.sel) return selEnd();
    S.sel = new Set();
    updateSelBar();
  },
  'sel-end': selEnd,
  'sel-calc': () => {
    const { vals } = selValues();
    S.calc = vals.map((v, i) => (v < 0 ? '-' : i ? '+' : '') + Math.abs(v)).join('');
    S.calcPrev = '';
    calcSheet();
  },
  undo: () => { const fn = S.undo; hideToast(); if (fn) fn(); },
  'export-json': () => download(`bbprojectos-copia-${todayISO()}.json`, JSON.stringify(S.data, null, 2), 'application/json'),
  'export-csv': () => {
    const p = cur();
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Estado']];
    [...p.entries].sort((a, b) => a.date.localeCompare(b.date)).forEach(e =>
      rows.push([e.date, e.type === 'income' ? 'Receita' : 'Despesa', cat(e.category, p).name, e.note || '', String(signed(e)).replace('.', ','), e.paid ? (e.type === 'income' ? 'Recebido' : 'Pago') : 'Previsto']));
    // Ponto e vírgula e vírgula decimal: é o que o Excel em português espera.
    download(`${slug(p.name)}-${todayISO()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv');
  },
  'change-password': passwordForm,
  logout: async () => {
    if (S.dirty && !confirm('Há alterações por sincronizar que se vão perder. Terminar sessão na mesma?')) return;
    try { await api('logout', {}); } catch (e) { /* ignorar */ }
    localStorage.removeItem(CACHE_KEY);
    S.data = null;
    S.pid = null;
    S.view = 'home';
    showAuth('login');
  },
};

const FORMS = {
  tx(form, fd) {
    const amount = parseAmount(fd.get('amount'));
    const paid = fd.get('paid') === 'on';
    // Um previsto pode não ter valor ainda; o que já aconteceu tem de o ter.
    if (Number.isNaN(amount) || (paid && !(amount > 0))) return invalid(form, 'amount');
    const id = fd.get('id');
    const entry = { type: fd.get('type'), amount, category: fd.get('category') || '', date: fd.get('date'), note: fd.get('note').trim(), paid };
    const mode = fd.get('repeat');
    const times = mode ? Math.min(52, Math.max(2, Number(fd.get('times')) || 2)) : 1;
    closeSheet();
    if (id) {
      mutate(d => Object.assign(proj(d).entries.find(e => e.id === id), entry), 'Movimento actualizado');
    } else {
      const now = Date.now();
      mutate(d => {
        for (let i = 0; i < times; i++) {
          // Só a primeira ocorrência pode já estar paga; as seguintes ficam previstas.
          proj(d).entries.push({ id: uid(), created: now - i, ...entry, date: i ? repeatDate(entry.date, mode, i) : entry.date, paid: i ? false : entry.paid });
        }
      }, times > 1 ? `${times} movimentos adicionados` : `${entry.type === 'income' ? 'Receita adicionada' : 'Despesa adicionada'}`);
    }
  },

  'list-paste'(form, fd) {
    const lines = listLines(fd.get('text'));
    if (!lines.length) return invalid(form, 'text');
    listPriceForm(lines);
  },

  list(form, fd) {
    const rows = $$('.list-row', form)
      .map(el => ({ price: $('[name="price"]', el), note: $('[name="note"]', el).value.trim(), amount: listRowAmount(el) }))
      .filter(r => r.note || r.price.value.trim());
    const paid = fd.get('paid') === 'on';
    const missing = paid && rows.find(r => !(r.amount > 0));
    if (missing) {
      toast('O que já foi pago precisa de preço');
      missing.price.scrollIntoView({ block: 'nearest' });
      return shake(missing.price);
    }
    if (!rows.length) return;
    const base = { type: fd.get('type'), category: fd.get('category') || '', date: fd.get('date'), paid };
    const entries = rows.map(r => ({ note: r.note, amount: r.amount }));
    const now = Date.now();
    closeSheet();
    // Os mais recentes aparecem primeiro, por isso conta-se para trás para manter a ordem colada.
    mutate(d => entries.forEach((e, i) => proj(d).entries.push({ id: uid(), created: now - i, ...base, ...e })),
      `${plural(entries.length, 'movimento adicionado', 'movimentos adicionados')}`);
  },

  project(form, fd) {
    const id = fd.get('id');
    const earnings = fd.get('earn') === '1';
    const p = {
      name: fd.get('name').trim(), start: fd.get('start'), color: fd.get('color'),
      estCost: parseAmount(fd.get('estCost')) || 0, earnings,
      estEarnings: earnings ? parseAmount(fd.get('estEarnings')) || 0 : 0,
      earnDate: earnings ? fd.get('earnDate') || null : null,
    };
    if (!p.name) return invalid(form, 'name');
    closeSheet();
    if (id) {
      mutate(d => Object.assign(d.projects.find(x => x.id === id), p), 'Projecto guardado');
      return;
    }
    const kind = fd.get('kind');
    const fresh = { id: uid(), created: Date.now(), kind, status: 'open', closedAt: null, categories: newCategories(kind), entries: [], notes: [], ...p };
    S.pid = fresh.id;
    S.view = 'resumo';
    S.filter = 'all';
    S.search = '';
    mutate(d => d.projects.push(fresh), 'Projecto criado');
    window.scrollTo(0, 0);
  },

  close(form, fd) {
    const date = fd.get('date');
    closeSheet();
    S.view = 'balanco';
    mutate(d => { const p = proj(d); p.status = 'closed'; p.closedAt = date; }, 'Projecto encerrado');
    window.scrollTo(0, 0);
  },

  category(form, fd) {
    const id = fd.get('id');
    const c = { name: fd.get('name').trim(), color: fd.get('color'), type: fd.get('ctype'), budget: parseAmount(fd.get('budget')) || 0 };
    if (!c.name) return invalid(form, 'name');
    closeSheet();
    if (id) mutate(d => Object.assign(proj(d).categories.find(x => x.id === id), c), 'Categoria guardada');
    else mutate(d => proj(d).categories.push({ id: uid(), ...c }), 'Categoria adicionada');
  },

  note(form, fd) {
    const id = fd.get('id');
    const n = { title: fd.get('title').trim(), text: fd.get('text').trim(), remind: fd.get('remind') || null };
    if (!n.title) return invalid(form, 'title');
    closeSheet();
    if (id) mutate(d => Object.assign(proj(d).notes.find(x => x.id === id), n), 'Nota guardada');
    else mutate(d => proj(d).notes.push({ id: uid(), created: Date.now(), done: false, ...n }), 'Nota guardada');
  },

  async password(form, fd) {
    const err = $('#pw-error');
    if (fd.get('next') !== fd.get('confirm')) { err.textContent = 'As novas palavras-passe não coincidem.'; return; }
    try {
      await api('password', { current: fd.get('current'), next: fd.get('next') });
      closeSheet();
      toast('Palavra-passe actualizada');
    } catch (e) {
      err.textContent = e.message;
    }
  },

  async setup(form, fd) {
    const err = $('#auth-error');
    if (fd.get('password') !== fd.get('confirm')) { err.textContent = 'As palavras-passe não coincidem.'; return; }
    await authSubmit(form, () => api('setup', { password: fd.get('password') }));
  },

  async login(form, fd) {
    await authSubmit(form, () => api('login', { password: fd.get('password') }));
  },
};

function invalid(form, name) {
  shake(form.querySelector(`[name="${name}"]`));
}

function shake(el) {
  el.focus();
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 });
}

/* ======================================================================
   Aviso
   ====================================================================== */

let toastTimer = null;

function toast(message, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button data-action="undo">Anular</button>' : ''}`;
  S.undo = undo || null;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 5000 : 2800);
}

function hideToast() {
  $('#toast').classList.remove('show');
  S.undo = null;
}

/* ======================================================================
   Tema
   ====================================================================== */

function applyTheme() {
  const t = S.data?.settings.theme || 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('bbproject.theme', t); } catch (e) { /* ignorar */ }
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  $('meta[name="theme-color"]').setAttribute('content', bg);
}

/* ======================================================================
   Instalar como aplicação (PWA)
   ====================================================================== */

let installPrompt = null; // O Chrome / Edge / Android dão-nos este evento; o Safari nunca.

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canInstall = () => !isStandalone() && (!!installPrompt || isIOS());

function installBannerDismissed() {
  try { return localStorage.getItem('bbproject.installDismissed') === '1'; } catch (e) { return false; }
}

function installBanner() {
  if (!canInstall() || installBannerDismissed()) return '';
  return `
    <div class="install-banner">
      <img src="icon.svg" alt="">
      <span><b>Instalar o BB Projectos</b><small>Abra-o a partir do ecrã principal, como uma aplicação normal — também funciona sem internet.</small></span>
      <button class="btn btn-primary btn-sm" data-action="install">Instalar</button>
      <button class="icon-btn" data-action="install-dismiss" aria-label="Agora não">${ic('x', 18)}</button>
    </div>`;
}

function installCard() {
  let body;
  if (isStandalone()) {
    body = '<p class="hint">✓ Está a usar a aplicação instalada neste dispositivo.</p>';
  } else if (canInstall()) {
    body = `<p class="hint" style="margin-bottom:12px">Instale o BB Projectos neste ${isIOS() || /android/i.test(navigator.userAgent) ? 'telemóvel' : 'computador'} para o abrir a partir do ecrã principal, numa janela própria.</p>
      <button class="btn btn-primary" data-action="install">${ic('download', 18)} Instalar aplicação</button>`;
  } else {
    body = `<p class="hint" style="margin-bottom:12px">Use o menu do navegador para instalar: <b>Instalar BB Projectos</b> ou <b>Adicionar ao ecrã principal</b>.</p>
      <button class="btn" data-action="install-help">Como instalar</button>`;
  }
  return `<section class="card"><header class="card-head"><h2>Aplicação</h2></header>${body}</section>`;
}

function updateInstallUI() {
  const btn = $('#install-side');
  if (btn) btn.hidden = !canInstall();
  if (S.data && (S.view === 'home' || S.view === 'settings') && $('#sheet').hidden) render();
}

function installHelp() {
  openSheet('Instalar o BB Projectos', isIOS() ? `
    <ol class="steps">
      <li>Abra esta página no <b>Safari</b>.</li>
      <li>Toque no botão <b>Partilhar</b> <span class="kbd">⬆︎</span> no fundo do ecrã.</li>
      <li>Desça e toque em <b>Adicionar ao ecrã principal</b>.</li>
      <li>Toque em <b>Adicionar</b>. O BB Projectos abre agora como uma aplicação.</li>
    </ol>` : `
    <ol class="steps">
      <li><b>Chrome ou Edge no computador:</b> clique no ícone de instalar <span class="kbd">⊕</span> à direita da barra de endereço, ou abra o menu <span class="kbd">⋮</span> → <b>Instalar BB Projectos</b>.</li>
      <li><b>Android (Chrome):</b> menu <span class="kbd">⋮</span> → <b>Instalar aplicação</b> ou <b>Adicionar ao ecrã principal</b>.</li>
      <li><b>Samsung Internet:</b> menu → <b>Adicionar página a</b> → <b>Ecrã principal</b>.</li>
    </ol>
    <p class="hint">A página tem de estar aberta em <b>https://</b> para poder instalar.</p>`);
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  updateInstallUI();
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  updateInstallUI();
  toast('BB Projectos instalado');
});

/* ======================================================================
   Autenticação e arranque
   ====================================================================== */

function showAuth(mode, message = '') {
  $('#boot').hidden = true;
  $('#app').hidden = true;
  closeSheet();
  const auth = $('#auth');
  auth.hidden = false;
  const setup = mode === 'setup';
  auth.innerHTML = `
    <div class="auth-card">
      <img class="logo" src="icon.svg" alt="">
      <h1>${setup ? 'Bem-vindo ao BB Projectos' : 'Bem-vindo de volta'}</h1>
      <p>${setup ? 'Crie uma palavra-passe para proteger os seus projectos. Vai usá-la no telemóvel e no computador.' : 'Introduza a palavra-passe para abrir os seus projectos.'}</p>
      <form data-form="${mode}">
        <input type="password" name="password" placeholder="${setup ? 'Nova palavra-passe (mín. 6 caracteres)' : 'Palavra-passe'}" autocomplete="${setup ? 'new-password' : 'current-password'}" minlength="${setup ? 6 : 1}" required autofocus>
        ${setup ? '<input type="password" name="confirm" placeholder="Repetir a palavra-passe" autocomplete="new-password" minlength="6" required>' : ''}
        <p class="form-error" id="auth-error">${esc(message)}</p>
        <button class="btn btn-primary btn-lg btn-block">${setup ? 'Criar e começar' : 'Entrar'}</button>
      </form>
    </div>`;
  $('input', auth).focus();
}

async function authSubmit(form, call) {
  const btn = $('button', form);
  btn.disabled = true;
  try {
    await call();
    await loadData();
    startApp();
  } catch (e) {
    $('#auth-error').textContent = e.message;
    btn.disabled = false;
  }
}

async function loadData() {
  const res = await api('load');
  const cache = readCache();
  if (cache && cache.dirty && cache.rev === res.rev && cache.data) {
    // Edições offline feitas neste dispositivo que nunca chegaram ao servidor.
    S.data = normalize(cache.data);
    S.rev = cache.rev;
    persist();
  } else if (res.data) {
    S.data = normalize(res.data);
    S.rev = res.rev;
    S.dirty = false;
    writeCache();
  } else {
    S.data = defaultData();
    S.rev = res.rev;
    persist();
  }
}

function startApp() {
  $('#boot').hidden = true;
  $('#auth').hidden = true;
  $('#app').hidden = false;
  if (!$('#app').children.length) renderShell();
  render();
  checkPush();
}

async function boot() {
  // Os service workers precisam de https (localhost é permitido para testes). Necessário para instalar.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  let status;
  try {
    status = await api('status');
  } catch (e) {
    const cache = readCache();
    if (cache?.data) {
      S.data = normalize(cache.data);
      S.rev = cache.rev;
      S.dirty = !!cache.dirty;
      S.offline = true;
      startApp();
      toast('Sem ligação — a mostrar a cópia guardada');
    } else {
      showAuth('login', 'Não foi possível contactar o servidor. Verifique a ligação.');
    }
    return;
  }
  if (!status.setup) return showAuth('setup');
  if (!status.authed) return showAuth('login');
  try {
    await loadData();
    startApp();
  } catch (e) {
    showAuth('login', e.message);
  }
}

/* ---------- eventos globais ---------- */

document.addEventListener('click', e => {
  // A seleccionar (ou com Ctrl/Cmd), tocar numa linha escolhe-a em vez de a abrir.
  const row = e.target.closest('[data-sel]');
  if (row && (S.sel || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (Date.now() - lastPress > 600) selToggle(row.dataset.sel); // ignora o clique que termina um toque longo
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});

document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  FORMS[form.dataset.form](form, new FormData(form));
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.name === 'category' && el.closest('#cat-pick')) syncCatPick(true);

  const setPaidUI = paid => {
    if ($('#tx-date-label')) $('#tx-date-label').textContent = paid ? 'Data' : 'Data prevista';
    if ($('#tx-amount-hint')) $('#tx-amount-hint').hidden = paid;
  };
  if (el.name === 'paid') setPaidUI(el.checked);
  // Uma data futura não pode estar já paga.
  if (el.name === 'date' && el.form?.paid && el.value > todayISO() && el.form.paid.checked) {
    el.form.paid.checked = false;
    setPaidUI(false);
  }
  if (el.name === 'repeat') $('#repeat-times').hidden = !el.value;

  // Trocar despesa/receita num formulário muda as categorias e os rótulos.
  if (el.name === 'type' && el.type === 'radio') {
    const form = el.form;
    const grid = $('#cat-grid', form);
    if (grid) grid.innerHTML = catGrid(el.value, $('input[name="category"]:checked', form)?.value);
    syncCatPick();
    $('.amount-field', form)?.classList.remove('expense', 'income');
    $('.amount-field', form)?.classList.add(el.value);
    const paidLabel = $('#tx-paid-label', form);
    if (paidLabel) paidLabel.textContent = paidWord(el.value);
  }

  // Formulário do projecto: o tipo sugere as receitas; as receitas mostram os seus campos.
  const showEarn = on => {
    $('#earn-fields').hidden = !on;
    $('#earn-hint').textContent = on ? 'Ex.: a venda da colheita. Podem entrar só no fim do projecto.' : 'Sem receitas: no fim vê apenas quanto custou.';
  };
  if (el.name === 'kind' && el.type === 'radio') {
    const k = KINDS[el.value];
    el.form.elements.name.placeholder = k.placeholder;
    $(`input[name="earn"][value="${k.earnings ? 1 : 0}"]`, el.form).checked = true;
    showEarn(k.earnings);
  }
  if (el.name === 'earn' && el.type === 'radio') showEarn(el.value === '1');

  if (el.dataset.setting) {
    const key = el.dataset.setting;
    let val = el.value;
    if (key === 'decimals' || key === 'remindHour') val = Number(val);
    if (key === 'remindDayBefore') val = val === '1';
    if (key === 'currency') val = val.trim() || 'MT';
    mutate(d => { d.settings[key] = val; });
    toast('Guardado');
  }
  if (el.id === 'import-file' && el.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.projects)) throw new Error();
        if (!confirm(`Substituir TODOS os dados actuais por esta cópia (${plural(data.projects.length, 'projecto', 'projectos')})?`)) return;
        S.pid = null;
        mutate(d => Object.assign(d, normalize(data)), 'Cópia restaurada');
      } catch (err) {
        toast('Este ficheiro não é uma cópia válida do BB Projectos.');
      }
    };
    reader.readAsText(el.files[0]);
    el.value = '';
  }
});

document.addEventListener('input', e => {
  if (e.target.name === 'amount' && e.target.closest('.amount-field')) {
    e.target.style.width = amountWidth(e.target.value);
  }
  if (e.target.closest('.list-row')) updateListTotal();
  if (e.target.id === 'tx-search') {
    S.search = e.target.value;
    $('#tx-list').innerHTML = txListInner(cur());
  }
});

document.addEventListener('keydown', e => {
  // Enter no editor de categoria adiciona a categoria em vez de submeter o movimento.
  if (e.key === 'Enter' && e.target.closest('.inline-cat')) {
    e.preventDefault();
    $('[data-action="inline-cat-save"]', e.target.closest('.inline-cat')).click();
    return;
  }
  if (e.key === 'Enter' && e.target.closest('.list-row')) {
    e.preventDefault();
    listEnter(e.target);
    return;
  }
  if (e.key === 'Escape') {
    if ($('#sheet').hidden && S.sel) selEnd(); else closeSheet();
    return;
  }
  if ($('#calc') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const k = calcKeyOf(e.key);
    if (k) { e.preventDefault(); calcPress(k); }
    return;
  }
  if (!S.data || !$('#sheet').hidden || $('#app').hidden) return;
  if (e.target.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'n' || e.key === 'N') && S.pid) { e.preventDefault(); ACTIONS.add(); }
  if (e.key === 'c' || e.key === 'C') { e.preventDefault(); calcSheet(); }
});

/* ---------- toque longo numa linha para começar a seleccionar ---------- */

let press = null;
let lastPress = 0;

document.addEventListener('touchstart', e => {
  const row = e.target.closest?.('[data-sel]');
  if (!row || e.touches.length !== 1) return;
  const { clientX: x, clientY: y } = e.touches[0];
  const p = press = {
    x, y, fired: false,
    timer: setTimeout(() => {
      p.fired = true;
      lastPress = Date.now();
      navigator.vibrate?.(12);
      selToggle(row.dataset.sel);
    }, 450),
  };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (press && !press.fired && Math.hypot(e.touches[0].clientX - press.x, e.touches[0].clientY - press.y) > 10) {
    clearTimeout(press.timer);
    press = null;
  }
}, { passive: true });

function endPress(e) {
  if (!press) return;
  clearTimeout(press.timer);
  // O dedo a levantar depois de um toque longo não deve também abrir (ou desmarcar) a linha.
  if (press.fired) {
    lastPress = Date.now();
    if (e.cancelable) e.preventDefault();
  }
  press = null;
}

document.addEventListener('touchend', endPress);
document.addEventListener('touchcancel', endPress);

// Botão direito no computador selecciona; no Android o toque longo já o fez, por isso só bloqueia o menu.
document.addEventListener('contextmenu', e => {
  const row = e.target.closest('[data-sel]');
  if (!row) return;
  e.preventDefault();
  if (!press?.fired && Date.now() - lastPress > 1000) selToggle(row.dataset.sel);
});

/* ---------- puxar para actualizar (toque) ---------- */

const PTR_MAX = 110;
const PTR_TRIGGER = 70;
let ptr = null;

function setPull(px, spinning) {
  const el = $('#ptr');
  if (!el) return;
  el.classList.toggle('show', px > 0);
  el.classList.toggle('drag', !!ptr && !spinning);
  el.classList.toggle('ready', px >= PTR_TRIGGER);
  el.classList.toggle('spin', !!spinning);
  el.style.transform = `translate(-50%, ${px}px)`;
  el.firstElementChild.style.transform = `rotate(${px * 3}deg)`;
}

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || window.scrollY > 0 || !S.data || S.syncing || $('#app').hidden || !$('#sheet').hidden) return;
  ptr = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, px: 0 };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!ptr) return;
  const dx = e.touches[0].clientX - ptr.x0;
  const dy = e.touches[0].clientY - ptr.y0;
  // A deslizar para cima ou para o lado: é a página que trata.
  if (dy < 0 || (ptr.px === 0 && Math.abs(dx) > dy) || window.scrollY > 0) {
    ptr = null;
    setPull(0);
    return;
  }
  if (e.cancelable) e.preventDefault();
  ptr.px = Math.min(dy * 0.5, PTR_MAX);
  setPull(ptr.px);
}, { passive: false });

function endPull() {
  if (!ptr) return;
  const go = ptr.px >= PTR_TRIGGER;
  ptr = null;
  if (!go) return setPull(0);
  setPull(64, true);
  syncNow().finally(() => setPull(0));
}

document.addEventListener('touchend', endPull);
document.addEventListener('touchcancel', () => { ptr = null; setPull(0); });

/* ---------- botão/gesto Voltar: fecha o painel e recua um ecrã, como numa aplicação nativa ---------- */

// Existe uma entrada extra no histórico ("guarda") enquanto houver para onde voltar.
let backGuard = false;
let backIgnore = false; // o próximo popstate é o nosso history.back(), não o do utilizador

const needsBack = () => sheetOpen || (!!S.data && !$('#app').hidden && S.view !== 'home');

function syncBack() {
  if (needsBack()) {
    if (!backGuard) { history.pushState({ bbGuard: 1 }, ''); backGuard = true; }
  } else if (backGuard && !backIgnore) {
    backIgnore = true;
    history.back();
  }
}

window.addEventListener('popstate', () => {
  backGuard = false;
  if (backIgnore) { backIgnore = false; syncBack(); return; }
  if (sheetOpen) closeSheet();
  else if (needsBack()) stepBack();
  syncBack();
});

/* ---------- manter os painéis acima do teclado ---------- */

// O iOS (e o Android em alguns modos) desenha o teclado por cima da página sem a encolher, por isso um
// painel preso ao fundo do ecrã ficaria atrás do teclado. Prende-se antes à área visível.
const vv = window.visualViewport;
let vvMax = 0;

function fitViewport() {
  if (!vv) return;
  const root = document.documentElement;
  vvMax = Math.max(vvMax, vv.height);
  root.style.setProperty('--vvh', `${vv.height}px`);
  root.style.setProperty('--vvt', `${vv.offsetTop}px`);
  const kb = vvMax - vv.height > 120;
  root.classList.toggle('kb-open', kb);
  const el = document.activeElement;
  if (kb && el?.closest?.('#sheet')) requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }));
}

if (vv) {
  vv.addEventListener('resize', fitViewport);
  vv.addEventListener('scroll', fitViewport);
  window.addEventListener('orientationchange', () => { vvMax = 0; setTimeout(fitViewport, 300); });
  fitViewport();
}

/* ---------- arrastar o painel para baixo para o fechar (telemóvel) ---------- */

let sheetDrag = null;

function setSheetDrag(dy) {
  const panel = $('#sheet .sheet-panel');
  const backdrop = $('#sheet .sheet-backdrop');
  panel.style.transition = dy ? 'none' : '';
  panel.style.transform = dy ? `translateY(${dy}px)` : '';
  backdrop.style.transition = dy ? 'none' : '';
  backdrop.style.opacity = dy ? String(Math.max(0, 1 - dy / panel.offsetHeight)) : '';
}

document.addEventListener('touchstart', e => {
  const panel = e.target.closest?.('#sheet .sheet-panel');
  if (!panel || e.touches.length !== 1 || window.matchMedia('(min-width: 640px)').matches) return;
  // Uma lista longa colada desliza dentro da caixa: isso não deve fechar o painel.
  if (e.target.matches('textarea') && e.target.scrollHeight > e.target.clientHeight) return;
  // A partir da pega/título arrasta sempre; noutros sítios só com o formulário no topo.
  const fromHead = !!e.target.closest('.sheet-head') || e.touches[0].clientY - panel.getBoundingClientRect().top < 40;
  if (!fromHead && panel.scrollTop > 0) return;
  sheetDrag = { y0: e.touches[0].clientY, t0: Date.now(), dy: 0, panel, fromHead };
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!sheetDrag) return;
  const dy = e.touches[0].clientY - sheetDrag.y0;
  if (sheetDrag.dy === 0) {
    if (dy < 0 || (!sheetDrag.fromHead && sheetDrag.panel.scrollTop > 0)) {
      sheetDrag = null; // a deslizar o formulário para cima: não é arrastar
      return;
    }
    // Esperar por um movimento claro para baixo, senão um dedo parado bloqueia o scroll.
    if (dy < 4) return;
  }
  if (e.cancelable) e.preventDefault();
  sheetDrag.dy = Math.max(0, dy);
  setSheetDrag(sheetDrag.dy);
}, { passive: false });

function endSheetDrag() {
  if (!sheetDrag) return;
  const { dy, t0, panel } = sheetDrag;
  sheetDrag = null;
  const fast = dy > 30 && dy / Math.max(1, Date.now() - t0) > 0.6;
  setSheetDrag(0);
  if (dy > Math.min(140, panel.offsetHeight * 0.3) || fast) closeSheet();
}

document.addEventListener('touchend', endSheetDrag);
document.addEventListener('touchcancel', endSheetDrag);

window.addEventListener('online', () => { S.offline = false; flush(); refresh(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { S.dirty ? flush() : refresh(); } });
setInterval(() => { if (S.dirty && !S.saving) { S.offline = false; flush(); } }, 30000);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.data && S.view === 'balanco') render(); });

boot();
