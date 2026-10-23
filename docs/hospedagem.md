# Hospedagem no Render

A versão usada na escola é o servidor Node da demonstração, hospedado no [Render](https://render.com) no plano gratuito. O Render constrói a imagem a partir de [`Dockerfile.demo`](../Dockerfile.demo) e publica um endereço HTTPS fixo, como `https://linha-viva.onrender.com`. A configuração está em [`render.yaml`](../render.yaml).

## Como funciona e o que esperar

- **Uma sessão por servidor, em memória.** A turma, os cartões e a linha ficam na memória do processo. Um reinício do serviço (nova publicação, queda ou o serviço "dormir") apaga a sessão e gera outro código de turma.
- **O plano gratuito dorme** depois de 15 minutos sem receber nenhuma requisição ou mensagem WebSocket, e leva cerca de 1 minuto para acordar. Enquanto houver uma tela aberta (professor, projeção ou aluno), cada uma envia uma pulsação a cada 60 segundos, o que mantém o serviço acordado durante a aula, mesmo quando ninguém move cartões.
- **Publicação automática.** Cada push na branch `main` publica uma nova versão, o que reinicia o serviço. Não faça push para `main` durante uma aula.
- **Região.** O servidor fica na Virgínia (EUA), a região do Render mais próxima do Brasil. O tempo de ida e volta esperado é de 120 a 180 ms; a meta do projeto é até 300 ms.

## Configurar pela primeira vez

1. Gere a chave do professor no terminal, em qualquer computador com Node:

   ```
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```

   Guarde o valor em um lugar seguro da equipe. Quem tiver essa chave controla a sessão.

2. Crie uma conta no Render e conecte a conta do GitHub que tem acesso ao repositório.
3. No painel, escolha **New → Blueprint**, selecione o repositório e confirme o arquivo `render.yaml`. Quando o Render pedir `DEMO_TEACHER_KEY`, cole a chave do passo 1.
4. Aguarde a primeira publicação (alguns minutos). Em **Logs**, o servidor imprime:

   ```
   Professor: https://linha-viva.onrender.com/demo/professor?key=...
   Alunos: https://linha-viva.onrender.com/demo/aluno/1A2B3C4D
   ```

   O link do professor é fixo enquanto a chave não mudar; salve-o nos favoritos do computador da sala. O link dos alunos muda a cada reinício, mas eles entram pelo QR Code da projeção.

Se aparecer `DEMO_TEACHER_KEY não definida` no log, a chave não foi configurada e o link do professor mudará a cada reinício. Defina-a em **Environment** no painel do serviço.

Para trocar a atividade aberta ao iniciar, altere `LINHA_VIVA_TEMA` em **Environment**. A lista de atividades e como cadastrar novas estão em [atividades.md](atividades.md).

## Antes de cada aula

1. **5 minutos antes**, abra o link do professor no computador da sala. Se o serviço estava dormindo, a página demora cerca de 1 minuto para carregar; aguarde.
2. Clique em **Abrir projeção** e leve a aba para o projetor. Confira se o QR Code aparece.
3. Faça um teste rápido com um celular: entrar pelo QR Code, receber um cartão e ver a caixa se mover na projeção.
4. Clique em **Reiniciar demonstração** para começar a aula com a sessão limpa.

Deixe a aba do professor ou da projeção aberta durante toda a aula; ela mantém o serviço acordado.

## Se algo der errado

- **A página não carrega depois de 2 minutos:** veja em **Logs** se o serviço está publicando ou com erro. Como plano B, rode `npm run demo:internet` em um computador da equipe (instruções no [README](../README.md)).
- **"Reconectando ao computador" em todos os aparelhos:** o serviço reiniciou ou caiu. Recarregue o link do professor; a sessão começa do zero, com outro código, e os alunos entram de novo pelo QR Code.
- **Uma atividade não aparece no menu:** procure `Atividade rejeitada` em **Logs**; a mensagem diz o que corrigir no arquivo.

## Reproduzir o servidor do Render no computador

`npm run build:demo` e depois `npm run start:demo` rodam o mesmo servidor que o Render executa. Para usar uma chave fixa, defina `DEMO_TEACHER_KEY` antes; no PowerShell: `$env:DEMO_TEACHER_KEY = "teste"; npm run start:demo`.
