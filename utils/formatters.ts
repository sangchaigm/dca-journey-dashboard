
export const formatCurrency = (value: number, currency: string = 'THB'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value).replace(currency, '').trim() + ` ${currency}`;
};

export const formatCompactNumber = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatFullDate = (date: Date): string => {
  return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
  }).replace(',', '');
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};
