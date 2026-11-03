/**
 * Asistente Bari: guía visual contextual por trámite y chat restringido sin PII.
 *
 * El componente muestra un recordatorio explícito para que la persona usuaria
 * nunca ingrese DNI, correo, teléfono ni información médica en la consulta.
 */

import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { BariChatResponse, BariGuide } from "@/lib/types";
import { ChatIcon, CloseIcon, ShieldIcon, WarningIcon } from "@/components/Icons";

interface ChatTurn {
  id: number;
  sender: "user" | "bari";
  text: string;
  links?: Array<{ label?: string; href?: string; url?: string }>;
  suggestions?: string[];
}

const STEP_VIDEO_MAP: Record<string, string> = {
  charlas: "/bari/lipsting.webm",
  health: "/bari/der.webm",
  theory: "/bari/izquierda.webm",
  payment: "/bari/deslizar.webm",
  practical: "/bari/salu2.webm",
  delivery: "/bari/salu2.webm",
};

const STEP_GUIDANCE_COPY: Record<string, string> = {
  charlas:
    "Mirá el material audiovisual completo de seguridad vial y confirmá su lectura para habilitar la etapa de salud.",
  health:
    "Cargá primero el certificado de aptitud psicofísica en PDF o imagen y luego enviá la declaración jurada.",
  theory:
    "El examen teórico selecciona preguntas aleatorias del banco oficial y se corrige íntegramente en el servidor.",
  payment:
    "Transferí el monto exacto con la referencia PAGO- de tu expediente y adjuntá el comprobante bancario.",
  practical:
    "Seleccioná uno de los cupos disponibles para rendir la prueba práctica con el equipo examinador municipal.",
  delivery:
    "Elegí si retirás la credencial en la oficina de licencias o si solicitás el envío a tu domicilio declarado.",
};

export interface BariStepGuideProps {
  procedureCode: string;
  currentStepCode?: string | null;
}

/** Guía contextual de Bari dentro del expediente del ciudadano. */
export function BariStepGuide({
  procedureCode,
  currentStepCode,
}: BariStepGuideProps) {
  const guideQuery = useQuery({
    queryKey: ["bari", "guide", procedureCode],
    queryFn: () => api.get<BariGuide>(`/bari/guide/${procedureCode}`),
    enabled: Boolean(procedureCode),
    staleTime: 60_000,
  });

  const videoSrc =
    (currentStepCode && STEP_VIDEO_MAP[currentStepCode]) || "/bari/salu2.webm";
  const stepAdvice =
    (currentStepCode && STEP_GUIDANCE_COPY[currentStepCode]) ||
    "Seguí el orden secuencial de las etapas indicadas en tu expediente.";

  return (
    <aside className="bari-guide-box" aria-label="Orientación de Bari">
      <div className="bari-avatar-wrap">
        <img
          src="/bari/bari.png"
          alt="Bari, asistente municipal de licencias"
          className="bari-avatar"
        />
        <div>
          <span className="page-eyebrow">Guía paso a paso</span>
          <h3 className="card-title">Orientación de Bari</h3>
        </div>
      </div>

      <video
        key={videoSrc}
        className="bari-video-preview"
        src={videoSrc}
        poster="/bari/bari.png"
        autoPlay
        muted
        loop
        playsInline
      />

      <p>{stepAdvice}</p>

      {guideQuery.data && (
        <div className="top-gap-sm">
          <span className="kv-label">
            Circuito oficial · {guideQuery.data.procedure_name}
          </span>
          <p className="muted-text top-gap-sm">
            Consta de {guideQuery.data.steps.length} etapas verificables y{" "}
            {guideQuery.data.materials.length} módulos de seguridad vial.
          </p>
        </div>
      )}
    </aside>
  );
}

/** Ventana flotante de consultas generales a Bari. */
export function BariFloatingWidget({ context }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 1,
      sender: "bari",
      text: "Hola, soy Bari. Puedo orientarte sobre requisitos, etapas del trámite, aranceles y verificación de credenciales.",
      suggestions: [
        "¿Qué necesito para una licencia nueva?",
        "¿Cómo se realiza el pago?",
        "¿Cómo funciona el examen teórico?",
      ],
    },
  ]);

  function handleToggleOpen() {
    setOpen((prev) => !prev);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setInput(event.target.value);
  }

  async function submitQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (trimmed.length < 2 || sending) return;

    setErrorMsg(null);
    setSending(true);
    const userTurnId = Date.now();
    setTurns((prev) => [
      ...prev,
      { id: userTurnId, sender: "user", text: trimmed },
    ]);
    setInput("");

    try {
      const response = await api.post<BariChatResponse>("/bari/chat", {
        message: trimmed,
        context: context ?? null,
      });
      setTurns((prev) => [
        ...prev,
        {
          id: userTurnId + 1,
          sender: "bari",
          text: response.answer,
          links: response.links,
          suggestions: response.suggestions,
        },
      ]);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "No pudimos procesar la consulta en este momento.";
      setErrorMsg(msg);
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
  }

  function handleSuggestionClick(event: MouseEvent<HTMLButtonElement>) {
    const suggestion = event.currentTarget.dataset.suggestion;
    if (suggestion) {
      void submitQuestion(suggestion);
    }
  }

  return (
    <div className="bari-floating-dock">
      {open && (
        <section
          className="bari-drawer"
          aria-label="Asistente de consultas Bari"
        >
          <header className="bari-drawer-header">
            <div className="civic-ribbon-tag">
              <ShieldIcon size={18} />
              <span>Asistente Bari · Orientación general</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleToggleOpen}
              aria-label="Cerrar asistente Bari"
            >
              <CloseIcon size={16} />
            </button>
          </header>

          <div className="bari-pii-warning" role="note">
            <WarningIcon size={15} /> No ingreses tu DNI, correo electrónico,
            teléfono ni datos de salud en este chat.
          </div>

          <div className="bari-messages">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={
                  turn.sender === "user"
                    ? "bari-bubble bari-bubble-user"
                    : "bari-bubble bari-bubble-bot"
                }
              >
                <p>{turn.text}</p>
                {turn.links && turn.links.length > 0 && (
                  <div className="btn-row top-gap-sm">
                    {turn.links.map((lnk, idx) => {
                      const target = lnk.href ?? lnk.url ?? "/";
                      return (
                        <Link
                          key={`${turn.id}-lnk-${idx}`}
                          to={target}
                          className="badge badge-info"
                        >
                          {lnk.label ?? target}
                        </Link>
                      );
                    })}
                  </div>
                )}
                {turn.suggestions && turn.suggestions.length > 0 && (
                  <div className="bari-suggestions">
                    {turn.suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className="bari-chip"
                        data-suggestion={sug}
                        onClick={handleSuggestionClick}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {errorMsg && (
              <div className="alert alert-danger" role="alert">
                <div className="alert-content">{errorMsg}</div>
              </div>
            )}
          </div>

          <form className="bari-drawer-form" onSubmit={handleFormSubmit}>
            <input
              type="text"
              className="form-input"
              placeholder="Escribí tu consulta sin datos personales..."
              value={input}
              onChange={handleInputChange}
              maxLength={400}
              aria-label="Consulta para Bari"
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={sending || input.trim().length < 2}
            >
              {sending ? "Enviando..." : "Consultar"}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="bari-fab"
        onClick={handleToggleOpen}
        aria-expanded={open}
      >
        <img
          src="/bari/bari.png"
          alt=""
          className="bari-fab-img"
          aria-hidden="true"
        />
        <ChatIcon size={16} />
        <span>{open ? "Ocultar Bari" : "Consultar a Bari"}</span>
      </button>
    </div>
  );
}
