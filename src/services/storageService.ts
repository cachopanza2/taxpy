import { Receipt, UserProfile } from '../types';

const API_BASE = '/api/comprobantes';

export const StorageService = {
  initializeDefaultUser: async (): Promise<UserProfile> => {
    // User is managed server-side now; return a local profile object for the UI
    return {
      id: 'default',
      name: 'Usuario Demo',
      email: 'demo@taxflow.py',
      settings: {
        currency: 'PYG',
        theme: 'light'
      }
    };
  },

  getUser: async (): Promise<UserProfile | null> => {
    return {
      id: 'default',
      name: 'Usuario Demo',
      email: 'demo@taxflow.py',
      settings: {
        currency: 'PYG',
        theme: 'light'
      }
    };
  },

  updateUser: async (_user: UserProfile): Promise<void> => {
    // User profile updates are local-only for now
  },

  getReceipts: async (_userId: string): Promise<Receipt[]> => {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Error al cargar comprobantes');
    return res.json();
  },

  addReceipt: async (receipt: Receipt): Promise<Receipt> => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
    });
    if (!res.ok) throw new Error('Error al crear comprobante');
    return res.json();
  },

  updateReceipt: async (receipt: Receipt): Promise<Receipt> => {
    const res = await fetch(`${API_BASE}/${receipt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receipt),
    });
    if (!res.ok) throw new Error('Error al actualizar comprobante');
    return res.json();
  },

  deleteReceipt: async (receiptId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/${receiptId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar comprobante');
  },

  clearAllData: async (): Promise<void> => {
    // Fetch all receipts and delete them one by one
    const receipts = await StorageService.getReceipts('default');
    for (const r of receipts) {
      await StorageService.deleteReceipt(r.id);
    }
  }
};
