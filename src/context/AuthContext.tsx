import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type Profile, type UserRole } from '@/lib/supabase';

interface AuthContextValue {
  profile: Profile | null;
  session: { user: { id: string; email?: string } } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session as AuthContextValue['session']);
      if (!data.session) setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess as AuthContextValue['session']);
      if (!sess) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) {
        console.error('Profile fetch error:', error);
      }
      setProfile(data as Profile | null);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid login credentials')) {
        return { error: 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.' };
      }
      return { error: error.message };
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('user already exists') || msg.includes('already registered')) {
        return { error: 'Este e-mail já está cadastrado. Faça login em vez de criar uma nova conta.' };
      }
      if (msg.includes('password should be at least')) {
        return { error: 'A senha deve ter no mínimo 6 caracteres.' };
      }
      return { error: error.message };
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role,
        email,
      });
      if (profileError) {
        if (profileError.code === '23505') {
          return { error: null };
        }
        return { error: profileError.message };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ profile, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
