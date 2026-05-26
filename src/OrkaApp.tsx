import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LogOut } from 'lucide-react';
import BriefingForm from './features/briefings/components/BriefingForm';
import BriefingsPanel from './features/briefings';
import { hasSupabaseConfig, supabase } from './lib/supabase';

type Route = { kind: 'admin' } | { kind: 'login' } | { kind: 'public'; id: string };

function parseRoute(): Route {
  const path = window.location.pathname;
  const publicMatch = path.match(/^\/(?:form|f)\/([^/]+)/);
  if (publicMatch) return { kind: 'public', id: decodeURIComponent(publicMatch[1]) };
  if (path === '/login') return { kind: 'login' };
  return { kind: 'admin' };
}

function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function OrkaApp() {
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

  if (route.kind === 'public') {
    return <BriefingForm formId={route.id} />;
  }

  if (!hasSupabaseConfig) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-3xl bg-[#111] border border-white/10 p-8 text-center">
          <img src="/logo/logo-orka.svg" alt="OrkaForm" className="w-56 mx-auto mb-6" />
          <p className="text-sm text-gray-400">Configuração do Supabase ausente.</p>
        </section>
      </main>
    );
  }

  if (loadingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </main>
    );
  }

  if (!session || route.kind === 'login') {
    return <LoginPage session={session} />;
  }

  return <AdminShell session={session} />;
}

function LoginPage({ session }: { session: Session | null }) {
  const [email, setEmail] = useState('admin@orkaform.com.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate('/');
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message || 'E-mail ou senha inválidos.');
      setLoading(false);
      return;
    }

    navigate('/');
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <section className="w-full max-w-[460px] rounded-[28px] bg-[#111]/90 border border-white/10 shadow-2xl p-8 sm:p-12">
        <img src="/logo/logo-orka.svg" alt="OrkaForm" className="w-64 max-w-full mx-auto mb-10" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">E-mail</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-white outline-none focus:border-[#DFA653] transition-colors"
              required
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-white outline-none focus:border-[#DFA653] transition-colors"
              required
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-[#111] font-bold flex items-center justify-center gap-2 hover:bg-[#DFA653] hover:text-white transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminShell({ session }: { session: Session }) {
  async function signOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0a]">
      <header className="h-14 px-5 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#111] flex items-center justify-between">
        <img src="/logo/logo-orka.svg" alt="OrkaForm" className="h-8 w-auto" />
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:inline">{session.user.email}</span>
          <button
            type="button"
            onClick={signOut}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <section className="h-[calc(100vh-56px)] overflow-hidden">
        <BriefingsPanel currentTeamId="orka" currentUserId={session.user.id} />
      </section>
    </main>
  );
}

