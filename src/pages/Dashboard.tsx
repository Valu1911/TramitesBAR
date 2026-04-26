import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Video, FileText, ClipboardCheck, Car, Truck, Store,
  ChevronRight, CheckCircle2, Clock, Lock, Sparkles, ArrowRight,
} from "lucide-react";
import heroImg from "@/assets/hero-licencia.jpg";
import licenciaIcon from "@/assets/tramite-licencia.png";

interface LicenseStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "completed" | "current" | "locked";
  route: string;
}

const steps: LicenseStep[] = [
  { id: "charlas", title: "Charlas en video", description: "Capacitación obligatoria sobre seguridad vial", icon: <Video className="w-5 h-5" />, status: "completed", route: "/charlas" },
  { id: "examen", title: "Examen teórico", description: "5 preguntas, un solo intento", icon: <ClipboardCheck className="w-5 h-5" />, status: "current", route: "/examen" },
  { id: "formularios", title: "Formularios de salud", description: "Certificados y datos médicos", icon: <FileText className="w-5 h-5" />, status: "locked", route: "/formularios" },
  { id: "centro-comercio", title: "Centro de Comercio", description: "Pago del arancel de licencia", icon: <Store className="w-5 h-5" />, status: "locked", route: "/centro-comercio" },
  { id: "practico", title: "Examen práctico", description: "Presencial · Agendar turno", icon: <Car className="w-5 h-5" />, status: "locked", route: "/practico" },
  { id: "entrega", title: "Entrega de licencia", description: "Domicilio o retiro presencial", icon: <Truck className="w-5 h-5" />, status: "locked", route: "/entrega" },
];

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredSteps = steps.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progress = (completedCount / steps.length) * 100;
  const currentStep = steps.find((s) => s.status === "current") ?? steps[0];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "current": return <Clock className="w-5 h-5 text-accent" />;
      default: return <Lock className="w-4 h-4 text-muted-foreground/50" />;
    }
  };

  const getCardStyle = (status: string) => {
    switch (status) {
      case "completed": return "border-success/30 bg-success/5";
      case "current": return "border-accent/40 bg-accent/5 shadow-soft ring-1 ring-accent/20";
      default: return "opacity-60";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-5 md:pt-8 space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl gradient-soft border border-border shadow-soft">
        <div className="grid md:grid-cols-2 gap-4 items-center">
          <div className="p-5 md:p-8 space-y-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent bg-accent-soft px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> Hacelo en 3 clicks
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold text-foreground leading-tight">
              Tu licencia de conducir,{" "}
              <span className="text-primary">sin filas</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-md">
              Iniciá tu trámite ahora mismo. Te acompañamos paso a paso desde la app.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                size="lg"
                onClick={() => navigate(currentStep.route)}
                className="h-12 px-6 text-base font-semibold gradient-primary text-primary-foreground shadow-soft hover:opacity-95"
              >
                Continuar trámite <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/faq")}
                className="h-12 px-6 text-base"
              >
                ¿Cómo funciona?
              </Button>
            </div>
          </div>
          <div className="hidden md:flex justify-end p-4">
            <img
              src={heroImg}
              alt="Vecino con su licencia de conducir digital"
              className="w-full max-w-sm rounded-2xl object-cover"
              width={1024}
              height={640}
            />
          </div>
        </div>
      </section>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar trámite o paso (ej: examen, salud, pago...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 bg-card border-border rounded-2xl shadow-soft"
        />
      </div>

      {/* Progreso */}
      <Card className="border-border shadow-soft rounded-2xl">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center">
                <img src={licenciaIcon} alt="" className="w-6 h-6" width={24} height={24} loading="lazy" />
              </div>
              <div>
                <span className="block text-sm font-bold text-foreground">Tu progreso</span>
                <span className="block text-[11px] text-muted-foreground">{completedCount} de {steps.length} pasos completados</span>
              </div>
            </div>
            <span className="text-lg font-extrabold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Acceso rápido (3 clicks) */}
      <section>
        <h2 className="text-sm md:text-base font-bold text-foreground mb-3">Acceso rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction icon={<Video className="w-5 h-5" />} label="Charlas" tone="primary" onClick={() => navigate("/charlas")} />
          <QuickAction icon={<ClipboardCheck className="w-5 h-5" />} label="Examen" tone="accent" onClick={() => navigate("/examen")} />
          <QuickAction icon={<Store className="w-5 h-5" />} label="Pagar" tone="primary" onClick={() => navigate("/centro-comercio")} />
          <QuickAction icon={<Car className="w-5 h-5" />} label="Práctico" tone="accent" onClick={() => navigate("/practico")} />
        </div>
      </section>

      {/* Pasos */}
      <section className="space-y-3">
        <h2 className="text-sm md:text-base font-bold text-foreground">Pasos del trámite</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {filteredSteps.map((step, index) => (
            <Card
              key={step.id}
              className={`cursor-pointer rounded-2xl transition-all hover:shadow-soft ${getCardStyle(step.status)}`}
              onClick={() => step.status !== "locked" && navigate(step.route)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-soft flex items-center justify-center text-primary">{step.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Paso {index + 1}</span>
                  <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{step.description}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  {getStatusIcon(step.status)}
                  {step.status !== "locked" && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

function QuickAction({
  icon, label, tone, onClick,
}: { icon: React.ReactNode; label: string; tone: "primary" | "accent"; onClick: () => void }) {
  const toneClasses =
    tone === "primary"
      ? "bg-primary-soft text-primary"
      : "bg-accent-soft text-accent";
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-2 hover:shadow-soft hover:-translate-y-0.5 transition-all"
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${toneClasses}`}>{icon}</span>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </button>
  );
}

export default Dashboard;
