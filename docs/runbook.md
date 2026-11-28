# Runbook do evento (12/12/2026)

Uma página para o dia: Medieval Cards, 14:00, 3 rodadas de 50 minutos. O app é o principal; o papel impresso é o reserva. A final do Hall da Fama continua no papel.

- Admin: `https://matchmaking.commander2x2.org/admin`
- Jogadores: `https://matchmaking.commander2x2.org` + código do evento (ou o QR do admin)
- Telão: `https://matchmaking.commander2x2.org/e/CÓDIGO/display`

## Antes do evento

### Na véspera

- [ ] `https://matchmaking.commander2x2.org/api/health` mostra `"db":"up"`.
- [ ] Entrar no admin e, em **Novo evento**, criar o evento com a data de 12/12 (**Criar evento**). Anotar o código.
- [ ] O evento de teste do ensaio foi apagado ou está marcado `[TESTE]`.
- [ ] Imprimir o QR de entrada (seção **Jogadores**) ou deixar o código escrito num papel grande.
- [ ] MTG Companion instalado e com login no celular, como reserva.

### No local, antes das 14:00

- [ ] Celular e notebook carregados; carregador e power bank na mochila.
- [ ] Internet: Wi-Fi da loja testado e hotspot do celular pronto como reserva.
- [ ] Entrar de novo no admin no notebook (o login dura 12 horas).
- [ ] Impressora ligada, com papel, e uma página de teste impressa pelo navegador.
- [ ] Telão aberto na TV ou segunda tela.
- [ ] Inscrições: os jogadores escaneiam o QR e escolhem o nome na lista da temporada (**Entrar como …**) ou digitam o nome (**Entrar com este nome**). Confira os nomes em **Jogadores** e corrija em **Gerenciar** (nome e vínculo com a lista).
- [ ] Quem não tem celular: **Adicionar jogador**; você reporta o resultado da mesa dele.

## Cada rodada

1. **Gerar rodada N**.
2. Revisar as mesas e os **Avisos do pareamento**. Se não gostar: **Sortear de novo** ou **Trocar jogadores** → **Trocar de lugar**. Com 6–7 jogadores a rodada 3 pode juntar um 2-0 com um 0-2 na mesma dupla; resolva com uma troca.
3. **Publicar** e confirmar. Os jogadores passam a ver a mesa no celular.
4. **Imprimir** → **Imprimir**. Deixe a folha na mesa da organização (é o reserva).
5. Com todos sentados: **Iniciar** no **Cronômetro**. **Pausar** / **Retomar** para interrupções; **+5 min** para dar tempo extra. Aos 50 minutos a rodada entra na prorrogação sozinha: 2v2 joga o turno atual + 3 turnos extras, 1v1 + 5.
6. Acompanhar **Resultados**. Qualquer jogador da mesa reporta; até a rodada fechar dá para mudar. Corrija qualquer mesa com **A venceu** / **B venceu** / **Empate** (1v1: jogos e **Salvar**). Jogador abandonou: **Jogador saiu no meio do jogo** → nome → **Confirmar** (a outra dupla vence; para tirar o jogador do evento, **Gerenciar** → **Marcar desistência**).
7. Com todas as mesas com resultado ("Todas as mesas com resultado"): **Encerrar rodada**. A classificação aparece no admin, nos celulares e no telão.

### Entre rodadas

- Atrasado: escaneia o QR normalmente e entra na próxima rodada. Se ela já estiver em rascunho, **Sortear de novo** antes de publicar (o app avisa e não deixa publicar).
- Desistência: o jogador toca em **Sair do evento** no celular, ou você usa **Gerenciar** → **Marcar desistência**. Faça isso **antes** de **Gerar rodada N**. Se a rodada já for rascunho, **Sortear de novo** antes de publicar.
- Trocou de celular ou perdeu o acesso: **Gerenciar** → **Gerar link para outro aparelho** → o jogador escaneia o QR e toca em **Entrar neste aparelho**. O aparelho antigo perde o acesso.

## Se algo der errado

- **Um celular travou ou ficou sem bateria:** o jogador fala o resultado para você e você define em **Resultados**.
- **Internet caiu ou o app não abre no meio da rodada:** a rodada continua pela folha impressa. Anote os resultados no papel. Quando voltar, defina cada mesa em **Resultados** (o admin pode alterar a qualquer momento, mesmo depois de fechar a rodada) e **Encerrar rodada**.
- **O app não volta antes da próxima rodada:** continue o evento no MTG Companion ou no papel a partir da classificação atual (última vista no telão ou na folha). Depois do evento, atualize o ranking do site à mão: o export do app só conta o que está nele.
- **Resultado errado numa rodada já fechada:** corrija em "Resultados da rodada N"; a classificação se atualiza. Antes de **Gerar rodada N+1**, para o pareamento usar o resultado certo.
- **"A página está desatualizada":** recarregue a página e repita.

## Depois do evento

1. Conferir os resultados da rodada 3 e **Encerrar evento**. O telão mostra "Classificação final".
2. Final do Hall da Fama no papel.
3. Em **Exportar**, **Gerar arquivo**. Revisar "Jogadores novos" (nomes digitados que não estão na lista; corrija o vínculo em **Gerenciar** e gere de novo se alguém escolheu o nome errado).
4. **Baixar** o `leaderboard.json`, trocar o `src/data/leaderboard.json` no repositório do site e abrir o PR.
5. Pedir as decklists de quem está em **Decklists para coletar** (2 vitórias ou mais, bye conta).
