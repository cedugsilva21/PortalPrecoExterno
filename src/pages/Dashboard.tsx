import { useEffect, useState } from 'react';
import {
  FileSpreadsheet, CheckSquare, TrendingDown, Package,
  Plus, ArrowRight, Clock, AlertTriangle, CheckCircle2, FileText,
} from 'lucide-react';
import { supabase, type PriceTable, type Profile, STATUS_LABELS, STATUS_COLORS } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatNumber } from '@/lib/utils';
import type { PageKey } from '@/components/Layout';

interface DashboardProps {
  onNavigate: (page: PageKey) => void;
}

interface DashboardStats {
  activeTables: number;
  pendingApprovals: number;
  deviationTables: number;
  totalProducts: number;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ activeTables: 0, pendingApprovals: 0, deviationTables: 0, totalProducts: 0 });
  const [recentTables, setRecentTables] = useState<(PriceTable & { creator?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tablesRes, productsRes, itemsRes, approvalsRes] = await Promise.all([
        supabase.from('price_tables').select('*').order('updated_at', { ascending: false }).limit(10),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('price_table_items').select('price_table_id, deviation_pct'),
        supabase.from('approvals').select('id').eq('status', 'pendente'),
      ]);

      const tables = tablesRes.data as PriceTable[] || [];
      const productCount = productsRes.count || 0;
      const allItems = itemsRes.data || [];
      const pendingCount = approvalsRes.data?.length || 0;

      // Tables with deviations
      const tableIdsWithDeviation = new Set(
        allItems
          .filter((item: { deviation_pct: number }) => item.deviation_pct < 0)
          .map((item: { price_table_id: string }) => item.price_table_id),
      );

      const activeCount = tables.filter((t) => t.status === 'publicada').length;

      setStats({
        activeTables: activeCount,
        pendingApprovals: pendingCount,
        deviationTables: tableIdsWithDeviation.size,
        totalProducts: productCount,
      });

      // Fetch creator profiles
      const creatorIds = [...new Set(tables.map((t) => t.created_by))];
      let creatorMap: Record<string, Profile> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', creatorIds);
        (profiles as Profile[] || []).forEach((p) => { creatorMap[p.id] = p; });
      }

      setRecentTables(tables.map((t) => ({ ...t, creator: creatorMap[t.created_by] })));
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: 'Tabelas Ativas', value: stats.activeTables, icon: FileSpreadsheet, color: 'brand', bg: 'bg-brand-50', text: 'text-brand-600', border: 'border-brand-100' },
    { label: 'Pendentes de Aprovação', value: stats.pendingApprovals, icon: CheckSquare, color: 'warning', bg: 'bg-warning-50', text: 'text-warning-600', border: 'border-warning-100' },
    { label: 'Em Desvio', value: stats.deviationTables, icon: TrendingDown, color: 'error', bg: 'bg-error-50', text: 'text-error-600', border: 'border-error-100' },
    { label: 'Total de Produtos', value: stats.totalProducts, icon: Package, color: 'ocean', bg: 'bg-ocean-50', text: 'text-ocean-600', border: 'border-ocean-100' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 to-brand-800 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10">
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-1">
            Olá, {profile?.full_name?.split(' ')[0] || 'usuário'}!
          </h1>
          <p className="text-slate-300 text-sm lg:text-base">
            Acompanhe suas tabelas de preço e aprovações pendentes.
          </p>
          <button
            onClick={() => onNavigate('tables')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur hover:bg-white/25 rounded-lg text-white font-semibold text-sm transition-all duration-150 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Nova Tabela de Preço
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`card p-5 ${card.border} animate-slide-up`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.text}`} />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-bold text-slate-800 font-display">
                {loading ? '—' : formatNumber(card.value, 0)}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent tables */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-display font-bold text-lg text-slate-800">Tabelas Recentes</h3>
          <button
            onClick={() => onNavigate('tables')}
            className="text-sm text-ocean-600 font-semibold hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
            Carregando tabelas...
          </div>
        ) : recentTables.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-1">Nenhuma tabela criada ainda</p>
            <button onClick={() => onNavigate('tables')} className="text-ocean-600 font-semibold text-sm hover:underline">
              Criar primeira tabela
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTables.map((table) => (
              <div key={table.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => onNavigate('tables')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    table.status === 'publicada' ? 'bg-brand-50' :
                    table.status === 'pendente' ? 'bg-warning-50' :
                    table.status === 'rejeitada' ? 'bg-error-50' :
                    'bg-slate-100'
                  }`}>
                    {table.status === 'publicada' ? <CheckCircle2 className="w-5 h-5 text-brand-600" /> :
                     table.status === 'pendente' ? <Clock className="w-5 h-5 text-warning-600" /> :
                     table.status === 'rejeitada' ? <AlertTriangle className="w-5 h-5 text-error-600" /> :
                     <FileSpreadsheet className="w-5 h-5 text-slate-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{table.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(table.validity_start)} — {formatDate(table.validity_end)}
                      {table.creator && ` • ${table.creator.full_name}`}
                    </p>
                  </div>
                </div>
                <span className={`badge ${STATUS_COLORS[table.status]} flex-shrink-0`}>
                  {STATUS_LABELS[table.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
