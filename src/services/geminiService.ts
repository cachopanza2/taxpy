import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin, DocumentType } from '../types';

const MAX_SIDE_PX = 1200;
const JPEG_QUALITY = 0.82;

function compressToJpeg(dataUrl: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para comprimir.'));
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_SIDE_PX || height > MAX_SIDE_PX) {
        if (width >= height) {
          height = Math.round(height * (MAX_SIDE_PX / width));
          width = MAX_SIDE_PX;
        } else {
          width = Math.round(width * (MAX_SIDE_PX / height));
          height = MAX_SIDE_PX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No se pudo obtener contexto del canvas.')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const match = jpeg.match(/^data:(image\/jpeg);base64,(.+)$/);
      if (!match) { reject(new Error('Error al convertir imagen a JPEG.')); return; }
      resolve({ base64: match[2], mimeType: match[1] });
    };
    img.src = dataUrl;
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

export const GeminiService = {
  extractReceiptData: async (imageInput: File | string): Promise<Partial<Receipt>> => {
    const rawDataUrl = imageInput instanceof File
      ? await fileToDataUrl(imageInput)
      : imageInput;

    const { base64: base64Data, mimeType } = await compressToJpeg(rawDataUrl);

    const response = await fetch('/api/gemini-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType }),
    });

    if (!response.ok) {
      let message = `Error ${response.status}`;
      try {
        const err = await response.json();
        if (err?.error) message = err.error;
      } catch (_) { /* body no es JSON (error de infraestructura) */ }
      throw new Error(message);
    }

    const data = await response.json();

    let docType = DocumentType.OTHER;
    if (data.documentType === 'INVOICE') docType = DocumentType.INVOICE;
    else if (data.documentType === 'SELF_INVOICE') docType = DocumentType.SELF_INVOICE;
    else if (data.documentType === 'CREDIT_NOTE') docType = DocumentType.CREDIT_NOTE;
    else if (data.documentType === 'TICKET') docType = DocumentType.TICKET;

    const type = docType === DocumentType.CREDIT_NOTE ? ReceiptType.INCOME : ReceiptType.EXPENSE;

    return {
      providerName: data.providerName || 'Desconocido',
      ruc: data.ruc || '',
      timbrado: data.timbrado || '',
      receiptNumber: data.receiptNumber || '',
      date: data.date || new Date().toISOString(),
      total: data.total || 0,
      iva10: data.iva10 || 0,
      iva5: data.iva5 || 0,
      currency: data.currency || 'PYG',
      documentType: docType,
      type,
      category: Category.OTHER,
      origin: ReceiptOrigin.CAMERA,
      status: ReceiptStatus.PENDING,
      confidence: 0.95,
      isDeductible: true
    };
  }
};
