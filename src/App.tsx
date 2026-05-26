import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  LogOut,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import {
  adaptForm,
  adaptQuestion,
  adaptResponse,
  defaultTheme,
  formToRow,
  type FormQuestion,
  type FormResponse,
  type FormStatus,
  type OrkaForm,
  type QuestionOption,
  type QuestionType,
  questionToRow,
} from './types';

type Route = { kind: 'admin' } | { kind: 'login' } | { kind: 'public'; slug: string };
type AdminTab = 'builder' | 'responses';
type AnswerValue = string | string[];

const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: 'short_text', label: 'Texto curto' },
  { value: 'long_text', label: 'Texto longo' },
  { value: 'single', label: 'Escolha única' },
  { value: 'multiple', label: 'Múltipla escolha' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'date', label: 'Data' },
];

const statusLabels: Record<FormStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
};

function parseRoute(): Route {
  const path = window.location.pathname;
  const publicMatch = path.match(/^\/(?:f|form)\/([^/]+)/);

  if (publicMatch) {
    return { kind: 'public', slug: decodeURIComponent(publicMatch[1]) };
  }

  if (path === '/login') {
    return { kind: 'login' };
  }

  return { kind: 'admin' };
}

function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

function newOption(index: number): QuestionOption {
  return {
    key: String.fromCharCode(65 + index),
    label: `Opção ${String.fromCharCode(65 + index)}`,
    score: 0,
  };
}

function publicUrl(slug: string): string {
  return `${window.location.origin}/f/${slug}`;
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!hasSupabaseConfig) {
    return <MissingConfig />;
  }

  if (route.kind === 'public') {
    return <PublicForm slug={route.slug} />;
  }

  if (loadingSession) {
    return <FullScreenLoader />;
  }

  if (!session || route.kind === 'login') {
    return <LoginPage session={session} />;
  }

  return <AdminApp session={session} />;
}

function MissingConfig() {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <img src="/logo/logo-orka.svg" alt="OrkaForm" />
        <h1>Configuração pendente</h1>
        <p>Preencha `VITE_SUPABASE_ANON_KEY` no `.env` para conectar este app ao Supabase do cliente.</p>
      </section>
    </main>
  );
}

function FullScreenLoader() {
  return (
    <main className="loader-screen">
      <Loader2 className="spin" size={28} />
    </main>
  );
}

function LoginPage({ session }: { session: Session | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('E-mail ou senha inválidos.');
      setLoading(false);
      return;
    }

    navigate('/');
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <img className="login-logo" src="/logo/logo-orka.svg" alt="OrkaForm" />
        <div>
          <span className="eyebrow">Administrador</span>
          <h1>Entre para criar e gerenciar formulários.</h1>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="admin@empresa.com" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" required />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminApp({ session }: { session: Session }) {
  const [forms, setForms] = useState<OrkaForm[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [tab, setTab] = useState<AdminTab>('builder');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const selectedForm = useMemo(() => forms.find((form) => form.id === selectedId) || null, [forms, selectedId]);

  useEffect(() => {
    loadForms();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadQuestions(selectedId);
    loadResponses(selectedId);
  }, [selectedId]);

  async function loadForms() {
    setLoading(true);
    const { data, error } = await supabase.from('orka_forms').select('*').order('created_at', { ascending: false });

    if (error) {
      setNotice('Não foi possível carregar os formulários.');
      setLoading(false);
      return;
    }

    const nextForms = (data || []).map((row) => adaptForm(row));
    setForms(nextForms);
    setSelectedId((current) => current || nextForms[0]?.id || '');
    setLoading(false);
  }

  async function loadQuestions(formId: string) {
    const { data, error } = await supabase
      .from('orka_form_questions')
      .select('*')
      .eq('form_id', formId)
      .order('position', { ascending: true });

    if (error) {
      setNotice('Não foi possível carregar as perguntas.');
      return;
    }

    setQuestions((data || []).map((row) => adaptQuestion(row)));
  }

  async function loadResponses(formId: string) {
    const { data, error } = await supabase
      .from('orka_form_responses')
      .select('*')
      .eq('form_id', formId)
      .order('created_at', { ascending: false });

    if (error) {
      setNotice('Não foi possível carregar as respostas.');
      return;
    }

    setResponses((data || []).map((row) => adaptResponse(row)));
  }

  function updateSelectedForm(updater: (form: OrkaForm) => OrkaForm) {
    setForms((current) => current.map((form) => (form.id === selectedId ? updater(form) : form)));
  }

  function updateQuestion(questionId: string, updater: (question: FormQuestion) => FormQuestion) {
    setQuestions((current) => current.map((question) => (question.id === questionId ? updater(question) : question)));
  }

  async function createForm() {
    const suffix = Date.now().toString(36);
    const { data, error } = await supabase
      .from('orka_forms')
      .insert({
        name: 'Novo formulário',
        slug: `novo-formulario-${suffix}`,
        status: 'draft',
        welcome_title: 'Vamos começar?',
        welcome_description: 'Responda algumas perguntas rápidas para avançarmos com clareza.',
        success_title: 'Tudo certo! Suas respostas foram enviadas.',
        success_description: 'Em breve entraremos em contato com os próximos passos.',
        theme: defaultTheme,
      })
      .select('*')
      .single();

    if (error || !data) {
      setNotice('Não foi possível criar o formulário.');
      return;
    }

    const form = adaptForm(data);
    setForms((current) => [form, ...current]);
    setSelectedId(form.id);
    setTab('builder');

    await supabase.from('orka_form_questions').insert({
      form_id: form.id,
      position: 1,
      type: 'short_text',
      title: 'Qual é o seu nome?',
      description: '',
      required: true,
      options: [],
      settings: {},
    });
    await loadQuestions(form.id);
  }

  async function saveForm() {
    if (!selectedForm) return;

    setSaving(true);
    const rows = questions.map((question, index) => questionToRow(question, index + 1));
    const { error: formError } = await supabase.from('orka_forms').update(formToRow(selectedForm)).eq('id', selectedForm.id);
    const questionResult = rows.length ? await supabase.from('orka_form_questions').upsert(rows) : { error: null };

    if (formError || questionResult.error) {
      setNotice('Não foi possível salvar. Confira se o slug não está duplicado.');
      setSaving(false);
      return;
    }

    setNotice('Alterações salvas.');
    await loadForms();
    await loadQuestions(selectedForm.id);
    setSaving(false);
  }

  async function deleteForm(formId: string) {
    const confirmed = window.confirm('Excluir este formulário e todas as respostas?');
    if (!confirmed) return;

    const { error } = await supabase.from('orka_forms').delete().eq('id', formId);

    if (error) {
      setNotice('Não foi possível excluir o formulário.');
      return;
    }

    setForms((current) => current.filter((form) => form.id !== formId));
    if (selectedId === formId) {
      setSelectedId(forms.find((form) => form.id !== formId)?.id || '');
    }
  }

  async function addQuestion(type: QuestionType = 'short_text') {
    if (!selectedForm) return;

    const options = type === 'single' || type === 'multiple' ? [newOption(0), newOption(1)] : [];
    const { data, error } = await supabase
      .from('orka_form_questions')
      .insert({
        form_id: selectedForm.id,
        position: questions.length + 1,
        type,
        title: 'Nova pergunta',
        description: '',
        required: false,
        options,
        settings: {},
      })
      .select('*')
      .single();

    if (error || !data) {
      setNotice('Não foi possível adicionar a pergunta.');
      return;
    }

    setQuestions((current) => [...current, adaptQuestion(data)]);
  }

  async function removeQuestion(questionId: string) {
    const { error } = await supabase.from('orka_form_questions').delete().eq('id', questionId);

    if (error) {
      setNotice('Não foi possível remover a pergunta.');
      return;
    }

    setQuestions((current) => current.filter((question) => question.id !== questionId));
  }

  async function copySelectedUrl() {
    if (!selectedForm) return;
    await navigator.clipboard.writeText(publicUrl(selectedForm.slug));
    setNotice('Link copiado.');
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  if (loading) {
    return <FullScreenLoader />;
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <img src="/logo/logo-orka.svg" alt="OrkaForm" />
        </div>
        <button className="new-form-button" onClick={createForm}>
          <Plus size={18} />
          Novo formulário
        </button>
        <div className="form-list">
          {forms.map((form) => (
            <button key={form.id} className={form.id === selectedId ? 'form-list-item active' : 'form-list-item'} onClick={() => setSelectedId(form.id)}>
              <span>{form.name}</span>
              <small>{statusLabels[form.status]}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <small>{session.user.email}</small>
          <button onClick={signOut} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        {!selectedForm ? (
          <EmptyState onCreate={createForm} />
        ) : (
          <>
            <header className="workspace-header">
              <div>
                <span className="eyebrow">Admin</span>
                <h1>{selectedForm.name}</h1>
              </div>
              <div className="header-actions">
                <button className="icon-button" onClick={copySelectedUrl} title="Copiar link">
                  <Copy size={18} />
                </button>
                <button className="icon-button" onClick={() => window.open(publicUrl(selectedForm.slug), '_blank')} title="Abrir formulário">
                  <ExternalLink size={18} />
                </button>
                <button className="primary-button compact" onClick={saveForm} disabled={saving}>
                  {saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
                  Salvar
                </button>
              </div>
            </header>

            {notice && (
              <button className="notice" onClick={() => setNotice('')}>
                {notice}
              </button>
            )}

            <div className="tabs">
              <button className={tab === 'builder' ? 'active' : ''} onClick={() => setTab('builder')}>
                <Eye size={16} />
                Builder
              </button>
              <button className={tab === 'responses' ? 'active' : ''} onClick={() => setTab('responses')}>
                <BarChart3 size={16} />
                Respostas ({responses.length})
              </button>
            </div>

            {tab === 'builder' ? (
              <Builder
                form={selectedForm}
                questions={questions}
                onFormChange={updateSelectedForm}
                onQuestionChange={updateQuestion}
                onAddQuestion={addQuestion}
                onRemoveQuestion={removeQuestion}
                onDeleteForm={() => deleteForm(selectedForm.id)}
              />
            ) : (
              <Responses responses={responses} questions={questions} onRefresh={() => loadResponses(selectedForm.id)} />
            )}
          </>
        )}
      </section>
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="empty-state">
      <img src="/logo/logo-orka.svg" alt="" />
      <h1>Crie o primeiro formulário</h1>
      <p>Monte perguntas, publique o link e acompanhe as respostas em tempo real.</p>
      <button className="primary-button" onClick={onCreate}>
        <Plus size={18} />
        Novo formulário
      </button>
    </section>
  );
}

function Builder({
  form,
  questions,
  onFormChange,
  onQuestionChange,
  onAddQuestion,
  onRemoveQuestion,
  onDeleteForm,
}: {
  form: OrkaForm;
  questions: FormQuestion[];
  onFormChange: (updater: (form: OrkaForm) => OrkaForm) => void;
  onQuestionChange: (questionId: string, updater: (question: FormQuestion) => FormQuestion) => void;
  onAddQuestion: (type?: QuestionType) => void;
  onRemoveQuestion: (questionId: string) => void;
  onDeleteForm: () => void;
}) {
  return (
    <div className="builder-grid">
      <section className="editor-panel">
        <div className="panel-section">
          <h2>Identidade</h2>
          <label>
            Nome interno
            <input value={form.name} onChange={(event) => onFormChange((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Slug público
            <input value={form.slug} onChange={(event) => onFormChange((current) => ({ ...current, slug: slugify(event.target.value) }))} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => onFormChange((current) => ({ ...current, status: event.target.value as FormStatus }))}>
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
        </div>

        <div className="panel-section">
          <h2>Tela inicial</h2>
          <label>
            Título
            <input value={form.welcomeTitle} onChange={(event) => onFormChange((current) => ({ ...current, welcomeTitle: event.target.value }))} />
          </label>
          <label>
            Descrição
            <textarea value={form.welcomeDescription} onChange={(event) => onFormChange((current) => ({ ...current, welcomeDescription: event.target.value }))} />
          </label>
        </div>

        <div className="panel-section">
          <h2>Aparência</h2>
          <div className="inline-fields">
            <label>
              Fundo
              <input type="color" value={form.theme.backgroundColor} onChange={(event) => onFormChange((current) => ({ ...current, theme: { ...current.theme, backgroundColor: event.target.value } }))} />
            </label>
            <label>
              Botão
              <input type="color" value={form.theme.buttonColor} onChange={(event) => onFormChange((current) => ({ ...current, theme: { ...current.theme, buttonColor: event.target.value } }))} />
            </label>
          </div>
          <label>
            Imagem de fundo
            <input value={form.theme.backgroundImage} onChange={(event) => onFormChange((current) => ({ ...current, theme: { ...current.theme, backgroundImage: event.target.value } }))} placeholder="https://..." />
          </label>
          <label>
            Texto
            <select value={form.theme.textMode} onChange={(event) => onFormChange((current) => ({ ...current, theme: { ...current.theme, textMode: event.target.value as OrkaForm['theme']['textMode'] } }))}>
              <option value="auto">Automático</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
        </div>

        <div className="panel-section">
          <h2>Tela final</h2>
          <label>
            Título
            <input value={form.successTitle} onChange={(event) => onFormChange((current) => ({ ...current, successTitle: event.target.value }))} />
          </label>
          <label>
            Descrição
            <textarea value={form.successDescription} onChange={(event) => onFormChange((current) => ({ ...current, successDescription: event.target.value }))} />
          </label>
        </div>

        <button className="danger-button" onClick={onDeleteForm}>
          <Trash2 size={17} />
          Excluir formulário
        </button>
      </section>

      <section className="questions-panel">
        <div className="questions-header">
          <div>
            <span className="eyebrow">Perguntas</span>
            <h2>{questions.length} campos</h2>
          </div>
          <select
            onChange={(event) => {
              onAddQuestion(event.target.value as QuestionType);
              event.currentTarget.value = '';
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Adicionar
            </option>
            {questionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="question-list">
          {questions.map((question, index) => (
            <article className="question-card" key={question.id}>
              <div className="question-card-header">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <select
                  value={question.type}
                  onChange={(event) => {
                    const nextType = event.target.value as QuestionType;
                    const needsOptions = nextType === 'single' || nextType === 'multiple';
                    onQuestionChange(question.id, (current) => ({
                      ...current,
                      type: nextType,
                      options: needsOptions ? (current.options.length ? current.options : [newOption(0), newOption(1)]) : [],
                    }));
                  }}
                >
                  {questionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <button className="ghost-icon" onClick={() => onRemoveQuestion(question.id)} title="Remover pergunta">
                  <Trash2 size={16} />
                </button>
              </div>
              <label>
                Pergunta
                <input value={question.title} onChange={(event) => onQuestionChange(question.id, (current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Descrição
                <input value={question.description} onChange={(event) => onQuestionChange(question.id, (current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={question.required} onChange={(event) => onQuestionChange(question.id, (current) => ({ ...current, required: event.target.checked }))} />
                Obrigatória
              </label>
              {(question.type === 'single' || question.type === 'multiple') && (
                <OptionsEditor question={question} onQuestionChange={onQuestionChange} />
              )}
            </article>
          ))}
        </div>
      </section>

      <PublicPreview form={form} questions={questions} />
    </div>
  );
}

function OptionsEditor({
  question,
  onQuestionChange,
}: {
  question: FormQuestion;
  onQuestionChange: (questionId: string, updater: (question: FormQuestion) => FormQuestion) => void;
}) {
  return (
    <div className="options-editor">
      {question.options.map((option, index) => (
        <div className="option-row" key={option.key}>
          <span>{option.key}</span>
          <input
            value={option.label}
            onChange={(event) =>
              onQuestionChange(question.id, (current) => ({
                ...current,
                options: current.options.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)),
              }))
            }
          />
          <input
            className="score-input"
            type="number"
            value={option.score || 0}
            onChange={(event) =>
              onQuestionChange(question.id, (current) => ({
                ...current,
                options: current.options.map((item, itemIndex) => (itemIndex === index ? { ...item, score: Number(event.target.value) } : item)),
              }))
            }
          />
        </div>
      ))}
      <button
        className="ghost-button"
        onClick={() => onQuestionChange(question.id, (current) => ({ ...current, options: [...current.options, newOption(current.options.length)] }))}
      >
        <Plus size={16} />
        Opção
      </button>
    </div>
  );
}

function PublicPreview({ form, questions }: { form: OrkaForm; questions: FormQuestion[] }) {
  const firstQuestion = questions[0];

  return (
    <aside className="preview-panel">
      <div className="phone-preview" style={{ background: form.theme.backgroundColor }}>
        {form.theme.backgroundImage && <img className="phone-bg" src={form.theme.backgroundImage} alt="" />}
        <div className="phone-content">
          <img src="/logo/logo-orka.svg" alt="OrkaForm" />
          <span>{form.welcomeDescription}</span>
          <h2>{firstQuestion?.title || form.welcomeTitle}</h2>
          {firstQuestion?.description && <p>{firstQuestion.description}</p>}
          <button style={{ background: form.theme.buttonColor }}>Continuar</button>
        </div>
      </div>
    </aside>
  );
}

function Responses({ responses, questions, onRefresh }: { responses: FormResponse[]; questions: FormQuestion[]; onRefresh: () => void }) {
  function exportCsv() {
    const header = ['Data', ...questions.map((question) => question.title)];
    const rows = responses.map((response) => [
      new Date(response.createdAt).toLocaleString('pt-BR'),
      ...questions.map((question) => formatAnswer(response.answers[question.id])),
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'respostas-orkaform.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="responses-panel">
      <div className="responses-toolbar">
        <button className="ghost-button" onClick={onRefresh}>
          Atualizar
        </button>
        <button className="primary-button compact" onClick={exportCsv} disabled={!responses.length}>
          <Download size={17} />
          CSV
        </button>
      </div>
      {!responses.length ? (
        <div className="empty-inline">Nenhuma resposta recebida ainda.</div>
      ) : (
        <div className="response-list">
          {responses.map((response) => (
            <article className="response-card" key={response.id}>
              <div className="response-card-header">
                <strong>{new Date(response.createdAt).toLocaleString('pt-BR')}</strong>
                <span>{response.status}</span>
              </div>
              <dl>
                {questions.map((question) => (
                  <div key={question.id}>
                    <dt>{question.title}</dt>
                    <dd>{formatAnswer(response.answers[question.id]) || '-'}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PublicForm({ slug }: { slug: string }) {
  const [form, setForm] = useState<OrkaForm | null>(null);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [step, setStep] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const question = questions[step] || null;
  const textClass = form?.theme.textMode === 'dark' ? 'dark-text' : 'light-text';

  useEffect(() => {
    loadPublicForm();
  }, [slug]);

  async function loadPublicForm() {
    setLoading(true);
    const { data: formData, error: formError } = await supabase
      .from('orka_forms')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (formError || !formData) {
      setLoading(false);
      return;
    }

    const nextForm = adaptForm(formData);
    const { data: questionData } = await supabase
      .from('orka_form_questions')
      .select('*')
      .eq('form_id', nextForm.id)
      .order('position', { ascending: true });

    setForm(nextForm);
    setQuestions((questionData || []).map((row) => adaptQuestion(row)));
    setLoading(false);
  }

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setError('');
  }

  function toggleMulti(questionId: string, value: string) {
    const current = answers[questionId];
    const list = Array.isArray(current) ? current : [];
    const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    setAnswer(questionId, next);
  }

  function canContinue(): boolean {
    if (!question || !question.required) return true;
    const answer = answers[question.id];
    if (Array.isArray(answer)) return answer.length > 0;
    return Boolean(answer);
  }

  async function next() {
    if (step === -1) {
      setStep(0);
      return;
    }

    if (!canContinue()) {
      setError('Responda esta pergunta para continuar.');
      return;
    }

    if (step < questions.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    await submit();
  }

  async function submit() {
    if (!form) return;
    setSubmitting(true);

    const answerPayload = questions.reduce<Record<string, unknown>>((acc, item) => {
      acc[item.id] = {
        question: item.title,
        type: item.type,
        value: answers[item.id] || '',
      };
      return acc;
    }, {});

    const contact = questions.reduce<Record<string, unknown>>((acc, item) => {
      if (item.type === 'email' || item.type === 'phone') {
        acc[item.type] = answers[item.id] || '';
      }
      return acc;
    }, {});

    const score = questions.reduce((total, item) => {
      const answer = answers[item.id];
      const values = Array.isArray(answer) ? answer : [answer];
      return (
        total +
        item.options
          .filter((option) => values.includes(option.label))
          .reduce((sum, option) => sum + (option.score || 0), 0)
      );
    }, 0);

    const { error: submitError } = await supabase.from('orka_form_responses').insert({
      form_id: form.id,
      answers: answerPayload,
      contact,
      score,
      status: 'new',
      user_agent: navigator.userAgent,
    });

    if (submitError) {
      setError('Não foi possível enviar. Tente novamente.');
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  }

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!form) {
    return (
      <main className="public-shell">
        <section className="public-card light-text">
          <img src="/logo/logo-orka.svg" alt="OrkaForm" />
          <h1>Formulário indisponível</h1>
          <p>Este link não está publicado ou não existe mais.</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="public-shell"
      style={{
        backgroundColor: form.theme.backgroundColor,
        backgroundImage: form.theme.backgroundImage ? `linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,.18)), url(${form.theme.backgroundImage})` : undefined,
      }}
    >
      <section className={`public-card ${textClass}`}>
        <img src="/logo/logo-orka.svg" alt="OrkaForm" />
        {done ? (
          <div className="success-state">
            <CheckCircle2 size={42} />
            <h1>{form.successTitle}</h1>
            <p>{form.successDescription}</p>
          </div>
        ) : step === -1 ? (
          <>
            <span className="eyebrow">OrkaForm</span>
            <h1>{form.welcomeTitle}</h1>
            <p>{form.welcomeDescription}</p>
            <button className="public-button" style={{ background: form.theme.buttonColor }} onClick={next}>
              Começar
              <Send size={18} />
            </button>
          </>
        ) : (
          question && (
            <>
              <button className="back-button" onClick={() => setStep((current) => Math.max(-1, current - 1))}>
                <ArrowLeft size={18} />
              </button>
              <span className="progress-label">
                {step + 1} de {questions.length}
              </span>
              <h1>{question.title}</h1>
              {question.description && <p>{question.description}</p>}
              <QuestionInput question={question} value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} onToggle={toggleMulti} />
              {error && <p className="public-error">{error}</p>}
              <button className="public-button" style={{ background: form.theme.buttonColor }} onClick={next} disabled={submitting}>
                {submitting ? <Loader2 className="spin" size={18} /> : step === questions.length - 1 ? 'Enviar' : 'Continuar'}
              </button>
            </>
          )
        )}
      </section>
    </main>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  onToggle,
}: {
  question: FormQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  onToggle: (questionId: string, value: string) => void;
}) {
  if (question.type === 'long_text') {
    return <textarea className="public-input" value={String(value || '')} onChange={(event) => onChange(event.target.value)} autoFocus />;
  }

  if (question.type === 'single') {
    return (
      <div className="choice-list">
        {question.options.map((option) => (
          <button key={option.key} className={value === option.label ? 'selected' : ''} onClick={() => onChange(option.label)}>
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'multiple') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="choice-list">
        {question.options.map((option) => (
          <button key={option.key} className={selected.includes(option.label) ? 'selected' : ''} onClick={() => onToggle(question.id, option.label)}>
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  const inputType = question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : question.type === 'date' ? 'date' : 'text';
  return <input className="public-input" type={inputType} value={String(value || '')} onChange={(event) => onChange(event.target.value)} autoFocus />;
}

function formatAnswer(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return formatAnswer((value as { value: unknown }).value);
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
