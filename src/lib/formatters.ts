export function formatKES(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'KSh 0.00';
  }
  const num = Number(amount);
  return `KSh ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatKm(km: number | string | null | undefined): string {
  if (km === null || km === undefined || isNaN(Number(km))) {
    return '0 km';
  }
  return `${Number(km).toLocaleString('en-KE')} km`;
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return '0';
  }
  return Number(num).toLocaleString('en-KE');
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

