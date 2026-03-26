import { createWorker, Worker } from 'tesseract.js';
import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin, DocumentType } from '../types';

export interface OcrProgress {
  status: string;
  progress: number;
}

// Singleton worker instance to improve performance
let workerInstance: Worker | null = null;
let workerLoadingPromise: Promise<Worker> | null = null;
let currentProgressHandler: ((progress: OcrProgress) => void) | null = null;

const getWorker = async (): Promise<Worker> => {
  if (workerInstance) {
    return workerInstance;
  }

  if (!workerLoadingPromise) {
    workerLoadingPromise = createWorker('spa', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && currentProgressHandler) {
          currentProgressHandler({ status: m.status, progress: m.progress });
        }
      }
    });
  }

  workerInstance = await workerLoadingPromise;
  return workerInstance;
};

export const LocalOcrService = {
  preprocessImage: async (imageFile: File, rotation: number = 0, applyFilters: boolean = true): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          // OPTIMIZATION: Resize image to max width of 1600px for better detail
          const MAX_WIDTH = 1600;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = height * (MAX_WIDTH / width);
            width = MAX_WIDTH;
          }

          // Set canvas dimensions based on rotation
          if (rotation === 90 || rotation === 270) {
            canvas.width = height;
            canvas.height = width;
          } else {
            canvas.width = width;
            canvas.height = height;
          }

          // Apply rotation and drawing
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.drawImage(img, -width / 2, -height / 2, width, height);

          // Only apply filters if requested (for Local OCR)
          // For Gemini, we prefer the original (resized/rotated) image
          if (applyFilters) {
            // Get image data for pixel manipulation
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Apply filters: Grayscale + Contrast + Threshold
            const contrast = 60; 
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            const threshold = 160; 

            for (let i = 0; i < data.length; i += 4) {
              // Grayscale (weighted)
              const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              
              // Contrast
              let value = factor * (avg - 128) + 128;
              
              // Binarization
              value = value >= threshold ? 255 : 0;

              data[i] = value;     // Red
              data[i + 1] = value; // Green
              data[i + 2] = value; // Blue
            }

            ctx.putImageData(imageData, 0, 0);
          }

          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  },

  performOcr: async (
    imageDataUrl: string, 
    onProgress: (progress: OcrProgress) => void
  ): Promise<string> => {
    try {
      currentProgressHandler = onProgress;
      const worker = await getWorker();
      // PSM 6 (Assume a single uniform block of text) can sometimes be better for receipts
      // but PSM 3 (Auto) is generally safer for mixed layouts. 
      // We'll stick to Auto as it handles rotation/skew better.
      const { data: { text } } = await worker.recognize(imageDataUrl);
      return text;
    } catch (error) {
      console.error("OCR Error:", error);
      workerInstance = null;
      workerLoadingPromise = null;
      throw error;
    } finally {
      currentProgressHandler = null;
    }
  },

  parseReceiptData: (text: string): Partial<Receipt> => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = lines.join(' ').toUpperCase();
    
    // Helper to clean common OCR number errors
    const cleanNumber = (str: string) => str.replace(/O/gi, '0').replace(/I/gi, '1').replace(/l/gi, '1').replace(/B/gi, '8').replace(/S/gi, '5');

    // --- RUC Extraction ---
    // Handles: "RUC 8000...", "R.U.C. 8000...", "R0C 8000..."
    // Matches 5-8 digits, optional hyphen, 1 digit check digit
    const rucRegex = /(?:RUC|R\.U\.C\.?|R0C|PUC|DOCUMENTO)\s*[:.]?\s*([\d\.\sO]+)\s*[-]?\s*(\d{1})/i;
    let ruc = '';
    const rucMatch = fullText.match(rucRegex);
    if (rucMatch) {
       const mainPart = cleanNumber(rucMatch[1]).replace(/\D/g, ''); // Remove non-digits
       const checkDigit = cleanNumber(rucMatch[2]);
       if (mainPart.length >= 5) {
         ruc = `${mainPart}-${checkDigit}`;
       }
    }

    // --- Timbrado Extraction ---
    // Expects 8 digits. Handles "TIMBRADO", "TIMB", "TIM"
    const timbradoRegex = /(?:TIMBRADO|TIMB|TIM|T\.?)\.?\s*(?:N[º°])?[:.]?\s*(\d{8})/i;
    let timbrado = '';
    const timbradoMatch = fullText.match(timbradoRegex);
    if (timbradoMatch) {
        timbrado = cleanNumber(timbradoMatch[1]);
    }

    // --- Factura Number Extraction ---
    // Handles "001-001-0018825", "001-001 0013602"
    const facturaRegex = /(?:FACTURA|N[º°])\s*[:.]?\s*(\d{3})[\s-]*(\d{3})[\s-]*(\d{1,7})/i;
    const facturaFallbackRegex = /(\d{3})[\s-]*(\d{3})[\s-]*(\d{6,7})/; 
    
    let receiptNumber = '';
    const facturaMatch = fullText.match(facturaRegex);
    if (facturaMatch) {
        receiptNumber = `${cleanNumber(facturaMatch[1])}-${cleanNumber(facturaMatch[2])}-${cleanNumber(facturaMatch[3])}`;
    } else {
        const fallbackMatch = fullText.match(facturaFallbackRegex);
        if (fallbackMatch) {
            receiptNumber = `${cleanNumber(fallbackMatch[1])}-${cleanNumber(fallbackMatch[2])}-${cleanNumber(fallbackMatch[3])}`;
        }
    }
    
    // --- Date Extraction ---
    // Handles "25/02/2026", "23-02-2026", "23.02.26", "23 de Febrero de 2026"
    const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
    const textDateRegex = /(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+(\d{4})/i;
    
    let date = new Date().toISOString();
    
    const dateMatch = fullText.match(dateRegex);
    if (dateMatch) {
        let day = parseInt(dateMatch[1]);
        let month = parseInt(dateMatch[2]);
        let year = parseInt(dateMatch[3]);
        if (year < 100) year += 2000;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 2000 && year < 2030) {
            date = new Date(year, month - 1, day).toISOString();
        }
    } else {
        const textDateMatch = fullText.match(textDateRegex);
        if (textDateMatch) {
            const day = parseInt(textDateMatch[1]);
            const monthStr = textDateMatch[2].toUpperCase();
            const year = parseInt(textDateMatch[3]);
            const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
            const monthIndex = months.findIndex(m => monthStr.includes(m));
            if (monthIndex >= 0 && day >= 1 && day <= 31 && year > 2000 && year < 2030) {
                date = new Date(year, monthIndex, day).toISOString();
            }
        }
    }
    
    // --- Document Type Detection ---
    let documentType = DocumentType.OTHER;
    if (fullText.includes('AUTOFACTURA')) {
      documentType = DocumentType.SELF_INVOICE;
    } else if (fullText.includes('NOTA DE CREDITO') || fullText.includes('NOTA DE CRÉDITO') || fullText.includes('DEVOLUCION')) {
      documentType = DocumentType.CREDIT_NOTE;
    } else if (fullText.includes('FACTURA') || fullText.includes('TIMBRADO')) {
      documentType = DocumentType.INVOICE;
    } else if (fullText.includes('TICKET') || fullText.includes('BOLETA')) {
      documentType = DocumentType.TICKET;
    }

    // --- Total Extraction ---
    let total = 0;
    
    // Strategy 1: Look for "TOTAL GENERAL" or "TOTAL A PAGAR" specifically (Highest Confidence)
    const strongTotalRegex = /(?:TOTAL\s+(?:GENERAL|A\s+PAGAR)|TOTAL\s+GS\.?)\s*[:.]?\s*(?:GS|G)?\.?\s*([\d\.,]+)/i;
    const strongMatch = fullText.match(strongTotalRegex);
    
    const parseAmount = (str: string) => {
        // Remove thousands separators (dots) and replace decimal comma with dot
        // Handle cases where OCR sees ',' as '.' or vice versa
        // Heuristic: If there are multiple dots, they are thousands separators.
        // If there is one comma at the end, it's decimal.
        let clean = str.replace(/[^\d\.,]/g, '');
        
        // Check format 1.000.000,00
        if (clean.includes(',') && clean.indexOf(',') > clean.lastIndexOf('.')) {
             clean = clean.replace(/\./g, '').replace(',', '.');
        } 
        // Check format 1,000,000.00 (English style, less common in PY but possible in OCR)
        else if (clean.includes('.') && clean.indexOf('.') > clean.lastIndexOf(',')) {
             clean = clean.replace(/,/g, '');
        }
        // Check format 1.000.000 (No decimals)
        else if ((clean.match(/\./g) || []).length >= 1 && !clean.includes(',')) {
             clean = clean.replace(/\./g, '');
        }
        
        return parseFloat(clean);
    };

    if (strongMatch) {
        const val = parseAmount(strongMatch[1]);
        if (!isNaN(val)) total = val;
    }

    // Strategy 2: If no strong match, look for any "TOTAL" line and take the largest valid number
    if (total === 0) {
        let maxVal = 0;
        for (const line of lines) {
            const upper = line.toUpperCase();
            if (upper.includes('TOTAL') && !upper.includes('SUBTOTAL') && !upper.includes('IVA') && !upper.includes('GRAVADA')) {
                const numbers = line.match(/[\d\.,]+/g);
                if (numbers) {
                    for (const numStr of numbers) {
                        const val = parseAmount(numStr);
                        if (!isNaN(val) && val > maxVal) maxVal = val;
                    }
                }
            }
        }
        if (maxVal > 0) total = maxVal;
    }

    // Strategy 3: Fallback - Look for largest number in the bottom 30% of lines
    // (Only if we still don't have a total)
    if (total === 0 && lines.length > 5) {
        let maxVal = 0;
        const bottomLines = lines.slice(-Math.floor(lines.length * 0.3));
        for (const line of bottomLines) {
             // Skip phone numbers, RUCs, dates
             if (line.toUpperCase().includes('RUC') || line.includes('/') || line.length < 4) continue;
             
             const numbers = line.match(/[\d\.,]+/g);
             if (numbers) {
                 for (const numStr of numbers) {
                     // Filter out small numbers that might be quantities or prices
                     // Assume total is likely > 1000 PYG
                     const val = parseAmount(numStr);
                     if (!isNaN(val) && val > maxVal && val > 1000) maxVal = val;
                 }
             }
        }
        if (maxVal > 0) total = maxVal;
    }

    // --- IVA Extraction ---
    let iva10 = 0;
    let iva5 = 0;
    
    // Try to find explicit IVA breakdown
    // Look for "IVA 10%" or "10%" followed by a number
    const iva10Regex = /(?:IVA|GRAVADA|LIQUIDACION)?\s*(?:10%|10)\s*[:.]?\s*([\d\.,]+)/i;
    const iva5Regex = /(?:IVA|GRAVADA|LIQUIDACION)?\s*(?:5%|05%|5)\s*[:.]?\s*([\d\.,]+)/i;
    
    const iva10Match = fullText.match(iva10Regex);
    if (iva10Match) {
        const val = parseAmount(iva10Match[1]);
        if (!isNaN(val)) iva10 = val;
    }
    
    const iva5Match = fullText.match(iva5Regex);
    if (iva5Match) {
        const val = parseAmount(iva5Match[1]);
        if (!isNaN(val)) iva5 = val;
    }

    // Fallback for IVA if not found but Total exists
    if (iva10 === 0 && iva5 === 0 && total > 0) {
        iva10 = Math.round(total / 11);
    }

    // --- Provider Name Extraction ---
    let providerName = 'Desconocido';
    const skipWords = [
        'FECHA', 'RUC', 'TIMBRADO', 'FACTURA', 'CLIENTE', 'DIRECCION', 'CONDICION', 
        'CREDITO', 'CONTADO', 'VENCIMIENTO', 'CAJERO', 'MESA', 'SUCURSAL', 'CASA MATRIZ',
        'TEL', 'CEL', 'PAGINA', 'WEB', 'ASUNCION', 'PARAGUAY', 'DE:', 'PARA:'
    ];
    
    for (const line of lines) {
        const upperLine = line.toUpperCase();
        const isSkip = skipWords.some(word => upperLine.includes(word));
        const isDate = dateRegex.test(line);
        const isNumber = /^[\d\s\.\-\/]+$/.test(line);
        const isShort = line.length < 3;

        if (!isSkip && !isDate && !isNumber && !isShort) {
            providerName = line.replace(/^[^a-zA-Z0-9]+/, ''); // Clean leading symbols
            // If the line is very generic like "S.A." or "S.R.L.", append it to previous line if possible? 
            // For now, just take it.
            break;
        }
    }

    return {
      providerName: providerName,
      ruc: ruc,
      timbrado: timbrado,
      receiptNumber: receiptNumber,
      documentType: documentType,
      date: date,
      total: total,
      iva10: iva10,
      iva5: iva5,
      currency: 'PYG',
      type: documentType === DocumentType.CREDIT_NOTE ? ReceiptType.INCOME : ReceiptType.EXPENSE,
      category: Category.OTHER,
      origin: ReceiptOrigin.CAMERA,
      status: ReceiptStatus.PENDING,
      confidence: 0.8, // Increased confidence with better logic
      isDeductible: true
    };
  }
};

