// Funções compartilhadas
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SEM_LONGO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataObj = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const dataBR = (iso) => iso.split('-').reverse().join('/');
const dataExtenso = (iso) => { const d = dataObj(iso); return `${SEM_LONGO[d.getDay()]}, ${d.getDate()} de ${MES[d.getMonth()]}`; };
const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const duracaoTxt = (m) => (m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : '') : m + ' min');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const foneFmt = (t) => { t = String(t || '').replace(/\D/g, ''); if (t.startsWith('55') && t.length > 11) t = t.slice(2); return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t; };
const zapLink = (num, msg) => { num = String(num || '').replace(/\D/g, ''); if (num && num.length <= 11) num = '55' + num; return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`; };

function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
}

// Todas as chamadas vão para o Google Apps Script (planilha). A URL fica em config.js.
async function req(url, opts = {}) {
  const API = window.API_URL || '';
  if (!/^https:\/\/script\.google\.com\//.test(API)) { const e = new Error('App ainda não conectado à planilha: cole a URL do Apps Script em config.js.'); e.status = 0; throw e; }
  const u = new URL(url, 'https://x');
  const pacote = { m: opts.method || 'GET', p: u.pathname, q: Object.fromEntries(u.searchParams), b: opts.body || {}, token: (opts.headers || {})['x-token'] || '' };
  let r;
  try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(pacote), redirect: 'follow' }); }
  catch { const e = new Error('Sem conexão. Verifique a internet e tente de novo.'); e.status = 0; throw e; }
  const j = await r.json().catch(() => ({ status: 500, dados: { erro: 'Resposta inválida do servidor.' } }));
  if (j.status >= 400) { const e = new Error((j.dados && j.dados.erro) || 'Não foi possível concluir. Tente de novo.'); e.status = j.status; throw e; }
  return j.dados;
}

// Logo: baixada só quando muda (guardada no aparelho)
async function obterLogo(cfg) {
  if (!cfg.logoVersao) { cfg.logo = ''; return cfg; }
  try { if (localStorage.getItem('logoV') === String(cfg.logoVersao)) { cfg.logo = localStorage.getItem('logoD') || ''; if (cfg.logo) return cfg; } } catch {}
  try {
    const r = await req('/api/logo'); cfg.logo = r.logo || '';
    try { localStorage.setItem('logoD', cfg.logo); localStorage.setItem('logoV', String(r.versao)); } catch {}
  } catch { cfg.logo = ''; }
  return cfg;
}
const baseApp = () => new URL('./', location.href).href;

function mascaraFone(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, v.length - 4)}-${v.slice(-4)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    input.value = v;
  });
}

function modal(html) {
  const m = document.createElement('div');
  m.className = 'modal'; m.innerHTML = `<div class="cartao">${html}</div>`;
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  return m;
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Aplica a logo (imagem enviada no painel) ou a inicial do nome
function aplicarLogo(el, cfg) {
  const t = Math.min(200, Math.max(32, Number(cfg.logoTamanho) || 56));
  const fmt = cfg.logoFormato || 'redondo';
  el.className = 'logo ' + (cfg.logo ? 'img ' + fmt : 'redondo');
  el.style.setProperty('--t', t + 'px');
  if (cfg.logo) el.innerHTML = `<img src="${cfg.logo}" alt="${esc(cfg.nomeSalao || 'Logo')}">`;
  else el.textContent = ((cfg.nomeSalao || '').trim()[0] || '✂').toUpperCase();
}
