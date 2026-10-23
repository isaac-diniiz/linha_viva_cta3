# Linha Viva

Atividade cooperativa on-line para construir uma sequência coletiva com a turma. O professor abre uma sessão, cada participante recebe um cartão, e a projeção mostra a caixa durante o arraste e confirma a ordem ao soltar.

## Testar pela internet, em redes diferentes

Esta demonstração temporária usa o computador do professor como servidor e um [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/) para fornecer um endereço HTTPS público. Não é necessário criar conta ou projeto Supabase. O computador precisa permanecer ligado, conectado à internet e com o terminal aberto durante toda a sessão.

1. Instale Node.js 22 ou mais recente e execute `npm ci` nesta pasta.
2. Baixe o [executável Windows de 64 bits do cloudflared](https://developers.cloudflare.com/tunnel/downloads/) para `.tools/cloudflared.exe` dentro deste projeto, ou instale `cloudflared` no `PATH`.
3. Execute `npm run demo:internet`. O terminal imprimirá um **link do professor**, com chave privada, e um **link dos alunos**. Abra o link do professor e clique em **Abrir projeção**. Enquanto a atividade aguarda, a projeção mostra um QR Code para o link dos alunos e o código da turma.
4. Os alunos apontam a câmera do celular para o QR Code ou abrem o link dos alunos, em qualquer rede com internet. O professor clica em **Iniciar atividade**; o QR Code sai da projeção para dar espaço à linha. Cada um arrasta seu cartão ou usa o controle de posição; a projeção mostra o arraste ao vivo e a confirmação ao soltar.
5. Para encerrar o teste, clique em **Encerrar** ou **Reiniciar demonstração** conforme necessário. `Ctrl+C` no terminal desliga o link e apaga a sessão em memória. Ao reiniciar, o código e os links mudam.

Na tela do professor, o menu **Tema da atividade** agrupa as atividades por disciplina e mostra a série de cada uma. Enquanto a atividade está aguardando, o professor escolhe o tema e a turma já conectada recebe cartões novos, no mesmo código e link. Depois de **Iniciar atividade** a escolha fica travada; para mudar, use **Reiniciar demonstração** e escolha de novo. A lista de atividades e o guia para cadastrar novas estão em [docs/atividades.md](docs/atividades.md).

As prévias continuam limitadas a seis mensagens por segundo por arraste. A projeção desenha cada caixa em frames contínuos no navegador e prevê por um curto intervalo entre amostras, inclusive quando dois alunos arrastam ao mesmo tempo. Se um aluno confirmar enquanto outro ainda arrasta, a segunda prévia continua fluida; a confirmação final ainda verifica a versão da linha e pode pedir nova proposta. A opção de reduzir movimento do dispositivo é respeitada.

O Quick Tunnel é destinado a testes e desenvolvimento, usa um subdomínio aleatório e não tem garantia de disponibilidade. Para manter um endereço fixo, hospede o servidor Node com suporte a WebSocket e `PORT`; `Dockerfile.demo` já empacota a demo. A sessão desse servidor continua em memória e desaparece em reinícios. A implantação escolar e o armazenamento durável seguem o caminho Supabase descrito abaixo.

## Testar agora com computador e celular

Esta alternativa usa aparelhos na **mesma rede Wi-Fi**. Não precisa de Supabase, Docker, e-mail nem conta. Precisa de Node.js 22 ou mais recente e npm no computador.

1. No computador, abra o PowerShell nesta pasta (`C:\projects\cta3`). Execute `npm ci` uma vez e depois `npm run demo`. Deixe o terminal aberto.
2. No computador, abra `http://localhost:5173`, clique em **Professor** e depois em **Abrir projeção**. Deixe as duas abas abertas. Se quiser projetar, mova a aba da projeção para a tela da sala.
3. No PowerShell, execute `ipconfig` em outra janela. Anote o endereço **IPv4** do adaptador Wi-Fi do computador, por exemplo `192.168.1.23`. No celular, conectado ao mesmo Wi-Fi, abra `http://192.168.1.23:5173` (troque pelo seu IPv4). Clique em **Aluno**. O código DEMO1234 já é usado pela demonstração.
4. No computador, na aba **Professor**, clique em **Iniciar atividade**. No celular, arraste a caixa **Evaporação** pelo espaço da linha e observe a aba **Projeção** *antes de soltar*: a caixa deve acompanhar o gesto. Solte para confirmar a posição. Também é possível usar o controle de posição e o botão **Confirmar posição escolhida**.
5. Na aba do professor, teste **Pausar movimentos**, **Retomar atividade** e **Revelar referência**. Para voltar ao começo, clique em **Reiniciar demonstração**.

Se o celular não abrir a página, confira se está no mesmo Wi-Fi, use o IPv4 do adaptador Wi-Fi (não `localhost`, que no celular aponta para o próprio celular) e permita o acesso do Node.js na **rede privada** quando o Windows solicitar. A demonstração guarda os dados somente na memória do computador; ao parar o terminal, a sessão desaparece. É um modo de teste em rede local, não a implantação on-line para uma escola.

## Executar localmente

Requisitos: Node.js 22, npm e Docker para o Supabase local. Sem Docker, os testes de unidade e os testes pgTAP no PostgreSQL em WASM ainda funcionam.

1. `npm ci`
2. `npx supabase start`
3. Copie `.env.example` para `.env.local` e use a URL e a chave pública do Supabase. A CLI local pode mostrar `ANON_KEY`; nesse caso, configure `VITE_SUPABASE_ANON_KEY`. Projetos hospedados novos devem usar a chave publicável em `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca use chave secreta ou `service_role` no navegador.
4. `npm run dev`
5. Abra `http://127.0.0.1:5173`. O e-mail local aparece no Mailpit em `http://127.0.0.1:54324`. A entrada do aluno exige uma janela ou navegador com sessão Auth separada da conta do professor.

O login local do professor usa o código de seis dígitos enviado pelo Mailpit. O aluno entra anonimamente com o código da turma. A projeção deve ser aberta pelo painel do professor; ela usa identidade anônima separada, chave de acesso própria e permissão de somente leitura.

## Verificar

| Comando | Verificação |
| --- | --- |
| `npm test` | Domínio e interface com Vitest e React Testing Library |
| `npm run test:db` | Migração e pgTAP com PostgreSQL em WASM, sem Docker |
| `npm run test:db:supabase` | pgTAP na instância local do Supabase |
| `npm run lint` | ESLint |
| `npm run format:check` | Formatação Prettier |
| `npm run build` | TypeScript estrito e build Vite |
| `npm run test:e2e` | Playwright desktop e celular; o percurso colaborativo exige `E2E_LOCAL_SUPABASE=1` e o Supabase local iniciado |
| `npm run test:load` | Ensaio local com 40 identidades anônimas, 5 canais enviando 6 vezes por segundo por 10 s e medição p95 na identidade de leitura da projeção; requer Supabase local e Mailpit |

## Publicar a demonstração interna

1. Crie um projeto Supabase e execute a migração em `supabase/migrations/20260924000100_initial.sql` usando a CLI (`npx supabase link` e `npx supabase db push`) após conferir o projeto de destino. Ative **Anonymous Sign-Ins** em Auth e desative **Allow public access** nas configurações do Realtime para usar apenas canais privados.
2. Em Auth, configure a URL do site e o redirecionamento `https://SEU-SITE.pages.dev/professor`. Autorize o e-mail do professor no projeto.
3. Crie um projeto Cloudflare Pages conectado ao repositório: comando de build `npm run build`, diretório de saída `dist`, versão do Node `22`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publicável do projeto Supabase. Ambas serão expostas ao navegador por design; nunca configure uma chave secreta ou `service_role` no Pages.
4. Publique e teste com três navegadores de alunos independentes e a projeção. Verifique prévias antes de soltar, pausa, revelação, reconexão e retorno após fechar a aba.

**E-mail no plano gratuito:** projetos Supabase novos podem enviar somente aos endereços autorizados da equipe e o serviço padrão impõe limites. A personalização do template para código digitado pode exigir SMTP próprio. Até configurar domínio e SMTP, a demonstração hospedada deve usar o link de acesso por e-mail quando o código não estiver disponível. Isso impede validar o requisito de código digitado em produção. Não abra acesso a professores externos antes de configurar SMTP e revisar privacidade/retenção.

**Limites de validação:** a meta de 40 alunos, cinco arrastes e latência p95 até 300 ms requer ensaio no projeto hospedado e em dispositivos da escola. Não se presume atingida pelos testes locais. A linha rola horizontalmente quando há muitos itens; teclado e toque podem percorrê-la, e o controle de intervalo do aluno confirma uma posição sem arrastar.

O ensaio de carga cria e apaga uma sessão de teste. No Supabase hospedado, use um projeto de teste e forneça `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOAD_TEACHER_EMAIL` e `LOAD_TEACHER_OTP` como variáveis de ambiente. O ensaio mede chegada do Broadcast à identidade de projeção no mesmo computador; a fluidez visual da projeção ainda precisa ser conferida no dispositivo real.
