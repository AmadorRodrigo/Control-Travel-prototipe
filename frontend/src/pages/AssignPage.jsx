import { useEffect, useState } from "react";
import { getPassengers, getTrips, getTripSeats, getUsers, reserveSeat, updatePassenger } from "../services/api";
import AppHeader from "../components/AppHeader";

function AssignPage() {
  const [users, setUsers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [seats, setSeats] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPassengerId, setSelectedPassengerId] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedSeat, setSelectedSeat] = useState("");

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [usersData, passengersData, tripsData] = await Promise.all([
          getUsers(),
          getPassengers({ page_size: 50 }),
          getTrips({ page_size: 50 }),
        ]);
        setUsers(usersData.items.filter((u) => !u.is_admin));
        setPassengers(passengersData.items);
        setTrips(tripsData.items);
      } catch (e) {
        setErrorMessage(e.message);
      } finally {
        setIsLoadingData(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedTripId) { setSeats([]); setSelectedSeat(""); return; }
    setIsLoadingSeats(true);
    getTripSeats(selectedTripId)
      .then((data) => { setSeats(data.filter((s) => !s.ocupado)); setSelectedSeat(""); })
      .catch(() => setSeats([]))
      .finally(() => setIsLoadingSeats(false));
  }, [selectedTripId]);

  const selectedPassenger = passengers.find((p) => String(p.id) === selectedPassengerId);
  const selectedUser = users.find((u) => String(u.id) === selectedUserId);
  const canSubmit = selectedPassengerId && (selectedUserId || (selectedTripId && selectedSeat));

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting || !canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const actions = [];
      if (selectedUserId) {
        actions.push(updatePassenger(Number(selectedPassengerId), { linked_user_id: Number(selectedUserId) }));
      }
      if (selectedTripId && selectedSeat) {
        const [numero, andar] = selectedSeat.split("|");
        actions.push(reserveSeat(Number(selectedTripId), { passageiro_id: Number(selectedPassengerId), numero: Number(numero), andar }));
      }
      await Promise.all(actions);

      const parts = [];
      if (selectedUserId) parts.push(`usuário "${selectedUser?.username}" vinculado`);
      if (selectedTripId && selectedSeat) parts.push("poltrona reservada");
      setSuccessMessage(parts.join(" e ") + " com sucesso.");

      setSelectedUserId("");
      setSelectedPassengerId("");
      setSelectedTripId("");
      setSelectedSeat("");

      const [passengersData, tripsData] = await Promise.all([
        getPassengers({ page_size: 50 }),
        getTrips({ page_size: 50 }),
      ]);
      setPassengers(passengersData.items);
      setTrips(tripsData.items);
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <main style={{ flex: 1, padding: "32px 40px 64px", maxWidth: 720, width: "100%", margin: "0 auto", display: "grid", gap: 24 }} className="page-fade">

        <header>
          <p style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent-700)", margin: "0 0 6px", fontWeight: 600 }}>Vínculos</p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: 0 }}>Associar passageiro</h1>
          <p style={{ fontSize: 13, opacity: .6, margin: "6px 0 0" }}>Vincule um passageiro a uma conta de usuário e/ou a uma poltrona.</p>
        </header>

        {errorMessage ? (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
            {successMessage}
          </div>
        ) : null}

        {isLoadingData ? (
          <p style={{ fontSize: 13, opacity: .6 }}>Carregando dados...</p>
        ) : (
          <form className="card elev-sm" style={{ display: "grid", gap: 16 }} onSubmit={handleSubmit}>
            <div className="field">
              <label>Passageiro *</label>
              <select className="input" value={selectedPassengerId} onChange={(e) => setSelectedPassengerId(e.target.value)} required>
                <option value="">Selecione um passageiro...</option>
                {passengers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.documento}{p.linked_user ? ` (vinculado: ${p.linked_user.username})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="hr" style={{ margin: 0 }} />

            <div className="field">
              <label>Vincular conta de usuário <span style={{ opacity: .5, fontWeight: 400 }}>(opcional)</span></label>
              <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">Sem vínculo de usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username} — {u.email}</option>
                ))}
              </select>
              {users.length === 0 ? (
                <p style={{ fontSize: 12, opacity: .5, margin: "4px 0 0" }}>Nenhum usuário comum cadastrado. Crie usuários na aba Usuários.</p>
              ) : null}
            </div>

            <div className="hr" style={{ margin: 0 }} />

            <div className="field">
              <label>Alocar poltrona <span style={{ opacity: .5, fontWeight: 400 }}>(opcional)</span></label>
              <select className="input" value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)}>
                <option value="">Selecione uma viagem...</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.titulo} — {t.origem} → {t.destino}</option>
                ))}
              </select>
              {selectedTripId ? (
                isLoadingSeats ? (
                  <p style={{ fontSize: 12, opacity: .5, margin: "4px 0 0" }}>Carregando poltronas...</p>
                ) : seats.length === 0 ? (
                  <p style={{ fontSize: 12, opacity: .5, margin: "4px 0 0" }}>Nenhuma poltrona disponível nesta viagem.</p>
                ) : (
                  <select className="input" style={{ marginTop: 8 }} value={selectedSeat} onChange={(e) => setSelectedSeat(e.target.value)}>
                    <option value="">Selecione uma poltrona...</option>
                    {["inferior", "superior"].map((andar) => {
                      const filtered = seats.filter((s) => s.andar === andar);
                      if (!filtered.length) return null;
                      return (
                        <optgroup key={andar} label={andar === "inferior" ? "Andar Inferior" : "Andar Superior"}>
                          {filtered.map((s) => (
                            <option key={s.id} value={`${s.numero}|${s.andar}`}>Poltrona {s.numero}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                )
              ) : null}
            </div>

            {selectedPassenger && (selectedUserId || (selectedTripId && selectedSeat)) ? (
              <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13, display: "grid", gap: 4 }}>
                <strong>Resumo:</strong>
                <span>Passageiro: {selectedPassenger.nome}</span>
                {selectedUserId ? <span>Conta: {selectedUser?.username}</span> : null}
                {selectedTripId && selectedSeat ? (
                  <span>Poltrona: {selectedSeat.split("|")[0]} — {selectedSeat.split("|")[1] === "inferior" ? "Andar Inferior" : "Andar Superior"}</span>
                ) : null}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Salvando vínculos..." : "Confirmar vínculo"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default AssignPage;
