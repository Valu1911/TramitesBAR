import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/layouts/AppSidebar";
import { AppHeader } from "@/layouts/AppHeader";
import { AppFooter } from "@/layouts/AppFooter";
import { BottomNav } from "@/layouts/BottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar solo en md+ */}
        <div className="hidden md:flex">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <AppFooter />
        </div>
      </div>

      {/* Bottom nav: solo mobile/tablet */}
      <BottomNav />
    </SidebarProvider>
  );
}
