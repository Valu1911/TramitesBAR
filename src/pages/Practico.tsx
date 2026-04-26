import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, CheckCircle2 } from "lucide-react";

const turnos = [
  { id: "1", date: "Lunes 17/03 - 9:00 hs", location: "Circuito Municipal de Baradero" },
  { id: "2", date: "Miércoles 19/03 - 10:30 hs", location: "Circuito Municipal de Baradero" },
  { id: "3", date: "Viernes 21/03 - 14:00 hs", location: "Circuito Municipal de Baradero" },
];

const Practico = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    const turno = turnos.find((t) => t.id === selected);
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-foreground">Turno confirmado</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">¡Turno agendado!</h2>
          <p className="text-sm text-muted-foreground text-center">{turno?.date}</p>
          <p className="text-xs text-muted-foreground">{turno?.location}</p>
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
          <h1 className="font-bold text-foreground">Examen práctico</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4 pb-8">
        <p className="text-sm text-muted-foreground">
          Seleccioná un turno disponible para el examen práctico presencial.
        </p>

        {turnos.map((turno) => (
          <Card
            key={turno.id}
            className={`glass-card cursor-pointer transition-all ${
              selected === turno.id ? "border-primary shadow-md" : ""
            }`}
            onClick={() => setSelected(turno.id)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{turno.date}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{turno.location}</span>
                </div>
              </div>
              {selected === turno.id && (
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          className="w-full h-12 font-semibold"
          disabled={!selected}
          onClick={() => setConfirmed(true)}
        >
          Confirmar turno
        </Button>
      </main>
    </div>
  );
};

export default Practico;
