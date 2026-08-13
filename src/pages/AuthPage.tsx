import { useState } from 'react';
import { Mail, Lock, User, ChevronDown, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { type UserRole, ROLE_LABELS } from '@/lib/supabase';

function UsibrasMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2"  y="2"  width="14" height="14" rx="3.5" fill="#8DC63F" />
      <rect x="20" y="2"  width="14" height="14" rx="3.5" fill="white" opacity="0.85" />
      <rect x="2"  y="20" width="32" height="14" rx="3.5" fill="white" opacity="0.85" />
    </svg>
  );
}

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('comercial');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role);
      if (error) setError(error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Usibras brand */}
      <div className="hidden lg:flex lg:w-[52%] bg-brand-700 relative overflow-hidden flex-col">
        {/* Decorative shapes — echo the logo geometry */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-brand-600 rounded-[60px] opacity-60" />
          <div className="absolute -bottom-24 -left-16 w-96 h-96 bg-brand-800 rounded-[80px] opacity-50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/30 rounded-[120px] opacity-30" />
          {/* Lime green accent square */}
          <div className="absolute top-16 right-24 w-16 h-16 bg-ocean-500 rounded-2xl opacity-40" />
          <div className="absolute bottom-32 right-16 w-8 h-8 bg-ocean-400 rounded-xl opacity-50" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full p-14 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3.5">
            <UsibrasMark size={42} />
            <div>
              <span className="font-display font-black text-2xl lowercase tracking-tight leading-none">usibras</span>
              <p className="text-brand-300 text-[11px] font-bold uppercase tracking-widest leading-none mt-1">Portal de Preços</p>
            </div>
          </div>

          {/* Hero copy */}
          <div className="space-y-7">
            <h1 className="font-display text-5xl font-black leading-tight">
              Precificação<br />inteligente<br />para exportação
            </h1>
            <p className="text-brand-200 text-lg leading-relaxed max-w-sm">
              Tabelas de preço, cálculo automático de desvio, alçada de aprovação e rastreabilidade completa — em um só lugar.
            </p>
            <div className="flex gap-8 pt-2">
              <div>
                <div className="text-4xl font-black text-ocean-400">5</div>
                <div className="text-brand-300 text-sm font-semibold mt-0.5">Níveis de aprovação</div>
              </div>
              <div>
                <div className="text-4xl font-black text-ocean-400">100%</div>
                <div className="text-brand-300 text-sm font-semibold mt-0.5">Auditável</div>
              </div>
              <div>
                <div className="text-4xl font-black text-ocean-400">BRL/USD</div>
                <div className="text-brand-300 text-sm font-semibold mt-0.5">Dupla moeda</div>
              </div>
            </div>
          </div>

          <p className="text-brand-400 text-sm font-medium">© 2025 Usibras. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-cream-200">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <rect x="2"  y="2"  width="14" height="14" rx="3.5" fill="#8DC63F" />
                <rect x="20" y="2"  width="14" height="14" rx="3.5" fill="white" opacity="0.85" />
                <rect x="2"  y="20" width="32" height="14" rx="3.5" fill="white" opacity="0.85" />
              </svg>
            </div>
            <div>
              <span className="font-display font-black text-xl text-brand-700 lowercase tracking-tight">usibras</span>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Portal de Preços</p>
            </div>
          </div>

          <h2 className="font-display text-3xl font-black text-brand-700 mb-1">
            {mode === 'login' ? 'Bem-vindo' : 'Criar conta'}
          </h2>
          <p className="text-slate-500 mb-8 font-medium">
            {mode === 'login'
              ? 'Acesse o portal de precificação'
              : 'Preencha seus dados para começar'}
          </p>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Papel / Função</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRoleOpen(!roleOpen)}
                    className="input-field pl-3.5 pr-10 text-left flex items-center justify-between"
                  >
                    <span>{ROLE_LABELS[role]}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {roleOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-cream-300 rounded-lg shadow-lg overflow-hidden animate-scale-in">
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => { setRole(r); setRoleOpen(false); }}
                          className={`w-full px-3.5 py-2.5 text-left text-sm hover:bg-cream-100 transition-colors ${role === r ? 'bg-ocean-50 text-ocean-600 font-bold' : 'text-slate-700'}`}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Processando...' : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 font-medium">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button onClick={() => { setMode('signup'); setError(null); }} className="text-brand-600 font-bold hover:underline">
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={() => { setMode('login'); setError(null); }} className="text-brand-600 font-bold hover:underline">
                  Fazer login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
