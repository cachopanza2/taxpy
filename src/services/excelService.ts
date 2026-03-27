import * as XLSX from 'xlsx';
import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin } from '../types';

export const ExcelService = {
  exportToExcel: (receipts: Receipt[], filename: string = 'gastos_irp.xlsx') => {
    const data = receipts.map(r => ({
      Fecha: new Date(r.date).toLocaleDateString('es-PY'),
      RUC: r.ruc,
      Proveedor: r.providerName,
      'Nro. Factura': r.receiptNumber,
      Timbrado: r.timbrado,
      Categoría: r.category,
      Total: r.total,
      'IVA 10%': r.iva10,
      'IVA 5%': r.iva5,
      Tipo: r.type === ReceiptType.EXPENSE ? 'Egreso' : 'Ingreso',
      Estado: r.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Egresos IRP");
    XLSX.writeFile(wb, filename);
  },

  importFromExcel: async (file: File, userId: string): Promise<Receipt[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const receipts: Receipt[] = jsonData.map((row: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            userId,
            date: (() => {
              const raw = row['Fecha'];
              if (!raw) return new Date().toISOString();
              if (raw instanceof Date) {
                // cellDates:true -> Date in local time; use noon to avoid TZ shift on .toISOString()
                const d = new Date(raw);
                d.setHours(12, 0, 0, 0);
                return d.toISOString();
              }
              if (typeof raw === 'number') {
                // Excel serial: days since 1900-01-01; add noon offset to avoid TZ shift
                const ms = Math.round((raw - 25569) * 86400 * 1000) + 12 * 3600 * 1000;
                return new Date(ms).toISOString();
              }
              if (typeof raw === 'string' && raw.includes('/')) {
                const p = raw.split('/');
                if (p.length === 3 && p[0].length <= 2) {
                  // DD/MM/YYYY -> use local noon (not UTC midnight) to avoid TZ shift
                  return new Date(+p[2], +p[1] - 1, +p[0], 12, 0, 0).toISOString();
                }
              }
              return new Date(raw).toISOString();
            })(),
            providerName: row['Proveedor'] || 'Importado',
            ruc: row['RUC'] || '',
            timbrado: row['Timbrado'] || '',
            receiptNumber: (row['NRO FACTURA'] || row['Nro. Factura'] || '') as string || '',
            total: Number(row['monto total'] ?? row['Total'] ?? 0) || 0,
            iva10: Number(row['IVA 10%']) || 0,
            iva5: Number(row['IVA 5%']) || 0,
            currency: 'PYG',
            type: (() => { const t = ((row['Tipo de Registro'] || row['Tipo'] || '') as string).toUpperCase(); return (t === 'VENTAS' || t === 'INGRESOS' || t === 'INGRESO') ? ReceiptType.INCOME : ReceiptType.EXPENSE; })(),
            category: (Object.values(Category).includes(row['Categoría'])) ? row['Categoría'] : Category.OTHER,
            irpInciso: '',
            origin: ReceiptOrigin.EXCEL,
            status: ReceiptStatus.VERIFIED,
            confidence: 1,
            createdAt: Date.now()
          }));

          resolve(receipts);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }
};
