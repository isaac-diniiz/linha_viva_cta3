create table public.activities (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 120),
  instruction text not null check (length(trim(instruction)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.activity_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 300)
);

create table public.activity_answers (
  item_id uuid primary key references public.activity_items(id) on delete cascade,
  ordinal integer not null check (ordinal > 0)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  teacher_id uuid not null references auth.users(id),
  code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'paused', 'ended')),
  version integer not null default 0 check (version >= 0),
  confirmed_order uuid[] not null default '{}',
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day')
);

create table public.session_members (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  item_id uuid not null references public.activity_items(id),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id),
  unique (session_id, item_id)
);

create table public.session_projection_keys (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  secret uuid not null default gen_random_uuid()
);

create table public.session_viewers (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  primary key (session_id, user_id)
);

create index on public.activity_items(activity_id);
create index on public.sessions(activity_id);
create index on public.session_members(user_id);

alter table public.activities enable row level security;
alter table public.activity_items enable row level security;
alter table public.activity_answers enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.session_projection_keys enable row level security;
alter table public.session_viewers enable row level security;

create function public.can_read_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id
      and (s.teacher_id = (select auth.uid()) or exists (
        select 1 from public.session_members m
        where m.session_id = s.id and m.user_id = (select auth.uid())
      ) or exists (
        select 1 from public.session_viewers v
        where v.session_id = s.id and v.user_id = (select auth.uid())
      ))
  );
$$;

create policy activities_teacher on public.activities for select to authenticated
  using (teacher_id = (select auth.uid()) or exists (
    select 1 from public.sessions s where s.activity_id = id and public.can_read_session(s.id)
  ));
create policy items_for_session on public.activity_items for select to authenticated
  using (exists (
    select 1 from public.activities a where a.id = activity_id and a.teacher_id = (select auth.uid())
  ) or exists (
    select 1 from public.sessions s where s.activity_id = activity_id and public.can_read_session(s.id)
  ));
create policy answers_teacher on public.activity_answers for select to authenticated
  using (exists (
    select 1 from public.activity_items i join public.activities a on a.id = i.activity_id
    where i.id = item_id and a.teacher_id = (select auth.uid())
  ));
create policy sessions_participants on public.sessions for select to authenticated
  using (public.can_read_session(id));
create policy members_participants on public.session_members for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.sessions s where s.id = session_id and s.teacher_id = (select auth.uid())
  ));
create policy viewers_self on public.session_viewers for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.activities, public.activity_items, public.activity_answers, public.sessions, public.session_members, public.session_projection_keys, public.session_viewers from anon, authenticated;
grant select on public.activities, public.activity_items, public.activity_answers, public.sessions, public.session_members to authenticated;
grant select on public.session_viewers to authenticated;
revoke all on function public.can_read_session(uuid) from public;
grant execute on function public.can_read_session(uuid) to authenticated;

create function public.create_activity(p_title text, p_instruction text, p_labels text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_activity uuid;
  v_item uuid;
  v_label text;
  v_index integer := 0;
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Acesso exclusivo do professor' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 120
     or length(trim(coalesce(p_instruction, ''))) not between 1 and 500
     or coalesce(array_length(p_labels, 1), 0) not between 3 and 40 then
    raise exception 'Atividade inválida' using errcode = '22023';
  end if;
  insert into public.activities (teacher_id, title, instruction)
  values ((select auth.uid()), trim(p_title), trim(p_instruction)) returning id into v_activity;
  foreach v_label in array p_labels loop
    if length(trim(coalesce(v_label, ''))) not between 1 and 300 then
      raise exception 'Item inválido' using errcode = '22023';
    end if;
    v_index := v_index + 1;
    insert into public.activity_items (activity_id, label)
    values (v_activity, trim(v_label)) returning id into v_item;
    insert into public.activity_answers (item_id, ordinal) values (v_item, v_index);
  end loop;
  return v_activity;
end;
$$;

create function public.create_session(p_activity_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session uuid;
  v_code text;
  v_attempt integer;
begin
  if not exists (
    select 1 from public.activities where id = p_activity_id and teacher_id = (select auth.uid())
  ) then raise exception 'Atividade indisponível' using errcode = '42501'; end if;
  for v_attempt in 1..5 loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.sessions (activity_id, teacher_id, code)
      values (p_activity_id, (select auth.uid()), v_code) returning id into v_session;
      insert into public.session_projection_keys (session_id) values (v_session);
      return v_session;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'Não foi possível gerar código' using errcode = '23505';
end;
$$;

create function public.get_projection_key(p_session_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_secret uuid;
begin
  select k.secret into v_secret from public.session_projection_keys k
    join public.sessions s on s.id = k.session_id
    where s.id = p_session_id and s.teacher_id = (select auth.uid());
  if v_secret is null then raise exception 'Projeção indisponível' using errcode = '42501'; end if;
  return v_secret::text;
end;
$$;

create function public.join_projection(p_session_id uuid, p_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Identidade de projeção inválida' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.session_projection_keys k join public.sessions s on s.id = k.session_id
    where k.session_id = p_session_id and k.secret::text = p_secret and s.expires_at > now()
  ) then raise exception 'Chave de projeção inválida' using errcode = '42501'; end if;
  if exists (select 1 from public.session_members m where m.user_id = (select auth.uid())) then
    raise exception 'Identidade já usada por estudante' using errcode = '42501';
  end if;
  insert into public.session_viewers (session_id, user_id) values (p_session_id, (select auth.uid()))
    on conflict do nothing;
  return p_session_id;
end;
$$;

create function public.join_session(p_code text)
returns table(session_id uuid, item_id uuid) language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions%rowtype;
  v_item uuid;
begin
  if (select auth.uid()) is null or not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Acesso exclusivo do estudante' using errcode = '42501';
  end if;
  if exists (select 1 from public.session_viewers v where v.user_id = (select auth.uid())) then
    raise exception 'Projeção sem permissão para receber item' using errcode = '42501';
  end if;
  select * into v_session from public.sessions s
    where s.code = upper(trim(p_code)) and s.status <> 'ended' and s.expires_at > now()
    for update;
  if not found then raise exception 'Código inválido ou sessão encerrada' using errcode = '22023'; end if;
  select m.item_id into v_item from public.session_members m
    where m.session_id = v_session.id and m.user_id = (select auth.uid());
  if v_item is null then
    select i.id into v_item from public.activity_items i
      where i.activity_id = v_session.activity_id
        and not exists (select 1 from public.session_members m where m.session_id = v_session.id and m.item_id = i.id)
      order by i.id limit 1;
    if v_item is null then raise exception 'Sessão cheia' using errcode = '22023'; end if;
    insert into public.session_members (session_id, user_id, item_id)
      values (v_session.id, (select auth.uid()), v_item);
  end if;
  return query select v_session.id, v_item;
end;
$$;

create function public.place_item(p_session_id uuid, p_x double precision, p_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions%rowtype;
  v_item uuid;
  v_order uuid[];
  v_index integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found or v_session.status <> 'active' or v_session.expires_at <= now() then
    raise exception 'Sessão indisponível' using errcode = '22023';
  end if;
  select m.item_id into v_item from public.session_members m
    where m.session_id = p_session_id and m.user_id = (select auth.uid());
  if v_item is null then raise exception 'Item não autorizado' using errcode = '42501'; end if;
  if v_session.version <> p_expected_version then
    raise exception 'Versão desatualizada' using errcode = '40001';
  end if;
  if p_x is null or p_x < 0 or p_x > 1 then
    raise exception 'Posição inválida' using errcode = '22023';
  end if;
  select coalesce(array_agg(id order by ord), '{}'::uuid[]) into v_order
  from unnest(v_session.confirmed_order) with ordinality as t(id, ord) where id <> v_item;
  v_index := floor(p_x * (coalesce(array_length(v_order, 1), 0) + 1));
  v_order := coalesce(v_order[1:v_index], '{}'::uuid[]) || array[v_item] || coalesce(v_order[v_index+1:], '{}'::uuid[]);
  update public.sessions set confirmed_order = v_order, version = version + 1
    where id = p_session_id returning version into v_index;
  return v_index;
end;
$$;

create function public.set_session_status(p_session_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('active', 'paused', 'ended') then raise exception 'Estado inválido' using errcode = '22023'; end if;
  update public.sessions set status = p_status, version = version + 1
  where id = p_session_id and teacher_id = (select auth.uid()) and status <> 'ended';
  if not found then raise exception 'Sessão indisponível' using errcode = '42501'; end if;
end;
$$;

create function public.reveal_reference(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.sessions set revealed = true, version = version + 1
  where id = p_session_id and teacher_id = (select auth.uid());
  if not found then raise exception 'Sessão indisponível' using errcode = '42501'; end if;
end;
$$;

create function public.get_reference(p_session_id uuid)
returns table(item_id uuid, ordinal integer) language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.sessions s
    where s.id = p_session_id and (s.teacher_id = (select auth.uid()) or (s.revealed and public.can_read_session(s.id)))
  ) then raise exception 'Referência indisponível' using errcode = '42501'; end if;
  return query
    select ans.item_id, ans.ordinal from public.activity_answers ans
    join public.activity_items i on i.id = ans.item_id
    join public.sessions s on s.activity_id = i.activity_id
    where s.id = p_session_id order by ans.ordinal;
end;
$$;

create function public.delete_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_activity uuid;
begin
  delete from public.sessions where id = p_session_id and teacher_id = (select auth.uid())
    returning activity_id into v_activity;
  if not found then raise exception 'Sessão indisponível' using errcode = '42501'; end if;
  delete from public.activities a where a.id = v_activity and a.teacher_id = (select auth.uid())
    and not exists (select 1 from public.sessions s where s.activity_id = v_activity);
end;
$$;

revoke all on function public.create_activity(text,text,text[]), public.create_session(uuid), public.join_session(text), public.place_item(uuid,double precision,integer), public.set_session_status(uuid,text), public.reveal_reference(uuid), public.get_reference(uuid), public.delete_session(uuid), public.get_projection_key(uuid), public.join_projection(uuid,text) from public;
grant execute on function public.create_activity(text,text,text[]), public.create_session(uuid), public.join_session(text), public.place_item(uuid,double precision,integer), public.set_session_status(uuid,text), public.reveal_reference(uuid), public.get_reference(uuid), public.delete_session(uuid), public.get_projection_key(uuid), public.join_projection(uuid,text) to authenticated;

create policy session_drag_read on realtime.messages for select to authenticated
using (extension = 'broadcast' and (
  exists (
    select 1 from public.session_members m
    where m.user_id = (select auth.uid())
      and realtime.topic() = 'drag:' || m.session_id::text || ':' || m.item_id::text
  ) or exists (
    select 1 from public.sessions s join public.activity_items i on i.activity_id = s.activity_id
    where s.teacher_id = (select auth.uid())
      and realtime.topic() = 'drag:' || s.id::text || ':' || i.id::text
  ) or exists (
    select 1 from public.session_viewers v join public.sessions s on s.id = v.session_id
      join public.activity_items i on i.activity_id = s.activity_id
    where v.user_id = (select auth.uid())
      and realtime.topic() = 'drag:' || s.id::text || ':' || i.id::text
  )
));
create policy session_drag_write on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and exists (
  select 1 from public.session_members m join public.sessions s on s.id = m.session_id
  where m.user_id = (select auth.uid()) and s.status = 'active'
    and realtime.topic() = 'drag:' || m.session_id::text || ':' || m.item_id::text
));

alter publication supabase_realtime add table public.sessions, public.session_members;
