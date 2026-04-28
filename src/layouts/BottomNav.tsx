import { Home, Car, Store, HelpCircle, ShieldCheck } from "lucide-react";
import { NavLink } from "@/layouts/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const baseItems = [
  { title: "Inicio", url: "/dashboard", icon: Home },
  { title: "Trámite", url: "/charlas", icon: Car },
  { title: "Pago", url: "/centro-comercio", icon: Store },
  { title: "Ayuda", url: "/faq", icon: HelpCircle },
];

const adminItem = { title: "Admin", url: "/admin", icon: ShieldCheck };

export function BottomNav() {
  const { isAdmin } = useAuth();
  const items = isAdmin ? [...baseItems.slice(0, 3), adminItem] : baseItems;

  return (
    <nav
      aria-label="Navegación principal móvil"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t border-border shadow-elevated"
    >
      <ul className="grid grid-cols-4 h-16">
        {items.map((item) => (
          <li key={item.url} className="flex">
            <NavLink
              to={item.url}
              end
              className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
              activeClassName="text-primary"
            >
              <item.icon className={cn("w-5 h-5")} />
              <span>{item.title}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
