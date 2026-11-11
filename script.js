/* =========================================================
   VinOTP Satset — script.js
   BAGIAN 1: PENGATURAN
   ========================================================= */
const CONFIG = {
  // Link Worker Cloudflare. Kosongkan ('') = MODE DEMO (data contoh, tanpa server).
  // Nanti diisi, contoh: 'https://vinotp-api.namamu.workers.dev'
  API_BASE: '',
  // Site key Cloudflare Turnstile (cek "bukan robot"). Kosongkan kalau belum ada.
  TURNSTILE_SITEKEY: '',
  // Nominal deposit cepat
  AMOUNTS: [10000, 20000, 50000, 100000],
  MIN_DEPOSIT: 5000,
  // Kontak admin (link Telegram)
  ADMIN_TELEGRAM: 'https://t.me/',
};
const DEMO = !CONFIG.API_BASE;

/* =========================================================
   BAGIAN 2: ALAT BANTU
   ========================================================= */
const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $toast = document.getElementById('toast');

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rp(n) { return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
function num(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
function mmss(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, 2800);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (er) {}
    t.remove();
  }
  toast('Disalin: ' + text);
}
function flagUrl(iso) { return 'https://flagcdn.com/w40/' + esc(String(iso).toLowerCase()) + '.png'; }
function appIcon(s) {
  const letter = esc((s.name || '?').trim().charAt(0).toUpperCase());
  const src = s.logo || ('logos/' + encodeURIComponent(s.id) + '.png');
  return `<span class="app-ic"><img src="${esc(src)}" alt="" data-l="${letter}" onerror="this.parentNode.textContent=this.dataset.l"></span>`;
}

const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 18h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
};
const brandHTML = `<span class="logo">${ICON.phone}</span><span>VinOTP <em>Satset</em></span>`;

/* =========================================================
   BAGIAN 3: SAMBUNGAN KE SERVER (WORKER)
   ========================================================= */
async function api(method, path, body) {
  if (DEMO) return demoApi(method, path, body);
  const headers = { 'Content-Type': 'application/json' };
  const token = store.get('token', '');
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(CONFIG.API_BASE.replace(/\/$/, '') + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Tidak bisa terhubung ke server. Cek internet kamu.');
  }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) { store.del('token'); state.user = null; go('#/masuk'); }
  if (!res.ok || data.error) throw new Error(data.error || 'Terjadi kesalahan (' + res.status + ')');
  return data;
}

/* =========================================================
   BAGIAN 4: MODE DEMO (data contoh, dipakai kalau API_BASE kosong)
   ========================================================= */
const DEMO_COUNTRIES = [
  { id: 'id', name: 'Indonesia', code: '+62', popular: true },
  { id: 'ph', name: 'Filipina', code: '+63' },
  { id: 'in', name: 'India', code: '+91' },
  { id: 'us', name: 'Amerika Serikat', code: '+1' },
  { id: 'gb', name: 'Inggris', code: '+44' },
  { id: 'my', name: 'Malaysia', code: '+60' },
  { id: 'vn', name: 'Vietnam', code: '+84' },
  { id: 'th', name: 'Thailand', code: '+66' },
  { id: 'ru', name: 'Rusia', code: '+7' },
];
const DEMO_SERVICES = [
  { id: 'facebook', name: 'Facebook', popular: true, usd: [0.0125, 0.018, 0.0375, 0.04, 0.05], stock: [1485, 720, 651, 5343, 100] },
  { id: 'whatsapp', name: 'WhatsApp', popular: true, usd: [0.06, 0.09, 0.15], stock: [320, 900, 210] },
  { id: 'telegram', name: 'Telegram', popular: true, usd: [0.1, 0.18], stock: [450, 120] },
  { id: 'google', name: 'Google / Gmail', popular: true, usd: [0.06, 0.1], stock: [800, 300] },
  { id: 'tiktok', name: 'TikTok', popular: true, usd: [0.01, 0.03], stock: [2100, 640] },
  { id: 'instagram', name: 'Instagram', popular: true, usd: [0.01, 0.04], stock: [1300, 410] },
  { id: 'shopee', name: 'Shopee', usd: [0.05, 0.08], stock: [260, 90] },
  { id: 'gojek', name: 'Gojek', usd: [0.07], stock: [0] },
];
const demoSettings = () => store.get('demo_settings', { profit: 200, kurs: 17700, rounding: 25 });
function demoSell(usd) {
  const s = demoSettings();
  return Math.ceil((usd * s.kurs + s.profit) / s.rounding) * s.rounding;
}
const demoDB = () => store.get('demo_db', { balance: 9700, orders: [], deposits: [] });
const demoSave = (db) => store.set('demo_db', db);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function demoApi(method, path, body) {
  await wait(250);
  const db = demoDB();
  const [p, qs] = path.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const user = { name: 'Pembeli Demo', email: 'demo@gmail.com', balance: db.balance, role: 'admin' };

  if (p === '/auth/register') return { ok: true };
  if (p === '/auth/resend') return { ok: true };
  if (p === '/auth/verify') {
    if (!/^\d{6}$/.test(body.code)) throw new Error('Kode harus 6 angka');
    return { token: 'demo', user };
  }
  if (p === '/auth/login') return { token: 'demo', user };
  if (p === '/me') return { user };
  if (p === '/countries') return { countries: DEMO_COUNTRIES };
  if (p === '/services') {
    return {
      services: DEMO_SERVICES.map((s) => ({
        id: s.id, name: s.name, popular: !!s.popular,
        minPrice: demoSell(s.usd[0]), stock: s.stock.reduce((a, b) => a + b, 0),
      })),
    };
  }
  if (p === '/prices') {
    const s = DEMO_SERVICES.find((x) => x.id === q.service);
    if (!s) throw new Error('Aplikasi tidak ditemukan');
    return { service: { id: s.id, name: s.name }, tiers: s.usd.map((u, i) => ({ price: demoSell(u), stock: s.stock[i] })) };
  }
  if (p === '/order' && method === 'POST') {
    const s = DEMO_SERVICES.find((x) => x.id === body.service);
    const c = DEMO_COUNTRIES.find((x) => x.id === body.country);
    if (db.balance < body.price) throw new Error('Saldo tidak cukup. Silakan deposit dulu.');
    db.balance -= body.price;
    const order = {
      id: 'D' + Date.now().toString(36).toUpperCase(),
      service: s.id, serviceName: s.name, country: c.id, countryName: c.name,
      price: body.price, phone: c.code + ' 812 0000 ' + String(Math.floor(1000 + Math.random() * 8999)),
      status: 'waiting', code: null, createdAt: Date.now(), expiresAt: Date.now() + 20 * 60 * 1000,
    };
    db.orders.unshift(order); demoSave(db);
    return { order };
  }
  if (p === '/orders') return { orders: db.orders };
  let m = p.match(/^\/order\/([^/]+)(\/(cancel|finish))?$/);
  if (m) {
    const o = db.orders.find((x) => x.id === m[1]);
    if (!o) throw new Error('Pesanan tidak ditemukan');
    if (o.status === 'waiting' && Date.now() - o.createdAt > 8000) { o.status = 'received'; o.code = '482913'; }
    if (o.status === 'waiting' && Date.now() > o.expiresAt) { o.status = 'expired'; db.balance += o.price; }
    if (m[3] === 'cancel') {
      if (o.status !== 'waiting') throw new Error('Pesanan tidak bisa dibatalkan');
      o.status = 'canceled'; db.balance += o.price;
    }
    if (m[3] === 'finish') o.status = 'done';
    demoSave(db);
    return { order: o, balance: db.balance };
  }
  if (p === '/deposit' && method === 'POST') {
    const d = { id: 'P' + Date.now().toString(36).toUpperCase(), amount: body.amount, status: 'pending', qrImage: '', createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000 };
    db.deposits.unshift(d); demoSave(db);
    return { deposit: d };
  }
  m = p.match(/^\/deposit\/([^/]+)$/);
  if (m) {
    const d = db.deposits.find((x) => x.id === m[1]);
    if (!d) throw new Error('Deposit tidak ditemukan');
    if (d.status === 'pending' && Date.now() - d.createdAt > 6000) { d.status = 'paid'; db.balance += d.amount; }
    demoSave(db);
    return { deposit: d, balance: db.balance };
  }
  if (p === '/admin/summary') {
    const today = db.orders.filter((o) => o.status === 'done' || o.status === 'received');
    return { grizzlyBalanceUsd: 5.2, soldToday: today.length, profitToday: today.length * demoSettings().profit, settings: demoSettings() };
  }
  if (p === '/admin/settings' && method === 'POST') { store.set('demo_settings', body); return { ok: true }; }
  throw new Error('Alamat tidak dikenal: ' + p);
}

/* =========================================================
   BAGIAN 5: STATUS & PINDAH HALAMAN
   ========================================================= */
const state = {
  user: null,
  country: store.get('country', 'id'),
  countries: null,
  timers: [],
};
const PUBLIC = ['masuk', 'daftar', 'verifikasi', 'google'];

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function stopTimers() { state.timers.forEach((t) => clearInterval(t)); state.timers = []; }
function every(ms, fn) { const t = setInterval(fn, ms); state.timers.push(t); return t; }

async function loadCountries() {
  if (!state.countries) state.countries = (await api('GET', '/countries')).countries;
  return state.countries;
}
function currentCountry() {
  return (state.countries || []).find((c) => c.id === state.country) || { id: state.country, name: state.country.toUpperCase(), code: '' };
}
async function refreshMe() {
  const r = await api('GET', '/me');
  state.user = r.user;
  return r.user;
}

async function route() {
  stopTimers();
  const raw = location.hash.replace(/^#\/?/, '') || 'beranda';
  const [pathPart, qs] = raw.split('?');
  const [name, arg] = pathPart.split('/');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const loggedIn = !!store.get('token', '');

  if (!PUBLIC.includes(name) && !loggedIn) return go('#/masuk');
  if ((name === 'masuk' || name === 'daftar') && loggedIn) return go('#/beranda');

  const withNav = ['beranda', 'riwayat', 'deposit', 'akun'].includes(name);
  $nav.hidden = !withNav;
  $app.classList.toggle('no-nav', !withNav);
  $nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  window.scrollTo(0, 0);

  const screens = {
    masuk: screenLogin, daftar: screenRegister, verifikasi: screenVerify, google: screenGoogle,
    beranda: screenHome, negara: screenCountries, harga: screenPrices, pesanan: screenOrder,
    riwayat: screenHistory, deposit: screenDeposit, akun: screenAccount, admin: screenAdmin,
  };
  const fn = screens[name] || screenHome;
  try {
    await fn(arg, query);
  } catch (e) {
    $app.innerHTML = `<div class="page" style="padding-top:40px"><div class="empty">${esc(e.message)}</div>
      <button class="btn btn-ghost" onclick="route()">Coba lagi</button></div>`;
  }
}
window.addEventListener('hashchange', route);

/* =========================================================
   BAGIAN 6: LAYAR MASUK, DAFTAR, VERIFIKASI EMAIL
   ========================================================= */
function authHead(sub) {
  return `<div class="auth-head"><span class="brand"><span class="logo">${ICON.phone}</span></span>
    <h1>VinOTP <span style="color:var(--accent)">Satset</span></h1><p class="muted">${esc(sub)}</p></div>`;
}
function googleBtn(label) {
  return `<button class="btn btn-white" id="googleBtn" type="button">
    <span aria-hidden="true" style="width:24px;height:24px;border-radius:12px;border:2px solid #1F2937;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">G</span>${esc(label)}</button>`;
}
function bindGoogle() {
  document.getElementById('googleBtn').onclick = () => {
    if (DEMO) return toast('Login Google aktif setelah server dipasang');
    const back = location.origin + location.pathname;
    location.href = CONFIG.API_BASE.replace(/\/$/, '') + '/auth/google?return=' + encodeURIComponent(back);
  };
}
function demoBanner() {
  return DEMO ? '<div class="banner">Mode demo: belum tersambung ke server. Harga, stok, dan saldo masih contoh.</div>' : '';
}

function screenLogin() {
  $app.innerHTML = `<div class="page">
    ${authHead('Nomor OTP murah, kode masuk otomatis. Gagal? Saldo kembali.')}
    ${demoBanner()}
    <div class="tabs"><a class="on" href="#/masuk">Masuk</a><a href="#/daftar">Daftar</a></div>
    ${googleBtn('Masuk dengan Google')}
    <div class="divider">atau pakai email</div>
    <form id="f" class="page" style="padding:0">
      <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" required placeholder="namakamu@gmail.com"></label>
      <label class="field"><span>Kata sandi</span><input class="input" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
      <button class="btn btn-primary" type="submit">Masuk</button>
    </form>
    <p class="muted small" style="text-align:center">Butuh bantuan? <a href="${esc(CONFIG.ADMIN_TELEGRAM)}" target="_blank" rel="noopener">Hubungi admin</a></p>
  </div>`;
  bindGoogle();
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const r = await api('POST', '/auth/login', { email: fd.get('email').trim(), password: fd.get('password') });
      store.set('token', r.token); state.user = r.user;
      go('#/beranda');
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
}

function strengthOf(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

let turnstileToken = '';
function mountTurnstile() {
  if (!CONFIG.TURNSTILE_SITEKEY) return;
  const render = () => window.turnstile.render('#ts', {
    sitekey: CONFIG.TURNSTILE_SITEKEY, theme: 'dark', language: 'id',
    callback: (t) => { turnstileToken = t; },
    'expired-callback': () => { turnstileToken = ''; },
  });
  if (window.turnstile) return render();
  const sc = document.createElement('script');
  sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  sc.onload = render;
  document.head.appendChild(sc);
}

function screenRegister() {
  turnstileToken = '';
  $app.innerHTML = `<div class="page">
    ${authHead('Buat akun, deposit, langsung beli nomor.')}
    ${demoBanner()}
    <div class="tabs"><a href="#/masuk">Masuk</a><a class="on" href="#/daftar">Daftar</a></div>
    ${googleBtn('Daftar dengan Google')}
    <div class="divider">atau isi formulir</div>
    <form id="f" class="page" style="padding:0" novalidate>
      <label class="field"><span>Nama <b class="req">*</b></span><input class="input" name="name" required maxlength="60" placeholder="Nama kamu"></label>
      <label class="field"><span>Email (Gmail) <b class="req">*</b></span><input class="input" name="email" type="email" autocomplete="email" required placeholder="namakamu@gmail.com"></label>
      <label class="field"><span>Telegram (opsional)</span><input class="input" name="telegram" maxlength="40" placeholder="@nama_panggilanmu"></label>
      <label class="field"><span>Kata sandi <b class="req">*</b></span>
        <span class="input-wrap"><input class="input" name="password" id="pw" type="password" autocomplete="new-password" required placeholder="Minimal 8 karakter">
        <button type="button" class="icon-btn" id="eye" aria-label="Tampilkan kata sandi">${ICON.eye}</button></span></label>
      <div class="strength" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      <span class="small muted" id="pwHint">Pakai huruf besar, kecil, angka, dan simbol.</span>
      <label class="field"><span>Konfirmasi kata sandi <b class="req">*</b></span><input class="input" name="password2" type="password" autocomplete="new-password" required placeholder="Ulangi kata sandi"></label>
      <div id="ts"></div>
      <label class="check"><input type="checkbox" name="agree"><span>Saya setuju dengan <a href="#/daftar" onclick="return false">Syarat &amp; Ketentuan</a> dan <a href="#/daftar" onclick="return false">Kebijakan Privasi</a></span></label>
      <label class="check"><input type="checkbox" name="promo"><span>Kirimi saya info promo dan diskon</span></label>
      <button class="btn btn-primary" type="submit">Daftar</button>
    </form>
    <p class="muted small" style="text-align:center;padding-bottom:12px">Sudah punya akun? <a href="#/masuk">Masuk</a></p>
  </div>`;
  bindGoogle();
  mountTurnstile();
  const pw = document.getElementById('pw');
  document.getElementById('eye').onclick = () => { pw.type = pw.type === 'password' ? 'text' : 'password'; };
  pw.oninput = () => {
    const s = strengthOf(pw.value);
    const colors = ['#2E3F5E', '#FF9AA8', '#FFC24B', '#FFC24B', '#3DDC84'];
    document.querySelectorAll('.strength span').forEach((el, i) => { el.style.background = i < s ? colors[s] : '#2E3F5E'; });
    const hints = ['Pakai huruf besar, kecil, angka, dan simbol.', 'Lemah.', 'Lumayan. Tambah angka atau simbol.', 'Lumayan kuat. Tambah simbol supaya lebih aman.', 'Kuat.'];
    document.getElementById('pwHint').textContent = hints[s];
  };
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: String(fd.get('name')).trim(), email: String(fd.get('email')).trim().toLowerCase(),
      telegram: String(fd.get('telegram')).trim(), password: String(fd.get('password')),
      promo: !!fd.get('promo'), turnstile: turnstileToken,
    };
    if (!data.name) return toast('Nama wajib diisi');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast('Email tidak valid');
    if (data.password.length < 8) return toast('Kata sandi minimal 8 karakter');
    if (data.password !== fd.get('password2')) return toast('Konfirmasi kata sandi tidak sama');
    if (CONFI
