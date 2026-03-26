import React, { useState, useEffect } from 'react';
import { X, Trash2, LogOut, Database, FileSpreadsheet, Info, User, Save } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { ExcelService } from '../services/excelService';
import { Receipt, UserProfile } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearData: () => void;
  receipts: Receipt[];
  userProfile: UserProfile | null;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onClearData, receipts, userProfile, onUpdateProfile }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName || userProfile.name.split(' ')[0] || '');
      setLastName(userProfile.lastName || userProfile.name.split(' ').slice(1).join(' ') || '');
    }
  }, [userProfile]);

  if (!isOpen) return null;

  const handleExport = () => {
    ExcelService.exportToExcel(receipts);
  };

  const handleSaveProfile = async () => {
    if (userProfile) {
      const updatedProfile = {
        ...userProfile,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim()
      };
      onUpdateProfile(updatedProfile);
      await StorageService.updateUser(updatedProfile);
      alert('Perfil actualizado');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="bg-white w-full md:max-w-sm md:rounded-3xl rounded-t-3xl shadow-2xl transform transition-transform duration-300 z-10 max-h-[90vh] overflow-y-auto">
        
        {/* Drag Handle for Mobile */}
        <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-20">
          <h2 className="text-xl font-bold text-slate-800">Configuración</h2>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Profile Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" /> Perfil
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Apellido</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tu apellido"
                />
              </div>
            </div>
            <button 
              onClick={handleSaveProfile}
              className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>

          <div className="h-px bg-slate-100 my-2"></div>

          <button 
            onClick={handleExport}
            className="w-full flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors text-left group border border-slate-100"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-800">Exportar Datos</p>
              <p className="text-xs text-slate-500 font-medium">Descargar todo en Excel</p>
            </div>
          </button>

          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-4 p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors text-left group border border-rose-100"
          >
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-rose-800">Borrar Todo</p>
              <p className="text-xs text-rose-600/70 font-medium">Eliminar registros locales</p>
            </div>
          </button>

          <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={() => {
              onClearData();
              onClose();
            }}
            title="¿Borrar todos los datos?"
            message="Esta acción eliminará todos los comprobantes y restablecerá tu perfil. No se puede deshacer."
          />

          <div className="pt-6 border-t border-slate-100 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full mb-2">
              <Info className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Info</span>
            </div>
            <p className="text-xs font-medium text-slate-500">TaxFlow.py v1.2.0</p>
            <p className="text-[10px] text-slate-400 mt-1">Desarrollado con Gemini AI</p>
          </div>
        </div>
      </div>
    </div>
  );
};
