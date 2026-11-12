# Hospedagem no Render

A versão usada na escola é o servidor Node da demonstração, hospedado no [Render](https://render.com) no plano gratuito. O Render constrói a imagem a partir de [`Dockerfile.demo`](../Dockerfile.demo) e publica um endereço HTTPS fixo, como `https://linha-viva.onrender.com`. A configuração está em [`render.yaml`](../render.yaml).

## Como funciona e o que esperar

- **Uma sessão por servidor, em memória.** A turma, os cartões e a linha ficam na memória do processo. Um reinício do serviço (nova publicação, queda ou o serviço "dormir") apaga a sessão e gera outro código de turma.
- **As linhas criadas pelos professores** (botão **Criar linha**) ficam no Supabase, na tabela `demo_lines`, e sobrevivem aos reinícios. Sem o Supabase configurado, ficam em arquivos da pasta `atividades/` e somem quando o Render reinicia o serviço.
- **O plano gratuito dorme** depois de 15 minutos sem receber nenhuma requisição ou mensagem WebSocket, e leva cerca de 1 minuto para acordar. Enquanto houver uma tela aberta (professor, projeção ou aluno), cada uma envia uma pulsação a cada 60 segundos, o que mantém o serviço acordado durante a aula, mesmo quando ninguém move cartões.
- **Publicação automática.** Cada push na branch `main` publica uma nova versão, o que reinicia o serviço. Não faça push para `main` durante uma aula.
- **Região.** O servidor fica na Virgínia (EUA), a região do Render mais próxima do Brasil. O tempo de ida e volta esperado é de 120 a 180 ms; a meta do projeto é até 300 ms.

## Configurar pela primeira vez

### 1. Supabase (onde ficam as contas de professor)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com), com uma conta da equipe, na região **South America (São Paulo)**.
2. Em **Authentication → Sign In / Providers**: deixe **Email** ligado, **desligue "Allow new users to sign up"** (as contas só nascem pelo servidor da Linha Viva, que confere o código de convite) e **desligue "Confirm email"** (o plano gratuito tem limite baixo de e-mails).
3. Em **Project Settings → API Keys**, copie a **URL do projeto** e a **chave secreta** (_secret key_). A chave secreta dá acesso total ao projeto: não a coloque no repositório nem em mensagens; ela vai direto para o painel do Render.
4. Crie a tabela das linhas criadas pelo professor: em **SQL Editor → New query**, cole todo o conteúdo de [`supabase/migrations/20261111000100_demo_lines.sql`](../supabase/migrations/20261111000100_demo_lines.sql) e clique em **Run**. Só esse arquivo é necessário: as outras migrações são da versão Supabase congelada ([supabase.md](supabase.md)). A tabela nasce com a RLS ligada e sem nenhuma política, então só o servidor, com a chave secreta, lê e grava nela; o navegador nunca acessa. Ela guarda apenas o texto que o professor escreveu (tema, pontas, cartões) e o e-mail de quem criou, nenhum dado de estudante.

### 2. Render

1. Crie uma conta no Render e conecte a conta do GitHub que tem acesso ao repositório.
2. No painel, escolha **New → Blueprint**, selecione o repositório e confirme o arquivo `render.yaml`. Preencha quando o Render pedir:
   - `SUPABASE_URL` e `SUPABASE_SECRET_KEY`: os valores do Supabase;
   - `CONVITE_PROFESSOR` (opcional): o código de convite que a equipe vai passar aos professores. Prefira uma frase longa, difícil de adivinhar. **Em branco, qualquer pessoa com o link cria conta de professor** e passa a usar o seu Supabase; deixe assim só se o endereço não for divulgado.

   `SESSAO_SEGREDO` é gerado pelo próprio Render.

3. Aguarde a primeira publicação (alguns minutos). Em **Logs**, o servidor imprime:

   ```
   Professor: https://linha-viva.onrender.com/demo/professor
   Alunos: https://linha-viva.onrender.com/demo/aluno/1A2B3C4D
   Contas de professor: supabase
   Linhas criadas: supabase
   ```

   Se aparecer outra linha de aviso (`Sem contas de professor`, `CONVITE_PROFESSOR não definido` (cadastro aberto a qualquer pessoa; só preocupa se você queria exigir convite), `SESSAO_SEGREDO ausente` ou `Sem SUPABASE_URL e SUPABASE_SECRET_KEY, as linhas criadas ficam só em arquivos`), falta a variável indicada em **Environment**. Se, ao criar uma linha, o painel disser que a tabela `demo_lines` não existe, falta o passo 4 do Supabase.

Um serviço criado antes desta versão ainda usa `DEMO_TEACHER_KEY`: adicione as variáveis acima em **Environment** e apague `DEMO_TEACHER_KEY`, que não é mais usada.

### 3. Contas de professor

Cada professor abre `https://linha-viva.onrender.com/demo/professor`, clica em **Criar conta** e informa e-mail, uma senha de pelo menos 8 caracteres e, se o servidor tiver `CONVITE_PROFESSOR`, o **código de convite**. A conta já entra no painel. Depois, basta **Entrar** com e-mail e senha; o acesso vale por 8 horas, e **Sair** encerra antes.

- **Esqueceu a senha:** no Supabase, em **Authentication → Users**, encontre o e-mail e defina uma nova senha (ou apague o usuário para ele criar a conta de novo). Não há recuperação por e-mail enquanto o projeto não tiver um provedor de e-mail próprio.
- **Tirar o acesso de alguém:** apague o usuário no Supabase. Login aberto em algum navegador continua valendo até completar 8 horas.
- **Trocar o código de convite:** altere `CONVITE_PROFESSOR` no Render. Contas já criadas continuam valendo. Para voltar a exigir convite depois de um período aberto, defina o código e revise os usuários em **Authentication → Users**; para abrir o cadastro, apague a variável.
- **Senhas erradas:** depois de 5 tentativas, o login daquela rede e daquele e-mail fica bloqueado por 15 minutos.
- Ainda existe **uma única turma por servidor**: se dois professores entrarem ao mesmo tempo, os dois controlam a mesma sessão.

Para trocar a atividade aberta ao iniciar, altere `LINHA_VIVA_TEMA` em **Environment**. A lista de atividades e como cadastrar novas estão em [atividades.md](atividades.md).

## Antes de cada aula

1. **5 minutos antes**, abra `https://linha-viva.onrender.com/demo/professor` no computador da sala e entre com sua conta. Se o serviço estava dormindo, a página demora cerca de 1 minuto para carregar; aguarde.
2. Clique em **Abrir projeção** e leve a aba para o projetor. Confira se o QR Code aparece.
3. Faça um teste rápido com um celular: entrar pelo QR Code, receber um cartão e ver a caixa se mover na projeção.
4. Clique em **Reiniciar demonstração** para começar a aula com a sessão limpa.

Deixe a aba do professor ou da projeção aberta durante toda a aula; ela mantém o serviço acordado.

## Se algo der errado

- **A página não carrega depois de 2 minutos:** veja em **Logs** se o serviço está publicando ou com erro. Como plano B, rode `npm run demo:internet` em um computador da equipe (instruções no [README](../README.md)).
- **"Reconectando ao computador" em todos os aparelhos:** o serviço reiniciou ou caiu. Recarregue o painel do professor; o login continua valendo, a sessão começa do zero, com outro código, e os alunos entram de novo pelo QR Code.
- **Uma atividade não aparece no menu:** procure `Atividade rejeitada` em **Logs**; a mensagem diz o que corrigir no arquivo.

## Reproduzir o servidor do Render no computador

`npm run build:demo` e depois `npm run start:demo` rodam o mesmo servidor que o Render executa. Sem Supabase, use uma conta de teste que existe só na memória do servidor; no PowerShell:

```
$env:PROFESSOR_TESTE = "professor@teste.br:senha-de-teste"; npm run start:demo
```

Depois entre em `http://localhost:4173/demo/professor` com esse e-mail e essa senha. Para testar contra o Supabase de verdade, defina `SUPABASE_URL` e `SUPABASE_SECRET_KEY` no lugar de `PROFESSOR_TESTE`.
