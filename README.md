# ✂ Projeto — Agendamentos

App (PWA) de agendamento para salão: os clientes agendam e cancelam pelo link, você acompanha tudo num painel com PIN e os dados ficam numa **planilha do Google**. Tudo gratuito:

| Parte | Onde roda | Custo |
|---|---|---|
| Telas do cliente e do painel | **GitHub Pages** (este repositório) | grátis |
| "Servidor" / API | **Google Apps Script** ligado à planilha | grátis |
| Banco de dados | **Google Planilhas** — "Projeto - Agendamentos" | grátis |
| Aviso de agendamento/cancelamento | E-mail (Gmail) + alerta no painel | grátis |

**Links depois de publicado**

- Clientes: `https://kuuhaku-vs.github.io/ProjetoAgendamentos/`
- Direto nas vagas: `…/ProjetoAgendamentos/#vagas` · preços: `…/#precos`
- Painel do salão (PIN): `…/ProjetoAgendamentos/admin.html` — PIN inicial **1234**

---

## Instalação (uma vez só, ~10 minutos)

### 1. Ligar a planilha (Apps Script)

1. Abra a planilha **[Projeto - Agendamentos](https://docs.google.com/spreadsheets/d/18ChN7omFeBy48t2Pl86uJ1MdsYJ9dEbG0V0gY0oZDhw/edit)** (as abas já estão criadas).
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo de `Código.gs`, cole todo o arquivo [`Code.gs`](Code.gs) e clique em **Salvar** (💾).
4. No topo, escolha a função **`configurar`** e clique em **Executar**. Autorize o acesso (Avançado → Acessar projeto). Isso cria/ajusta as abas da planilha.
5. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

### 2. Conectar o site à planilha

1. Aqui no GitHub, abra [`config.js`](config.js) → ✏️ editar.
2. Troque `COLE_AQUI_A_URL_DO_APPS_SCRIPT` pela URL copiada (entre aspas).
3. **Commit changes**.

### 3. Publicar o site (GitHub Pages)

1. **Settings → Pages**.
2. Source: **Deploy from a branch** · Branch: **main** · pasta **/ (root)** → **Save**.
3. Em 1–2 minutos o link `https://kuuhaku-vs.github.io/ProjetoAgendamentos/` fica no ar.

Pronto! Abra o painel, troque o PIN em **Configurações** e coloque nome, WhatsApp, endereço e logo.

---

## A planilha

| Aba | O que guarda | Pode editar direto? |
|---|---|---|
| **Agendamentos** | cada agendamento (cliente, serviço, data, hora, status…) | sim, com cuidado |
| **Servicos** | tabela de serviços, duração e preço; caixa "ativo" | ✅ sim |
| **Horarios** | funcionamento de cada dia e pausa | ✅ sim (formato `09:00`) |
| **Config** | nome, WhatsApp, regras, PIN, e-mail dos avisos | ✅ sim |
| **Avisos** | histórico de novos agendamentos e cancelamentos | — |
| **Logo** (oculta) | imagem da logo em partes | não |

O menu **Agendamentos** aparece na planilha com "Configurar / reparar planilha" e "Enviar e-mail de teste".

## Avisos de agendamento e cancelamento

- **E-mail** a cada agendamento/cancelamento (para o e-mail em Config → `emailAvisos`, ou o dono da planilha).
- **Painel aberto**: confere a planilha a cada 20 s e mostra alerta com som + notificação.
- O cliente também pode enviar a confirmação para o WhatsApp do salão.

## Quando mudar o `Code.gs`

Depois de colar uma versão nova: **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**. A URL continua a mesma.

## Estrutura

```
index.html        tela do cliente (Agendar · Vagas · Horários · Preços)
admin.html        painel do salão (PIN)
cliente.js        lógica do cliente
admin.js          lógica do painel
divulgar.js       gerador da imagem de horários vagos
comum.js          funções comuns + conexão com o Apps Script
config.js         URL do Apps Script  ← editar
estilo.css        visual (com layout próprio para celular)
sw.js, manifest*  PWA (instalar como app)
Code.gs           código que roda no Google (API + planilha + e-mail)
```

## Limites do plano gratuito (com folga para um salão)

- Apps Script: ~20.000 chamadas/dia e 100 e-mails/dia (conta Gmail comum).
- Cada ação demora ~1–2 s (tempo do Google responder).
