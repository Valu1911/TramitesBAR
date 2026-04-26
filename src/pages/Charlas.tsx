import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, CheckCircle2, Clock } from "lucide-react";

interface VideoCharla {
  id: string;
  title: string;
  duration: string;
  watched: boolean;
}

const videos: VideoCharla[] = [
  { id: "1", title: "Señales de tránsito y su importancia", duration: "12 min", watched: true },
  { id: "2", title: "Conducción responsable y alcohol cero", duration: "10 min", watched: true },
  { id: "3", title: "Primeros auxilios en accidentes viales", duration: "15 min", watched: false },
  { id: "4", title: "Normativa vigente en la Provincia de Buenos Aires", duration: "8 min", watched: false },
];

const Charlas = () => {
  const navigate = useNavigate();
  const [charlas, setCharlas] = useState(videos);

  const handleWatch = (id: string) => {
    setCharlas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, watched: true } : c))
    );
  };

  const allWatched = charlas.every((c) => c.watched);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Charlas en video</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4 pb-8">
        <p className="text-sm text-muted-foreground">
          Mirá todas las charlas obligatorias sobre seguridad vial para avanzar al siguiente paso.
        </p>

        {charlas.map((charla) => (
          <Card key={charla.id} className={`glass-card ${charla.watched ? "border-success/20" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                {charla.watched ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Play className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{charla.title}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{charla.duration}</span>
                </div>
              </div>
              {!charla.watched && (
                <Button size="sm" variant="outline" onClick={() => handleWatch(charla.id)}>
                  Ver
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {allWatched && (
          <Button className="w-full h-12 font-semibold" onClick={() => navigate("/examen")}>
            Continuar al examen teórico
          </Button>
        )}
      </main>
    </div>
  );
};

export default Charlas;
