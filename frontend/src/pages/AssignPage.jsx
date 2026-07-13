import { useEffect, useState } from "react";
import {
  getPassengers,
  getTrips,
  getTripSeats,
  getUsers,
  reserveSeat,
  updatePassenger,
} from "../services/api";
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
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoadingData(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedTripId) {
      setSeats([]);
      setSelectedSeat("");
      return;
    }
    setIsLoadingSeats(true);
    getTripSeats(selectedTripId)
      .then((data) => {
        setSeats(data.filter((s) => !s.ocupado));
        setSelectedSeat("");
      })
      .catch(() => setSeats([]))
      .finally(() => setIsLoadingSeats(false));
  }, [selectedTripId]);

  const selectedPassenger = passengers.find(
    (p) => String(p.id) === selectedPassengerId
  );
  const selectedUser = users.find((u) => String(u.id) === selectedUserId);

  const canSubmit =
    selectedPassengerId &&
    (selectedUserId || (selectedTripId && selectedSeat));

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || !canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const actions = [];

      if (selectedUserId) {
        actions.push(
          updatePassenger(Number(selectedPassengerId), {
            linked_user_id: Number(selectedUserId),
          })
        );
      }

      if (selectedTripId && selectedSeat) {
        const [numero, andar] = selectedSeat.split("|");
        actions.push(
          reserveSeat(Number(selectedTripId), {
            passageiro_id: Number(selectedPassengerId),
            numero: Number(numero),
            andar,
          })
        );
      }

      await Promise.all(actions);

      const parts = [];
      if (selectedUserId) parts.push(`usuário "${selectedUser?.username}" vinculado ao passageiro`);
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
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <AppHeader
          title="Vínculos"
          description="Selecione um passageiro e associe um usuário do sistema e/ou uma poltrona em uma viagem."
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        <article className="rounded-3xl bg-white p-5 shadow-card">
          {isLoadingData ? (
            <p className="text-sm text-slate-500">Carregando dados...</p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>

              {/* Passenger — required */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">
                  Passageiro <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPassengerId}
                  onChange={(e) => setSelectedPassengerId(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="">Selecione um passageiro...</option>
                  {passengers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — {p.documento}
                      {p.linked_user
                        ? ` (vinculado: ${p.linked_user.username} — ${p.linked_user.email})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <hr className="border-slate-100" />

              {/* User link — optional */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">
                  Vincular conta de usuário{" "}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Sem vínculo de usuário</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} — {u.email}
                    </option>
                  ))}
                </select>
                {users.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Nenhum usuário comum cadastrado. Crie usuários na aba Usuários.
                  </p>
                ) : null}
              </div>

              <hr className="border-slate-100" />

              {/* Seat assignment — optional */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">
                  Alocar poltrona{" "}
                  <span className="text-slate-400 font-normal">(opcional)</span>
                </label>

                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecione uma viagem...</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.titulo} — {t.origem} → {t.destino}
                    </option>
                  ))}
                </select>

                {selectedTripId ? (
                  isLoadingSeats ? (
                    <p className="text-sm text-slate-500">Carregando poltronas...</p>
                  ) : seats.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      Nenhuma poltrona disponível nesta viagem.
                    </div>
                  ) : (
                    <select
                      value={selectedSeat}
                      onChange={(e) => setSelectedSeat(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Selecione uma poltrona...</option>
                      {["inferior", "superior"].map((andar) => {
                        const filtered = seats.filter((s) => s.andar === andar);
                        if (!filtered.length) return null;
                        return (
                          <optgroup
                            key={andar}
                            label={andar === "inferior" ? "Andar Inferior" : "Andar Superior"}
                          >
                            {filtered.map((s) => (
                              <option key={s.id} value={`${s.numero}|${s.andar}`}>
                                Poltrona {s.numero}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  )
                ) : null}
              </div>

              {/* Preview */}
              {selectedPassenger && (selectedUserId || (selectedTripId && selectedSeat)) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-900">Resumo do vínculo:</p>
                  <p>Passageiro: <span className="font-medium">{selectedPassenger.nome}</span></p>
                  {selectedUserId ? (
                    <p>Conta: <span className="font-medium">{selectedUser?.username}</span></p>
                  ) : null}
                  {selectedTripId && selectedSeat ? (
                    <p>
                      Poltrona:{" "}
                      <span className="font-medium">
                        {selectedSeat.split("|")[0]} —{" "}
                        {selectedSeat.split("|")[1] === "inferior"
                          ? "Andar Inferior"
                          : "Andar Superior"}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Salvando vínculos..." : "Confirmar vínculos"}
              </button>
            </form>
          )}
        </article>
      </div>
    </main>
  );
}

export default AssignPage;
