# Atividades

Cada atividade da Linha Viva é um arquivo de dados em [`atividades/`](../atividades/). Para adicionar ou corrigir conteúdo, não é preciso alterar o código: basta editar os arquivos e reiniciar o servidor.

## Atividades cadastradas

| Disciplina        | Atividade                         | Série  | Cartões                                                                   |
| ----------------- | --------------------------------- | ------ | ------------------------------------------------------------------------- |
| Ciências          | Ciclo da água (tema inicial)      | 5º ano | 3, entregues em sequência; depois do terceiro aluno, a sequência recomeça |
| Ciências          | Metamorfose da borboleta          | 3º ano | 4                                                                         |
| Ciências          | Planetas do Sistema Solar         | 9º ano | 8                                                                         |
| História          | Linha do tempo do Brasil          | 8º ano | 10 acontecimentos sem data; os anos só aparecem em **Revelar referência** |
| Língua Portuguesa | Narrativa Viva: o girassol de Lia | 4º ano | 6 trechos de uma história                                                 |

As séries foram propostas a partir da BNCC e a Narrativa Viva é um rascunho; os dois aguardam revisão da equipe.

No painel do professor, o menu **Tema da atividade** agrupa as atividades por disciplina e mostra a série de cada uma. Nas atividades embaralhadas, o professor recebe um cartão e os alunos recebem os demais antes de qualquer repetição.

## Criar uma linha pelo painel do professor

Sem editar arquivos, o professor monta uma linha no botão **Criar linha**, abaixo do menu **Tema da atividade**. Isso só é possível antes de iniciar; depois, use **Reiniciar demonstração**.

| Campo do formulário                    | Regra                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tema da linha**                      | Obrigatório, até 120 caracteres. Vira o título da atividade.                                                                                                |
| **Ponta da esquerda** e **da direita** | Obrigatórios, até 40 caracteres cada, como "Mais antigo" e "Mais recente".                                                                                  |
| **Cartões**                            | De 3 a 40, na ordem correta, da esquerda para a direita. Até 60 caracteres cada, sem texto repetido. **Enter** começa o próximo cartão; ↑ ↓ ✕ reordenam e removem. |
| **Embaralhar os cartões**              | Ligado por padrão. Entrega os cartões em ordem aleatória e guarda o cartão do professor, como nas atividades de História.                                   |
| **Disciplina, série, instrução**       | Em "Mais opções", opcionais. Sem disciplina e série, a linha entra no grupo **Minhas linhas**, série **Livre**. Sem instrução, o texto cita as duas pontas. |

Ao criar, o servidor valida o formulário com as mesmas regras dos arquivos, guarda a linha (veja "Onde a linha fica guardada"), inclui no menu e já a seleciona para a turma conectada. Se já existir uma linha com o mesmo tema, o id ganha `-2`, `-3` e assim por diante. Sem Supabase, cada linha criada é um arquivo comum e também pode ser editada à mão, como qualquer outra atividade.

### Editar e apagar linhas criadas

As linhas criadas pelo painel aparecem em **Suas linhas criadas**, abaixo do botão **Criar linha**, só para o professor.

- **Editar** abre o mesmo formulário já preenchido. Ao salvar, a linha mantém o id e o arquivo (`criada-<tema>.json`), mesmo que o tema mude; se ela é a que a turma está usando, os alunos recebem os cartões novos. Salvar sem mudar nada apenas fecha o formulário.
- **Apagar** pede confirmação ("Sim, apagar") e não pode ser desfeito: a linha sai do menu e é apagada de onde estava guardada. Se estava em uso, a turma volta ao tema inicial.
- As duas ações só valem antes de iniciar a atividade e só para linhas criadas no painel; as atividades prontas do repositório nunca são editadas nem apagadas por ele.

### Onde a linha fica guardada

- **Com `SUPABASE_URL` e `SUPABASE_SECRET_KEY`** (a mesma configuração das contas de professor), no Supabase, na tabela `demo_lines`, junto com o e-mail de quem a criou. Ela sobrevive a reinícios e publicações. É preciso aplicar antes a migração `supabase/migrations/20261111000100_demo_lines.sql` (passo a passo em [hospedagem.md](hospedagem.md)). As linhas criadas ficam disponíveis no menu de todos os professores desse servidor, como as atividades prontas. Se o Supabase recusar a gravação, o painel mostra o motivo e a linha não é criada, editada nem apagada.
- **Sem Supabase** (uso local e testes), em `atividades/criada-<tema>.json`. Se o servidor não conseguir gravar o arquivo, a linha vale só até o reinício e o terminal avisa. Em hospedagem gratuita, como o Render, o disco é temporário: copie o arquivo para o repositório se quiser mantê-la.

O servidor mostra, na partida, `Linhas criadas: supabase` ou `Linhas criadas: arquivos`.

## Cadastrar uma atividade

Crie o arquivo `atividades/<id>.json`, com o nome igual ao `id` da atividade:

```json
{
  "id": "ciclo-da-agua",
  "disciplina": "Ciências",
  "serie": "5º ano",
  "titulo": "Ciclo da água",
  "instrucao": "Organize as etapas do ciclo da água na sequência correta.",
  "eixo": { "inicio": "Início", "fim": "Fim" },
  "embaralhar": false,
  "reservarCartaoDoProfessor": false,
  "cartoes": [
    { "id": "evaporacao", "texto": "Evaporação", "ordem": 1 },
    { "id": "condensacao", "texto": "Condensação", "ordem": 2 },
    { "id": "precipitacao", "texto": "Precipitação", "ordem": 3 }
  ]
}
```

| Campo                       | Regra                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                        | Letras minúsculas sem acento, números e hífens, como `ciclo-da-agua`. Vale também para o `id` de cada cartão.                                                      |
| `disciplina`, `serie`       | Texto de até 40 caracteres. A disciplina define o grupo no menu; a série é mostrada ao lado do título.                                                             |
| `titulo`, `instrucao`       | Até 120 e 500 caracteres. A instrução aparece para os alunos e na projeção.                                                                                        |
| `eixo`                      | Rótulos das pontas da linha, `inicio` e `fim`, com até 40 caracteres cada.                                                                                         |
| `cartoes`                   | De 3 a 40 cartões. Cada `texto` tem até **60 caracteres**; `ordem` vai de 1 até o número de cartões, sem repetição nem lacunas. Textos e ids não podem se repetir. |
| `ano`                       | Opcional, em cada cartão. Número exibido entre parênteses só na revelação da referência.                                                                           |
| `embaralhar`                | Opcional, `false` por padrão. Entrega os cartões em ordem aleatória, para a ordem de entrada não revelar a resposta.                                               |
| `reservarCartaoDoProfessor` | Opcional, `false` por padrão. Guarda o cartão do professor até os outros cartões serem entregues.                                                                  |

Campos fora dessa lista são recusados, para pegar erros de digitação.

## Quando o arquivo tem um problema

O servidor sobe com as atividades válidas e lista no terminal cada erro do arquivo rejeitado, por exemplo:

```
Atividade rejeitada (fracoes.json):
  - cartoes[1].ordem: ordem 1 repetida.
  - cartoes[2].texto: use no máximo 60 caracteres.
```

`cartoes[1]` é o segundo cartão da lista, porque a contagem começa em 0. `npm test` também verifica todos os arquivos da pasta, então um arquivo inválido faz a CI falhar antes de chegar à escola.

## Variáveis do servidor

- `LINHA_VIVA_TEMA`: `id` da atividade aberta ao iniciar. Sem ela, abre o Ciclo da água. No PowerShell: `$env:LINHA_VIVA_TEMA = "historia"; npm run demo:internet`.
- `LINHA_VIVA_ATIVIDADES`: outra pasta de atividades, no lugar de `atividades/`.
