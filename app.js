/* Painel de apuração do 2º turno 2026
   Lê o arquivo oficial de resultado (EA20, "-u.json") publicado pelo TSE
   e atualiza a página a cada 30 segundos.

   Endereços úteis para teste:
     ?demo=1          simulação com números fictícios (não consulta o TSE)
     ?turno=1         resultado real do 1º turno (04/10), lido do TSE
     ?fonte=simulado  ambiente de testes do TSE, com candidatos fictícios
*/
(function () {
  "use strict";

  const C = window.APURACAO;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

  const MODO = q.has("demo") ? "demo"
    : q.get("fonte") === "simulado" ? "simulado"
    : q.get("turno") === "1" ? "turno1"
    : "oficial";

  const FONTE = MODO === "simulado" ? C.simulado : C.oficial;
  const eleicaoForcada = /^\d{3,6}$/.test(q.get("eleicao") || "") ? q.get("eleicao") : null;
  const ELEICAO = eleicaoForcada || (MODO === "turno1" ? C.oficial.eleicao1T : FONTE.eleicao);

  const pad = (v, k) => String(v).padStart(k, "0");
  const URL_DADOS = `${FONTE.base}/${FONTE.ciclo}/${ELEICAO}/dados/br/br-c${pad(C.cargo, 4)}-e${pad(ELEICAO, 6)}-u.json`;
  const INICIO = Date.parse(C.inicioApuracao);
  const ANTECEDENCIA_MS = 15 * 60 * 1000; // começa a consultar 15 min antes das 17h

  /* ---------- formatação ---------- */
  const fmtInt = (n) => Math.round(n).toLocaleString("pt-BR");
  const fmtPct = (n) => (isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function num(s) {
    if (s == null || s === "") return 0;
    if (typeof s === "number") return isFinite(s) ? s : 0;
    let t = String(s).trim();
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(t);
    return isFinite(v) ? v : 0;
  }

  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function tituloNome(s) {
    return String(s || "").toLowerCase()
      .replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
      .replace(/\s(Do|De|Da|Dos|Das|E)(?=\s|$)/g, (m) => m.toLowerCase());
  }

  function iniciais(nome) {
    const p = String(nome).trim().split(/\s+/).filter(Boolean);
    return ((p[0] || "")[0] || "").toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || "").toUpperCase() : "");
  }

  function carimbo(dt, ht) {
    const d = /(\d\d)\/(\d\d)\/(\d{4})/.exec(dt || "");
    const h = /(\d\d):(\d\d):?(\d\d)?/.exec(ht || "");
    if (!d || !h) return 0;
    return +(d[3] + d[2] + d[1] + h[1] + h[2] + (h[3] || "00"));
  }

  /* ---------- leitura do arquivo do TSE ---------- */
  function interpretar(d) {
    if (!d || typeof d !== "object") return null;
    const cands = [];
    const incluir = (x, sigla) => {
      const n = parseInt(x.n, 10);
      if (!n) return;
      const st = semAcento(x.st);
      cands.push({
        n: String(n),
        nome: x.nmu || x.nm || "",
        partido: sigla || String(x.cc || "").split(/\s+-\s+|\s*\/\s*/)[0].trim(),
        sq: /^\d+$/.test(String(x.sqcand || "")) ? String(x.sqcand) : "",
        vap: num(x.vap),
        pvap: x.pvap != null && x.pvap !== "" ? num(x.pvap) : null,
        // Só a situação por extenso ("Eleito") indica vitória. O campo "e" do arquivo
        // vem marcado também para quem passou ao 2º turno, por isso não é usado.
        eleito: /\beleit[oa]\b/.test(st) && !/nao eleit/.test(st)
      });
    };

    if (Array.isArray(d.carg)) {
      const carg = d.carg.find((c) => +c.cd === +C.cargo) || d.carg[0];
      ((carg && carg.agr) || []).forEach((a) =>
        (a.par || []).forEach((p) => (p.cand || []).forEach((x) => incluir(x, p.sg))));
    } else if (Array.isArray(d.cand)) {
      d.cand.forEach((x) => incluir(x));
    }

    const s = d.s || d, e = d.e || d, v = d.v || d;
    const ts = num(s.ts), st = num(s.st);
    const pst = s.pst != null && s.pst !== "" ? num(s.pst) : (ts ? (st / ts) * 100 : 0);

    return {
      cands, ts, st, pst: Math.min(100, Math.max(0, pst)),
      te: num(e.te), est: num(e.est), c: num(e.c), a: num(e.a),
      tv: num(v.tv), vv: num(v.vv), vb: num(v.vb), vn: num(v.tvn != null ? v.tvn : v.vn),
      dt: d.dt || "", ht: d.ht || "",
      final: d.and === "f",
      carimbo: carimbo(d.dt, d.ht)
    };
  }

  /* ---------- candidatos exibidos ---------- */
  const ordemConfig = new Map(C.candidatos.map((k, i) => [String(k.numero), i]));

  function listaExibida(dados) {
    const doArquivo = dados ? dados.cands : [];
    const porNumero = new Map(doArquivo.map((c) => [c.n, c]));
    const todosNoArquivo = C.candidatos.every((k) => porNumero.has(String(k.numero)));

    let pares;
    if (!doArquivo.length || todosNoArquivo) {
      pares = C.candidatos.map((k) => ({ cfg: k, arq: porNumero.get(String(k.numero)) }));
    } else {
      // Ambiente simulado: candidatos fictícios recebem as cores na ordem do arquivo
      pares = doArquivo.slice(0, C.candidatos.length).map((c, i) => ({
        cfg: Object.assign({}, C.candidatos[i], {
          numero: c.n, nome: tituloNome(c.nome), partido: c.partido, sqcand: c.sq, foto: ""
        }),
        arq: c
      }));
    }

    return pares.map(({ cfg, arq }) => ({
      numero: String(cfg.numero),
      nome: cfg.nome,
      partido: (arq && arq.partido) || cfg.partido || "",
      cor: cfg.cor,
      corEscura: cfg.corEscura || cfg.cor,
      sq: (arq && arq.sq) || cfg.sqcand || "",
      fotoPropria: cfg.foto || "",
      vap: arq ? arq.vap : 0,
      pct: arq ? (arq.pvap != null ? arq.pvap : (dados.vv ? (arq.vap / dados.vv) * 100 : 0)) : 0,
      eleito: !!(arq && arq.eleito)
    }));
  }

  /* ---------- fotos ---------- */
  function fontesFoto(c) {
    const lista = [];
    if (c.fotoPropria) lista.push(c.fotoPropria);
    if (c.sq) {
      lista.push(`${FONTE.base}/${FONTE.ciclo}/${ELEICAO}/fotos/br/${c.sq}.jpeg`);
      if (FONTE === C.oficial && ELEICAO !== C.oficial.eleicao1T) {
        lista.push(`${C.oficial.base}/${C.oficial.ciclo}/${C.oficial.eleicao1T}/fotos/br/${c.sq}.jpeg`);
      }
    }
    return lista;
  }

  function carregarFoto(fig, img, fontes) {
    let i = 0;
    img.onload = () => { img.classList.add("ok"); fig.classList.add("tem-foto"); };
    img.onerror = () => { i += 1; if (i < fontes.length) img.src = fontes[i]; else img.remove(); };
    if (fontes.length) img.src = fontes[0]; else img.remove();
  }

  /* ---------- montagem dos cartões ---------- */
  const itens = new Map();
  let chaveItens = "";

  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function criarItem(c) {
    const li = el("li", "cand");
    li.dataset.numero = c.numero;
    li.style.setProperty("--cor", c.cor);
    li.style.setProperty("--cor-escura", c.corEscura);

    const fig = el("figure", "foto");
    const img = document.createElement("img");
    img.alt = "Foto de " + c.nome;
    img.decoding = "async";
    img.width = 161; img.height = 225;
    fig.append(img, el("span", "iniciais", iniciais(c.nome)));
    carregarFoto(fig, img, fontesFoto(c));

    const cab = el("div", "cab");
    const nome = el("h3", "nome", c.nome);
    const numero = el("span", "numero");
    numero.setAttribute("aria-label", "Número " + c.numero);
    [...c.numero].forEach((d) => numero.append(el("i", null, d)));
    const partido = el("span", "partido", c.partido);
    const selo = el("span", "selo", "Eleito");
    selo.hidden = true;
    cab.append(nome, numero, partido, selo);

    const pct = el("div", "pct");
    const pctNum = el("strong", null, "0,00");
    pct.append(pctNum, el("span", null, "%"));

    const trilha = el("div", "trilha");
    trilha.setAttribute("role", "progressbar");
    trilha.setAttribute("aria-label", "Percentual de " + c.nome);
    trilha.setAttribute("aria-valuemin", "0");
    trilha.setAttribute("aria-valuemax", "100");
    const preench = el("span", "preench");
    trilha.append(preench, el("span", "meio"));

    const votos = el("div", "votos");
    const votosNum = el("b", null, "0");
    votos.append(votosNum, document.createTextNode(" votos"));

    li.append(fig, cab, pct, trilha, votos);
    return { el: li, pctNum, preench, trilha, votosNum, selo, partido };
  }

  function garantirItens(lista) {
    const chave = lista.map((c) => c.numero + ":" + c.nome).join("|");
    if (chave === chaveItens) return;
    chaveItens = chave;
    const ol = $("lista");
    ol.textContent = "";
    itens.clear();
    lista.forEach((c) => {
      const item = criarItem(c);
      itens.set(c.numero, item);
      ol.append(item.el);
    });
  }

  /* ---------- animação de números ---------- */
  function animar(elm, valor, fmt) {
    const de = elm._valor;
    elm._valor = valor;
    if (de == null || de === valor || reduzMovimento.matches || document.hidden) {
      elm.textContent = fmt(valor);
      return;
    }
    const t0 = performance.now(), dur = 900;
    cancelAnimationFrame(elm._raf);
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      elm.textContent = fmt(de + (valor - de) * e);
      if (k < 1) elm._raf = requestAnimationFrame(passo);
    };
    elm._raf = requestAnimationFrame(passo);
  }

  function reordenar(lista) {
    const ol = $("lista");
    if (!lista.some((c) => c.vap > 0)) return;
    const nova = [...lista]
      .sort((a, b) => b.vap - a.vap || (ordemConfig.get(a.numero) ?? 9) - (ordemConfig.get(b.numero) ?? 9))
      .map((c) => c.numero);
    const atual = [...ol.children].map((li) => li.dataset.numero);
    if (nova.join() === atual.join()) return;
    const antes = new Map([...ol.children].map((li) => [li, li.getBoundingClientRect().top]));
    nova.forEach((n) => ol.append(itens.get(n).el));
    if (reduzMovimento.matches || !Element.prototype.animate) return;
    [...ol.children].forEach((li) => {
      const dy = antes.get(li) - li.getBoundingClientRect().top;
      if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }],
        { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  }

  /* ---------- desenho da página ---------- */
  let ultimoAnuncio = -1;

  // Declara vencedor só quando não há dúvida:
  //  - o TSE marcou "Eleito" em exatamente um candidato, e ele é o mais votado; ou
  //  - a totalização final do TSE terminou (100% e and = "f") e um dos dois tem mais votos.
  // Nunca no modo de simulação nem no teste do 1º turno.
  function definirVencedor(lista, dados) {
    if (!dados || MODO === "demo" || MODO === "turno1" || lista.length !== 2) return null;
    const ord = [...lista].sort((a, b) => b.vap - a.vap);
    if (!ord[0].vap || ord[0].vap === ord[1].vap) return null;
    const marcados = lista.filter((c) => c.eleito);
    if (marcados.length === 1 && marcados[0].numero === ord[0].numero) return ord[0];
    if (dados.final && dados.pst >= 99.995) return ord[0];
    return null;
  }

  function render(dados) {
    const lista = listaExibida(dados);
    garantirItens(lista);
    const vencedor = definirVencedor(lista, dados);

    lista.forEach((c) => {
      const it = itens.get(c.numero);
      animar(it.pctNum, c.pct, fmtPct);
      animar(it.votosNum, c.vap, fmtInt);
      it.preench.style.width = Math.min(100, c.pct) + "%";
      it.trilha.setAttribute("aria-valuenow", c.pct.toFixed(2));
      it.trilha.setAttribute("aria-valuetext", fmtPct(c.pct) + "% dos votos válidos");
      if (c.partido) it.partido.textContent = c.partido;
      it.selo.hidden = !(vencedor && vencedor.numero === c.numero);
    });
    reordenar(lista);

    const pst = dados ? dados.pst : 0;
    animar($("pApurado"), pst, (v) => fmtPct(v) + "%");
    animar($("pFalta"), 100 - pst, (v) => fmtPct(v) + "%");
    $("preenchProg").style.width = pst + "%";
    $("barraProg").setAttribute("aria-valuenow", pst.toFixed(2));

    if (dados && dados.ts) {
      $("secoes").textContent = `${fmtInt(dados.st)} de ${fmtInt(dados.ts)} seções eleitorais totalizadas`;
    }

    desenharDiferenca(lista, dados);
    desenharResumo(dados);
    desenharFinal(vencedor, dados);
    desenharNota(lista, dados);
    anunciar(lista, dados);
  }

  function desenharDiferenca(lista, dados) {
    const p = $("diferenca");
    const ord = [...lista].sort((a, b) => b.vap - a.vap);
    if (!dados || ord.length < 2 || !ord[0].vap) { p.hidden = true; return; }
    p.hidden = false;
    p.textContent = "";
    const dif = ord[0].vap - ord[1].vap;
    if (dif === 0) { p.textContent = "Os dois candidatos estão empatados em votos."; return; }
    const nome = el("b", null, ord[0].nome);
    nome.style.color = matchMedia("(prefers-color-scheme: dark)").matches ? ord[0].corEscura : ord[0].cor;
    const pontos = ord[0].pct - ord[1].pct;
    const unidade = pontos >= 0.995 && pontos < 1.005 ? "ponto percentual" : "pontos percentuais";
    const terminou = dados.final && MODO !== "demo";
    const verbo = terminou ? "terminou com" : "está à frente por";
    const sufixo = terminou ? " a mais" : "";
    p.append(nome, document.createTextNode(` ${verbo} ${fmtInt(dif)} votos${sufixo} (${fmtPct(pontos)} ${unidade}).`));
  }

  function desenharResumo(d) {
    const linha = (id, valor, rotulo) => {
      const dd = $(id);
      dd.textContent = "";
      dd.append(document.createTextNode(valor));
      if (rotulo) dd.append(el("small", null, rotulo));
    };
    if (!d || !d.tv) {
      ["rValidos", "rBrancos", "rNulos", "rAbstencao"].forEach((id) => linha(id, "–"));
      return;
    }
    linha("rValidos", fmtInt(d.vv), fmtPct((d.vv / d.tv) * 100) + "% do total");
    linha("rBrancos", fmtInt(d.vb), fmtPct((d.vb / d.tv) * 100) + "% do total");
    linha("rNulos", fmtInt(d.vn), fmtPct((d.vn / d.tv) * 100) + "% do total");
    const base = d.est || (d.c + d.a);
    linha("rAbstencao", fmtInt(d.a), base ? fmtPct((d.a / base) * 100) + "% do eleitorado" : "");
  }

  function desenharFinal(eleito, dados) {
    const box = $("resultadoFinal");
    box.classList.remove("neutro");
    box.style.removeProperty("--cor");

    if (MODO === "demo") {
      if (dados && dados.pst >= 100) {
        box.hidden = false;
        box.classList.add("neutro");
        $("finalTitulo").textContent = "Fim da simulação";
        $("finalTexto").textContent = "Os números desta tela são fictícios. Para acompanhar a apuração real, abra a página sem “?demo” no endereço.";
      } else box.hidden = true;
      return;
    }
    if (!eleito || !dados) { box.hidden = true; return; }
    box.hidden = false;
    box.style.setProperty("--cor", eleito.cor);
    $("finalTitulo").textContent = `${eleito.nome} foi eleito presidente da República`;
    $("finalTexto").textContent = dados.final
      ? `Totalização final do TSE, com ${fmtPct(dados.pst)}% das seções apuradas.`
      : `O TSE indicou o resultado com ${fmtPct(dados.pst)}% das seções apuradas. A contagem continua até 100%.`;
  }

  function desenharNota(lista, dados) {
    let txt = "Percentual sobre os votos válidos, como o TSE divulga. A linha no meio de cada barra marca 50%.";
    if (dados && dados.vv) {
      const outros = dados.vv - lista.reduce((t, c) => t + c.vap, 0);
      if (outros / dados.vv > 0.0005) txt += ` Os demais candidatos somam ${fmtPct((outros / dados.vv) * 100)}%.`;
    }
    $("nota").textContent = txt;
  }

  function anunciar(lista, dados) {
    if (!dados || !dados.st) return;
    const faixa = dados.final ? 999 : Math.floor(dados.pst / 10);
    if (faixa === ultimoAnuncio) return;
    ultimoAnuncio = faixa;
    $("anuncio").textContent = `Com ${fmtPct(dados.pst)}% das seções apuradas: ` +
      lista.map((c) => `${c.nome}, ${fmtPct(c.pct)}%`).join("; ") + ".";
  }

  /* ---------- estado e rodapé ---------- */
  function status(tipo, texto) {
    $("status").dataset.estado = tipo;
    $("statusTxt").textContent = texto;
  }

  let ultimo = null, proxima = 0, ultimaVerificacao = 0, timer = 0, falhas = 0;

  function textoRestante(ms) {
    const min = Math.max(0, Math.ceil(ms / 60000));
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    const partes = [];
    if (d) partes.push(d + (d === 1 ? " dia" : " dias"));
    if (h) partes.push(h + " h");
    if (m || !partes.length) partes.push(m + " min");
    return partes.join(", ").replace(/, ([^,]*)$/, " e $1");
  }

  function atualizarRodape() {
    const p = $("atualizacao");
    const seg = proxima ? Math.max(0, Math.round((proxima - Date.now()) / 1000)) : null;
    if (MODO === "demo") { p.textContent = "Simulação: números fictícios gerados no próprio navegador."; return; }
    if ($("status").dataset.estado === "espera" && Date.now() < INICIO) {
      $("secoes").textContent = `A apuração começa depois do fim da votação, às 17h de 25 de outubro (horário de Brasília). Faltam ${textoRestante(INICIO - Date.now())}.`;
    }
    let txt = ultimo && ultimo.dt
      ? `Última totalização do TSE: ${ultimo.dt} às ${ultimo.ht} (horário de Brasília).`
      : "O TSE ainda não publicou números para esta eleição.";
    if (seg != null) txt += ` Nova verificação em ${seg} s.`;
    p.textContent = txt;
  }

  function agendar(segundos) {
    clearTimeout(timer);
    const ms = segundos * 1000 + Math.random() * 3000; // pequena variação para não sincronizar todos os acessos
    proxima = Date.now() + ms;
    timer = setTimeout(ciclo, ms);
  }

  async function ciclo() {
    clearTimeout(timer);

    const comeca = INICIO - ANTECEDENCIA_MS;
    if (MODO === "oficial" && !eleicaoForcada && Date.now() < comeca) {
      status("espera", "Começa às 17h de domingo");
      render(null);
      proxima = 0;
      atualizarRodape();
      timer = setTimeout(ciclo, Math.min(60000, comeca - Date.now() + 500));
      return;
    }

    if (!ultimo) status("conectando", "Conectando ao TSE");
    try {
      const r = await fetch(URL_DADOS, { cache: "no-cache" });
      ultimaVerificacao = Date.now();
      if (r.status === 404 || r.status === 403) {
        falhas = 0;
        if (!ultimo) {
          status("aguardando", "Aguardando o TSE");
          $("secoes").textContent = "O TSE ainda não publicou os primeiros números. A página confere de novo sozinha.";
          render(null);
        }
        agendar(60);
        return;
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const dados = interpretar(await r.json());
      if (!dados) throw new Error("Arquivo sem dados");
      // A rede de distribuição pode entregar uma cópia mais antiga: só avança, nunca recua
      if (!ultimo || dados.carimbo >= ultimo.carimbo) ultimo = dados;
      falhas = 0;
      render(ultimo);
      if (ultimo.final) status("final", "Apuração encerrada");
      else status("vivo", "Ao vivo");
      agendar(ultimo.final ? C.intervaloFinalSeg : C.intervaloSeg);
    } catch (err) {
      falhas += 1;
      ultimaVerificacao = Date.now();
      status("erro", ultimo ? "Sem resposta do TSE agora" : "Sem conexão com o TSE");
      if (!ultimo) {
        $("secoes").textContent = "Não foi possível ler os números do TSE. A página tenta de novo sozinha; confira também sua conexão.";
        render(null);
      }
      agendar(Math.min(C.intervaloSeg * Math.min(falhas, 4), 120));
    }
    atualizarRodape();
  }

  /* ---------- simulação (?demo=1) ---------- */
  function iniciarDemo() {
    const ts = 472104, te = 155912680;
    const [a, b] = C.candidatos;
    const alvo = 0.47 + Math.random() * 0.06;
    const fase = Math.random() * Math.PI * 2;
    let p = 0;
    status("vivo", "Simulação");

    const passo = () => {
      p = Math.min(100, p + 1.5 + Math.random() * 4.5);
      const f = p / 100;
      const st = Math.round(ts * f), est = Math.round(te * f);
      const c = Math.round(est * 0.792), abst = est - c;
      const vb = Math.round(c * 0.018), vn = Math.round(c * 0.031), vv = c - vb - vn;
      const parteA = alvo + (1 - f) * 0.045 * Math.sin(f * 9 + fase);
      const va = Math.round(vv * parteA), vbB = vv - va;
      const agora = new Date();
      const dados = {
        cands: [
          { n: String(a.numero), nome: a.nome, partido: a.partido, sq: a.sqcand, vap: va, pvap: (va / vv) * 100, eleito: false },
          { n: String(b.numero), nome: b.nome, partido: b.partido, sq: b.sqcand, vap: vbB, pvap: (vbB / vv) * 100, eleito: false }
        ],
        ts, st, pst: p, te, est, c, a: abst, tv: c, vv, vb, vn,
        dt: agora.toLocaleDateString("pt-BR"), ht: agora.toLocaleTimeString("pt-BR"),
        final: p >= 100, carimbo: 0
      };
      ultimo = dados;
      render(dados);
      atualizarRodape();
      if (p < 100) setTimeout(passo, 2500);
      else status("final", "Fim da simulação");
    };
    render(null);
    setTimeout(passo, 1200);
  }

  /* ---------- compartilhar ---------- */
  $("compartilhar").addEventListener("click", async () => {
    const botao = $("compartilhar");
    const url = location.origin + location.pathname;
    const dados = { title: document.title, text: "Acompanhe a apuração do 2º turno com os números do TSE:", url };
    if (navigator.share) {
      try { await navigator.share(dados); } catch (e) { /* cancelado */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      botao.textContent = "Link copiado";
      setTimeout(() => { botao.textContent = "Compartilhar"; }, 2500);
    } catch (e) {
      window.prompt("Copie o link:", url);
    }
  });

  /* ---------- início ---------- */
  document.documentElement.dataset.modo = MODO;
  $("pagina").dataset.modo = MODO;

  const aviso = $("avisoModo");
  const avisos = {
    demo: "Simulação com números fictícios, só para ver como a página funciona. A apuração real aparece no endereço sem “?demo”.",
    turno1: "Modo de teste: resultado do 1º turno (4 de outubro), lido dos arquivos do TSE.",
    simulado: "Modo de teste: ambiente simulado do TSE, com candidatos e votos fictícios."
  };
  if (avisos[MODO]) { aviso.textContent = avisos[MODO]; aviso.hidden = false; }
  if (MODO === "demo") $("fonte").textContent = "Nesta simulação nenhum dado é lido do TSE. Página independente, sem vínculo com a Justiça Eleitoral.";
  if (MODO === "turno1") {
    $("titulo").textContent = "Apuração do 1º turno";
    $("subtitulo").textContent = "Presidente da República, 4 de outubro de 2026";
    document.title = "Apuração do 1º turno 2026 (teste)";
  }

  setInterval(atualizarRodape, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && MODO !== "demo" && Date.now() - ultimaVerificacao > 20000) ciclo();
  });

  if (MODO === "demo") iniciarDemo();
  else ciclo();
})();
