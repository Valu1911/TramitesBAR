import {
  Video, ClipboardCheck, FileText, Car, Truck, HelpCircle, Headphones, Store, ShieldCheck, Home,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/muni-logo.png";

const userItems = [
  { title: "Inicio", url: "/dashboard", icon: Home },
  { title: "Charlas en video", url: "/charlas", icon: Video },
  { title: "Examen teórico", url: "/examen", icon: ClipboardCheck },
  { title: "Formularios de salud", url: "/formularios", icon: FileText },
  { title: "Centro de Comercio", url: "/centro-comercio", icon: Store },
  { title: "Examen práctico", url: "/practico", icon: Car },
  { title: "Entrega de licencia", url: "/entrega", icon: Truck },
];

const helpItems = [
  { title: "Preguntas frecuentes", url: "/faq", icon: HelpCircle },
  { title: "Soporte técnico", url: "/soporte", icon: Headphones },
];

const adminItems = [
  { title: "Panel de administración", url: "/admin", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand mini */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
          <img src={logo} alt="Muni Digital" className="w-7 h-7 flex-shrink-0" width={28} height={28} />
          {!collapsed && (
            <span className="font-extrabold text-sm text-sidebar-primary tracking-tight truncate">
              Muni Digital
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Trámite</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/60 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Ayuda</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {helpItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/60 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/60 transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
