# OrkaForm

Produto independente para criar formulários, publicar links e coletar respostas no Supabase do cliente.

## Rotas

- `/login` - login do administrador.
- `/` - painel de administração.
- `/form/:id` - formulário público publicado, no mesmo padrão do CRM.

## Configuração

Crie um `.env` baseado no `.env.example`:

```env
VITE_SUPABASE_URL=https://lwnqrzyfmepgwrqjxhms.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_7OyXUOCYJdRQKBdX4c6AUA_4pJj5-0G
```

O banco usa as tabelas `orka_forms`, `orka_form_questions` e `orka_form_responses`. As migrations em `supabase/migrations/` criam o schema, aplicam RLS e configuram o bucket público `briefing-assets` usado pelo builder original do CRM.

## Comandos

```bash
npm install
npm run dev
npm run build
```
