# Ensaio do evento (P11)

Roteiro para simular um evento completo de 3 rodadas **em produção** (`https://matchmaking.commander2x2.org`), com 11 participantes, antes de 12/12. Dura cerca de 1h30. Anote tudo o que quebrar ou confundir (tela, horário, o que você esperava) e mande para o agente no fim.

## Antes de começar

- **Quem joga:** 11 participantes no início e 1 que entra atrasado (12 aparelhos no total). Cada participante precisa do **seu próprio aparelho ou navegador**: o app reconhece o jogador por um cookie, então duas abas do mesmo navegador são a mesma pessoa. Use celulares reais (pelo menos 4) e complete com navegadores diferentes (Chrome, Safari, Firefox), perfis diferentes do Chrome ou uma janela anônima por navegador.
- **Telas da organização:** um notebook com o admin (`/admin`) e, se der, uma segunda tela (TV ou outra janela) para o telão.
- **Impressora:** opcional; "Salvar como PDF" serve para testar a impressão.
- **Planilha de anotações:** rodada, mesa, o que aconteceu, o que era esperado.

Com 11 jogadores (11 mod 4 = 3) a rodada 1 tem **duas mesas 2v2, uma mesa 1v1 e um bye**. Com o atrasado, a rodada 2 tem 12 jogadores: **três mesas 2v2**. Com a desistência, a rodada 3 volta a 11: **duas 2v2, uma 1v1 e um bye**.

## 1. Criar o evento de teste

1. Abra `https://matchmaking.commander2x2.org/admin/login`, digite a senha e toque em **Entrar**.
2. Em **Novo evento**, nome **`[TESTE] Ensaio P11 — apagar`**, data de hoje, **Criar evento**.
3. Abra o evento na lista e anote o **código de 4 letras**.
4. Abra o **Telão** (`/e/CÓDIGO/display`) na segunda tela.

## 2. Inscrições (11 participantes)

1. Em **Jogadores**, mostre o QR code. Cada participante escaneia (ou abre `matchmaking.commander2x2.org`, digita o código e toca em **Entrar**).
2. Pelo menos **3 participantes escolhem o nome na lista da temporada** (**Buscar seu nome**, depois **Entrar como …**).
3. Pelo menos **3 digitam um nome novo** (**Entrar com este nome**).
4. Confira:
   - [ ] O admin mostra os 11 em **Jogadores** ("11 ativos · 11 de 40"); quem escolheu da lista aparece com "Temporada: …", os outros com "Fora da lista da temporada".
   - [ ] Um nome da lista já usado aparece como "já inscrito" para o próximo.
   - [ ] Recarregar a página num celular inscrito mostra o jogador, sem inscrever de novo.

## 3. Rodada 1: gerar, sortear de novo, trocar, publicar

1. Em **Rodadas**, toque em **Gerar rodada 1**. Confira o layout: Mesa 1 e Mesa 2 (2v2), Mesa 3 (1v1) e o bye.
   - [ ] Os celulares **ainda não** mostram as mesas (rascunho).
2. Toque em **Sortear de novo**. [ ] As mesas mudam.
3. Em **Trocar jogadores**, escolha o jogador do bye e um da mesa 1v1, **Trocar de lugar**. [ ] Os dois trocam de lugar.
4. **Publicar**, depois confirme. [ ] Celulares e telão mostram mesa, dupla, oponentes e ordem dos turnos (A1, B1, A2, B2). O evento fica "Em andamento".
5. **Imprimir** → **Imprimir** (ou salvar em PDF). [ ] Página 1 com as mesas, página 2 com os jogadores de A a Z.

## 4. Rodada 1: cronômetro e resultados

1. No **Cronômetro**, toque em **Iniciar**. [ ] Admin, celulares e telão mostram o mesmo tempo (diferença de até uns 5 s).
2. **Pausar**. [ ] Todos param. **+5 min** com a rodada pausada, depois **Retomar**. [ ] Todos mostram 5 min a mais e voltam a contar.
3. Resultados pelos celulares:
   - Mesa 1: um jogador toca em **Dupla A venceu** (ou B). [ ] O admin mostra o resultado e quem reportou.
   - Mesa 2: um jogador reporta **Empate**, depois outro da mesa muda para **Dupla B venceu**. [ ] Vale o último.
   - Mesa 3 (1v1): um dos dois marca **1** jogo para cada lado e toca em **Enviar: …**. [ ] Fica como empate 1–1.
4. **Correção do admin:** em **Resultados**, mude a Mesa 1 para o outro resultado. [ ] A mesa mostra "Alterado pelo admin" e o celular da mesa mostra "Definido pela organização", sem botões.
5. Toque em **Encerrar rodada**, confirme. [ ] **Classificação** aparece no admin, em **Ver classificação** nos celulares e no telão. O bye tem 3 pontos e OMW% "—".

## 5. Entrada atrasada (antes da rodada 2)

1. O 12º participante escaneia o QR e entra.
   - [ ] O celular dele mostra "Você entra na rodada 2."
   - [ ] Ele não aparece na classificação da rodada 1.

## 6. Rodada 2: "saiu no meio do jogo"

1. **Gerar rodada 2**. [ ] Três mesas 2v2, com o atrasado sentado; jogadores com mais pontos juntos. Leia os **Avisos do pareamento**, se houver.
2. **Publicar**, **Imprimir**, **Iniciar** o cronômetro.
3. Mesas 1 e 2: resultados pelos celulares.
4. Mesa 3: em **Resultados**, **Jogador saiu no meio do jogo**, escolha um jogador e **Confirmar**. [ ] A outra dupla vence. O jogador continua inscrito.
5. **Encerrar rodada**. [ ] Classificação atualizada.

## 7. Desistência (antes da rodada 3)

1. Um participante toca em **Sair do evento** no celular e confirma. [ ] O admin mostra "desistiu".
2. (Opcional) No admin, **Gerenciar** outro jogador → **Marcar desistência**, depois **Desfazer desistência**.
3. Confira que o admin mostra "11 ativos · 12 de 40".

## 8. Rodada 3: prorrogação

A prorrogação só começa quando o tempo da rodada acaba (50 min). Escolha um jeito:

- **Rápido (recomendado):** antes de **Gerar rodada 3**, no Neon (console → projeto → branch de produção → **SQL Editor**), rode só no evento de teste, trocando `CÓDIGO`:

  ```sql
  UPDATE events SET round_duration_sec = 120 WHERE code = 'CÓDIGO';
  ```

  A rodada 3 fica com 2 minutos. Isso só muda o tempo do evento de teste; não mexe em resultados.

- **Sem mexer no banco:** **Iniciar** o cronômetro da rodada 3 e esperar os 50 minutos.

Depois:

1. **Gerar rodada 3**. [ ] Duas 2v2, uma 1v1 e um bye; ninguém tem um segundo bye ou uma segunda 1v1.
2. **Publicar**, **Iniciar**. Espere o tempo acabar.
   - [ ] Celulares 2v2 mostram "Turno atual + 3 turnos extras", o da 1v1 "+ 5", e o telão mostra os dois.
   - [ ] **+5 min** na prorrogação dá 5 minutos a partir de agora.
3. Resultados pelos celulares; na 1v1, **2–1**.
4. **Encerrar rodada**.

## 9. Encerrar e exportar

1. **Encerrar evento**. [ ] O evento fica "Encerrado"; o telão mostra "Classificação final".
2. Em **Exportar**, **Gerar arquivo**. Confira:
   - [ ] Quem escolheu da lista aparece como atualizado; quem digitou o nome aparece em "Jogadores novos".
   - [ ] **Decklists para coletar** lista quem teve 2 vitórias ou mais (bye conta).
   - [ ] **Copiar** e **Baixar** funcionam.
3. **Não publique esse arquivo no site.** É só um teste.

## 10. Limpar o evento de teste

O app não apaga eventos. Escolha:

- **Deixar marcado:** o nome `[TESTE] Ensaio P11 — apagar` já o identifica na lista de eventos.
- **Apagar (recomendado):** no SQL Editor do Neon, na branch de produção, confira primeiro que só ele aparece:

  ```sql
  SELECT id, code, name FROM events WHERE code = 'CÓDIGO';
  ```

  Se for uma linha só, com o nome de teste:

  ```sql
  DELETE FROM events WHERE code = 'CÓDIGO';
  ```

  Isso apaga em cascata os jogadores, rodadas, mesas, resultados e o log do evento. Não dá para desfazer.

## O que mandar para o agente

- O que quebrou: passo do roteiro, tela, o que apareceu e o que você esperava (print ajuda).
- O que confundiu jogadores ou você, mesmo que tenha funcionado.
- Os itens marcados como não ok.
