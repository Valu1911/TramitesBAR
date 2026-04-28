import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/muni-logo.png";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="h-full px-3 md:px-6 flex items-center gap-3">
        {/* Trigger sidebar (visible en md+) */}
        <SidebarTrigger className="hidden md:inline-flex" />

        {/* Logo + brand */}
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="Muni Digital" className="w-9 h-9 flex-shrink-0" width={36} height={36} />
          <div className="leading-tight min-w-0">
            <span className="block text-base font-extrabold text-primary tracking-tight">Muni Digital</span>
            <span className="hidden sm:block text-[11px] text-muted-foreground -mt-0.5">Trámites simples para tu ciudad</span>
          </div>
        </Link>

        {/* Right area */}
        <div className="ml-auto flex items-center gap-1.5 md:gap-3">
          {user && (
            <>
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                <UserIcon className="w-3.5 h-3.5" />
                DNI {user.dni} · {user.role === "admin" ? "Admin" : "Vecino"}
              </span>
              <Button variant="ghost" size="icon" aria-label="Notificaciones" className="text-muted-foreground hover:text-primary">
                <Bell className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4 md:mr-1.5" />
                <span className="hidden md:inline">Salir</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
