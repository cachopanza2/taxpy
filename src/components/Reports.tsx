import React, { useMemo } from 'react';
import { Receipt, ReceiptType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, FileSpreadsheet, TrendingUp, Calculator, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { ExcelService } from '../services/excelService';

interface ReportsProps {
  receipts: Receipt[];
}

export const Reports: React.FC<ReportsProps> = ({ receipts }) => {
  const { incomeChartData, expenseChartData, comparisonChartData, irpData, ivaData } = useMemo(() => {
    const incomeMap: Record<string, number> = {};
    const expenseMap: Record<string, number> = {};
    const allMonthsSet = new Set<string>();

    receipts.forEach(r => {
      const date = new Date(r.date);
      const monthKey = date.toLocaleDateString('es-PY', { month: 'short', year: '2-digit' });
      allMonthsSet.add(monthKey);

      if (r.type === ReceiptType.INCOME) {
        incomeMap[monthKey] = (incomeMap[monthKey] || 0) + r.total;
      } else {
        expenseMap[monthKey] = (expenseMap[monthKey] || 0) + r.total;
      }
    });

    // Sort months chronologically
    const sortedMonths = Array.from(allMonthsSet).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      // Simple approximation for sorting, ideally use real dates
      return new Date(`1 ${monthA} 20${yearA}`).getTime() - new Date(`1 ${monthB} 20${yearB}`).getTime();
    });

    const incomeData = sortedMonths.map(month => ({
      month,
      amount: incomeMap[month] || 0
    }));

    const expenseData = sortedMonths.map(month => ({
      month,
      amount: expenseMap[month] || 0
    }));

    const comparisonData = sortedMonths.map(month => ({
      month,
      ingreso: incomeMap[month] || 0,
      egreso: expenseMap[month] || 0
    }));

    // IRP Calculation (Current Year)
    const currentYear = new Date().getFullYear();
    const currentYearReceipts = receipts.filter(r => new Date(r.date).getFullYear() === currentYear);

    const ingresosAnuales = currentYearReceipts
      .filter(r => r.type === ReceiptType.INCOME)
      .reduce((acc, curr) => acc + curr.total, 0);

    const gastosDeducibles = currentYearReceipts
      .filter(r => r.type === ReceiptType.EXPENSE && (r.isDeductible !== false))
      .reduce((acc, curr) => acc + curr.total, 0);

    const rentaNeta = Math.max(0, ingresosAnuales - gastosDeducibles);

    let irpRate = 0;
    if (rentaNeta > 0) {
      if (rentaNeta <= 50000000) irpRate = 0.08;
      else if (rentaNeta <= 150000000) irpRate = 0.09;
      else irpRate = 0.10;
    }

    const irpEstimated = rentaNeta * irpRate;

    // IVA Calculation (Current Month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentMonthName = now.toLocaleDateString('es-PY', { month: 'long' });
    
    const currentMonthReceipts = currentYearReceipts.filter(r => new Date(r.date).getMonth() === currentMonth);

    const ivaDebito = currentMonthReceipts
      .filter(r => r.type === ReceiptType.INCOME)
      .reduce((acc, curr) => acc + (curr.iva10 || 0) + (curr.iva5 || 0), 0);

    const ivaCredito = currentMonthReceipts
      .filter(r => r.type === ReceiptType.EXPENSE)
      .reduce((acc, curr) => acc + (curr.iva10 || 0) + (curr.iva5 || 0), 0);

    const ivaSaldo = ivaDebito - ivaCredito;

    return {
      incomeChartData: incomeData,
      expenseChartData: expenseData,
      comparisonChartData: comparisonData,
      irpData: {
        ingresosAnuales,
        gastosDeducibles,
        rentaNeta,
        irpRate,
        irpEstimated,
        year: currentYear
      },
      ivaData: {
        monthName: currentMonthName,
        debit: ivaDebito,
        credit: ivaCredito,
        balance: ivaSaldo
      }
    };
  }, [receipts]);

  const handleExport = () => {
    ExcelService.exportToExcel(receipts);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount);
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* Income vs Expense Comparison */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Balance General</h3>
            <p className="text-xs text-slate-400 font-medium">Ingresos vs Egresos</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-xl">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} 
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{fill: '#94a3b8', fontSize: 10}} 
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
              />
              <Tooltip 
                cursor={{fill: '#f8fafc', radius: 8}}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
              <Bar name="Ingresos" dataKey="ingreso" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar name="Egresos" dataKey="egreso" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Income Chart */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Ingresos Mensuales</h3>
            <p className="text-xs text-slate-400 font-medium">Evolución de entradas</p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} 
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{fill: '#94a3b8', fontSize: 10}} 
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
              />
              <Tooltip 
                cursor={{fill: '#f8fafc', radius: 8}}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                formatter={(value: number | undefined) => [value !== undefined ? formatCurrency(value) : '', 'Ingreso']}
              />
              <Bar 
                dataKey="amount" 
                fill="#10b981" 
                radius={[6, 6, 6, 6]} 
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Expenses Chart */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Egresos Mensuales</h3>
            <p className="text-xs text-slate-400 font-medium">Evolución de salidas</p>
          </div>
          <div className="p-2 bg-rose-50 rounded-xl">
            <TrendingDown className="w-5 h-5 text-rose-600" />
          </div>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenseChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} 
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{fill: '#94a3b8', fontSize: 10}} 
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
              />
              <Tooltip 
                cursor={{fill: '#f8fafc', radius: 8}}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                formatter={(value: number | undefined) => [value !== undefined ? formatCurrency(value) : '', 'Egreso']}
              />
              <Bar 
                dataKey="amount" 
                fill="#ef4444" 
                radius={[6, 6, 6, 6]} 
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* IRP Summary Card */}
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6 opacity-90">
            <Calculator className="w-5 h-5" />
            <h3 className="text-lg font-bold">Cálculo IRP {irpData.year}</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-emerald-700/50 pb-2 gap-2">
              <span className="text-emerald-200 text-xs font-medium shrink-0">Ingresos Anuales</span>
              <span className="font-bold tracking-tight text-sm truncate">{formatCurrency(irpData.ingresosAnuales)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-emerald-700/50 pb-2 gap-2">
              <span className="text-emerald-200 text-xs font-medium shrink-0">Gastos Deducibles</span>
              <span className="font-bold tracking-tight text-rose-300 text-sm truncate">-{formatCurrency(irpData.gastosDeducibles)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 gap-2">
              <span className="text-white font-bold text-xs shrink-0">Renta Neta Imponible</span>
              <span className="font-bold text-base tracking-tight truncate">{formatCurrency(irpData.rentaNeta)}</span>
            </div>
            
            <div className="bg-emerald-950/40 p-4 rounded-2xl mt-3 border border-emerald-500/20 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Tasa Aplicable</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 px-2 py-0.5 rounded-lg text-emerald-300 border border-emerald-500/30">
                  {(irpData.irpRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-emerald-100/80">Impuesto Estimado</span>
                <span className="text-2xl font-bold text-white tracking-tight truncate" title={formatCurrency(irpData.irpEstimated)}>
                  {formatCurrency(irpData.irpEstimated)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-2 border-t border-emerald-800/50">
            <p className="text-[10px] text-emerald-200/60 leading-relaxed text-center">
              * Cálculo simplificado según escalas vigentes. No sustituye el asesoramiento contable profesional.
            </p>
          </div>
        </div>
      </div>

      {/* IVA Summary Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6 opacity-90">
            <Calculator className="w-5 h-5" />
            <h3 className="text-lg font-bold capitalize">IVA {ivaData.monthName}</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-indigo-700/50 pb-2 gap-2">
              <span className="text-indigo-200 text-xs font-medium shrink-0">IVA Débito (Ventas)</span>
              <span className="font-bold tracking-tight text-sm truncate text-emerald-300">+{formatCurrency(ivaData.debit)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-indigo-700/50 pb-2 gap-2">
              <span className="text-indigo-200 text-xs font-medium shrink-0">IVA Crédito (Compras)</span>
              <span className="font-bold tracking-tight text-rose-300 text-sm truncate">-{formatCurrency(ivaData.credit)}</span>
            </div>
            
            <div className="bg-indigo-950/40 p-4 rounded-2xl mt-3 border border-indigo-500/20 backdrop-blur-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-indigo-100/80">
                  {ivaData.balance > 0 ? 'Saldo a Pagar' : 'Saldo a Favor'}
                </span>
                <span className={`text-2xl font-bold tracking-tight truncate ${ivaData.balance > 0 ? 'text-rose-300' : 'text-emerald-300'}`} title={formatCurrency(Math.abs(ivaData.balance))}>
                  {formatCurrency(Math.abs(ivaData.balance))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Action */}
      <button 
        onClick={handleExport}
        className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:border-emerald-200 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h4 className="font-bold text-slate-800">Exportar Reporte</h4>
            <p className="text-xs text-slate-500">Descargar datos en formato Excel</p>
          </div>
        </div>
        <Download className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
      </button>
    </div>
  );
};
