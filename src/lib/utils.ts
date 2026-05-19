import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(num));
}

export function formatPercent(num: number) {
  return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`;
}

export function formatCurrency(num: number) {
  return `${formatNumber(num)}원`;
}
