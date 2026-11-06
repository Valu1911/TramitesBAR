import { describe, expect, it } from 'vitest';
import { formatPaymentAmount, paymentState, receiptError, RECEIPT_MAX_BYTES, reusableReceipt } from './payment';
import type { DocumentItem } from './types';

describe('Estado del pago', () => {
  it.each(['pending', 'rejected'])('solo %s permite declarar o corregir', (status) => {
    expect(paymentState(status).canClaim).toBe(true);
  });
  it.each(['claimed', 'pending_second', 'approved', 'refunded', 'desconocido', '__proto__', ''])('%s no permite reenviar', (status) => {
    expect(paymentState(status).canClaim).toBe(false);
  });
  it('enviar un comprobante no significa aprobar', () => {
    expect(paymentState('claimed').title).toBe('Comprobante en revisión');
    expect(paymentState('pending_second').title).toBe('Pendiente de segundo control');
  });
});

describe('Comprobante', () => {
  it.each([
    ['pago.pdf', 'application/pdf'], ['pago.JPG', 'image/jpeg'], ['pago.png', 'image/png'],
    ['pago.webp', 'image/webp'], ['pago.pdf', ''],
  ])('permite elegir %s con MIME %s como ayuda previa a la validación real', (name, type) => {
    expect(receiptError(new File(['prueba'], name, { type }))).toBeNull();
  });
  it.each([
    ['pago.html', 'text/html'], ['pago.pdf', 'text/html'], ['pago.pdf.exe', 'application/pdf'],
  ])('rechaza la selección %s con MIME %s', (name, type) => {
    expect(receiptError(new File(['prueba'], name, { type }))).toContain('Elegí un comprobante');
  });
  it('rechaza archivos vacíos', () => {
    expect(receiptError(new File([], 'pago.pdf'))).toContain('vacío');
  });
  it('rechaza más de 10 MB', () => {
    expect(receiptError(new File([new Uint8Array(RECEIPT_MAX_BYTES + 1)], 'pago.pdf', { type: 'application/pdf' }))).toContain('10 MB');
  });
  it('presenta moneda argentina sin cambiar el monto del servidor', () => {
    expect(formatPaymentAmount('1234.50').replace(/\s/g, '')).toBe('$1.234,50');
  });
  it('solo reutiliza un adjunto válido de una declaración todavía pendiente', () => {
    const base: DocumentItem = { id: 1, kind: 'payment_receipt', status: 'pending', original_name: 'prueba.pdf',
      mime: 'application/pdf', size_bytes: 1, created_at: '2026-01-01T12:00:00Z', review_notes: null };
    const documents: DocumentItem[] = [base, { ...base, id: 5 }, { ...base, id: 8, status: 'rejected' }, { ...base, id: 9, kind: 'health_certificate' }];
    expect(reusableReceipt(documents, 'pending')?.id).toBe(5);
    expect(documents.map(({ id }) => id)).toEqual([1, 5, 8, 9]);
    for (const status of ['rejected', 'claimed', 'pending_second', 'approved', 'refunded']) {
      expect(reusableReceipt(documents, status)).toBeNull();
    }
  });
});
