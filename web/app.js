/* SafePay Escrow — zero-build vanilla SPA client for the escrow REST API. */
(() => {
  'use strict';

  const API = window.APP_CONFIG.API_BASE;
  const TOKEN_KEY = 'safepay.token';

  // ---------- tiny helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (cents, cur = 'KES') => `${cur} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const when = (d) => new Date(d).toLocaleString();

  // ---------- gradient SVG icon set ----------
  const ICONS = {
    shield: '<path fill="url(#gP)" stroke="#eadfff" stroke-opacity=".55" stroke-width=".4" d="M12 1.7l7.8 3.24c.48.2.8.68.8 1.2v5.06c0 5.28-3.53 9.72-8.6 11.03C6.93 20.92 3.4 16.48 3.4 11.2V6.14c0-.52.32-1 .8-1.2L12 1.7z"/><path fill="#fff" d="M10.5 16.4l-3.6-3.6 1.95-1.95 1.65 1.65 4.7-4.7 1.95 1.95-6.6 6.65z"/>',
    mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.8" fill="url(#gB)"/><rect x="2.5" y="4.5" width="19" height="6" rx="2.8" fill="#fff" opacity=".14"/><path fill="#fff" opacity=".95" d="M4.4 7.1l6.98 5.1c.37.27.87.27 1.24 0l6.98-5.1c-.17-.12-.37-.1-.6-.1H5c-.23 0-.43-.02-.6.1z"/>',
    key: '<path fill="url(#gPk)" d="M15.5 2a6.5 6.5 0 00-6.28 8.2L2 17.42V22h4.6v-2.2h2.2v-2.2h2.2l1.02-1.02A6.5 6.5 0 1015.5 2zm1.8 5.2a1.6 1.6 0 11-3.2 0 1.6 1.6 0 013.2 0z"/><circle cx="15.6" cy="7" r="1.3" fill="#fff" opacity=".5"/>',
    lock: '<path fill="none" stroke="#c9f0e2" stroke-width="2.4" stroke-linecap="round" d="M7.6 11V7.1a4.4 4.4 0 018.8 0V11"/><rect x="4.1" y="10.4" width="15.8" height="11.4" rx="3" fill="url(#gG)"/><rect x="4.1" y="10.4" width="15.8" height="4.8" rx="3" fill="#fff" opacity=".22"/><circle cx="12" cy="15.4" r="2.1" fill="#06331e"/><path fill="#06331e" d="M11 15.2h2l-.55 3.7h-.9z"/>',
    scales: '<g fill="url(#gPk)"><circle cx="12" cy="3.9" r="1.9"/><rect x="11" y="4.4" width="2" height="14.8" rx="1"/><rect x="6.4" y="18.7" width="11.2" height="2.4" rx="1.2"/><rect x="3.8" y="7.1" width="16.4" height="1.9" rx=".95"/></g><path fill="url(#gPk)" opacity=".9" d="M4 8.4L1.1 14h5.8L4 8.4zm16 0L17.1 14h5.8L20 8.4z"/><path fill="#fff" opacity=".22" d="M11 4.4h2v14.8h-2z"/>',
    star: '<path fill="url(#gGold)" d="M12 2.4l2.98 6.04 6.66.97-4.82 4.7 1.14 6.63L12 17.66l-5.96 3.08 1.14-6.63L2.36 9.41l6.66-.97L12 2.4z"/><path fill="#fff" opacity=".3" d="M12 2.4l2.98 6.04 6.66.97-4.82 4.7L12 12z"/>',
    bell: '<path fill="url(#gP)" d="M12 2a6 6 0 00-6 6c0 3.6-1 5.35-1.83 6.28-.62.7-.12 1.82.83 1.82h14c.95 0 1.45-1.12.83-1.82C19 13.35 18 11.6 18 8a6 6 0 00-6-6z"/><path fill="#fff" opacity=".18" d="M12 2a6 6 0 00-6 6c0 1-.08 1.85-.22 2.6C9 8.6 15 8.6 18.2 10.6 18.08 9.85 18 9 18 8a6 6 0 00-6-6z"/><path fill="url(#gP)" d="M9.5 19.2a2.5 2.5 0 005 0h-5z"/>',
    inbox: '<path fill="url(#gB)" d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm-.7 11H8a1 1 0 011 1 3 3 0 006 0 1 1 0 011-1h3.7L16.4 6.35A1 1 0 0015.5 6h-7a1 1 0 00-.9.55L4.3 14z"/><rect x="3" y="3" width="18" height="7" rx="2" fill="#fff" opacity=".12"/>',
    user: '<circle cx="12" cy="7.6" r="4.5" fill="url(#gP)"/><circle cx="12" cy="7.6" r="4.5" fill="#fff" opacity=".14"/><path fill="url(#gP)" d="M3.2 20.6a8.8 8.8 0 0117.6 0 1 1 0 01-1 1.1H4.2a1 1 0 01-1-1.1z"/>',
    check: '<path fill="url(#gG)" d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-4-4 1.5-1.5 2.5 2.5 5-5 1.5 1.5-6.5 6.5z"/>',
    chat: '<path fill="url(#gP)" d="M12 2.6c-5.4 0-9.7 3.65-9.7 8.15 0 2.5 1.32 4.72 3.4 6.2v4.15l3.85-2.12c.77.16 1.6.25 2.45.25 5.4 0 9.7-3.65 9.7-8.48S17.4 2.6 12 2.6z"/><g fill="#fff" opacity=".95"><circle cx="8.1" cy="10.75" r="1.15"/><circle cx="12" cy="10.75" r="1.15"/><circle cx="15.9" cy="10.75" r="1.15"/></g>',
    whatsapp: '<path fill="#25D366" d="M12 2.15A9.85 9.85 0 002.15 12c0 1.74.46 3.37 1.27 4.78L2.1 21.9l5.25-1.29A9.8 9.8 0 1012 2.15z"/><path fill="#fff" d="M9.29 7.03c-.2-.46-.4-.47-.6-.48h-.5c-.18 0-.47.07-.71.33-.24.26-.93.9-.93 2.2 0 1.3.95 2.55 1.08 2.73.13.18 1.84 2.94 4.53 4.01 2.24.88 2.69.7 3.18.66.48-.05 1.56-.64 1.78-1.26.22-.62.22-1.15.16-1.26-.07-.11-.25-.18-.51-.31-.26-.13-1.56-.77-1.8-.86-.25-.09-.42-.13-.6.13-.17.26-.68.86-.83 1.04-.15.18-.31.2-.57.07-.26-.13-1.11-.41-2.11-1.31-.78-.7-1.31-1.56-1.46-1.82-.15-.26-.02-.4.11-.53.12-.12.26-.31.39-.46.13-.16.17-.27.26-.45.09-.18.04-.33-.02-.46-.06-.13-.57-1.43-.8-1.96z"/>',
  };
  const icon = (name, size = 20) =>
    `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  // Shield logo with a light-shine sweep clipped to the shield shape.
  const brandLogo = () => '';

  // ---------- remembered emails (custom, theme-matched history) ----------
  const EMAILS_KEY = 'safepay.emails';
  const getEmails = () => { try { return JSON.parse(localStorage.getItem(EMAILS_KEY)) || []; } catch { return []; } };
  const rememberEmail = (email) => {
    email = (email || '').trim();
    if (!email) return;
    const list = [email, ...getEmails().filter((e) => e !== email)].slice(0, 6);
    localStorage.setItem(EMAILS_KEY, JSON.stringify(list));
  };

  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast ${kind}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  // ---------- auth/session ----------
  const session = {
    get token() { return localStorage.getItem(TOKEN_KEY); },
    set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
    get claims() {
      const t = this.token;
      if (!t) return null;
      try {
        const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 < Date.now()) { this.token = null; return null; }
        return payload; // { sub, role, exp }
      } catch { return null; }
    },
    get isAuthed() { return !!this.claims; },
    get isAdmin() { return this.claims?.role === 'ADMIN'; },
    get userId() { return this.claims?.sub; },
  };

  // ---------- API client ----------
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('We could not reach SafePay. Please check your internet connection and try again.');
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }
    if (!res.ok) {
      if (res.status === 401 && session.isAuthed) { session.token = null; renderNav(); }
      throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
    }
    return data;
  }

  // ---------- router ----------
  const routes = {};
  function route(name, fn) { routes[name] = fn; }
  function go(name, params) {
    location.hash = name + (params ? '?' + new URLSearchParams(params) : '');
  }
  async function render() {
    const [rawName, qs] = location.hash.replace(/^#/, '').split('?');
    const name = rawName || (session.isAuthed ? 'dashboard' : 'home');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    const fn = routes[name] || routes.dashboard;

    // route guards
    const publicRoutes = ['home', 'login', 'register'];
    if (!session.isAuthed && !publicRoutes.includes(name)) return go('home');
    if (session.isAuthed && publicRoutes.includes(name)) return go('dashboard');

    // Immersive full-bleed layout for the auth screens.
    const isLand = name === 'home' || name === 'login' || name === 'register';
    document.body.classList.toggle('land-mode', isLand);
    document.body.classList.toggle('auth-mode', false);

    const view = $('#view');
    view.innerHTML = '<div class="spinner"></div>';
    renderNav(name);
    try {
      await fn(view, params);
    } catch (e) {
      view.innerHTML = '';
      view.appendChild(el(`<div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p></div>`));
    }
  }

  function renderNav(active) {
    const nav = $('#nav');
    nav.innerHTML = '';
    if (!session.isAuthed) {
      const I_USER = '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.8c0-4.3 3.4-6.7 7.5-6.7s7.5 2.4 7.5 6.7v.2h-15z"/></svg>';
      const I_USERPLUS = '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><circle cx="9.6" cy="8" r="3.8"/><path d="M2.2 20.8c0-4.3 3.3-6.7 7.4-6.7 1 0 2 .15 2.9.44-.5.8-.8 1.75-.8 2.76 0 1.3.45 2.5 1.2 3.5H2.2z"/><path d="M18 12.7h1.9v2.6h2.6v1.9h-2.6v2.6H18v-2.6h-2.6v-1.9H18z"/></svg>';
      const I_CHEV = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5.5l6.5 6.5L9 18.5"/></svg>';
      const lg = el('<a class="pillbtn pb-login"><span class="pb-ic">' + I_USER + '</span><i class="pb-div"></i><span class="pb-label">Log in</span><span class="pb-arrow">' + I_CHEV + '</span></a>');
      const su = el('<a class="pillbtn pb-signup"><span class="pb-ic">' + I_USERPLUS + '</span><i class="pb-div"></i><span class="pb-label">Sign up</span><span class="pb-arrow">' + I_CHEV + '</span></a>');
      lg.onclick = () => openAuth('login');
      su.onclick = () => openAuth('register');
      nav.appendChild(lg); nav.appendChild(su);
      syncSupport();
      return;
    }
    nav.appendChild(navLink('dashboard', 'My Escrows', active));
    nav.appendChild(navLink('new', 'New Escrow', active));
    if (session.isAdmin) nav.appendChild(navLink('admin', 'Admin', active));
    nav.appendChild(buildBell());
    const out = el('<a>Log out</a>');
    out.onclick = () => { stopBellPolling(); session.token = null; renderNav(); go('home'); };
    nav.appendChild(out);
    startBellPolling();
    syncSupport();
  }
  function navLink(name, label, active) {
    const a = el(`<a class="${active === name ? 'active' : ''}">${label}</a>`);
    a.onclick = () => go(name);
    return a;
  }

  function openModal(node) {
    const back = el('<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Close">×</button><div class="modal-body"></div></div></div>');
    back.querySelector('.modal-body').appendChild(node);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    let pressedOnBack = false;
    back.addEventListener('mousedown', (e) => { pressedOnBack = (e.target === back); });
    back.addEventListener('click', (e) => {
      if (e.target.closest('.modal-x')) { close(); return; }
      if (e.target === back && pressedOnBack) close();
      pressedOnBack = false;
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    return close;
  }
  function openAuth(mode) {
    let isLogin = mode === 'login';
    const host = el('<div class="auth-card"></div>');
    let close = () => {};
    function draw() {
      host.innerHTML = `
        <h2>${isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <p class="sub">${isLogin ? 'Log in to manage your escrow.' : 'Sign up to buy and sell safely with escrow protection.'}</p>
        <div class="form-err" id="aerr" hidden></div>
        <form id="af" autocomplete="off">
          ${isLogin ? '' : '<label>Full name</label><div class="field"><input name="fullName" required minlength="2" placeholder="e.g. Jane Wanjiku" /></div>'}
          <label>Email</label><div class="email-wrap"><div class="field"><input name="email" type="email" required autocomplete="off" placeholder="you@example.com" /></div><div class="email-history" hidden></div></div>
          ${isLogin ? '' : '<label>M-Pesa phone number</label><div class="field"><input name="phone" type="tel" required minlength="10" placeholder="e.g. 0712 345678" /></div>'}
          <label>Password</label><div class="field"><input name="password" type="password" required minlength="8" placeholder="At least 8 characters" /></div>
          <button type="submit" class="btn-cta modal-submit">${isLogin ? 'Log in' : 'Create account'} <span class="arr">→</span></button>
        </form>
        <p class="auth-swap">${isLogin ? 'New to SafePay?' : 'Already have an account?'} <span class="link" id="swap">${isLogin ? 'Create an account' : 'Log in'}</span></p>
        <p class="auth-trust">${icon('lock', 13)} 256-bit encrypted · Your credentials are never shared</p>`;
      host.querySelector('#swap').onclick = () => { isLogin = !isLogin; draw(); };
      const emailInput = host.querySelector('input[name=email]');
      const histBox = host.querySelector('.email-history');
      if (emailInput && histBox) {
        const showHist = () => {
          const q = emailInput.value.trim().toLowerCase();
          const list = getEmails().filter((em) => !q || em.toLowerCase().includes(q));
          if (!list.length) { histBox.hidden = true; return; }
          histBox.innerHTML = '';
          list.forEach((em) => {
            const item = el('<div class="eh-item">' + icon('mail', 16) + '<span>' + esc(em) + '</span></div>');
            item.onmousedown = (ev) => { ev.preventDefault(); emailInput.value = em; histBox.hidden = true; };
            histBox.appendChild(item);
          });
          histBox.hidden = false;
        };
        emailInput.addEventListener('focus', showHist);
        emailInput.addEventListener('input', showHist);
        emailInput.addEventListener('blur', () => setTimeout(() => { histBox.hidden = true; }, 160));
      }
      host.querySelector('#af').onsubmit = async (e) => {
        e.preventDefault();
        const btn = host.querySelector('button[type=submit]'); btn.disabled = true;
        const errBox = host.querySelector('#aerr'); if (errBox) errBox.hidden = true;
        const fd = new FormData(e.target);
        try {
          const b = { email: fd.get('email'), password: fd.get('password') };
          if (!isLogin) { b.fullName = fd.get('fullName'); b.phone = fd.get('phone'); }
          const { token } = await api('/auth/' + (isLogin ? 'login' : 'register'), { method: 'POST', body: b });
          session.token = token; rememberEmail(fd.get('email'));
          toast(isLogin ? 'Logged in' : 'Account created', 'ok');
          close(); renderNav(); go('dashboard');
        } catch (err) { if (errBox) { errBox.textContent = err.message; errBox.hidden = false; } toast(err.message, 'err'); btn.disabled = false; }
      };
    }
    close = openModal(host);
    try { draw(); } catch (e) { host.innerHTML = '<h2>Could not open</h2><p class="sub">' + esc(e.message) + '</p>'; }
  }
  function openOrderWizard() {
    const host = el('<div class="wiz"></div>');
    let close = () => {};
    let step = 1, created = null;
    const data = { sellerEmail: '', description: '', amount: '', method: 'MPESA' };
    const names = ['Order', 'Payment', 'Done'];
    const stepper = () => `<div class="wiz-steps">${names.map((s, i) => `<span class="wiz-step${i + 1 === step ? ' on' : ''}${i + 1 < step ? ' done' : ''}"><b>${i + 1}</b><em>${s}</em></span>`).join('')}</div>`;
    function draw() {
      if (step === 1) {
        host.innerHTML = stepper() + `
          <h2>Create an order</h2>
          <p class="sub">As the buyer, you deposit funds into escrow. They stay locked until you confirm delivery.</p>
          <form id="w1">
            <label>Seller email</label><div class="field"><input name="sellerEmail" type="email" required placeholder="seller@example.com" value="${esc(data.sellerEmail)}" /></div>
            <label>What are you buying?</label><textarea name="description" required minlength="3" maxlength="500" placeholder="e.g. iPhone 13, 128GB, sealed">${esc(data.description)}</textarea>
            <label>Amount (KES)</label><div class="field"><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" value="${esc(data.amount)}" /></div>
            <button type="submit" class="btn-cta modal-submit">Continue to payment <span class="arr">→</span></button>
          </form>`;
        host.querySelector('#w1').onsubmit = (e) => {
          e.preventDefault(); const fd = new FormData(e.target);
          data.sellerEmail = fd.get('sellerEmail'); data.description = fd.get('description'); data.amount = fd.get('amount');
          step = 2; draw();
        };
      } else if (step === 2) {
        host.innerHTML = stepper() + `
          <h2>Payment</h2>
          <p class="sub">Your money is locked in escrow — the seller is paid only after you confirm delivery.</p>
          <div class="pay-methods">${[['MPESA', 'M-Pesa'], ['PAYPAL', 'PayPal'], ['VISA', 'Visa Card']].map((m) => `<label class="pay-opt${data.method === m[0] ? ' on' : ''}"><input type="radio" name="pm" value="${m[0]}"${data.method === m[0] ? ' checked' : ''} /> ${m[1]}</label>`).join('')}</div>
          <div class="wiz-summary">
            <div><span>To</span><b>${esc(data.sellerEmail)}</b></div>
            <div><span>Item</span><b>${esc(data.description)}</b></div>
            <div><span>Amount held</span><b>KES ${Number(data.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
          </div>
          <div class="btn-row"><button type="button" class="btn-cta ghost" id="back">Back</button><button type="button" class="btn-cta" id="pay">Pay &amp; lock in escrow <span class="arr">→</span></button></div>`;
        host.querySelectorAll('input[name=pm]').forEach((r) => r.onchange = () => { data.method = r.value; draw(); });
        host.querySelector('#back').onclick = () => { step = 1; draw(); };
        host.querySelector('#pay').onclick = async () => {
          const btn = host.querySelector('#pay'); btn.disabled = true;
          try {
            created = await api('/transactions', { method: 'POST', body: { sellerEmail: data.sellerEmail, description: data.description, amountCents: Math.round(parseFloat(data.amount) * 100), method: data.method, currency: 'KES' } });
            step = 3; draw();
          } catch (err) { if (errBox) { errBox.textContent = err.message; errBox.hidden = false; } toast(err.message, 'err'); btn.disabled = false; }
        };
      } else {
        host.innerHTML = stepper() + `
          <div class="wiz-done">
            <div class="wiz-check">${icon('check', 52)}</div>
            <h2>Money is safe in escrow</h2>
            <p class="sub">KES ${Number(data.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} is locked for "${esc(data.description)}". The seller ships next; confirm on delivery to release the payment.</p>
            <button type="button" class="btn-cta modal-submit" id="view">View this escrow <span class="arr">→</span></button>
          </div>`;
        host.querySelector('#view').onclick = () => { close(); go('tx', { id: created.id }); };
      }
    }
    close = openModal(host);
    try { draw(); } catch (e) { host.innerHTML = '<h2>Could not open</h2><p class="sub">' + esc(e.message) + '</p>'; }
  }
  async function openDealFlow(id) {
    const host = el('<div class="deal"></div>');
    const STAR = '☆', STARF = '★';
    let close = () => {};
    const stages = ['CREATED', 'PAYMENT_PENDING', 'HELD', 'SHIPPED', 'DELIVERED', 'RELEASED'];
    function tracker(status) {
      let cur = stages.indexOf(status); if (cur < 0) cur = 2;
      return '<div class="deal-track">' + stages.map(function (s, i) { return '<span class="dt' + (i <= cur ? ' on' : '') + '"><b></b><em>' + s.replace('_', ' ') + '</em></span>'; }).join('') + '</div>';
    }
    async function load() {
      host.innerHTML = '<div class="spinner"></div>';
      let t; try { t = await api('/transactions/' + id); } catch (e) { host.innerHTML = '<p class="sub">' + esc(e.message) + '</p>'; return; }
      draw(t);
    }
    function draw(t) {
      const isBuyer = t.buyerId === session.userId;
      const held = ['HELD', 'SHIPPED', 'DELIVERED'].includes(t.status);
      let actions;
      if (!isBuyer && t.status === 'HELD') actions = '<button class="btn-cta modal-submit" data-act="ship">Mark as shipped →</button>';
      else if (!isBuyer && t.status === 'SHIPPED') actions = '<button class="btn-cta modal-submit" data-act="delivered">Mark as delivered →</button>';
      else if (isBuyer && held) actions = '<button class="btn-cta modal-submit" data-act="confirm-received">Confirm received &amp; release →</button><button class="btn-cta ghost" data-act="dispute" style="width:100%;justify-content:center;margin-top:10px">Report a problem</button>';
      else if (t.status === 'RELEASED' && isBuyer && !t.rating) actions = '<div class="rate-row" id="rate">' + [1, 2, 3, 4, 5].map(function (s) { return '<span data-s="' + s + '">' + STAR + '</span>'; }).join('') + '</div><button class="btn-cta modal-submit" id="rateBtn">Submit rating →</button>';
      else actions = '<p class="sub" style="text-align:center;margin:10px 0 0">No action needed right now.</p>';
      host.innerHTML = '<h2>' + esc(t.description) + '</h2>' +
        '<div class="deal-meta"><span class="badge ' + t.status + '">' + t.status.replace('_', ' ') + '</span> <b>' + money(t.amountCents, t.currency) + '</b> <span class="muted">you are the ' + (isBuyer ? 'buyer' : 'seller') + '</span></div>' +
        tracker(t.status) + '<div class="deal-act">' + actions + '</div>' +
        manageRow(t, isBuyer) +
        '<p class="deal-link"><span class="link" id="full">View full details &amp; timeline</span></p>';
      host.querySelector('#full').onclick = function () { close(); go('tx', { id: id }); };
      host.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = async function () {
          const act = b.dataset.act;
          if (act === 'dispute') return drawDispute(t);
          if (act === 'edit') return drawEdit(t);
          if (act === 'cancel' && !confirm('Cancel this escrow? Any money held will be refunded to the buyer.')) return;
          if (act === 'confirm-received' && !confirm('Release the held funds to the seller? This cannot be undone.')) return;
          b.disabled = true;
          try { await api('/transactions/' + id + '/' + act, { method: 'POST' }); toast('Deal updated', 'ok'); await load(); }
          catch (e) { toast(e.message, 'err'); b.disabled = false; }
        };
      });
      const rr = host.querySelector('#rate');
      if (rr) {
        let score = 0;
        rr.querySelectorAll('span').forEach(function (st) { st.onclick = function () { score = +st.dataset.s; rr.querySelectorAll('span').forEach(function (x) { x.textContent = (+x.dataset.s <= score) ? STARF : STAR; }); }; });
        host.querySelector('#rateBtn').onclick = async function () { if (!score) return toast('Pick a score', 'err'); try { await api('/ratings', { method: 'POST', body: { transactionId: id, score: score } }); toast('Thanks for rating', 'ok'); await load(); } catch (e) { toast(e.message, 'err'); } };
      }
    }
    function manageRow(t, isBuyer) {
      const open = ['CREATED', 'PAYMENT_PENDING', 'HELD'].includes(t.status);
      if (!open) return '';
      if (isBuyer) return '<div class="deal-manage"><button class="btn-cta ghost" data-act="edit">Edit details</button><button class="btn-cta danger" data-act="cancel">Cancel escrow</button></div>';
      return '<div class="deal-manage"><button class="btn-cta danger" data-act="cancel">Decline &amp; cancel</button></div>';
    }
    function drawEdit(t) {
      const amountOpen = t.status !== 'HELD';
      host.innerHTML = '<h2>Edit escrow</h2><p class="sub">You can change the details until the seller marks it shipped.</p>' +
        '<label>What are you buying?</label><textarea id="edesc" minlength="3" maxlength="500">' + esc(t.description) + '</textarea>' +
        (amountOpen
          ? '<label>Amount (KES)</label><div class="field"><input id="eamt" type="number" min="0.01" step="0.01" value="' + (t.amountCents / 100) + '" /></div>'
          : '<p class="field-hint">The amount cannot change once the money is held in escrow.</p>') +
        '<div class="btn-row"><button class="btn-cta ghost" id="eback">Back</button><button class="btn-cta" id="esave">Save changes</button></div>';
      host.querySelector('#eback').onclick = function () { draw(t); };
      host.querySelector('#esave').onclick = async function () {
        const body = {};
        const d = host.querySelector('#edesc').value.trim();
        if (d) body.description = d;
        const amtEl = host.querySelector('#eamt');
        if (amtEl) { const v = parseFloat(amtEl.value); if (v > 0) body.amountCents = Math.round(v * 100); }
        const btn = host.querySelector('#esave'); btn.disabled = true;
        try { await api('/transactions/' + id, { method: 'PATCH', body: body }); toast('Escrow updated', 'ok'); await load(); }
        catch (e) { toast(e.message, 'err'); btn.disabled = false; }
      };
    }
    function drawDispute(t) {
      host.innerHTML = '<h2>Report a problem</h2><p class="sub">Open a dispute. An admin reviews the evidence and decides.</p><label>What went wrong?</label><textarea id="reason" minlength="3" maxlength="1000" placeholder="Describe the problem"></textarea><label>Evidence URL (optional)</label><div class="field"><input id="ev" type="url" placeholder="https://link-to-photo" /></div><div class="btn-row"><button class="btn-cta ghost" id="dback">Back</button><button class="btn-cta danger" id="dsubmit">Submit dispute</button></div>';
      host.querySelector('#dback').onclick = function () { draw(t); };
      host.querySelector('#dsubmit').onclick = async function () {
        const reason = host.querySelector('#reason').value.trim(); const ev = host.querySelector('#ev').value.trim();
        if (reason.length < 3) return toast('Please describe the problem', 'err');
        try { await api('/disputes', { method: 'POST', body: { transactionId: id, reason: reason, evidenceUrls: ev ? [ev] : [] } }); toast('Dispute opened', 'ok'); await load(); }
        catch (e) { toast(e.message, 'err'); }
      };
    }
    close = openModal(host);
    await load();
  }
  // ================= ROUTES =================

  route('home', (view) => {
    view.innerHTML = '';
    const pics = Array.from({ length: 10 }, (_, i) => i + 1);
    // Only the first slide is fetched up front; the other nine are attached after it
    // paints (see warm() below), so the hero costs one image instead of ten.
    const slideTag = (n, first) => {
      const srcset = `assets/pictures/${n}-sm.webp 720w, assets/pictures/${n}.webp 1444w`;
      const attrs = `class="slide${first ? ' on' : ''}" sizes="(max-width: 900px) 92vw, 46vw"`
        + ` width="1444" height="1089" decoding="async" alt=""`;
      return first
        ? `<img src="assets/pictures/${n}.webp" srcset="${srcset}" ${attrs} fetchpriority="high" />`
        : `<img data-src="assets/pictures/${n}.webp" data-srcset="${srcset}" ${attrs} />`;
    };
    const wrap = el(`
      <div class="site">
        <section class="hero2">
          <div class="hero2-copy">
            <div class="auth-brand">${brandLogo()} SafePay <span>Escrow</span></div>
            <h1 class="hero2-title">Buy and sell online, bila wasiwasi.</h1>
            <p class="hero2-sub"><strong>Pesa yako iko salama.</strong> We hold the buyer money in escrow and release it to the seller only once delivery is confirmed — or an admin resolves the dispute.</p>
            <div class="hero2-cta">
              <button class="btn-cta" id="hSignup">Get started <span class="arr">→</span></button>
              <button class="btn-cta ghost" id="hLogin">Log in</button>
            </div>
          </div>
          <div class="slideshow">
            ${pics.map((n, i) => slideTag(n, i === 0)).join('')}
            <div class="dots">${pics.map((_, i) => `<span class="dot${i === 0 ? ' on' : ''}"></span>`).join('')}</div>
          </div>
        </section>
        <section class="stages2">
          <h2>How a deal moves, step by step</h2>
          <ol class="stage-strip"><li>Register</li><li>Sign in</li><li>Create order</li><li>Payment</li><li>Delivery</li><li>Confirmation</li></ol>
          <p class="stages2-note">Each step happens in its own window, one stage at a time.</p>
        </section>
        <section class="accord">
          <h2>Everything you want to know</h2>
          ${[
            ['How it works', 'The buyer pays into escrow, funds are held, the seller ships and marks delivered, the buyer confirms, and funds are released. If something goes wrong, an admin resolves a dispute.'],
            ['Escrow protection', 'The money is locked the moment a deal starts and is released to the seller only once delivery is confirmed, so neither side can be cheated.'],
            ['Dispute resolution', 'Either party can open a case with evidence. An admin reviews it and rules to release the funds to the seller or refund the buyer.'],
            ['Payments', 'Pay with M-Pesa, PayPal, or Visa. Every deposit, release, and refund is recorded in a payment ledger.'],
            ['Ratings and trust', 'After every completed deal, buyers rate sellers. A reputation score and the number of reviews are shown on each transaction.'],
            ['Is my money safe', 'Funds sit in escrow until delivery is confirmed. Passwords are encrypted, connections use HTTPS, and only the two parties and an admin can see a transaction.']
          ].map(function (row) { return `<details class="acc"><summary>${row[0]}<span class="acc-ic">+</span></summary><div class="acc-body">${row[1]}</div></details>`; }).join('')}
        </section>
        <footer class="site-foot">
          <div class="auth-brand">${brandLogo()} SafePay <span>Escrow</span></div>
          <p>SafePay holds funds in escrow until delivery is confirmed. Demo environment, payments are simulated.</p>
          <button class="btn-cta" id="fSignup">Get started <span class="arr">→</span></button>
        </footer>
      </div>`);
    view.appendChild(wrap);
    wrap.querySelector('#hLogin').onclick = () => openAuth('login');
    wrap.querySelector('#hSignup').onclick = () => openAuth('register');
    wrap.querySelector('#fSignup').onclick = () => openAuth('register');
    const slides = wrap.querySelectorAll('.slide'), dots = wrap.querySelectorAll('.dot');

    const idle = window.requestIdleCallback
      ? (fn) => requestIdleCallback(fn, { timeout: 1500 })
      : (fn) => setTimeout(fn, 300);

    /** Attaches a deferred slide's real source. Safe to call more than once. */
    const load = (img) => {
      if (!img || !img.dataset.src) return;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      delete img.dataset.src; delete img.dataset.srcset;
    };

    // Warm the remaining slides one at a time, and only while the browser is idle,
    // so they never compete with the visible slide or the rest of the page.
    const warm = (i) => {
      if (i >= slides.length) return;
      const next = () => idle(() => warm(i + 1));
      slides[i].addEventListener('load', next, { once: true });
      slides[i].addEventListener('error', next, { once: true });
      load(slides[i]);
    };
    if (slides[0] && slides[0].complete) idle(() => warm(1));
    else if (slides[0]) slides[0].addEventListener('load', () => idle(() => warm(1)), { once: true });

    let si = 0;
    const t = setInterval(() => {
      if (!slides.length || !slides[0].isConnected) return clearInterval(t);
      const ni = (si + 1) % slides.length;
      load(slides[ni]);   // never rotate onto a slide that has no source yet
      slides[si].classList.remove('on'); dots[si].classList.remove('on');
      si = ni;
      slides[si].classList.add('on'); dots[si].classList.add('on');
    }, 2600);
  });
  route('login', (v) => { routes.home(v); openAuth('login'); });
  route('register', (v) => { routes.home(v); openAuth('register'); });

  function authView(mode) {
    const isLogin = mode === 'login';
    return (view) => {
      view.innerHTML = '';
      const wrap = el(`
        <div class="auth-shell">
          <div class="auth-hero-center">
            <div class="auth-brand">${brandLogo()} SafePay <span>Escrow</span></div>
            <h2 class="auth-tagline">Karibu! Nunua na uuze bila wasiwasi.</h2>
            <p class="auth-lead"><strong>Pesa yako iko salama.</strong> We hold the buyer's money in escrow and release it to the seller only once delivery is confirmed — or an admin resolves the dispute.</p>
            <ul class="auth-features">
              <li><span class="af-ic">${icon('lock', 26)}</span><div><strong>Pesa salama in escrow</strong><em>Funds are locked the moment a deal starts.</em></div></li>
              <li><span class="af-ic">${icon('scales', 26)}</span><div><strong>Fair dispute resolution</strong><em>Open a case with evidence, an admin decides.</em></div></li>
              <li><span class="af-ic">${icon('star', 26)}</span><div><strong>Trusted reputations</strong><em>Ratings after every completed deal.</em></div></li>
            </ul>
            <div class="auth-pay"><span>Lipa na</span><b class="pay-chip">M-Pesa</b><b class="pay-chip">PayPal</b><b class="pay-chip">Visa</b></div>
          </div>
          <section class="auth-form">
            <div class="auth-form-inner">
              <h1>${isLogin ? 'Welcome back' : 'Create your account'}</h1>
              <p class="sub">${isLogin ? 'Log in to manage your escrow transactions.' : 'Sign up to buy and sell safely with escrow protection.'}</p>
              <form id="f" autocomplete="off">
                ${isLogin ? '' : `
                <label>Full name</label>
                <div class="field"><input name="fullName" type="text" required minlength="2" autocomplete="off" placeholder="e.g. Jane Wanjiku" /></div>`}
                <label>Email</label>
                <div class="email-wrap">
                  <div class="field"><input name="email" type="email" required autocomplete="off" placeholder="you@example.com" /></div>
                  <div class="email-history" hidden></div>
                </div>
                ${isLogin ? '' : `
                <label>M-Pesa phone number</label>
                <div class="field"><input name="phone" type="tel" required minlength="10" autocomplete="off" placeholder="e.g. 0712 345678" /></div>
                <p class="field-hint">${icon('lock', 12)} Where your money is sent when a deal completes.</p>`}
                <label>Password</label>
                <div class="field"><input name="password" type="password" required minlength="8" autocomplete="off" placeholder="At least 8 characters" /></div>
                <button type="submit" class="auth-submit">${isLogin ? 'Log in' : 'Create account'} <span class="arr">→</span></button>
              </form>
              <p class="auth-swap">${isLogin ? "New to SafePay?" : 'Already have an account?'} <span class="link" id="swap">${isLogin ? 'Create an account' : 'Log in'}</span></p>
              <p class="auth-trust">${icon('lock', 14)} 256-bit encrypted · Your credentials are never shared</p>
            </div>
          </section>
        </div>`);
      view.appendChild(wrap);
      const riseLayer = $('.auth-rise', wrap);
      if (riseLayer) {
        for (let k = 0; k < 12; k++) {
          const rim = document.createElement('img');
          // Small decorative thumbnails — the 720px variant is more than enough.
          rim.src = 'assets/pictures/' + ((k % 10) + 1) + '-sm.webp';
          rim.decoding = 'async';
          rim.className = 'rise-img';
          const setDir = () => {
            rim.style.setProperty('--ang', Math.round(Math.random() * 360) + 'deg');
            rim.style.setProperty('--dist', (26 + Math.random() * 24).toFixed(1) + 'vmin');
          };
          setDir();
          rim.style.animationDelay = (k * 0.5).toFixed(2) + 's';
          rim.style.animationDuration = (5 + Math.random() * 3).toFixed(1) + 's';
          rim.addEventListener('animationiteration', setDir);
          riseLayer.appendChild(rim);
        }
      }
      $('#swap', wrap).onclick = () => go(isLogin ? 'register' : 'login');

      // Custom, theme-matched email history — shows addresses used on this app.
      const emailInput = $('input[name=email]', wrap);
      const histBox = $('.email-history', wrap);
      const showHist = () => {
        const q = emailInput.value.trim().toLowerCase();
        const emails = getEmails().filter((em) => !q || em.toLowerCase().includes(q));
        if (!emails.length) { histBox.hidden = true; return; }
        histBox.innerHTML = '';
        emails.forEach((em) => {
          const item = el(`<div class="eh-item">${icon('mail', 16)}<span>${esc(em)}</span></div>`);
          item.onmousedown = (ev) => { ev.preventDefault(); emailInput.value = em; histBox.hidden = true; };
          histBox.appendChild(item);
        });
        histBox.hidden = false;
      };
      emailInput.addEventListener('focus', showHist);
      emailInput.addEventListener('input', showHist);
      emailInput.addEventListener('blur', () => setTimeout(() => { histBox.hidden = true; }, 150));

      $('#f', wrap).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('button', e.target); btn.disabled = true;
        const fd = new FormData(e.target);
        try {
          const body = { email: fd.get('email'), password: fd.get('password') };
          if (!isLogin) { body.fullName = fd.get('fullName'); body.phone = fd.get('phone'); }
          const { token } = await api(`/auth/${mode}`, { method: 'POST', body });
          session.token = token;
          rememberEmail(fd.get('email'));
          toast(isLogin ? 'Logged in' : 'Account created', 'ok');
          renderNav();
          go('dashboard');
        } catch (err) {
          toast(err.message, 'err');
          btn.disabled = false;
        }
      };
    };
  }

  route('dashboard', async (view) => {
    const txs = await api('/transactions');
    view.innerHTML = '';
    view.appendChild(el(`<div class="row-between"><h1>My Escrows</h1></div>`));
    view.appendChild(el(`<p class="sub">Funds are held safely until the buyer confirms delivery or an admin resolves a dispute.</p>`));

    const card = el('<div class="card"></div>');
    if (!txs.length) {
      card.appendChild(el(`<div class="empty">
        <div>${icon('inbox', 46)}</div>
        <div style="margin-top:10px">No transactions yet.</div>
        <span class="link" id="mk">Create your first escrow →</span>
      </div>`));
      card.querySelector('#mk').onclick = () => go('new');
    } else {
      const table = el(`<table><thead><tr>
        <th>Description</th><th>Amount</th><th>Role</th><th>Method</th><th>Status</th><th>Created</th>
      </tr></thead><tbody></tbody></table>`);
      const tb = $('tbody', table);
      for (const t of txs) {
        const role = t.buyerId === session.userId ? 'Buyer' : 'Seller';
        const tr = el(`<tr class="clickable">
          <td>${esc(t.description)}</td>
          <td>${money(t.amountCents, t.currency)}</td>
          <td>${role}</td>
          <td>${t.method}</td>
          <td><span class="badge ${t.status}">${t.status}</span></td>
          <td class="muted">${when(t.createdAt)}</td>
        </tr>`);
        tr.onclick = () => openDealFlow(t.id);
        tb.appendChild(tr);
      }
      card.appendChild(table);
    }
    view.appendChild(card);
  });

  route('new', async (view) => {
    view.innerHTML = '';
    view.appendChild(el('<h1>New Escrow</h1>'));
    view.appendChild(el('<p class="sub">As the buyer, you deposit funds now. They stay locked until you confirm you received the goods.</p>'));
    const card = el(`<div class="card">
      <form id="f">
        <label>Seller's email</label>
        <input name="sellerEmail" type="email" required placeholder="seller@example.com" />
        <label>What are you buying?</label>
        <textarea name="description" required minlength="3" maxlength="500" placeholder="e.g. iPhone 13, 128GB, sealed"></textarea>
        <label>Amount</label>
        <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
        <label>Currency</label>
        <input name="currency" value="KES" maxlength="3" />
        <label>Payment method</label>
        <select name="method">
          <option value="MPESA">M-Pesa</option>
          <option value="PAYPAL">PayPal</option>
          <option value="VISA">Visa Card</option>
        </select>
        <div class="btn-row">
          <button type="submit">Deposit into escrow</button>
          <button type="button" class="ghost" id="cancel">Cancel</button>
        </div>
      </form>
    </div>`);
    view.appendChild(card);
    $('#cancel', card).onclick = () => go('dashboard');
    $('#f', card).onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target); btn.disabled = true;
      const fd = new FormData(e.target);
      try {
        const tx = await api('/transactions', {
          method: 'POST',
          body: {
            sellerEmail: fd.get('sellerEmail'),
            description: fd.get('description'),
            amountCents: Math.round(parseFloat(fd.get('amount')) * 100),
            method: fd.get('method'),
            currency: (fd.get('currency') || 'KES').toUpperCase(),
          },
        });
        toast('Funds deposited and held in escrow', 'ok');
        go('tx', { id: tx.id });
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
      }
    };
  });

  route('tx', async (view, { id }) => {
    // A party fetches via the escrow route; an admin who isn't a party uses the admin route.
    let t;
    try {
      t = await api(`/transactions/${id}`);
    } catch (e) {
      if (session.isAdmin) t = await api(`/admin/transactions/${id}`);
      else throw e;
    }
    const isBuyer = t.buyerId === session.userId;
    view.innerHTML = '';

    view.appendChild(el(`<div class="row-between">
      <h1>${esc(t.description)}</h1>
      <span class="badge ${t.status}">${t.status}</span>
    </div>`));

    const rep = t.sellerReputation;
    const repText = rep && rep.count
      ? `<span class="stars">${'★'.repeat(Math.round(rep.average))}${'☆'.repeat(5 - Math.round(rep.average))}</span> ${rep.average} · ${rep.count} review${rep.count === 1 ? '' : 's'}`
      : 'No reviews yet';
    const info = el(`<div class="card">
      <div class="row-between"><div><div class="muted">Amount</div><div style="font-size:22px;font-weight:700">${money(t.amountCents, t.currency)}</div></div>
      <div><div class="muted">Payment</div><div>${t.method}</div></div>
      <div><div class="muted">Your role</div><div>${isBuyer ? 'Buyer' : 'Seller'}</div></div>
      <div><div class="muted">Seller</div><div>${esc(t.seller?.fullName || t.seller?.email || '—')}</div></div>
      <div><div class="muted">Seller reputation</div><div>${repText}</div></div>
      <div><div class="muted">Gateway ref</div><div class="mono">${esc(t.gatewayRef || '—')}</div></div></div>
    </div>`);
    view.appendChild(info);

    // Funds are locked in escrow while HELD, SHIPPED or DELIVERED.
    const heldStates = ['HELD', 'SHIPPED', 'DELIVERED'];
    const post = (path, okMsg, confirmMsg) => async () => {
      if (confirmMsg && !confirm(confirmMsg)) return;
      try { await api(`/transactions/${id}/${path}`, { method: 'POST' }); toast(okMsg, 'ok'); render(); }
      catch (e) { toast(e.message, 'err'); }
    };

    // Actions
    const actions = el('<div class="card"><h2>Actions</h2><div class="btn-row" id="acts"></div></div>');
    const acts = $('#acts', actions);
    if (heldStates.includes(t.status)) {
      if (!isBuyer && t.status === 'HELD') {
        const s = el('<button>Mark as shipped</button>');
        s.onclick = post('ship', 'Buyer notified — marked shipped');
        acts.appendChild(s);
      }
      if (!isBuyer && t.status === 'SHIPPED') {
        const dv = el('<button>Mark as delivered</button>');
        dv.onclick = post('delivered', 'Buyer notified — marked delivered');
        acts.appendChild(dv);
      }
      if (isBuyer) {
        const b = el('<button>Confirm received — release funds</button>');
        b.onclick = post('confirm-received', 'Funds released to seller', 'Release the held funds to the seller? This cannot be undone.');
        acts.appendChild(b);
      }
      const d = el('<button class="warn">Open a dispute</button>');
      d.onclick = () => openDisputeDialog(actions, id);
      acts.appendChild(d);
    } else if (t.status === 'RELEASED') {
      if (t.rating) {
        acts.appendChild(el(`<div class="muted">Rated: <span class="stars">${'★'.repeat(t.rating.score)}${'☆'.repeat(5 - t.rating.score)}</span></div>`));
      } else {
        const r = el('<button>Rate the other party</button>');
        r.onclick = () => rateDialog(actions, id);
        acts.appendChild(r);
      }
    } else {
      acts.appendChild(el('<div class="muted">No actions available for this status.</div>'));
    }
    view.appendChild(actions);

    // Dispute detail
    if (t.dispute) {
      const dp = t.dispute;
      view.appendChild(el(`<div class="card">
        <div class="row-between"><h2>Dispute</h2><span class="badge ${dp.status}">${dp.status}</span></div>
        <p><strong>Reason:</strong> ${esc(dp.reason)}</p>
        ${dp.adminNote ? `<p><strong>Admin note:</strong> ${esc(dp.adminNote)}</p>` : ''}
        ${(dp.evidence || []).length ? `<p class="muted">${dp.evidence.length} piece(s) of evidence attached.</p>` : ''}
      </div>`));
    }

    // Timeline
    const tl = el('<div class="card"><h2>Timeline</h2><ul class="timeline"></ul></div>');
    const ul = $('.timeline', tl);
    for (const ev of (t.events || [])) {
      ul.appendChild(el(`<li>
        <div>${ev.fromStatus ? `${ev.fromStatus} → ` : ''}<strong>${ev.toStatus}</strong>${ev.note ? ` — ${esc(ev.note)}` : ''}</div>
        <div class="t-time">${when(ev.createdAt)}</div>
      </li>`));
    }
    if (!ul.children.length) ul.appendChild(el('<li class="muted">No events.</li>'));
    view.appendChild(tl);
  });

  function openDisputeDialog(container, txId) {
    if ($('#disputeForm', container)) return;
    const form = el(`<div id="disputeForm" style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
      <label>Why are you disputing?</label>
      <textarea id="reason" minlength="3" maxlength="1000" placeholder="Describe the problem…"></textarea>
      <label>Evidence URL (optional)</label>
      <input id="ev" type="url" placeholder="https://link-to-photo-or-doc" />
      <div class="btn-row"><button class="danger" id="submit">Submit dispute</button></div>
    </div>`);
    container.appendChild(form);
    $('#submit', form).onclick = async () => {
      const reason = $('#reason', form).value.trim();
      const evUrl = $('#ev', form).value.trim();
      if (reason.length < 3) return toast('Please describe the problem', 'err');
      try {
        await api('/disputes', { method: 'POST', body: { transactionId: txId, reason, evidenceUrls: evUrl ? [evUrl] : [] } });
        toast('Dispute opened', 'ok');
        render();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  function rateDialog(container, txId) {
    if ($('#rateForm', container)) return;
    const form = el(`<div id="rateForm" style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
      <label>Score</label>
      <select id="score"><option value="5">★★★★★ (5)</option><option value="4">★★★★ (4)</option><option value="3">★★★ (3)</option><option value="2">★★ (2)</option><option value="1">★ (1)</option></select>
      <label>Comment (optional)</label>
      <input id="comment" maxlength="500" placeholder="How was the transaction?" />
      <div class="btn-row"><button id="submit">Submit rating</button></div>
    </div>`);
    container.appendChild(form);
    $('#submit', form).onclick = async () => {
      try {
        await api('/ratings', { method: 'POST', body: { transactionId: txId, score: Number($('#score', form).value), comment: $('#comment', form).value.trim() || undefined } });
        toast('Thanks for rating', 'ok');
        render();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  route('admin', async (view) => {
    if (!session.isAdmin) { view.innerHTML = '<div class="card"><h2>Admins only</h2></div>'; return; }
    const [overview, disputes] = await Promise.all([api('/admin/overview'), api('/disputes')]);
    view.innerHTML = '';
    view.appendChild(el('<h1>Admin Dashboard</h1>'));

    const stats = el('<div class="grid cols-3"></div>');
    const totalTx = Object.values(overview.byStatus || {}).reduce((a, b) => a + b, 0);
    const cards = [
      ['Users', overview.userCount ?? '—'],
      ['Held funds', money(overview.heldCents ?? 0)],
      ['Open disputes', overview.openDisputes ?? disputes.length],
      ['Transactions', totalTx],
    ];
    for (const [lbl, num] of cards) stats.appendChild(el(`<div class="stat"><div class="num">${esc(num)}</div><div class="lbl">${lbl}</div></div>`));
    view.appendChild(stats);

    // Dispute queue
    const dq = el('<div class="card" style="margin-top:16px"><h2>Dispute queue</h2></div>');
    if (!disputes.length) {
      dq.appendChild(el('<div class="empty">No open disputes 🎉</div>'));
    } else {
      for (const d of disputes) {
        const item = el(`<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
          <div class="row-between">
            <div><strong>${esc(d.transaction?.description || 'Transaction')}</strong>
              <span class="badge ${d.status}">${d.status}</span></div>
            <div>${d.transaction ? money(d.transaction.amountCents, d.transaction.currency) : ''}</div>
          </div>
          <p>${esc(d.reason)}</p>
          <p class="muted">${(d.evidence || []).length} evidence • opened ${when(d.createdAt)}</p>
          <div class="btn-row">
            <button data-r="RELEASE">Rule: release to seller</button>
            <button class="warn" data-r="REFUND">Rule: refund buyer</button>
          </div>
        </div>`);
        item.querySelectorAll('button[data-r]').forEach((b) => {
          b.onclick = async () => {
            const note = prompt('Optional admin note for this ruling:') || undefined;
            try { await api(`/disputes/${d.id}/rule`, { method: 'POST', body: { ruling: b.dataset.r, adminNote: note } }); toast('Dispute resolved', 'ok'); render(); }
            catch (e) { toast(e.message, 'err'); }
          };
        });
        dq.appendChild(item);
      }
    }
    view.appendChild(dq);

    // Customer care inbox
    view.appendChild(await buildSupportInbox());

    // All transactions
    const all = await api('/admin/transactions');
    const txCard = el('<div class="card" style="margin-top:16px"><h2>All transactions</h2></div>');
    const table = el(`<table><thead><tr><th>Description</th><th>Amount</th><th>Method</th><th>Status</th><th>Created</th></tr></thead><tbody></tbody></table>`);
    const tb = $('tbody', table);
    for (const t of all) {
      const tr = el(`<tr class="clickable">
        <td>${esc(t.description)}</td><td>${money(t.amountCents, t.currency)}</td>
        <td>${t.method}</td><td><span class="badge ${t.status}">${t.status}</span></td>
        <td class="muted">${when(t.createdAt)}</td></tr>`);
      tr.onclick = () => go('tx', { id: t.id });
      tb.appendChild(tr);
    }
    if (!all.length) txCard.appendChild(el('<div class="empty">No transactions.</div>'));
    else txCard.appendChild(table);
    view.appendChild(txCard);

    // Payment ledger
    const [payments, reviews] = await Promise.all([api('/admin/payments'), api('/admin/reviews')]);
    const payCard = el('<div class="card" style="margin-top:16px"><h2>Payment ledger</h2></div>');
    if (!payments.length) payCard.appendChild(el('<div class="empty">No payments yet.</div>'));
    else {
      const pt = el(`<table><thead><tr><th>Type</th><th>Amount</th><th>Method</th><th>Transaction</th><th>Status</th><th>When</th></tr></thead><tbody></tbody></table>`);
      const ptb = $('tbody', pt);
      for (const p of payments) {
        const tr = el(`<tr class="clickable">
          <td><span class="badge kind-${p.kind}">${p.kind}</span></td>
          <td>${money(p.amountCents, p.transaction?.currency || 'KES')}</td>
          <td>${p.method}</td>
          <td>${esc(p.transaction?.description || p.transactionId)}</td>
          <td class="muted">${esc(p.status)}</td>
          <td class="muted">${when(p.createdAt)}</td></tr>`);
        if (p.transaction?.id) tr.onclick = () => go('tx', { id: p.transaction.id });
        ptb.appendChild(tr);
      }
      payCard.appendChild(pt);
    }
    view.appendChild(payCard);

    // Reviews
    const revCard = el('<div class="card" style="margin-top:16px"><h2>Reviews</h2></div>');
    if (!reviews.length) revCard.appendChild(el('<div class="empty">No reviews yet.</div>'));
    else {
      for (const r of reviews) {
        revCard.appendChild(el(`<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
          <div class="row-between">
            <div><span class="stars">${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</span>
              <span class="muted">${esc(r.rater?.email || '')} → ${esc(r.ratee?.email || '')}</span></div>
            <div class="muted">${when(r.createdAt)}</div>
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
          <p class="muted">on ${esc(r.transaction?.description || r.transactionId)}</p>
        </div>`));
      }
    }
    view.appendChild(revCard);
  });

  // ---------- notifications bell ----------
  let bellTimer = null;
  function buildBell() {
    const wrap = el(`<span class="bell" style="position:relative">
      <a id="bellBtn" title="Notifications">${icon('bell', 20)}<span id="bellCount" class="bell-count" hidden>0</span></a>
      <div id="bellPanel" class="bell-panel" hidden></div>
    </span>`);
    wrap.querySelector('#bellBtn').onclick = (e) => { e.stopPropagation(); toggleBell(wrap); };
    return wrap;
  }
  async function toggleBell(wrap) {
    const panel = $('#bellPanel', wrap);
    if (!panel.hidden) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = '<div class="muted" style="padding:10px">Loading…</div>';
    try {
      const { items } = await api('/notifications');
      if (!items.length) { panel.innerHTML = '<div class="muted" style="padding:12px">No notifications yet.</div>'; }
      else {
        panel.innerHTML = '';
        const head = el('<div class="bell-head"><strong>Notifications</strong><span class="link" id="markAll">Mark all read</span></div>');
        head.querySelector('#markAll').onclick = async () => { await api('/notifications/read-all', { method: 'POST' }); refreshBellCount(); toggleBell(wrap); toggleBell(wrap); };
        panel.appendChild(head);
        for (const n of items) {
          panel.appendChild(el(`<div class="bell-item ${n.read ? '' : 'unread'}">
            <div>${esc(n.message)}</div>
            <div class="t-time">${when(n.createdAt)}</div>
          </div>`));
        }
      }
      await api('/notifications/read-all', { method: 'POST' }); // opening the panel marks them read
      refreshBellCount();
    } catch (e) { panel.innerHTML = `<div class="muted" style="padding:10px">${esc(e.message)}</div>`; }
  }
  async function refreshBellCount() {
    const badge = document.getElementById('bellCount');
    if (!badge) return;
    try {
      const { unread } = await api('/notifications');
      if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.hidden = false; }
      else badge.hidden = true;
    } catch {}
  }
  function startBellPolling() {
    stopBellPolling();
    refreshBellCount();
    bellTimer = setInterval(refreshBellCount, 20000);
  }
  function stopBellPolling() { if (bellTimer) { clearInterval(bellTimer); bellTimer = null; } }
  document.addEventListener('click', () => { const p = document.getElementById('bellPanel'); if (p) p.hidden = true; });

  // ---------- admin side of customer care ----------
  /** Inbox card for the admin dashboard: who wrote in, who is still waiting. */
  async function buildSupportInbox() {
    const card = el('<div class="card" style="margin-top:16px"><h2>Customer care</h2></div>');
    let data;
    try {
      data = await api('/support/threads');
    } catch (e) {
      card.appendChild(el(`<div class="empty">${esc(e.message)}</div>`));
      return card;
    }
    const { threads, unread } = data;
    $('h2', card).innerHTML = `Customer care${unread ? ` <span class="badge warn-badge">${unread} awaiting reply</span>` : ''}`;

    if (!threads.length) {
      card.appendChild(el('<div class="empty">No customer messages yet.</div>'));
      return card;
    }
    for (const t of threads) {
      const who = t.user.fullName || t.user.email;
      const preview = t.lastMessage ? (t.lastMessage.fromAdmin ? 'You: ' : '') + t.lastMessage.body : '';
      const row = el(`<div class="support-thread ${t.unread ? 'unread' : ''}">
        <div class="support-thread-main">
          <div class="row-between">
            <strong>${esc(who)}</strong>
            ${t.unread ? `<span class="badge warn-badge">${t.unread} new</span>` : ''}
          </div>
          <div class="support-preview">${esc(preview.length > 110 ? preview.slice(0, 110) + '…' : preview)}</div>
          <div class="t-time">${when(t.lastAt)}</div>
        </div>
      </div>`);
      row.onclick = () => openSupportThread(t.user.id, who);
      card.appendChild(row);
    }
    return card;
  }

  /** Opens one customer's conversation in a modal so staff can reply. */
  async function openSupportThread(userId, who) {
    const node = el(`<div class="support-modal">
      <h2>Chat with ${esc(who)}</h2>
      <div class="support-log admin" id="adminLog"><div class="muted" style="padding:12px">Loading…</div></div>
      <form class="support-form" id="adminReply">
        <input id="adminInput" autocomplete="off" maxlength="2000" placeholder="Write a reply…" />
        <button type="submit" aria-label="Send">&#10148;</button>
      </form>
    </div>`);
    const close = openModal(node);

    const log = $('#adminLog', node);
    const draw = async () => {
      const { items } = await api(`/support/threads/${userId}`);
      log.innerHTML = '';
      if (!items.length) log.appendChild(el('<div class="support-empty">No messages yet.</div>'));
      for (const m of items) {
        // "them" is the customer here — the mirror image of the customer's own view.
        log.appendChild(el(`<div class="support-msg ${m.fromAdmin ? 'me' : 'them'}">
          <div class="support-bubble">${esc(m.body)}</div>
          <div class="support-t">${m.fromAdmin ? 'You · ' : ''}${when(m.createdAt)}</div>
        </div>`));
      }
      log.scrollTop = log.scrollHeight;
    };
    try { await draw(); } catch (e) { log.innerHTML = `<div class="muted" style="padding:12px">${esc(e.message)}</div>`; }

    $('#adminReply', node).onsubmit = async (e) => {
      e.preventDefault();
      const input = $('#adminInput', node);
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      try { await api(`/support/threads/${userId}`, { method: 'POST', body: { body } }); await draw(); }
      catch (err) { input.value = body; toast(err.message, 'err'); }
    };
    return close;
  }

  // ---------- customer care: WhatsApp + live chat ----------
  // Visitors can always reach us on WhatsApp. Signed-in customers additionally get
  // a chat that is stored in our own database and answered from the admin
  // dashboard, so the conversation sits next to the deals it is about.
  const SUPPORT = window.APP_CONFIG.SUPPORT || {};
  const waHref = () =>
    `https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent('Hello SafePay, I need help with ')}`;

  let supportTimer = null;   // unread badge poll (widget closed)
  let supportLive = null;    // thread refresh while the panel is open

  function buildSupport() {
    const w = el(`<div class="support" id="support" hidden>
      <div class="support-panel" id="supportPanel" hidden></div>
      <button class="support-fab" id="supportFab" aria-label="Customer care" aria-expanded="false">
        ${icon('chat', 26)}<span class="support-dot" id="supportDot" hidden></span>
      </button>
    </div>`);
    w.querySelector('#supportFab').onclick = () => toggleSupport();
    document.body.appendChild(w);
  }

  function closeSupport() {
    const p = $('#supportPanel'), f = $('#supportFab');
    if (p) p.hidden = true;
    if (f) { f.setAttribute('aria-expanded', 'false'); f.classList.remove('on'); }
    if (supportLive) { clearInterval(supportLive); supportLive = null; }
  }

  function toggleSupport() {
    const p = $('#supportPanel'), f = $('#supportFab');
    if (!p) return;
    if (!p.hidden) return closeSupport();
    p.hidden = false;
    f.setAttribute('aria-expanded', 'true');
    f.classList.add('on');
    renderSupportPanel();
  }

  function renderSupportPanel() {
    const p = $('#supportPanel');
    p.innerHTML = '';
    const head = el(`<div class="support-head">
      <div><strong>Customer care</strong><div class="support-hours">${esc(SUPPORT.hours || '')}</div></div>
      <button class="support-x" aria-label="Close">&times;</button>
    </div>`);
    head.querySelector('.support-x').onclick = closeSupport;
    p.appendChild(head);

    p.appendChild(el(`<a class="support-wa" href="${waHref()}" target="_blank" rel="noopener noreferrer">
      ${icon('whatsapp', 26)}
      <span><strong>Chat on WhatsApp</strong><small>${esc(SUPPORT.whatsappLabel || '')}</small></span>
      <span class="support-go">&rsaquo;</span>
    </a>`));

    if (!session.isAuthed) {
      const cta = el(`<div class="support-guest">
        <p class="muted">Log in to message our team here and keep the whole conversation in your account.</p>
        <button class="support-login">Log in to chat</button>
      </div>`);
      cta.querySelector('.support-login').onclick = () => { closeSupport(); openAuth('login'); };
      p.appendChild(cta);
      return;
    }

    p.appendChild(el('<div class="support-or"><span>or message us here</span></div>'));
    p.appendChild(el('<div class="support-log" id="supportLog"><div class="muted" style="padding:12px">Loading…</div></div>'));

    const form = el(`<form class="support-form">
      <input id="supportInput" autocomplete="off" maxlength="2000" placeholder="Type your message…" />
      <button type="submit" aria-label="Send">&#10148;</button>
    </form>`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = form.querySelector('#supportInput');
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      try {
        await api('/support/messages', { method: 'POST', body: { body } });
        await loadSupportThread();
      } catch (err) {
        input.value = body;   // put it back so nothing is lost
        toast(err.message, 'err');
      }
    };
    p.appendChild(form);

    loadSupportThread();
    // Refresh while open so a staff reply appears without the customer doing anything.
    if (supportLive) clearInterval(supportLive);
    supportLive = setInterval(() => { if (!p.hidden) loadSupportThread(true); }, 8000);
  }

  async function loadSupportThread(quiet) {
    const log = $('#supportLog');
    if (!log) return;
    try {
      const { items } = await api('/support/messages');
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      log.innerHTML = '';
      if (!items.length) {
        log.appendChild(el('<div class="support-empty">Hi! 👋 Ask us anything about a deal, a payment or a dispute — we usually reply within a few minutes.</div>'));
      } else {
        for (const m of items) {
          log.appendChild(el(`<div class="support-msg ${m.fromAdmin ? 'them' : 'me'}">
            <div class="support-bubble">${esc(m.body)}</div>
            <div class="support-t">${m.fromAdmin ? 'SafePay support · ' : ''}${when(m.createdAt)}</div>
          </div>`));
        }
      }
      // Only auto-scroll when they were already at the bottom, so a background
      // refresh never yanks the view away from something they are reading.
      if (!quiet || atBottom) log.scrollTop = log.scrollHeight;
      await api('/support/messages/read', { method: 'POST' });
      refreshSupportBadge();
    } catch (e) {
      if (!quiet) log.innerHTML = `<div class="muted" style="padding:12px">${esc(e.message)}</div>`;
    }
  }

  async function refreshSupportBadge() {
    const dot = $('#supportDot');
    if (!dot || !session.isAuthed) return;
    try {
      const { unread } = await api('/support/messages/unread');
      if (unread > 0) { dot.textContent = unread > 9 ? '9+' : unread; dot.hidden = false; }
      else dot.hidden = true;
    } catch {}
  }

  /** Shows the launcher to visitors and customers; admins answer from the Admin tab instead. */
  function syncSupport() {
    const w = $('#support');
    if (!w) return;
    const show = !session.isAdmin;
    w.hidden = !show;
    if (!show) { closeSupport(); }
    if (supportTimer) { clearInterval(supportTimer); supportTimer = null; }
    if (show && session.isAuthed) {
      refreshSupportBadge();
      supportTimer = setInterval(refreshSupportBadge, 25000);
    } else if ($('#supportDot')) {
      $('#supportDot').hidden = true;
    }
  }

  // Three ways out: the ×, a click anywhere outside, or Escape.
  // Deciding here from the click target — rather than stopping propagation inside
  // the widget — means the transparent gap beside the button still counts as
  // "outside", and the widget never swallows clicks meant for the page beneath it.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.support-panel, .support-fab')) return;
    closeSupport();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSupport(); });

  // ---------- boot ----------
  $('.brand').innerHTML = `SafePay <span>Escrow</span>`;
  $('.brand').onclick = () => go(session.isAuthed ? 'dashboard' : 'home');
  const burger = el('<button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>');
  burger.onclick = (e) => {
    e.stopPropagation();
    const open = document.body.classList.toggle('nav-open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  document.querySelector('.topbar').appendChild(burger);
  $('#nav').addEventListener('click', () => { document.body.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.target.closest('.topbar')) return;
    document.body.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false');
  });
  window.addEventListener('hashchange', render);
  route('new', (v) => { routes.dashboard(v); openOrderWizard(); });
  buildSupport();
  renderNav();
  render();

})();
