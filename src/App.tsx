/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  Plus, 
  History, 
  Trash2, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Wallet,
  Coins,
  Building,
  PiggyBank,
  Briefcase,
  Layers,
  Settings,
  Download,
  Upload,
  X,
  Edit2,
  Save,
  RefreshCcw,
  Search,
  ShoppingCart,
  Receipt,
  ArrowRightLeft,
  Calculator
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
  Label,
  LabelList
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, parse, subMonths, isSameMonth, startOfMonth, addMonths } from 'date-fns';
import Papa from 'papaparse';
import { cn, formatNumber, formatPercent, formatCurrency } from './lib/utils';
import { getSeedSnapshots } from './seedData';
import { 
  InvestmentType, 
  MonthlySnapshot, 
  CategoryData, 
  AccountItem, 
  CalculatedStats,
  Transaction,
  HouseholdSnapshot,
  HouseholdStats
} from './types';

const INVESTMENT_TYPES: InvestmentType[] = ['주식', '코인', '주택청약', '부동산', '연금', '적금'];

const CATEGORY_CONFIG: Record<InvestmentType, { icon: React.ElementType, color: string }> = {
  '주식': { icon: TrendingUp, color: '#FFC19E' },
  '코인': { icon: Coins, color: '#D1B2FF' },
  '주택청약': { icon: Target, color: '#FFB2D9' },
  '부동산': { icon: Building, color: '#B2EBF4' },
  '연금': { icon: Briefcase, color: '#CEF279' },
  '적금': { icon: PiggyBank, color: '#B2CCFF' },
};

// --- Components ---

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  subValueClassName?: string;
  trend?: number;
  icon: React.ElementType;
  className?: string;
  onClick?: () => void;
  action?: React.ReactNode;
}

const StatCard = ({ title, value, subValue, subValueClassName, trend, icon: Icon, className, onClick, action }: StatCardProps) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm transition-all relative overflow-hidden", 
      onClick && "cursor-pointer hover:shadow-md hover:border-neutral-300",
      className
    )}
  >
    <div className="flex justify-between items-center mb-6 relative z-10">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h4 className="font-bold text-sm text-neutral-900">{title}</h4>
      </div>
      <div className="flex items-center gap-2">
        {action}
      </div>
    </div>
    <div>
      <h3 className="text-base font-bold tracking-tight text-neutral-900">{value}</h3>
      {subValue && <p className={cn("text-xs text-neutral-400 mt-1", subValueClassName)}>{subValue}</p>}
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [householdSnapshots, setHouseholdSnapshots] = useState<HouseholdSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'household'>('dashboard');
  const [selectedAssetCategory, setSelectedAssetCategory] = useState<InvestmentType | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isNetWorthModalOpen, setIsNetWorthModalOpen] = useState(false);
  const [isROIModalOpen, setIsROIModalOpen] = useState(false);
  const [roiPeriod, setRoiPeriod] = useState<'cumulative' | 'annual' | 'monthly'>('cumulative');
  const [customSyncUrl, setCustomSyncUrl] = useState(() => localStorage.getItem('last_sync_url') || '');
  const [syncTarget, setSyncTarget] = useState<'assets' | 'household'>('assets');

  // Persist sync URL
  useEffect(() => {
    localStorage.setItem('last_sync_url', customSyncUrl);
  }, [customSyncUrl]);

  const availableMonths = useMemo(() => {
    const months = new Set([...snapshots.map(s => s.date), ...householdSnapshots.map(s => s.date)]);
    
    // Ensure all months from 2025-01 to current month + some future are available
    const start = new Date(2025, 0, 1);
    const end = addMonths(new Date(), 6);
    let curr = start;
    while (curr <= end) {
      months.add(format(curr, 'yyyy-MM'));
      curr = addMonths(curr, 1);
    }
    
    return Array.from(months).sort().reverse();
  }, [snapshots, householdSnapshots]);

  // Load from LocalStorage
  useEffect(() => {
    const savedAssets = localStorage.getItem('investment_v2_snapshots');
    const savedHousehold = localStorage.getItem('investment_v2_household');
    
    if (savedAssets) {
      let parsed = JSON.parse(savedAssets);
      // Migrate "저축" to "적금" and filter out obsolete categories from loaded data
      parsed = parsed.map((s: any) => ({
        ...s,
        categories: s.categories.map((c: any) => {
          if (c.type === '저축') return { ...c, type: '적금' };
          return c;
        }).filter((c: any) => INVESTMENT_TYPES.includes(c.type as any))
      }));

      if (parsed.length > 0 && parsed.some((s: any) => s.categories.some((c: any) => c.items.length > 0))) {
        setSnapshots(parsed);
        const latest = [...parsed].sort((a,b) => b.date.localeCompare(a.date))[0]?.date;
        if (latest) setSelectedMonth(latest);
      } else {
        const seeded = getSeedSnapshots();
        setSnapshots(seeded);
        setSelectedMonth(seeded[seeded.length - 1].date);
      }
    } else {
      const seeded = getSeedSnapshots();
      setSnapshots(seeded);
      setSelectedMonth(seeded[seeded.length - 1].date);
    }

    if (savedHousehold) setHouseholdSnapshots(JSON.parse(savedHousehold));
    
    if (!savedHousehold) {
      const initialHH: HouseholdSnapshot = {
        id: selectedMonth,
        date: selectedMonth,
        transactions: []
      };
      setHouseholdSnapshots([initialHH]);
    }
    
    setIsInitialized(true);
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('investment_v2_snapshots', JSON.stringify(snapshots));
      localStorage.setItem('investment_v2_household', JSON.stringify(householdSnapshots));
    }
  }, [snapshots, householdSnapshots, isInitialized]);

  const currentSnapshot = useMemo(() => {
    const snap = snapshots.find(s => s.date === selectedMonth);
    if (snap) {
      return {
        ...snap,
        categories: snap.categories.filter(c => INVESTMENT_TYPES.includes(c.type as any))
      };
    }
    return {
      id: selectedMonth,
      date: selectedMonth,
      categories: INVESTMENT_TYPES.map(type => ({ type, items: [] }))
    };
  }, [snapshots, selectedMonth]);

  const [householdPeriod, setHouseholdPeriod] = useState<'monthly' | 'yearly' | 'cumulative'>('monthly');

  const householdStats = useMemo(() => {
    const selectedDate = parse(selectedMonth, 'yyyy-MM', new Date());
    const selectedYear = format(selectedDate, 'yyyy');

    // All transactions up to selected month
    const allTransactions = householdSnapshots
      .filter(s => s.date <= selectedMonth)
      .flatMap(s => s.transactions);

    // Yearly transactions
    const yearlyTransactions = householdSnapshots
      .filter(s => s.date.startsWith(selectedYear) && s.date <= selectedMonth)
      .flatMap(s => s.transactions);

    // Current monthly
    const currentHH = householdSnapshots.find(s => s.date === selectedMonth) || { transactions: [] };
    const monthlyTransactions = currentHH.transactions;

    const calc = (txs: Transaction[]) => {
      const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      const catMap: Record<string, number> = {};
      txs.filter(t => t.type === 'expense').forEach(t => {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      });

      const categoryBreakdown = Object.entries(catMap).map(([category, amount]) => ({
        category,
        amount,
        percentage: expense > 0 ? (amount / expense) * 100 : 0
      })).sort((a,b) => b.amount - a.amount);

      return { 
        income, 
        expense, 
        net: income - expense, 
        categoryBreakdown,
        expenseRatio: income > 0 ? (expense / income) * 100 : 0
      };
    };

    const monthly = calc(monthlyTransactions);
    const yearly = calc(yearlyTransactions);
    const cumulative = calc(allTransactions);

    // Calculate trends (comparing to previous month for current monthly view)
    const prevMonthStr = format(subMonths(selectedDate, 1), 'yyyy-MM');
    const prevHH = householdSnapshots.find(s => s.date === prevMonthStr);
    const prevMonthly = calc(prevHH?.transactions || []);

    return {
      monthly,
      yearly,
      cumulative,
      trends: {
        income: prevMonthly.income ? ((monthly.income - prevMonthly.income) / prevMonthly.income) * 100 : 0,
        expense: prevMonthly.expense ? ((monthly.expense - prevMonthly.expense) / prevMonthly.expense) * 100 : 0,
      }
    };
  }, [householdSnapshots, selectedMonth]);

  const currentHouseholdSnapshot = useMemo(() => {
    return householdSnapshots.find(s => s.date === selectedMonth) || {
      id: selectedMonth,
      date: selectedMonth,
      transactions: []
    };
  }, [householdSnapshots, selectedMonth]);

  const selectedCategoryTrend = useMemo(() => {
    if (!selectedAssetCategory) return [];
    
    // Sort all available dates
    const sortedDates = [...snapshots].map(s => s.date).sort();
    
    return sortedDates.map(date => {
      const snap = snapshots.find(s => s.date === date);
      const category = snap?.categories.find(c => c.type === selectedAssetCategory);
      if (!category) return { date, principal: 0, value: 0 };
      
      const principal = category.items?.reduce((sum, item) => sum + (item.principal || 0), 0) || 0;
      const value = category.items?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
      
      return {
        date,
        principal,
        value
      };
    });
  }, [snapshots, selectedAssetCategory]);

  const stackedTrendData = useMemo(() => {
    const sortedDates = [...snapshots].map(s => s.date).sort();
    return sortedDates.map(date => {
      const snap = snapshots.find(s => s.date === date);
      const data: any = { 
        date, 
        monthLabel: date.substring(2, 4) + '.' + date.split('-')[1] 
      };
      
      INVESTMENT_TYPES.forEach(type => {
        const category = snap?.categories.find(c => c.type === type);
        const value = category?.items?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
        data[type] = value;
      });
      
      return data;
    });
  }, [snapshots]);

  const getCategoryTrend = (type: string) => {
    const sortedDates = [...snapshots].map(s => s.date).sort();
    let hasFoundData = false;
    return sortedDates.map(date => {
      const snap = snapshots.find(s => s.date === date);
      const category = snap?.categories.find(c => c.type === type);
      const principal = category?.items?.reduce((sum, item) => sum + (item.principal || 0), 0) || 0;
      const value = category?.items?.reduce((sum, item) => sum + (item.currentValue || 0), 0) || 0;
      
      if (!hasFoundData && (principal !== 0 || value !== 0)) {
        hasFoundData = true;
      }
      
      return { 
        date, 
        monthLabel: date.substring(2, 4) + '.' + date.split('-')[1],
        principal: hasFoundData ? principal : null, 
        value: hasFoundData ? value : null 
      };
    });
  };

  const calculateStats = (snapshot: MonthlySnapshot, allSnapshots: MonthlySnapshot[]): CalculatedStats => {
    // Get previous month to calculate monthly ROI
    const sortedDates = allSnapshots.map(s => s.date).sort();
    const currentIdx = sortedDates.indexOf(snapshot.date);
    const prevMonthDate = currentIdx > 0 ? sortedDates[currentIdx - 1] : null;
    const prevSnapshot = prevMonthDate ? allSnapshots.find(s => s.date === prevMonthDate) : null;

    // Get start of year snapshot
    const currentYear = snapshot.date.split('-')[0];
    const prevYearDecDate = `${parseInt(currentYear) - 1}-12`;
    const startOfYearSnapshot = allSnapshots.find(s => s.date === prevYearDecDate) || 
                                allSnapshots.filter(s => s.date.startsWith(currentYear)).sort((a,b) => a.date.localeCompare(b.date))[0];

    const typeStats = snapshot.categories
      .filter(cat => INVESTMENT_TYPES.includes(cat.type as any))
      .map(cat => {
      const originalItems = cat.items || [];
      
      // Calculate individual item stats (including automatic deposit/withdrawal)
      const items = originalItems.map(item => {
        let deposit = item.deposit || 0;
        let withdrawal = item.withdrawal || 0;

        // If deposit/withdrawal aren't explicitly set, calculate from principal difference
        if (deposit === 0 && withdrawal === 0) {
          if (prevSnapshot) {
            const prevCat = prevSnapshot.categories.find(c => c.type === cat.type);
            const prevItem = prevCat?.items.find(i => i.name === item.name && i.owner === item.owner);
            
            if (prevItem) {
              const principalDiff = item.principal - prevItem.principal;
              if (principalDiff > 0) deposit = principalDiff;
              else if (principalDiff < 0) withdrawal = Math.abs(principalDiff);
            } else {
              // New item in this month: entire principal is treated as deposit
              deposit = item.principal;
            }
          } else {
            // First month of data: entire principal is treated as deposit
            deposit = item.principal;
          }
        }

        // Return rate calculations
        const itemProfit = item.currentValue - item.principal;
        const itemRoi = item.principal > 0 ? (itemProfit / item.principal) * 100 : 0;
        
        let itemMonthlyRoi = itemRoi;
        if (prevSnapshot) {
          const prevCat = prevSnapshot.categories.find(c => c.type === cat.type);
          const prevItem = prevCat?.items.find(i => i.name === item.name && i.owner === item.owner);
          if (prevItem && prevItem.currentValue > 0) {
            // 월수익율: (당월평가금액 - 전월평가금액 - 당월입금액 + 당월출금액) / 전월평가금액
            itemMonthlyRoi = ((item.currentValue - prevItem.currentValue - deposit + withdrawal) / prevItem.currentValue) * 100;
          }
        }

        let itemAnnualRoi = itemRoi;
        if (startOfYearSnapshot && startOfYearSnapshot.date !== snapshot.date) {
          const startCat = startOfYearSnapshot.categories.find(c => c.type === cat.type);
          const startItem = startCat?.items.find(i => i.name === item.name && i.owner === item.owner);
          if (startItem && startItem.currentValue > 0) {
            // 연수익율: (현재 평가금액 - 시작 평가금액 - 추가입금액) / 시작 평가금액
            const startValue = startItem.currentValue;
            const additionalDeposit = item.principal - startItem.principal;
            itemAnnualRoi = ((item.currentValue - startValue - additionalDeposit) / startValue) * 100;
          }
        }

        return { ...item, deposit, withdrawal, roi: itemRoi, monthlyRoi: itemMonthlyRoi, annualRoi: itemAnnualRoi };
      });

      const principal = items.reduce((sum, item) => sum + item.principal, 0);
      const value = items.reduce((sum, item) => sum + item.currentValue, 0);
      const totalDeposit = items.reduce((sum, item) => sum + (item.deposit || 0), 0);
      const totalWithdrawal = items.reduce((sum, item) => sum + (item.withdrawal || 0), 0);
      
      const profit = value - principal;
      // 누적 수익률 (Cumulative ROI): (평가금액-입금액)/입금액
      const cumulativeRoi = principal > 0 ? (profit / principal) * 100 : 0;
      
      // 월 수익률 (Monthly ROI): (현재월자산-전월자산)/현재월자산
      let monthlyRoi = cumulativeRoi;
      if (prevSnapshot) {
        const prevCat = prevSnapshot.categories.find(c => c.type === cat.type);
        const prevItems = prevCat?.items || [];
        const prevValue = prevItems.reduce((sum, item) => sum + item.currentValue, 0) || 0;
        if (prevValue > 0) {
          // 월수익율: (당월평가금액 - 전월평가금액 - 당월입금액 + 당월출금액) / 전월평가금액
          monthlyRoi = ((value - prevValue - totalDeposit + totalWithdrawal) / prevValue) * 100;
        }
      }

      // 연 수익률 (Year-to-date ROI): (현재 평가금액 - 시작 평가금액 - 추가입금액) / 시작 평가금액
      let annualRoi = cumulativeRoi;
      if (startOfYearSnapshot && startOfYearSnapshot.date !== snapshot.date) {
        const startCat = startOfYearSnapshot.categories.find(c => c.type === cat.type);
        const startItems = startCat?.items || [];
        const startValue = startItems.reduce((sum, item) => sum + item.currentValue, 0) || 0;
        const startPrincipal = startItems.reduce((sum, item) => sum + item.principal, 0) || 0;
        
        if (startValue > 0) {
          const additionalDeposit = principal - startPrincipal;
          annualRoi = ((value - startValue - additionalDeposit) / startValue) * 100;
        }
      }
      
      return {
        type: cat.type,
        principal,
        value,
        profit,
        roi: cumulativeRoi,
        monthlyRoi,
        annualRoi,
        deposit: totalDeposit,
        withdrawal: totalWithdrawal,
        items
      };
    });

    const totalPrincipal = typeStats.reduce((sum, s) => sum + s.principal, 0);
    const totalValue = typeStats.reduce((sum, s) => sum + s.value, 0);
    const totalDeposit = typeStats.reduce((sum, s) => sum + s.deposit, 0);
    const totalWithdrawal = typeStats.reduce((sum, s) => sum + s.withdrawal, 0);
    const totalProfit = totalValue - totalPrincipal;
    // 누적 수익률 (Cumulative ROI): (평가금액-입금액)/입금액
    const totalROI = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;

    let totalMonthlyROI = totalROI;
    let totalMonthlyProfit = totalProfit;
    if (prevSnapshot) {
      const prevTotalValue = prevSnapshot.categories.reduce((sum, cat) => {
        return sum + (cat.items?.reduce((s, i) => s + i.currentValue, 0) || 0);
      }, 0);
      if (prevTotalValue > 0) {
        // 월수익율: (당월평가금액 - 전월평가금액 - 당월입금액 + 당월출금액) / 전월평가금액
        totalMonthlyROI = ((totalValue - prevTotalValue - totalDeposit + totalWithdrawal) / prevTotalValue) * 100;
        totalMonthlyProfit = totalValue - prevTotalValue - totalDeposit + totalWithdrawal;
      }
    }

    let totalAnnualROI = totalROI;
    let totalYearlyProfit = totalProfit;
    if (startOfYearSnapshot && startOfYearSnapshot.date !== snapshot.date) {
      const startTotalValue = startOfYearSnapshot.categories.reduce((sum, cat) => {
        return sum + (cat.items?.reduce((s, i) => s + i.currentValue, 0) || 0);
      }, 0);
      const startTotalPrincipal = startOfYearSnapshot.categories.reduce((sum, cat) => {
        return sum + (cat.items?.reduce((s, i) => s + i.principal, 0) || 0);
      }, 0);
      
      if (startTotalValue > 0) {
        // 연수익율: (현재 평가금액 - 시작 평가금액 - 추가입금액) / 시작 평가금액
        const additionalDeposit = totalPrincipal - startTotalPrincipal;
        totalAnnualROI = ((totalValue - startTotalValue - additionalDeposit) / startTotalValue) * 100;
        totalYearlyProfit = totalValue - startTotalValue - additionalDeposit;
      }
    }

    const categoryStats = typeStats.map(s => {
      return {
        ...s,
        weight: totalValue > 0 ? (s.value / totalValue) * 100 : 0
      };
    });

    return { 
      totalPrincipal, 
      totalValue, 
      totalProfit, 
      totalROI, 
      totalMonthlyROI,
      totalMonthlyProfit,
      totalAnnualROI,
      totalYearlyProfit,
      totalDeposit, 
      totalWithdrawal, 
      categoryStats 
    };
  };

  const currentStats = useMemo(() => calculateStats(currentSnapshot, snapshots), [currentSnapshot, snapshots]);

  const comparisons = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));
    const currentIndex = sorted.findIndex(s => s.date === selectedMonth);
    const prevMonth = sorted[currentIndex + 1];
    
    const prevYearStr = format(subMonths(parse(selectedMonth, 'yyyy-MM', new Date()), 12), 'yyyy-MM');
    const prevYear = snapshots.find(s => s.date === prevYearStr);

    const peakMonth = snapshots.reduce((max, curr) => {
      const stats = calculateStats(curr, snapshots);
      if (!max) return curr;
      const maxStats = calculateStats(max, snapshots);
      return stats.totalROI > maxStats.totalROI ? curr : max;
    }, snapshots[0]);

    return {
      prevMonth: prevMonth ? calculateStats(prevMonth, snapshots) : null,
      prevYear: prevYear ? calculateStats(prevYear, snapshots) : null,
      peak: peakMonth ? calculateStats(peakMonth, snapshots) : null
    };
  }, [snapshots, selectedMonth]);

  const updateAccount = (type: InvestmentType, itemId: string | null, data: Partial<AccountItem>) => {
    setSnapshots(prev => {
      const snapshotIndex = prev.findIndex(s => s.date === selectedMonth);
      const newSnapshots = [...prev];
      let snapshot: MonthlySnapshot;

      if (snapshotIndex === -1) {
        snapshot = {
          id: selectedMonth,
          date: selectedMonth,
          categories: INVESTMENT_TYPES.map(t => ({ type: t, items: [] }))
        };
        newSnapshots.push(snapshot);
      } else {
        snapshot = { ...newSnapshots[snapshotIndex] };
        newSnapshots[snapshotIndex] = snapshot;
      }

      const catIndex = snapshot.categories.findIndex(c => c.type === type);
      const category = { ...snapshot.categories[catIndex] };
      if (!category.items) category.items = [];
      snapshot.categories[catIndex] = category;

      if (itemId === null) {
        // Add new
        category.items = [...category.items, { 
          id: crypto.randomUUID(), 
          name: data.name || '새 계좌', 
          owner: data.owner,
          principal: data.principal || 0, 
          currentValue: data.currentValue || 0 
        }];
      } else {
        // Edit or Delete
        if (Object.keys(data).length === 0) {
          // Delete
          category.items = (category.items || []).filter(i => i.id !== itemId);
        } else {
          // Update
          category.items = (category.items || []).map(i => i.id === itemId ? { ...i, ...data } : i);
        }
      }

      return newSnapshots;
    });
  };

  const updateTransaction = (itemId: string | null, data: Partial<Transaction>) => {
    setHouseholdSnapshots(prev => {
      const snapshotIndex = prev.findIndex(s => s.date === selectedMonth);
      const newSnapshots = [...prev];
      let snapshot: HouseholdSnapshot;

      if (snapshotIndex === -1) {
        snapshot = {
          id: selectedMonth,
          date: selectedMonth,
          transactions: []
        };
        newSnapshots.push(snapshot);
      } else {
        snapshot = { ...newSnapshots[snapshotIndex] };
        newSnapshots[snapshotIndex] = snapshot;
      }

      if (itemId === null) {
        // Add
        snapshot.transactions = [...snapshot.transactions, {
          id: crypto.randomUUID(),
          date: data.date || `${selectedMonth}-01`,
          category: data.category || '기타',
          description: data.description || '새 내역',
          amount: data.amount || 0,
          type: data.type || 'expense'
        }];
      } else if (Object.keys(data).length === 0) {
        // Delete
        snapshot.transactions = snapshot.transactions.filter(t => t.id !== itemId);
      } else {
        // Update
        snapshot.transactions = snapshot.transactions.map(t => t.id === itemId ? { ...t, ...data } : t);
      }

      return newSnapshots;
    });
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const DEFAULT_ASSET_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1KFH1f3rBBxqJDfuL5Tg0473Mql-vCFYPQ-1HMN7V7DU/edit?gid=1734480802';
  const DEFAULT_HOUSEHOLD_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1KFH1f3rBBxqJDfuL5Tg0473Mql-vCFYPQ-1HMN7V7DU/edit?gid=258015051';

  const getSheetVal = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const target = key.replace(/\s/g, '').toLowerCase();
      const foundKey = rowKeys.find(rk => {
        const clean = rk.trim().replace(/^\uFEFF/, '').replace(/\s/g, '').toLowerCase();
        return clean === target || clean.includes(target) || target.includes(clean);
      });
      if (foundKey) return row[foundKey];
    }
    return undefined;
  };

  const handleImportHouseholdCSVData = (data: any[]) => {
    const firstRowKeys = Object.keys(data[0] || {});
    // 가로 형식 감지: '구분'이 있고 '월'을 포함하는 헤더가 많은 경우
    const isHorizontal = firstRowKeys.some(k => k.includes('구분')) && firstRowKeys.some(k => k.includes('월'));

    const newSnapshots: Record<string, HouseholdSnapshot> = {};

    if (isHorizontal) {
      const keys = Object.keys(data[0]);
      const monthColumns: { key: string, date: string }[] = [];
      let currentMonth = "";

      keys.forEach((key) => {
        const cleanKey = key.trim().replace(/\s/g, '');
        const dateMatch = cleanKey.match(/(\d{4})[년](\d{1,2})[월]/);
        if (dateMatch) {
          currentMonth = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}`;
          monthColumns.push({ key, date: currentMonth });
        }
      });

      data.forEach(row => {
        const majorCategory = String(row[keys[0]] || '').trim();
        const detailItem = String(row[keys[1]] || '').trim();
        
        if (!majorCategory && !detailItem) return;
        if (majorCategory.includes('합계') || majorCategory.includes('구분')) return;

        const type: 'income' | 'expense' = (majorCategory.includes('급여') || majorCategory.includes('수입')) ? 'income' : 'expense';

        monthColumns.forEach(col => {
          if (!newSnapshots[col.date]) {
            newSnapshots[col.date] = {
              id: col.date,
              date: col.date,
              transactions: []
            };
          }

          const amountVal = String(row[col.key] || '0').replace(/[^0-9.-]/g, '');
          const amount = Number(amountVal) || 0;

          if (amount !== 0) {
            newSnapshots[col.date].transactions.push({
              id: crypto.randomUUID(),
              date: `${col.date}-01`,
              amount: Math.abs(amount),
              type,
              category: majorCategory,
              description: detailItem || majorCategory
            });
          }
        });
      });

      const months = Object.keys(newSnapshots).sort();
      if (months.length > 0) {
        setHouseholdSnapshots(prev => {
          const merged = [...prev];
          Object.values(newSnapshots).forEach(s => {
            const idx = merged.findIndex(m => m.date === s.date);
            if (idx >= 0) merged[idx] = s;
            else merged.push(s);
          });
          return merged.sort((a,b) => b.date.localeCompare(a.date));
        });
        return months;
      }
    }

    data.forEach((row) => {
      const dateVal = getSheetVal(row, ['날짜', 'Date', '일자', 'date', '기준일', '사용일']);
      if (!dateVal) return;

      let rawDate = String(dateVal).trim();
      let normalizedMonth = '';
      let normalizedFullDate = '';

      // Try to parse date
      // Support YYYY.MM.DD, YYYY-MM-DD, YYYYMMDD, YYYY년 MM월 DD일
      const dateMatch = rawDate.match(/(\d{4})[./-\s년]*(\d{1,2})[./-\s월]*(\d{1,2})?[일]?/);
      if (dateMatch) {
        const year = dateMatch[1];
        const month = dateMatch[2].padStart(2, '0');
        const day = (dateMatch[3] || '01').padStart(2, '0');
        normalizedMonth = `${year}-${month}`;
        normalizedFullDate = `${year}-${month}-${day}`;
      }

      if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) return;

      if (!newSnapshots[normalizedMonth]) {
        newSnapshots[normalizedMonth] = {
          id: normalizedMonth,
          date: normalizedMonth,
          transactions: []
        };
      }

      const amountStr = String(getSheetVal(row, ['금액', 'Amount', '값', '지출', '수입', '금액(원)', '입금금액', '출금금액']) || '0');
      const amount = Number(amountStr.replace(/[^0-9.-]/g, '')) || 0;
      const typeStr = String(getSheetVal(row, ['구분', 'Type', '분류', '수입/지출', '항목']) || '').trim();
      const type: 'income' | 'expense' = (typeStr.includes('수입') || typeStr.toLowerCase().includes('income') || (amount > 0 && typeStr === '')) ? 'income' : 'expense';
      const category = String(getSheetVal(row, ['카테고리', 'Category', '항목', '분류', '구분2']) || '기타').trim();
      const description = String(getSheetVal(row, ['내용', 'Description', '적요', '메모', '품목', '상세내역', '입금내역', '출금내역']) || '').trim();

      if (amount !== 0) {
        newSnapshots[normalizedMonth].transactions.push({
          id: crypto.randomUUID(),
          date: normalizedFullDate,
          amount: Math.abs(amount),
          type,
          category,
          description
        });
      }
    });

    const months = Object.keys(newSnapshots).sort();
    if (months.length > 0) {
      setHouseholdSnapshots(prev => {
        const merged = [...prev];
        Object.values(newSnapshots).forEach(s => {
          const idx = merged.findIndex(m => m.date === s.date);
          if (idx >= 0) {
            // Merge transactions safely or replace? Replacing for simplicity as snapshots are monthly
            merged[idx] = s;
          } else {
            merged.push(s);
          }
        });
        return merged.sort((a,b) => b.date.localeCompare(a.date));
      });
    }
    return months;
  };

  const handleImportCSVData = (data: any[]) => {
    // Check for horizontal format (Months as columns)
    const firstRowKeys = Object.keys(data[0] || {});
    const isHorizontal = firstRowKeys.some(k => k.includes('월')) && firstRowKeys.length > 5;

    const newSnapshots: Record<string, MonthlySnapshot> = {};

    if (isHorizontal) {
      const monthColumns: { key: string, date: string, type: 'principal' | 'value' }[] = [];
      const keys = Object.keys(data[0]);
      
      let currentMonth = "";
      keys.forEach((key, idx) => {
        const cleanKey = key.trim().replace(/\s/g, '');
        const dateMatch = cleanKey.match(/(\d{4})[년](\d{1,2})[월]/);
        if (dateMatch) {
          currentMonth = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}`;
        }
        
        if (currentMonth) {
          const nextKey = keys[idx+1];
          if (nextKey && nextKey.includes(dateMatch ? dateMatch[0] : currentMonth)) {
             monthColumns.push({ key, date: currentMonth, type: 'principal' });
          } else if (idx > 0 && keys[idx-1].includes(currentMonth)) {
             monthColumns.push({ key, date: currentMonth, type: 'value' });
          } else {
             if (idx % 2 === 0) monthColumns.push({ key, date: currentMonth, type: 'principal' });
             else monthColumns.push({ key, date: currentMonth, type: 'value' });
          }
        }
      });

      data.forEach(row => {
        const categoryVal = (String(getSheetVal(row, ['카테고리', 'Category', '분류', '구분']) || row[keys[0]] || '')).trim();
        const accountVal = (String(getSheetVal(row, ['계좌명', 'Account', '상품명', '내역', '항목명', '항목', '자산명']) || row[keys[1]] || '')).trim();
        const ownerMatch = accountVal.match(/^(수빈|지현)/) || categoryVal.match(/^(수빈|지현)/);
        const owner = ownerMatch ? ownerMatch[1] : '';
        const name = accountVal;

        if (!categoryVal || categoryVal.includes('합계') || categoryVal.includes('월')) return;

        let matchedType: InvestmentType | null = null;
        if (categoryVal.includes('주식')) matchedType = '주식';
        else if (categoryVal.includes('코인') || categoryVal.includes('가상화폐')) matchedType = '코인';
        else if (categoryVal.includes('청약')) matchedType = '주택청약';
        else if (categoryVal.includes('부동산')) matchedType = '부동산';
        else if (categoryVal.includes('연금')) matchedType = '연금';
        else if (categoryVal.includes('저축') || categoryVal.includes('적금') || categoryVal.includes('예금')) matchedType = '적금';

        if (!matchedType) return;

        monthColumns.forEach(col => {
          if (!newSnapshots[col.date]) {
            newSnapshots[col.date] = {
              id: col.date,
              date: col.date,
              categories: INVESTMENT_TYPES.map(type => ({ type, items: [] }))
            };
          }

          const cat = newSnapshots[col.date].categories.find(c => c.type === matchedType);
          if (cat) {
            let item = cat.items.find(i => i.name === name);
            if (!item) {
              item = {
                id: crypto.randomUUID(),
                name,
                owner: owner || undefined,
                principal: 0,
                currentValue: 0,
                deposit: 0,
                withdrawal: 0
              };
              cat.items.push(item);
            }

            const val = Number(String(row[col.key] || '0').replace(/[^0-9.-]/g, '')) || 0;
            if (col.type === 'principal') item.principal = val;
            else item.currentValue = val;
          }
        });
      });

      const months = Object.keys(newSnapshots).sort();
      if (months.length > 0) {
        setSnapshots(prev => {
          const merged = [...prev];
          Object.values(newSnapshots).forEach(s => {
            const idx = merged.findIndex(m => m.date === s.date);
            if (idx >= 0) merged[idx] = s;
            else merged.push(s);
          });
          return merged.sort((a,b) => b.date.localeCompare(a.date));
        });
        return months;
      }
    }

    data.forEach((row) => {
      const dateVal = getSheetVal(row, ['날짜', 'Month', 'Date', '기준월', '월', 'date', '기준일', '기준']);
      if (!dateVal) return;

      let normalizedDate = String(dateVal).trim();
      
      const dateMatch = normalizedDate.match(/(\d{4})[./-\s년]*(\d{1,2})[월]?/);
      if (dateMatch) {
        normalizedDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}`;
      } else if (normalizedDate.length === 6 && /^\d+$/.test(normalizedDate)) {
        normalizedDate = `${normalizedDate.substring(0, 4)}-${normalizedDate.substring(4, 6)}`;
      }

      if (!/^\d{4}-\d{2}$/.test(normalizedDate)) return;

      if (!newSnapshots[normalizedDate]) {
        newSnapshots[normalizedDate] = {
          id: normalizedDate,
          date: normalizedDate,
          categories: INVESTMENT_TYPES.map(type => ({ type, items: [] }))
        };
      }

      const catName = String(getSheetVal(row, ['카테고리', 'Category', '분류', '항목', 'type', '구분', '자산형태', '그룹', '대분류', '저축', '적금', '자산']) || '').trim().toLowerCase();
      let matchedType = INVESTMENT_TYPES.find(t => t.toLowerCase() === catName);
      if (!matchedType) {
        if (catName.includes('주식')) matchedType = '주식';
        else if (catName.includes('코인') || catName.includes('가상화폐') || catName.includes('암호화폐') || catName.includes('비트코인')) matchedType = '코인';
        else if (catName.includes('청약') || catName.includes('주택청약')) matchedType = '주택청약';
        else if (catName.includes('부동산') || catName.includes('아파트') || catName.includes('오피스텔')) matchedType = '부동산';
        else if (catName.includes('연금') || catName.includes('irp') || catName.includes('퇴직금')) matchedType = '연금';
        else if (catName.includes('저축') || catName.includes('적금') || catName.includes('예금') || catName.includes('은행') || catName.includes('예적금')) matchedType = '적금';
      }
      
      if (!matchedType && catName) matchedType = '적금';

      if (matchedType) {
        const cat = newSnapshots[normalizedDate].categories.find(c => c.type === matchedType);
        if (cat) {
          const name = String(getSheetVal(row, ['계좌명', 'Account', '상품명', '내역', 'name', '항목명', '항목', '자산명', '소분류']) || '계좌').trim();
          const owner = String(getSheetVal(row, ['소유자', 'Owner', '이름', 'Name', '주체']) || '').trim();
          const pStr = String(getSheetVal(row, ['원금', 'Principal', '투자금', '매수금', 'principal', '투자원금', '총투자', '매수', '총입금액', '납입금', '납입금액']) || '0');
          const vStr = String(getSheetVal(row, ['현재가', 'CurrentValue', 'Value', '평가액', '잔액', 'value', '평가금액', '합계', '평가금', '현재', '평가금액(원)', '평가', '평가금액']) || '0');
          const dStr = String(getSheetVal(row, ['입금', 'Deposit', '추가입금', '입금액', 'deposit', '당월입금', '이번달입금']) || '0');
          const wStr = String(getSheetVal(row, ['출금', 'Withdrawal', '인출', '출금액', 'withdrawal', '당월출금', '이번달출금']) || '0');

          const clean = (s: string) => Number(String(s).replace(/[^0-9.-]/g, '')) || 0;

          cat.items.push({
            id: crypto.randomUUID(),
            name,
            owner: owner || undefined,
            principal: clean(pStr),
            currentValue: clean(vStr),
            deposit: clean(dStr),
            withdrawal: clean(wStr)
          });
        }
      }
    });

    const months = Object.keys(newSnapshots).sort();
    if (months.length > 0) {
      setSnapshots(prev => {
        const merged = [...prev];
        Object.values(newSnapshots).forEach(s => {
          const idx = merged.findIndex(m => m.date === s.date);
          if (idx >= 0) merged[idx] = s;
          else merged.push(s);
        });
        return merged.sort((a,b) => b.date.localeCompare(a.date));
      });
    }
    return months;
  };

  const syncWithGoogleSheet = async (type: 'assets' | 'household' = syncTarget, url?: string) => {
    setIsSyncing(true);
    const sheetUrl = url || (type === 'assets' ? DEFAULT_ASSET_SHEET_URL : DEFAULT_HOUSEHOLD_SHEET_URL);
    
    try {
      let exportUrl = sheetUrl;
      const gidMatch = sheetUrl.match(/[?&#]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : (type === 'assets' ? '1734480802' : '0');

      if (sheetUrl.includes('/d/e/')) {
        const idMatch = sheetUrl.match(/\/d\/e\/([\w-]+)/);
        if (idMatch) {
          exportUrl = `https://docs.google.com/spreadsheets/d/e/${idMatch[1]}/pub?gid=${gid}&output=csv`;
        }
      } else {
        const idMatch = sheetUrl.match(/\/d\/([\w-]+)/);
        if (idMatch) {
          exportUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
        }
      }

      const response = await fetch(exportUrl);
      if (!response.ok) {
        throw new Error(`데이터 연동 실패 (${response.status}). 시트 설정에서 "메뉴 > 공유 > 웹에 게시"를 확인해주세요.`);
      }
      
      const csvText = await response.text();
      const cleanCsvText = csvText.replace(/^\uFEFF/, '');
      
      if (cleanCsvText.includes('<!DOCTYPE html>') || cleanCsvText.includes('<html')) {
        throw new Error('시트가 CSV 형식이 아닌 HTML을 반환했습니다. "웹에 게시" 설정에서 "전비 문서" 또는 탭이 올바르게 게시되었는지 확인해주세요.');
      }
      
      Papa.parse(cleanCsvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          if (!data || data.length === 0) {
            alert('가져올 데이터가 비어 있습니다.');
            return;
          }
          if (type === 'assets') {
            const importedMonths = handleImportCSVData(data);
            if (importedMonths.length > 0) {
              const latest = [...importedMonths].sort().reverse()[0];
              setSelectedMonth(latest);
            }
            alert(`${data.length}개의 행에서 ${importedMonths.length}개월(${importedMonths.join(', ')})의 자산 데이터를 동기화했습니다.`);
          } else {
            const importedMonths = handleImportHouseholdCSVData(data);
            if (importedMonths.length > 0) {
              const latest = [...importedMonths].sort().reverse()[0];
              setSelectedMonth(latest);
            }
            alert(`${data.length}개의 행에서 ${importedMonths.length}개월(${importedMonths.join(', ')})의 가계부 데이터를 동기화했습니다.`);
          }
        },
        error: (err) => {
          alert('CSV 파싱 중 오류: ' + err.message);
        }
      });
    } catch (error) {
      console.error('Sync Error:', error);
      alert(error instanceof Error ? error.message : '데이터 연동 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isInitialized) return <div className="min-h-screen flex items-center justify-center tracking-tight">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#141414] selection:bg-primary/20">
      {/* Sync Modal */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSyncModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight">구글 시트 동기화</h3>
                <button onClick={() => setIsSyncModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex p-1 bg-neutral-100 rounded-2xl">
                  <button 
                    onClick={() => setSyncTarget('assets')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      syncTarget === 'assets' ? "bg-white text-primary shadow-sm" : "text-neutral-400"
                    )}
                  >
                    자산 데이터
                  </button>
                  <button 
                    onClick={() => setSyncTarget('household')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      syncTarget === 'household' ? "bg-white text-primary shadow-sm" : "text-neutral-400"
                    )}
                  >
                    가계부 데이터
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">구글 시트 URL</label>
                  <input 
                    value={customSyncUrl}
                    onChange={(e) => setCustomSyncUrl(e.target.value)}
                    placeholder={syncTarget === 'assets' ? DEFAULT_ASSET_SHEET_URL : DEFAULT_HOUSEHOLD_SHEET_URL}
                    className="w-full bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100 text-sm focus:outline-none focus:bg-white focus:border-neutral-900 transition-all"
                  />
                  <p className="text-[10px] text-neutral-400 leading-relaxed px-1">
                    * 시트의 "파일 &gt; 공유 &gt; 웹에 게시"에서 "웹 페이지" 또는 "쉼표로 구분된 값(.csv)"으로 설정 후 전체 문서 또는 해당 탭을 게시해야 링크 연동이 가능합니다.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => {
                  syncWithGoogleSheet(syncTarget, customSyncUrl || undefined);
                  setIsSyncModalOpen(false);
                }}
                disabled={isSyncing}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {isSyncing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                <span>{isSyncing ? '동기화 중...' : '지금 동기화하기'}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-base md:text-lg tracking-tight text-primary hidden sm:block">수빈지현 자산 관리</h1>
          </div>

        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar max-w-[60vw]">
            <button 
              onClick={() => { setActiveTab('dashboard'); setSelectedAssetCategory(null); }}
              className={cn(
                "w-[88.5px] px-4 py-1.5 text-[14px] font-bold rounded-lg transition-all whitespace-nowrap text-center",
                activeTab === 'dashboard' ? "bg-white text-primary shadow-sm" : "text-neutral-500 hover:text-primary"
              )}
            >
              대시보드
            </button>
            <button 
              onClick={() => { setActiveTab('assets'); setSelectedAssetCategory(null); }}
              className={cn(
                "w-[88.5px] px-4 py-1.5 text-[14px] font-bold rounded-lg transition-all whitespace-nowrap text-center",
                activeTab === 'assets' ? "bg-white text-primary shadow-sm" : "text-neutral-500 hover:text-primary"
              )}
            >
              자산 상세
            </button>
            <button 
              onClick={() => { setActiveTab('household'); setSelectedAssetCategory(null); }}
              className={cn(
                "w-[88.5px] px-4 py-1.5 text-[14px] font-bold rounded-lg transition-all whitespace-nowrap text-center",
                activeTab === 'household' ? "bg-white text-primary shadow-sm" : "text-neutral-500 hover:text-primary"
              )}
            >
              가계부
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Month Selection Box (as Select if possible, but input month is fine for consistency) */}
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 md:px-3 py-1.5 text-xs md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-center"
            >
              {availableMonths.map(date => (
                <option key={date} value={date}>{date.substring(2, 4)}.{date.split('-')[1]}</option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Summary Stats */}
          <div className="flex flex-col gap-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard 
                title="총 순자산"
                value={formatCurrency(currentStats.totalValue)}
                icon={Wallet}
                className="bg-[#f7e8e8]"
                onClick={() => setIsNetWorthModalOpen(true)}
              />
              <StatCard 
                title={roiPeriod === 'cumulative' ? "누적 수익률" : roiPeriod === 'annual' ? "연 수익률" : "월 수익률"}
                value={formatPercent(roiPeriod === 'cumulative' ? currentStats.totalROI : roiPeriod === 'annual' ? (currentStats.totalAnnualROI || 0) : (currentStats.totalMonthlyROI || 0))}
                icon={TrendingUp}
                className="bg-[#f7e8e8]"
                onClick={() => setIsROIModalOpen(true)}
                action={
                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/30">
                    {(['cumulative', 'annual', 'monthly'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoiPeriod(period);
                        }}
                        className={cn(
                          "w-[38px] py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
                          roiPeriod === period ? "bg-white text-primary shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                        )}
                      >
                        {period === 'cumulative' ? '누적' : period === 'annual' ? '연' : '월'}
                      </button>
                    ))}
                  </div>
                }
              />
            </div>

            <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
                    <Receipt className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900">가계 수지 현황</h4>
                  </div>
                </div>
                <div className="flex bg-white p-1 h-[34.3px] items-center rounded-xl border border-neutral-200 shadow-sm self-stretch sm:self-auto">
                  {[
                    { id: 'cumulative', label: '누적' },
                    { id: 'yearly', label: '연' },
                    { id: 'monthly', label: '월' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setHouseholdPeriod(p.id as any)}
                      className={cn(
                        "flex-1 sm:flex-none h-[25px] flex items-center justify-center text-xs font-bold rounded-lg transition-all",
                        p.id === 'cumulative' ? "w-[55px]" : "w-[54px]",
                        householdPeriod === p.id ? "bg-primary text-white shadow-md" : "text-neutral-400 hover:text-neutral-900"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard 
                  title={`${householdPeriod === 'monthly' ? '월' : householdPeriod === 'yearly' ? '연' : '누적'} 수입`}
                  value={'+' + formatNumber(householdStats[householdPeriod].income) + '원'} 
                  trend={householdPeriod === 'monthly' ? householdStats.trends.income : undefined}
                  icon={ArrowUpRight} 
                  className="bg-white border-[#e4e5ff] text-plus"
                />
                <StatCard 
                  title={`${householdPeriod === 'monthly' ? '월' : householdPeriod === 'yearly' ? '연' : '누적'} 지출`}
                  value={'-' + formatNumber(householdStats[householdPeriod].expense) + '원'} 
                  trend={householdPeriod === 'monthly' ? householdStats.trends.expense : undefined}
                  icon={ArrowDownRight} 
                  className="bg-white border-[#e4e5ff] text-minus"
                />
                <StatCard 
                  title={`${householdPeriod === 'monthly' ? '월' : householdPeriod === 'yearly' ? '연' : '누적'} 순 잔액`}
                  value={(householdStats[householdPeriod].net >= 0 ? '+' : '') + formatNumber(householdStats[householdPeriod].net) + '원'} 
                  icon={Receipt} 
                  className={cn(
                    "bg-white",
                    householdStats[householdPeriod].net >= 0 ? "border-[#e4e5ff] text-plus" : "border-[#e4e5ff] text-minus"
                  )}
                />
              </div>
            </div>
          </div>

              {/* Dashboard Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Asset Portfolio */}
                <div className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm overflow-visible">
                  <h4 className="font-bold text-sm text-neutral-900 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
                      <PieChartIcon className="w-4 h-4 text-primary" />
                    </div>
                    자산 포트폴리오
                  </h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart accessibilityLayer={false}>
                        <Pie
                          data={currentStats.categoryStats}
                          dataKey="value"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={5}
                          activeShape={false}
                        >
                          {currentStats.categoryStats.map((cat, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_CONFIG[cat.type as InvestmentType]?.color || '#5CD1E5'} />
                          ))}
                          <Label 
                            content={({ viewBox }) => {
                              const { cx, cy } = viewBox as any;
                              return (
                                <g>
                                  <text x={cx} y={cy} dy={-12} textAnchor="middle" dominantBaseline="middle" className="fill-neutral-500 text-xs uppercase tracking-wider">
                                    자산합계
                                  </text>
                                  <text x={cx} y={cy} dy={6} textAnchor="middle" dominantBaseline="middle" className="fill-neutral-900 text-sm font-bold">
                                    {formatCurrency(currentStats.totalValue)}
                                  </text>
                                </g>
                              );
                            }}
                          />
                        </Pie>
                        <Tooltip 
                          cursor={false}
                          allowEscapeViewBox={{ x: true, y: true }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const entry = payload[0];
                              const value = entry.value as number;
                              const percent = currentStats.totalValue > 0 ? (value / currentStats.totalValue * 100).toFixed(1) : '0';
                              return (
                                <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-neutral-100">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                                    <span className="text-[10px] text-[#4C4C4C]">{entry.name}</span>
                                  </div>
                                  <p className="text-[10px] text-[#4C4C4C]">
                                    {formatCurrency(value)} ({percent}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={40} 
                          content={({ payload }) => (
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
                              {payload?.map((entry: any, index: number) => (
                                <div key={`legend-${index}`} className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expense Breakdown */}
                <div className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm">
                  <h4 className="font-bold text-sm text-neutral-900 mb-6 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                    </div>
                    지출 분포
                  </h4>
                  <div className="h-[300px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={householdStats[householdPeriod].categoryBreakdown}
                        margin={{ top: 0, right: 60, left: -20, bottom: 0 }}
                        accessibilityLayer={false}
                      >
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8C8C8C" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#8C8C8C" stopOpacity={0.3}/>
                          </linearGradient>
                        </defs>
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="category" 
                          axisLine={false}
                          tickLine={false}
                          width={70}
                          tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                        />
                        <Bar 
                          dataKey="amount" 
                          fill="url(#barGradient)" 
                          radius={[0, 4, 4, 0]} 
                          barSize={32}
                          activeBar={false}
                        >
                          <LabelList 
                            dataKey="amount" 
                            position="right" 
                            formatter={(value: any) => `${formatNumber(value)}원`}
                            style={{ fontSize: 11, fontWeight: 700, fill: '#1e293b' }}
                            offset={10}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Asset Trend (Cumulative) */}
              <div className="bg-white border border-neutral-200 p-8 rounded-[32px] shadow-sm mt-6 overflow-visible">
                <div className="flex justify-between items-start mb-8">
                  <h4 className="font-bold text-sm text-neutral-900 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    자산 추이
                  </h4>
                  <div className="text-right">

                    <p className="text-base font-bold text-neutral-900">{formatCurrency(currentStats.totalValue)}</p>
                  </div>
                </div>
                <div className="flex items-end">
                  {/* Fixed Y-Axis Container */}
                  <div className="w-[45px] h-[300px] shrink-0 mb-[32px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stackedTrendData} margin={{ top: 10, right: 0, left: -5, bottom: 0 }} accessibilityLayer={false}>
                        <YAxis 
                          className="select-none"
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#A3A3A3', fontWeight: 'bold' }}
                          tickFormatter={(val) => val === 0 ? '0' : (val / 1000000).toLocaleString() + 'M'}
                          width={45}
                        />
                        {INVESTMENT_TYPES.map(type => (
                          <Bar key={type} dataKey={type} stackId="1" fill="transparent" activeBar={false} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Scrollable Chart Content */}
                  <div className="flex-1 overflow-x-auto overflow-y-visible pb-4 scrollbar-hide">
                    <div style={{ minWidth: `${Math.max(300, stackedTrendData.length * 60)}px` }} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stackedTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} accessibilityLayer={false}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FAFAFA" />
                          <XAxis 
                            dataKey="monthLabel" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#A3A3A3', fontWeight: 'bold' }}
                            dy={10}
                          />
                          <YAxis hide />
                          <Tooltip 
                            cursor={false}
                            allowEscapeViewBox={{ x: true, y: true }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                                return (
                                  <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-neutral-100 min-w-[220px]">
                                    <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-3">{label}</p>
                                    <div className="space-y-2.5 mb-3">
                                      {[...payload].reverse().map((entry: any, index: number) => {
                                        const value = Number(entry.value) || 0;
                                        if (value === 0) return null;
                                        const percent = total > 0 ? (value / total * 100).toFixed(1) : '0';
                                        const millionValue = (value / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 });
                                        return (
                                          <div key={index} className="flex justify-between items-center gap-4">
                                            <div className="flex items-center gap-2">
                                              <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                                              <span className="text-[10px] text-[#4C4C4C]">{entry.name}</span>
                                            </div>
                                            <span className="text-[10px] text-[#4C4C4C]">
                                              {millionValue}백만원 ({percent}%)
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="pt-3 border-t border-neutral-100 flex justify-between items-center">
                                      <span className="text-[10px] text-[#4C4C4C]">자산 합계</span>
                                      <span className="text-[10px] text-[#4C4C4C] tracking-tight">{formatCurrency(total)}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend 
                            content={({ payload }) => (
                              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6">
                                {payload?.reverse().map((entry: any, index: number) => (
                                  <div key={`legend-${index}`} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider">{entry.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          />
                          {INVESTMENT_TYPES.map((type) => (
                            <Bar 
                              key={type}
                              dataKey={type}
                              stackId="1"
                              fill={CATEGORY_CONFIG[type].color}
                              activeBar={false}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Retirement Calculator Shortcut */}
              <div className="flex justify-center mt-12 mb-4">
                <motion.a 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://remix-remix-remix-1000166716944.us-west1.run.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="p-4 bg-white border-2 border-primary/20 rounded-full shadow-lg hover:shadow-xl hover:border-primary transition-all text-primary relative">
                    <Calculator className="w-6 h-6" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <span className="text-[12px] font-normal text-primary bg-white px-4 py-1.5 rounded-full shadow-sm border border-neutral-100 transition-all group-hover:bg-primary group-hover:text-white">
                    은퇴 계산기 바로가기
                  </span>
                </motion.a>
              </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div 
              key="assets"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-8"
            >
              {!selectedAssetCategory ? (
                <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-neutral-100">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-sm text-neutral-900">항목별 자산 상세</h4>
                        <button 
                          onClick={() => { setSyncTarget('assets'); setIsSyncModalOpen(true); }}
                          disabled={isSyncing}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-primary hover:shadow-sm transition-all",
                            isSyncing && "opacity-50"
                          )}
                        >
                          <RefreshCcw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                          <span>{isSyncing ? '동기화 중' : '시트 동기화'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2 gap-2">
                      <button 
                        onClick={() => updateAccount('주식', null, { name: '새 자산 항목', principal: 0, currentValue: 0 })}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-bold hover:scale-105 transition-all shadow-sm"
                      >
                        <Plus className="w-2.5 h-2.5" /> 자산 추가
                      </button>
                    </div>

                  </div>
                  <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <table className="w-full text-center border-collapse min-w-[700px] table-auto">
                      <thead>
                        <tr className="text-neutral-900 text-xs font-medium border-b border-neutral-200 bg-[#D8D8D8]">
                          <th className="px-6 py-4 text-center whitespace-nowrap">카테고리</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">원금</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">평가액</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">입금액</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">출금액</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">
                            {roiPeriod === 'cumulative' ? '누적수익률' : roiPeriod === 'annual' ? '연수익률' : '월수익률'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {currentStats.categoryStats.map((cat) => (
                          <tr 
                            key={cat.type} 
                            className="transition-all cursor-pointer"
                            onClick={() => setSelectedAssetCategory(cat.type)}
                          >
                            <td className="px-6 py-5 text-sm text-center">
                              <div className="flex items-center justify-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_CONFIG[cat.type as InvestmentType]?.color || '#888' }} />
                                <span className="text-neutral-800">{cat.type}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-center font-bold text-neutral-900">{formatNumber(cat.principal)}</td>
                            <td className="px-6 py-5 text-sm text-center font-bold text-neutral-900">{formatNumber(cat.value)}</td>
                            <td className={cn(
                              "px-6 py-5 text-sm text-center",
                              (cat.deposit || 0) > 0 ? "text-plus" : (cat.deposit || 0) < 0 ? "text-minus" : "text-neutral-500"
                            )}>
                              {(cat.deposit || 0) > 0 ? `+${formatNumber(cat.deposit)}` : (cat.deposit || 0) < 0 ? formatNumber(cat.deposit) : '-'}
                            </td>
                            <td className={cn(
                              "px-6 py-5 text-sm text-center",
                              (cat.withdrawal || 0) > 0 ? "text-minus" : (cat.withdrawal || 0) < 0 ? "text-plus" : "text-neutral-500"
                            )}>
                              {(cat.withdrawal || 0) > 0 ? `-${formatNumber(cat.withdrawal)}` : (cat.withdrawal || 0) < 0 ? `+${formatNumber(Math.abs(cat.withdrawal))}` : '-'}
                            </td>
                            <td className="px-6 py-5 text-center">
                               <div className={cn(
                                 "text-sm font-bold",
                                 (roiPeriod === 'cumulative' ? cat.roi : roiPeriod === 'annual' ? cat.annualRoi : cat.monthlyRoi || 0) >= 0 ? "text-plus" : "text-minus"
                               )}>
                                 {formatPercent(roiPeriod === 'cumulative' ? cat.roi : roiPeriod === 'annual' ? cat.annualRoi : cat.monthlyRoi || 0)}
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-neutral-100" style={{ backgroundColor: '#FFFF90' }}>
                          <td className="px-6 py-4 text-sm font-bold text-neutral-900">합계</td>
                          <td className="px-6 py-4 text-sm font-bold text-neutral-900">{formatNumber(currentStats.totalPrincipal)}</td>
                          <td className="px-6 py-4 text-sm font-bold text-neutral-900">{formatNumber(currentStats.totalValue)}</td>
                          <td className={cn("px-6 py-4 text-sm font-bold", currentStats.totalDeposit > 0 ? "text-plus" : "text-neutral-900")}>
                            {currentStats.totalDeposit > 0 ? `+${formatNumber(currentStats.totalDeposit)}` : formatNumber(currentStats.totalDeposit)}
                          </td>
                          <td className={cn("px-6 py-4 text-sm font-bold", currentStats.totalWithdrawal > 0 ? "text-minus" : "text-neutral-900")}>
                            {currentStats.totalWithdrawal > 0 ? `-${formatNumber(currentStats.totalWithdrawal)}` : formatNumber(currentStats.totalWithdrawal)}
                          </td>
                          <td className={cn(
                            "px-6 py-4 text-sm font-bold",
                            (roiPeriod === 'cumulative' ? currentStats.totalROI : roiPeriod === 'annual' ? currentStats.totalAnnualROI : currentStats.totalMonthlyROI) >= 0 ? "text-plus" : "text-minus"
                          )}>
                            {formatPercent(roiPeriod === 'cumulative' ? currentStats.totalROI : roiPeriod === 'annual' ? currentStats.totalAnnualROI : currentStats.totalMonthlyROI)}
                          </td>
                        </tr>
                        <tr className="border-t border-neutral-100">
                          <td colSpan={6} className="px-6 py-3 pb-5">
                            <div className="flex justify-end">
                              <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-xl border border-neutral-200/50">
                                {(['cumulative', 'annual', 'monthly'] as const).map((period) => (
                                  <button
                                    key={period}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRoiPeriod(period);
                                    }}
                                    className={cn(
                                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
                                      roiPeriod === period ? "bg-white text-primary shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                                    )}
                                  >
                                    {period === 'cumulative' ? '누적' : period === 'annual' ? '연' : '월'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                </tfoot>
                    </table>
                  </div>

                  {/* Individual Category Trend Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                    {Object.keys(CATEGORY_CONFIG).map((type) => {
                      const trendData = getCategoryTrend(type);
                      const config = CATEGORY_CONFIG[type as InvestmentType];
                      const latest = trendData[trendData.length - 1];
                      const profit = latest ? latest.value - latest.principal : 0;
                      const roi = latest && latest.principal > 0 ? (profit / latest.principal) * 100 : 0;

                      // Dynamic Y-Axis calculation (10M intervals)
                      const maxTrendVal = Math.max(...trendData.map(d => Math.max(d.principal || 0, d.value || 0)), 0);
                      const tickCount = 5;
                      const interval = Math.max(10000000, Math.ceil(maxTrendVal / (tickCount - 1) / 10000000) * 10000000);
                      const dynamicDomain = [0, interval * (tickCount - 1)];
                      const dynamicTicks = Array.from({ length: tickCount }, (_, i) => i * interval);

                      return (
                        <div key={type} className="bg-white border border-neutral-200 p-6 rounded-[32px] shadow-sm hover:border-neutral-300 transition-all group">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-neutral-50 text-neutral-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                {React.createElement(config.icon, { className: "w-4 h-4" })}
                              </div>
                              <div>
                                <h4 className="font-bold text-neutral-800 tracking-tight">{type}</h4>
                              </div>
                            </div>
                            <div className={cn(
                              "text-right",
                              roi >= 0 ? "text-plus" : "text-minus"
                            )}>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-60">수익률</p>
                              <p className="font-black text-sm">{formatPercent(roi)}</p>
                            </div>
                          </div>

                          <div className="flex items-end">
                            {/* Fixed Y-Axis Container */}
                            <div className="w-[45px] h-[200px] shrink-0 mb-[32px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart 
                                  data={trendData} 
                                  margin={{ left: -5, right: 0, top: 10, bottom: 0 }}
                                  accessibilityLayer={false}
                                >
                                  <YAxis 
                                    className="select-none"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#A3A3A3', fontWeight: 'bold' }}
                                    tickFormatter={(val) => val === 0 ? '0' : (val / 1000000).toLocaleString() + 'M'}
                                    domain={dynamicDomain}
                                    ticks={dynamicTicks}
                                    width={45}
                                  />
                                  <Line dataKey="value" stroke="transparent" dot={false} strokeWidth={0} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Scrollable Chart Content */}
                            <div className="flex-1 overflow-x-auto pb-4 scrollbar-hide">
                              <div style={{ minWidth: `${Math.max(300, trendData.length * 60)}px` }} className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart 
                                    data={trendData} 
                                    margin={{ left: 0, right: 10, top: 10, bottom: 20 }}
                                    accessibilityLayer={false}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#FAFAFA" />
                                    <XAxis 
                                      dataKey="monthLabel" 
                                      axisLine={false}
                                      tickLine={false}
                                      tick={{ fontSize: 10, fill: '#A3A3A3', fontWeight: 'bold' }}
                                      dy={10}
                                    />
                                    <YAxis 
                                      hide
                                      domain={dynamicDomain}
                                      ticks={dynamicTicks}
                                    />
                                    <Tooltip 
                                      cursor={false}
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px' }}
                                      labelStyle={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}
                                      itemStyle={{ fontSize: '10px', padding: '0px' }}
                                      formatter={(value: any, name: any, props: any) => {
                                        if (name === 'value') {
                                          const principal = props.payload.principal;
                                          const roi = principal > 0 ? ((value - principal) / principal) * 100 : 0;
                                          return [`${formatNumber(value)}원 (수익률: ${formatPercent(roi)})`, '평가액'];
                                        }
                                        return [formatNumber(value) + '원', '원금'];
                                      }}
                                    />
                                    <Line 
                                      type="monotone" 
                                      dataKey="principal" 
                                      stroke="#A6A6A6" 
                                      strokeWidth={2} 
                                      dot={false}
                                      activeDot={false}
                                      connectNulls={false}
                                    />
                                    <Line 
                                      type="monotone" 
                                      dataKey="value" 
                                      stroke={config.color} 
                                      strokeWidth={3} 
                                      dot={false}
                                      activeDot={false}
                                      connectNulls={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>


                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm gap-4">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedAssetCategory(null)}
                        className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5 text-neutral-400" />
                      </button>
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-primary text-white rounded-xl">
                          {CATEGORY_CONFIG[selectedAssetCategory] && React.createElement(CATEGORY_CONFIG[selectedAssetCategory].icon, { className: "w-5 h-5" })}
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-primary">{selectedAssetCategory} 관리</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button 
                        onClick={() => updateAccount(selectedAssetCategory, null, { name: '새 자산 항목', principal: 0, currentValue: 0 })}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                      >
                        <Plus className="w-4 h-4" /> 항목 추가
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentStats.categoryStats.find(c => c.type === selectedAssetCategory)?.items.map((item) => (
                      <div key={item.id} className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm group hover:border-neutral-400 transition-all">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                               <input 
                                value={item.name}
                                onChange={(e) => updateAccount(selectedAssetCategory, item.id, { name: e.target.value })}
                                className="font-bold text-lg bg-transparent border-none focus:ring-0 w-full truncate"
                                placeholder="항목 명칭"
                              />
                            </div>
                          </div>
                          <button 
                            onClick={() => { if(confirm('이 항목을 삭제하시겠습니까?')) updateAccount(selectedAssetCategory, item.id, {}); }}
                            className="p-2 text-neutral-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                             <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1.5 ml-1">계좌 명칭</label>
                             <input 
                               value={item.name}
                               onChange={(e) => updateAccount(selectedAssetCategory, item.id, { name: e.target.value })}
                               className="w-full bg-neutral-50 px-3 h-10 rounded-xl border border-neutral-100 text-xs font-bold focus:bg-white focus:border-neutral-900 transition-all"
                               placeholder="항목명"
                             />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-plus uppercase mb-1.5 ml-1">당월 입금</label>
                              <input 
                                type="text"
                                value={formatNumber(item.deposit || 0)}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  updateAccount(selectedAssetCategory, item.id, { deposit: Number(val) });
                                }}
                                className="w-full bg-blue-50/30 px-3 h-10 rounded-xl border border-blue-100 text-xs font-bold text-black focus:bg-white focus:border-neutral-900 transition-all"
                              />
                            </div>
                            <div>
                               <label className="block text-[10px] font-bold text-minus uppercase mb-1.5 ml-1">당월 출금</label>
                               <input 
                                 type="text"
                                 value={formatNumber(item.withdrawal || 0)}
                                 onChange={(e) => {
                                   const val = e.target.value.replace(/[^0-9]/g, '');
                                   updateAccount(selectedAssetCategory, item.id, { withdrawal: Number(val) });
                                 }}
                                 className="w-full bg-rose-50/30 px-3 h-10 rounded-xl border border-rose-100 text-xs font-bold text-black focus:bg-white focus:border-neutral-900 transition-all"
                               />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1.5 ml-1">투자 원금</label>
                            <input 
                              type="text"
                              value={formatNumber(item.principal)}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                updateAccount(selectedAssetCategory, item.id, { principal: Number(val) });
                              }}
                              className="w-full bg-neutral-50 px-4 h-10 rounded-2xl border border-neutral-100 text-xs font-bold focus:bg-white focus:border-neutral-900 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1.5 ml-1">현재 평가액</label>
                            <input 
                              type="text"
                              value={formatNumber(item.currentValue)}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                updateAccount(selectedAssetCategory, item.id, { currentValue: Number(val) });
                              }}
                              className={cn(
                                "w-full px-4 h-10 rounded-2xl border font-bold text-xs text-black focus:bg-white focus:border-neutral-900 transition-all",
                                item.currentValue >= item.principal ? "bg-blue-50/30 border-blue-100" : "bg-rose-50/30 border-rose-100"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'household' && (
            <motion.div 
              key="household"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-8"
            >
              {/* Household Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="당월 총 수입"
                  value={'+' + formatNumber(householdStats.monthly.income) + '원'}
                  icon={ArrowUpRight}
                  className="border-neutral-200 bg-white text-plus"
                />
                <StatCard 
                  title="당월 총 지출"
                  value={'-' + formatNumber(householdStats.monthly.expense) + '원'}
                  icon={ArrowDownRight}
                  className="border-neutral-200 bg-white text-minus"
                />
                <StatCard 
                  title="당월 순 잔액"
                  value={(householdStats.monthly.net >= 0 ? '+' : '') + formatNumber(householdStats.monthly.net) + '원'}
                  icon={Wallet}
                  className={cn("border-neutral-200 bg-white", householdStats.monthly.net >= 0 ? "text-plus" : "text-minus")}
                />
              </div>

              {/* Transactions Table */}
              <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-neutral-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-sm text-neutral-900">가계부 내역</h4>
                      <button 
                        onClick={() => { setSyncTarget('household'); setIsSyncModalOpen(true); }}
                        disabled={isSyncing}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-primary hover:shadow-sm transition-all",
                          isSyncing && "opacity-50"
                        )}
                      >
                        <RefreshCcw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                        <span>{isSyncing ? '동기화 중' : '시트 동기화'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button 
                      onClick={() => updateTransaction(null, { type: 'expense' })}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-bold hover:scale-105 transition-all shadow-sm"
                    >
                      <Plus className="w-2.5 h-2.5" /> 내역 추가
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-6 sm:mx-0">
                  <table className="w-full text-center border-collapse table-auto">
                    <thead>
                      <tr className="text-neutral-900 text-sm font-medium border-b border-neutral-200 bg-[#D8D8D8]">
                        <th className="px-2 sm:px-6 py-4 text-center whitespace-nowrap">카테고리</th>
                        <th className="px-2 sm:px-6 py-4 text-center">내용</th>
                        <th className="px-2 sm:px-6 py-4 text-center whitespace-nowrap">금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {currentHouseholdSnapshot.transactions.length > 0 ? (
                        currentHouseholdSnapshot.transactions.sort((a,b) => b.date.localeCompare(a.date)).map((t) => (
                          <tr key={t.id} className="transition-colors group text-center">
                            <td className="px-2 sm:px-6 py-4 text-center text-[14px]">
                              <input 
                                value={t.category}
                                onChange={(e) => updateTransaction(t.id, { category: e.target.value })}
                                className="text-sm font-medium bg-transparent border-none focus:ring-0 p-0 w-full text-center min-w-[60px]"
                              />
                            </td>
                            <td className="px-2 sm:px-6 py-4 text-center">
                              <input 
                                value={t.description}
                                onChange={(e) => updateTransaction(t.id, { description: e.target.value })}
                                className="text-sm text-neutral-600 bg-transparent border-none focus:ring-0 p-0 w-full text-center min-w-[80px]"
                              />
                            </td>
                            <td className="px-2 sm:px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-[14px]">
                                <span className={cn("text-sm font-bold", t.type === 'income' ? "text-plus" : "text-minus")}>
                                  {t.type === 'income' ? '+' : '-'}
                                </span>
                                <input 
                                  type="text"
                                  value={formatNumber(t.amount)}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    updateTransaction(t.id, { amount: Number(val) });
                                  }}
                                  className={cn(
                                    "text-sm font-bold bg-transparent border-none focus:ring-0 p-0 w-24 text-center",
                                    t.type === 'income' ? "text-plus" : "text-minus"
                                  )}
                                />
                                <span className="text-sm font-bold text-black">원</span>
                                <button 
                                  onClick={() => updateTransaction(t.id, { type: t.type === 'income' ? 'expense' : 'income' })}
                                  className="p-1 hover:bg-neutral-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <ArrowRightLeft className="w-3 h-3 text-neutral-400" />
                                </button>
                                <button 
                                  onClick={() => { if(confirm('삭제하시겠습니까?')) updateTransaction(t.id, {}); }}
                                  className="p-1 hover:bg-rose-50 text-rose-300 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-neutral-400 text-sm italic">
                            데이터가 없습니다. 시트 동기화를 진행해주세요.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral-100" style={{ backgroundColor: '#FFFF90' }}>
                        <td className="px-2 sm:px-6 py-4 text-sm font-bold text-neutral-900 text-center">합계</td>
                        <td className="px-2 sm:px-6 py-4 text-sm text-neutral-500 text-center">{(householdStats.monthly.net >= 0 ? '+' : '') + formatNumber(householdStats.monthly.net)}원</td>
                        <td className="px-2 sm:px-6 py-4 text-sm font-bold text-center">
                          <div className="flex items-center justify-center gap-4">
                            <span className="text-plus">+{formatNumber(householdStats.monthly.income)}</span>
                            <span className="text-neutral-300">|</span>
                            <span className="text-minus">-{formatNumber(householdStats.monthly.expense)}</span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Net Worth Details Modal */}
        <AnimatePresence>
          {isNetWorthModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNetWorthModalOpen(false)}
                className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl"
              >
                <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/30">
                  <h3 className="text-xl font-bold tracking-tight">자산 항목별 상세</h3>
                  <button onClick={() => setIsNetWorthModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-neutral-200">
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
                
                <div className="p-8 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-6">
                    {currentStats.categoryStats.map((cat) => (
                      <div key={cat.type} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_CONFIG[cat.type as InvestmentType]?.color }} />
                             <h4 className="font-bold text-neutral-900">{cat.type}</h4>
                          </div>
                        </div>
                        
                        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                               <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">총 원금</p>
                               <p className="text-sm font-bold text-neutral-600">{formatCurrency(cat.principal)}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">총 평가액</p>
                               <p className="text-sm font-bold text-neutral-900">{formatCurrency(cat.value)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-8 py-6 bg-neutral-900 text-white flex justify-between items-center">
                   <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">전체 총 합계</p>
                      <h4 className="text-2xl font-bold tracking-tight">{formatCurrency(currentStats.totalValue)}</h4>
                   </div>
                   <div className="text-right text-blue-400 cursor-pointer hover:bg-neutral-800 p-2 -m-2 rounded-xl transition-colors" onClick={() => setIsROIModalOpen(true)}>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">
                        {roiPeriod === 'cumulative' ? '누적 수익률' : roiPeriod === 'annual' ? '연환산 수익률' : '월 수익률'}
                      </p>
                      <h4 className="text-xl font-bold">
                        {formatPercent(roiPeriod === 'cumulative' ? currentStats.totalROI : roiPeriod === 'annual' ? (currentStats.totalAnnualROI || 0) : (currentStats.totalMonthlyROI || 0))}
                      </h4>
                   </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* ROI Details Modal */}
          {isROIModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsROIModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl z-10"
              >
                <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 tracking-tight">수익률 상세</h3>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">
                      {roiPeriod === 'cumulative' ? '누적 수익률' : roiPeriod === 'annual' ? '연환산 수익률' : '월 수익률'} 기준
                    </p>
                  </div>
                  <button onClick={() => setIsROIModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-neutral-200">
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
                
                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="space-y-8">
                      {currentStats.categoryStats.map((cat) => {
                        const prevCat = snapshots[1]?.categories.find(c => c.type === cat.type);
                        const prevValue = prevCat?.value || 0;
                        const currValue = cat.value;
                        const catRoi = roiPeriod === 'cumulative' ? cat.roi : roiPeriod === 'annual' ? cat.annualRoi : cat.monthlyRoi;
                        
                        return (
                          <div key={cat.type} className="space-y-4 pt-2 border-b border-neutral-50 pb-8 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: CATEGORY_CONFIG[cat.type as InvestmentType]?.color }} />
                                 <h4 className="font-bold text-neutral-900 text-lg tracking-tight">{cat.type}</h4>
                              </div>
                              <div className="text-right">
                                {prevValue > 0 && (
                                  <p className={cn(
                                    "text-sm font-bold tracking-tight",
                                    currValue > prevValue ? "text-blue-500" : currValue < prevValue ? "text-rose-500" : "text-neutral-400"
                                  )}>
                                    {formatCurrency(currValue)}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* ROI Graph (Visualized ROI) */}
                            <div className="space-y-2 pt-1">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                                        {roiPeriod === 'cumulative' ? '누적' : roiPeriod === 'annual' ? '연환산' : '월'} 수익률
                                    </p>
                                    <span className={cn(
                                        "text-base font-black tracking-tight",
                                        catRoi > 0 ? "text-blue-600" : catRoi < 0 ? "text-rose-600" : "text-neutral-400"
                                    )}>{formatPercent(catRoi)}</span>
                                </div>
                                <div className="relative h-10 bg-neutral-100 rounded-xl overflow-hidden shadow-inner flex items-center">
                                    <div className="absolute left-1/2 w-[2px] h-full bg-white z-10 shadow-sm" />
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-1/2 flex justify-end pr-[1px]">
                                            {catRoi < 0 && (
                                                <motion.div 
                                                  initial={{ width: 0 }}
                                                  animate={{ width: `${Math.min(Math.abs(catRoi) * 2, 100)}%` }}
                                                  className="h-6 bg-rose-500 rounded-l-md"
                                                />
                                            )}
                                        </div>
                                        <div className="w-1/2 flex justify-start pl-[1px]">
                                            {catRoi > 0 && (
                                                <motion.div 
                                                  initial={{ width: 0 }}
                                                  animate={{ width: `${Math.min(catRoi * 2, 100)}%` }}
                                                  className="h-6 bg-blue-500 rounded-r-md"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {/* Scale Ticks */}
                                    <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20 items-end pb-1">
                                        <span className="text-[8px] font-bold">-50%</span>
                                        <span className="text-[8px] font-bold">+50%</span>
                                    </div>
                                </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="px-8 py-6 bg-neutral-900 text-white flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t border-neutral-800">
                   <div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">전체 총 합계 ({roiPeriod === 'cumulative' ? '누적' : roiPeriod === 'annual' ? '연' : '월'})</p>
                      <h4 className="text-xl font-bold tracking-tight text-blue-400">
                        {formatPercent(roiPeriod === 'cumulative' ? currentStats.totalROI : roiPeriod === 'annual' ? (currentStats.totalAnnualROI || 0) : (currentStats.totalMonthlyROI || 0))}
                      </h4>
                   </div>
                   <button 
                     onClick={() => setIsROIModalOpen(false)}
                     className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                   >
                     확인
                   </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 text-center text-neutral-400 text-xs border-t border-neutral-200 mt-12 bg-white">
        <p>© 2026 수빈지현 자산 관리. 데이터는 브라우저 LocalStorage에 저장됩니다.</p>
        <p className="mt-2 italic opacity-50 uppercase tracking-[0.2em]">Crafted with Precision for Asset Growth</p>
      </footer>
    </div>
  );
}
