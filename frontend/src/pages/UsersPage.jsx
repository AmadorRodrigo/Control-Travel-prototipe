import { useEffect, useRef, useState } from "react";
import { createUser, deleteUser, getUsers, updateUser } from "../services/api";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  username: "",
  email: "",
  password: "",
  is_admin: false,
};

function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isDeletingId, setIsDeletingId] = useState(null);
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
    async function load() {
      setIsLoading(true);
      try {
        const data = await getUsers();
        setUsers(data.items);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function refreshList() {
    const data = await getUsers();
    setUsers(data.items);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function startEdit(user) {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      is_admin: user.is_admin,
    });
    setOpenMenuId(null);
    setErrorMessage("");
  }

  function cancelEdit() {
    setEditingUser(null);
    setFormData(initialForm);
    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (editingUser) {
        const payload = {};
        if (formData.username !== editingUser.username) payload.username = formData.username;
        if (formData.email !== editingUser.email) payload.email = formData.email;
        if (formData.is_admin !== editingUser.is_admin) payload.is_admin = formData.is_admin;
        if (formData.password) payload.password = formData.password;
        if (Object.keys(payload).length === 0) {
          setEditingUser(null);
          setFormData(initialForm);
          setIsSubmitting(false);
          return;
        }
        await updateUser(editingUser.id, payload);
        setEditingUser(null);
        setFormData(initialForm);
      } else {
        await createUser(formData);
        setFormData(initialForm);
      }
      await refreshList();
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
      await deleteUser(id);
      await refreshList();
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
          title="Gerenciamento de usuários"
          description="Cadastre e gerencie os usuários do sistema. Usuários comuns visualizam apenas suas poltronas."
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
                Lista de usuários
              </h2>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                {users.length} usuário{users.length !== 1 ? "s" : ""} no total
              </p>
            </div>

            {isLoading ? (
              <p className="text-sm text-slate-500">Carregando usuários...</p>
            ) : users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Nenhum usuário cadastrado.
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {u.username}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              u.is_admin
                                ? "bg-brand-50 text-brand-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {u.is_admin ? "Admin" : "Usuário"}
                          </span>
                          {!u.is_active ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                              Inativo
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{u.email}</p>
                      </div>

                      {u.id !== currentUser?.id ? (
                        <div
                          className="relative"
                          ref={(el) => {
                            if (el) menuRefs.current[u.id] = el;
                            else delete menuRefs.current[u.id];
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(openMenuId === u.id ? null : u.id)
                            }
                            className="flex flex-col items-center justify-center gap-[4px] rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Ações do usuário"
                          >
                            <span className="block h-[2px] w-4 rounded bg-current" />
                            <span className="block h-[2px] w-4 rounded bg-current" />
                            <span className="block h-[2px] w-4 rounded bg-current" />
                          </button>

                          {openMenuId === u.id ? (
                            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => startEdit(u)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(u.id)}
                                disabled={isDeletingId === u.id}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {isDeletingId === u.id ? "Excluindo..." : "Excluir"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-400">
                          Você
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingUser ? "Editar usuário" : "Novo usuário"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {editingUser
                  ? `Alterando dados de ${editingUser.username}.`
                  : "Preencha os dados para criar um novo acesso ao sistema."}
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="text"
                name="username"
                placeholder="Nome de usuário"
                value={formData.username}
                onChange={handleChange}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="email"
                name="email"
                placeholder="E-mail"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                type="password"
                name="password"
                placeholder={editingUser ? "Nova senha (deixe em branco para manter)" : "Senha"}
                value={formData.password}
                onChange={handleChange}
                required={!editingUser}
                minLength={6}
              />

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  name="is_admin"
                  checked={formData.is_admin}
                  onChange={handleChange}
                  className="h-4 w-4 rounded accent-slate-900"
                />
                <span className="text-sm text-slate-700">
                  Administrador — acesso completo ao sistema
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? "Salvando..."
                  : editingUser
                  ? "Salvar alterações"
                  : "Criar usuário"}
              </button>

              {editingUser ? (
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

export default UsersPage;
