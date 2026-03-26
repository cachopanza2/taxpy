import React, { useState, useMemo } from 'react';
import { Receipt, ReceiptType, Category } from '../types';
import { 
  Search, Filter, Trash2, FileText, Coffee, ShoppingBag, 
  Stethoscope, GraduationCap, Shirt, Home, Film, Zap, 
  ArrowUpRight, ArrowDownRight, Calendar, Tag, MoreVertical
} from 'lucide-react';

interface ReceiptListProps {
  receipts: Receipt[];
  onSelect: (receipt: Receipt) => void;
  onDelete: (id: string) => void;
}

const getCategoryIcon = (category: Category) => {
  switch (category) {
    case Category.FOOD: return <Coffee className="w-5 h-5" />;
    case Category.TRANSPORT: return <ShoppingBag className="w-5 h-5" />;
    case Category.HEALTH: return <Stethoscope className="w-5 h-5" />;
    case Category.EDUCATION: return <GraduationCap className="w-5 h-5" />;
    case Category.CLOTHING: return <Shirt className="w-5 h-5" />;
    case Category.HOUSING: return <Home className="w-5 h-5" />;
    case Category.ENTERTAINMENT: return <Film className="w-5 h-5" />;
    case Category.SERVICES: return <Zap className="w-5 h-5" />;
    default: return <FileText className="w-5 h-5" />;
  }
};

export const ReceiptList: React.FC<ReceiptListProps> = ({ receipts, onSelect, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      const matchesSearch = 
        (r.providerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (r.receiptNumber || '').includes(searchTerm) ||
        (r.ruc || '').includes(searchTerm);
      const matchesCategory = filterCategory === 'all' || r.category === filterCategory;
      const matchesType = filterType === 'all' || r.type === filterType;
      return matchesSearch && matchesCategory && matchesType;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [receipts, searchTerm, filterCategory, filterType]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PY', { 
      style: 'currency', 
      currency: 'PYG', 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const groupedReceipts = useMemo(() => {
    return filteredReceipts.reduce((groups, receipt) => {
      const date = new Date(receipt.date);
      const groupKey = date.toLocaleDateString('es-PY', {
        month: 'long',
        year: 'numeric'
      });
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(receipt);
      return groups;
    }, {} as Record<string, Receipt[]>);
  }, [filteredReceipts]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Search and Filters */}
      <div className="space-y-4 sticky top-0 bg-[#f8fafc]/95 backdrop-blur-md py-4 z-20 -mx-6 px-6 border-b border-slate-100">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por proveedor, RUC o factura..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 placeholder:text-slate-400 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <select
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">TODOS LOS TIPOS</option>
            <option value={ReceiptType.INCOME}>INGRESOS</option>
            <option value={ReceiptType.EXPENSE}>EGRESOS</option>
          </select>
          
          <select
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">TODAS LAS CATEGORÍAS</option>
            {Object.values(Category).map(cat => (
              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List Content */}
      <div className="space-y-8">
        {Object.keys(groupedReceipts).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No hay resultados</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-[200px]">
              No encontramos comprobantes que coincidan con tu búsqueda.
            </p>
            <button 
              onClick={() => { setSearchTerm(''); setFilterCategory('all'); setFilterType('all'); }}
              className="mt-6 text-emerald-600 font-bold text-sm hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          Object.entries(groupedReceipts).map(([month, items]) => (
            <div key={month} className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{month}</h3>
                <div className="h-px flex-1 bg-slate-100"></div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                  {items.length} {items.length === 1 ? 'REGISTRO' : 'REGISTROS'}
                </span>
              </div>
              
              <div className="grid gap-3">
                {items.map(receipt => (
                  <div 
                    key={receipt.id}
                    onClick={() => onSelect(receipt)}
                    className="group relative bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  >
                    {/* Type Indicator Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      receipt.type === ReceiptType.INCOME ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}></div>

                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        receipt.type === ReceiptType.INCOME 
                          ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' 
                          : 'bg-slate-50 text-slate-500 group-hover:bg-slate-100'
                      }`}>
                        {getCategoryIcon(receipt.category)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <h4 className="font-bold text-slate-900 truncate pr-2 group-hover:text-emerald-700 transition-colors">
                            {receipt.providerName || 'Sin Nombre'}
                          </h4>
                          <span className={`font-black text-sm whitespace-nowrap ${
                            receipt.type === ReceiptType.INCOME ? 'text-emerald-600' : 'text-slate-900'
                          }`}>
                            {receipt.type === ReceiptType.INCOME ? '+' : ''}{formatCurrency(receipt.total)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(receipt.date).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {receipt.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(receipt.id);
                          }}
                          className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-90 bg-slate-50 md:bg-transparent"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

