import { useEffect, useState } from 'react';
import {
  FileSpreadsheet, Plus, Search, ArrowRight, Clock, CheckCircle2,
  AlertTriangle, FileText, Eye, Pencil, PowerOff, Building2,
} from 'lucide-react';
import {
  supabase, type PriceTable, type Profile, type PriceTableItem,
  STATUS_LABELS, STATUS_COLORS, type TableStatus, COMPANIES, type Company,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatCurrency, formatPercent, deviationColor } from '@/lib/utils';
import PriceTableEditor from '@/pages/PriceTableEditor';

const COMPANY_COLORS: Record<Company, string> = {
  Brasil: 'bg-ocean-50 text-ocean-700',
  Ghana: 'bg-amber-50 text-amber-700',
  Nutsco: 'bg-purple-50 text-purple-700',
};

export default function PriceTablesPage() {
  const { profile } = useAuth();
  const [tables, setTables] = useState<(PriceTable & { creator?: Profile; items?: PriceTableItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'all'>('all');
  const [companyFilter, setCompanyFilter] = useState<Company | 'all'>('all');
  const [editingTable, setEditingTable] = useState<PriceTable | null>(null);
  const [viewingTable, setViewingTable] = useState<PriceTable | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<PriceTable | null>(null);

  useEffect(() => { fetchTables(); }, []);

  const fetchTables = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('price_tables')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) console.error(error);
    const tableData = (data as PriceTable[]) || [];

    const tableIds = tableData.map((t) => t.id);
    let itemsMap: Record<string, PriceTableItem[]> = {};
    if (tableIds.length > 0) {
      const { data: items } = await supabase
        .from('price_table_items')
        .select('*, product:products(*)')
        .in('price_table_id', tableIds);
      (items as PriceTableItem[] || []).forEach((item) => {
        if (!itemsMap[item.price_table_id]) itemsMap[item.price_table_id] = [];
        itemsMap[item.price_table_id].push(item);
      });
    }

    const creatorIds = [...new Set(tableData.map((t) => t.created_by))];
    let creatorMap: Record<string, Profile> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', creatorIds);
      (profiles as Profile[] || []).forEach((p) => { creatorMap[p.id] = p; });
    }

    setTables(tableData.map((t) => ({ ...t, creator: creatorMap[t.created_by], items: itemsMap[t.id] || [] })));
    setLoading(false);
  };

  const handleDeactivate = async (table: PriceTable) => {
    setDeactivating(table.id);
    await supabase.from('audit_log').insert({
      price_table_id: table.id,
      event_type: 'deactivated',
      user_id: profile?.id,
      user_name: profile?.full_name,
      user_email: profile?.email,
      details: { previous_status: 'publicada', company: table.company },
      user_agent: navigator.userAgent,
    });
    await supabase.from('price_tables').update({ status: 'desativada' }).eq('id', table.id);
    setDeactivating(null);
    setConfirmDeactivate(null);
    fetchTables();
  };

  const filtered = tables.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = t.name.toLowerCase().includes(q) || (t.company || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCompany = companyFilter === 'all' || t.company === companyFilter;
    return matchesSearch && matchesStatus && matchesCompany;
  });

  const newTableBase: PriceTable = {
    id: '', name: '', validity_start: '', validity_end: '',
    status: 'rascunho', created_by: '', usd_rate: 5.0, company: 'Brasil',
    created_at: '', updated_at: '',
  };

  if (editingTable) {
    return <PriceTableEditor table={editingTable} onClose={() => { setEditingTable(null); fetchTables(); }} />;
  }
  if (viewingTable) {
    return <PriceTableEditor table={viewingTable} readOnly onClose={() => setViewingTable(null)} />;
  }

  const statusOptions: { value: TableStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'rascunho', label: 'Rascunho' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'publicada', label: 'Publicada' },
    { value: 'rejeitada', label: 'Rejeitada' },
    { value: 'desativada', label: 'Desativada' },
    { value: 'expirada', label: 'Expirada' },
  ];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Tabelas de Preço</h1>
          <p className="text-slate-500 text-sm mt-0.5">Crie e gerencie tabelas de precificação para exportação</p>
        </div>
        <button onClick={() => setEditingTable(newTableBase)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nova Tabela
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          {/* Company filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCompanyFilter('all')}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                companyFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todas empresas
            </button>
            {COMPANIES.map((c) => (
              <button
                key={c}
                onClick={() => setCompanyFilter(c)}
                className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  companyFilter === c ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                statusFilter === opt.value
                  ? 'bg-ocean-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table list */}
      {loading ? (
        <div className="card p-8 text-center text-slate-400">
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
          Carregando tabelas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-1">Nenhuma tabela encontrada</p>
          <button onClick={() => setEditingTable(newTableBase)} className="text-ocean-600 font-semibold text-sm hover:underline">
            Criar primeira tabela
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((table) => {
            const items = table.items || [];
            const hasDeviations = items.some((i) => i.deviation_pct < 0);
            const maxDeviation = items.length > 0 ? Math.min(...items.map((i) => i.deviation_pct)) : 0;
            const canEdit = table.status === 'rascunho' && (profile?.id === table.created_by || profile?.role === 'admin');
            const canView = table.status !== 'rascunho' || profile?.id === table.created_by || profile?.role === 'admin';
            const canDeactivate = table.status === 'publicada' && (profile?.role === 'admin' || profile?.role === 'diretor' || profile?.role === 'superintendente');

            return (
              <div key={table.id} className={`card p-5 hover:shadow-md transition-shadow animate-slide-up ${table.status === 'desativada' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      table.status === 'publicada' ? 'bg-brand-50' :
                      table.status === 'pendente' ? 'bg-warning-50' :
                      table.status === 'rejeitada' ? 'bg-error-50' :
                      table.status === 'desativada' ? 'bg-slate-100' :
                      'bg-slate-100'
                    }`}>
                      {table.status === 'publicada' ? <CheckCircle2 className="w-5 h-5 text-brand-600" /> :
                       table.status === 'pendente' ? <Clock className="w-5 h-5 text-warning-600" /> :
                       table.status === 'rejeitada' ? <AlertTriangle className="w-5 h-5 text-error-600" /> :
                       table.status === 'desativada' ? <PowerOff className="w-5 h-5 text-slate-400" /> :
                       <FileText className="w-5 h-5 text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-base text-slate-800 truncate">{table.name}</h3>
                        <span className={`badge ${STATUS_COLORS[table.status]}`}>
                          {STATUS_LABELS[table.status]}
                        </span>
                        <span className={`badge flex items-center gap-1 ${COMPANY_COLORS[table.company as Company] || 'bg-slate-100 text-slate-600'}`}>
                          <Building2 className="w-3 h-3" />
                          {table.company}
                        </span>
                        {hasDeviations && (
                          <span className="badge bg-error-50 text-error-700">
                            <AlertTriangle className="w-3 h-3" />
                            Desvio {formatPercent(maxDeviation)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Vigência: {formatDate(table.validity_start)} — {formatDate(table.validity_end)}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>{items.length} produto{items.length !== 1 ? 's' : ''}</span>
                        {table.creator && <span>• Criado por {table.creator.full_name}</span>}
                        <span>• Atualizado em {formatDate(table.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canDeactivate && (
                      <button
                        onClick={() => setConfirmDeactivate(table)}
                        className="btn-secondary text-sm py-2 text-error-600 hover:bg-error-50 hover:border-error-200"
                      >
                        <PowerOff className="w-4 h-4" />
                        Desativar
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => setEditingTable(table)} className="btn-secondary text-sm py-2">
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                    )}
                    {canView && (
                      <button onClick={() => setViewingTable(table)} className="btn-secondary text-sm py-2">
                        <Eye className="w-4 h-4" />
                        Visualizar
                      </button>
                    )}
                  </div>
                </div>

                {/* Items preview */}
                {items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                            <th className="pb-2 font-semibold">Produto</th>
                            <th className="pb-2 font-semibold text-right">Custo</th>
                            <th className="pb-2 font-semibold text-right">Venda</th>
                            <th className="pb-2 font-semibold text-right">Desvio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.slice(0, 3).map((item) => (
                            <tr key={item.id} className="text-slate-600">
                              <td className="py-1.5">{item.product?.code} — {item.product?.description}</td>
                              <td className="py-1.5 text-right">{formatCurrency(item.cost)}</td>
                              <td className="py-1.5 text-right">{formatCurrency(item.sale_price)}</td>
                              <td className={`py-1.5 text-right font-semibold ${deviationColor(item.deviation_pct)}`}>
                                {formatPercent(item.deviation_pct)}
                              </td>
                            </tr>
                          ))}
                          {items.length > 3 && (
                            <tr>
                              <td colSpan={4} className="py-1.5 text-xs text-slate-400">
                                + {items.length - 3} outro(s) produto(s)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Deactivate confirm modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-error-50 flex items-center justify-center flex-shrink-0">
                <PowerOff className="w-5 h-5 text-error-600" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-800">Desativar tabela</h3>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Tem certeza que deseja desativar a tabela{' '}
              <span className="font-semibold text-slate-800">"{confirmDeactivate.name}"</span>?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              A tabela passará para o status <span className="font-semibold">Desativada</span> e não poderá mais ser usada como referência de preços para{' '}
              <span className={`font-semibold ${confirmDeactivate.company === 'Brasil' ? 'text-ocean-700' : confirmDeactivate.company === 'Ghana' ? 'text-amber-700' : 'text-purple-700'}`}>
                {confirmDeactivate.company}
              </span>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                disabled={deactivating === confirmDeactivate.id}
                onClick={() => handleDeactivate(confirmDeactivate)}
                className="flex-1 px-4 py-2.5 bg-error-600 hover:bg-error-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <PowerOff className="w-4 h-4" />
                {deactivating === confirmDeactivate.id ? 'Desativando...' : 'Confirmar desativação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
