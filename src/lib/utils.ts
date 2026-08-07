import type { PriceTableItem, AuditLogEntry, Approval, PriceTable } from './supabase';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}%`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function deviationColor(deviationPct: number): string {
  if (deviationPct >= 0) return 'text-brand-600';
  const abs = Math.abs(deviationPct);
  if (abs <= 5) return 'text-warning-600';
  if (abs <= 10) return 'text-orange-600';
  if (abs <= 15) return 'text-error-600';
  return 'text-error-700 font-bold';
}

export function deviationBgColor(deviationPct: number): string {
  if (deviationPct >= 0) return 'bg-brand-50';
  const abs = Math.abs(deviationPct);
  if (abs <= 5) return 'bg-warning-50';
  if (abs <= 10) return 'bg-orange-50';
  if (abs <= 15) return 'bg-error-50';
  return 'bg-error-100';
}

export function generateXLSX(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  // XLSX export using SpreadsheetML XML format (no external deps)
  const escapeXml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
  xml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Worksheet ss:Name="Dados">\n<Table>\n';

  // Header row
  xml += '<Row>';
  headers.forEach((h) => {
    xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
  });
  xml += '</Row>\n';

  // Data rows
  rows.forEach((row) => {
    xml += '<Row>';
    row.forEach((cell) => {
      if (typeof cell === 'number') {
        xml += `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
      } else {
        xml += `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`;
      }
    });
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getAuditEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    table_created: 'Tabela Criada',
    product_added: 'Produto Adicionado',
    price_changed: 'Preço Alterado',
    submitted_for_approval: 'Enviado para Aprovação',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    published: 'Publicada',
    draft_saved: 'Rascunho Salvo',
  };
  return labels[eventType] || eventType;
}

export function summarizeItemChanges(items: PriceTableItem[]): string {
  if (items.length === 0) return 'Nenhum item';
  return `${items.length} produto${items.length > 1 ? 's' : ''}`;
}

export function auditDetailsToString(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (value === null || value === undefined) continue;
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.join(' | ');
}
