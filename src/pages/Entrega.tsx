import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Truck, Building2, CheckCircle2 } from "lucide-react";

const Entrega = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"domicilio" | "presencial" | null>(null);
  const [address, setAddress] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-foreground">Entrega confirmada</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">¡Solicitud registrada!</h2>
          <p className="text-sm text-muted-foreground text-center">
            {method === "domicilio"
              ? `Tu licencia será enviada a: ${address}`
              : "Retirá tu licencia en la Dirección de Tránsito de Baradero."}
          </p>
          <Button className="w-full h-12 font-semibold mt-4" onClick={() => navigate("/dashboard")}>
            Volver al panel
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Entrega de licencia</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4 pb-8">
        <p className="text-sm text-muted-foreground">
          Elegí cómo querés recibir tu licencia de conducir.
        </p>

        <Card
          className={`glass-card cursor-pointer transition-all ${method === "domicilio" ? "border-primary shadow-md" : ""}`}
          onClick={() => setMethod("domicilio")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Envío a domicilio</h3>
              <p className="text-xs text-muted-foreground">Recibí tu licencia en tu casa</p>
            </div>
            {method === "domicilio" && <CheckCircle2 className="w-5 h-5 text-primary" />}
          </CardContent>
        </Card>

        {method === "domicilio" && (
          <div className="space-y-1 pl-1">
            <label className="text-sm font-medium text-foreground">Dirección de envío</label>
            <Input
              placeholder="Ej: Av. San Martín 1234, Baradero"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-11 bg-surface-elevated"
            />
          </div>
        )}

        <Card
          className={`glass-card cursor-pointer transition-all ${method === "presencial" ? "border-primary shadow-md" : ""}`}
          onClick={() => setMethod("presencial")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Retiro presencial</h3>
              <p className="text-xs text-muted-foreground">Dirección de Tránsito, Baradero</p>
            </div>
            {method === "presencial" && <CheckCircle2 className="w-5 h-5 text-primary" />}
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 font-semibold"
          disabled={!method || (method === "domicilio" && !address.trim())}
          onClick={() => setConfirmed(true)}
        >
          Confirmar método de entrega
        </Button>
      </main>
    </div>
  );
};

export default Entrega;
