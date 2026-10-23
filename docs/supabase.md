# Versão Supabase

> **Congelada até depois da validação em sala (06/nov/2026).** O protótipo validado na escola é a demonstração em Node ([hospedagem.md](hospedagem.md)). Esta versão continua no repositório e na CI; a decisão está registrada no [AGENTS.md](../AGENTS.md), em "Decisão para a validação em sala". Temas, QR Code e votação por cartão repetido ainda não existem aqui.

A versão Supabase usa PostgreSQL para atividades, sessões e posições confirmadas, Supabase Auth (código por e-mail para o professor, identidade anônima para alunos e projeção) e Realtime Broadcast em canais privados para as prévias de arraste. As regras ficam em funções SQL e políticas de Row Level Security em [`supabase/migrations/`](../supabase/migrations/).

## Executar localmente

Requisitos: Node.js 22, npm e Docker para o Supabase local. Sem Docker, os testes de unidade e os testes pgTAP no PostgreSQL em WASM ainda funcionam.

1. `npm ci`
2. `npx supabase start`
3. Copie `.env.example` para `.env.local` e use a URL e a chave pública do Supabase. A CLI local pode mostrar `ANON_KEY`; nesse caso, configure `VITE_SUPABASE_ANON_KEY`. Projetos hospedados novos devem usar a chave publicável em `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca use chave secreta ou `service_role` no navegador.
4. `npm run dev`
5. Abra `http://127.0.0.1:5173`. O e-mail local aparece no Mailpit em `http://127.0.0.1:54324`. A entrada do aluno exige uma janela ou navegador com sessão Auth separada da conta do professor.

O login local do professor usa o código de seis dígitos enviado pelo Mailpit. O aluno entra anonimamente com o código da turma. A projeção deve ser aberta pelo painel do professor; ela usa identidade anônima separada, chave de acesso própria e permissão de somente leitura.

## Verificar

| Comando                    | Verificação                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:db`          | Migrações e pgTAP com PostgreSQL em WASM, sem Docker                                                                                                                         |
| `npm run test:db:supabase` | pgTAP na instância local do Supabase                                                                                                                                         |
| `npm run test:e2e`         | O percurso colaborativo (`e2e/internal-demo.spec.ts`) exige `E2E_LOCAL_SUPABASE=1` e o Supabase local iniciado                                                               |
| `npm run test:load`        | Ensaio local com 40 identidades anônimas, 5 canais enviando 6 vezes por segundo por 10 s e medição p95 na identidade de leitura da projeção; requer Supabase local e Mailpit |

## Publicar a demonstração interna

1. Crie um projeto Supabase e aplique as migrações de `supabase/migrations/` usando a CLI (`npx supabase link` e `npx supabase db push`) após conferir o projeto de destino. Ative **Anonymous Sign-Ins** em Auth e desative **Allow public access** nas configurações do Realtime para usar apenas canais privados.
2. Em Auth, configure a URL do site e o redirecionamento `https://SEU-SITE.pages.dev/professor`. Autorize o e-mail do professor no projeto.
3. Crie um projeto Cloudflare Pages conectado ao repositório: comando de build `npm run build`, diretório de saída `dist`, versão do Node `22`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publicável do projeto Supabase. Ambas serão expostas ao navegador por design; nunca configure uma chave secreta ou `service_role` no Pages.
4. Publique e teste com três navegadores de alunos independentes e a projeção. Verifique prévias antes de soltar, pausa, revelação, reconexão e retorno após fechar a aba.

**E-mail no plano gratuito:** projetos Supabase novos podem enviar somente aos endereços autorizados da equipe e o serviço padrão impõe limites. A personalização do template para código digitado pode exigir SMTP próprio. Até configurar domínio e SMTP, a demonstração hospedada deve usar o link de acesso por e-mail quando o código não estiver disponível. Isso impede validar o requisito de código digitado em produção. Não abra acesso a professores externos antes de configurar SMTP e revisar privacidade e retenção.

**Limites de validação:** a meta de 40 alunos, cinco arrastes e latência p95 até 300 ms requer ensaio no projeto hospedado e em dispositivos da escola. Não se presume atingida pelos testes locais.

O ensaio de carga cria e apaga uma sessão de teste. No Supabase hospedado, use um projeto de teste e forneça `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOAD_TEACHER_EMAIL` e `LOAD_TEACHER_OTP` como variáveis de ambiente. O ensaio mede a chegada do Broadcast à identidade de projeção no mesmo computador; a fluidez visual da projeção ainda precisa ser conferida no dispositivo real.
