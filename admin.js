// Painel do salão
let TOKEN = localStorage.getItem('tokenSalao') || '';
let D = null; // dados completos
let diaSel = hojeISO();
const STATUS = { confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' };
const toMin = (h) => { if (!h) return null; const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const toHH = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const isoDe = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const somaDias = (iso, n) => { const d = dataObj(iso); d.setDate(d.getDate() + n); return isoDe(d); };

const api = (url, opts = {}) => req(url, { ...opts, headers: { 'x-token': TOKEN } }).catch((e) => { if (e.status === 401) sair(); throw e; });

$('#btnCfg').onclick = () => $('[data-aba=config]').click();
function sair() { $('#btnCfg').classList.add('oculto'); TOKEN = ''; localStorage.removeItem('tokenSalao'); $('#app').classList.add('oculto'); $('#login').classList.remove('oculto'); }

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await req('/api/login', { method: 'POST', body: { pin: new FormData(e.target).get('pin') } });
    TOKEN = r.token; localStorage.setItem('tokenSalao', TOKEN); entrar();
  } catch (err) { toast(err.message); }
});

async function recarregar() { const d = await api('/api/admin/dados'); await obterLogo(d.config); D = d; desenharTudo(); }

async function entrar() {
  try { await recarregar(); } catch { return; }
  $('#login').classList.add('oculto'); $('#app').classList.remove('oculto');
  conectarEventos();
  if ('Notification' in window && Notification.permission === 'default') $('#btnNotif').classList.remove('oculto');
  $('#btnCfg').classList.remove('oculto');
}

// ---------- Avisos: consulta a planilha a cada 20 segundos ----------
let ultimoAviso = '';
function conectarEventos() {
  clearInterval(window._poll);
  ultimoAviso = (D.avisos[0] && D.avisos[0].criadoEm) || new Date().toISOString();
  window._poll = setInterval(checarAvisos, 20000);
}
async function checarAvisos() {
  if (!TOKEN) return;
  const r = await api('/api/admin/avisos?desde=' + encodeURIComponent(ultimoAviso)).catch(() => null);
  if (!r || !r.avisos.length) return;
  ultimoAviso = r.avisos[0].criadoEm;
  r.avisos.slice(0, 3).reverse().forEach(notificar);
  await recarregar();
}
function notificar(a) {
  {
    bip(a.tipo === 'novo');
    toast((a.tipo === 'novo' ? '🟢 ' : '🔴 ') + a.texto, 6000);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(a.tipo === 'novo' ? 'Novo agendamento' : 'Agendamento cancelado', { body: a.texto.replace(/^[^:]+: /, ''), icon: 'icone-192.png', tag: a.id }); } catch {}
    }
  }
}
function bip(novo) {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    (novo ? [660, 880] : [520, 390]).forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f; o.connect(g); g.connect(c.destination);
      const t = c.currentTime + i * 0.18; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.17);
    });
  } catch {}
}
$('#btnNotif').onclick = async () => { const p = await Notification.requestPermission(); if (p !== 'default') $('#btnNotif').classList.add('oculto'); if (p === 'granted') toast('Alertas ativados neste computador.'); };

// ---------- Abas ----------
$$('.aba').forEach((b) => (b.onclick = () => {
  $$('.aba').forEach((x) => x.classList.toggle('on', x === b));
  $$('[data-sec]').forEach((s) => s.classList.toggle('oculto', s.dataset.sec !== b.dataset.aba));
  window.scrollTo({ top: 0 });
  if (b.dataset.aba === 'avisos' && D.avisos.some((a) => !a.lido)) setTimeout(() => api('/api/admin/avisos/lidos', { method: 'POST' }).then(recarregar), 2500);
}));

function desenharTudo() {
  $('#nome').textContent = D.config.nomeSalao;
  aplicarLogo($('#logo'), D.config);
  document.title = 'Painel — ' + D.config.nomeSalao;
  const n = D.avisos.filter((a) => !a.lido).length;
  $('#badge').textContent = n; $('#badge').classList.toggle('oculto', !n);
  desenharAgenda(); desenharAvisos(); desenharServicos(); desenharFinanceiro(); desenharLinks();
  if (!$('#formCfg').dataset.editando) desenharConfig();
}

// ---------- Agenda ----------
const doDia = (iso) => D.agendamentos.filter((a) => a.data === iso).sort((a, b) => a.hora.localeCompare(b.hora));
const ativos = (lista) => lista.filter((a) => a.status !== 'cancelado');

function desenharAgenda() {
  const hoje = hojeISO();
  const agHoje = ativos(doDia(hoje));
  const prox = D.agendamentos.filter((a) => a.status === 'confirmado' && a.data >= hoje);
  const semana = D.agendamentos.filter((a) => a.status !== 'cancelado' && a.data >= hoje && a.data <= somaDias(hoje, 6));
  $('#kpisHoje').innerHTML = `
    <div class="kpi"><div class="rot">Atendimentos hoje</div><div class="val">${agHoje.length}</div><div class="sub">${agHoje.filter((a) => a.status === 'concluido').length} concluídos</div></div>
    <div class="kpi"><div class="rot">Previsto hoje</div><div class="val">${brl(agHoje.filter((a) => a.status !== 'faltou').reduce((s, a) => s + a.preco, 0))}</div><div class="sub">em serviços agendados</div></div>
    <div class="kpi"><div class="rot">Próximos 7 dias</div><div class="val">${semana.length}</div><div class="sub">${brl(semana.reduce((s, a) => s + a.preco, 0))} previstos</div></div>
    <div class="kpi"><div class="rot">Agendamentos futuros</div><div class="val">${prox.length}</div><div class="sub">confirmados</div></div>`;

  $('#tituloDia').textContent = (diaSel === hoje ? 'Hoje · ' : diaSel === somaDias(hoje, 1) ? 'Amanhã · ' : '') + dataExtenso(diaSel);
  $('#pickDia').value = diaSel;
  $('#hoje').classList.toggle('oculto', diaSel === hoje);
  // faixa da semana
  const inicio = somaDias(diaSel, -dataObj(diaSel).getDay());
  $('#semana').innerHTML = [...Array(7)].map((_, i) => {
    const iso = somaDias(inicio, i), d = dataObj(iso), h = D.config.horarios[d.getDay()];
    const aberto = h && h.aberto && !D.config.diasFechados.includes(iso), q = ativos(doDia(iso)).length;
    return `<div class="sdia${iso === diaSel ? ' sel' : ''}${aberto ? '' : ' fech'}" data-d="${iso}"><div class="s">${SEM[d.getDay()]}</div><div class="n">${d.getDate()}</div><div class="q">${aberto ? (q ? q + ' agend.' : 'livre') : 'fechado'}</div></div>`;
  }).join('');
  $$('.sdia').forEach((el) => (el.onclick = () => { diaSel = el.dataset.d; desenharAgenda(); }));

  // lista do dia com intervalos livres
  const lista = doDia(diaSel);
  const h = D.config.horarios[dataObj(diaSel).getDay()];
  const aberto = h && h.aberto && !D.config.diasFechados.includes(diaSel);
  let html = '';
  if (!aberto) html += '<div class="vazio">Salão fechado neste dia.' + (lista.length ? ' (há agendamentos registrados abaixo)' : '') + '</div>';
  let cursor = aberto ? toMin(h.inicio) : null;
  const pausa = aberto && h.almocoInicio && h.almocoFim ? [toMin(h.almocoInicio), toMin(h.almocoFim)] : null;
  const livre = (de, ate) => {
    if (cursor == null || ate - de < 15) return '';
    let partes = [[de, ate]];
    if (pausa) partes = partes.flatMap(([a, b]) => (pausa[1] <= a || pausa[0] >= b ? [[a, b]] : [[a, pausa[0]], [pausa[1], b]].filter(([x, y]) => y - x >= 15)));
    return partes.map(([a, b]) => `<div class="livre">livre ${toHH(a)} – ${toHH(b)}</div>`).join('');
  };
  lista.forEach((a) => {
    const ini = toMin(a.hora);
    if (a.status !== 'cancelado' && cursor != null && ini > cursor) html += livre(cursor, ini);
    html += `<div class="ag ${a.status}">
      <div class="h">${a.hora}<small>${duracaoTxt(a.duracao)}</small></div>
      <div><div class="nm">${esc(a.cliente)} <span class="tag ${a.status}">${STATUS[a.status]}</span></div>
        <div class="dica">${esc(a.servicoNome)} · ${brl(a.preco)} · ${foneFmt(a.telefone)} · cód. ${a.codigo}${a.origem === 'salao' ? ' · lançado no painel' : ''}</div>
        ${a.obs ? `<div class="dica">📝 ${esc(a.obs)}</div>` : ''}${a.motivo ? `<div class="dica">Motivo do cancelamento: ${esc(a.motivo)}</div>` : ''}</div>
      <div class="acts">
        <a class="btn zap peq" target="_blank" rel="noopener" href="${zapLink(a.telefone, `Olá, ${a.cliente.split(' ')[0]}! Passando para lembrar do seu horário no ${D.config.nomeSalao}: ${a.servicoNome}, ${dataExtenso(a.data)} às ${a.hora}. Até lá! 💜`)}">WhatsApp</a>
        ${a.status === 'confirmado' ? `<button class="btn peq" data-st="concluido" data-id="${a.id}">Concluído</button><button class="btn sec peq" data-st="faltou" data-id="${a.id}">Faltou</button><button class="btn sec peq" data-st="cancelado" data-id="${a.id}">Cancelar</button>` : `<button class="btn sec peq" data-st="confirmado" data-id="${a.id}">Desfazer</button>`}
      </div></div>`;
    if (a.status !== 'cancelado' && cursor != null) cursor = Math.max(cursor, ini + a.duracao);
  });
  if (aberto) html += livre(cursor, toMin(h.fim));
  if (aberto && !lista.length) html = '<div class="vazio" style="margin-bottom:8px">Nenhum agendamento neste dia ainda.</div>' + html;
  $('#listaDia').innerHTML = html;
  $$('[data-st]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.st === 'cancelado' && !confirm('Cancelar este agendamento? O horário volta a ficar livre.')) return;
    await api('/api/admin/agendamentos/' + b.dataset.id, { method: 'PUT', body: { status: b.dataset.st } });
    recarregar();
  }));
}
$('#ant').onclick = () => { diaSel = somaDias(diaSel, -1); desenharAgenda(); };
$('#prox').onclick = () => { diaSel = somaDias(diaSel, 1); desenharAgenda(); };
$('#hoje').onclick = () => { diaSel = hojeISO(); desenharAgenda(); };
$('#pickDia').onchange = (e) => { if (e.target.value) { diaSel = e.target.value; desenharAgenda(); } };

$('#novoAg').onclick = () => {
  const servs = D.servicos.filter((s) => s.ativo);
  const m = modal(`<h2 style="margin-bottom:14px">Novo agendamento</h2>
    <form id="fNovo">
      <label class="campo"><span>Serviço</span><select name="servicoId">${servs.map((s) => `<option value="${s.id}">${esc(s.nome)} — ${brl(s.preco)} (${duracaoTxt(s.duracao)})</option>`).join('')}</select></label>
      <div class="linha2"><label class="campo"><span>Data</span><input type="date" name="data" value="${diaSel}" required></label>
      <label class="campo"><span>Horário livre</span><select name="hora" required></select></label></div>
      <label class="campo"><span>Nome do cliente</span><input name="cliente" required></label>
      <label class="campo"><span>WhatsApp</span><input name="telefone" required inputmode="tel"></label>
      <label class="campo"><span>Observação</span><input name="obs"></label>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn sec" id="fechar">Fechar</button><button class="btn">Agendar</button></div>
    </form>`);
  const f = $('#fNovo', m);
  mascaraFone(f.telefone);
  const horas = async () => {
    const s = D.servicos.find((x) => x.id === f.servicoId.value);
    const r = await api(`/api/admin/horarios?data=${f.data.value}&duracao=${s.duracao}`);
    f.hora.innerHTML = r.horarios.length ? r.horarios.map((h) => `<option>${h}</option>`).join('') : '<option value="">Sem horários livres</option>';
  };
  f.servicoId.onchange = f.data.onchange = horas; horas();
  $('#fechar', m).onclick = () => m.remove();
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/admin/agendamentos', { method: 'POST', body: Object.fromEntries(new FormData(f)) }); m.remove(); diaSel = f.data.value; toast('Agendamento criado.'); recarregar(); }
    catch (err) { toast(err.message); }
  };
};

// ---------- Avisos ----------
function desenharAvisos() {
  $('#listaAvisos').innerHTML = D.avisos.length ? D.avisos.slice(0, 80).map((a) => {
    const d = new Date(a.criadoEm);
    return `<div class="aviso${a.lido ? '' : ' nlido'}"><div class="ic ${a.tipo}">${a.tipo === 'novo' ? '+' : '×'}</div>
      <div><div>${esc(a.texto)}</div><div class="dica">${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div></div></div>`;
  }).join('') : '<div class="vazio">Nenhum aviso ainda. Quando um cliente agendar ou cancelar, aparece aqui na hora.</div>';
}
$('#lerTodos').onclick = async () => { await api('/api/admin/avisos/lidos', { method: 'POST' }); recarregar(); };

// ---------- Serviços ----------
function desenharServicos() {
  const vendidos = {};
  D.agendamentos.filter((a) => a.status === 'concluido').forEach((a) => (vendidos[a.servicoId] = (vendidos[a.servicoId] || 0) + 1));
  $('#tabServ').innerHTML = D.servicos.map((s) => `<tr data-id="${s.id}">
    <td><input data-k="nome" value="${esc(s.nome)}"></td>
    <td><span class="td-l">Categoria</span><input data-k="categoria" value="${esc(s.categoria)}" list="cats"></td>
    <td><span class="td-l">Duração (min)</span><input data-k="duracao" type="number" min="5" step="5" class="num" value="${s.duracao}"></td>
    <td><span class="td-l">Preço (R$)</span><input data-k="preco" type="number" min="0" step="0.01" class="num" value="${s.preco}"></td>
    <td class="num"><span class="td-l">Vendidos</span><span class="num">${vendidos[s.id] || 0}</span></td>
    <td><span class="td-l">Ativo</span><label class="sw"><input type="checkbox" data-k="ativo" ${s.ativo ? 'checked' : ''}><span></span></label></td>
    <td><button class="link-btn" data-del title="Excluir" style="text-decoration:none;font-size:18px">🗑</button></td></tr>`).join('') +
    `<datalist id="cats">${[...new Set(D.servicos.map((s) => s.categoria))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
  $$('#tabServ input').forEach((inp) => (inp.onchange = async () => {
    const id = inp.closest('tr').dataset.id, k = inp.dataset.k;
    const v = k === 'ativo' ? inp.checked : inp.type === 'number' ? Number(inp.value) : inp.value;
    await api('/api/admin/servicos/' + id, { method: 'PUT', body: { [k]: v } });
    toast('Serviço atualizado.'); recarregar();
  }));
  $$('#tabServ [data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Excluir este serviço? (Agendamentos já feitos não são afetados. Para só esconder, desative.)')) return;
    await api('/api/admin/servicos/' + b.closest('tr').dataset.id, { method: 'DELETE' }); recarregar();
  }));
}
$('#addServ').onclick = async () => {
  await api('/api/admin/servicos', { method: 'POST', body: { nome: 'Novo serviço', categoria: 'Geral', duracao: 30, preco: 0 } });
  await recarregar();
  const ult = $$('#tabServ tr').pop(); ult && ult.querySelector('input').select();
};

// ---------- Financeiro ----------
function intervalo() {
  const v = $('#periodo').value, hoje = new Date();
  if (v === 'mes') return [isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), isoDe(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))];
  if (v === 'mesant') return [isoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), 0))];
  if (v === 'tudo') return ['0000-00-00', '9999-12-31'];
  return [somaDias(hojeISO(), -Number(v) + 1), hojeISO()];
}
function desenharFinanceiro() {
  const [de, ate] = intervalo();
  const L = D.agendamentos.filter((a) => a.data >= de && a.data <= ate);
  const conc = L.filter((a) => a.status === 'concluido'), conf = L.filter((a) => a.status === 'confirmado');
  const canc = L.filter((a) => a.status === 'cancelado'), falt = L.filter((a) => a.status === 'faltou');
  const fat = conc.reduce((s, a) => s + a.preco, 0);
  $('#kpisFin').innerHTML = `
    <div class="kpi"><div class="rot">Faturado (concluídos)</div><div class="val">${brl(fat)}</div><div class="sub">${conc.length} atendimentos</div></div>
    <div class="kpi"><div class="rot">A receber (confirmados)</div><div class="val">${brl(conf.reduce((s, a) => s + a.preco, 0))}</div><div class="sub">${conf.length} agendados</div></div>
    <div class="kpi"><div class="rot">Ticket médio</div><div class="val">${brl(conc.length ? fat / conc.length : 0)}</div><div class="sub">por atendimento</div></div>
    <div class="kpi"><div class="rot">Cancelamentos / faltas</div><div class="val">${canc.length} / ${falt.length}</div><div class="sub">${brl([...canc, ...falt].reduce((s, a) => s + a.preco, 0))} que não entraram</div></div>`;
  const por = {};
  conc.forEach((a) => { por[a.servicoNome] ||= { q: 0, v: 0 }; por[a.servicoNome].q++; por[a.servicoNome].v += a.preco; });
  const r = Object.entries(por).sort((a, b) => b[1].v - a[1].v), max = r[0]?.[1].v || 1;
  $('#rank').innerHTML = r.length ? r.map(([n, x]) => `<div class="rank"><span>${esc(n)}</span><span class="dica">${x.q}×</span><b>${brl(x.v)}</b><div class="bar"><i style="width:${(x.v / max) * 100}%"></i></div></div>`).join('')
    : '<div class="vazio">Sem atendimentos concluídos no período. Marque "Concluído" na agenda após cada atendimento.</div>';
}
$('#periodo').onchange = desenharFinanceiro;

// ---------- Divulgar ----------
function desenharLinks() {
  const o = baseApp();
  const itens = [['Link para clientes (agendar, horários vagos, funcionamento e preços)', o], ['Direto nos horários vagos', o + '#vagas'], ['Direto na tabela de preços', o + '#precos'], ['Painel do salão — só você, protegido pelo PIN', o + 'admin.html']];
  $('#links').innerHTML = itens.map(([t, u]) => `<div class="dica" style="font-weight:600;margin-bottom:4px">${t}</div><div class="linkbox"><code>${u}</code><button class="btn sec peq" data-copy="${u}">Copiar</button></div>`).join('') +
    '';
  $$('[data-copy]').forEach((b) => (b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast('Link copiado!'))));
  if (window.atualizarImagem) atualizarImagem();
}

// ---------- Configurações ----------
let fechadosTmp = [], logoTmp = '';
function previewLogo() {
  const f = $('#formCfg');
  $('#logoTamTxt').textContent = f.logoTamanho.value + ' px';
  aplicarLogo($('#logoPrev'), { logo: logoTmp, logoTamanho: f.logoTamanho.value, logoFormato: f.logoFormato.value, nomeSalao: f.nomeSalao.value });
}
function desenharConfig() {
  const c = D.config, f = $('#formCfg');
  logoTmp = c.logo || '';
  f.logoTamanho.value = c.logoTamanho || 56; f.logoFormato.value = c.logoFormato || 'redondo';
  previewLogo();
  ['nomeSalao', 'slogan', 'whatsapp', 'endereco', 'emailAvisos', 'intervaloMin', 'diasAntecedencia', 'antecedenciaMinHoras', 'cancelamentoMinHoras', 'pin'].forEach((k) => (f.elements[k].value = c[k] ?? ''));
  $('#horarios').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = c.horarios[d] || {};
    return `<div class="hor-linha${h.aberto ? '' : ' fechado'}" data-d="${d}"><b>${SEM_LONGO[d]}</b><label class="sw"><input type="checkbox" data-k="aberto" ${h.aberto ? 'checked' : ''}><span></span></label>
      <div class="hl-grp">
        <label><small>Abre</small><input class="hl" type="time" data-k="inicio" value="${h.inicio || ''}"></label><label><small>Fecha</small><input class="hl" type="time" data-k="fim" value="${h.fim || ''}"></label>
        <label><small>Pausa início</small><input class="hl" type="time" data-k="almocoInicio" value="${h.almocoInicio || ''}"></label><label><small>Pausa fim</small><input class="hl" type="time" data-k="almocoFim" value="${h.almocoFim || ''}"></label>
      </div></div>`;
  }).join('');
  $$('.hor-linha [data-k=aberto]').forEach((cb) => (cb.onchange = () => cb.closest('.hor-linha').classList.toggle('fechado', !cb.checked)));
  fechadosTmp = [...c.diasFechados].sort();
  desenharFechados();
}
function desenharFechados() {
  $('#fechados').innerHTML = fechadosTmp.length ? fechadosTmp.map((d) => `<span class="tag confirmado" style="font-size:13px;text-transform:none">${dataBR(d)} <button type="button" class="link-btn" data-rm="${d}" style="text-decoration:none">×</button></span>`).join('') : '<span class="dica">Nenhum.</span>';
  $$('[data-rm]').forEach((b) => (b.onclick = () => { fechadosTmp = fechadosTmp.filter((x) => x !== b.dataset.rm); desenharFechados(); }));
}
$('#addFechado').onclick = () => { const v = $('#novoFechado').value; if (v && !fechadosTmp.includes(v)) { fechadosTmp.push(v); fechadosTmp.sort(); desenharFechados(); } };
$('#formCfg').addEventListener('input', () => { $('#formCfg').dataset.editando = '1'; previewLogo(); });
$('#logoArq').onchange = (e) => {
  const arq = e.target.files[0]; if (!arq) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    if (arq.type === 'image/svg+xml') { logoTmp = leitor.result; $('#formCfg').dataset.editando = '1'; return previewLogo(); }
    const img = new Image();
    img.onload = () => { // reduz para no máximo 512 px, mantendo a proporção
      const k = Math.min(1, 512 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      logoTmp = cv.toDataURL('image/png');
      if (logoTmp.length > 1.5e6) logoTmp = cv.toDataURL('image/jpeg', 0.85);
      $('#formCfg').dataset.editando = '1'; previewLogo();
      toast('Logo carregada. Clique em "Salvar configurações" para aplicar.');
    };
    img.onerror = () => toast('Não consegui ler essa imagem. Tente PNG ou JPG.');
    img.src = leitor.result;
  };
  leitor.readAsDataURL(arq);
  e.target.value = '';
};
$('#logoRemover').onclick = () => { logoTmp = ''; $('#formCfg').dataset.editando = '1'; previewLogo(); };
$('#formCfg').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, body = {};
  ['nomeSalao', 'slogan', 'whatsapp', 'endereco', 'emailAvisos', 'intervaloMin', 'diasAntecedencia', 'antecedenciaMinHoras', 'cancelamentoMinHoras', 'pin'].forEach((k) => (body[k] = f.elements[k].value));
  if (!String(body.pin).trim()) return toast('O PIN não pode ficar vazio.');
  body.horarios = {};
  $$('.hor-linha[data-d]').forEach((l) => {
    const o = {}; $$('[data-k]', l).forEach((i) => (o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value));
    body.horarios[l.dataset.d] = o;
  });
  body.diasFechados = fechadosTmp;
  if (logoTmp !== (D.config.logo || '')) body.logo = logoTmp;
  body.logoTamanho = Number(f.logoTamanho.value); body.logoFormato = f.logoFormato.value;
  await api('/api/admin/config', { method: 'PUT', body });
  delete f.dataset.editando;
  toast('Configurações salvas.'); recarregar();
});

// início
if (TOKEN) entrar(); else sair();
