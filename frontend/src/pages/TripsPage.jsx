import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import { createTrip, getPassengers, getTripSeats, getTrips, releaseSeat, reserveSeat } from "../services/api";

const STATUS_LABELS = { planejada: "Planejada", confirmada: "Confirmada", embarque: "Embarque", concluida: "Concluída", cancelada: "Cancelada" };
const STATUS_TAG = { planejada: "tag-neutral", confirmada: "tag-outline", embarque: "tag-accent", concluida: "tag-neutral", cancelada: "tag-outline" };
const STEP_ORDER = ["planejada", "confirmada", "embarque", "concluida"];
const STEP_COLORS = { done: "var(--color-accent)", active: "var(--color-accent-300)", pending: "var(--color-neutral-300)" };

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const initialTripForm = { titulo: "", origem: "", destino: "", data_partida: "", status: "planejada", capacidade_andar_inferior: 20, capacidade_andar_superior: 16 };

function buildSeatRows(seatList) {
  const cols = 4;
  const rows = [];
  for (let i = 0; i < seatList.length; i += cols) {
    rows.push(seatList.slice(i, i + cols));
  }
  return rows;
}

function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [seats, setSeats] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showNewTripDialog, setShowNewTripDialog] = useState(false);
  const [tripForm, setTripForm] = useState(initialTripForm);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);

  const [activeSeat, setActiveSeat] = useState(null);
  const [reservationPassengerId, setReservationPassengerId] = useState("");
  const [isReservingSeat, setIsReservingSeat] = useState(false);

  const [releaseSeatData, setReleaseSeatData] = useState(null);

  useEffect(() => {
    async function boot() {
      setIsLoadingTrips(true);
      try {
        const [tripsRes, passengersRes] = await Promise.all([
          getTrips({ page: 1, page_size: 50 }),
          getPassengers({ page: 1, page_size: 100 }),
        ]);
        setTrips(tripsRes.items);
        setPassengers(passengersRes.items);
        if (tripsRes.items.length > 0) setSelectedTripId(tripsRes.items[0].id);
      } catch (e) {
        setErrorMessage(e.message);
      } finally {
        setIsLoadingTrips(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (!selectedTripId) { setSeats([]); return; }
    setIsLoadingSeats(true);
    getTripSeats(selectedTripId)
      .then(setSeats)
      .catch((e) => setErrorMessage(e.message))
      .finally(() => setIsLoadingSeats(false));
  }, [selectedTripId]);

  const selectedTrip = useMemo(() => trips.find((t) => t.id === selectedTripId) || null, [trips, selectedTripId]);
  const lowerSeats = useMemo(() => seats.filter((s) => s.andar === "inferior"), [seats]);
  const upperSeats = useMemo(() => seats.filter((s) => s.andar === "superior"), [seats]);

  const filteredTrips = useMemo(() => trips.filter((t) => {
    const q = search.toLowerCase();
    const matchText = !q || t.titulo.toLowerCase().includes(q) || t.origem.toLowerCase().includes(q) || t.destino.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchText && matchStatus;
  }), [trips, search, statusFilter]);

  const statusFilters = [
    { key: "all", label: "Todas" },
    { key: "planejada", label: "Planejadas" },
    { key: "confirmada", label: "Confirmadas" },
    { key: "embarque", label: "Embarque" },
    { key: "concluida", label: "Concluídas" },
  ];

  async function refreshTrips(selectId) {
    const data = await getTrips({ page: 1, page_size: 50 });
    setTrips(data.items);
    if (selectId) setSelectedTripId(selectId);
  }

  async function refreshSeats() {
    if (!selectedTripId) return;
    const data = await getTripSeats(selectedTripId);
    setSeats(data);
  }

  function handleTripFormChange(e) {
    const { name, value } = e.target;
    setTripForm((c) => ({ ...c, [name]: value }));
  }

  async function handleCreateTrip(e) {
    e.preventDefault();
    if (isCreatingTrip) return;
    setIsCreatingTrip(true);
    setErrorMessage("");
    try {
      const created = await createTrip({
        ...tripForm,
        data_partida: new Date(tripForm.data_partida).toISOString(),
        capacidade_andar_inferior: Number(tripForm.capacidade_andar_inferior),
        capacidade_andar_superior: Number(tripForm.capacidade_andar_superior),
      });
      setTripForm(initialTripForm);
      setShowNewTripDialog(false);
      await refreshTrips(created.id);
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsCreatingTrip(false);
    }
  }

  function handleSeatClick(seat) {
    if (seat.ocupado) {
      setReleaseSeatData(seat);
    } else {
      setActiveSeat(seat);
      setReservationPassengerId("");
    }
  }

  async function handleReserveSeat(e) {
    e.preventDefault();
    if (isReservingSeat || !selectedTripId || !activeSeat) return;
    setIsReservingSeat(true);
    setErrorMessage("");
    try {
      await reserveSeat(selectedTripId, {
        passageiro_id: Number(reservationPassengerId),
        numero: activeSeat.numero,
        andar: activeSeat.andar,
      });
      setActiveSeat(null);
      await refreshSeats();
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsReservingSeat(false);
    }
  }

  async function handleReleaseSeat() {
    if (!releaseSeatData || !selectedTripId) return;
    try {
      setErrorMessage("");
      await releaseSeat(selectedTripId, releaseSeatData.id);
      setReleaseSeatData(null);
      await refreshSeats();
    } catch (e) {
      setErrorMessage(e.message);
    }
  }

  function renderSeatGrid(seatList, label) {
    const occupied = seatList.filter((s) => s.ocupado).length;
    const rows = buildSeatRows(seatList);
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", opacity: .55 }}>
          <span>{label}</span>
          <span>{occupied}/{seatList.length} ocupados</span>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 20, fontSize: 11, opacity: .4, textAlign: "right" }}>{ri * 4 + 1}</span>
              {row.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  title={seat.ocupado ? `Reservado: ${seat.passageiro_nome || ""}` : `Poltrona ${seat.numero}`}
                  onClick={() => handleSeatClick(seat)}
                  style={{
                    width: 52, height: 44,
                    border: `1px solid ${seat.ocupado ? "var(--color-accent-300)" : "var(--color-divider)"}`,
                    background: seat.ocupado ? "var(--color-accent-100)" : "var(--color-neutral-100)",
                    color: "var(--color-text)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {seat.numero}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function tripSteps(trip) {
    const idx = STEP_ORDER.indexOf(trip.status);
    return STEP_ORDER.map((s, i) => ({
      color: i < idx ? STEP_COLORS.done : i === idx ? STEP_COLORS.active : STEP_COLORS.pending,
    }));
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <main style={{ flex: 1, padding: "32px 40px 64px", maxWidth: 1280, width: "100%", margin: "0 auto", display: "grid", gap: 32 }}>

        {/* Page header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent-700)", margin: "0 0 6px", fontWeight: 600 }}>Operação</p>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: 0 }}>Viagens e mapa de assentos</h1>
            <p style={{ fontSize: 13, opacity: .6, margin: "6px 0 0", maxWidth: "60ch" }}>Crie viagens, acompanhe o status de embarque e reserve poltronas por andar.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowNewTripDialog(true)}>+ Nova viagem</button>
        </header>

        {errorMessage ? (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" style={{ maxWidth: 320 }} type="text"
            placeholder="Buscar por título, origem ou destino"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="seg" role="radiogroup">
            {statusFilters.map((sf) => (
              <label key={sf.key} className="seg-opt">
                <input type="radio" name="status-filter" checked={statusFilter === sf.key}
                  onChange={() => setStatusFilter(sf.key)} readOnly />
                {sf.label}
              </label>
            ))}
          </div>
        </div>

        {/* Trip list */}
        <div style={{ display: "grid", gap: 12 }}>
          {isLoadingTrips ? (
            <p style={{ fontSize: 13, opacity: .6 }}>Carregando viagens...</p>
          ) : filteredTrips.length === 0 ? (
            <div style={{ border: "1px dashed var(--color-divider)", padding: 24, fontSize: 13, opacity: .6 }}>
              Nenhuma viagem encontrada para este filtro.
            </div>
          ) : filteredTrips.map((t) => {
            const steps = tripSteps(t);
            const isSelected = t.id === selectedTripId;
            return (
              <button key={t.id} type="button" onClick={() => setSelectedTripId(t.id)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-divider)"}`,
                  background: isSelected ? "var(--color-accent-100)" : "var(--color-surface)",
                  padding: "20px 24px", display: "grid", gap: 12, cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t.titulo}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, opacity: .65 }}>{t.origem} → {t.destino} · {fmtDateTime(t.data_partida)}</p>
                  </div>
                  <span className={`tag ${STATUS_TAG[t.status] || "tag-neutral"}`}>{STATUS_LABELS[t.status] || t.status}</span>
                </div>
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  {steps.map((s, i) => <div key={i} style={{ flex: 1, height: 3, background: s.color }} />)}
                </div>
                <p style={{ margin: 0, fontSize: 12, opacity: .55 }}>
                  {t.capacidade_andar_inferior} inferior / {t.capacidade_andar_superior} superior
                </p>
              </button>
            );
          })}
        </div>

        {/* Seat map */}
        {selectedTrip ? (
          <div className="card elev-sm" style={{ display: "grid", gap: 20 }}>
            <div>
              <div className="card-kicker">Mapa de assentos</div>
              <div className="card-title">{selectedTrip.titulo}</div>
            </div>

            {isLoadingSeats ? (
              <p style={{ fontSize: 13, opacity: .6 }}>Carregando assentos...</p>
            ) : (
              <div style={{ display: "grid", gap: 28 }}>
                {lowerSeats.length > 0 && renderSeatGrid(lowerSeats, "Andar inferior")}
                {upperSeats.length > 0 && renderSeatGrid(upperSeats, "Andar superior")}
              </div>
            )}

            <div style={{ display: "flex", gap: 20, fontSize: 12, opacity: .65 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, background: "var(--color-neutral-100)", border: "1px solid var(--color-divider)", display: "inline-block" }} />
                Disponível
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, background: "var(--color-accent-100)", border: "1px solid var(--color-accent-300)", display: "inline-block" }} />
                Reservado
              </span>
            </div>
          </div>
        ) : null}
      </main>

      {/* Dialog: Nova viagem */}
      {showNewTripDialog ? (
        <div className="dialog-backdrop">
          <form className="dialog" onSubmit={handleCreateTrip} style={{ maxWidth: 480 }}>
            <div className="dialog-title">Nova viagem</div>
            <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
              <input className="input" type="text" name="titulo" placeholder="Título — ex: Excursão SP x Curitiba"
                value={tripForm.titulo} onChange={handleTripFormChange} required />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input className="input" type="text" name="origem" placeholder="Origem"
                  value={tripForm.origem} onChange={handleTripFormChange} required />
                <input className="input" type="text" name="destino" placeholder="Destino"
                  value={tripForm.destino} onChange={handleTripFormChange} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input className="input" type="datetime-local" name="data_partida"
                  value={tripForm.data_partida} onChange={handleTripFormChange} required />
                <select className="input" name="status" value={tripForm.status} onChange={handleTripFormChange}>
                  <option value="planejada">Planejada</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="embarque">Embarque</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input className="input" type="number" min="0" max="80" name="capacidade_andar_inferior"
                  placeholder="Assentos andar inferior" value={tripForm.capacidade_andar_inferior} onChange={handleTripFormChange} />
                <input className="input" type="number" min="0" max="80" name="capacidade_andar_superior"
                  placeholder="Assentos andar superior" value={tripForm.capacidade_andar_superior} onChange={handleTripFormChange} />
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewTripDialog(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={isCreatingTrip}>
                {isCreatingTrip ? "Criando..." : "Criar viagem"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Dialog: Reservar poltrona */}
      {activeSeat ? (
        <div className="dialog-backdrop">
          <form className="dialog" onSubmit={handleReserveSeat} style={{ maxWidth: 420 }}>
            <div className="dialog-title">Reservar poltrona {activeSeat.numero} — {activeSeat.andar}</div>
            <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
              <select className="input" value={reservationPassengerId}
                onChange={(e) => setReservationPassengerId(e.target.value)} required>
                <option value="">Selecione o passageiro</option>
                {passengers.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveSeat(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={isReservingSeat}>
                {isReservingSeat ? "Reservando..." : "Reservar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Dialog: Liberar poltrona */}
      {releaseSeatData ? (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ maxWidth: 420 }}>
            <div className="dialog-title">Liberar poltrona {releaseSeatData.numero}</div>
            <div className="dialog-body">
              Atualmente reservada para <strong>{releaseSeatData.passageiro_nome || "passageiro"}</strong>. Deseja liberar esta poltrona?
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setReleaseSeatData(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleReleaseSeat}>Liberar poltrona</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TripsPage;
