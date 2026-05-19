export type InvestmentType = '주식' | '코인' | '주택청약' | '부동산' | '연금' | '적금';

export interface AccountItem {
  id: string;
  name: string;
  owner?: string;      // 소유자 (수빈/지현)
  principal: number;   // 총 투자 원금 (누적)
  currentValue: number; // 현재 평가액
  deposit?: number;    // 당월 입금액
  withdrawal?: number; // 당월 출금액
}

export interface CategoryData {
  type: InvestmentType;
  items: AccountItem[];
}

export interface MonthlySnapshot {
  id: string; // YYYY-MM
  date: string; // YYYY-MM
  categories: CategoryData[];
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}

export interface HouseholdSnapshot {
  id: string; // YYYY-MM
  date: string; // YYYY-MM
  transactions: Transaction[];
}

export interface CalculatedStats {
  totalPrincipal: number;
  totalValue: number;
  totalProfit: number;
  totalROI: number;
  totalMonthlyROI?: number;
  totalMonthlyProfit?: number;
  totalAnnualROI?: number;
  totalYearlyProfit?: number;
  totalDeposit: number;
  totalWithdrawal: number;
  categoryStats: {
    type: InvestmentType;
    principal: number;
    value: number;
    profit: number;
    roi: number;
    weight: number;
    deposit: number;
    withdrawal: number;
    monthlyRoi?: number;
    annualRoi?: number;
    items: AccountItem[];
  }[];
}

export interface HouseholdStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}
