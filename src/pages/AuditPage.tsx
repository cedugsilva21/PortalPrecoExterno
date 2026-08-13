import { useEffect, useState, useMemo } from 'react';
import {
  History, Download, Search, X, Filter, Calendar, User as UserIcon,
  FileSpreadsheet, AlertCircle, ChevronRight,
} from 'lucide-react';
import { supabase, type AuditLogEntry, type PriceTable } from '@/lib/supabase';
import {
  formatDateTime, getAuditEventLabel, auditDetailsToString, generateXLSX,
} from '@/lib/utils';

const EVENT_TYPES = [
  'table_created',
  'product_added',
  'price_changed',
  'submitted_for_approval',
  'approved',
  'rejected',
  'published',
  'draft_saved',
];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    (async () => {
      const [logsRes, tablesRes] = await Promise.all([
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('price_tables').select('id, name').order('name'),
      ]);
      setLogs((logsRes.data as AuditLogEntry[]) || []);
      setTables((tablesRes.data as PriceTable[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((entry) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const detailsStr = auditDetailsToString(entry.details).toLowerCase();
        const matchesSearch =
          entry.user_name?.toLowerCase().includes(q) ||
          entry.user_email?.toLowerCase().includes(q) ||
          entry.event_type.toLowerCase().includes(q) ||
          detailsStr.includes(q);
        if (!matchesSearch) return false;
      }
      // Event filter
      if (eventFilter !== 'all' && entry.event_type !== eventFilter) return false;
      // Table filter
      if (tableFilter !== 'all' && entry.price_table_id !== tableFilter) return false;
      // Date filters
      if (dateFrom) {
        const entryDate = new Date(entry.created_at);
        const fromDate = new Date(dateFrom);
        if (entryDate < fromDate) return false;
      }
      if (dateTo) {
        const entryDate = new Date(entry.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (entryDate > toDate) return false;
      }
      return true;
    });
  }, [logs, search, eventFilter, tableFilter, dateFrom, dateTo]);

  const handleExport = () => {
    const headers = ['Data/Hora', 'Evento', 'Usuário', 'E-mail', 'Tabela', 'Detalhes', 'IP', 'Navegador'];
    const rows = filtered.map((entry) => {
      const tableName = tables.find((t) => t.id === entry.price_table_id)?.name || '—';
      return [
        formatDateTime(entry.created_at),
        getAuditEventLabel(entry.event_type),
        entry.user_name || '—',
        entry.user_email || '—',
        tableName,
        auditDetailsToString(entry.details),
        entry.ip_address || '—',
        entry.user_agent || '—',
      ];
    });
    const dateStr = new Date().toISOString().split('T')[0];
    generateXLSX(`auditoria_${dateStr}.xls`, headers, rows);
  };

  const hasActiveFilters = search || eventFilter !== 'all' || tableFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setEventFilter('all');
    setTableFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-800">Auditoria & Rastreio</h1>
          <p className="text-slate-500 text-sm mt-0.5">Histórico completo de todas as operações no portal</p>
        </div>
        <button onClick={handleExport} disabled={filtered.length === 0} className="btn-success">
          <Download className="w-4 h-4" />
          Exportar XLSX
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="w-4 h-4" />
          Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar usuário, evento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          {/* Event type */}
          <div>
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="input-field">
              <option value="all">Todos os eventos</option>
              {EVENT_TYPES.map((evt) => (
                <option key={evt} value={evt}>{getAuditEventLabel(evt)}</option>
              ))}
            </select>
          </div>
          {/* Table filter */}
          <div>
            <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="input-field">
              <option value="all">Todas as tabelas</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {/* Date from */}
          <div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field pl-10"
                placeholder="De"
              />
            </div>
          </div>
          {/* Date to */}
          <div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field pl-10"
                placeholder="Até"
              />
            </div>
          </div>
          {/* Clear */}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary text-sm py-2.5">
              <X className="w-4 h-4" />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Log table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <History className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
            Carregando auditoria...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Tabela</th>
                  <th className="px-4 py-3">Detalhes</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry) => {
                  const tableName = tables.find((t) => t.id === entry.price_table_id)?.name || '—';
                  const eventColor =
                    entry.event_type === 'approved' || entry.event_type === 'published' ? 'text-brand-600' :
                    entry.event_type === 'rejected' ? 'text-error-600' :
                    entry.event_type === 'submitted_for_approval' ? 'text-warning-600' :
                    'text-slate-600';
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${eventColor}`}>
                          {getAuditEventLabel(entry.event_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {entry.user_name && (
                            <div className="w-7 h-7 bg-ocean-100 rounded-full flex items-center justify-center text-ocean-700 text-xs font-bold flex-shrink-0">
                              {entry.user_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{entry.user_name || '—'}</p>
                            <p className="text-xs text-slate-400 truncate">{entry.user_email || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{tableName}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                        {auditDetailsToString(entry.details) || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className="w-4 h-4 text-slate-300 mx-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedEntry(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">Detalhes do Evento</h3>
              <button onClick={() => setSelectedEntry(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Evento</p>
                  <p className="text-sm font-semibold text-slate-700">{getAuditEventLabel(selectedEntry.event_type)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Data/Hora</p>
                  <p className="text-sm text-slate-700">{formatDateTime(selectedEntry.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Usuário</p>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{selectedEntry.user_name || '—'}</p>
                      <p className="text-xs text-slate-400">{selectedEntry.user_email || ''}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Tabela</p>
                  <p className="text-sm text-slate-700">
                    {tables.find((t) => t.id === selectedEntry.price_table_id)?.name || '—'}
                  </p>
                </div>
              </div>

              {selectedEntry.details && Object.keys(selectedEntry.details).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Detalhes</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    {Object.entries(selectedEntry.details).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <span className="font-semibold text-slate-600 min-w-0 flex-shrink-0">{key}:</span>
                        <span className="text-slate-600 break-all">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Navegador</p>
                <p className="text-xs text-slate-500 break-all">{selectedEntry.user_agent || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
