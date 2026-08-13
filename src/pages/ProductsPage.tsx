import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, X, AlertCircle, Search } from 'lucide-react';
import { supabase, type Product, type ProductCategoryRow, PRODUCT_CATEGORIES, PRODUCT_COMPANIES } from '@/lib/supabase';

const CATEGORY_STYLES: Record<string, string> = {
  'Natural':  'bg-ocean-50 text-ocean-700 border-ocean-200',
  'Orgânica': 'bg-brand-50 text-brand-700 border-brand-200',
};

const COMPANY_STYLES: Record<string, string> = {
  'Usibras': 'bg-slate-100 text-slate-700',
  'Nutsco':  'bg-warning-50 text-warning-700',
  'Ghana':   'bg-cream-200 text-slate-600',
};

type FormState = {
  code: string;
  description: string;
  categories: string[];
  companies: string[];
  standard_cost: string;
};

const EMPTY_FORM: FormState = {
  code: '',
  description: '',
  categories: [],
  companies: [],
  standard_cost: '',
};

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

interface MultiToggleProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  colorMap?: Record<string, string>;
  activeColor?: string;
}

function MultiToggle({ label, options, selected, onChange, activeColor = 'bg-brand-600 text-white border-brand-600' }: MultiToggleProps) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(toggleItem(selected, opt))}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                active ? activeColor : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-xs text-slate-400 mt-1.5">Selecione ao menos uma opção</p>
      )}
    </div>
  );
}

interface DisplayRow {
  productId: string;
  code: string;
  category: string;
  companies: string[];
  standardCost: number;
  product: Product;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const [{ data: prodData }, { data: catData }] = await Promise.all([
      supabase.from('products').select('*').order('code', { ascending: true }),
      supabase.from('product_categories').select('*'),
    ]);
    setProducts((prodData as Product[]) || []);
    setProductCategories((catData as ProductCategoryRow[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      code: product.code,
      description: product.description,
      categories: Array.isArray(product.category) ? product.category : [product.category].filter(Boolean),
      companies: Array.isArray(product.companies) ? product.companies : [],
      standard_cost: String(product.standard_cost ?? ''),
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.categories.length === 0) { setError('Selecione ao menos uma categoria.'); return; }
    if (form.companies.length === 0)  { setError('Selecione ao menos uma empresa.'); return; }

    setSaving(true);

    const costValue = parseFloat(form.standard_cost.replace(',', '.'));
    if (isNaN(costValue) || costValue < 0) { setError('Informe um custo de produção válido.'); setSaving(false); return; }

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || form.code.trim().toUpperCase(),
      category: form.categories,
      companies: form.companies,
      standard_cost: costValue,
    };

    try {
      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error: updateError } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (updateError) throw updateError;
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from('products').insert(payload).select().single();
        if (insertError) throw insertError;
        productId = (newProduct as Product).id;
      }

      // Sync product_categories: delete existing, insert new
      if (productId) {
        await supabase.from('product_categories').delete().eq('product_id', productId);
        if (form.categories.length > 0) {
          const catRows = form.categories.map((cat) => ({ product_id: productId, category: cat }));
          const { error: catError } = await supabase.from('product_categories').insert(catRows);
          if (catError) throw catError;
        }
      }

      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
    setSaving(false);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Excluir produto "${product.code}"?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) alert(`Erro ao excluir: ${error.message}`);
    else fetchProducts();
  };

  // Build display rows: one row per product × category
  const displayRows: DisplayRow[] = [];
  for (const product of products) {
    const cats = (productCategories.filter((pc) => pc.product_id === product.id).map((pc) => pc.category));
    const catList = cats.length > 0 ? cats : (Array.isArray(product.category) ? product.category : [product.category].filter(Boolean));
    if (catList.length === 0) {
      displayRows.push({
        productId: product.id, code: product.code, category: '—',
        companies: product.companies || [], standardCost: product.standard_cost, product,
      });
    } else {
      for (const cat of catList) {
        displayRows.push({
          productId: product.id, code: product.code, category: cat,
          companies: product.companies || [], standardCost: product.standard_cost, product,
        });
      }
    }
  }

  const filtered = displayRows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.companies.some((c) => c.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-brand-700">Produtos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestão de produtos para precificação de exportação</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por código, categoria ou empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
            Carregando produtos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-1">
              {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
            </p>
            {products.length === 0 && (
              <button onClick={openCreate} className="text-brand-600 font-semibold text-sm hover:underline">
                Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-cream-100 border-b border-cream-300 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3 text-right">Custo Produção</th>
                  <th className="px-5 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {filtered.map((row, idx) => (
                  <tr key={`${row.productId}-${row.category}-${idx}`} className="hover:bg-cream-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm font-bold text-slate-700">{row.code}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge border ${CATEGORY_STYLES[row.category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {(row.companies || []).map((co) => (
                          <span key={co} className={`badge ${COMPANY_STYLES[co] || 'bg-slate-100 text-slate-600'}`}>
                            {co}
                          </span>
                        ))}
                        {(!row.companies || row.companies.length === 0) && (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-sm font-bold text-brand-700">
                        R$ {Number(row.standardCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(row.product)}
                          className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.product)}
                          className="p-2 text-slate-500 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-cream-200">
              <h3 className="font-display font-black text-lg text-brand-700">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-cream-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Código */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Código</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Ex: CAST-W240"
                  className="input-field font-mono tracking-wide"
                />
              </div>

              {/* Custo de Produção */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Custo de Produção (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={form.standard_cost}
                    onChange={(e) => setForm({ ...form, standard_cost: e.target.value })}
                    placeholder="0,00"
                    className="input-field pl-10 font-mono"
                  />
                </div>
              </div>

              {/* Categoria — multi-select (generates one record per category) */}
              <MultiToggle
                label="Categoria"
                options={PRODUCT_CATEGORIES}
                selected={form.categories}
                onChange={(next) => setForm({ ...form, categories: next })}
                activeColor="bg-brand-600 text-white border-brand-600"
              />

              {/* Empresa — multi-select */}
              <MultiToggle
                label="Empresa"
                options={PRODUCT_COMPANIES}
                selected={form.companies}
                onChange={(next) => setForm({ ...form, companies: next })}
                activeColor="bg-ocean-500 text-white border-ocean-500"
              />

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando...' : editingProduct ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
