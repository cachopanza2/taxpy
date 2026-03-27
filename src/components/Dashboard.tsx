import React, { useState } from 'react';
import { Receipt, ReceiptType, Category } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ArrowUpRight, ArrowDownRight, Filter, Trash2 } from 'lucide-react';

interface DashboardProps {
  receipts: Receipt[];
  onDelete: (id: string) => void;
  onSelect: (receipt: Receipt) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#6366f1'];

export const Dashboard: React.FC<DashboardProps> = ({ receipts, onDelete, onSelect }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getUTCMonth());

  const years = Array.from(new Set(receipts.map(r => new Date(r.date).getUTCFullYear()))).sort((a, b) => b - a);
  if (!years.includes(new Date().getUTCFullYear())) years.unshift(new Date().getUTCFullYear());

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const yearlyReceipts = receipts.filter(r => {
    const d = new Date(r.date);
    return d.getUTCFullYear() === selectedYear;
  });

  const yearlyIncome = yearlyReceipts
    .filter(r => r.type === ReceiptType.INCOME)
    .reduce((acc, curr) => acc + curr.total, 0);

  const yearlyExpense = yearlyReceipts
    .filter(r => r.type === ReceiptType.EXPENSE)
    .reduce((acc, curr) => acc + curr.total, 0);

  const yearlyBalance = yearlyIncome - yearlyExpense;

  const monthlyReceipts = yearlyReceipts.filter(r => {
    const d = new Date(r.date);
    return d.getUTCMonth() === selectedMonth;
  });

  const monthlyIncome = monthlyReceipts
    .filter(r => r.type === ReceiptType.INCOME)
    .reduce((acc, curr) => acc + curr.total, 0);

  const monthlyExpense = monthlyReceipts
    .filter(r => r.type === ReceiptType.EXPENSE)
    .reduce((acc, curr) => acc + curr.total, 0);

  const normalizeStr = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const categoryData = Object.values(Category).map(cat => {
    const amount = yearlyReceipts
      .filter(r => normalizeStr(r.category || '') === normalizeStr(cat) && r.type === ReceiptType.EXPENSE)
      .reduce((acc, curr) => acc + curr.total, 0);
    return { name: cat, value: amount };
  }).filter(item => item.value > 0).sort((a, b) => b.value - a.value);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none font-medium"
        >
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <select 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none font-medium min-w-[120px]"
        >
          {months.map((month, index) => (
            <option key={index} value={index}>{month}</option>
          ))}
        </select>
      </div>

      {/* Main Balance Card (Yearly) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">Balance Anual {selectedYear}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 truncate" title={formatCurrency(yearlyBalance)}>
            {formatCurrency(yearlyBalance)}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm min-w-0">
              <div className="flex items-center gap-2 mb-1 text-emerald-300">
                <div className="p-1 bg-emerald-500/20 rounded-full shrink-0">
                  <ArrowUpRight className="w-3 h-3" />
                </div>
                <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider truncate">Ingresos</span>
              </div>
              <p className="text-sm md:text-lg font-semibold truncate" title={formatCurrency(yearlyIncome)}>
                {formatCurrency(yearlyIncome)}
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm min-w-0">
              <div className="flex items-center gap-2 mb-1 text-rose-300">
                <div className="p-1 bg-rose-500/20 rounded-full shrink-0">
                  <ArrowDownRight className="w-3 h-3" />
                </div>
                <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider truncate">Egresos</span>
              </div>
              <p className="text-sm md:text-lg font-semibold truncate" title={formatCurrency(yearlyExpense)}>
                {formatCurrency(yearlyExpense)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Ingresos {months[selectedMonth]}</span>
          </div>
          <p className="text-lg md:text-xl font-bold text-slate-800 truncate" title={formatCurrency(monthlyIncome)}>
            {formatCurrency(monthlyIncome)}
          </p>
          <p className="text-xs text-slate-400 mt-1 truncate">{monthlyReceipts.filter(r => r.type === ReceiptType.INCOME).length} transacciones</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600 shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Egresos {months[selectedMonth]}</span>
          </div>
          <p className="text-lg md:text-xl font-bold text-slate-800 truncate" title={formatCurrency(monthlyExpense)}>
            {formatCurrency(monthlyExpense)}
          </p>
          <p className="text-xs text-slate-400 mt-1 truncate">{monthlyReceipts.filter(r => r.type === ReceiptType.EXPENSE).length} transacciones</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">Egresos Anuales por Categoría</h3>
          <div className="p-2 bg-slate-50 rounded-xl">
            <TrendingDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
        
        <div className="h-72 w-full">
          {categoryData.length > 0 ? (
            <>
              {categoryData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <p className="text-sm">Sin egresos registrados para {selectedYear}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      label={({ percent }) => (percent != null && percent > 0.05) ? `${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                    >
                      {categoryData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `Gs. ${Number(value).toLocaleString('es-PY')}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '13px' }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#475569' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">Sin datos suficientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
