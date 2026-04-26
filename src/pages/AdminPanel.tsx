import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, CreditCard, FileText, Eye } from "lucide-react";

interface PendingItem {
  id: string;
  dni: string;
  name: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  type: "payment" | "health";
  detail?: string;
}

const initialPayments: PendingItem[] = [
  { id: "p1", dni: "35.123.456", name: "Juan Pérez", date: "2026-03-10", status: "pending", type: "payment", detail: "Transferencia bancaria - comprobante adjunto" },
  { id: "p2", dni: "40.555.321", name: "María López", date: "2026-03-11", status: "pending", type: "payment", detail: "Transferencia bancaria - comprobante adjunto" },
  { id: "p3", dni: "28.900.112", name: "Carlos Gómez", date: "2026-03-09", status: "approved", type: "payment", detail: "Tarjeta de débito - pago automático" },
];

const initialHealth: PendingItem[] = [
  { id: "h1", dni: "35.123.456", name: "Juan Pérez", date: "2026-03-10", status: "pending", type: "health", detail: "Certificado de aptitud psicofísica adjunto" },
  { id: "h2", dni: "42.100.200", name: "Ana Rodríguez", date: "2026-03-11", status: "pending", type: "health", detail: "Certificado oftalmológico adjunto" },
  { id: "h3", dni: "30.222.111", name: "Pedro Martínez", date: "2026-03-08", status: "rejected", type: "health", detail: "Certificado ilegible" },
];

const AdminPanel = () => {
  const [payments, setPayments] = useState(initialPayments);
  const [health, setHealth] = useState(initialHealth);

  const updateStatus = (type: "payment" | "health", id: string, newStatus: "approved" | "rejected") => {
    if (type === "payment") {
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    } else {
      setHealth((prev) => prev.map((h) => (h.id === id ? { ...h, status: newStatus } : h)));
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case "approved": return <Badge variant="outline" className="text-success border-success/30 bg-success/10"><CheckCircle2 className="w-3 h-3 mr-1" />Aprobado</Badge>;
      case "rejected": return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10"><XCircle className="w-3 h-3 mr-1" />Rechazado</Badge>;
      default: return null;
    }
  };

  const renderList = (items: PendingItem[], type: "payment" | "health") => (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No hay elementos</p>}
      {items.map((item) => (
        <Card key={item.id} className="glass-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">DNI: {item.dni} · {item.date}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
              </div>
              {statusBadge(item.status)}
            </div>
            {item.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => updateStatus(type, item.id, "approved")}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive hover:bg-destructive/10" onClick={() => updateStatus(type, item.id, "rejected")}>
                  <XCircle className="w-4 h-4 mr-1" /> Rechazar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const pendingPayments = payments.filter((p) => p.status === "pending").length;
  const pendingHealth = health.filter((h) => h.status === "pending").length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Panel de administración</h1>
        <p className="text-sm text-muted-foreground">Gestioná pagos y certificados de salud de los vecinos</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <CreditCard className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{pendingPayments}</p>
            <p className="text-xs text-muted-foreground">Pagos pendientes</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <FileText className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{pendingHealth}</p>
            <p className="text-xs text-muted-foreground">Certificados pendientes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments">
        <TabsList className="w-full">
          <TabsTrigger value="payments" className="flex-1">Pagos ({payments.length})</TabsTrigger>
          <TabsTrigger value="health" className="flex-1">Salud ({health.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="mt-4">
          {renderList(payments, "payment")}
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          {renderList(health, "health")}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
