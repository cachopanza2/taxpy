import * as XLSX from 'xlsx';
import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin } from '../types';

// Normalize a string for matching: lowercase, trimmed, accents removed.
const normalizeKey = (value: string): string =>
  value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Lookup table from a normalized value to a Category. Includes the Spanish
// display names, their accent-free variants, and common English synonyms so a
// category written in almost any reasonable way is matched instead of falling
// back to "Otros".
const CATEGORY_LOOKUP: Record<string, Category> = (() => {
  const map: Record<string, Category> = {};
  // Spanish display names (with and without accents, via normalizeKey)
  for (const value of Object.values(Category)) {
    map[normalizeKey(value)] = value;
  }
  // English / alternate synonyms
  const synonyms: Record<string, Category> = {
    food: Category.FOOD,
    meal: Category.FOOD,
    transport: Category.TRANSPORT,
    transportation: Category.TRANSPORT,
    health: Category.HEALTH,
    medical: Category.HEALTH,
    education: Category.EDUCATION,
    clothing: Category.CLOTHING,
    housing: Category.HOUSING,
    home: Category.HOUSING,
    entertainment: Category.ENTERTAINMENT,
    services: Category.SERVICES,
    service: Category.SERVICES,
    other: Category.OTHER,
    others: Category.OTHER,
  };
  for (const [key, cat] of Object.entries(synonyms)) {
    map[normalizeKey(key)] = cat;
  }
  return map;
})();

// Resolve the category cell from a row, tolerating different header spellings
// (accents, casing, English) and different written values.
const resolveCategory = (row: Record<string, any>): Category => {
  const headerCandidates = ['Categoría', 'Categoria', 'Category', 'Rubro'];
  let raw: unknown;
  for (const header of headerCandidates) {
    if (row[header] != null && row[header] !== '') {
      raw = row[header];
      break;
    }
  }
  // Fallback: scan all keys for one whose normalized name is "categoria".
  if (raw == null) {
    for (const key of Object.keys(row)) {
      if (normalizeKey(key) === 'categoria' || normalizeKey(key) === 'category') {
        raw = row[key];
        break;
      }
    }
  }
  if (raw == null || raw === '') return Category.OTHER;
  return CATEGORY_LOOKUP[normalizeKey(String(raw))] ?? Category.OTHER;
};

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
            category: resolveCategory(row),
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
