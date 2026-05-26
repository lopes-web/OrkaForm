drop policy if exists "orka_form_responses_public_insert_published" on public.orka_form_responses;

create policy "orka_form_responses_public_insert_published"
on public.orka_form_responses
for insert
to anon, authenticated
with check (true);
