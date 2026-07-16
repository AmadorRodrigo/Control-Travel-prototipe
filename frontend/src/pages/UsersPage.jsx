import { useEffect, useState } from "react";
import { createUser, deleteUser, getUsers, updateUser } from "../services/api";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";

const initialForm = { username: "", email: "", password: "", is_admin: false };

function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDeletingId, setIsDeletingId] = useState(null);

  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getUsers();
        setUsers(data.items);
      } catch (e) {
        setErrorMessage(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function refresh() {
    const data = await getUsers();
    setUsers(data.items);
  }

  function openNew() {
    setEditingUser(null);
    setFormData(initialForm);
    setErrorMessage("");
    setShowDialog(true);
  }

  function openEdit(u) {
    setEditingUser(u);
    setFormData({ username: u.username, email: u.email, password: "", is_admin: u.is_admin });
    setErrorMessage("");
    setShowDialog(true);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((c) => ({ ...c, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
        if (Object.keys(payload).length > 0) await updateUser(editingUser.id, payload);
      } else {
        await createUser(formData);
      }
      setShowDialog(false);
      await refresh();
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(u) {
    if (isDeletingId) return;
    if (!window.confirm(`Excluir usuário "${u.username}"?`)) return;
    setIsDeletingId(u.id);
    setErrorMessage("");
    try {
      await deleteUser(u.id);
      await refresh();
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <main style={{ flex: 1, padding: "32px 40px 64px", maxWidth: 1280, width: "100%", margin: "0 auto", display: "grid", gap: 24 }} className="page-fade">

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent-700)", margin: "0 0 6px", fontWeight: 600 }}>Acesso</p>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: 0 }}>Usuários</h1>
            <p style={{ fontSize: 13, opacity: .6, margin: "6px 0 0" }}>Usuários comuns visualizam apenas a própria poltrona.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openNew}>+ Novo usuário</button>
        </header>

        {errorMessage ? (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <p style={{ fontSize: 13, opacity: .6 }}>Carregando usuários...</p>
        ) : users.length === 0 ? (
          <div style={{ border: "1px dashed var(--color-divider)", padding: 24, fontSize: 13, opacity: .6 }}>
            Nenhum usuário cadastrado.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    {u.username}
                    {u.id === currentUser?.id ? <span className="tag tag-neutral" style={{ marginLeft: 8 }}>Você</span> : null}
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td><span className={`tag ${u.is_admin ? "tag-accent" : "tag-neutral"}`}>{u.is_admin ? "Admin" : "Usuário"}</span></td>
                  <td><span className={`tag ${u.is_active ? "tag-outline" : "tag-neutral"}`}>{u.is_active ? "Ativo" : "Inativo"}</span></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {u.id !== currentUser?.id ? (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={() => openEdit(u)}>Editar</button>
                        <button type="button" className="btn btn-ghost" style={{ color: "var(--color-accent-700)" }}
                          onClick={() => handleDelete(u)} disabled={isDeletingId === u.id}>
                          {isDeletingId === u.id ? "..." : "Excluir"}
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {showDialog ? (
        <div className="dialog-backdrop">
          <form className="dialog" onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
            <div className="dialog-title">{editingUser ? "Editar usuário" : "Novo usuário"}</div>
            <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
              <input className="input" type="text" name="username" placeholder="Nome de usuário"
                value={formData.username} onChange={handleChange} required />
              <input className="input" type="email" name="email" placeholder="E-mail"
                value={formData.email} onChange={handleChange} required />
              <input className="input" type="password" name="password"
                placeholder={editingUser ? "Nova senha (deixe em branco para manter)" : "Senha"}
                value={formData.password} onChange={handleChange} required={!editingUser} minLength={6} />
              <label style={{ border: "1px solid var(--color-divider)", padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input type="checkbox" name="is_admin" checked={formData.is_admin} onChange={handleChange} />
                Administrador — acesso completo ao sistema
              </label>
              {errorMessage ? (
                <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
                  {errorMessage}
                </div>
              ) : null}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDialog(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : editingUser ? "Salvar" : "Criar usuário"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default UsersPage;
