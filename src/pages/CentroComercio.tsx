import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Store, QrCode, CreditCard, Upload, Clock, CheckCircle2, Copy } from "lucide-react";

type PayMethod = null | "transfer" | "debit";
type PayStatus = "choose" | "paying" | "upload-receipt" | "waiting" | "confirmed";

const ALIAS_EJEMPLO = "MUNICIPIO.BARADERO.LICENCIAS";
const CBU_EJEMPLO = "0110012330001234567890";
const MONTO = "$12.500";

const CentroComercio = () => {
  const [method, setMethod] = useState<PayMethod>(null);
  const [status, setStatus] = useState<PayStatus>("choose");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [debitData, setDebitData] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleTransferPay = () => {
    setStatus("upload-receipt");
  };

  const handleReceiptUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setReceipt(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitReceipt = () => {
    setStatus("waiting");
  };

  const handleDebitPay = () => {
    setStatus("paying");
    setTimeout(() => {
      setStatus("confirmed");
    }, 3000);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" /> Centro de Comercio
        </h1>
        <p className="text-sm text-muted-foreground">Aboná el arancel de tu licencia de conducir</p>
      </div>

      {/* Monto */}
      <Card className="glass-card">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Monto a pagar</p>
          <p className="text-2xl font-bold text-foreground mt-1">{MONTO}</p>
          <p className="text-xs text-muted-foreground mt-1">Arancel licencia de conducir - Municipalidad de Baradero</p>
        </CardContent>
      </Card>

      {/* Choose method */}
      {status === "choose" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Elegí cómo pagar</h2>
          <Card
            className={`glass-card cursor-pointer transition-all hover:shadow-md ${method === "transfer" ? "border-primary/40 bg-primary-soft" : ""}`}
            onClick={() => setMethod("transfer")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center text-primary">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Transferencia bancaria</h3>
                <p className="text-xs text-muted-foreground">Pagá con alias, CBU o QR interoperable</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`glass-card cursor-pointer transition-all hover:shadow-md ${method === "debit" ? "border-primary/40 bg-primary-soft" : ""}`}
            onClick={() => setMethod("debit")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center text-primary">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Tarjeta de débito</h3>
                <p className="text-xs text-muted-foreground">Ingresá los datos de tu tarjeta</p>
              </div>
            </CardContent>
          </Card>

          {method === "transfer" && (
            <Card className="glass-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <span className="text-sm font-semibold text-foreground">Datos para transferir</span>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Alias</p>
                    <p className="text-sm font-mono font-semibold text-foreground">{ALIAS_EJEMPLO}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(ALIAS_EJEMPLO)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">CBU</p>
                    <p className="text-sm font-mono font-semibold text-foreground">{CBU_EJEMPLO}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(CBU_EJEMPLO)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                {/* QR placeholder */}
                <div className="flex justify-center">
                  <div className="w-40 h-40 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border">
                    <QrCode className="w-16 h-16 text-muted-foreground/40" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">Escaneá el QR desde tu app bancaria</p>

                <Button onClick={handleTransferPay} className="w-full h-11 font-semibold">
                  Ya transferí, continuar
                </Button>
              </CardContent>
            </Card>
          )}

          {method === "debit" && (
            <Card className="glass-card">
              <CardHeader className="pb-2 pt-4 px-4">
                <span className="text-sm font-semibold text-foreground">Datos de la tarjeta de débito</span>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <Input
                  placeholder="Número de tarjeta"
                  inputMode="numeric"
                  value={debitData.number}
                  onChange={(e) => setDebitData({ ...debitData, number: e.target.value })}
                  className="bg-surface-elevated"
                  maxLength={19}
                />
                <Input
                  placeholder="Nombre del titular"
                  value={debitData.name}
                  onChange={(e) => setDebitData({ ...debitData, name: e.target.value })}
                  className="bg-surface-elevated"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="MM/AA"
                    value={debitData.expiry}
                    onChange={(e) => setDebitData({ ...debitData, expiry: e.target.value })}
                    className="bg-surface-elevated"
                    maxLength={5}
                  />
                  <Input
                    placeholder="CVV"
                    type="password"
                    inputMode="numeric"
                    value={debitData.cvv}
                    onChange={(e) => setDebitData({ ...debitData, cvv: e.target.value })}
                    className="bg-surface-elevated"
                    maxLength={4}
                  />
                </div>
                <Button
                  onClick={handleDebitPay}
                  disabled={!debitData.number || !debitData.name || !debitData.expiry || !debitData.cvv}
                  className="w-full h-11 font-semibold"
                >
                  Pagar {MONTO}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Upload receipt */}
      {status === "upload-receipt" && (
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <span className="text-sm font-semibold text-foreground">Adjuntá el comprobante de pago</span>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <p className="text-xs text-muted-foreground">Subí una captura o foto del comprobante de transferencia para que el equipo administrativo pueda validarlo.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])} />
            {receipt ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={receipt} alt="Comprobante" className="w-full max-h-60 object-contain bg-muted" />
                <button onClick={() => { setReceipt(null); if (fileRef.current) fileRef.current.value = ""; }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-20 border-dashed" onClick={() => fileRef.current?.click()}>
                <Upload className="w-5 h-5 mr-2" /> Subir comprobante
              </Button>
            )}
            <Button onClick={handleSubmitReceipt} disabled={!receipt} className="w-full h-11 font-semibold">
              Enviar comprobante
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Waiting validation */}
      {status === "waiting" && (
        <Card className="glass-card">
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <h2 className="font-bold text-foreground">Pago en revisión</h2>
            <p className="text-sm text-muted-foreground text-center">Tu comprobante fue enviado. Un administrador lo validará a la brevedad.</p>
          </CardContent>
        </Card>
      )}

      {/* Paying with debit */}
      {status === "paying" && (
        <Card className="glass-card">
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <h2 className="font-bold text-foreground">Procesando pago...</h2>
            <p className="text-sm text-muted-foreground">No cierres esta pantalla</p>
          </CardContent>
        </Card>
      )}

      {/* Confirmed */}
      {status === "confirmed" && (
        <Card className="glass-card">
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="font-bold text-foreground">¡Pago confirmado!</h2>
            <p className="text-sm text-muted-foreground text-center">Tu pago fue procesado exitosamente. Podés continuar con el trámite.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CentroComercio;
