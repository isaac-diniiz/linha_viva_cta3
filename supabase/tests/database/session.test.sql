begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(39);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'teacher@example.com', '', now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', null, '', now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', null, '', now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', null, '', now()),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'outro@example.com', '', now());

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.create_activity('Ciclo da água', 'Ordene as etapas', array['Evaporação','Condensação','Precipitação'])$$, 'professor cria atividade');
select is((select count(*)::integer from public.activities), 1, 'atividade criada');
select is((select count(*)::integer from public.activity_answers), 3, 'respostas ficam em tabela separada');
select public.create_session((select id from public.activities limit 1));
select is((select status from public.sessions limit 1), 'waiting', 'sessão aguarda início do professor');
select set_config('app.test_code', (select code from public.sessions limit 1), true);
select set_config('app.test_session', (select id::text from public.sessions limit 1), true);
select set_config('app.projection_key', public.get_projection_key(current_setting('app.test_session')::uuid), true);

select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","is_anonymous":false}', true);
select lives_ok($$select public.create_activity('Outra turma', 'Ordene', array['Outro 1','Outro 2','Outro 3'])$$, 'outro professor cria atividade');
select is((select count(*)::integer from public.activity_items), 3, 'professor lê só os itens das próprias atividades');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","is_anonymous":true}', true);
select lives_ok(format('select public.join_session(%L)', current_setting('app.test_code')), 'primeiro aluno entra');
select is((select count(*)::integer from public.session_members), 1, 'aluno recebeu um item');
select is((select count(*)::integer from public.activity_answers), 0, 'aluno não lê a resposta');
select is((select title from public.activities), 'Ciclo da água', 'aluno lê somente a atividade da própria sessão');
select is((select count(*)::integer from public.activity_items), 3, 'aluno não lê itens de atividades de outros professores');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
select public.join_session(current_setting('app.test_code'));
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
select is((select count(distinct item_id)::integer from public.session_members), 2, 'atribuições são únicas');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
select throws_ok(format('select public.get_projection_key(%L)', current_setting('app.test_session')), '42501', null, 'aluno não obtém chave da projeção');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":true}', true);
select throws_ok(format('select public.join_projection(%L, %L)', current_setting('app.test_session'), 'chave-incorreta'), '42501', null, 'chave incorreta não abre projeção');
select lives_ok(format('select public.join_projection(%L, %L)', current_setting('app.test_session'), current_setting('app.projection_key')), 'projeção entra com chave própria');
select is((select count(*)::integer from public.sessions where id = current_setting('app.test_session')::uuid), 1, 'projeção lê a sessão');
select is((select title from public.activities), 'Ciclo da água', 'projeção lê o título da atividade projetada');
select is((select count(*)::integer from public.activity_items), 3, 'projeção lê só os itens da atividade projetada');
select is((select count(*)::integer from public.session_members), 0, 'projeção não lê identificadores dos alunos');
select throws_ok(format('select public.join_session(%L)', current_setting('app.test_code')), '42501', null, 'projeção não vira estudante');
select throws_ok(format('select public.get_reference(%L)', current_setting('app.test_session')), '42501', null, 'projeção não lê referência antes da revelação');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
select throws_ok(format('select * from public.get_reference(%L)', current_setting('app.test_session')), '42501', null, 'aluno não obtém referência antes da revelação');
select throws_ok(format('update public.sessions set status = %L where id = %L', 'paused', current_setting('app.test_session')), '42501', null, 'aluno não altera a sessão diretamente');
select throws_ok(format('select public.place_item(%L, 0.5, 0)', current_setting('app.test_session')), '22023', null, 'aluno não confirma antes do início');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
select public.set_session_status(current_setting('app.test_session')::uuid, 'active');
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","is_anonymous":true}', true);
select set_config('realtime.topic', 'drag:' || current_setting('app.test_session') || ':' || (select id::text from public.activity_items limit 1), true);
select throws_ok($$insert into realtime.messages(topic, extension) values (current_setting('realtime.topic'), 'broadcast')$$, '42501', null, 'projeção não transmite prévia');
select throws_ok(format('select public.place_item(%L, 0.5, 1)', current_setting('app.test_session')), '42501', null, 'projeção não confirma item ativo');
select throws_ok(format('select public.set_session_status(%L, %L)', current_setting('app.test_session'), 'paused'), '42501', null, 'projeção não pausa sessão');
select throws_ok(format('select public.reveal_reference(%L)', current_setting('app.test_session')), '42501', null, 'projeção não revela referência');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
select set_config('realtime.topic', 'drag:' || current_setting('app.test_session') || ':' || (select item_id::text from public.session_members where user_id = (select auth.uid())), true);
select lives_ok($$insert into realtime.messages(topic, extension) values (current_setting('realtime.topic'), 'broadcast')$$, 'aluno transmite somente no canal do próprio item');
select set_config('realtime.topic', 'drag:' || current_setting('app.test_session') || ':' || (select id::text from public.activity_items where id <> (select item_id from public.session_members where user_id = (select auth.uid())) limit 1), true);
select throws_ok($$insert into realtime.messages(topic, extension) values (current_setting('realtime.topic'), 'broadcast')$$, '42501', null, 'aluno não transmite no item de outro');
select throws_ok(format('select public.place_item(%L, 0.5, 999)', current_setting('app.test_session')), '40001', null, 'versão desatualizada rejeitada');
select lives_ok(format('select public.place_item(%L, 0.5, 1)', current_setting('app.test_session')), 'dono confirma seu item');
select is((select version from public.sessions where id = current_setting('app.test_session')::uuid), 2, 'confirmação incrementa versão');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
select public.set_session_status(current_setting('app.test_session')::uuid, 'paused');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
select throws_ok(format('select public.place_item(%L, 0.5, 4)', current_setting('app.test_session')), '22023', null, 'pausa impede confirmação');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
select public.set_session_status(current_setting('app.test_session')::uuid, 'ended');
select lives_ok(format('select public.reveal_reference(%L)', current_setting('app.test_session')), 'professor revela referência depois de encerrar');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::integer from public.get_reference(current_setting('app.test_session')::uuid)), 3, 'referência aparece depois da revelação');
select is((select count(*)::integer from public.activity_answers), 0, 'tabela de respostas permanece fechada ao aluno');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}', true);
select public.delete_session(current_setting('app.test_session')::uuid);
select is((select count(*)::integer from public.sessions), 0, 'professor apaga a sessão');
select is((select count(*)::integer from public.activities), 0, 'atividade temporária sem sessão também é apagada');

select * from finish();
rollback;
