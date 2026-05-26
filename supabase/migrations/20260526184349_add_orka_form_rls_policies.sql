grant usage on schema public to anon, authenticated;

grant select on table public.orka_forms to anon, authenticated;
grant insert, update, delete on table public.orka_forms to authenticated;

grant select on table public.orka_form_questions to anon, authenticated;
grant insert, update, delete on table public.orka_form_questions to authenticated;

grant insert on table public.orka_form_responses to anon, authenticated;
grant select, update, delete on table public.orka_form_responses to authenticated;

alter table public.orka_forms enable row level security;
alter table public.orka_form_questions enable row level security;
alter table public.orka_form_responses enable row level security;

drop policy if exists "orka_forms_public_read_published" on public.orka_forms;
drop policy if exists "orka_forms_authenticated_insert" on public.orka_forms;
drop policy if exists "orka_forms_authenticated_update" on public.orka_forms;
drop policy if exists "orka_forms_authenticated_delete" on public.orka_forms;

create policy "orka_forms_public_read_published"
on public.orka_forms
for select
to anon, authenticated
using (status = 'published' or auth.role() = 'authenticated');

create policy "orka_forms_authenticated_insert"
on public.orka_forms
for insert
to authenticated
with check (true);

create policy "orka_forms_authenticated_update"
on public.orka_forms
for update
to authenticated
using (true)
with check (true);

create policy "orka_forms_authenticated_delete"
on public.orka_forms
for delete
to authenticated
using (true);

drop policy if exists "orka_form_questions_public_read_published" on public.orka_form_questions;
drop policy if exists "orka_form_questions_authenticated_insert" on public.orka_form_questions;
drop policy if exists "orka_form_questions_authenticated_update" on public.orka_form_questions;
drop policy if exists "orka_form_questions_authenticated_delete" on public.orka_form_questions;

create policy "orka_form_questions_public_read_published"
on public.orka_form_questions
for select
to anon, authenticated
using (
  auth.role() = 'authenticated'
  or exists (
    select 1
    from public.orka_forms forms
    where forms.id = orka_form_questions.form_id
      and forms.status = 'published'
  )
);

create policy "orka_form_questions_authenticated_insert"
on public.orka_form_questions
for insert
to authenticated
with check (true);

create policy "orka_form_questions_authenticated_update"
on public.orka_form_questions
for update
to authenticated
using (true)
with check (true);

create policy "orka_form_questions_authenticated_delete"
on public.orka_form_questions
for delete
to authenticated
using (true);

drop policy if exists "orka_form_responses_public_insert_published" on public.orka_form_responses;
drop policy if exists "orka_form_responses_authenticated_read" on public.orka_form_responses;
drop policy if exists "orka_form_responses_authenticated_update" on public.orka_form_responses;
drop policy if exists "orka_form_responses_authenticated_delete" on public.orka_form_responses;

create policy "orka_form_responses_public_insert_published"
on public.orka_form_responses
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  or exists (
    select 1
    from public.orka_forms forms
    where forms.id = orka_form_responses.form_id
      and forms.status = 'published'
  )
);

create policy "orka_form_responses_authenticated_read"
on public.orka_form_responses
for select
to authenticated
using (true);

create policy "orka_form_responses_authenticated_update"
on public.orka_form_responses
for update
to authenticated
using (true)
with check (true);

create policy "orka_form_responses_authenticated_delete"
on public.orka_form_responses
for delete
to authenticated
using (true);

create index if not exists idx_orka_forms_status_slug on public.orka_forms (status, slug);
create index if not exists idx_orka_form_questions_form_position on public.orka_form_questions (form_id, position);
create index if not exists idx_orka_form_responses_form_created on public.orka_form_responses (form_id, created_at desc);

create or replace function public.orka_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orka_forms_set_updated_at on public.orka_forms;
create trigger orka_forms_set_updated_at
before update on public.orka_forms
for each row execute function public.orka_set_updated_at();

drop trigger if exists orka_form_questions_set_updated_at on public.orka_form_questions;
create trigger orka_form_questions_set_updated_at
before update on public.orka_form_questions
for each row execute function public.orka_set_updated_at();

