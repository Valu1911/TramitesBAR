import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Charlas from "./pages/Charlas";
import Examen from "./pages/Examen";
import Formularios from "./pages/Formularios";
import Practico from "./pages/Practico";
import Entrega from "./pages/Entrega";
import FAQ from "./pages/FAQ";
import Soporte from "./pages/Soporte";
import CentroComercio from "./pages/CentroComercio";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
            <Route path="/charlas" element={<AppLayout><Charlas /></AppLayout>} />
            <Route path="/examen" element={<AppLayout><Examen /></AppLayout>} />
            <Route path="/formularios" element={<AppLayout><Formularios /></AppLayout>} />
            <Route path="/centro-comercio" element={<AppLayout><CentroComercio /></AppLayout>} />
            <Route path="/practico" element={<AppLayout><Practico /></AppLayout>} />
            <Route path="/entrega" element={<AppLayout><Entrega /></AppLayout>} />
            <Route path="/faq" element={<AppLayout><FAQ /></AppLayout>} />
            <Route path="/soporte" element={<AppLayout><Soporte /></AppLayout>} />
            <Route path="/admin" element={<AppLayout><AdminPanel /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
