import React, { useState, useEffect } from 'react';
import { Receipt, ReceiptType, Category, ReceiptStatus } from '../types';
import { X, Save, AlertTriangle, Check, Calendar, CreditCard, Hash, Tag, DollarSign, Trash2 } from 'lucide-react';

interface ReceiptModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (receipt: Receipt) => void;
  onDelete?: (id: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, isOpen, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Partial<Receipt>>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (receipt) {
      setFormData({ ...receipt });
    } else {
      setFormData({ isDeductible: true });
    }
  }, [receipt]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Receipt, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.providerName || !formData.total || !formData.date) {
      setErrors(['Por favor complete los campos obligatorios (Proveedor, Fecha, Total)']);
      return;
    }
    
    onSave(formData as Receipt);
    onClose();
  };

  const formatAmount = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseAmount = (value: string) => {
    return Number(value.replace(/\./g, '').replace(/[^0-9]/g, ''));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl transform transition-transform duration-300 max-h-[90vh] flex flex-col z-10">
        
        {/* Drag Handle for Mobile */}
        <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {receipt?.id ? 'Editar Comprobante' : 'Nuevo Comprobante'}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {receipt?.id ? 'Modifica los detalles del gasto' : 'Ingresa los datos del ticket'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="overflow-y-auto p-6 space-y-5">
          <form id="receipt-form" onSubmit={handleSubmit} className="space-y-5">
            {errors.length > 0 && (
              <div className="p-4 bg-rose-50 text-rose-600 text-sm rounded-2xl flex items-start gap-3 border border-rose-100">
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  {errors.map((err, i) => <p key={i} className="font-medium">{err}</p>)}
                </div>
              </div>
            )}

            {/* Main Amount Input */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 inline-flex">
                  <button
                    type="button"
                    onClick={() => handleChange('type', ReceiptType.INCOME)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      formData.type === ReceiptType.INCOME
                        ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('type', ReceiptType.EXPENSE)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      formData.type === ReceiptType.EXPENSE
                        ? 'bg-rose-100 text-rose-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Egreso
                  </button>
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Monto Total (PYG) *</label>
              <div className="relative">
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 font-bold text-xl ${
                  formData.type === ReceiptType.INCOME ? 'text-emerald-500' : 'text-rose-500'
                }`}>₲</span>
                <input
                  type="text"
                  className={`w-full bg-transparent text-3xl font-bold focus:outline-none pl-6 placeholder:text-slate-300 ${
                    formData.type === ReceiptType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                  value={formatAmount(formData.total)}
                  onChange={(e) => handleChange('total', parseAmount(e.target.value))}
                  placeholder="0"
                  autoFocus={!receipt?.id}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  Proveedor *
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium"
                  value={formData.providerName || ''}
                  onChange={(e) => handleChange('providerName', e.target.value)}
                  placeholder="Ej: Supermercado Stock"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Hash className="w-4 h-4 text-emerald-500" />
                    RUC
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    value={formData.ruc || ''}
                    onChange={(e) => handleChange('ruc', e.target.value)}
                    placeholder="80001234-5"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    Fecha *
                  </label>
                  <input
                    type="date"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleChange('date', new Date(e.target.value).toISOString())}
                  />
                </div>
              </div>

              {formData.type === ReceiptType.EXPENSE && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Tag className="w-4 h-4 text-emerald-500" />
                    Categoría
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(Category).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleChange('category', cat)}
                        className={`p-2 rounded-lg text-xs font-medium transition-all border ${
                          formData.category === cat 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.type === ReceiptType.EXPENSE && (
                <>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Nro. Factura</label>
                      <input
                        type="text"
                        className="w-full p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 text-sm"
                        value={formData.receiptNumber || ''}
                        onChange={(e) => handleChange('receiptNumber', e.target.value)}
                        placeholder="001-001-XXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Timbrado</label>
                      <input
                        type="text"
                        className="w-full p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 text-sm"
                        value={formData.timbrado || ''}
                        onChange={(e) => handleChange('timbrado', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">IVA 10%</label>
                      <input
                        type="text"
                        className="w-full p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 text-sm"
                        value={formatAmount(formData.iva10)}
                        onChange={(e) => handleChange('iva10', parseAmount(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">IVA 5%</label>
                      <input
                        type="text"
                        className="w-full p-2.5 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 text-sm"
                        value={formatAmount(formData.iva5)}
                        onChange={(e) => handleChange('iva5', parseAmount(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.type === ReceiptType.EXPENSE && (
                <div 
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleChange('isDeductible', !formData.isDeductible)}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    formData.isDeductible 
                      ? 'bg-emerald-500 border-emerald-500' 
                      : 'bg-white border-slate-300'
                  }`}>
                    {formData.isDeductible && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <label className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                    Gasto Deducible para IRP
                  </label>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-white md:rounded-b-3xl shrink-0 space-y-3">
          <button
            type="submit"
            form="receipt-form"
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Guardar Comprobante
          </button>
          
          {receipt?.id && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(receipt.id);
              }}
              className="w-full py-3 text-rose-500 font-bold text-sm hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Registro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
