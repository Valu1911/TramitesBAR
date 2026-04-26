import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;
}

const questions: Question[] = [
  {
    id: 1,
    text: "¿Qué indica una luz amarilla de semáforo?",
    options: ["Acelerar para pasar", "Precaución, detenerse si es posible", "Vía libre", "Girar a la derecha"],
    correct: 1,
  },
  {
    id: 2,
    text: "¿Cuál es el límite de velocidad en zona urbana?",
    options: ["60 km/h", "40 km/h", "80 km/h", "30 km/h"],
    correct: 1,
  },
  {
    id: 3,
    text: "¿Qué documento es obligatorio llevar al conducir?",
    options: ["Partida de nacimiento", "Licencia de conducir vigente", "Título del auto", "Boleta de impuestos"],
    correct: 1,
  },
  {
    id: 4,
    text: "¿Qué significa una señal de PARE?",
    options: ["Disminuir velocidad", "Detenerse completamente", "Ceder el paso", "Estacionar"],
    correct: 1,
  },
  {
    id: 5,
    text: "¿Cuándo se debe usar el cinturón de seguridad?",
    options: ["Solo en ruta", "Solo el conductor", "Siempre todos los ocupantes", "Solo de noche"],
    correct: 2,
  },
];

const Examen = () => {
  const navigate = useNavigate();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const score = answers.filter((a, i) => a === questions[i].correct).length;
  const passed = score >= 4;
  const allAnswered = answers.every((a) => a !== null);

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-foreground">Resultado</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center gap-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${passed ? "bg-success/10" : "bg-destructive/10"}`}>
            {passed ? (
              <CheckCircle2 className="w-10 h-10 text-success" />
            ) : (
              <XCircle className="w-10 h-10 text-destructive" />
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {passed ? "¡Aprobaste!" : "No aprobaste"}
          </h2>
          <p className="text-muted-foreground text-center">
            Respondiste correctamente {score} de {questions.length} preguntas.
          </p>
          {!passed && (
            <div className="flex items-center gap-2 bg-warning/10 text-warning rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs">Este examen es de demostración. Solo tenés un intento.</span>
            </div>
          )}
          <Button className="w-full h-12 font-semibold mt-4" onClick={() => navigate("/dashboard")}>
            Volver al panel
          </Button>
        </main>
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Examen teórico</h1>
          <span className="ml-auto text-xs text-muted-foreground font-medium">
            {currentQ + 1}/{questions.length}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4 pb-8">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentQ
                  ? "bg-primary"
                  : answers[i] !== null
                  ? "bg-primary/40"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card className="glass-card">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">{q.text}</h2>
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                    answers[currentQ] === i
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface-elevated border-border hover:border-primary/30"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {currentQ > 0 && (
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => setCurrentQ(currentQ - 1)}
            >
              Anterior
            </Button>
          )}
          {currentQ < questions.length - 1 ? (
            <Button
              className="flex-1 h-11 font-semibold"
              onClick={() => setCurrentQ(currentQ + 1)}
              disabled={answers[currentQ] === null}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              className="flex-1 h-11 font-semibold"
              onClick={handleSubmit}
              disabled={!allAnswered}
            >
              Entregar examen
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-info/10 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-info flex-shrink-0" />
          <span className="text-xs text-info">
            Examen de demostración · 5 preguntas · 1 solo intento
          </span>
        </div>
      </main>
    </div>
  );
};

export default Examen;
