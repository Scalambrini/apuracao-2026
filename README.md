# Apuração ao vivo do 2º turno 2026

Página estática (HTML, CSS e JavaScript puros) que acompanha a apuração do 2º turno para Presidente da República em 25/10/2026, lendo os arquivos públicos de divulgação do TSE.

## Como funciona

- O navegador de cada visitante lê diretamente o arquivo oficial do TSE:
  `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json`
  (eleição 6258 = 2º turno, Eleição Geral Federal; cargo 0001 = Presidente).
- Não há servidor nem banco de dados: o GitHub Pages só entrega os arquivos da página.
- Durante a apuração, a página confere o arquivo a cada 30 segundos (com revalidação por ETag). Após a totalização final, a cada 5 minutos.
- Antes de domingo às 16h45 (Brasília), a página mostra a contagem regressiva e não consulta o TSE.
- Fotos: usa a foto oficial publicada pelo TSE para cada candidato. Se ela não carregar, aparecem as iniciais na cor do candidato.

## Publicar no GitHub Pages

1. No GitHub, crie um repositório **público** (ex.: `apuracao-2026`).
2. Clique em **Add file → Upload files** e envie `index.html`, `styles.css`, `app.js`, `config.js` e este `README.md`. Confirme com **Commit changes**.
3. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, e clique em **Save**.
4. Em um ou dois minutos o endereço aparece no topo da mesma tela, no formato
   `https://SEU-USUARIO.github.io/apuracao-2026/`.

## Testar antes de domingo

| Endereço | O que mostra |
| --- | --- |
| `.../?demo=1` | Simulação com números fictícios (marca d'água "Simulação"), sem consultar o TSE |
| `.../?turno=1` | Resultado real do 1º turno (04/10), lido do TSE: confirma que a leitura e as fotos funcionam |
| `.../?fonte=simulado` | Ambiente de testes do TSE (simulado de 2º turno), com candidatos fictícios |

## Ajustes

Tudo fica em `config.js`: códigos das eleições, intervalo de atualização, nomes, cores (Flávio em azul, Lula em vermelho) e, se quiser, uma foto própria para cada candidato (campo `foto`).

## Limites

- O ritmo real de atualização depende de quando o TSE regera o arquivo.
- O TSE limita 100 requisições por segundo por IP e pode bloquear endereços que geram muitos erros 404; a página consulta um único arquivo e espera 60 s quando ele ainda não existe.
- Página independente, sem vínculo com a Justiça Eleitoral.
