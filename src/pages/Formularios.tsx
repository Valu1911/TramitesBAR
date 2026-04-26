import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const Formularios = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    grupoSanguineo: "",
    usaLentes: "",
    enfermedadCronica: "",
    medicacion: "",
    contactoEmergencia: "",
    telefonoEmergencia: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const allFilled = Object.values(form).every((v) => v.trim() !== "");

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-foreground">Formularios</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">¡Formularios enviados!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Tus datos médicos fueron registrados correctamente.
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
          <h1 className="font-bold text-foreground">Formularios de salud</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-4 pb-8">
        <p className="text-sm text-muted-foreground">
          Completá estos formularios para reemplazar el certificado de salud presencial.
        </p>

        <Card className="glass-card">
          <CardContent className="p-5 space-y-4">
            {[
              { key: "grupoSanguineo", label: "Grupo sanguíneo", placeholder: "Ej: A+" },
              { key: "usaLentes", label: "¿Usa lentes?", placeholder: "Sí / No" },
              { key: "enfermedadCronica", label: "Enfermedad crónica", placeholder: "Ninguna o especificar" },
              { key: "medicacion", label: "Medicación actual", placeholder: "Ninguna o especificar" },
              { key: "contactoEmergencia", label: "Contacto de emergencia", placeholder: "Nombre completo" },
              { key: "telefonoEmergencia", label: "Teléfono de emergencia", placeholder: "Ej: 3329-123456" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium text-foreground">{label}</label>
                <Input
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="h-11 bg-surface-elevated"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 font-semibold"
          disabled={!allFilled}
          onClick={() => setSubmitted(true)}
        >
          Enviar formularios
        </Button>
      </main>
    </div>
  );
};

export default Formularios;
