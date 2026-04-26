import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";

const Soporte = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-foreground">Soporte</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">¡Mensaje enviado!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Nuestro equipo te responderá a la brevedad.
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
          <h1 className="font-bold text-foreground">Soporte técnico</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4 pb-8">
        <p className="text-sm text-muted-foreground">
          ¿Tenés algún problema con tu trámite? Escribinos y te ayudamos.
        </p>

        <Card className="glass-card">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Asunto</label>
              <Input
                placeholder="Ej: Problema con el examen teórico"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11 bg-surface-elevated"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Mensaje</label>
              <Textarea
                placeholder="Describí tu problema o consulta..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px] bg-surface-elevated"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 font-semibold"
          disabled={!subject.trim() || !message.trim()}
          onClick={() => setSent(true)}
        >
          Enviar mensaje
          <Send className="w-4 h-4 ml-2" />
        </Button>
      </main>
    </div>
  );
};

export default Soporte;
