import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import {
  createTrip,
  getPassengers,
  getTripSeats,
  getTrips,
  releaseSeat,
  reserveSeat,
} from "../services/api";

const initialTripForm = {
  titulo: "",
  origem: "",
  destino: "",
  data_partida: "",
  status: "planejada",
  capacidade_andar_inferior: 22,
  capacidade_andar_superior: 22,
  observacoes: "",
};

const initialReservationForm = {
  passageiro_id: "",
  numero: "",
  andar: "inferior",
};

function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [seats, setSeats] = useState([]);
  const [tripForm, setTripForm] = useState(initialTripForm);
  const [reservationForm, setReservationForm] = useState(initialReservationForm);
  const [tripPagination, setTripPagination] = useState({
    page: 1,
    page_size: 10,
    total: 0,
    total_pages: 0,
  });
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isReservingSeat, setIsReservingSeat] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function bootstrapData() {
      setIsLoadingTrips(true);

      try {
        const [tripsResponse, passengersResponse] = await Promise.all([
          getTrips({ page: 1, page_size: 10 }),
          getPassengers({ page: 1, page_size: 50 }),
        ]);

        setTrips(tripsResponse.items);
        setTripPagination(tripsResponse.pagination);
        setPassengers(passengersResponse.items);

        if (tripsResponse.items.length > 0) {
          setSelectedTripId(tripsResponse.items[0].id);
        }
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoadingTrips(false);
      }
    }

    bootstrapData();
  }, []);

  useEffect(() => {
    async function loadSeats() {
      if (!selectedTripId) {
        setSeats([]);
        return;
      }

      setIsLoadingSeats(true);

      try {
        const data = await getTripSeats(selectedTripId);
        setSeats(data);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoadingSeats(false);
      }
    }

    loadSeats();
  }, [selectedTripId]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || null,
    [selectedTripId, trips]
  );

  const lowerDeckSeats = useMemo(
    () => seats.filter((seat) => seat.andar === "inferior"),
    [seats]
  );
  const upperDeckSeats = useMemo(
    () => seats.filter((seat) => seat.andar === "superior"),
    [seats]
  );

  function handleTripFormChange(event) {
    const { name, value } = event.target;
    setTripForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleReservationFormChange(event) {
    const { name, value } = event.target;
    setReservationForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSeatSelection(seat) {
    setReservationForm((current) => ({
      ...current,
      numero: String(seat.numero),
      andar: seat.andar,
    }));
  }

  async function refreshTrips(selectTripId) {
    const data = await getTrips({ page: 1, page_size: 10 });
    setTrips(data.items);
    setTripPagination(data.pagination);

    if (selectTripId) {
      setSelectedTripId(selectTripId);
    } else if (!selectedTripId && data.items.length > 0) {
      setSelectedTripId(data.items[0].id);
    }
  }

  async function refreshSeats(viagemId = selectedTripId) {
    if (!viagemId) {
      return;
    }

    const data = await getTripSeats(viagemId);
    setSeats(data);
  }

  async function handleCreateTrip(event) {
    event.preventDefault();
    if (isCreatingTrip) {
      return;
    }

    setIsCreatingTrip(true);
    setErrorMessage("");

    try {
      const createdTrip = await createTrip({
        ...tripForm,
        data_partida: new Date(tripForm.data_partida).toISOString(),
        capacidade_andar_inferior: Number(tripForm.capacidade_andar_inferior),
        capacidade_andar_superior: Number(tripForm.capacidade_andar_superior),
      });

      setTripForm(initialTripForm);
      await refreshTrips(createdTrip.id);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsCreatingTrip(false);
    }
  }

  async function handleReserveSeat(event) {
    event.preventDefault();
    if (isReservingSeat || !selectedTripId) {
      return;
    }

    setIsReservingSeat(true);
    setErrorMessage("");

    try {
      await reserveSeat(selectedTripId, {
        passageiro_id: Number(reservationForm.passageiro_id),
        numero: Number(reservationForm.numero),
        andar: reservationForm.andar,
      });
      await refreshSeats(selectedTripId);
      setReservationForm(initialReservationForm);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsReservingSeat(false);
    }
  }

  async function handleReleaseSeat(assentoId) {
    if (!selectedTripId) {
      return;
    }

    try {
      setErrorMessage("");
      await releaseSeat(selectedTripId, assentoId);
      await refreshSeats(selectedTripId);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function renderSeatGrid(seatList, floorName) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Andar {floorName}
          </h3>
          <span className="text-xs text-slate-400">
            {seatList.filter((seat) => seat.ocupado).length}/{seatList.length} ocupados
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {seatList.map((seat) => (
            <div
              key={seat.id}
              className={`rounded-2xl border p-4 text-left transition ${
                seat.ocupado
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <button type="button" onClick={() => handleSeatSelection(seat)} className="w-full text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Poltrona
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">{seat.numero}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {seat.ocupado
                    ? `Reservado para ${seat.passageiro_nome || "passageiro"}`
                    : "Disponível"}
                </p>
              </button>
              {seat.ocupado ? (
                <button
                  type="button"
                  onClick={() => handleReleaseSeat(seat.id)}
                  className="mt-3 inline-flex rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  Liberar
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <AppHeader
          title="Viagens, assentos e reserva"
          description="Gestão de viagens com geração automática de assentos por andar, reserva protegida contra concorrência e operação mobile-first."
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Nova viagem</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ao criar a viagem, o backend já monta o mapa de assentos por andar.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleCreateTrip}>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="text"
                name="titulo"
                placeholder="Ex: Excursão São Paulo x Curitiba"
                value={tripForm.titulo}
                onChange={handleTripFormChange}
                required
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  type="text"
                  name="origem"
                  placeholder="Origem"
                  value={tripForm.origem}
                  onChange={handleTripFormChange}
                  required
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  type="text"
                  name="destino"
                  placeholder="Destino"
                  value={tripForm.destino}
                  onChange={handleTripFormChange}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  type="datetime-local"
                  name="data_partida"
                  value={tripForm.data_partida}
                  onChange={handleTripFormChange}
                  required
                />
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  name="status"
                  value={tripForm.status}
                  onChange={handleTripFormChange}
                >
                  <option value="planejada">Planejada</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="embarque">Embarque</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  type="number"
                  min="0"
                  max="80"
                  name="capacidade_andar_inferior"
                  placeholder="Assentos andar inferior"
                  value={tripForm.capacidade_andar_inferior}
                  onChange={handleTripFormChange}
                  required
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  type="number"
                  min="0"
                  max="80"
                  name="capacidade_andar_superior"
                  placeholder="Assentos andar superior"
                  value={tripForm.capacidade_andar_superior}
                  onChange={handleTripFormChange}
                  required
                />
              </div>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                name="observacoes"
                placeholder="Observações operacionais"
                value={tripForm.observacoes}
                onChange={handleTripFormChange}
              />
              <button
                type="submit"
                disabled={isCreatingTrip}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingTrip ? "Criando viagem..." : "Criar viagem"}
              </button>
            </form>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Viagens criadas</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {tripPagination.total} viagens registradas na base.
                </p>
              </div>
            </div>

            {isLoadingTrips ? (
              <p className="text-sm text-slate-500">Carregando viagens...</p>
            ) : trips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Nenhuma viagem cadastrada ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => {
                  const isSelected = trip.id === selectedTripId;
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setSelectedTripId(trip.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-brand-500 bg-brand-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">{trip.titulo}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {trip.origem} → {trip.destino}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {trip.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p>
                          Partida:{" "}
                          {new Date(trip.data_partida).toLocaleString("pt-BR")}
                        </p>
                        <p>
                          Assentos: {trip.capacidade_andar_inferior} inferior /{" "}
                          {trip.capacidade_andar_superior} superior
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Mapa de assentos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedTrip
                  ? `Reserva ativa para ${selectedTrip.titulo}.`
                  : "Selecione uma viagem para visualizar o mapa de assentos."}
              </p>
            </div>

            {!selectedTrip ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Nenhuma viagem selecionada.
              </div>
            ) : isLoadingSeats ? (
              <p className="text-sm text-slate-500">Carregando assentos...</p>
            ) : (
              <div className="space-y-6">
                {renderSeatGrid(lowerDeckSeats, "inferior")}
                {upperDeckSeats.length > 0 ? renderSeatGrid(upperDeckSeats, "superior") : null}
              </div>
            )}
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Reservar assento
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Clique em uma poltrona do mapa ou preencha manualmente o número e andar.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleReserveSeat}>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                name="passageiro_id"
                value={reservationForm.passageiro_id}
                onChange={handleReservationFormChange}
                required
              >
                <option value="">Selecione o passageiro</option>
                {passengers.map((passenger) => (
                  <option key={passenger.id} value={passenger.id}>
                    {passenger.nome}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  type="number"
                  min="1"
                  max="99"
                  name="numero"
                  placeholder="Número da poltrona"
                  value={reservationForm.numero}
                  onChange={handleReservationFormChange}
                  required
                />
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  name="andar"
                  value={reservationForm.andar}
                  onChange={handleReservationFormChange}
                >
                  <option value="inferior">Andar inferior</option>
                  <option value="superior">Andar superior</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isReservingSeat || !selectedTripId}
                className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isReservingSeat ? "Reservando..." : "Reservar assento"}
              </button>
            </form>
          </article>
        </section>
      </div>
    </main>
  );
}

export default TripsPage;
