import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { ReceiptList } from './components/ReceiptList';
import { Reports } from './components/Reports';
import { ReceiptModal } from './components/ReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { StorageService } from './services/storageService';
import { LocalOcrService, OcrProgress } from './services/localOcrService';
import { GeminiService } from './services/geminiService';
import { ExcelService } from './services/excelService';
import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin, UserProfile } from './types';
import { Home, List, PieChart, Plus, Settings, Camera, Image, FileSpreadsheet, Loader2, User, ScanLine, X, RotateCw, Check } from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'receipts' | 'reports'>('dashboard');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [isNewReceipt, setIsNewReceipt] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  
  // Preprocessing State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const profile = await StorageService.initializeDefaultUser();
        setUserProfile(profile);
        
        const savedReceipts = await StorageService.getReceipts(profile.id);
        setReceipts(savedReceipts);
      } catch (error) {
        console.error("Initialization error:", error);
        setInitError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsInitializing(false);
      }
    };
    initData();
  }, []);

  const refreshData = async () => {
     if (userProfile) {
       try {
         const data = await StorageService.getReceipts(userProfile.id);
         setReceipts(data);
       } catch (error) {
         console.error("Refresh error:", error);
       }
     }
  };

  const handleUpdateProfile = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
  };

  const [processingError, setProcessingError] = useState<string | null>(null);

  const processImage = async (file: File) => {
    // Instead of processing immediately, open the preprocessing modal
    setSelectedFile(file);
    setRotation(0);
    setProcessingError(null);
    setShowUploadMenu(false);

    // Create a preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePreprocessingConfirm = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProcessingError(null);
    setOcrProgress({ status: 'preprocessing', progress: 0 });

    try {
      // 1. Preprocess Image (Rotation & Resizing mainly)
      // We still use LocalOcrService for preprocessing as it handles canvas operations well
      // Pass false to skip B&W filters for Gemini (better accuracy with color)
      const preprocessedImageUrl = await LocalOcrService.preprocessImage(selectedFile, rotation, false);
      
      setOcrProgress({ status: 'analyzing', progress: 0.5 });

      // 2. Extract Data using Gemini
      const extractedData = await GeminiService.extractReceiptData(preprocessedImageUrl);

      setOcrProgress({ status: 'completed', progress: 1 });

      const newReceipt: Receipt = {
        id: generateId(),
        userId: userProfile?.id || 'unknown',
        ...extractedData as any,
        imageUrl: preprocessedImageUrl, // Save the enhanced image
        origin: ReceiptOrigin.CAMERA,
        createdAt: Date.now(),
        warnings: []
      };

      setEditReceipt(newReceipt);
      setIsNewReceipt(true);
      setIsModalOpen(true);
      
      // Close preprocessing modal
      setPreviewImage(null);
      setSelectedFile(null);

    } catch (error) {
      console.error("Error processing image:", error);
      setProcessingError(error instanceof Error ? error.message : "No se pudo procesar la imagen. Intenta nuevamente.");
    } finally {
      setIsProcessing(false);
      setOcrProgress(null);
    }
  };

  const handlePreprocessingCancel = () => {
    setPreviewImage(null);
    setSelectedFile(null);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = '';
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && userProfile) {
      setIsProcessing(true);
      setShowUploadMenu(false);
      try {
        const newReceipts = await ExcelService.importFromExcel(file, userProfile.id);
        for (const r of newReceipts) {
          await StorageService.addReceipt(r);
        }
        await refreshData();
        alert(`Se importaron ${newReceipts.length} comprobantes exitosamente.`);
      } catch (error) {
        alert("Error importando Excel: " + error);
      } finally {
        setIsProcessing(false);
      }
    }
    e.target.value = '';
  };

  const saveReceipt = async (r: Receipt) => {
    const receiptToSave = { ...r, status: ReceiptStatus.VERIFIED };

    if (isNewReceipt) {
      const saved = await StorageService.addReceipt(receiptToSave);
      setReceipts(prev => [saved, ...prev]);
    } else {
      const saved = await StorageService.updateReceipt(receiptToSave);
      setReceipts(prev => prev.map(existing => existing.id === r.id ? saved : existing));
    }

    setEditReceipt(null);
    setIsNewReceipt(false);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!id) return;
    setReceiptToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete) return;

    try {
      // 1. Update storage
      await StorageService.deleteReceipt(receiptToDelete);
      
      // 2. Update local state immediately for instant UI feedback
      setReceipts(prev => prev.filter(r => r.id !== receiptToDelete));
      
      // 3. Close modal if it was open for this receipt
      if (editReceipt?.id === receiptToDelete) {
        setIsModalOpen(false);
        setEditReceipt(null);
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
      alert('No se pudo eliminar el comprobante.');
    } finally {
      setIsConfirmModalOpen(false);
      setReceiptToDelete(null);
    }
  };

  const handleClearData = async () => {
    await StorageService.clearAllData();
    window.location.reload();
  };

  const handleManualEntry = () => {
    const newR: Receipt = {
      id: generateId(),
      userId: userProfile?.id || 'unknown',
      date: new Date().toISOString(),
      providerName: '',
      ruc: '',
      timbrado: '',
      receiptNumber: '',
      total: 0,
      iva10: 0,
      iva5: 0,
      currency: 'PYG',
      type: ReceiptType.EXPENSE,
      category: Category.OTHER,
      irpInciso: '',
      origin: ReceiptOrigin.MANUAL,
      status: ReceiptStatus.VERIFIED,
      confidence: 1,
      createdAt: Date.now(),
      isDeductible: true
    };
    setEditReceipt(newR);
    setIsNewReceipt(true);
    setIsModalOpen(true);
    setShowUploadMenu(false);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
            <ScanLine className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Cargando TaxFlow...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
            <X className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Error al iniciar</h2>
          <p className="text-slate-500 text-sm">No pudimos cargar tus datos. Por favor, intenta recargar la página.</p>
          <div className="p-3 bg-slate-100 rounded-lg text-[10px] font-mono text-slate-400 break-all">
            {initError}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-hidden">
      <div className="max-w-md mx-auto h-full bg-[#f8fafc] shadow-2xl relative flex flex-col border-x border-slate-100">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-50 transition-all shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex items-center justify-center overflow-hidden shadow-sm">
                <User className="w-5 h-5 text-emerald-700" />
             </div>
             <div>
               <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">TaxFlow<span className="text-emerald-500">.py</span></h1>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wide">
                 {userProfile?.name?.split(' ')[0] || 'Usuario'}
               </p>
             </div>
           </div>
           <button 
             onClick={() => setShowSettings(true)}
             className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
           >
             <Settings className="w-5 h-5" />
           </button>
        </header>

        <main className="flex-1 px-6 pt-6 pb-28 overflow-y-auto no-scrollbar scroll-smooth">
           {activeTab === 'dashboard' && (
             <Dashboard 
               receipts={receipts} 
               onDelete={handleDelete}
               onSelect={(r) => { 
                 setEditReceipt(r); 
                 setIsNewReceipt(false); 
                 setIsModalOpen(true); 
               }}
             />
           )}
           {activeTab === 'receipts' && (
             <ReceiptList 
               receipts={receipts} 
               onSelect={(r) => { 
                 setEditReceipt(r); 
                 setIsNewReceipt(false); 
                 setIsModalOpen(true); 
               }} 
               onDelete={handleDelete} 
             />
           )}
           {activeTab === 'reports' && <Reports receipts={receipts} />}
        </main>

        {/* Floating Action Button & Menu */}
        <div className="fixed bottom-24 right-6 z-40 md:absolute md:right-6 md:bottom-24">
          {/* Backdrop for menu */}
          {showUploadMenu && (
            <div 
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-30 transition-opacity"
              onClick={() => setShowUploadMenu(false)}
            />
          )}

          <div className={`absolute bottom-20 right-0 flex flex-col gap-3 transition-all duration-300 z-40 ${showUploadMenu ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90 pointer-events-none'}`}>
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-sm font-bold">Escanear</span>
              <Camera className="w-5 h-5" />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-5 py-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-sm font-bold">Galería</span>
              <Image className="w-5 h-5" />
            </button>
            <button 
              onClick={() => excelInputRef.current?.click()}
              className="flex items-center gap-3 px-5 py-3 bg-green-700 text-white rounded-2xl shadow-xl shadow-green-700/20 hover:bg-green-800 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-sm font-bold">Excel</span>
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button 
              onClick={handleManualEntry}
              className="flex items-center gap-3 px-5 py-3 bg-slate-700 text-white rounded-2xl shadow-xl shadow-slate-700/20 hover:bg-slate-800 transition-transform hover:scale-105 active:scale-95"
            >
              <span className="text-sm font-bold">Manual</span>
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <button 
            onClick={() => setShowUploadMenu(!showUploadMenu)}
            className={`w-16 h-16 rounded-2xl shadow-2xl shadow-emerald-500/30 flex items-center justify-center transition-all duration-300 z-50 ${showUploadMenu ? 'bg-slate-800 rotate-45' : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-105 active:scale-95'}`}
          >
            {showUploadMenu ? <Plus className="w-8 h-8 text-white" /> : <ScanLine className="w-8 h-8 text-white" />}
          </button>
        </div>

        {/* Hidden Inputs */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          ref={cameraInputRef} 
          className="hidden" 
          onChange={handleFileUpload}
        />
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileUpload}
        />
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          ref={excelInputRef} 
          className="hidden" 
          onChange={handleExcelUpload}
        />

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-6 py-2 z-40 pb-safe">
          <div className="flex justify-around items-center max-w-md mx-auto h-16">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'dashboard' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Home className={`w-6 h-6 ${activeTab === 'dashboard' ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold">Inicio</span>
            </button>
            <button 
              onClick={() => setActiveTab('receipts')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'receipts' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-6 h-6" />
              <span className="text-[10px] font-bold">Lista</span>
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${activeTab === 'reports' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <PieChart className={`w-6 h-6 ${activeTab === 'reports' ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold">Reportes</span>
            </button>
          </div>
        </nav>

        {/* Modals & Overlays */}
        {/* Preprocessing Modal */}
        {previewImage && !isProcessing && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
              <img 
                src={previewImage} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain transition-transform duration-300"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </div>
            
            <div className="bg-slate-900 p-6 pb-safe border-t border-slate-800">
              <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                <button 
                  onClick={handlePreprocessingCancel}
                  className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                
                <button 
                  onClick={handleRotate}
                  className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  <RotateCw className="w-6 h-6" />
                </button>
                
                <button 
                  onClick={handlePreprocessingConfirm}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-6 h-6" />
                  Procesar
                </button>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ScanLine className="w-8 h-8 text-emerald-600 animate-pulse" />
              </div>
            </div>
            
            <h3 className="text-slate-800 font-bold text-xl mb-2">Procesando Comprobante</h3>
            
            {ocrProgress && (
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <span>{ocrProgress.status === 'recognizing text' ? 'Leyendo texto...' : 'Preparando imagen...'}</span>
                  <span>{Math.round(ocrProgress.progress * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${ocrProgress.progress * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {!ocrProgress && (
              <p className="text-slate-500 text-sm">Iniciando motor OCR...</p>
            )}
          </div>
        )}

        {processingError && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <X className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Error al procesar</h3>
              <p className="text-slate-500 text-sm text-center mb-6">
                {processingError}
              </p>
              <button 
                onClick={() => setProcessingError(null)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        <ReceiptModal 
          isOpen={isModalOpen}
          receipt={editReceipt}
          onClose={() => { setIsModalOpen(false); setEditReceipt(null); }}
          onSave={saveReceipt}
          onDelete={handleDelete}
        />

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onClearData={handleClearData}
          receipts={receipts}
          userProfile={userProfile}
          onUpdateProfile={handleUpdateProfile}
        />

        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={confirmDelete}
          title="¿Eliminar comprobante?"
          message="Esta acción no se puede deshacer. El registro se eliminará permanentemente."
        />

      </div>
    </div>
  );
}

export default App;
