create extension if not exists pgcrypto;

create table if not exists public.orka_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Novo Formulário',
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  welcome_title text not null default 'Sua operação comercial está pronta para crescer?',
  welcome_description text not null default '10 perguntas · Leva menos de 3 minutos · Diagnóstico enviado em até 24h',
  success_title text not null default 'Obrigado! Suas respostas estão com a gente.',
  success_description text not null default 'Nossa equipe vai analisar suas respostas e entrar em contato em até 24 horas pelo WhatsApp.',
  theme jsonb not null default '{"textMode":"auto","buttonColor":"#DFA653","backgroundColor":"#0a0a0a","backgroundImage":""}'::jsonb check (jsonb_typeof(theme) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orka_form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.orka_forms(id) on delete cascade,
  position integer not null check (position > 0),
  type text not null default 'multiple' check (type in ('short_text', 'long_text', 'single', 'multiple', 'email', 'phone', 'date')),
  title text not null default 'Sua questão aqui.',
  description text not null default '',
  required boolean not null default false,
  options jsonb not null default '[{"key":"A","label":"Opção A","score":0},{"key":"B","label":"Opção B","score":0}]'::jsonb check (jsonb_typeof(options) = 'array'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orka_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.orka_forms(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  contact jsonb not null default '{}'::jsonb check (jsonb_typeof(contact) = 'object'),
  score integer not null default 0,
  status text not null default 'new',
  user_agent text,
  ip_hint text,
  created_at timestamptz not null default now()
);

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

