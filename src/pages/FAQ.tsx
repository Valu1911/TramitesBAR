import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "¿Qué documentos necesito para tramitar mi licencia?",
    a: "Solo necesitás tu DNI vigente. Los formularios de salud se completan dentro de la app, eliminando la necesidad de certificados externos.",
  },
  {
    q: "¿Cuántas veces puedo rendir el examen teórico?",
    a: "El examen de demostración tiene un solo intento con 5 preguntas. El examen oficial se coordina por separado.",
  },
  {
    q: "¿Es obligatorio el examen práctico presencial?",
    a: "Sí, es el único paso que requiere presencia física en el Circuito Municipal de Baradero.",
  },
  {
    q: "¿Puedo recibir la licencia en mi domicilio?",
    a: "Sí, podés elegir envío a domicilio o retiro presencial en la Dirección de Tránsito.",
  },
  {
    q: "¿Cuánto tarda el trámite completo?",
    a: "Dependiendo de la disponibilidad de turnos para el práctico, el trámite puede completarse en 1 a 2 semanas.",
  },
  {
    q: "¿Qué pasa si no apruebo el examen teórico?",
    a: "En la versión de demostración tenés un solo intento. Para el trámite oficial, contactá a soporte técnico.",
  },
];

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground">Preguntas frecuentes</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 pb-8">
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="glass-card rounded-xl border px-4">
              <AccordionTrigger className="text-sm font-semibold text-foreground text-left py-4">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-4">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
};

export default FAQ;
