import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { BottomNav } from "@/components/BottomNav";

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
