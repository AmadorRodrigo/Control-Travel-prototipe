import { useEffect, useRef, useState } from "react";
import {
  createPassenger,
  deletePassenger,
  getPassengers,
  getUsers,
  updatePassenger,
} from "../services/api";
import { generateUUID } from "../utils/uuid";
import AppHeader from "../components/AppHeader";

const initialForm = {
  nome: "",
  documento: "",
  data_nascimento: "",
  telefone: "",
  contato_emergencia: "",
  linked_user_id: "",
};

function PassengersPage() {
  const [passengers, setPassengers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 5,
    total: 0,
    total_pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingPassenger, setEditingPassenger] = useState(null);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [users, setUsers] = useState([]);
  const menuRefs = useRef({});

  useEffect(() => {
    function handleOutsideClick(event) {
      if (openMenuId === null) return;
      const menuEl = menuRefs.current[openMenuId];
      if (menuEl && !menuEl.contains(event.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  useEffect(() => {
    getUsers().then((data) => setUsers(data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    async function loadPassengers() {
      setIsLoading(true);
      try {
        const data = await getPassengers({ page, page_size: pageSize });
        setPassengers(data.items);
        setPagination(data.pagination);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadPassengers();
  }, [page, pageSize]);

  async function refreshList(targetPage = page) {
    const data = await getPassengers({ page: targetPage, page_size: pageSize });
    setPassengers(data.items);
    setPagination(data.pagination);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function startEdit(passenger) {
    setEditingPassenger(passenger);
    setFormData({
      nome: passenger.nome,
      documento: passenger.documento,
      data_nascimento: passenger.data_nascimento,
      telefone: passenger.telefone,
      contato_emergencia: passenger.contato_emergencia,
      linked_user_id: passenger.linked_user_id ?? "",
    });
    setOpenMenuId(null);
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditingPassenger(null);
    setFormData(initialForm);
    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (editingPassenger) {
        const payload = {
          ...formData,
          linked_user_id: formData.linked_user_id ? Number(formData.linked_user_id) : null,
        };
        await updatePassenger(editingPassenger.id, payload);
        setEditingPassenger(null);
        setFormData(initialForm);
        await refreshList();
      } else {
        const idempotencyKey = generateUUID();
        await createPassenger(formData, idempotencyKey);
        setFormData(initialForm);
        setPage(1);
        await refreshList(1);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (isDeletingId) return;
    setIsDeletingId(id);
    setOpenMenuId(null);
    setErrorMessage("");
    try {
      await deletePassenger(id);
      const nextPage =
        passengers.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await refreshList(nextPage);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <AppHeader
          title="Passageiros e ocupação"
          description="Cadastro completo de viajantes para posterior alocação de poltronas por viagem e por andar."
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Lista de passageiros
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Visualização simples para mobile, com cards em vez de tabela.
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                {pagination.total} registros no total
              </p>
            </div>

            {isLoading ? (
              <p className="text-sm text-slate-500">Carregando passageiros...</p>
            ) : passengers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Nenhum passageiro cadastrado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {passengers.map((passenger) => (
                  <div
                    key={passenger.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {passenger.nome}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Documento: {passenger.documento}
                        </p>
                      </div>

                      <div
                        className="relative"
                        ref={(el) => {
                          if (el) menuRefs.current[passenger.id] = el;
                          else delete menuRefs.current[passenger.id];
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === passenger.id ? null : passenger.id
                            )
                          }
                          className="flex flex-col items-center justify-center gap-[4px] rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Ações do passageiro"
                        >
                          <span className="block h-[2px] w-4 rounded bg-current" />
                          <span className="block h-[2px] w-4 rounded bg-current" />
                          <span className="block h-[2px] w-4 rounded bg-current" />
                        </button>

                        {openMenuId === passenger.id ? (
                          <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => startEdit(passenger)}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(passenger.id)}
                              disabled={isDeletingId === passenger.id}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {isDeletingId === passenger.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p>Nascimento: {passenger.data_nascimento}</p>
                      <p>Telefone: {passenger.telefone}</p>
                      <p className="sm:col-span-2">
                        Emergência: {passenger.contato_emergencia}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || isLoading}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>

              <span className="text-sm text-slate-500">
                Página {pagination.page} de{" "}
                {Math.max(1, pagination.total_pages)}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    pagination.total_pages > 0
                      ? Math.min(pagination.total_pages, current + 1)
                      : current
                  )
                }
                disabled={
                  isLoading ||
                  pagination.total_pages === 0 ||
                  page >= pagination.total_pages
                }
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingPassenger ? "Editar passageiro" : "Novo passageiro"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {editingPassenger
                  ? `Alterando dados de ${editingPassenger.nome}.`
                  : "Formulário preparado para coleta completa dos dados do viajante."}
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="text"
                name="nome"
                placeholder="Nome completo"
                value={formData.nome}
                onChange={handleChange}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="text"
                name="documento"
                placeholder="Documento ou passaporte"
                value={formData.documento}
                onChange={handleChange}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="date"
                name="data_nascimento"
                value={formData.data_nascimento}
                onChange={handleChange}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="tel"
                name="telefone"
                placeholder="Telefone"
                value={formData.telefone}
                onChange={handleChange}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="text"
                name="contato_emergencia"
                placeholder="Contato de emergência"
                value={formData.contato_emergencia}
                onChange={handleChange}
                required
              />

              {editingPassenger ? (
                <select
                  name="linked_user_id"
                  value={formData.linked_user_id}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                >
                  <option value="">Sem vínculo com usuário</option>
                  {users
                    .filter((u) => !u.is_admin)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email})
                      </option>
                    ))}
                </select>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? "Salvando..."
                  : editingPassenger
                  ? "Salvar alterações"
                  : "Cadastrar passageiro"}
              </button>

              {editingPassenger ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
              ) : null}
            </form>
          </article>
        </section>
      </div>
    </main>
  );
}

export default PassengersPage;
