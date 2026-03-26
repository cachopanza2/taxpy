import { GoogleGenAI, Type } from "@google/genai";
import { Receipt, ReceiptType, Category, ReceiptStatus, ReceiptOrigin, DocumentType } from '../types';

export const GeminiService = {
  extractReceiptData: async (imageInput: File | string): Promise<Partial<Receipt>> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      let base64Data: string;
      let mimeType: string;

      if (imageInput instanceof File) {
        mimeType = imageInput.type;
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(imageInput);
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
        });
      } else {
        // Assume it's a data URL
        const matches = imageInput.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          throw new Error("Invalid image input format");
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: 'user',
            parts: [
              { text: `
                Analiza esta imagen de una factura o ticket de Paraguay.
                Extrae los siguientes datos con la mayor precisión posible:
                - Nombre del proveedor (Razon Social)
                - RUC del emisor (formato XXXXXXXX-X)
                - Timbrado (8 dígitos)
                - Número de factura (formato XXX-XXX-XXXXXXX)
                - Fecha de emisión (formato ISO YYYY-MM-DD)
                - Total a pagar (en Guaraníes, PYG)
                - IVA 10% y IVA 5% (si están discriminados)
                - Tipo de documento (Factura, Autofactura, Nota de Crédito, Ticket)
                
                Si algún campo no es visible o no existe, déjalo vacío o en 0.
                Para el RUC, asegúrate de incluir el dígito verificador.
                Para el número de factura, intenta reconstruir el formato completo 001-001-XXXXXXX si es posible.
              ` },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              providerName: { type: Type.STRING },
              ruc: { type: Type.STRING },
              timbrado: { type: Type.STRING },
              receiptNumber: { type: Type.STRING },
              date: { type: Type.STRING },
              total: { type: Type.NUMBER },
              iva10: { type: Type.NUMBER },
              iva5: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              documentType: { type: Type.STRING, enum: ["INVOICE", "SELF_INVOICE", "CREDIT_NOTE", "TICKET", "OTHER"] }
            },
            required: ["providerName", "total", "date", "currency"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text from Gemini");
      }
      
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJson);

      // Map response to Receipt type
      let docType = DocumentType.OTHER;
      if (data.documentType === 'INVOICE') docType = DocumentType.INVOICE;
      else if (data.documentType === 'SELF_INVOICE') docType = DocumentType.SELF_INVOICE;
      else if (data.documentType === 'CREDIT_NOTE') docType = DocumentType.CREDIT_NOTE;
      else if (data.documentType === 'TICKET') docType = DocumentType.TICKET;

      // Determine ReceiptType based on DocumentType
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
