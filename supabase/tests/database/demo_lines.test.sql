begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_table('public', 'demo_lines', 'tabela das linhas criadas pelo professor existe');
select is(
  (select relrowsecurity from pg_class where oid = 'public.demo_lines'::regclass),
  true,
  'RLS ligada nas linhas criadas'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'demo_lines'),
  0,
  'sem políticas: só o servidor, com a chave secreta, acessa as linhas'
);

select lives_ok(
  $$insert into public.demo_lines (id, owner_email, activity)
    values ('criada-fases-da-escola', 'ana@escola.br', '{"titulo":"Fases da escola"}')$$,
  'o servidor grava uma linha criada'
);
select throws_ok(
  $$insert into public.demo_lines (id, activity) values ('ciclo-da-agua', '{}')$$,
  '23514', null, 'só ids criada-* entram, nunca atividades prontas'
);
select throws_ok(
  $$insert into public.demo_lines (id, activity) values ('criada-../segredo', '{}')$$,
  '23514', null, 'identificador com caminho é recusado'
);
select throws_ok(
  $$insert into public.demo_lines (id, activity) values ('criada-lista', '[]')$$,
  '23514', null, 'a atividade precisa ser um objeto JSON'
);
select throws_ok(
  $$insert into public.demo_lines (id, activity) values ('criada-fases-da-escola', '{}')$$,
  '23505', null, 'identificador repetido é recusado'
);
select is((select count(*)::integer from public.demo_lines), 1, 'só a linha válida ficou gravada');

select is(
  (select bool_or(has_table_privilege('anon', 'public.demo_lines', p))
   from unnest(array['select', 'insert', 'update', 'delete']) as p),
  false,
  'visitante sem login não tem nenhum acesso à tabela'
);
select is(
  (select bool_or(has_table_privilege('authenticated', 'public.demo_lines', p))
   from unnest(array['select', 'insert', 'update', 'delete']) as p),
  false,
  'professor logado no navegador também não tem acesso direto à tabela'
);

set local role authenticated;
select throws_ok('select * from public.demo_lines', '42501', null, 'o navegador não lê as linhas');
select throws_ok(
  $$insert into public.demo_lines (id, activity) values ('criada-intrusa', '{}')$$,
  '42501', null, 'o navegador não grava linhas'
);
reset role;

select * from finish();
rollback;
