import { type ReactNode, useState } from 'react';
import {
  LayoutDashboard, Package, FileSpreadsheet, CheckSquare, History,
  LogOut, Menu, X, ChevronDown, Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, type UserRole } from '@/lib/supabase';

export type PageKey = 'dashboard' | 'products' | 'tables' | 'approvals' | 'audit' | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',  label: 'Dashboard',        icon: LayoutDashboard, roles: ['comercial', 'gerente', 'diretor', 'superintendente', 'admin'] },
  { key: 'tables',     label: 'Tabelas de Preço',  icon: FileSpreadsheet, roles: ['comercial', 'gerente', 'diretor', 'superintendente', 'admin'] },
  { key: 'approvals',  label: 'Aprovações',        icon: CheckSquare,     roles: ['gerente', 'diretor', 'superintendente', 'admin'] },
  { key: 'products',   label: 'Produtos',          icon: Package,         roles: ['admin'] },
  { key: 'audit',      label: 'Auditoria',         icon: History,         roles: ['admin', 'gerente', 'diretor', 'superintendente'] },
  { key: 'settings',   label: 'Configurações',     icon: SettingsIcon,    roles: ['admin'] },
];

/** Usibras logo mark — three rounded rectangles mimicking the brand icon */
function UsibrasMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* top-left small rect — lime green */}
      <rect x="2"  y="2"  width="14" height="14" rx="3.5" fill="#8DC63F" />
      {/* top-right rect — dark green */}
      <rect x="20" y="2"  width="14" height="14" rx="3.5" fill="#E8EBDA" opacity="0.85" />
      {/* bottom-spanning rect — dark green */}
      <rect x="2"  y="20" width="32" height="14" rx="3.5" fill="#E8EBDA" opacity="0.85" />
    </svg>
  );
}

function UsibrasMarkDark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2"  y="2"  width="14" height="14" rx="3.5" fill="#8DC63F" />
      <rect x="20" y="2"  width="14" height="14" rx="3.5" fill="#456836" />
      <rect x="2"  y="20" width="32" height="14" rx="3.5" fill="#456836" />
    </svg>
  );
}

interface LayoutProps {
  children: ReactNode;
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!profile) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(profile.role));

  const handleNav = (key: PageKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-cream-200 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-brand-700 text-slate-300 fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-brand-800/60">
          <UsibrasMark size={34} />
          <div className="leading-none">
            <span className="font-display font-black text-white text-lg tracking-tight lowercase">usibras</span>
            <p className="text-brand-300 text-[10px] font-semibold uppercase tracking-widest leading-none mt-0.5">Portal de Preços</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-ocean-500 text-white shadow-sm'
                    : 'text-brand-200 hover:text-white hover:bg-brand-600/60'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-brand-800/60">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-ocean-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">{profile.full_name}</p>
              <p className="text-brand-300 text-xs truncate">{ROLE_LABELS[profile.role]}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-brand-300 hover:text-error-400 hover:bg-brand-600/60 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-brand-700 text-white h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <UsibrasMark size={30} />
          <span className="font-display font-black text-white text-lg lowercase tracking-tight">usibras</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 hover:bg-brand-600 rounded-lg transition-colors">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-brand-900/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute left-0 top-16 bottom-0 w-64 bg-brand-700 text-brand-200 flex flex-col animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex-1 py-4 px-3 space-y-0.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      active ? 'bg-ocean-500 text-white' : 'text-brand-200 hover:text-white hover:bg-brand-600/60'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-brand-800/60">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 bg-ocean-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{profile.full_name}</p>
                  <p className="text-brand-300 text-xs truncate">{ROLE_LABELS[profile.role]}</p>
                </div>
                <button onClick={signOut} className="p-2 text-brand-300 hover:text-error-400 rounded-lg">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Desktop top bar */}
        <header className="hidden lg:flex h-16 bg-white border-b border-cream-300 items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
          <h2 className="font-display font-black text-lg text-brand-700">
            {visibleItems.find((i) => i.key === currentPage)?.label}
          </h2>
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-cream-100 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-ocean-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-700">{profile.full_name}</p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-cream-300 rounded-xl shadow-lg z-20 animate-scale-in">
                  <div className="p-3 border-b border-cream-200">
                    <p className="text-sm font-bold text-slate-700">{profile.full_name}</p>
                    <p className="text-xs text-slate-500">{profile.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-ocean-50 text-ocean-600 text-xs font-bold rounded-full">
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </div>
                  <button
                    onClick={() => { signOut(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-error-600 hover:bg-error-50 transition-colors rounded-b-xl"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Mobile spacer */}
        <div className="lg:hidden h-16" />

        <main className="flex-1 p-4 lg:p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
