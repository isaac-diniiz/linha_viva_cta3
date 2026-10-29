# Linha Viva

Atividade cooperativa on-line para construir uma sequência coletiva com a turma. O professor abre uma sessão, cada participante recebe um cartão, e a projeção mostra a caixa durante o arraste e confirma a ordem ao soltar.

| Documento                                | Para quem                                                         |
| ---------------------------------------- | ----------------------------------------------------------------- |
| [docs/hospedagem.md](docs/hospedagem.md) | Quem publica a versão da escola no Render e prepara cada aula     |
| [docs/atividades.md](docs/atividades.md) | Quem cadastra ou revisa atividades                                |
| [docs/supabase.md](docs/supabase.md)     | Quem retomar a versão Supabase, congelada até depois da validação |
| [AGENTS.md](AGENTS.md)                   | Regras de produto, decisões e forma de trabalho com IA            |

Todos os modos abaixo precisam de Node.js 22 ou mais recente e de `npm ci` executado uma vez nesta pasta.

## Testar na mesma rede Wi-Fi

Não precisa de conta nem de internet além da rede local. É o modo usado para desenvolver: a página recarrega a cada mudança no código.

1. No computador, execute `npm run demo` e deixe o terminal aberto.
2. Abra `http://localhost:5173`, clique em **Professor** e depois em **Abrir projeção**. Se quiser projetar, mova a aba da projeção para a tela da sala.
3. Em outro PowerShell, execute `ipconfig` e anote o endereço **IPv4** do adaptador Wi-Fi, por exemplo `192.168.1.23`. No celular, no mesmo Wi-Fi, abra `http://192.168.1.23:5173` (troque pelo seu IPv4), clique em **Aluno** e digite o código **DEMO1234**, fixo no modo local.
4. No professor, clique em **Iniciar atividade**. No celular, arraste o cartão pela linha e observe a projeção _antes de soltar_: a caixa deve acompanhar o gesto. Solte para confirmar, ou use o controle de posição e **Confirmar posição escolhida**.
5. Teste **Pausar movimentos**, **Retomar atividade** e **Revelar referência**. Para voltar ao começo, clique em **Reiniciar demonstração**.

Se o celular não abrir a página, confira se está no mesmo Wi-Fi, use o IPv4 do adaptador Wi-Fi (não `localhost`, que no celular aponta para o próprio celular) e permita o acesso do Node.js na **rede privada** quando o Windows solicitar. Os dados ficam só na memória do computador; ao parar o terminal, a sessão desaparece.

## Testar pela internet, em redes diferentes

Usa o computador como servidor e um [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/) para criar um endereço HTTPS temporário. Serve para testes e como plano B se a versão hospedada falhar; o computador precisa ficar ligado com o terminal aberto durante toda a sessão.

1. Baixe o [executável Windows de 64 bits do cloudflared](https://developers.cloudflare.com/tunnel/downloads/) para `.tools/cloudflared.exe` dentro deste projeto, ou instale `cloudflared` no `PATH`.
2. Execute `npm run demo:internet`. O terminal imprime um **link do professor**, com chave privada, e um **link dos alunos**. Abra o link do professor e clique em **Abrir projeção**. Enquanto a atividade aguarda, a projeção mostra um QR Code para o link dos alunos e o código da turma.
3. Os alunos apontam a câmera do celular para o QR Code ou abrem o link dos alunos, em qualquer rede com internet. O professor clica em **Iniciar atividade**; o QR Code sai da projeção para dar espaço à linha.
4. `Ctrl+C` no terminal desliga o link e apaga a sessão. Ao reiniciar, o código e os links mudam.

O Quick Tunnel usa um subdomínio aleatório e não tem garantia de disponibilidade. Para um endereço fixo, use a versão hospedada descrita em [docs/hospedagem.md](docs/hospedagem.md).

## Como a atividade funciona

No painel do professor, o menu **Tema da atividade** agrupa as atividades por disciplina e mostra a série de cada uma. Enquanto a atividade está aguardando, o professor escolhe o tema e a turma já conectada recebe cartões novos, no mesmo código e link. Depois de **Iniciar atividade** a escolha fica travada; para mudar, use **Reiniciar demonstração** e escolha de novo. A lista de atividades e o guia para cadastrar novas estão em [docs/atividades.md](docs/atividades.md).

Quem recebe o mesmo cartão forma um grupo: a linha mostra uma única caixa por cartão, na posição de consenso (mediana) dos votos do grupo, com marcas anônimas de cada voto.

Com poucas pessoas, use **Cartões por participante** no painel do professor, antes de iniciar: cada participante, professor incluído, recebe de 1 a 4 cartões diferentes, e cada um pode ser arrastado ou confirmado pelo controle de posição. Com 3 pessoas e 4 cartões cada, por exemplo, a Linha do tempo do Brasil (10 acontecimentos) fica toda distribuída. Para só conduzir a atividade, desmarque **Participar com cartões**: o professor deixa de receber cartões, e todos vão para os alunos.

As prévias são limitadas a seis mensagens por segundo por arraste. A projeção desenha cada caixa em frames contínuos e prevê por um curto intervalo entre amostras, inclusive quando dois alunos arrastam ao mesmo tempo. Se um aluno confirmar enquanto outro ainda arrasta, a segunda prévia continua fluida; a confirmação final verifica a versão da linha e pode pedir nova proposta. A opção de reduzir movimento do dispositivo é respeitada.

## Verificar

| Comando                | Verificação                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `npm test`             | Domínio, servidor, atividades cadastradas e interface com Vitest e Testing Library    |
| `npm run lint`         | ESLint                                                                                |
| `npm run format:check` | Formatação Prettier                                                                   |
| `npm run build`        | TypeScript estrito e build Vite                                                       |
| `npm run test:db`      | Migrações e pgTAP da versão Supabase em PostgreSQL WASM, sem Docker                   |
| `npm run test:e2e`     | Playwright desktop e celular; os percursos da demonstração exigem as variáveis abaixo |

Para os percursos Playwright da demonstração: `DEMO_MODE=1` roda `e2e/demo.spec.ts` e `e2e/smooth-demo.spec.ts` com o servidor de desenvolvimento; `PUBLIC_DEMO_MODE=1` roda `e2e/public-demo.spec.ts` contra `npm run start:demo` na porta 4173 com `DEMO_TEACHER_KEY=teste-professor`. A CI executa os dois. Os comandos da versão Supabase estão em [docs/supabase.md](docs/supabase.md).
