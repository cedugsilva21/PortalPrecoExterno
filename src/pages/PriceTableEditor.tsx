import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Plus, Trash2, Save, Send, AlertTriangle, CheckCircle2,
  X, AlertCircle, TrendingDown, DollarSign, FileSpreadsheet,
  Database, Lock,
} from 'lucide-react';
import {
  supabase, type PriceTable, type Product, type PriceTableItem,
  calculateDeviation, getRequiredLevels, getHighestLevel, isDeviationBlocked,
  LEVEL_LABELS, LB_PER_KG, type ApprovalLevel, COMPANIES, type Company,
} from '@/lib/supabase';
import { useApprovalSettings } from '@/hooks/useApprovalSettings';
import { useAuth } from '@/context/AuthContext';
import {
  formatCurrency, formatPercent, formatUsd,
  deviationColor, deviationBgColor,
} from '@/lib/utils';

interface EditorProps {
  table: PriceTable;
  readOnly?: boolean;
  onClose: () => void;
}

interface DraftItem {
  id?: string;
  product_id: string;
  category: string;
  cost: number;
  sale_price_brl: number;
  usd_per_lb: number;
  usd_per_kg: number;
  deviation_pct: number;
  product?: Product;
}

const DEFAULT_USD_RATE = 5.0;

export default function PriceTableEditor({ table, readOnly = false, onClose }: EditorProps) {
  const { profile } = useAuth();
  const { settings } = useApprovalSettings();
  const isNew = !table.id;
  const [name, setName] = useState(table.name || '');
  const [validityStart, setValidityStart] = useState(table.validity_start || '');
  const [validityEnd, setValidityEnd] = useState(table.validity_end || '');
  const [usdRate, setUsdRate] = useState(table.usd_rate || DEFAULT_USD_RATE);
  const [company, setCompany] = useState<Company>((table.company as Company) || 'Brasil');
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [approvals, setApprovals] = useState<{ level: ApprovalLevel; status: string; approver_name: string | null; observations: string | null; rejection_reason: string | null; decided_at: string | null }[]>([]);
  const [lastPublishedPrices, setLastPublishedPrices] = useState<Record<string, number | null>>({});

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('description');
    setProducts((data as Product[]) || []);
  }, []);

  const loadTableData = useCallback(async () => {
    if (!table.id) {
      setLoading(false);
      return;
    }
    const { data: itemsData } = await supabase
      .from('price_table_items')
      .select('*, product:products(*)')
      .eq('price_table_id', table.id);
    const mappedItems = (itemsData as (PriceTableItem & { product: Product })[])?.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      category: item.category || 'Natural',
      cost: item.cost,
      sale_price_brl: item.sale_price,
      usd_per_lb: item.usd_per_lb ?? 0,
      usd_per_kg: item.usd_per_kg ?? 0,
      deviation_pct: item.deviation_pct,
      product: item.product,
    })) || [];
    setItems(mappedItems);
    fetchLastPublishedPrices(mappedItems.map((i) => ({ product_id: i.product_id, category: i.category })));

    const { data: approvalsData } = await supabase
      .from('approvals')
      .select('*')
      .eq('price_table_id', table.id)
      .order('created_at', { ascending: true });
    setApprovals((approvalsData as typeof approvals) || []);

    setLoading(false);
  }, [table.id]);

  useEffect(() => {
    (async () => {
      await loadProducts();
      await loadTableData();
    })();
  }, [loadProducts, loadTableData]);

  const fetchLastPublishedPrices = useCallback(async (productCategories: { product_id: string; category: string }[]) => {
    if (productCategories.length === 0) {
      setLastPublishedPrices({});
      return;
    }
    const { data } = await supabase
      .from('price_table_items')
      .select('product_id, category, usd_per_lb, price_tables!inner(status, updated_at)')
      .eq('price_tables.status', 'publicada')
      .in('product_id', productCategories.map((pc) => pc.product_id))
      .order('updated_at', { ascending: false });
    const map: Record<string, number | null> = {};
    (data as { product_id: string; category: string; usd_per_lb: number; price_tables: { status: string; updated_at: string } }[])?.forEach((row) => {
      const key = `${row.product_id}|${row.category}`;
      if (!(key in map)) map[key] = row.usd_per_lb;
    });
    setLastPublishedPrices(map);
  }, []);

  const recalcItem = (item: DraftItem, rate: number): DraftItem => {
    const usdKg = item.usd_per_lb * LB_PER_KG;
    const salePriceBrl = usdKg * rate;
    const deviation = calculateDeviation(item.cost, salePriceBrl);
    return {
      ...item,
      sale_price_brl: salePriceBrl,
      deviation_pct: deviation,
      usd_per_kg: usdKg,
    };
  };

  const updateUsdLb = (index: number, value: string) => {
    const numVal = parseFloat(value) || 0;
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], usd_per_lb: numVal };
      next[index] = recalcItem(item, usdRate);
      return next;
    });
  };

  const addProduct = (product: Product, category: string) => {
    if (items.some((i) => i.product_id === product.id && i.category === category)) {
      setShowProductPicker(false);
      return;
    }
    const newItem: DraftItem = recalcItem({
      product_id: product.id,
      category,
      cost: product.standard_cost,
      sale_price_brl: 0,
      usd_per_lb: 0,
      usd_per_kg: 0,
      deviation_pct: 0,
      product,
    }, usdRate);
    setItems([...items, newItem]);
    setShowProductPicker(false);
    fetchLastPublishedPrices([...items, newItem].map((i) => ({ product_id: i.product_id, category: i.category })));
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    fetchLastPublishedPrices(next.map((i) => ({ product_id: i.product_id, category: i.category })));
  };

  const logAudit = async (tableId: string, eventType: string, details: Record<string, unknown>) => {
    if (!profile) return;
    await supabase.from('audit_log').insert({
      price_table_id: tableId,
      event_type: eventType,
      user_id: profile.id,
      user_name: profile.full_name,
      user_email: profile.email,
      details,
      user_agent: navigator.userAgent,
    });
  };

  const checkDuplicate = async (): Promise<string | null> => {
    const { data } = await supabase
      .from('price_tables')
      .select('id, name')
      .eq('company', company)
      .eq('name', name.trim())
      .eq('validity_start', validityStart)
      .eq('validity_end', validityEnd)
      .neq('id', table.id || '');
    if (data && data.length > 0) {
      return `Já existe uma tabela com o mesmo nome e vigência para ${company}. Altere o nome ou as datas.`;
    }
    return null;
  };

  const handleSaveDraft = async () => {
    setError(null);
    setSuccess(null);
    if (!name.trim() || !validityStart || !validityEnd) {
      setError('Preencha nome e datas de vigência.');
      return;
    }
    if (validityEnd < validityStart) {
      setError('Data final deve ser posterior à data inicial.');
      return;
    }
    if (usdRate <= 0) {
      setError('A taxa de câmbio USD deve ser maior que zero.');
      return;
    }
    setSaving(true);

    const dupError = await checkDuplicate();
    if (dupError) {
      setError(dupError);
      setSaving(false);
      return;
    }

    try {
      let tableId = table.id;
      if (isNew) {
        const { data: newTable, error: insertError } = await supabase
          .from('price_tables')
          .insert({
            name: name.trim(),
            validity_start: validityStart,
            validity_end: validityEnd,
            usd_rate: usdRate,
            company,
            status: 'rascunho',
            created_by: profile?.id,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        tableId = (newTable as PriceTable).id;
        await logAudit(tableId, 'table_created', { name, validity_start: validityStart, validity_end: validityEnd, usd_rate: usdRate, company });
      } else {
        const { error: updateError } = await supabase
          .from('price_tables')
          .update({ name: name.trim(), validity_start: validityStart, validity_end: validityEnd, usd_rate: usdRate, company })
          .eq('id', tableId);
        if (updateError) throw updateError;
      }

      if (!isNew) {
        await supabase.from('price_table_items').delete().eq('price_table_id', tableId);
      }
      if (items.length > 0) {
        const itemPayloads = items.map((item) => ({
          price_table_id: tableId,
          product_id: item.product_id,
          category: item.category,
          cost: item.cost,
          sale_price: item.sale_price_brl,
          deviation_pct: item.deviation_pct,
          usd_per_lb: item.usd_per_lb,
          usd_per_kg: item.usd_per_kg,
          cost_source: 'protheus',
        }));
        const { error: itemsError } = await supabase.from('price_table_items').insert(itemPayloads);
        if (itemsError) throw itemsError;
        for (const item of items) {
          await logAudit(tableId, 'product_added', {
            product: item.product?.code,
            category: item.category,
            cost: item.cost,
            usd_per_kg: item.usd_per_kg,
            usd_per_lb: item.usd_per_lb,
            sale_price_brl: item.sale_price_brl,
            deviation_pct: item.deviation_pct,
          });
        }
      }

      await logAudit(tableId, 'draft_saved', { items_count: items.length });
      setSuccess('Rascunho salvo com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
    setSaving(false);
  };

  const handleSubmitForApproval = async () => {
    setError(null);
    setSuccess(null);
    if (!name.trim() || !validityStart || !validityEnd) {
      setError('Preencha nome e datas de vigência.');
      return;
    }
    if (items.length === 0) {
      setError('Adicione pelo menos um produto.');
      return;
    }
    if (items.some((i) => i.usd_per_lb <= 0)) {
      setError('Todos os produtos devem ter um Valor de Venda (USD/LB) maior que zero.');
      return;
    }
    if (usdRate <= 0) {
      setError('A taxa de câmbio USD deve ser maior que zero.');
      return;
    }

    const blockedItems = items.filter((i) => isDeviationBlocked(i.deviation_pct, settings));
    if (blockedItems.length > 0) {
      setError(`Existem produtos com desvio acima do limite máximo (${settings.superintendente_threshold}%). Corrija os preços de venda antes de enviar.`);
      return;
    }

    setSaving(true);
    const dupError = await checkDuplicate();
    if (dupError) {
      setError(dupError);
      setSaving(false);
      return;
    }
    // Check max 1 published per company
    const { data: existingPublished } = await supabase
      .from('price_tables')
      .select('id, name')
      .eq('company', company)
      .eq('status', 'publicada')
      .neq('id', table.id || '');
    if (existingPublished && existingPublished.length > 0) {
      const existingName = (existingPublished[0] as { name: string }).name;
      setError(`Já existe uma tabela publicada para ${company}: "${existingName}". Desative-a antes de publicar uma nova.`);
      setSaving(false);
      return;
    }

    try {
      let tableId = table.id;

      if (isNew) {
        const { data: newTable, error: insertError } = await supabase
          .from('price_tables')
          .insert({
            name: name.trim(),
            validity_start: validityStart,
            validity_end: validityEnd,
            usd_rate: usdRate,
            company,
            status: 'pendente',
            created_by: profile?.id,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        tableId = (newTable as PriceTable).id;
        await logAudit(tableId, 'table_created', { name, validity_start: validityStart, validity_end: validityEnd, usd_rate: usdRate, company });
      } else {
        await supabase.from('price_table_items').delete().eq('price_table_id', tableId);
        const { error: updateError } = await supabase
          .from('price_tables')
          .update({ name: name.trim(), validity_start: validityStart, validity_end: validityEnd, usd_rate: usdRate, company })
          .eq('id', tableId);
        if (updateError) throw updateError;
      }

      const itemPayloads = items.map((item) => ({
        price_table_id: tableId,
        product_id: item.product_id,
        category: item.category,
        cost: item.cost,
        sale_price: item.sale_price_brl,
        deviation_pct: item.deviation_pct,
        usd_per_lb: item.usd_per_lb,
        usd_per_kg: item.usd_per_kg,
        cost_source: 'protheus',
      }));
      const { error: itemsError } = await supabase.from('price_table_items').insert(itemPayloads);
      if (itemsError) throw itemsError;

      const maxDeviation = Math.min(...items.map((i) => i.deviation_pct));
      const neededLevels = getRequiredLevels(maxDeviation, settings);

      if (neededLevels.length === 0) {
        const { error: updateError } = await supabase
          .from('price_tables')
          .update({ status: 'publicada' })
          .eq('id', tableId);
        if (updateError) throw updateError;
        await logAudit(tableId, 'published', { reason: 'Sem desvios - publicação automática' });
        setSuccess('Tabela publicada automaticamente (sem desvios negativos)!');
      } else {
        for (const level of neededLevels) {
          await supabase.from('approvals').insert({
            price_table_id: tableId,
            level,
            status: 'pendente',
          });
        }

        const { error: updateError } = await supabase
          .from('price_tables')
          .update({ status: 'pendente' })
          .eq('id', tableId);
        if (updateError) throw updateError;

        const highestLevel = getHighestLevel(neededLevels);
        await logAudit(tableId, 'submitted_for_approval', {
          max_deviation: maxDeviation,
          required_levels: neededLevels,
          highest_level: highestLevel,
        });

        setSuccess(`Tabela enviada para aprovação! Níveis necessários: ${neededLevels.map(l => LEVEL_LABELS[l]).join(' → ')}`);
      }

      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar.');
    }
    setSaving(false);
  };

  const maxDeviation = items.length > 0 ? Math.min(...items.map((i) => i.deviation_pct)) : 0;
  const neededLevels = getRequiredLevels(maxDeviation, settings);
  const blocked = items.some((i) => isDeviationBlocked(i.deviation_pct, settings));
  const hasDeviations = items.some((i) => i.deviation_pct < 0);

  const availableCombos = products.flatMap((p) => {
    const cats = Array.isArray(p.category) ? p.category : [p.category].filter(Boolean);
    return cats.map((cat) => ({ product: p, category: cat }));
  }).filter(({ product, category }) => !items.some((i) => i.product_id === product.id && i.category === category));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center text-slate-400">
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-800">
              {isNew ? 'Nova Tabela de Preço' : readOnly ? 'Visualizar Tabela' : 'Editar Tabela'}
            </h1>
            <p className="text-sm text-slate-500">
              {readOnly ? 'Modo de visualização (somente leitura)' : 'Preencha os dados e envie para aprovação'}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 p-3.5 bg-brand-50 border border-brand-100 rounded-lg text-brand-700 text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Basic info */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-base text-slate-800 mb-4">Informações Básicas</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Empresa</label>
            {readOnly ? (
              <p className="input-field bg-slate-50 text-slate-600">{company}</p>
            ) : (
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value as Company)}
                className="input-field"
              >
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome da Tabela</label>
            <input
              type="text"
              disabled={readOnly}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Tabela Exportação Q1 2025"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Início da Vigência</label>
            <input
              type="date"
              disabled={readOnly}
              value={validityStart}
              onChange={(e) => setValidityStart(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fim da Vigência</label>
            <input
              type="date"
              disabled={readOnly}
              value={validityEnd}
              onChange={(e) => setValidityEnd(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-ocean-600" />
                Taxa USD (BRL)
              </span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.01"
              readOnly
              value={usdRate}
              className="input-field bg-slate-50 text-slate-600 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Deviation summary */}
      {items.length > 0 && (
        <div className={`card p-5 ${deviationBgColor(maxDeviation)} border-l-4 ${
          maxDeviation >= 0 ? 'border-l-brand-500' :
          Math.abs(maxDeviation) <= settings.gerente_threshold ? 'border-l-warning-500' :
          Math.abs(maxDeviation) <= settings.diretor_threshold ? 'border-l-orange-500' :
          'border-l-error-500'
        }`}>
          <div className="flex items-start gap-3">
            {maxDeviation >= 0 ? (
              <CheckCircle2 className="w-6 h-6 text-brand-600 flex-shrink-0" />
            ) : (
              <TrendingDown className="w-6 h-6 text-error-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-slate-800">
                {maxDeviation >= 0
                  ? 'Sem desvios negativos — publicação automática ao enviar'
                  : `Desvio máximo: ${formatPercent(maxDeviation)}`}
              </p>
              {maxDeviation < 0 && !blocked && neededLevels.length > 0 && (
                <p className="text-sm text-slate-600 mt-0.5">
                  Aprovações necessárias (cumulativas):{' '}
                  <span className="font-semibold">{neededLevels.map(l => LEVEL_LABELS[l]).join(' → ')}</span>
                </p>
              )}
              {blocked && (
                <p className="text-sm text-error-700 mt-0.5 font-semibold">
                  Desvio acima de {settings.superintendente_threshold}% — bloqueado. Deve ser corrigido antes do envio.
                </p>
              )}
              {hasDeviations && !blocked && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {items.filter((i) => i.deviation_pct < 0).map((item, idx) => (
                    <span key={idx} className="badge bg-white/80 text-slate-700 text-xs">
                      {item.product?.code}: {formatPercent(item.deviation_pct)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-display font-bold text-base text-slate-800">
            Produtos da Tabela
            {items.length > 0 && <span className="text-slate-400 font-normal ml-2">({items.length})</span>}
          </h3>
          {!readOnly && availableCombos.length > 0 && (
            <button onClick={() => setShowProductPicker(true)} className="btn-secondary text-sm py-2">
              <Plus className="w-4 h-4" />
              Adicionar Produto
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-1">Nenhum produto adicionado</p>
            {!readOnly && availableCombos.length > 0 && (
              <button onClick={() => setShowProductPicker(true)} className="text-ocean-600 font-semibold text-sm hover:underline">
                Adicionar primeiro produto
              </button>
            )}
            {availableCombos.length === 0 && !readOnly && (
              <p className="text-sm text-slate-400">Cadastre produtos primeiro na aba Produtos.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  {company === 'Brasil' && (
                    <th className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Database className="w-3 h-3 text-slate-400" />
                        Custo KG (BRL)
                      </span>
                    </th>
                  )}
                  <th className="px-4 py-3 text-right">Últ. Preço Publicado (USD/LB)</th>
                  <th className="px-4 py-3 text-right">Venda (USD/LB)</th>
                  <th className="px-4 py-3 text-right">Venda (USD/KG)</th>
                  <th className="px-4 py-3 text-right">Venda (BRL/KG)</th>
                  <th className="px-4 py-3 text-right">Desvio %</th>
                  {!readOnly && <th className="px-4 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={index} className={`transition-colors ${item.deviation_pct < 0 ? 'bg-error-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.deviation_pct < 0 && (
                          <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-slate-700">{item.product?.code}</p>
                      </div>
                    </td>
                    {/* Categoria (from item, not product) */}
                    <td className="px-4 py-3">
                      <span className={`badge ${item.category === 'Orgânica' ? 'bg-brand-50 text-brand-700' : 'bg-ocean-50 text-ocean-700'}`}>
                        {item.category || 'Natural'}
                      </span>
                    </td>
                    {/* Custo KG (BRL) - from Protheus, only for Brasil */}
                    {company === 'Brasil' && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Lock className="w-3 h-3 text-slate-300" />
                          <span className="text-sm text-slate-700 font-medium">{formatCurrency(item.cost)}</span>
                        </div>
                      </td>
                    )}
                    {/* Último Preço Publicado (USD/LB) */}
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {(() => {
                        const lastPrice = lastPublishedPrices[`${item.product_id}|${item.category}`];
                        return lastPrice != null ? formatUsd(lastPrice) : '—';
                      })()}
                    </td>
                    {/* Venda USD/LB - manual */}
                    <td className="px-4 py-3 text-right">
                      {readOnly ? (
                        <span className="text-sm text-slate-700">{formatUsd(item.usd_per_lb)}</span>
                      ) : (
                        <div className="flex items-center justify-end">
                          <span className="text-xs text-slate-400 mr-1.5">$</span>
                          <input
                            type="number"
                            step="0.0001"
                            value={item.usd_per_lb || ''}
                            onChange={(e) => updateUsdLb(index, e.target.value)}
                            className="w-24 px-2 py-1.5 text-right text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                          />
                        </div>
                      )}
                    </td>
                    {/* Venda USD/KG - auto = USD/LB × LB_PER_KG */}
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {item.usd_per_kg > 0 ? formatUsd(item.usd_per_kg) : '—'}
                    </td>
                    {/* Venda BRL/KG - calculated */}
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {item.sale_price_brl > 0 ? formatCurrency(item.sale_price_brl) : '—'}
                    </td>
                    {/* Desvio % */}
                    <td className={`px-4 py-3 text-right text-sm font-semibold ${deviationColor(item.deviation_pct)}`}>
                      {formatPercent(item.deviation_pct)}
                    </td>
                    {!readOnly && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="p-2 text-slate-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approval flow info (read-only mode) */}
      {readOnly && approvals.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display font-bold text-base text-slate-800 mb-4">Fluxo de Aprovação</h3>
          <div className="space-y-3">
            {approvals.map((apv, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  apv.status === 'aprovado' ? 'bg-brand-100 text-brand-700' :
                  apv.status === 'rejeitado' ? 'bg-error-100 text-error-700' :
                  'bg-warning-100 text-warning-700'
                }`}>
                  {apv.status === 'aprovado' ? <CheckCircle2 className="w-4 h-4" /> :
                   apv.status === 'rejeitado' ? <X className="w-4 h-4" /> :
                   idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    {LEVEL_LABELS[apv.level as ApprovalLevel]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {apv.status === 'pendente' ? 'Aguardando aprovação' :
                     apv.status === 'aprovado' ? `Aprovado por ${apv.approver_name || '—'}` :
                     `Rejeitado por ${apv.approver_name || '—'}`}
                    {apv.observations && ` — "${apv.observations}"`}
                    {apv.rejection_reason && ` — Motivo: "${apv.rejection_reason}"`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4">
          <button onClick={onClose} className="btn-secondary flex-1">
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary flex-1">
            <Save className="w-4 h-4" />
            Salvar Rascunho
          </button>
          <button onClick={handleSubmitForApproval} disabled={saving || blocked} className="btn-primary flex-1">
            <Send className="w-4 h-4" />
            Enviar para Aprovação
          </button>
        </div>
      )}

      {/* Product picker modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowProductPicker(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-display font-bold text-lg text-slate-800">Adicionar Produto</h3>
              <button onClick={() => setShowProductPicker(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 flex-1">
              {availableCombos.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Todas as combinações já foram adicionadas.</p>
              ) : (
                <div className="space-y-1">
                  {availableCombos.map(({ product, category }) => (
                    <button
                      key={`${product.id}-${category}`}
                      onClick={() => addProduct(product, category)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{product.code}</p>
                        <p className="text-xs text-slate-500">{category}</p>
                      </div>
                      <Plus className="w-5 h-5 text-ocean-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
