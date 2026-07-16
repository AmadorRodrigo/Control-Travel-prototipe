import { useEffect, useState } from "react";
import { getMySeats } from "../services/api";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_LABELS = { planejada: "Planejada", confirmada: "Confirmada", embarque: "Embarque", concluida: "Concluída", cancelada: "Cancelada" };
const STATUS_TAG = { planejada: "tag-neutral", confirmada: "tag-outline", embarque: "tag-accent", concluida: "tag-neutral", cancelada: "tag-neutral" };
const STEP_ORDER = ["planejada", "confirmada", "embarque", "concluida"];

function MySeatsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getMySeats()
      .then(setData)
      .catch((e) => setErrorMessage(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const upcoming = data?.assentos?.find((a) => ["planejada", "confirmada", "embarque"].includes(a.viagem.status));
  const history = data?.assentos?.filter((a) => !["planejada", "confirmada", "embarque"].includes(a.viagem.status)) || [];

  function tripSteps(status) {
    const idx = STEP_ORDER.indexOf(status);
    return STEP_ORDER.map((_, i) => ({
      color: i < idx ? "var(--color-accent)" : i === idx ? "var(--color-accent-300)" : "var(--color-neutral-300)",
      label: STATUS_LABELS[STEP_ORDER[i]],
      textColor: i <= idx ? "var(--color-accent)" : "var(--color-neutral-500)",
    }));
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <main style={{ flex: 1, padding: "32px 40px 64px", maxWidth: 800, width: "100%", margin: "0 auto", display: "grid", gap: 32 }} className="page-fade">

        <header>
          <p style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent-700)", margin: "0 0 6px", fontWeight: 600 }}>Minha poltrona</p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: 0 }}>
            Olá, {data?.passageiro?.nome?.split(" ")[0] || user?.username}
          </h1>
          <p style={{ fontSize: 13, opacity: .6, margin: "6px 0 0" }}>Suas viagens, poltrona e andar alocados pelo administrador.</p>
        </header>

        {errorMessage ? (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
            {errorMessage === "Nenhum cadastro de passageiro vinculado a este usuário."
              ? "Você ainda não foi vinculado a nenhum passageiro. Aguarde o administrador configurar seu acesso."
              : errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <p style={{ fontSize: 13, opacity: .6 }}>Carregando suas informações...</p>
        ) : null}

        {/* Boarding pass */}
        {upcoming ? (
          <>
            <div style={{ border: "1px solid var(--color-text)", background: "var(--color-text)", color: "var(--color-bg)", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto" }}>
                <div style={{ padding: "28px 28px 20px", display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", opacity: .55 }}>Cartão de embarque</span>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 22 }}>{upcoming.viagem.titulo}</h2>
                  <p style={{ margin: 0, fontSize: 13, opacity: .7 }}>{upcoming.viagem.origem} → {upcoming.viagem.destino}</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, opacity: .55 }}>Partida · {fmtDate(upcoming.viagem.data_partida)}</p>
                </div>
                <div style={{ padding: 28, borderLeft: "1px dashed rgba(255,255,255,.25)", display: "grid", placeItems: "center", gap: 4, textAlign: "center", minWidth: 130 }}>
                  <span style={{ fontSize: 11, opacity: .55, textTransform: "uppercase", letterSpacing: ".1em" }}>Poltrona</span>
                  <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{upcoming.numero}</span>
                  <span className="tag tag-accent">{upcoming.andar === "inferior" ? "Inferior" : "Superior"}</span>
                </div>
              </div>
              <div style={{ borderTop: "1px dashed rgba(255,255,255,.25)", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={`tag ${STATUS_TAG[upcoming.viagem.status] || "tag-neutral"}`}>{STATUS_LABELS[upcoming.viagem.status] || upcoming.viagem.status}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {tripSteps(upcoming.viagem.status).map((s, i) => (
                <div key={i} style={{ flex: 1, display: "grid", gap: 6 }}>
                  <div style={{ height: 3, background: s.color }} />
                  <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: s.textColor }}>{s.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : data && !isLoading ? (
          <div style={{ border: "1px dashed var(--color-divider)", padding: 32, textAlign: "center", fontSize: 14, opacity: .6 }}>
            Nenhuma poltrona ativa no momento. Aguarde o administrador alocar sua próxima viagem.
          </div>
        ) : null}

        {/* Personal data */}
        {data?.passageiro ? (
          <div className="card elev-sm" style={{ display: "grid", gap: 12 }}>
            <div className="card-kicker">Seus dados</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
              <p style={{ margin: 0 }}><strong>Documento:</strong> {data.passageiro.documento}</p>
              <p style={{ margin: 0 }}><strong>Nascimento:</strong> {data.passageiro.data_nascimento}</p>
              <p style={{ margin: 0 }}><strong>Telefone:</strong> {data.passageiro.telefone}</p>
              <p style={{ margin: 0, gridColumn: "1 / -1" }}><strong>Emergência:</strong> {data.passageiro.contato_emergencia}</p>
            </div>
          </div>
        ) : null}

        {/* History */}
        {history.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="card-kicker">Histórico</div>
            {history.map((a) => (
              <div key={a.id} style={{ border: "1px solid var(--color-divider)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{a.viagem.titulo}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, opacity: .6 }}>{a.viagem.origem} → {a.viagem.destino} · {fmtDate(a.viagem.data_partida)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ display: "block", fontSize: 20, fontWeight: 700 }}>{a.numero}</span>
                  <span className={`tag ${STATUS_TAG[a.viagem.status] || "tag-neutral"}`}>{STATUS_LABELS[a.viagem.status] || a.viagem.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default MySeatsPage;
