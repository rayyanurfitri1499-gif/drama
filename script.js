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
    if (CONFIG.TURNSTILE_SITEKEY && !turnstileToken) return toast('Selesaikan cek keamanan dulu');
    if (!fd.get('agree')) return toast('Centang persetujuan Syarat & Ketentuan');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('POST', '/auth/register', data);
      go('#/verifikasi?email=' + encodeURIComponent(data.email));
    } catch (err) { toast(err.message); btn.disabled = false; }
  };
}

function screenVerify(_, q) {
  const email = q.email || '';
  $app.innerHTML = `<div class="topbar"><a class="icon-btn" href="#/daftar" aria-label="Kembali">${ICON.back}</a><h1>Verifikasi email</h1></div>
  <div class="page" style="gap:24px;padding-top:12px">
    <div class="auth-head" style="padding:0">
      <span style="width:72px;height:72px;border-radius:36px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;color:var(--accent)">${ICON.mail}</span>
      <h1>Cek Gmail kamu</h1>
      <p class="muted" style="line-height:1.6">Kode 6 angka sudah dikirim ke<br><b style="color:var(--text)">${esc(email)}</b></p>
      <a href="#/daftar" class="small" style="font-weight:700;padding:6px 10px">Salah email? Ubah</a>
    </div>
    ${DEMO ? '<div class="banner">Mode demo: ketik 6 angka apa saja.</div>' : ''}
    <div class="field"><span>Masukkan kode OTP</span>
      <div class="otp" role="group" aria-label="Kode OTP 6 angka">
        ${[1, 2, 3, 4, 5, 6].map((i) => `<input inputmode="numeric" maxlength="1" aria-label="Angka ke-${i}">`).join('')}
      </div>
      <span class="small muted" id="resendRow"></span>
    </div>
    <button class="btn btn-primary" id="verifyBtn">Verifikasi &amp; masuk</button>
  </div>`;

  const boxes = [...document.querySelectorAll('.otp input')];
  boxes.forEach((b, i) => {
    b.oninput = () => {
      b.value = b.value.replace(/\D/g, '').slice(-1);
      if (b.value && boxes[i + 1]) boxes[i + 1].focus();
      if (boxes.every((x) => x.value)) submit();
    };
    b.onkeydown = (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); };
    b.onpaste = (e) => {
      const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!d) return;
      e.preventDefault();
      d.split('').forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
      if (d.length === 6) submit();
    };
  });
  boxes[0].focus();

  let until = Date.now() + 45000;
  const row = document.getElementById('resendRow');
  const tick = () => {
    const left = until - Date.now();
    if (left > 0) row.innerHTML = `Tidak ada email? Cek folder Spam, atau kirim ulang dalam <b style="color:var(--text)">${mmss(left)}</b>`;
    else row.innerHTML = 'Tidak ada email? Cek folder Spam, atau <a href="#" id="resend" style="font-weight:700">kirim ulang kode</a>';
    const r = document.getElementById('resend');
    if (r) r.onclick = async (e) => {
      e.preventDefault();
      try { await api('POST', '/auth/resend', { email }); toast('Kode baru sudah dikirim'); until = Date.now() + 45000; tick(); }
      catch (err) { toast(err.message); }
    };
  };
  tick(); every(1000, tick);

  let busy = false;
  async function submit() {
    if (busy) return;
    const code = boxes.map((b) => b.value).join('');
    if (code.length !== 6) return toast('Masukkan 6 angka kode');
    busy = true;
    try {
      const r = await api('POST', '/auth/verify', { email, code });
      store.set('token', r.token); state.user = r.user;
      toast('Akun berhasil dibuat');
      go('#/beranda');
    } catch (err) {
      toast(err.message); busy = false;
      boxes.forEach((b) => { b.value = ''; }); boxes[0].focus();
    }
  }
  document.getElementById('verifyBtn').onclick = submit;
}

// Kembali dari login Google: Worker mengarahkan ke #/google?token=...
function screenGoogle(_, q) {
  if (q.token) { store.set('token', q.token); go('#/beranda'); }
  else { toast(q.error || 'Login Google gagal'); go('#/masuk'); }
}

/* =========================================================
   BAGIAN 7: BERANDA (pilih aplikasi) & PILIH NEGARA
   ========================================================= */
async function screenHome() {
  $app.innerHTML = '<div class="empty" style="padding-top:80px">Memuat…</div>';
  const [user] = await Promise.all([refreshMe(), loadCountries()]);
  const c = currentCountry();
  const { services } = await api('GET', '/services?country=' + encodeURIComponent(state.country));
  services.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || a.name.localeCompare(b.name));

  $app.innerHTML = `
  <div class="row between" style="padding:18px 20px 10px">
    <span class="brand">${brandHTML}</span>
    <a class="icon-btn boxed" href="#/akun" aria-label="Akun">${ICON.user}</a>
  </div>
  <div class="page">
    ${demoBanner()}
    <section class="card">
      <div><p class="small muted">Saldo kamu</p><p class="big">${rp(user.balance)}</p></div>
      <div class="row">
        <a class="btn btn-primary" href="#/deposit">${ICON.plus}Deposit</a>
        <a class="btn btn-ghost" href="#/riwayat">Riwayat</a>
      </div>
    </section>
    <div class="row">
      <a class="chip-btn" href="#/negara"><img class="flag" src="${flagUrl(c.id)}" alt="">${esc(c.name)}${ICON.down}</a>
      <label class="input-wrap grow">${ICON.search}<input class="input" id="q" placeholder="Cari aplikasi…" aria-label="Cari aplikasi"></label>
    </div>
    <div class="row between"><h2 class="title">Pilih aplikasi</h2><span class="small muted">Kode gagal = saldo kembali</span></div>
    <ul class="list" id="list"></ul>
  </div>`;

  const draw = (term) => {
    const t = (term || '').toLowerCase();
    const rows = services.filter((s) => s.name.toLowerCase().includes(t));
    document.getElementById('list').innerHTML = rows.length ? rows.map((s) => `
      <li class="item">
        ${appIcon(s)}
        <div class="grow"><div style="font-weight:700">${esc(s.name)}</div>
          <div class="small muted">${s.stock > 0 ? num(s.stock) + ' stok' : 'Stok habis'}</div></div>
        <div class="price"><span class="small muted">mulai</span><b>${rp(s.minPrice)}</b></div>
        ${s.stock > 0
          ? `<a class="btn btn-primary btn-small" href="#/harga/${encodeURIComponent(s.id)}">Beli</a>`
          : '<span class="pill off">Habis</span>'}
      </li>`).join('') : '<li class="empty">Aplikasi tidak ditemukan</li>';
  };
  draw('');
  document.getElementById('q').oninput = (e) => draw(e.target.value);
}

async function screenCountries() {
  const list = await loadCountries();
  $app.innerHTML = `<div class="topbar"><a class="icon-btn" href="#/beranda" aria-label="Kembali">${ICON.back}</a><h1>Pilih negara</h1></div>
  <div class="page">
    <label class="input-wrap">${ICON.search}<input class="input" id="q" placeholder="Cari negara…" aria-label="Cari negara"></label>
    <p class="small muted">Semua negara dari penyedia · stok &amp; harga ikut otomatis</p>
    <ul class="list" id="list"></ul>
  </div>`;
  const draw = (term) => {
    const t = (term || '').toLowerCase();
    const rows = list.filter((c) => c.name.toLowerCase().includes(t) || (c.code || '').includes(t))
      .sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || a.name.localeCompare(b.name));
    document.getElementById('list').innerHTML = rows.map((c) => `
      <li><button class="item click${c.id === state.country ? ' tier on' : ''}" data-id="${esc(c.id)}">
        <img class="flag" src="${flagUrl(c.id)}" alt="">
        <span class="small muted" style="width:38px;font-weight:700">${esc(c.code)}</span>
        <span class="grow" style="font-weight:600">${esc(c.name)}</span>
        ${c.id === state.country ? `<span style="color:var(--accent)">${ICON.check}</span>` : ''}
      </button></li>`).join('') || '<li class="empty">Negara tidak ditemukan</li>';
    document.querySelectorAll('#list button').forEach((b) => {
      b.onclick = () => { state.country = b.dataset.id; store.set('country', state.country); go('#/beranda'); };
    });
  };
  draw('');
  document.getElementById('q').oninput = (e) => draw(e.target.value);
}

/* =========================================================
   BAGIAN 8: PILIH HARGA & BELI
   ========================================================= */
async function screenPrices(serviceId) {
  await loadCountries();
  const c = currentCountry();
  const [{ service, tiers }, user] = await Promise.all([
    api('GET', '/prices?country=' + encodeURIComponent(state.country) + '&service=' + encodeURIComponent(serviceId)),
    refreshMe(),
  ]);
  const avail = tiers.filter((t) => t.stock > 0).sort((a, b) => a.price - b.price);
  let picked = 0;
  const label = (i, n) => (i === 0 ? 'Hemat' : i === n - 1 ? 'Premium' : 'Standar');

  $app.innerHTML = `<div class="topbar"><a class="icon-btn" href="#/beranda" aria-label="Kembali">${ICON.back}</a>
    <div><h1>${esc(service.name)}</h1><div class="sub"><img class="flag" style="width:18px;height:12px" src="${flagUrl(c.id)}" alt="">${esc(c.code)} ${esc(c.name)}</div></div></div>
  <div class="page">
    <div class="row between"><h2 class="title">Pilih harga</h2><span class="small muted">Lebih mahal = lebih sering berhasil</span></div>
    <ul class="list" id="tiers"></ul>
    <div class="card" style="flex-direction:row;padding:12px 14px;gap:10px;border-radius:12px">
      <span class="muted" style="flex-shrink:0">${ICON.info}</span>
      <span class="small muted" style="line-height:1.5">Kode tidak masuk dalam 20 menit? Pesanan batal otomatis dan saldo kembali penuh.</span>
    </div>
    <div class="buybar">
      <div><div class="small muted">Saldo ${rp(user.balance)}</div><div style="font-size:18px;font-weight:800" id="chosen"></div></div>
      <button class="btn btn-primary grow" id="buy">Beli nomor</button>
    </div>
  </div>`;

  const draw = () => {
    document.getElementById('tiers').innerHTML = avail.length ? avail.map((t, i) => `
      <li><button class="item click tier${i === picked ? ' on' : ''}" data-i="${i}">
        <span class="dot"></span>
        <span class="grow"><span style="display:block;font-weight:700">${label(i, avail.length)}</span>
        <span class="small muted">${num(t.stock)} stok</span></span>
        <b>${rp(t.price)}</b></button></li>`).join('') : '<li class="empty">Stok habis untuk negara ini. Coba negara lain.</li>';
    document.querySelectorAll('#tiers button').forEach((b) => { b.onclick = () => { picked = +b.dataset.i; draw(); }; });
    document.getElementById('chosen').textContent = avail.length ? rp(avail[picked].price) : '-';
    document.getElementById('buy').disabled = !avail.length;
  };
  draw();

  document.getElementById('buy').onclick = async (e) => {
    const t = avail[picked];
    if (user.balance < t.price) { toast('Saldo tidak cukup. Deposit dulu ya.'); return go('#/deposit'); }
    e.target.disabled = true;
    try {
      const r = await api('POST', '/order', { country: state.country, service: service.id, price: t.price });
      go('#/pesanan/' + encodeURIComponent(r.order.id));
    } catch (err) { toast(err.message); e.target.disabled = false; }
  };
}


/* =========================================================
   BAGIAN 9: PESANAN AKTIF & RIWAYAT
   ========================================================= */
const STATUS = {
  waiting: ['wait', 'Menunggu kode'],
  received: ['ok', 'Kode masuk'],
  done: ['ok', 'Selesai'],
  canceled: ['bad', 'Dibatalkan'],
  expired: ['bad', 'Waktu habis'],
};
function pill(st) { const s = STATUS[st] || ['off', st]; return `<span class="pill ${s[0]}">${s[1]}</span>`; }

async function screenOrder(id) {
  let o = (await api('GET', '/order/' + encodeURIComponent(id))).order;

  const draw = () => {
    const active = o.status === 'waiting' || o.status === 'received';
    $app.innerHTML = `<div class="topbar"><a class="icon-btn" href="#/beranda" aria-label="Kembali">${ICON.back}</a><h1>Pesanan</h1></div>
    <div class="page">
      <section class="card">
        <div class="row">${appIcon({ id: o.service, name: o.serviceName })}
          <div class="grow"><div style="font-weight:700">${esc(o.serviceName)}</div>
          <div class="small muted">${esc(o.countryName)} · ${rp(o.price)}</div></div>${pill(o.status)}</div>
        <div class="field"><span>Nomor kamu</span>
          <div class="numbox"><b>${esc(o.phone)}</b>
          <button class="icon-btn boxed" style="border-radius:10px" data-copy="${esc(String(o.phone).replace(/\s/g, ''))}" aria-label="Salin nomor">${ICON.copy}</button></div></div>
        <div class="field"><span>Kode OTP</span>
          ${o.code
            ? `<div class="codebox"><b>${esc(o.code)}</b><button class="btn btn-primary btn-small" data-copy="${esc(o.code)}">Salin</button></div>`
            : o.status === 'waiting'
              ? '<div class="codebox waiting"><b>Menunggu SMS masuk…</b><span class="spinner" style="margin-right:8px"></span></div>'
              : '<div class="codebox waiting" style="background:#0E1626;border-color:var(--line)"><b style="color:var(--muted)">Tidak ada kode</b></div>'}
        </div>
      </section>
      ${active ? `<section class="card" style="flex-direction:row;align-items:center;padding:14px 16px">
        <span class="muted">${ICON.clock}</span>
        <div class="grow"><div style="font-weight:600">Sisa waktu <span id="left">${mmss(o.expiresAt - Date.now())}</span></div>
        <div class="small muted">Kode tidak masuk? Batalkan, saldo kembali otomatis.</div></div></section>` : ''}
      ${o.status === 'waiting' ? `<div class="row"><button class="btn btn-danger" id="cancel">Batalkan</button><a class="btn btn-ghost" href="#/beranda">Beli lagi</a></div>` : ''}
      ${o.status === 'received' ? `<button class="btn btn-primary" id="finish">Selesai</button>` : ''}
      ${!active ? `<a class="btn btn-primary" href="#/beranda">Beli nomor lagi</a>` : ''}
    </div>`;
    document.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => copy(b.dataset.copy); });
    const cancel = document.getElementById('cancel');
    if (cancel) cancel.onclick = async () => {
      cancel.disabled = true;
      try { o = (await api('POST', '/order/' + encodeURIComponent(o.id) + '/cancel')).order; toast('Dibatalkan. Saldo sudah kembali.'); draw(); }
      catch (err) { toast(err.message); cancel.disabled = false; }
    };
    const finish = document.getElementById('finish');
    if (finish) finish.onclick = async () => {
      finish.disabled = true;
      try { o = (await api('POST', '/order/' + encodeURIComponent(o.id) + '/finish')).order; toast('Pesanan selesai'); draw(); }
      catch (err) { toast(err.message); finish.disabled = false; }
    };
  };
  draw();

  every(1000, () => {
    const el = document.getElementById('left');
    if (el) el.textContent = mmss(o.expiresAt - Date.now());
  });
  every(4000, async () => {
    if (o.status !== 'waiting') return;
    try {
      const r = await api('GET', '/order/' + encodeURIComponent(o.id));
      if (r.order.status !== o.status || r.order.code !== o.code) {
        o = r.order; draw();
        if (o.code) toast('Kode masuk!');
      }
    } catch (e) {}
  });
}

async function screenHistory() {
  const { orders } = await api('GET', '/orders');
  $app.innerHTML = `<div class="topbar" style="padding-left:20px"><h1>Pesanan saya</h1></div>
  <div class="page"><ul class="list">
    ${orders.length ? orders.map((o) => `
      <li><a class="item click" href="#/pesanan/${encodeURIComponent(o.id)}">
        ${appIcon({ id: o.service, name: o.serviceName })}
        <span class="grow"><span style="display:block;font-weight:700">${esc(o.serviceName)} · ${esc(o.countryName)}</span>
        <span class="small muted">${esc(o.phone)} · ${rp(o.price)}</span></span>
        ${pill(o.status)}</a></li>`).join('') : '<li class="empty">Belum ada pesanan. Yuk beli nomor pertama kamu.</li>'}
  </ul></div>`;
}

/* =========================================================
   BAGIAN 10: DEPOSIT
   ========================================================= */
async function screenDeposit() {
  const user = await refreshMe();
  let amount = CONFIG.AMOUNTS[0];
  $app.innerHTML = `<div class="topbar" style="padding-left:20px"><h1>Deposit saldo</h1></div>
  <div class="page">
    ${demoBanner()}
    <p class="muted">Saldo sekarang: <b style="color:var(--text)">${rp(user.balance)}</b></p>
    <div class="field"><span>Pilih jumlah</span>
      <div class="amounts">${CONFIG.AMOUNTS.map((a) => `<button data-a="${a}">${rp(a)}</button>`).join('')}</div></div>
    <label class="field"><span>Atau isi sendiri (min. ${rp(CONFIG.MIN_DEPOSIT)})</span>
      <input class="input" id="custom" inputmode="numeric" placeholder="Rp"></label>
    <button class="btn btn-primary" id="make">Buat QRIS</button>
    <div id="pay"></div>
  </div>`;
  const btns = [...document.querySelectorAll('.amounts button')];
  const mark = () => btns.forEach((b) => b.classList.toggle('on', +b.dataset.a === amount));
  btns.forEach((b) => { b.onclick = () => { amount = +b.dataset.a; document.getElementById('custom').value = ''; mark(); }; });
  mark();
  document.getElementById('custom').oninput = (e) => {
    const v = +e.target.value.replace(/\D/g, '');
    e.target.value = v ? num(v) : '';
    amount = v; mark();
  };
  document.getElementById('make').onclick = async (e) => {
    if (!amount || amount < CONFIG.MIN_DEPOSIT) return toast('Minimal deposit ' + rp(CONFIG.MIN_DEPOSIT));
    e.target.disabled = true;
    try {
      const { deposit } = await api('POST', '/deposit', { amount });
      showPayment(deposit);
    } catch (err) { toast(err.message); }
    e.target.disabled = false;
  };
}

 function showPayment(d) {
  const box = document.getElementById('pay');
  const draw = () => {
    const paid = d.status === 'paid';
    const expired = d.status === 'expired' || (!paid && Date.now() > d.expiresAt);
    box.innerHTML = `<section class="card" style="align-items:stretch">
      <div class="row between"><b>Bayar pakai QRIS</b><span class="muted">${rp(d.amount)}</span></div>
      ${paid ? `<div class="empty" style="color:#7CEBAE;font-weight:700">Pembayaran berhasil! Saldo sudah masuk.</div>
        <a class="btn btn-primary" href="#/beranda">Beli nomor sekarang</a>` : `
      <div class="qr">${d.qrImage ? `<img src="${esc(d.qrImage)}" alt="Kode QRIS">` : '<div class="ph">QRIS muncul di sini</div>'}</div>
      ${d.paymentUrl ? `<a class="btn btn-ghost" href="${esc(d.paymentUrl)}" target="_blank" rel="noopener">Buka halaman bayar</a>` : ''}
      <p class="small muted" style="text-align:center">Scan pakai DANA, OVO, GoPay, ShopeePay, atau m-banking. Saldo masuk otomatis setelah bayar.</p>
      <div class="row" style="justify-content:center">
        ${expired ? '<span class="pill bad">QRIS kedaluwarsa, buat baru</span>'
          : `<span class="pill wait">Menunggu pembayaran · <span id="dleft">${mmss(d.expiresAt - Date.now())}</span></span>`}
      </div>`}
    </section>`;
  };
  draw();
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  stopTimers();
  every(1000, () => { const el = document.getElementById('dleft'); if (el) el.textContent = mmss(d.expiresAt - Date.now()); });
  every(5000, async () => {
    if (d.status !== 'pending') return;
    try {
      const r = await api('GET', '/deposit/' + encodeURIComponent(d.id));
      if (r.deposit.status !== d.status) { d = r.deposit; draw(); if (d.status === 'paid') toast('Saldo masuk ' + rp(d.amount)); }
    } catch (e) {}
  });
}

/* =========================================================
   BAGIAN 11: AKUN & ADMIN
   ========================================================= */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

async function screenAccount() {
  const u = await refreshMe();
  $app.innerHTML = `<div class="topbar" style="padding-left:20px"><h1>Akun</h1></div>
  <div class="page">
    <section class="card">
      <div class="row"><span class="app-ic" style="width:48px;height:48px;border-radius:24px">${esc((u.name || '?').charAt(0).toUpperCase())}</span>
      <div class="grow"><div style="font-weight:700">${esc(u.name)}</div><div class="small muted">${esc(u.email)}</div></div></div>
      <div class="row between"><span class="muted">Saldo</span><b>${rp(u.balance)}</b></div>
    </section>
    <a class="btn btn-ghost" href="#/riwayat">Riwayat pesanan</a>
    <button class="btn btn-ghost" id="install">Pasang aplikasi di HP</button>
    <a class="btn btn-ghost" href="${esc(CONFIG.ADMIN_TELEGRAM)}" target="_blank" rel="noopener">Hubungi admin</a>
    ${u.role === 'admin' ? '<a class="btn btn-ghost" href="#/admin">Halaman admin</a>' : ''}
    <button class="btn btn-danger" id="logout">Keluar</button>
  </div>`;
  document.getElementById('install').onclick = async () => {
    if (installEvt) { installEvt.prompt(); installEvt = null; }
    else toast('Buka menu browser (⋮) lalu pilih "Tambahkan ke Layar utama"');
  };
  document.getElementById('logout').onclick = () => { store.del('token'); state.user = null; go('#/masuk'); };
}

async function screenAdmin() {
  const u = await refreshMe();
  if (u.role !== 'admin') return go('#/beranda');
  const s = await api('GET', '/admin/summary');
  $app.innerHTML = `<div class="topbar"><a class="icon-btn" href="#/akun" aria-label="Kembali">${ICON.back}</a><h1>Admin</h1></div>
  <div class="page">
    <section class="card">
      <span class="small muted">Saldo Grizzly (modal)</span>
      <div class="row" style="align-items:baseline"><span class="big">$${Number(s.grizzlyBalanceUsd).toFixed(2)}</span>
        <span class="muted small">≈ ${rp(s.grizzlyBalanceUsd * s.settings.kurs)}</span></div>
      ${s.grizzlyBalanceUsd < 2 ? '<div class="banner">Saldo Grizzly hampir habis. Segera isi ulang.</div>' : ''}
    </section>
    <div class="amounts">
      <div class="card" style="gap:4px"><span class="small muted">Terjual hari ini</span><b style="font-size:20px">${num(s.soldToday)}</b></div>
      <div class="card" style="gap:4px"><span class="small muted">Untung hari ini</span><b style="font-size:20px">${rp(s.profitToday)}</b></div>
    </div>
    <form class="card" id="f">
      <h2 class="title">Pengaturan harga</h2>
      <label class="row between"><span>Untung per nomor (Rp)</span><input class="input" style="width:130px;text-align:right" name="profit" inputmode="numeric" value="${s.settings.profit}"></label>
      <label class="row between"><span>Kurs $1 (Rp)</span><input class="input" style="width:130px;text-align:right" name="kurs" inputmode="numeric" value="${s.settings.kurs}"></label>
      <label class="row between"><span>Bulatkan ke atas (Rp)</span><input class="input" style="width:130px;text-align:right" name="rounding" inputmode="numeric" value="${s.settings.rounding}"></label>
      <p class="small muted" style="line-height:1.5">Harga jual = modal Grizzly × kurs + untung, dibulatkan ke atas. Berlaku untuk semua negara dan semua tingkat harga.</p>
      <button class="btn btn-primary" type="submit">Simpan</button>
    </form>
  </div>`;
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { profit: +fd.get('profit') || 0, kurs: +fd.get('kurs') || 0, rounding: +fd.get('rounding') || 1 };
    if (body.kurs < 1000) return toast('Kurs tidak masuk akal');
    try { await api('POST', '/admin/settings', body); toast('Pengaturan disimpan'); }
    catch (err) { toast(err.message); }
  };
}

/* =========================================================
   BAGIAN 12: MULAI
   ========================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
route();
          
                                                     
