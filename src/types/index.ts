// Tipos compartidos de la aplicación Muni Digital

export interface User {
  dni: string;
  role: "admin" | "user";
  dniFrontImage?: string;
  dniBackImage?: string;
}
