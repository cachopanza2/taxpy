import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin, DocumentType } from '../types';

async function fileOrDataUrlToBase64(imageInput: File | string): Promise<{ base64Data: string; mimeType: string }> {
  if (imageInput instanceof File) {
    const mimeType = imageInput.type;
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageInput);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });
    return { base64Data, mimeType };
  }

  const matches = imageInput.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], base64Data: matches[2] };
  }
  throw new Error("Invalid image input format");
}

export const GeminiService = {
  extractReceiptData: async (imageInput: File | string): Promise<Partial<Receipt>> => {
    try {
      const { base64Data, mimeType } = await fileOrDataUrlToBase64(imageInput);

      const res = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.details || errBody.error || `Error ${res.status} al extraer datos`);
      }

      const data = await res.json();

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
        type: type,
        category: Category.OTHER,
        origin: ReceiptOrigin.CAMERA,
        status: ReceiptStatus.PENDING,
        confidence: 0.95,
        isDeductible: true
      };

    } catch (error) {
      console.error("Gemini Extraction Error:", error);
      throw error;
    }
  }
};
