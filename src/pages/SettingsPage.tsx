import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { supabase, type ApprovalSettings, DEFAULT_SETTINGS, LEVEL_LABELS } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ApprovalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('approval_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) {
        console.error(error);
      }
      if (data) setSettings(data as ApprovalSettings);
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (settings.gerente_threshold <= 0 || settings.diretor_threshold <= settings.gerente_threshold || settings.superintendente_threshold <= settings.diretor_threshold) {
      setError('Os limites devem ser crescentes: Gerente < Diretor < Superintendente, todos maiores que zero.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('approval_settings')
      .update({
        gerente_threshold: settings.gerente_threshold,
        diretor_threshold: settings.diretor_threshold,
        superintendente_threshold: settings.superintendente_threshold,
      })
      .eq('id', 1);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    }
    setSaving(false);
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error-300 mx-auto mb-3" />
          <p className="text-slate-500">Acesso restrito ao Administrador.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center text-slate-400">
          <SettingsIcon className="w-8 h-8 mx-auto mb-2 animate-pulse-soft" />
          Carregando configurações...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800">Configurações de Aprovação</h1>
        <p className="text-slate-500 text-sm mt-0.5">Defina os limites percentuais de desvio para cada nível de alçada</p>
      </div>

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

      <div className="flex items-start gap-2.5 p-3.5 bg-ocean-50 border border-ocean-100 rounded-lg text-ocean-700 text-sm">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Como funciona a alçada cumulativa:</p>
          <ul className="list-disc list-inside space-y-0.5 text-ocean-600">
            <li>Até o limite do Gerente: apenas Gerente Comercial aprova</li>
            <li>Acima do limite do Gerente até o do Diretor: Gerente + Diretor aprovam (em sequência)</li>
            <li>Acima do limite do Diretor até o do Superintendente: Gerente + Diretor + Superintendente aprovam</li>
            <li>Acima do limite do Superintendente: bloqueado, tabela deve ser refeita</li>
          </ul>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="card p-6 space-y-5">
          <h3 className="font-display font-bold text-base text-slate-800">Limites de Desvio (%)</h3>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Limite do Gerente Comercial (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={settings.gerente_threshold}
              onChange={(e) => setSettings({ ...settings, gerente_threshold: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">
              Desvios de 0,1% até este valor exigem apenas aprovação do Gerente Comercial.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Limite do Diretor Comercial (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={settings.diretor_threshold}
              onChange={(e) => setSettings({ ...settings, diretor_threshold: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">
              Desvios acima do limite do Gerente até este valor exigem Gerente + Diretor.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Limite do Superintendente (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={settings.superintendente_threshold}
              onChange={(e) => setSettings({ ...settings, superintendente_threshold: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">
              Desvios acima do limite do Diretor até este valor exigem os 3 aprovadores.
              Acima deste valor, a tabela é bloqueada.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">Resumo da alçada:</p>
            <div className="space-y-1.5 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="badge bg-warning-50 text-warning-700">0,1% – {settings.gerente_threshold}%</span>
                <span>→ {LEVEL_LABELS.gerente}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-orange-50 text-orange-700">{settings.gerente_threshold}% – {settings.diretor_threshold}%</span>
                <span>→ {LEVEL_LABELS.gerente} → {LEVEL_LABELS.diretor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-error-50 text-error-700">{settings.diretor_threshold}% – {settings.superintendente_threshold}%</span>
                <span>→ {LEVEL_LABELS.gerente} → {LEVEL_LABELS.diretor} → {LEVEL_LABELS.superintendente}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-slate-200 text-slate-700">&gt; {settings.superintendente_threshold}%</span>
                <span>→ Bloqueado</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}
