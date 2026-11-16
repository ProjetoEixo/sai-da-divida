-- V2 aditiva: não altera entradas, gastos, dividas ou outras tabelas antigas.
begin;
create table if not exists public.sdd_documents(
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data)='object' and data->>'schema'='2'),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create table if not exists public.sdd_operations(
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 primary key(user_id,operation_id)
);
alter table public.sdd_documents enable row level security;
alter table public.sdd_operations enable row level security;
drop policy if exists own_document on public.sdd_documents;
create policy own_document on public.sdd_documents for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_operations on public.sdd_operations;
create policy own_operations on public.sdd_operations for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.sdd_documents,public.sdd_operations from anon,authenticated;
grant select on public.sdd_documents to authenticated;
create or replace function public.sdd_save_document(p_data jsonb,p_expected bigint,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_revision bigint;
begin
 if uid is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 if p_expected is null or p_expected<0 or p_operation is null or p_data is null or octet_length(p_data::text)>5000000 or p_data->>'schema' is distinct from '2' then raise exception 'Documento inválido'; end if;
 if exists(select 1 from unnest(array['accounts','entries','cards','debts','goals','assets','scenarios','audit']) k where jsonb_typeof(p_data->k) is distinct from 'array') then raise exception 'Estrutura inválida'; end if;
 -- Serializa gravações do mesmo usuário, inclusive a criação inicial.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select revision into current_revision from public.sdd_documents where user_id=uid;
 if exists(select 1 from public.sdd_operations where user_id=uid and operation_id=p_operation) then return jsonb_build_object('revision',current_revision); end if;
 if coalesce(current_revision,0)<>p_expected then raise exception 'Dados alterados por outra sessão' using errcode='40001'; end if;
 insert into public.sdd_documents(user_id,data,revision) values(uid,p_data,1)
 on conflict(user_id) do update set data=excluded.data,revision=public.sdd_documents.revision+1,updated_at=now()
 returning revision into current_revision;
 insert into public.sdd_operations values(uid,p_operation);
 return jsonb_build_object('revision',current_revision);
end $$;
revoke all on function public.sdd_save_document(jsonb,bigint,uuid) from public,anon;
grant execute on function public.sdd_save_document(jsonb,bigint,uuid) to authenticated;
create or replace function public.sdd_delete_own_account()
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 delete from auth.users where id=uid;
end $$;
revoke all on function public.sdd_delete_own_account() from public,anon;
grant execute on function public.sdd_delete_own_account() to authenticated;
commit;
