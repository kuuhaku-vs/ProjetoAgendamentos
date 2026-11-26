// Gera a imagem de divulgação dos horários vagos (canvas → PNG)
const TEMAS = {
  vinho:   { bg: ['#2b0e1b', '#5a1f38', '#3a1226'], txt: '#ffffff', sub: 'rgba(255,255,255,.70)', ac: '#cfa86a', card: 'rgba(255,255,255,.06)', ln: 'rgba(207,168,106,.38)', pill: 'rgba(207,168,106,.16)', pillTxt: '#ffffff', marca: 0.08, badge: '#cfa86a', badgeTxt: '#3a1226' },
  preto:   { bg: ['#09090b', '#1c1b20', '#0e0e11'], txt: '#ffffff', sub: 'rgba(255,255,255,.62)', ac: '#d6b25e', card: 'rgba(255,255,255,.05)', ln: 'rgba(214,178,94,.40)', pill: 'rgba(214,178,94,.14)', pillTxt: '#f6e7c1', marca: 0.07, badge: '#d6b25e', badgeTxt: '#111' },
  marinho: { bg: ['#0a1628', '#1b3155', '#0d1d36'], txt: '#ffffff', sub: 'rgba(255,255,255,.68)', ac: '#c9d3e0', card: 'rgba(255,255,255,.06)', ln: 'rgba(201,211,224,.35)', pill: 'rgba(201,211,224,.14)', pillTxt: '#ffffff', marca: 0.08, badge: '#c9d3e0', badgeTxt: '#0d1d36' },
  claro:   { bg: ['#fdfaf6', '#f1e7dc', '#f8f2eb'], txt: '#2a1f23', sub: '#7d6d72', ac: '#9a6b3c', card: 'rgba(255,255,255,.75)', ln: '#e3d3c2', pill: '#f3e6ea', pillTxt: '#5a1f38', marca: 0.07, badge: '#5a1f38', badgeTxt: '#ffffff' }
};
const FORMATOS = { story: [1080, 1920], feed: [1080, 1350], quadrado: [1080, 1080] };
const SERIF = 'Georgia, "Playfair Display", "Times New Roman", serif';
const SANS = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const PREFS = 'prefsImagem';

let _logoImg = null, _logoSrc = null, _gerando = 0;

function carregarImg(src) {
  return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

function faixas(horas, passo) {
  const out = [];
  horas.forEach((h) => {
    const m = toMin(h), u = out[out.length - 1];
    if (u && m - u.fimMin === passo) { u.fim = h; u.fimMin = m; } else out.push({ ini: h, fim: h, fimMin: m });
  });
  return out.map((f) => (f.ini === f.fim ? f.ini : `${f.ini} – ${f.fim}`));
}

function texto(ctx, t, x, y, font, cor, opts = {}) {
  ctx.font = font; ctx.fillStyle = cor; ctx.textAlign = opts.align || 'left'; ctx.textBaseline = opts.base || 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = (opts.ls || 0) + 'px';
  ctx.fillText(t, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}
function ajustarFonte(ctx, t, maxW, tam, familia, peso = '') {
  do { ctx.font = `${peso} ${tam}px ${familia}`; if (ctx.measureText(t).width <= maxW) break; tam -= 2; } while (tam > 14);
  return tam;
}

function desenharLogoBadge(ctx, cfg, img, x, y, t, tema) {
  ctx.save();
  const fmt = cfg.logoFormato || 'redondo';
  if (img && fmt === 'original') {
    const k = t / img.height, w = Math.min(img.width * k, t * 2.6);
    ctx.drawImage(img, x, y, w, (w / img.width) * img.height);
    ctx.restore(); return w;
  }
  ctx.beginPath();
  if (fmt === 'quadrado' && img) ctx.roundRect(x, y, t, t, t * 0.16); else ctx.arc(x + t / 2, y + t / 2, t / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = img ? '#fff' : tema.badge; ctx.fill();
  if (img) {
    ctx.clip();
    const k = Math.max(t / img.width, t / img.height);
    ctx.drawImage(img, x + (t - img.width * k) / 2, y + (t - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    texto(ctx, (cfg.nomeSalao.trim()[0] || 'S').toUpperCase(), x + t / 2, y + t / 2 + 2, `600 ${t * 0.48}px ${SERIF}`, tema.badgeTxt, { align: 'center', base: 'middle' });
  }
  ctx.restore();
  ctx.save(); ctx.beginPath();
  if (fmt === 'quadrado' && img) ctx.roundRect(x - 5, y - 5, t + 10, t + 10, t * 0.18); else ctx.arc(x + t / 2, y + t / 2, t / 2 + 6, 0, Math.PI * 2);
  ctx.strokeStyle = tema.ac; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  return t;
}

async function atualizarImagem() {
  if (!D) return;
  const id = ++_gerando;
  const cv = $('#iCanvas'), ctx = cv.getContext('2d');
  const fmt = $('#iFormato').value, tema = TEMAS[$('#iTema').value], modo = $('#iModo').value;
  const [W, H] = FORMATOS[fmt];
  const cfg = D.config, serv = D.servicos.find((s) => s.id === $('#iServico').value);
  const nDias = Number($('#iDias').value);
  salvarPrefs();

  const [r] = await Promise.all([req(`/api/vagas?dias=${nDias}&duracao=${serv ? serv.duracao : cfg.intervaloMin}`), (async () => {
    if (_logoSrc !== cfg.logo) { _logoImg = await carregarImg(cfg.logo); _logoSrc = cfg.logo; }
  })()]);
  if (id !== _gerando) return;
  const img = _logoImg;
  cv.width = W; cv.height = H;
  const story = fmt === 'story', M = 72; // margem

  // ---- Fundo ----
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, tema.bg[0]); g.addColorStop(0.55, tema.bg[1]); g.addColorStop(1, tema.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W);
  rg.addColorStop(0, 'rgba(255,255,255,.08)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  // ---- Marca d'água: logo grande ao fundo ----
  ctx.save(); ctx.globalAlpha = tema.marca;
  const wm = Math.min(W, H) * (story ? 1.05 : 0.9);
  if (img) {
    const k = wm / Math.max(img.width, img.height), w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (W - w) / 2 + W * 0.18, H * (story ? 0.56 : 0.58) - h / 2, w, h);
  } else {
    texto(ctx, (cfg.nomeSalao.trim()[0] || 'S').toUpperCase(), W / 2 + W * 0.18, H * 0.58, `600 ${wm}px ${SERIF}`, tema.txt, { align: 'center', base: 'middle' });
  }
  ctx.restore();

  // moldura fina
  ctx.strokeStyle = tema.ln; ctx.lineWidth = 2; ctx.strokeRect(34, 34, W - 68, H - 68);

  // ---- Cabeçalho ----
  let y = story ? 120 : 92;
  const tb = story ? 128 : 104;
  const wl = desenharLogoBadge(ctx, cfg, img, M, y, tb, tema);
  const xn = M + wl + 32, maxN = W - xn - M;
  const tn = ajustarFonte(ctx, cfg.nomeSalao, maxN, story ? 58 : 50, SERIF, '600');
  texto(ctx, cfg.nomeSalao, xn, y + tb / 2 + (cfg.slogan ? -4 : tn * 0.35), `600 ${tn}px ${SERIF}`, tema.txt);
  if (cfg.slogan) { const ts = ajustarFonte(ctx, cfg.slogan, maxN, 26, SANS); texto(ctx, cfg.slogan, xn, y + tb / 2 + 38, `${ts}px ${SANS}`, tema.sub); }
  y += tb + (story ? 96 : 66);

  texto(ctx, 'AGENDA ABERTA', M, y, `700 ${story ? 26 : 23}px ${SANS}`, tema.ac, { ls: 7 });
  ctx.fillStyle = tema.ac; ctx.fillRect(M, y + 18, 64, 3);
  y += story ? 100 : 82;
  const titulo = $('#iTitulo').value.trim() || 'Horários disponíveis';
  const tt = ajustarFonte(ctx, titulo, W - M * 2, story ? 96 : 78, SERIF, '600');
  texto(ctx, titulo, M, y, `600 ${tt}px ${SERIF}`, tema.txt);
  y += story ? 58 : 50;
  const dias = r.dias.filter((d) => d.horarios.length);
  const periodo = r.dias.length > 1 ? `${dataBR(r.dias[0].data).slice(0, 5)} a ${dataBR(r.dias[r.dias.length - 1].data).slice(0, 5)}` : dataExtenso(r.dias[0].data);
  texto(ctx, (serv ? serv.nome + '  ·  ' : '') + periodo, M, y, `${story ? 30 : 27}px ${SANS}`, tema.sub);
  y += story ? 56 : 44;

  // ---- Rodapé (reserva espaço) ----
  const rodH = story ? 250 : 190;
  const corpoFim = H - rodH;

  // ---- Corpo: um cartão por dia ----
  const itensDia = dias.map((d) => ({ d, itens: modo === 'faixas' ? faixas(d.horarios, Number(cfg.intervaloMin) || 30) : d.horarios }));
  const colW = 190, corpoW = W - M * 2;
  function medir(s, lista, desenhar) {
    const pad = 24 * s, pillH = 54 * s, gap = 12 * s, fs = 28 * s, cardGap = 18 * s;
    const pillsX0 = M + pad + colW * s, pillsW = corpoW - pad * 2 - colW * s;
    let yy = y;
    for (const { d, itens } of lista) {
      ctx.font = `600 ${fs}px ${SANS}`;
      let px = 0, linhas = 1; const pos = [];
      for (const t of itens) {
        const w = ctx.measureText(t).width + 30 * s;
        if (px + w > pillsW && px > 0) { px = 0; linhas++; }
        pos.push([t, px, linhas - 1, w]); px += w + gap;
      }
      const conteudoH = Math.max(linhas * pillH + (linhas - 1) * gap, 84 * s);
      const cardH = conteudoH + pad * 2;
      if (desenhar) {
        ctx.fillStyle = tema.card; ctx.strokeStyle = tema.ln; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(M, yy, corpoW, cardH, 18 * s); ctx.fill(); ctx.stroke();
        ctx.fillStyle = tema.ac; ctx.beginPath(); ctx.roundRect(M, yy + 18 * s, 5, cardH - 36 * s, 3); ctx.fill();
        const dt = dataObj(d.data), hoje = d.data === hojeISO();
        const amanha = d.data === somaDias(hojeISO(), 1);
        const cy = yy + cardH / 2;
        texto(ctx, hoje ? 'HOJE' : amanha ? 'AMANHÃ' : SEM_LONGO[dt.getDay()].toUpperCase(), M + pad + 6, cy - 6 * s, `700 ${20 * s}px ${SANS}`, tema.ac, { ls: 3 * s });
        texto(ctx, `${String(dt.getDate()).padStart(2, '0')} ${MES[dt.getMonth()]}`, M + pad + 6, cy + 38 * s, `600 ${40 * s}px ${SERIF}`, tema.txt);
        for (const [t, x0, li, w] of pos) {
          const px0 = pillsX0 + x0, py0 = yy + pad + (conteudoH - (linhas * pillH + (linhas - 1) * gap)) / 2 + li * (pillH + gap);
          ctx.fillStyle = tema.pill; ctx.beginPath(); ctx.roundRect(px0, py0, w, pillH, pillH / 2); ctx.fill();
          texto(ctx, t, px0 + w / 2, py0 + pillH / 2 + 1, `600 ${fs}px ${SANS}`, tema.pillTxt, { align: 'center', base: 'middle' });
        }
      }
      yy += cardH + cardGap;
    }
    return yy - y;
  }
  const disp = corpoFim - y - 30;
  let lista = itensDia, escala = null, cortados = 0;
  while (lista.length) {
    for (let s = 1.4; s >= 0.62; s -= 0.04) if (medir(s, lista, false) <= disp) { escala = s; break; }
    if (escala) break;
    lista = lista.slice(0, -1); cortados++;
  }
  if (!itensDia.length) {
    const cy = y + disp / 2;
    texto(ctx, 'Agenda completa neste período', W / 2, cy, `600 ${story ? 58 : 48}px ${SERIF}`, tema.txt, { align: 'center' });
    texto(ctx, 'Consulte novas datas pelo link abaixo', W / 2, cy + 56, `${story ? 30 : 26}px ${SANS}`, tema.sub, { align: 'center' });
  } else {
    const sobra = disp - medir(escala, lista, false);
    y += Math.max(0, sobra / 2 - 20); // centraliza o bloco no espaço livre
    const h = medir(escala, lista, true);
    if (cortados) texto(ctx, `+ ${cortados} dia${cortados > 1 ? 's' : ''} com vagas — veja no link`, M, y + h + 14, `italic ${26}px ${SANS}`, tema.sub);
  }

  // ---- Rodapé ----
  let ry = H - rodH + (story ? 50 : 30);
  ctx.fillStyle = tema.ln; ctx.fillRect(M, ry, W - M * 2, 1.5);
  ry += story ? 64 : 52;
  texto(ctx, 'AGENDE PELO LINK', M, ry, `700 ${22}px ${SANS}`, tema.ac, { ls: 5 });
  const link = ($('#iLink').value.trim() || baseApp()).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const tl = ajustarFonte(ctx, link, W * 0.58, story ? 44 : 38, SANS, '600');
  texto(ctx, link, M, ry + (story ? 58 : 50), `600 ${tl}px ${SANS}`, tema.txt);
  const dir = [cfg.whatsapp && 'WhatsApp ' + foneFmt(cfg.whatsapp), cfg.endereco].filter(Boolean);
  dir.forEach((t, i) => {
    const tf = ajustarFonte(ctx, t, W * 0.36, 24, SANS);
    texto(ctx, t, W - M, ry + i * 36 + (dir.length === 1 ? 30 : 0), `${tf}px ${SANS}`, tema.sub, { align: 'right' });
  });
}

function salvarPrefs() {
  try { localStorage.setItem(PREFS, JSON.stringify({ f: $('#iFormato').value, t: $('#iTema').value, d: $('#iDias').value, m: $('#iModo').value, ti: $('#iTitulo').value, l: $('#iLink').value })); } catch {}
}
(function iniciarEstudio() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS)) || {};
    if (p.f) $('#iFormato').value = p.f; if (p.t) $('#iTema').value = p.t; if (p.d) $('#iDias').value = p.d;
    if (p.m) $('#iModo').value = p.m; if (p.ti) $('#iTitulo').value = p.ti; if (p.l) $('#iLink').value = p.l;
  } catch {}
  if (!$('#iLink').value) $('#iLink').placeholder = baseApp().replace(/^https?:\/\//, '').replace(/\/$/, '');
  ['iFormato', 'iTema', 'iDias', 'iModo', 'iServico'].forEach((i) => ($('#' + i).onchange = atualizarImagem));
  let t; ['iTitulo', 'iLink'].forEach((i) => ($('#' + i).oninput = () => { clearTimeout(t); t = setTimeout(atualizarImagem, 300); }));
})();

// preenche a lista de serviços a cada atualização dos dados
const _origAtualizar = atualizarImagem;
atualizarImagem = async function () {
  const sel = $('#iServico'), atual = sel.value;
  sel.innerHTML = '<option value="">Todos os serviços</option>' + D.servicos.filter((s) => s.ativo).map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
  sel.value = atual;
  return _origAtualizar();
};

const blobImagem = () => new Promise((ok) => $('#iCanvas').toBlob(ok, 'image/png'));
const nomeArq = () => `horarios-vagos-${hojeISO()}.png`;
$('#iBaixar').onclick = async () => {
  const b = await blobImagem(), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = nomeArq(); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Imagem baixada! Está na pasta Downloads.');
};
$('#iCopiar').onclick = async () => {
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await blobImagem() })]); toast('Imagem copiada! Cole no WhatsApp Web com Ctrl+V.'); }
  catch { toast('Seu navegador não deixou copiar. Use "Baixar imagem".'); }
};
$('#iShare').onclick = async () => {
  const f = new File([await blobImagem()], nomeArq(), { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Horários vagos' }); } catch {} }
  else toast('Compartilhar direto funciona no celular. No computador, use "Baixar" ou "Copiar".', 4500);
};
