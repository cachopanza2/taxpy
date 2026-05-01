import { Receipt, UserProfile } from '../types';
import { AuthService } from './authService';

const API_BASE = '/api/comprobantes';

function authHeaders(): Record<string, string> {
  const token = AuthService.getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers as Record<string, string> || {}) },
  });
  if (res.status === 401) {
    AuthService.clearSession();
    window.location.href = '/';
    throw new Error('Sesión expirada. Por favor iniciá sesión nuevamente.');
  }
  return res;
}

export const StorageService = {
  initializeDefaultUser: async (): Promise<UserProfile> => {
    const user = AuthService.getUser();
    if (user) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        settings: { currency: 'PYG', theme: 'light' },
      };
    }
    return {
      id: 'default',
      name: 'Usuario Demo',
      email: 'demo@taxflow.py',
      settings: { currency: 'PYG', theme: 'light' },
    };
  },

  getUser: async (): Promise<UserProfile | null> => {
    const user = AuthService.getUser();
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      settings: { currency: 'PYG', theme: 'light' },
    };
  },

  updateUser: async (_user: UserProfile): Promise<void> => {
    // Profile updates are local-only for now
  },

  getReceipts: async (_userId: string): Promise<Receipt[]> => {
    const res = await apiFetch(API_BASE);
    if (!res.ok) throw new Error('Error al cargar comprobantes');
    return res.json();
  },

  addReceipt: async (receipt: Receipt): Promise<Receipt> => {
    const res = await apiFetch(API_BASE, {
      method: 'POST',
      body: JSON.stringify(receipt),
    });
    if (!res.ok) throw new Error('Error al crear comprobante');
    return res.json();
  },

  updateReceipt: async (receipt: Receipt): Promise<Receipt> => {
    const res = await apiFetch(`${API_BASE}/${receipt.id}`, {
      method: 'PUT',
      body: JSON.stringify(receipt),
    });
    if (!res.ok) throw new Error('Error al actualizar comprobante');
    return res.json();
  },

  deleteReceipt: async (receiptId: string): Promise<void> => {
    const res = await apiFetch(`${API_BASE}/${receiptId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar comprobante');
  },

  clearAllData: async (): Promise<void> => {
    const receipts = await StorageService.getReceipts('');
    for (const r of receipts) {
      await StorageService.deleteReceipt(r.id);
    }
  },
};
