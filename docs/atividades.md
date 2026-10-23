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
