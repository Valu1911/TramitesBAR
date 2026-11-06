import { useEffect, useRef } from 'react';

/** Señala obligatoriedad sin duplicar el nombre accesible del campo. */
export function RequiredMark() {
  return <span className="required-asterisk" aria-hidden="true"> *</span>;
}

/** Explica la convención visual antes de completar un formulario. */
export function RequiredFieldsNote() {
  return <p className="required-fields-note">Los campos con <RequiredMark /> son obligatorios.</p>;
}

/** Lleva el error al área visible y lo anuncia sin perder los datos ingresados. */
export function FormError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, [message]);
  return <div ref={ref} className="alert alert-danger form-feedback" role="alert" tabIndex={-1}>{message}</div>;
}
