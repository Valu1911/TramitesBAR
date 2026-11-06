import type { DocumentItem } from './types';

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Es una ayuda de UX: el servidor vuelve a validar tamaño y contenido real. */
export function receiptError(file: File): string | null {
  if (file.size === 0) return 'El comprobante está vacío. Elegí otro archivo.';
  if (file.size > RECEIPT_MAX_BYTES) return 'El comprobante no puede superar 10 MB en el portal.';
  if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name) || (file.type && !RECEIPT_MIMES.includes(file.type))) {
    return 'Elegí un comprobante PDF, JPG, PNG o WEBP. El servidor verificará el formato real.';
  }
  return null;
}

/** Un adjunto observado o vinculado a un pago rechazado nunca se reutiliza solo. */
export function reusableReceipt(documents: DocumentItem[], status: string): DocumentItem | null {
  if (status !== 'pending') return null;
  return documents.filter((doc) => doc.kind === 'payment_receipt' && doc.status !== 'rejected')
    .sort((a, b) => b.id - a.id)[0] ?? null;
}

/** El monto solo se presenta; jamás se envía desde el cliente como autoridad de cobro. */
export function formatPaymentAmount(amount: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(amount));
}

/** Solo los estados explícitos de API habilitan declarar o corregir una transferencia. */
export function paymentState(status: string) {
  switch (status) {
    case 'pending': return { title: 'Pago pendiente', description: 'Realizá la transferencia e informá sus datos para la revisión municipal.', canClaim: true };
    case 'rejected': return { title: 'Pago observado', description: 'Revisá la observación municipal y adjuntá un nuevo comprobante para corregirlo.', canClaim: true };
    case 'claimed': return { title: 'Comprobante en revisión', description: 'El área de pagos debe verificar la transferencia. Enviar el comprobante no significa que el pago esté aprobado.', canClaim: false };
    case 'pending_second': return { title: 'Pendiente de segundo control', description: 'El pago necesita otra revisión municipal. No vuelvas a transferir ni a enviar el comprobante.', canClaim: false };
    case 'approved': return { title: 'Pago aprobado', description: 'La Municipalidad aprobó el pago. Volvé al panel para consultar la siguiente etapa.', canClaim: false };
    case 'refunded': return { title: 'Pago reintegrado', description: 'Consultá con la oficina de licencias antes de realizar otra transferencia.', canClaim: false };
    default: return { title: 'Estado de pago no disponible', description: 'No pudimos interpretar el estado informado. Actualizá el estado o consultá con la Municipalidad.', canClaim: false };
  }
}
