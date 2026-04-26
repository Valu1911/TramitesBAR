import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Camera, Shield, ArrowRight, User, Upload, CreditCard, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/muni-logo.png";

type Step = "dni" | "admin-pass" | "dni-scan" | "face" | "success";

const ADMIN_DNI = "99999999";

const Login = () => {
  const [step, setStep] = useState<Step>("dni");
  const [dni, setDni] = useState("");
  const [dniError, setDniError] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminPassError, setAdminPassError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [dniFront, setDniFront] = useState<string | null>(null);
  const [dniBack, setDniBack] = useState<string | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const isAdminDni = dni.replace(/\D/g, "") === ADMIN_DNI;

  const handleDniSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = dni.replace(/\D/g, "");
    if (cleaned.length < 7 || cleaned.length > 8) {
      setDniError("Ingresá un DNI válido (7 u 8 dígitos)");
      return;
    }
    setDniError("");
    if (cleaned === ADMIN_DNI) {
      setStep("admin-pass");
    } else {
      setStep("dni-scan");
    }
  };

  const handleAdminPassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass !== "ADMIN123") {
      setAdminPassError("Contraseña incorrecta");
      return;
    }
    setAdminPassError("");
    login({ dni: dni.replace(/\D/g, ""), role: "admin" });
    setStep("success");
    setTimeout(() => navigate("/admin"), 1200);
  };

  const handleFileUpload = (file: File, side: "front" | "back") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === "front") setDniFront(e.target?.result as string);
      else setDniBack(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDniScanContinue = () => {
    if (!dniFront || !dniBack) return;
    setStep("face");
  };

  const handleFaceVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      login({ dni: dni.replace(/\D/g, ""), role: "user", dniFrontImage: dniFront || undefined, dniBackImage: dniBack || undefined });
      setStep("success");
      setTimeout(() => navigate("/dashboard"), 1200);
    }, 2000);
  };

  return (
    <div className="min-h-screen gradient-soft flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-2">
          <img src={logo} alt="Muni Digital" className="w-20 h-20" width={80} height={80} />
          <h1 className="text-2xl font-extrabold text-primary tracking-tight">Muni Digital</h1>
          <p className="text-sm text-muted-foreground text-center">Trámites simples para tu ciudad · Portal del vecino</p>
        </div>

        {/* DNI Step */}
        {step === "dni" && (
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">Verificación de identidad</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleDniSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Documento Nacional de Identidad</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 35.123.456"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="h-12 text-base bg-surface-elevated"
                    maxLength={10}
                  />
                  {dniError && <p className="text-xs text-destructive">{dniError}</p>}
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold">
                  Continuar <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Admin Password Step */}
        {step === "admin-pass" && (
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center gap-2 text-primary">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-semibold">Acceso administrador</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <form onSubmit={handleAdminPassSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Contraseña de administrador</label>
                  <Input
                    type="password"
                    placeholder="Ingresá la contraseña"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    className="h-12 text-base bg-surface-elevated"
                  />
                  {adminPassError && <p className="text-xs text-destructive">{adminPassError}</p>}
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold">
                  Ingresar como admin <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <button onClick={() => setStep("dni")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                  ← Volver
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* DNI Scan Step */}
        {step === "dni-scan" && (
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center gap-2 text-primary">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-semibold">Escaneo de DNI</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <p className="text-xs text-muted-foreground">Adjuntá una foto del frente y dorso de tu DNI, o escanealo con la cámara.</p>

              {/* Front */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Frente del DNI</label>
                <input ref={frontRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "front")} />
                {dniFront ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={dniFront} alt="Frente DNI" className="w-full h-32 object-cover" />
                    <button onClick={() => { setDniFront(null); if (frontRef.current) frontRef.current.value = ""; }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => frontRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" /> Subir archivo
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { if (frontRef.current) { frontRef.current.setAttribute("capture", "environment"); frontRef.current.click(); } }}>
                      <Camera className="w-4 h-4 mr-1" /> Cámara
                    </Button>
                  </div>
                )}
              </div>

              {/* Back */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Dorso del DNI</label>
                <input ref={backRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "back")} />
                {dniBack ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={dniBack} alt="Dorso DNI" className="w-full h-32 object-cover" />
                    <button onClick={() => { setDniBack(null); if (backRef.current) backRef.current.value = ""; }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => backRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" /> Subir archivo
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { if (backRef.current) { backRef.current.setAttribute("capture", "environment"); backRef.current.click(); } }}>
                      <Camera className="w-4 h-4 mr-1" /> Cámara
                    </Button>
                  </div>
                )}
              </div>

              <Button onClick={handleDniScanContinue} disabled={!dniFront || !dniBack} className="w-full h-12 text-base font-semibold">
                Continuar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <button onClick={() => setStep("dni")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">← Volver</button>
            </CardContent>
          </Card>
        )}

        {/* Face Verification */}
        {step === "face" && (
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center gap-2 text-primary">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-semibold">Verificación facial</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="aspect-square max-w-[200px] mx-auto rounded-full border-4 border-primary/20 bg-primary-soft flex items-center justify-center">
                {isVerifying ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-primary font-medium">Verificando...</span>
                  </div>
                ) : (
                  <User className="w-16 h-16 text-primary/40" />
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">Ubicá tu rostro dentro del círculo y asegurate de tener buena iluminación</p>
              <Button onClick={handleFaceVerify} disabled={isVerifying} className="w-full h-12 text-base font-semibold">
                {isVerifying ? "Verificando..." : "Iniciar verificación"} <Camera className="w-4 h-4 ml-2" />
              </Button>
              <button onClick={() => setStep("dni-scan")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">← Volver</button>
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {step === "success" && (
          <Card className="glass-card">
            <CardContent className="py-8 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-success" />
              </div>
              <h2 className="font-bold text-foreground">¡Identidad verificada!</h2>
              <p className="text-sm text-muted-foreground">Redirigiendo{isAdminDni ? " al panel admin" : " al panel"}...</p>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">Muni Digital · Municipalidad de Baradero</p>
      </div>
    </div>
  );
};

export default Login;
