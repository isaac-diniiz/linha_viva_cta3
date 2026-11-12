-- Linhas que o professor cria pelo botão "Criar linha" do painel da demonstração
-- (src/demo/lineStore.ts). Só o servidor Node acessa, com a chave secreta, que
-- ignora a RLS; navegador e identidades anônimas nunca leem nem gravam aqui.
-- A tabela guarda só texto escrito pelo professor: nenhum dado de estudante.

create table public.demo_lines (
  -- o mesmo identificador do arquivo atividades/<id>.json: "criada-" + tema
  id text primary key
    check (id ~ '^criada-[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 64),
  -- quem criou, para o servidor saber a autoria; nulo no uso local sem login
  owner_email text,
  -- a atividade no formato validado por src/demo/activity.ts (parseActivity)
  activity jsonb not null
    check (jsonb_typeof(activity) = 'object' and octet_length(activity::text) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.demo_lines is
  'Linhas criadas pelo professor no painel da demonstração; acesso só pelo servidor (chave secreta).';

alter table public.demo_lines enable row level security;
-- sem nenhuma política, e sem privilégios para as funções do navegador
revoke all on table public.demo_lines from anon, authenticated;
