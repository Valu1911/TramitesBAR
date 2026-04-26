import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import logo from "@/assets/muni-logo.png";

export function AppFooter() {
  return (
    <footer className="mt-10 border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Muni Digital" className="w-8 h-8" width={32} height={32} loading="lazy" />
            <span className="font-extrabold text-primary text-base">Muni Digital</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Portal del vecino para realizar trámites municipales en pocos clicks, desde tu celular.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Enlaces</h3>
          <ul className="space-y-1.5 text-xs">
            <li><Link to="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">Inicio</Link></li>
            <li><Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">Preguntas frecuentes</Link></li>
            <li><Link to="/soporte" className="text-muted-foreground hover:text-primary transition-colors">Soporte técnico</Link></li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Contacto</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-accent" /> 0800-MUNI-DIG</li>
            <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-accent" /> contacto@munidigital.gob.ar</li>
            <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-accent" /> Municipalidad local</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-3 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Muni Digital · Todos los derechos reservados
      </div>
    </footer>
  );
}
