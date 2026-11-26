/**
 * App de Agendamento do Salão — "servidor" gratuito no Google Apps Script.
 * Os dados ficam na própria planilha (abas Agendamentos, Servicos, Horarios, Config, Avisos, Logo).
 *
 * Como instalar (uma vez): veja o README do repositório.
 *  1. Na planilha: Extensões → Apps Script → cole este arquivo → Salvar.
 *  2. Rode a função "configurar" (autorize o acesso).
 *  3. Implantar → Nova implantação → App da Web → Executar como: Eu · Quem pode acessar: Qualquer pessoa.
 *  4. Copie a URL /exec e cole em config.js no GitHub.
 */

const TZ = 'America/Sao_Paulo';

// ---------- Estrutura da planilha ----------
const ABAS = {
  Agendamentos: ['id', 'codigo', 'cliente', 'telefone', 'servicoId', 'servicoNome', 'duracao', 'preco', 'data', 'hora', 'status', 'obs', 'origem', 'criadoEm', 'canceladoEm', 'canceladoPor', 'motivo'],
  Servicos: ['id', 'nome', 'categoria', 'duracao', 'preco', 'ativo'],
  Horarios: ['dia', 'diaSemana', 'aberto', 'inicio', 'fim', 'pausaInicio', 'pausaFim'],
  Config: ['chave', 'valor', 'descricao'],
  Avisos: ['id', 'tipo', 'criadoEm', 'lido', 'agendamentoId', 'texto'],
  Logo: ['parte', 'dados']
};
const COLS_TEXTO = { Agendamentos: ['id', 'codigo', 'telefone', 'servicoId', 'data', 'hora', 'criadoEm', 'canceladoEm'], Servicos: ['id'], Horarios: ['inicio', 'fim', 'pausaInicio', 'pausaFim'], Config: ['valor'], Avisos: ['id', 'criadoEm', 'agendamentoId'], Logo: ['dados'] };

const CONFIG_PADRAO = [
  ['nomeSalao', 'Studio Bella', 'Nome que aparece para os clientes'],
  ['slogan', 'Beleza com hora marcada', 'Frase abaixo do nome'],
  ['whatsapp', '', 'WhatsApp do salão com DDD (só números)'],
  ['endereco', '', 'Endereço do salão'],
  ['emailAvisos', '', 'E-mail que recebe aviso de cada agendamento/cancelamento (vazio = e-mail do dono da planilha)'],
  ['intervaloMin', '30', 'De quantos em quantos minutos começam os horários'],
  ['diasAntecedencia', '21', 'Até quantos dias à frente o cliente pode agendar'],
  ['antecedenciaMinHoras', '1', 'Antecedência mínima para agendar (horas)'],
  ['cancelamentoMinHoras', '2', 'Cliente cancela pelo link até X horas antes'],
  ['diasFechados', '', 'Feriados/folgas, separados por vírgula: 2026-12-25, 2027-01-01'],
  ['pin', '1234', 'PIN do painel do salão'],
  ['logoTamanho', '56', 'Tamanho da logo (px)'],
  ['logoFormato', 'redondo', 'redondo | quadrado | original'],
  ['logoVersao', '', '(automático)']
];
const SERVICOS_PADRAO = [
  ['s1', 'Corte feminino', 'Cabelo', 60, 80, true], ['s2', 'Corte masculino', 'Cabelo', 30, 45, true],
  ['s3', 'Escova', 'Cabelo', 45, 55, true], ['s4', 'Coloração', 'Química', 120, 180, true],
  ['s5', 'Mechas / luzes', 'Química', 180, 320, true], ['s6', 'Hidratação', 'Tratamento', 45, 70, true],
  ['s7', 'Manicure', 'Unhas', 45, 35, true], ['s8', 'Pedicure', 'Unhas', 45, 40, true],
  ['s9', 'Design de sobrancelha', 'Estética', 30, 40, true]
];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const HORARIOS_PADRAO = [
  [0, DIAS[0], false, '09:00', '13:00', '', ''], [1, DIAS[1], false, '09:00', '19:00', '12:00', '13:00'],
  [2, DIAS[2], true, '09:00', '19:00', '12:00', '13:00'], [3, DIAS[3], true, '09:00', '19:00', '12:00', '13:00'],
  [4, DIAS[4], true, '09:00', '19:00', '12:00', '13:00'], [5, DIAS[5], true, '09:00', '20:00', '12:00', '13:00'],
  [6, DIAS[6], true, '08:00', '17:00', '', '']
];

const PLANILHA_ID = '18ChN7omFeBy48t2Pl86uJ1MdsYJ9dEbG0V0gY0oZDhw'; // planilha "Projeto - Agendamentos"
function ss_() { return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PLANILHA_ID); }

/** Cria/ajusta as abas. Pode rodar quantas vezes quiser (não apaga nada). */
function configurar() {
  const ss = ss_();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(ABAS).forEach((nome) => {
    let sh = ss.getSheetByName(nome);
    if (!sh) sh = ss.insertSheet(nome);
    const cab = ABAS[nome];
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#5a1f38').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    (COLS_TEXTO[nome] || []).forEach((c) => sh.getRange(2, cab.indexOf(c) + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'));
    if (sh.getLastRow() < 2) {
      const seed = { Config: CONFIG_PADRAO, Servicos: SERVICOS_PADRAO, Horarios: HORARIOS_PADRAO }[nome];
      if (seed) sh.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
    }
  });
  const sv = ss.getSheetByName('Servicos'); sv.getRange(2, 6, Math.max(sv.getLastRow() - 1, 1), 1).insertCheckboxes();
  const hr = ss.getSheetByName('Horarios'); hr.getRange(2, 3, 7, 1).insertCheckboxes();
  const lg = ss.getSheetByName('Logo'); lg.hideSheet();
  const pad = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (pad && pad.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(pad);
  CacheService.getScriptCache().put('ok', '1', 21600);
  return 'Planilha pronta!';
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Agendamentos')
    .addItem('Configurar / reparar planilha', 'configurar')
    .addItem('Enviar e-mail de teste', 'testarEmail')
    .addToUi();
}
function testarEmail() { enviarEmail_('Teste do app de agendamento', '<p>Se você recebeu este e-mail, os avisos estão funcionando.</p>'); }

// ---------- Leitura / escrita ----------
function aba_(nome) {
  if (!CacheService.getScriptCache().get('ok') || !ss_().getSheetByName(nome)) configurar();
  return ss_().getSheetByName(nome);
}
function txtData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  v = String(v || '').trim();
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v;
}
function txtHora_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'HH:mm');
  if (typeof v === 'number') { const t = Math.round(v * 1440); return pad2_(Math.floor(t / 60) % 24) + ':' + pad2_(t % 60); }
  v = String(v || '').trim();
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  return m ? pad2_(m[1]) + ':' + m[2] : '';
}
function bool_(v) { return v === true || /^(true|sim|s|1|x|verdadeiro)$/i.test(String(v).trim()); }
function num_(v) { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }
function pad2_(n) { return String(n).padStart(2, '0'); }

function ler_(nome) {
  const sh = aba_(nome), cab = ABAS[nome];
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cab.length).getValues().map((r, i) => {
    const o = { _linha: i + 2 };
    cab.forEach((c, j) => (o[c] = r[j]));
    return o;
  });
}
function linhaDe_(nome, o) { return ABAS[nome].map((c) => (o[c] === undefined || o[c] === null ? '' : o[c])); }
function inserir_(nome, o) { aba_(nome).appendRow(linhaDe_(nome, o)); }
function salvarLinha_(nome, o) { aba_(nome).getRange(o._linha, 1, 1, ABAS[nome].length).setValues([linhaDe_(nome, o)]); }

// ---------- Modelos ----------
function config_() {
  const c = {};
  ler_('Config').forEach((r) => { if (r.chave) c[String(r.chave).trim()] = String(r.valor == null ? '' : r.valor); });
  CONFIG_PADRAO.forEach(([k, v]) => { if (!(k in c)) c[k] = v; });
  ['intervaloMin', 'diasAntecedencia', 'antecedenciaMinHoras', 'cancelamentoMinHoras', 'logoTamanho'].forEach((k) => (c[k] = num_(c[k])));
  c.intervaloMin = c.intervaloMin || 30; c.diasAntecedencia = c.diasAntecedencia || 21;
  c.diasFechados = String(c.diasFechados || '').split(/[,;\s]+/).map(txtData_).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  c.whatsapp = String(c.whatsapp).replace(/\D/g, '');
  c.horarios = {};
  ler_('Horarios').forEach((h) => {
    c.horarios[num_(h.dia)] = { aberto: bool_(h.aberto), inicio: txtHora_(h.inicio), fim: txtHora_(h.fim), almocoInicio: txtHora_(h.pausaInicio), almocoFim: txtHora_(h.pausaFim) };
  });
  return c;
}
function setConfig_(chave, valor) {
  const sh = aba_('Config');
  const r = ler_('Config').find((x) => String(x.chave).trim() === chave);
  if (r) sh.getRange(r._linha, 2).setValue(String(valor));
  else sh.appendRow([chave, String(valor), '']);
}
function servicos_() {
  return ler_('Servicos').filter((s) => s.id && s.nome).map((s) => ({ _linha: s._linha, id: String(s.id), nome: String(s.nome), categoria: String(s.categoria || 'Geral'), duracao: num_(s.duracao) || 30, preco: num_(s.preco), ativo: bool_(s.ativo) }));
}
function agendamentos_() {
  return ler_('Agendamentos').filter((a) => a.id).map((a) => ({
    _linha: a._linha, id: String(a.id), codigo: String(a.codigo), cliente: String(a.cliente), telefone: String(a.telefone).replace(/\D/g, ''),
    servicoId: String(a.servicoId), servicoNome: String(a.servicoNome), duracao: num_(a.duracao), preco: num_(a.preco),
    data: txtData_(a.data), hora: txtHora_(a.hora), status: String(a.status || 'confirmado').toLowerCase(), obs: String(a.obs || ''),
    origem: String(a.origem || ''), criadoEm: String(a.criadoEm || ''), canceladoEm: String(a.canceladoEm || ''), canceladoPor: String(a.canceladoPor || ''), motivo: String(a.motivo || '')
  }));
}
function avisos_() {
  return ler_('Avisos').filter((a) => a.id).map((a) => ({ _linha: a._linha, id: String(a.id), tipo: String(a.tipo), criadoEm: String(a.criadoEm), lido: bool_(a.lido), agendamentoId: String(a.agendamentoId), texto: String(a.texto) }))
    .sort((x, y) => (y.criadoEm > x.criadoEm ? 1 : -1));
}
const semLinha_ = (o) => { const c = Object.assign({}, o); delete c._linha; return c; };

// ---------- Datas e horários ----------
const toMin_ = (h) => { if (!h) return null; const p = h.split(':'); return Number(p[0]) * 60 + Number(p[1]); };
const toHH_ = (m) => pad2_(Math.floor(m / 60)) + ':' + pad2_(m % 60);
function agora_() { const s = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm"); return { data: s.slice(0, 10), min: toMin_(s.slice(11)), iso: new Date().toISOString() }; }
function utc_(iso) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); }
function isoUtc_(d) { return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate()); }
function somaDias_(iso, n) { const d = utc_(iso); d.setUTCDate(d.getUTCDate() + n); return isoUtc_(d); }
function diaSemana_(iso) { return utc_(iso).getUTCDay(); }
function difDias_(a, b) { return Math.round((utc_(b) - utc_(a)) / 864e5); }

function datasDisponiveis_(cfg) { const h = agora_().data, out = []; for (let i = 0; i < cfg.diasAntecedencia; i++) out.push(somaDias_(h, i)); return out; }

function horariosLivres_(cfg, ags, data, duracao) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return [];
  const h = cfg.horarios[diaSemana_(data)];
  if (!h || !h.aberto || cfg.diasFechados.indexOf(data) >= 0) return [];
  const ini = toMin_(h.inicio), fim = toMin_(h.fim), aI = toMin_(h.almocoInicio), aF = toMin_(h.almocoFim);
  if (ini == null || fim == null) return [];
  const ocup = ags.filter((a) => a.data === data && a.status !== 'cancelado').map((a) => [toMin_(a.hora), toMin_(a.hora) + a.duracao]);
  if (aI != null && aF != null && aF > aI) ocup.push([aI, aF]);
  const ag = agora_();
  const limite = data === ag.data ? ag.min + cfg.antecedenciaMinHoras * 60 : -1;
  if (data < ag.data) return [];
  const livres = [];
  for (let t = ini; t + duracao <= fim; t += cfg.intervaloMin) {
    if (t < limite) continue;
    if (ocup.some((o) => t < o[1] && t + duracao > o[0])) continue;
    livres.push(toHH_(t));
  }
  return livres;
}

// ---------- Avisos (planilha + e-mail) ----------
function dataBR_(iso) { return iso.split('-').reverse().join('/'); }
function enviarEmail_(assunto, html) {
  try {
    const para = config_().emailAvisos || Session.getEffectiveUser().getEmail();
    if (para) MailApp.sendEmail({ to: para, subject: assunto, htmlBody: html, name: 'Agendamentos' });
  } catch (e) { console.warn('E-mail não enviado: ' + e); }
}
function avisar_(tipo, ag, extra) {
  const txt = (tipo === 'novo' ? 'Novo agendamento' : 'Cancelamento') + `: ${ag.cliente} — ${ag.servicoNome} em ${dataBR_(ag.data)} às ${ag.hora}${extra || ''}`;
  inserir_('Avisos', { id: novoId_(), tipo: tipo, criadoEm: new Date().toISOString(), lido: false, agendamentoId: ag.id, texto: txt });
  const cor = tipo === 'novo' ? '#2f7a4f' : '#b4542f';
  enviarEmail_((tipo === 'novo' ? '🟢 Novo agendamento: ' : '🔴 Cancelamento: ') + `${ag.cliente} · ${dataBR_(ag.data)} ${ag.hora}`,
    `<div style="font-family:Arial,sans-serif;max-width:480px"><h2 style="color:${cor};margin:0 0 12px">${tipo === 'novo' ? 'Novo agendamento' : 'Agendamento cancelado'}</h2>
     <p style="font-size:15px;line-height:1.6;margin:0"><b>${ag.cliente}</b><br>${ag.servicoNome} · R$ ${Number(ag.preco).toFixed(2).replace('.', ',')}<br>
     📅 ${dataBR_(ag.data)} às <b>${ag.hora}</b><br>📱 ${ag.telefone}<br>Código: ${ag.codigo}${extra ? '<br>' + extra.replace(/^ — | \(|\)$/g, '') : ''}</p></div>`);
}

// ---------- Utilitários ----------
function novoId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function novoCodigo_() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
const soDig_ = (s) => String(s || '').replace(/\D/g, '');
function publicoAg_(a) { return { id: a.id, codigo: a.codigo, cliente: a.cliente, servicoNome: a.servicoNome, data: a.data, hora: a.hora, duracao: a.duracao, preco: a.preco, status: a.status }; }
function erro_(status, msg) { return { _status: status, erro: msg }; }

function criarAgendamento_(b, origem) {
  const cfg = config_(), serv = servicos_().find((s) => s.id === String(b.servicoId) && s.ativo);
  if (!serv) return erro_(400, 'Serviço não encontrado.');
  const nome = String(b.cliente || '').trim().slice(0, 80), tel = soDig_(b.telefone);
  if (nome.length < 2) return erro_(400, 'Informe seu nome.');
  if (tel.length < 10) return erro_(400, 'Informe um WhatsApp válido com DDD.');
  if (origem === 'cliente' && datasDisponiveis_(cfg).indexOf(b.data) < 0) return erro_(400, 'Data fora do período de agendamento.');
  const ags = agendamentos_();
  if (horariosLivres_(cfg, ags, b.data, serv.duracao).indexOf(b.hora) < 0) return erro_(400, 'Esse horário acabou de ser ocupado. Escolha outro, por favor.');
  const ag = { id: novoId_(), codigo: novoCodigo_(), cliente: nome, telefone: tel, servicoId: serv.id, servicoNome: serv.nome, duracao: serv.duracao, preco: serv.preco,
    data: b.data, hora: b.hora, status: 'confirmado', obs: String(b.obs || '').slice(0, 300), origem: origem, criadoEm: new Date().toISOString() };
  inserir_('Agendamentos', ag);
  SpreadsheetApp.flush();
  avisar_('novo', ag, origem === 'salao' ? ' (lançado pelo salão)' : '');
  return { ag: ag };
}

// ---------- Sessões ----------
function autenticado_(token) {
  if (!token) return false;
  const exp = PropertiesService.getScriptProperties().getProperty('tok_' + token);
  return exp && Number(exp) > Date.now();
}
function limparTokens_() {
  const p = PropertiesService.getScriptProperties(), all = p.getProperties(), agora = Date.now();
  Object.keys(all).forEach((k) => { if (k.indexOf('tok_') === 0 && Number(all[k]) < agora) p.deleteProperty(k); });
}

// ---------- Logo (guardada em pedaços na aba Logo) ----------
function lerLogo_() { return ler_('Logo').sort((a, b) => num_(a.parte) - num_(b.parte)).map((r) => String(r.dados)).join(''); }
function salvarLogo_(dataUrl) {
  const sh = aba_('Logo');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  if (dataUrl) {
    const partes = [];
    for (let i = 0; i < dataUrl.length; i += 45000) partes.push([partes.length + 1, dataUrl.slice(i, i + 45000)]);
    sh.getRange(2, 1, partes.length, 2).setValues(partes);
  }
  setConfig_('logoVersao', dataUrl ? String(Date.now()) : '');
}

// ---------- Rotas (mesmas do servidor local) ----------
function rotear_(m, p, q, b, token) {
  if (p === '/api/publico' && m === 'GET') {
    const c = config_();
    return { nomeSalao: c.nomeSalao, slogan: c.slogan, whatsapp: c.whatsapp, endereco: c.endereco, cancelamentoMinHoras: c.cancelamentoMinHoras, horarios: c.horarios,
      logoVersao: c.logoVersao, logoTamanho: c.logoTamanho, logoFormato: c.logoFormato,
      diasFechados: c.diasFechados.filter((d) => d >= agora_().data).sort(),
      servicos: servicos_().filter((s) => s.ativo).map((s) => ({ id: s.id, nome: s.nome, categoria: s.categoria, duracao: s.duracao, preco: s.preco })),
      datas: datasDisponiveis_(c) };
  }
  if (p === '/api/logo' && m === 'GET') return { logo: lerLogo_(), versao: config_().logoVersao };
  if (p === '/api/horarios' && m === 'GET') {
    const c = config_(), serv = servicos_().find((s) => s.id === q.servico);
    return { data: q.data, horarios: horariosLivres_(c, agendamentos_(), q.data, serv ? serv.duracao : num_(q.duracao) || c.intervaloMin) };
  }
  if (p === '/api/vagas' && m === 'GET') {
    const c = config_(), ags = agendamentos_(), dias = Math.min(num_(q.dias) || 7, c.diasAntecedencia), dur = num_(q.duracao) || c.intervaloMin;
    return { nomeSalao: c.nomeSalao, whatsapp: c.whatsapp, dias: datasDisponiveis_(c).slice(0, dias).map((d) => ({ data: d, horarios: horariosLivres_(c, ags, d, dur) })) };
  }
  if (p === '/api/agendar' && m === 'POST') {
    const r = criarAgendamento_(b, 'cliente');
    return r.erro ? r : { agendamento: publicoAg_(r.ag) };
  }
  if (p === '/api/meus' && m === 'POST') {
    const tel = soDig_(b.telefone), cod = String(b.codigo || '').toUpperCase().trim(), cods = (b.codigos || []).map(String), hoje = agora_().data;
    if (!cod && !b.codigos) return erro_(400, 'Informe o código do agendamento.');
    return { agendamentos: agendamentos_().filter((a) => a.telefone === tel && a.data >= hoje && (cod ? a.codigo === cod : cods.indexOf(a.codigo) >= 0)).map(publicoAg_) };
  }
  if (p === '/api/cancelar' && m === 'POST') {
    const c = config_(), ag = agendamentos_().find((a) => a.codigo === String(b.codigo || '').toUpperCase().trim() && a.telefone === soDig_(b.telefone));
    if (!ag) return erro_(404, 'Agendamento não encontrado. Confira o código e o WhatsApp.');
    if (ag.status === 'cancelado') return erro_(400, 'Esse agendamento já foi cancelado.');
    const ag0 = agora_(), faltaMin = difDias_(ag0.data, ag.data) * 1440 + toMin_(ag.hora) - ag0.min;
    if (faltaMin / 60 < c.cancelamentoMinHoras) return erro_(400, `Cancelamentos pelo link só até ${c.cancelamentoMinHoras}h antes. Fale com o salão pelo WhatsApp.`);
    ag.status = 'cancelado'; ag.canceladoEm = new Date().toISOString(); ag.canceladoPor = 'cliente'; ag.motivo = String(b.motivo || '').slice(0, 200);
    salvarLinha_('Agendamentos', ag);
    avisar_('cancelado', ag, ag.motivo ? ' — motivo: ' + ag.motivo : '');
    return { ok: true };
  }
  if (p === '/api/login' && m === 'POST') {
    if (String(b.pin).trim() !== String(config_().pin).trim()) return erro_(401, 'PIN incorreto.');
    limparTokens_();
    const t = Utilities.getUuid().replace(/-/g, '') + novoId_();
    PropertiesService.getScriptProperties().setProperty('tok_' + t, String(Date.now() + 30 * 864e5));
    return { token: t };
  }

  // ----- Painel -----
  if (p.indexOf('/api/admin/') !== 0) return erro_(404, 'Rota não encontrada');
  if (!autenticado_(token)) return erro_(401, 'Faça login novamente.');

  if (p === '/api/admin/dados' && m === 'GET') {
    const c = config_();
    return { config: c, servicos: servicos_().map(semLinha_), agendamentos: agendamentos_().map(semLinha_), avisos: avisos_().slice(0, 200).map(semLinha_) };
  }
  if (p === '/api/admin/avisos' && m === 'GET') {
    const desde = String(q.desde || '');
    return { avisos: avisos_().filter((a) => a.criadoEm > desde).slice(0, 20).map(semLinha_) };
  }
  if (p === '/api/admin/config' && m === 'PUT') {
    ['nomeSalao', 'slogan', 'whatsapp', 'endereco', 'emailAvisos', 'intervaloMin', 'diasAntecedencia', 'antecedenciaMinHoras', 'cancelamentoMinHoras', 'pin', 'logoTamanho', 'logoFormato'].forEach((k) => {
      if (k in b) setConfig_(k, k === 'whatsapp' ? soDig_(b[k]) : b[k]);
    });
    if ('diasFechados' in b) setConfig_('diasFechados', (b.diasFechados || []).join(', '));
    if ('logo' in b) {
      const l = String(b.logo || '');
      salvarLogo_(/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/.test(l) ? l : '');
    }
    if (b.horarios) {
      const sh = aba_('Horarios');
      ler_('Horarios').forEach((h) => {
        const n = b.horarios[num_(h.dia)];
        if (n) sh.getRange(h._linha, 3, 1, 5).setValues([[!!n.aberto, n.inicio || '', n.fim || '', n.almocoInicio || '', n.almocoFim || '']]);
      });
    }
    return config_();
  }
  if (p === '/api/admin/servicos' && m === 'POST') {
    const s = { id: novoId_(), nome: String(b.nome || 'Novo serviço').slice(0, 60), categoria: String(b.categoria || 'Geral').slice(0, 40), duracao: Math.max(5, num_(b.duracao) || 30), preco: Math.max(0, num_(b.preco)), ativo: b.ativo !== false };
    inserir_('Servicos', s);
    aba_('Servicos').getRange(aba_('Servicos').getLastRow(), 6).insertCheckboxes().setValue(s.ativo);
    return s;
  }
  let mm = p.match(/^\/api\/admin\/servicos\/(\w+)$/);
  if (mm) {
    const s = servicos_().find((x) => x.id === mm[1]);
    if (!s) return erro_(404, 'Serviço não encontrado');
    if (m === 'PUT') {
      if ('nome' in b) s.nome = String(b.nome).slice(0, 60);
      if ('categoria' in b) s.categoria = String(b.categoria).slice(0, 40);
      if ('duracao' in b) s.duracao = Math.max(5, num_(b.duracao) || 30);
      if ('preco' in b) s.preco = Math.max(0, num_(b.preco));
      if ('ativo' in b) s.ativo = !!b.ativo;
      salvarLinha_('Servicos', s); return semLinha_(s);
    }
    if (m === 'DELETE') { aba_('Servicos').deleteRow(s._linha); return { ok: true }; }
  }
  if (p === '/api/admin/agendamentos' && m === 'POST') {
    const r = criarAgendamento_(b, 'salao');
    return r.erro ? r : r.ag;
  }
  mm = p.match(/^\/api\/admin\/agendamentos\/(\w+)$/);
  if (mm && m === 'PUT') {
    const ag = agendamentos_().find((a) => a.id === mm[1]);
    if (!ag) return erro_(404, 'Agendamento não encontrado');
    if (b.status && ['confirmado', 'concluido', 'faltou', 'cancelado'].indexOf(b.status) >= 0) {
      const antes = ag.status; ag.status = b.status;
      if (b.status === 'cancelado' && antes !== 'cancelado') { ag.canceladoEm = new Date().toISOString(); ag.canceladoPor = 'salao'; salvarLinha_('Agendamentos', ag); avisar_('cancelado', ag, ' (cancelado pelo salão)'); return semLinha_(ag); }
    }
    if ('preco' in b) ag.preco = Math.max(0, num_(b.preco));
    if ('obs' in b) ag.obs = String(b.obs).slice(0, 300);
    salvarLinha_('Agendamentos', ag); return semLinha_(ag);
  }
  if (p === '/api/admin/avisos/lidos' && m === 'POST') {
    const sh = aba_('Avisos'), n = sh.getLastRow() - 1;
    if (n > 0) sh.getRange(2, 4, n, 1).setValue(true);
    return { ok: true };
  }
  if (p === '/api/admin/horarios' && m === 'GET') return { horarios: horariosLivres_(config_(), agendamentos_(), q.data, num_(q.duracao) || 30) };
  return erro_(404, 'Rota não encontrada');
}

// ---------- Entrada HTTP ----------
function responder_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  let lock = null;
  try {
    const r = JSON.parse(e.postData.contents || '{}');
    const m = String(r.m || 'GET').toUpperCase(), p = String(r.p || '');
    if (m !== 'GET') { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    const out = rotear_(m, p, r.q || {}, r.b || {}, r.token || '');
    const status = out && out._status ? out._status : 200;
    if (out && out._status) delete out._status;
    return responder_({ status: status, dados: out });
  } catch (err) {
    console.error(err);
    return responder_({ status: 500, dados: { erro: 'Erro no servidor: ' + err.message } });
  } finally { if (lock) lock.releaseLock(); }
}

function doGet() {
  return responder_({ status: 200, dados: { ok: true, app: 'agendamento-salao', planilha: ss_().getName() } });
}
