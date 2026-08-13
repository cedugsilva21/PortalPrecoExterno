import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthPage from '@/pages/AuthPage';
import Layout, { type PageKey } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ProductsPage from '@/pages/ProductsPage';
import PriceTablesPage from '@/pages/PriceTablesPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import AuditPage from '@/pages/AuditPage';
import SettingsPage from '@/pages/SettingsPage';

function AppContent() {
  const { profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-ocean-200 border-t-ocean-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AuthPage />;
  }

  // Guard: redirect to dashboard if user tries to access a page they don't have access to
  const roleAccess: Record<PageKey, string[]> = {
    dashboard: ['comercial', 'gerente', 'diretor', 'superintendente', 'admin'],
    tables: ['comercial', 'gerente', 'diretor', 'superintendente', 'admin'],
    approvals: ['gerente', 'diretor', 'superintendente', 'admin'],
    products: ['admin'],
    audit: ['admin', 'gerente', 'diretor', 'superintendente'],
    settings: ['admin'],
  };

  const effectivePage = roleAccess[currentPage].includes(profile.role) ? currentPage : 'dashboard';

  return (
    <Layout currentPage={effectivePage} onNavigate={setCurrentPage}>
      {effectivePage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
      {effectivePage === 'tables' && <PriceTablesPage />}
      {effectivePage === 'approvals' && <ApprovalsPage />}
      {effectivePage === 'products' && <ProductsPage />}
      {effectivePage === 'audit' && <AuditPage />}
      {effectivePage === 'settings' && <SettingsPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
