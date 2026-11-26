// Página do cliente: escolher serviço → dia/horário → dados → confirmar
let info, servSel = null, dataSel = null, horaSel = null, horaPendente = null;
const KEY = 'meusAgendamentos';
const salvos = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const guardar = (lista) => { try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch {} };

async function iniciar() {
  try { info = await req('/api/publico'); }
  catch (e) { $('#nome').textContent = 'Indisponível'; $('#slogan').textContent = e.message; $('#servicos').innerHTML = '<div class="vazio">Não foi possível carregar a agenda agora. Tente de novo em instantes.</div>'; return; }
  document.title = 'Agendar — ' + info.nomeSalao;
  $('#nome').textContent = info.nomeSalao;
  $('#slogan').textContent = info.slogan || '';
  aplicarLogo($('#logo'), info);
  obterLogo(info).then(() => info.logo && aplicarLogo($('#logo'), info));
  $('#rodape').innerHTML = [info.endereco && esc(info.endereco), info.whatsapp && `<a href="${zapLink(info.whatsapp, 'Olá! Tenho uma dúvida sobre agendamento.')}" target="_blank" rel="noopener">Falar no WhatsApp</a>`].filter(Boolean).join(' · ');
  desenharServicos();
  desenharFuncionamento();
  desenharPrecos();
  $('#vServico').innerHTML += info.servicos.map((s) => `<option value="${s.id}">${esc(s.nome)} (${duracaoTxt(s.duracao)})</option>`).join('');
  $('#vServico').onchange = $('#vDias').onchange = carregarVagas;
  const caminho = location.hash.replace('#', '') || new URLSearchParams(location.search).get('aba');
  if (['vagas', 'funcionamento', 'precos'].includes(caminho)) abrirAba(caminho);
  desenharMeus();
  mascaraFone($('#form [name=telefone]'));
  mascaraFone($('#formBusca [name=telefone]'));
  const pre = new URLSearchParams(location.search).get('servico');
  if (pre && info.servicos.some((s) => s.id === pre)) escolherServico(pre);
}

function desenharServicos() {
  const porCat = {};
  info.servicos.forEach((s) => (porCat[s.categoria || 'Serviços'] ||= []).push(s));
  $('#servicos').innerHTML = Object.entries(porCat).map(([cat, lista]) =>
    `<div class="cat">${esc(cat)}</div><div class="servicos">` +
    lista.map((s) => `<button class="serv${servSel?.id === s.id ? ' sel' : ''}" data-id="${s.id}">
      <span class="nome">${esc(s.nome)}</span><span class="dur">${duracaoTxt(s.duracao)}</span><span class="preco">${brl(s.preco)}</span></button>`).join('') +
    '</div>').join('') || '<div class="vazio">Nenhum serviço disponível no momento.</div>';
  $$('.serv').forEach((b) => (b.onclick = () => escolherServico(b.dataset.id)));
}

function escolherServico(id) {
  servSel = info.servicos.find((s) => s.id === id);
  horaSel = null;
  desenharServicos();
  $('#passo1').classList.add('fechado');
  $('#srNome').textContent = servSel.nome + ' · ' + duracaoTxt(servSel.duracao);
  $('#srPreco').textContent = brl(servSel.preco);
  $('#dica2').textContent = `${servSel.nome} · duração aproximada de ${duracaoTxt(servSel.duracao)}`;
  $('#blocoData').classList.remove('oculto');
  desenharDatas();
  $('#passo3').classList.add('oculto');
  setTimeout(() => $('#passo1').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function diaAberto(iso) { const h = info.horarios[dataObj(iso).getDay()]; return h && h.aberto; }

function desenharDatas() {
  if (!dataSel || !diaAberto(dataSel)) dataSel = info.datas.find(diaAberto) || null;
  $('#datas').innerHTML = info.datas.map((iso) => {
    const d = dataObj(iso), aberto = diaAberto(iso);
    return `<button class="dia${iso === dataSel ? ' sel' : ''}${aberto ? '' : ' fechado'}" data-d="${iso}" ${aberto ? '' : 'disabled title="Fechado"'}>
      <div class="sem">${iso === hojeISO() ? 'Hoje' : SEM[d.getDay()]}</div><div class="num">${d.getDate()}</div><div class="mes">${MES[d.getMonth()]}</div></button>`;
  }).join('');
  $$('.dia:not(.fechado)').forEach((b) => (b.onclick = () => { dataSel = b.dataset.d; horaSel = null; desenharDatas(); $('#passo3').classList.add('oculto'); }));
  carregarHoras();
}

async function carregarHoras() {
  const box = $('#horas');
  if (!dataSel) { box.innerHTML = '<div class="vazio" style="grid-column:1/-1">Sem dias disponíveis no momento.</div>'; return; }
  box.innerHTML = '<div class="vazio" style="grid-column:1/-1">Buscando horários…</div>';
  const { horarios } = await req(`/api/horarios?data=${dataSel}&servico=${servSel.id}`);
  if (!horarios.length) { box.innerHTML = `<div class="vazio" style="grid-column:1/-1">Sem horários livres em ${dataExtenso(dataSel)}. Tente outro dia.</div>`; return; }
  if (horaPendente && horarios.includes(horaPendente)) horaSel = horaPendente;
  horaPendente = null;
  box.innerHTML = horarios.map((h) => `<button class="hora${h === horaSel ? ' sel' : ''}" data-h="${h}">${h}</button>`).join('');
  $$('.hora', box).forEach((b) => (b.onclick = () => {
    horaSel = b.dataset.h;
    $$('.hora', box).forEach((x) => x.classList.toggle('sel', x === b));
    mostrarPasso3();
  }));
  if (horaSel) mostrarPasso3();
}

function resumoHTML(s, data, hora) {
  return `<div><b>${esc(s.nome || s.servicoNome)}</b></div><div>${dataExtenso(data)} às <b>${hora}</b></div>
    <div class="dica">Duração aprox. ${duracaoTxt(s.duracao)}</div><div class="total">${brl(s.preco)}</div>`;
}

function mostrarPasso3() {
  $('#resumo').innerHTML = resumoHTML(servSel, dataSel, horaSel);
  const p = $('#passo3'); p.classList.remove('oculto');
  const ult = salvos()[0];
  if (ult && !$('#form [name=cliente]').value) { $('#form [name=cliente]').value = ult.cliente || ''; $('#form [name=telefone]').value = foneFmt(ult.telefone); }
  p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), btn = $('#btnConfirmar');
  btn.disabled = true; btn.textContent = 'Confirmando…';
  try {
    const { agendamento: a } = await req('/api/agendar', { method: 'POST', body: { servicoId: servSel.id, data: dataSel, hora: horaSel, cliente: f.get('cliente'), telefone: f.get('telefone'), obs: f.get('obs') } });
    const tel = String(f.get('telefone')).replace(/\D/g, '');
    guardar([{ codigo: a.codigo, telefone: tel, cliente: a.cliente }, ...salvos().filter((x) => x.codigo !== a.codigo)].slice(0, 20));
    $('#fluxo').classList.add('oculto');
    $('#ok').classList.remove('oculto');
    $('#resumoOk').innerHTML = resumoHTML(a, a.data, a.hora);
    $('#codigoOk').textContent = a.codigo;
    if (info.whatsapp) {
      const z = $('#zapOk'); z.classList.remove('oculto');
      z.href = zapLink(info.whatsapp, `Olá! Acabei de agendar pelo app:\n${a.servicoNome}\n${dataExtenso(a.data)} às ${a.hora}\nNome: ${a.cliente}\nCódigo: ${a.codigo}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    desenharMeus();
  } catch (err) {
    toast(err.message, 4500);
    if (err.status === 400) { horaSel = null; carregarHoras(); $('#passo3').classList.add('oculto'); }
  } finally { btn.disabled = false; btn.textContent = 'Confirmar agendamento'; }
});

$('#srTrocar').onclick = () => { $('#passo1').classList.remove('fechado'); $('#passo3').classList.add('oculto'); };

// ---------- Meus agendamentos / cancelamento ----------
async function desenharMeus(extra = []) {
  const lista = salvos();
  const porTel = {};
  lista.forEach((x) => (porTel[x.telefone] ||= []).push(x.codigo));
  let ags = [...extra];
  for (const [telefone, codigos] of Object.entries(porTel)) {
    try { const r = await req('/api/meus', { method: 'POST', body: { telefone, codigos } }); ags.push(...r.agendamentos.map((a) => ({ ...a, telefone }))); } catch {}
  }
  const vistos = new Set();
  ags = ags.filter((a) => !vistos.has(a.codigo) && vistos.add(a.codigo)).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const box = $('#listaMeus');
  $('#meus .titulo-sec').classList.toggle('oculto', !ags.length);
  $('#meus').classList.toggle('sem-ag', !ags.length);
  if (!ags.length) { box.innerHTML = ''; return; }
  box.innerHTML = ags.map((a) => `<div class="meu">
    <div class="info"><b>${esc(a.servicoNome)}</b> <span class="tag ${a.status}">${a.status}</span><br>
    <span class="dica">${dataExtenso(a.data)} às ${a.hora} · código ${a.codigo}</span></div>
    ${a.status === 'confirmado' ? `<button class="btn sec peq" data-c="${a.codigo}" data-t="${a.telefone}">Cancelar</button>` : ''}</div>`).join('');
  $$('[data-c]', box).forEach((b) => (b.onclick = () => pedirCancelamento(b.dataset.c, b.dataset.t)));
}

function pedirCancelamento(codigo, telefone) {
  const m = modal(`<h2 style="margin-bottom:8px">Cancelar agendamento?</h2>
    <p class="dica" style="margin-bottom:14px">O salão será avisado na hora e o horário volta a ficar disponível.</p>
    <label class="campo"><span>Motivo (opcional)</span><input id="motivo" placeholder="Ex.: imprevisto no trabalho"></label>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn sec" id="nao">Voltar</button><button class="btn perigo" id="sim">Cancelar horário</button></div>`);
  $('#nao', m).onclick = () => m.remove();
  $('#sim', m).onclick = async () => {
    try {
      await req('/api/cancelar', { method: 'POST', body: { codigo, telefone, motivo: $('#motivo', m).value } });
      m.remove(); toast('Agendamento cancelado. O salão já foi avisado.');
      desenharMeus(); if (servSel) carregarHoras();
    } catch (err) { toast(err.message, 5000); }
  };
}

$('#formBusca').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const telefone = String(f.get('telefone')).replace(/\D/g, ''), codigo = String(f.get('codigo')).toUpperCase().trim();
  try {
    const r = await req('/api/meus', { method: 'POST', body: { telefone, codigo } });
    if (!r.agendamentos.length) return toast('Nenhum agendamento futuro encontrado com esses dados.');
    guardar([{ codigo, telefone }, ...salvos().filter((x) => x.codigo !== codigo)]);
    $('#buscar').open = false; e.target.reset();
    desenharMeus();
  } catch (err) { toast(err.message); }
});

// ---------- Abas ----------
function abrirAba(aba) {
  $$('#abas button').forEach((b) => b.classList.toggle('on', b.dataset.aba === aba));
  $$('[data-sec]').forEach((s) => s.classList.toggle('oculto', s.dataset.sec !== aba));
  history.replaceState(null, '', aba === 'agendar' ? location.pathname + location.search : location.pathname + '#' + aba);
  if (aba === 'vagas') carregarVagas();
  window.scrollTo({ top: 0 });
}
$$('#abas button').forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));
window.addEventListener('hashchange', () => { const a = location.hash.replace('#', ''); if (info && ['agendar', 'vagas', 'funcionamento', 'precos'].includes(a)) abrirAba(a); });

// ---------- Horários vagos ----------
async function carregarVagas() {
  const s = info.servicos.find((x) => x.id === $('#vServico').value);
  const r = await req(`/api/vagas?dias=${$('#vDias').value}&duracao=${s ? s.duracao : 30}`);
  const dias = r.dias.filter((d) => d.horarios.length);
  $('#vLista').innerHTML = dias.length ? dias.map((d) => `<div class="dia-vagas"><h3>${d.data === hojeISO() ? 'Hoje · ' : ''}${dataExtenso(d.data)}<small>${d.horarios.length} vaga${d.horarios.length > 1 ? 's' : ''}</small></h3>
    <div class="chips">${d.horarios.map((h) => `<button class="chip" data-d="${d.data}" data-h="${h}">${h}</button>`).join('')}</div></div>`).join('')
    : '<div class="vazio">Agenda lotada nesse período! Tente um período maior.</div>';
  $$('#vLista .chip').forEach((c) => (c.onclick = () => {
    abrirAba('agendar');
    dataSel = c.dataset.d; horaPendente = c.dataset.h; horaSel = null;
    const alvo = s || servSel;
    if (alvo) escolherServico(alvo.id);
    else { toast(`Escolha o serviço para ${dataExtenso(c.dataset.d)} às ${c.dataset.h}`); $('#servicos').scrollIntoView({ behavior: 'smooth' }); }
  }));
}

// ---------- Funcionamento ----------
function desenharFuncionamento() {
  const hoje = new Date().getDay();
  $('#fLista').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = info.horarios[d] || {};
    const txt = !h.aberto ? '<span class="fech">Fechado</span>'
      : h.almocoInicio && h.almocoFim ? `${h.inicio} – ${h.almocoInicio} · ${h.almocoFim} – ${h.fim}` : `${h.inicio} – ${h.fim}`;
    return `<div class="func${d === hoje ? ' hoje' : ''}"><span>${SEM_LONGO[d]}${d === hoje ? ' (hoje)' : ''}</span><span>${txt}</span></div>`;
  }).join('');
  if (info.diasFechados?.length) {
    $('#fFechados').classList.remove('oculto');
    $('#fFechadosLista').innerHTML = info.diasFechados.map((d) => `<span class="chip" style="cursor:default">${dataExtenso(d)}</span>`).join('');
  }
  const contato = [info.endereco && `<p style="margin:0 0 12px">📍 ${esc(info.endereco)}</p>`,
    info.endereco && `<a class="btn sec peq" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.endereco)}">Ver no mapa</a>`,
    info.whatsapp && `<a class="btn zap peq" target="_blank" rel="noopener" href="${zapLink(info.whatsapp, 'Olá! Tenho uma dúvida.')}">WhatsApp ${foneFmt(info.whatsapp)}</a>`].filter(Boolean);
  if (contato.length) $('#fContatoInfo').innerHTML = contato.join(' ');
  else $('#fContato').classList.add('oculto');
}

// ---------- Preços ----------
function desenharPrecos() {
  const porCat = {};
  info.servicos.forEach((s) => (porCat[s.categoria || 'Serviços'] ||= []).push(s));
  $('#pLista').innerHTML = Object.entries(porCat).map(([cat, lista]) => `<div class="cat">${esc(cat)}</div>` +
    lista.map((s) => `<div class="preco-linha"><div><b>${esc(s.nome)}</b><div class="dica">${duracaoTxt(s.duracao)}</div></div>
      <span class="p">${brl(s.preco)}</span><button class="btn sec peq" data-ag="${s.id}">Agendar</button></div>`).join('')).join('')
    || '<div class="vazio">Nenhum serviço disponível no momento.</div>';
  $$('[data-ag]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); abrirAba('agendar'); escolherServico(b.dataset.ag); }));
  $$('.preco-linha').forEach((l) => (l.onclick = () => l.querySelector('[data-ag]').click()));
}

iniciar();
