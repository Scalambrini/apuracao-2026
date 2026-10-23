// Configuração do painel de apuração.
// Os códigos abaixo constam da página técnica do TSE
// (tse.jus.br > Informações técnicas sobre a divulgação de resultados 2026).
window.APURACAO = {
  // Ambiente oficial do TSE
  oficial: {
    base: "https://resultados.tse.jus.br/oficial",
    ciclo: "ele2026",
    eleicao: "6258",   // 25/10/2026, pleito 3221, 2º turno, Eleição Geral Federal
    eleicao1T: "6257"  // 04/10/2026, 1º turno (usado no teste ?turno=1 e como reserva das fotos)
  },

  // Ambiente de testes do TSE (simulado de 2º turno), usado em ?fonte=simulado
  simulado: {
    base: "https://resultados-sim.tse.jus.br/simulado/simulado2026",
    ciclo: "ele2026",
    eleicao: "22410"
  },

  cargo: "1", // Presidente da República

  // Horário em que a votação termina e a totalização começa (horário de Brasília)
  inicioApuracao: "2026-10-25T17:00:00-03:00",

  // Intervalos de atualização, em segundos
  intervaloSeg: 30,       // durante a apuração
  intervaloFinalSeg: 300, // depois da totalização final

  // Candidatos, identificados pelo número de urna.
  // "foto" é opcional: deixe vazio para usar a foto oficial publicada pelo TSE,
  // ou indique um arquivo seu (ex.: "fotos/flavio.jpg").
  candidatos: [
    {
      numero: "22",
      nome: "Flávio Bolsonaro",
      partido: "PL",
      cor: "#1F4FD8",       // azul
      corEscura: "#6E91FF", // azul para o modo escuro
      sqcand: "280002551544",
      foto: ""
    },
    {
      numero: "13",
      nome: "Lula",
      partido: "PT",
      cor: "#D42A3C",       // vermelho
      corEscura: "#FF6474", // vermelho para o modo escuro
      sqcand: "280002542548",
      foto: ""
    }
  ]
};
