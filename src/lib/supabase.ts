import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type UserRole = 'comercial' | 'gerente' | 'diretor' | 'superintendente' | 'admin';

export type TableStatus = 'rascunho' | 'pendente' | 'publicada' | 'expirada' | 'rejeitada' | 'desativada';

export type Company = 'Brasil' | 'Ghana' | 'Nutsco';
export const COMPANIES: Company[] = ['Brasil', 'Ghana', 'Nutsco'];

export type ApprovalLevel = 'gerente' | 'diretor' | 'superintendente';
export type ApprovalStatus = 'pendente' | 'aprovado' | 'rejeitado';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  description: string;
  product_type: string;
  category: string[];
  companies: string[];
  standard_cost: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryRow {
  id: string;
  product_id: string;
  category: string;
  created_at: string;
}

export const PRODUCT_CATEGORIES = ['Natural', 'Orgânica'] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const PRODUCT_COMPANIES = ['Usibras', 'Nutsco', 'Ghana'] as const;
export type ProductCompany = typeof PRODUCT_COMPANIES[number];

export interface PriceTable {
  id: string;
  name: string;
  validity_start: string;
  validity_end: string;
  status: TableStatus;
  created_by: string;
  usd_rate: number;
  company: Company;
  created_at: string;
  updated_at: string;
}

export interface PriceTableItem {
  id: string;
  price_table_id: string;
  product_id: string;
  category: string | null;
  cost: number;
  sale_price: number;
  deviation_pct: number;
  usd_per_lb: number | null;
  usd_per_kg: number | null;
  cost_source: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface Approval {
  id: string;
  price_table_id: string;
  level: ApprovalLevel;
  status: ApprovalStatus;
  approver_id: string | null;
  approver_name: string | null;
  deviation_accepted: number | null;
  observations: string | null;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  price_table_id: string | null;
  event_type: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  comercial: 'Comercial',
  gerente: 'Gerente Comercial',
  diretor: 'Diretor Comercial',
  superintendente: 'Superintendente',
  admin: 'Administrador do Sistema',
};

export const STATUS_LABELS: Record<TableStatus, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  publicada: 'Publicada',
  expirada: 'Expirada',
  rejeitada: 'Rejeitada',
  desativada: 'Desativada',
};

export const STATUS_COLORS: Record<TableStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  pendente: 'bg-warning-100 text-warning-700',
  publicada: 'bg-brand-100 text-brand-700',
  expirada: 'bg-slate-100 text-slate-500',
  rejeitada: 'bg-error-100 text-error-700',
  desativada: 'bg-slate-100 text-slate-500',
};

export const LEVEL_LABELS: Record<ApprovalLevel, string> = {
  gerente: 'Gerente Comercial',
  diretor: 'Diretor Comercial',
  superintendente: 'Superintendente',
};

export const LEVEL_ORDER: ApprovalLevel[] = ['gerente', 'diretor', 'superintendente'];

export interface ApprovalSettings {
  gerente_threshold: number;
  diretor_threshold: number;
  superintendente_threshold: number;
}

export const DEFAULT_SETTINGS: ApprovalSettings = {
  gerente_threshold: 5,
  diretor_threshold: 10,
  superintendente_threshold: 15,
};

export function getThresholds(settings: ApprovalSettings): Record<ApprovalLevel, number> {
  return {
    gerente: settings.gerente_threshold,
    diretor: settings.diretor_threshold,
    superintendente: settings.superintendente_threshold,
  };
}

export function getRequiredLevels(deviationPct: number, settings: ApprovalSettings): ApprovalLevel[] {
  const absDev = Math.abs(deviationPct);
  if (deviationPct >= 0 || absDev === 0) return [];
  const levels: ApprovalLevel[] = [];
  if (absDev > 0) levels.push('gerente');
  if (absDev > settings.gerente_threshold) levels.push('diretor');
  if (absDev > settings.diretor_threshold) levels.push('superintendente');
  return levels;
}

export function getHighestLevel(levels: ApprovalLevel[]): ApprovalLevel | null {
  if (levels.length === 0) return null;
  return levels[levels.length - 1];
}

export function isDeviationBlocked(deviationPct: number, settings: ApprovalSettings): boolean {
  return Math.abs(deviationPct) > settings.superintendente_threshold;
}

export function calculateDeviation(cost: number, salePrice: number): number {
  if (cost === 0) return 0;
  return ((salePrice - cost) / cost) * 100;
}

export const LB_PER_KG = 2.20462;
