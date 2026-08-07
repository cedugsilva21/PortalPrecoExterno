import { useEffect, useState } from 'react';
import {
  CheckSquare, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, FileSpreadsheet, TrendingDown, X,
} from 'lucide-react';
import {
  supabase, type PriceTable, type PriceTableItem, type Approval,
  type ApprovalLevel, type Profile, LEVEL_LABELS, LEVEL_ORDER,
  getRequiredLevels, getHighestLevel, isDeviationBlocked,
} from '@/lib/supabase';
import { useApprovalSettings } from '@/hooks/useApprovalSettings';
import { useAuth } from '@/context/AuthContext';
import {
  formatCurrency, formatPercent, formatDate, formatDateTime,
  deviationColor, deviationBgColor, formatUsd,
} from '@/lib/utils';

interface PendingApproval {
  table: PriceTable;
  items: (PriceTableItem & { product: { code: string; description: string } })[];
  approvals: Approval[];
  creator?: Profile;
  currentLevelApproval?: Approval;
}

export default function ApprovalsPage() {
  const { profile } = useAuth();
  const { settings } = useApprovalSettings();
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [decided, setDecided] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ tableId: string; approvalId: string; action: 'approve' | 'reject' } | null>(null);
  const [observations, setObservations] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    // Get all tables with status 'pendente'
    const { data: tables } = await supabase
      .from('price_tables')
      .select('*')
      .order('created_at', { ascending: false });
    const allTables = (tables as PriceTable[]) || [];

    // Get all approvals
    const { data: approvalsData } = await supabase.from('approvals').select('*').order('created_at', { ascending: true });
    const allApprovals = (approvalsData as Approval[]) || [];

    // Get items
    const tableIds = allTables.map((t) => t.id);
    let itemsMap: Record<string, (PriceTableItem & { product: { code: string; description: string } })[]> = {};
    if (tableIds.length > 0) {
      const { data: items } = await supabase
        .from('price_table_items')
        .select('*, product:products(code, description)')
        .in('price_table_id', tableIds);
      (items as (PriceTableItem & { product: { code: string; description: string } })[])?.forEach((item) => {
        if (!itemsMap[item.price_table_id]) itemsMap[item.price_table_id] = [];
        itemsMap[item.price_table_id].push(item);
      });
    }

    // Get creators
    const creatorIds = [...new Set(allTables.map((t) => t.created_by))];
    let creatorMap: Record<string, Profile> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', creatorIds);
      (profiles as Profile[] || []).forEach((p) => { creatorMap[p.id] = p; });
    }

    const buildEntry = (table: PriceTable): PendingApproval => {
      const tableApprovals = allApprovals.filter((a) => a.price_table_id === table.id);
      // Find the first pending approval
      const currentApproval = tableApprovals.find((a) => a.status === 'pendente');
      return {
        table,
        items: itemsMap[table.id] || [],
        approvals: tableApprovals,
        creator: creatorMap[table.created_by],
        currentLevelApproval: currentApproval,
      };
    };

    const pendingTables = allTables.filter((t) => t.status === 'pendente').map(buildEntry);
    const decidedTables = allTables.filter((t) => t.status === 'publicada' || t.status === 'rejeitada').map(buildEntry);

    setPending(pendingTables);
    setDecided(decidedTables);
    setLoading(false);
  };

  const canApprove = (entry: PendingApproval): boolean => {
    if (!profile || !entry.currentLevelApproval) return false;
    // Check if user's role matches the current approval level
    const level = entry.currentLevelApproval.level;
    if (profile.role === 'admin') return true;
    return profile.role === level;
  };

  const handleAction = async () => {
    if (!actionModal || !profile) return;
    setError(null);
    setWorking(true);

    try {
      const { tableId, approvalId, action } = actionModal;
      const entry = pending.find((e) => e.table.id === tableId);
      if (!entry) throw new Error('Tabela não encontrada.');

      const approval = entry.approvals.find((a) => a.id === approvalId);
      if (!approval) throw new Error('Aprovação não encontrada.');

      const maxDeviation = entry.items.length > 0 ? Math.min(...entry.items.map((i) => i.deviation_pct)) : 0;

      if (action === 'approve') {
        // Update this approval
        const { error: apvError } = await supabase
          .from('approvals')
          .update({
            status: 'aprovado',
            approver_id: profile.id,
            approver_name: profile.full_name,
            deviation_accepted: maxDeviation,
            observations: observations || null,
            decided_at: new Date().toISOString(),
          })
          .eq('id', approvalId);
        if (apvError) throw apvError;

        // Log audit
        await supabase.from('audit_log').insert({
          price_table_id: tableId,
          event_type: 'approved',
          user_id: profile.id,
          user_name: profile.full_name,
          user_email: profile.email,
          details: {
            level: approval.level,
            deviation_accepted: maxDeviation,
            observations: observations || null,
          },
          user_agent: navigator.userAgent,
        });

        // Check if there's a next level
        const currentLevelIndex = LEVEL_ORDER.indexOf(approval.level);
        const nextApproval = entry.approvals.find(
          (a) => a.status === 'pendente' && LEVEL_ORDER.indexOf(a.level) > currentLevelIndex,
        );

        if (!nextApproval) {
          // No more approvals needed - publish
          const { error: tableError } = await supabase
            .from('price_tables')
            .update({ status: 'publicada' })
            .eq('id', tableId);
          if (tableError) throw tableError;

          await supabase.from('audit_log').insert({
            price_table_id: tableId,
            event_type: 'published',
            user_id: profile.id,
            user_name: profile.full_name,
            user_email: profile.email,
            details: { reason: 'Todas as aprovações concluídas' },
            user_agent: navigator.userAgent,
          });
        }
      } else {
        // Reject
        if (!rejectionReason.trim()) {
          setError('Motivo da rejeição é obrigatório.');
          setWorking(false);
          return;
        }

        const { error: apvError } = await supabase
          .from('approvals')
          .update({
            status: 'rejeitado',
            approver_id: profile.id,
            approver_name: profile.full_name,
            rejection_reason: rejectionReason,
            decided_at: new Date().toISOString(),
          })
          .eq('id', approvalId);
        if (apvError) throw apvError;

        // Update table status to rejected
        const { error: tableError } = await supabase
          .from('price_tables')
          .update({ status: 'rejeitada' })
          .eq('id', tableId);
        if (tableError) throw tableError;

        await supabase.from('audit_log').insert({
          price_table_id: tableId,
          event_type: 'rejected',
          user_id: profile.id,
          user_name: profile.full_name,
          user_email: profile.email,
          details: {
            level: approval.level,
            rejection_reason: rejectionReason,
          },
          user_agent: navigator.userAgent,
        });
      }

      setActionModal(null);
      setObservations('');
      setRejectionReason('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar.');
    }
    setWorking(false);
  };

  const renderApprovalFlow = (entry: PendingApproval) => {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {LEVEL_ORDER.map((level, idx) => {
          const apv = entry.approvals.find((a) => a.level === level);
          if (!apv) return null;
          return (
            <div key={level} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                apv.status === 'aprovado' ? 'bg-brand-100 text-brand-700' :
                apv.status === 'rejeitado' ? 'bg-error-100 text-error-700' :
                'bg-warning-100 text-warning-700'
              }`}>
                {apv.status === 'aprovado' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 apv.status === 'rejeitado' ? <XCircle className="w-3.5 h-3.5" /> :
                 <Clock className="w-3.5 h-3.5" />}
                {LEVEL_LABELS[level]}
              </div>
              {idx < LEVEL_ORDER.length - 1 && entry.approvals.some((a) => LEVEL_ORDER.indexOf(a.level) > idx) && (
                <span className="text-slate-300">→</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center text-slate-400">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
          Carregando aprovações...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Aprovações</h1>
        <p className="text-slate-500 text-sm mt-0.5">Tabelas pendentes de sua aprovação e histórico de decisões</p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending approvals */}
      <div>
        <h2 className="font-display font-bold text-base text-slate-700 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-warning-600" />
          Pendentes de Aprovação
          {pending.length > 0 && <span className="badge bg-warning-100 text-warning-700">{pending.length}</span>}
        </h2>

        {pending.length === 0 ? (
          <div className="card p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-brand-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma tabela pendente de sua aprovação</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((entry) => {
              const maxDeviation = entry.items.length > 0 ? Math.min(...entry.items.map((i) => i.deviation_pct)) : 0;
              const requiredLevels = getRequiredLevels(maxDeviation, settings);
              const highestLevel = getHighestLevel(requiredLevels);
              const blocked = entry.items.some((i) => isDeviationBlocked(i.deviation_pct, settings));
              const expanded = expandedId === entry.table.id;
              const canUserApprove = canApprove(entry);

              return (
                <div key={entry.table.id} className="card overflow-hidden animate-slide-up">
                  <div
                    className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : entry.table.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 bg-warning-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <FileSpreadsheet className="w-5 h-5 text-warning-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display font-bold text-base text-slate-800 truncate">{entry.table.name}</h3>
                          <p className="text-sm text-slate-500 mt-0.5">
                            Vigência: {formatDate(entry.table.validity_start)} — {formatDate(entry.table.validity_end)}
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-slate-400">{entry.items.length} produtos</span>
                            {entry.creator && <span className="text-xs text-slate-400">• {entry.creator.full_name}</span>}
                            <span className={`badge ${deviationBgColor(maxDeviation)} ${deviationColor(maxDeviation)} border-0`}>
                              <TrendingDown className="w-3 h-3" />
                              {formatPercent(maxDeviation)}
                            </span>
                            {requiredLevels.length > 0 && (
                              <span className="text-xs font-semibold text-slate-600">
                                Aprovações: {requiredLevels.map(l => LEVEL_LABELS[l]).join(' → ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                    {renderApprovalFlow(entry)}
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-100 p-5 bg-slate-50/50 animate-fade-in">
                      {/* Items table */}
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-200">
                              <th className="pb-2 font-semibold">Produto</th>
                              <th className="pb-2 font-semibold text-right">Custo</th>
                              <th className="pb-2 font-semibold text-left">Produto</th>
                              <th className="pb-2 font-semibold text-left">Categoria</th>
                              <th className="pb-2 font-semibold text-right">Custo</th>
                              <th className="pb-2 font-semibold text-right">USD/KG</th>
                              <th className="pb-2 font-semibold text-right">USD/LB</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.items.map((item) => (
                              <tr key={item.id} className="border-b border-slate-100">
                                <td className="py-2">
                                  <span className="font-mono text-xs font-semibold text-slate-600">{item.product?.code}</span>
                                  <span className="text-slate-500 ml-2">{item.product?.description}</span>
                                </td>
                                <td className="py-2">
                                  <span className={`badge ${item.category === 'Orgânica' ? 'bg-brand-50 text-brand-700' : 'bg-ocean-50 text-ocean-700'}`}>
                                    {item.category || 'Natural'}
                                  </span>
                                </td>
                                <td className="py-2 text-right text-slate-600">{formatCurrency(item.cost)}</td>
                                <td className="py-2 text-right text-slate-600">{formatCurrency(item.sale_price)}</td>
                                <td className={`py-2 text-right font-semibold ${deviationColor(item.deviation_pct)}`}>
                                  {formatPercent(item.deviation_pct)}
                                </td>
                                <td className="py-2 text-right text-slate-500">{item.usd_per_kg ? formatUsd(item.usd_per_kg) : '—'}</td>
                                <td className="py-2 text-right text-slate-500">{item.usd_per_lb ? formatUsd(item.usd_per_lb) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Action buttons */}
                      {canUserApprove ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setActionModal({ tableId: entry.table.id, approvalId: entry.currentLevelApproval!.id, action: 'approve' }); setObservations(''); setRejectionReason(''); setError(null); }}
                            className="btn-success flex-1"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Aprovar
                          </button>
                          <button
                            onClick={() => { setActionModal({ tableId: entry.table.id, approvalId: entry.currentLevelApproval!.id, action: 'reject' }); setObservations(''); setRejectionReason(''); setError(null); }}
                            className="btn-danger flex-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeitar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 rounded-lg p-3">
                          <AlertCircle className="w-4 h-4" />
                          {blocked
                            ? `Esta tabela contém desvios acima do limite máximo (${settings.superintendente_threshold}%) e deve ser rejeitada.`
                            : entry.currentLevelApproval
                              ? `Aguardando aprovação do ${LEVEL_LABELS[entry.currentLevelApproval.level]}. Seu papel não tem alçada para esta etapa.`
                              : 'Aguardando processamento.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decided approvals */}
      {decided.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-base text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-600" />
            Decididas
          </h2>
          <div className="space-y-2">
            {decided.map((entry) => (
              <div key={entry.table.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      entry.table.status === 'publicada' ? 'bg-brand-50' : 'bg-error-50'
                    }`}>
                      {entry.table.status === 'publicada' ? <CheckCircle2 className="w-4 h-4 text-brand-600" /> : <XCircle className="w-4 h-4 text-error-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-700 truncate">{entry.table.name}</p>
                      <p className="text-xs text-slate-500">
                        {entry.table.status === 'publicada' ? 'Publicada' : 'Rejeitada'} • {formatDate(entry.table.updated_at)}
                      </p>
                    </div>
                  </div>
                  {renderApprovalFlow(entry)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">
                {actionModal.action === 'approve' ? 'Aprovar Tabela' : 'Rejeitar Tabela'}
              </h3>
              <button onClick={() => setActionModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {actionModal.action === 'approve' ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Observações (opcional)</label>
                  <textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Adicione observações sobre a aprovação..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Motivo da Rejeição *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Descreva o motivo da rejeição..."
                    rows={3}
                    className="input-field resize-none"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setActionModal(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleAction}
                  disabled={working}
                  className={actionModal.action === 'approve' ? 'btn-success flex-1' : 'btn-danger flex-1'}
                >
                  {working ? 'Processando...' : actionModal.action === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
