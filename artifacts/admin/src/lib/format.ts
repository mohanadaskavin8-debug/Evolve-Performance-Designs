export function formatCurrency(cents: number | undefined | null, currency: string = 'USD'): string {
  if (cents === undefined || cents === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '-';
  return new Intl.NumberFormat('en-US').format(num);
}
