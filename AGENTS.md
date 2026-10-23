# AGENTS.md — Linha Viva

## Propósito

Este repositório será usado para construir **Linha Viva**, uma atividade digital cooperativa para o ensino básico. Cada estudante recebe um item e sugere sua posição em um eixo compartilhado. A turma acompanha a construção em uma tela projetada; o professor conduz a discussão e encerra a atividade.

O produto deve favorecer explicação, negociação e revisão coletiva. Não incluir ranking, pontuação individual, cronômetro competitivo, eliminação ou comparação pública entre estudantes.

Este arquivo orienta agentes de IA e colaboradores. A descrição do usuário e as decisões explícitas posteriores têm prioridade. Atualize este documento quando uma decisão de produto ou arquitetura for validada; não trate hipóteses como fatos implementados.

## Público e contexto de uso

- Estudantes do ensino básico, professor como mediador e uma turma reunida presencialmente.
- Participação pelo próprio dispositivo móvel, com visualização coletiva em navegador conectado ao projetor. O aplicativo do estudante deve funcionar bem em telas pequenas e com toque. O primeiro MVP funciona **somente on-line**, com acesso à internet durante toda a sessão.
- Para testes imediatos de interface, existe um modo de demonstração na rede local (`npm run demo`), com estado temporário em memória e sem contas externas. Ele serve para experimentar o fluxo em computador e celular na mesma rede. Por decisão de 22/out/2026 (ver "Decisão para a validação em sala"), o servidor Node da demonstração, hospedado, é a base do protótipo validado na escola.
- A demonstração também pode ser compartilhada temporariamente entre redes com `npm run demo:internet`, por um Quick Tunnel HTTPS. O servidor Node entrega os arquivos e o WebSocket; a chave privada do professor e a chave de projeção protegem esses papéis. A sessão e o endereço são temporários e dependem do computador ligado.
- Na demonstração, a projeção mostra durante a espera um QR Code do link de entrada dos alunos e o código da turma. O QR acompanha reinícios da sessão e desaparece quando a atividade começa; abrir a projeção pelo link público do professor faz o QR apontar para o endereço HTTPS público.
- A demonstração tem vários temas, escolhidos pelo professor no menu "Tema da atividade" enquanto a sessão está em `waiting` (a troca mantém código e alunos conectados e reatribui os cartões; depois de iniciar, fica travada e só muda após Reiniciar demonstração, que preserva o tema atual). Cada tema é um arquivo `atividades/<id>.json` (formato em `docs/atividades.md`), validado por `src/demo/activity.ts` e carregado por `src/demo/catalog.ts` ao iniciar o servidor; arquivos inválidos ficam fora do catálogo com os erros no terminal, e o servidor não sobe sem nenhuma atividade válida. O menu agrupa as atividades por disciplina e mostra a série. Atividades: `ciclo-da-agua` (inicial), `historia`, `sistema-solar`, `metamorfose` e `narrativa-viva` (Língua Portuguesa, rascunho a revisar pela equipe). A ordem é dada pelo campo `ordem` de cada cartão; texto de cartão tem no máximo 60 caracteres (decisão de 22/out/2026). As séries foram propostas pela BNCC e aguardam revisão. `LINHA_VIVA_TEMA` define o tema inicial e `LINHA_VIVA_ATIVIDADES`, outra pasta de atividades. Temas embaralhados reservam o cartão do professor até os outros serem usados.
- Na demonstração multiplayer, o professor recebe um cartão próprio. Alunos recebem Evaporação, Condensação e Precipitação em sequência; depois a sequência recomeça. O cartão do professor não consome a sequência dos alunos. Quem recebe o mesmo cartão forma um grupo: a linha mostra **uma única caixa por cartão**, e sua posição é o consenso (mediana) dos votos de todos os que têm aquele cartão, incluindo o professor. Cada voto aparece como marca anônima no eixo e a caixa informa "N de M votaram"; mudar o voto recalcula o consenso. A referência também lista uma etapa por cartão. Esta regra da demonstração ainda precisa ser integrada ao modelo persistente Supabase antes de uso escolar.
- Idioma inicial: português brasileiro; textos curtos, linguagem adequada à faixa etária e tamanho de fonte legível à distância na projeção.
- Exemplos de conteúdo: ordem de eventos históricos, sequência de trechos narrativos e etapas de ciclos de Ciências. O mecanismo central é uma **sequência ordenada**; uma linha do tempo proporcional, ramificações ou ciclos interativos exigem decisão pedagógica e testes próprios antes de entrar no escopo.

## MVP: fluxo completo

1. O professor cria uma atividade com título, instrução, itens e ordem de referência. Pode usar um exemplo local para demonstração.
2. O professor abre uma sessão e compartilha um código curto de entrada. A tela projetada mostra apenas o estado coletivo e orientações da atividade.
3. Cada estudante entra na sessão com identificação temporária adequada à turma e recebe um item. O mesmo item não pode ser atribuído simultaneamente a dois participantes, salvo configuração explícita da atividade.
4. O estudante lê seu item e o arrasta pelo eixo compartilhado. **Durante todo o arraste, a caixa do item deve se mover de forma contínua e fluida na projeção do professor, em tempo real**, acompanhando as posições intermediárias do gesto; não basta atualizar a projeção quando o estudante soltar o item. Deve haver alternativa equivalente por toque ou teclado para mover e confirmar a posição.
5. Enquanto o estudante move a caixa, a projeção exibe uma prévia temporária do item sem mudar a ordem confirmada. Ao soltar, a posição proposta é validada e sincronizada com a tela coletiva e com os demais dispositivos. Movimentos concorrentes devem produzir uma ordem única e previsível, sem perda silenciosa de itens. O estudante recebe confirmação de envio e indicação clara quando sua proposta precisa ser refeita.
6. O professor pode pausar movimentações, conduzir a discussão, reabrir a edição e encerrar a rodada. A turma vê a sequência final e pode compará-la à referência quando o professor decidir revelar a resposta.
7. Ao sair ou perder conexão, o participante consegue voltar à sessão sem duplicar o item, enquanto ela estiver aberta. O estado coletivo persiste durante a sessão.

Não começar por biblioteca extensa de atividades, contas de estudantes, chat, geração de conteúdo por IA, analytics individuais, gamificação ou modo competitivo. Registrar novas ideias como propostas e validar seu valor pedagógico antes de implementá-las.

## Regras de produto e dados

- Papéis: **professor** controla atividade e sessão; **estudante** propõe a posição de seu item; **projeção** é somente leitura.
- Uma atividade contém itens identificados por ID estável e uma ordem de referência definida pelo professor. A correção serve à conversa mediada, não a uma nota individual automática.
- Uma sessão tem código de acesso, estado (`aguardando`, `ativa`, `pausada`, `encerrada`) e uma versão monotônica do eixo. Cada alteração aceita incrementa a versão; clientes desatualizados recebem o estado atual e podem refazer a proposta.
- Distinguir **prévia de arraste** (posição transitória, sem efeito na ordem e sem persistência) de **posição confirmada** (aceita pelo servidor ao soltar ou confirmar). Ao cancelar, pausar, desconectar ou expirar uma prévia, a caixa volta visualmente à última posição confirmada. Uma prévia atrasada nunca pode sobrescrever uma confirmação mais recente.
- Somente o participante autorizado pode mover seu item; somente o professor pode pausar, revelar a referência ou encerrar. Validar isso no servidor, nunca apenas na interface.
- Não mostrar nomes associados a acertos ou erros na projeção. Usar pseudônimos ou identificadores temporários; coletar o mínimo de dados pessoais e definir retenção curta antes de armazenar qualquer histórico. Não incluir publicidade nem rastreamento de estudantes.
- O professor deve conseguir encerrar a sessão e apagar seus dados temporários. Qualquer integração com serviços externos ou tratamento de dados de menores requer revisão de privacidade e das regras aplicáveis antes do lançamento.
- Perda de rede, toque repetido, dois movimentos simultâneos, entrada tardia, participante desconectado e código inválido devem ter respostas compreensíveis e sem corromper a sequência.

## Acessibilidade e uso em sala

- Direção visual validada: referência à web do início dos anos 2000 e ao Frutiger Aero, com céu azul, verde água, superfícies translúcidas, brilho e controles com relevo. Manter contraste, foco visível e leitura à distância; os elementos decorativos não devem atrapalhar a linha coletiva nem as prévias em movimento.
- Não depender apenas de cor, animação ou arraste para transmitir estado ou permitir ação. Oferecer rótulos, foco visível, controles grandes e feedback textual.
- Projetar para contraste adequado, leitura à distância, diferentes tamanhos de tela e redução de movimento.
- Evitar exposição pública de dificuldades individuais. O professor deve poder retomar e corrigir a atividade sem constranger um estudante.
- Preferir interação de poucos passos e recuperação rápida quando a conexão da escola oscilar. Mostrar claramente quando o dispositivo estiver desconectado e impedir que um movimento não confirmado pareça ter sido aceito. Sincronização sem internet e operação em rede local estão fora do primeiro MVP.

## Decisão para a validação em sala (22/out/2026)

- Validada pelo responsável humano: o protótipo da 3ª entrega (validação com turma real, 06/nov/2026) é construído sobre a **demonstração em Node** (`src/demo/`), hospedada com endereço fixo. As novas funcionalidades do roadmap entram primeiro nela.
- Motivos: a demonstração já tem temas, QR Code, votação por cartão repetido e acesso do professor por chave privada no link, sem depender de e-mail; não guarda dados de estudantes; e o prazo não comporta levar esses recursos para o Supabase e corrigir suas políticas.
- Limites aceitos: uma sessão por servidor, estado em memória que se perde ao reiniciar o processo e permissões verificadas no servidor Node, não por RLS.
- A pilha Supabase descrita abaixo continua no repositório e na CI, mas fica congelada até depois da validação. Antes de retomá-la, corrigir as políticas `activities_teacher` e `items_for_session`, cujas colunas sem qualificação nas subconsultas fazem o estudante não ler a própria atividade e ler itens de atividades de outros professores, e cobrir esses casos com pgTAP.
- Estados da sessão na demonstração: `waiting → active`, `active ⇄ paused` e qualquer estado aberto `→ ended`. Pausar antes de iniciar e repetir o estado atual são rejeitados sem alterar a versão.

## Stack definida para o primeiro MVP (pilha Supabase, retomada após a validação)

- **Interface:** React + TypeScript + Vite em um único aplicativo web responsivo, com rotas para estudante, professor e projeção. A entrada por link ou código no navegador é o percurso principal; oferecer instalação como PWA é um aprimoramento, não uma exigência para participar. Não criar aplicativos nativos Android/iOS neste MVP.
- **Dados e sincronização:** Supabase com PostgreSQL para atividades, sessões, participantes e posições confirmadas. Usar Supabase Realtime **Broadcast** em canais privados para transmitir as posições intermediárias da caixa durante o arraste, sem gravar cada movimento no banco; usar o estado persistido e sua publicação em tempo real para a posição final confirmada. Não confundir o fluxo de prévias com a fonte de verdade da sessão.
- **Identidade e permissões:** Supabase Auth com código de uso único por e-mail para o professor e identidade anônima temporária para cada estudante, associada à sua sessão e ao seu item. A primeira entrega on-line é uma demonstração interna com e-mail autorizado no projeto Supabase. O código da turma permite solicitar entrada; ele não concede, por si só, permissão de professor nem propriedade sobre itens.
- **Operações de escrita:** implementar no PostgreSQL funções de banco chamadas pelo cliente para entrada, atribuição e movimentos, com validação de papel, estado da sessão, propriedade do item e versão do eixo na mesma operação. Usar funções server-side adicionais somente quando as regras exigirem; não permitir que o cliente altere diretamente a ordem ou o estado da sessão.
- **Segurança dos dados:** usar políticas de Row Level Security (RLS) nas tabelas expostas e autorização do Realtime nos canais privados. Somente o dono de um item pode transmitir sua prévia; professor/projeção e participantes autorizados podem recebê-la. Definir e testar como a propriedade do item será imposta também nas mensagens transitórias antes de implementar o Broadcast. Manter a ordem de referência do professor separada dos dados visíveis ao estudante e à projeção até a revelação. Publicar pelo Realtime somente o estado que o participante está autorizado a ver; jamais colocar chaves de serviço no aplicativo web.
- **Testes e qualidade:** Vitest para regras de domínio, React Testing Library para interações da interface, pgTAP com Supabase CLI para funções, integridade e RLS, e Playwright para o fluxo professor → estudantes → projeção, incluindo tamanho de tela móvel. Usar TypeScript em modo estrito, lint e formatação automatizados.

Manter separadas, mesmo no mesmo repositório, as responsabilidades de: (1) interface do estudante, (2) interface do professor/projeção, (3) regras de atividade e sessão, (4) acesso a dados e sincronização. Começar com a menor estrutura que entregue o fluxo completo. Evitar microsserviços, filas, cache e uma API própria em Node sem necessidade demonstrada.

Definir contratos verificáveis para criação/entrada de sessão, atribuição de itens, início/atualização/fim da prévia de arraste, proposta de movimento, publicação de estado, pausa, revelação e encerramento. Representar a posição da prévia em coordenadas relativas ao eixo, independentes do tamanho das telas. Limitar a frequência de envio das prévias para evitar mensagens excessivas e animar a caixa na projeção entre atualizações recebidas. O PostgreSQL é a fonte de verdade para ordem, permissões e versão do eixo; o Broadcast transmite apenas prévias temporárias e o estado persistido determina a posição final. Em reconexão, consultar novamente o estado confirmado antes de permitir novas ações. Não confiar em uma sequência mantida apenas no cliente.

Para a demonstração interna, suportar até 40 estudantes conectados e até 5 arrastes simultâneos no plano gratuito. O estudante move livremente a caixa em duas dimensões; ao soltar, a caixa encaixa no eixo horizontal conforme a coordenada `x`, enquanto `y` afeta somente a prévia. Começar com, no máximo, 6 mensagens de prévia por segundo por arraste e medir a latência até a projeção. Itens são textuais, com um item por estudante e uma atividade por sessão. Hospedar a interface estática no Cloudflare Pages e usar Supabase no plano gratuito; implantação para professores externos exige configurar SMTP e revisar privacidade.

## Forma de trabalho com IA

Aplicar o ciclo **entender → especificar → testar → implementar → refatorar → verificar** em incrementos pequenos. O responsável humano valida o objetivo didático e as decisões de escopo; o agente pode propor soluções técnicas, mas deve explicitar suposições e pedir decisão quando elas mudarem a experiência pedagógica ou o tratamento de dados.

Para cada mudança de comportamento:

1. Escrever uma história curta e critérios de aceitação observáveis, inclusive estados de erro e acessibilidade pertinentes.
2. **Escrever primeiro testes automatizados que expressem o comportamento esperado.** Executá-los e confirmar que falham pela ausência do comportamento (fase vermelha). Não produzir implementação junto com os testes iniciais.
3. Implementar apenas o necessário para passar os testes (fase verde). Testar regras de domínio em unidade; usar testes de integração para permissões, persistência e sincronização; cobrir pelo menos o percurso professor → estudante → projeção com teste de ponta a ponta quando houver interface executável.
4. Refatorar código e testes mantendo-os verdes. Revisar os testes gerados por IA: eles devem afirmar comportamento relevante, detectar regressões e evitar simulações que apenas confirmem a própria implementação.
5. Rodar lint, análise estática ou de tipos, testes afetados e, antes de integrar, a suíte completa. Relatar comandos, resultados e limites reais da verificação; nunca afirmar que testou algo que não executou.

Para correção de defeitos, reproduzir o problema com um teste que falha antes de alterar o código. Para mudanças puramente documentais ou visuais sem comportamento programável, usar revisão textual ou visual proporcional; não criar testes artificiais.

Trabalhar em mudanças pequenas e revisáveis. Não introduzir dependências, abstrações ou otimizações especulativas. Avaliar segurança e privacidade a cada funcionalidade, sobretudo acesso por código, autorização de papéis e dados de crianças. Configurar CI assim que houver código executável para rodar TypeScript, lint, testes Vitest, testes pgTAP e o percurso Playwright em cada alteração integrada. Registrar decisões, obstáculos recorrentes e comandos reais neste arquivo ou em documentação vinculada.

## Primeira entrega de desenvolvimento

O primeiro recorte vertical é: professor abre sessão com três itens, três estudantes entram e arrastam seus itens, a projeção acompanha cada caixa **durante o movimento**, a ordem é confirmada ao soltar, e o professor pausa e revela a referência. Especificar os critérios de aceitação e escrever os testes antes da implementação. Testar que a projeção recebe posições intermediárias antes do fim do gesto, que cancelamento/desconexão removem prévias, que dois arrastes simultâneos não se confundem e que a ordem confirmada continua correta. Validar a fluidez e a latência percebida com internet, em dispositivos móveis reais e na tela de projeção da sala, antes de ampliar o catálogo de atividades.

## Estado verificável do repositório

- A implementação inicial contém as telas de professor, estudante e projeção, a migração SQL, a transmissão de prévias, o encaixe ao soltar, o controle de sessão e a alternativa por intervalo/teclado. A sessão começa em `waiting` (aguardando), passa a `active` quando o professor inicia e pode ser pausada ou encerrada. A projeção usa identidade Auth separada, chave própria de entrada e permissão de somente leitura, inclusive nos canais de prévia.
- O cliente do estudante renova a inscrição no canal privado ao mudar o estado da sessão, porque a autorização do Realtime é calculada na entrada do canal. A projeção ignora prévias enquanto a sessão está pausada; confirmações sempre passam pela função PostgreSQL que verifica estado e versão.
- O arraste mantém até 6 prévias por segundo e envia a posição mais recente no próximo intervalo, mesmo sem novo evento de toque. A prévia local segue o dedo sem interpolação; professor e projeção animam entre amostras recebidas. A demonstração local transmite apenas a alteração da prévia durante o gesto e envia o estado completo nas alterações confirmadas.
- Na demonstração, professor e projeção desenham prévias remotas por `requestAnimationFrame` com `transform` e previsão curta limitada, sem aumentar a taxa de mensagens. Uma confirmação não interrompe a prévia de outro arraste já iniciado; pausar e retomar invalida gestos antigos. A confirmação da posição ainda exige a versão atual da linha.
- `npm test`, `npm run test:db`, `npm run lint`, `npm run format:check` e `npm run build` rodam sem conta externa. `npm run test:db` usa PostgreSQL em WASM para executar a migração e pgTAP; `npm run test:db:supabase` exige Supabase local com Docker. O percurso Playwright com Auth/Realtime também exige esse ambiente.
- `npm run test:load` prepara 40 estudantes e mede o Broadcast de 5 arrastes simultâneos a 6 envios/s, mas o resultado de latência deve ser obtido no ambiente de demonstração. A confirmação de fluidez em dispositivos e projetor reais ainda é obrigatória.
- A publicação Cloudflare Pages + Supabase e o envio real de e-mail dependem de contas que ainda não foram criadas. Em projetos Supabase gratuitos novos, o template do código digitado pode exigir SMTP próprio. O login por link está previsto como contingência para a demonstração interna; não declarar o requisito de código digitado validado em produção antes de configurar e testar SMTP.

## Referências do processo

- Vídeo solicitado: [O Método Fábio Akita para programar com IA](https://www.youtube.com/watch?v=cWY7iBafw7I). Orientações adaptadas: arquitetura e domínio antes do código, testes antes da implementação, colaboração crítica com IA, refatoração contínua, incrementos pequenos, CI e ambiente de execução controlado.
- Fonte primária complementar do autor: [Do Zero à Pós-Produção em 1 Semana — Como usar IA em Projetos de Verdade](https://akitaonrails.com/2026/02/20/do-zero-a-pos-producao-em-1-semana-como-usar-ia-em-projetos-de-verdade-bastidores-do-the-m-akita-chronicles/). As métricas e a sequência de dias descritas ali são relatos de outro projeto, não metas obrigatórias para Linha Viva.
