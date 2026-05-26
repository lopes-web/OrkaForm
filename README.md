# OrkaForm

Produto independente para criar formulários, publicar links e coletar respostas no Supabase do cliente.

## Rotas

- `/login` - login do administrador.
- `/` - painel de administração.
- `/f/:slug` - formulário público publicado.

## Configuração

Crie um `.env` baseado no `.env.example`:

```env
VITE_SUPABASE_URL=https://lwnqrzyfmepgwrqjxhms.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_7OyXUOCYJdRQKBdX4c6AUA_4pJj5-0G
```

O banco já usa as tabelas `orka_forms`, `orka_form_questions` e `orka_form_responses`. A migração em `supabase/migrations/20260526184349_add_orka_form_rls_policies.sql` publica as policies de RLS para o app.

## Comandos

```bash
npm install
npm run dev
npm run build
```
