-- Nas políticas originais, as colunas sem qualificação dentro das subconsultas eram
-- resolvidas como colunas de public.sessions: em activities_teacher, "id" virava s.id
-- (estudante e projeção não liam a própria atividade); em items_for_session,
-- "activity_id" virava s.activity_id (quem lia qualquer sessão lia itens de todas as
-- atividades). As novas versões qualificam cada coluna pela tabela protegida.

drop policy activities_teacher on public.activities;
create policy activities_teacher on public.activities for select to authenticated
  using (activities.teacher_id = (select auth.uid()) or exists (
    select 1 from public.sessions s
    where s.activity_id = activities.id and public.can_read_session(s.id)
  ));

drop policy items_for_session on public.activity_items;
create policy items_for_session on public.activity_items for select to authenticated
  using (exists (
    select 1 from public.activities a
    where a.id = activity_items.activity_id and a.teacher_id = (select auth.uid())
  ) or exists (
    select 1 from public.sessions s
    where s.activity_id = activity_items.activity_id and public.can_read_session(s.id)
  ));
