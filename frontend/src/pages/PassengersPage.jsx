import { useEffect, useState } from "react";
import { createPassenger, deletePassenger, getPassengers, getUsers, updatePassenger } from "../services/api";
import { generateUUID } from "../utils/uuid";
import AppHeader from "../components/AppHeader";

const initialForm = { nome: "", documento: "", data_nascimento: "", telefone: "", contato_emergencia: "", linked_user_id: "" };

function PassengersPage() {
  const [passengers, setPassengers] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [showDialog, setShowDialog] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  useEffect(() => {
    getUsers().then((d) => setUsers(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getPassengers({ page, page_size: 20 });
        setPassengers(data.items);
        setPagination(data.pagination);
      } catch (e) {
        setErrorMessage(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [page]);

  async function refresh(targetPage = page) {
    const data = await getPassengers({ page: targetPage, page_size: 20 });
    setPassengers(data.items);
    setPagination(data.pagination);
  }

  function openNew() {
    setEditingPassenger(null);
    setFormData(initialForm);
    setErrorMessage("");
    setShowDialog(true);
  }

  function openEdit(p) {
    setEditingPassenger(p);
    setFormData({
      nome: p.nome, documento: p.documento, data_nascimento: p.data_nascimento,
      telefone: p.telefone, contato_emergencia: p.contato_emergencia, linked_user_id: p.linked_user_id ?? "",
    });
    setErrorMessage("");
    setShowDialog(true);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((c) => ({ ...c, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      if (editingPassenger) {
        await updatePassenger(editingPassenger.id, { ...formData, linked_user_id: formData.linked_user_id ? Number(formData.linked_user_id) : null });
      } else {
        await createPassenger(formData, generateUUID());
        setPage(1);
      }
      setShowDialog(false);
      await refresh(editingPassenger ? page : 1);
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(p) {
    if (isDeletingId) return;
    if (!window.confirm(`Excluir "${p.nome}"?`)) return;
    setIsDeletingId(p.id);
    setErrorMessage("");
    try {
      await deletePassenger(p.id);
      const nextPage = passengers.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      else await refresh(nextPage);
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setIsDeletingId(null);
    }
  }

  const filtered = passengers.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || p.documento.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <main style={{ flex: 1, padding: "32px 40px 64px", maxWidth: 1280, width: "100%", margin: "0 auto", display: "grid", gap: 24 }} className="page-fade">

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-accent-700)", margin: "0 0 6px", fontWeight: 600 }}>Cadastro</p>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: 0 }}>Passageiros</h1>
            <p style={{ fontSize: 13, opacity: .6, margin: "6px 0 0" }}>{pagination.total} viajantes cadastrados.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openNew}>+ Novo passageiro</button>
        </header>

        {errorMessage ? (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}

        <input className="input" style={{ maxWidth: 360 }} type="text"
          placeholder="Buscar por nome ou documento"
          value={search} onChange={(e) => setSearch(e.target.value)} />

        {isLoading ? (
          <p style={{ fontSize: 13, opacity: .6 }}>Carregando passageiros...</p>
        ) : filtered.length === 0 ? (
          <div style={{ border: "1px dashed var(--color-divider)", padding: 24, fontSize: 13, opacity: .6 }}>
            Nenhum passageiro encontrado.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Nascimento</th>
                <th>Telefone</th>
                <th>Emergência</th>
                <th>Vínculo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nome}</td>
                  <td className="text-muted">{p.documento}</td>
                  <td className="text-muted">{p.data_nascimento}</td>
                  <td className="text-muted">{p.telefone}</td>
                  <td className="text-muted">{p.contato_emergencia}</td>
                  <td>
                    {p.linked_user
                      ? <span className="tag tag-accent">{p.linked_user.username}</span>
                      : <span className="tag tag-neutral">Sem vínculo</span>}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btn btn-ghost" onClick={() => openEdit(p)}>Editar</button>
                    <button type="button" className="btn btn-ghost" style={{ color: "var(--color-accent-700)" }}
                      onClick={() => handleDelete(p)} disabled={isDeletingId === p.id}>
                      {isDeletingId === p.id ? "..." : "Excluir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination.total_pages > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPage((c) => Math.max(1, c - 1))} disabled={page <= 1 || isLoading}>Anterior</button>
            <span style={{ fontSize: 13, opacity: .6 }}>Página {pagination.page} de {pagination.total_pages}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setPage((c) => Math.min(pagination.total_pages, c + 1))} disabled={isLoading || page >= pagination.total_pages}>Próxima</button>
          </div>
        ) : null}
      </main>

      {showDialog ? (
        <div className="dialog-backdrop">
          <form className="dialog" onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
            <div className="dialog-title">{editingPassenger ? "Editar passageiro" : "Novo passageiro"}</div>
            <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
              <input className="input" type="text" name="nome" placeholder="Nome completo"
                value={formData.nome} onChange={handleChange} required />
              <input className="input" type="text" name="documento" placeholder="Documento"
                value={formData.documento} onChange={handleChange} required />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input className="input" type="date" name="data_nascimento"
                  value={formData.data_nascimento} onChange={handleChange} required />
                <input className="input" type="tel" name="telefone" placeholder="Telefone"
                  value={formData.telefone} onChange={handleChange} required />
              </div>
              <input className="input" type="text" name="contato_emergencia" placeholder="Contato de emergência"
                value={formData.contato_emergencia} onChange={handleChange} required />
              <select className="input" name="linked_user_id" value={formData.linked_user_id} onChange={handleChange}>
                <option value="">Sem vínculo com usuário</option>
                {users.filter((u) => !u.is_admin).map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                ))}
              </select>
              {errorMessage ? (
                <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
                  {errorMessage}
                </div>
              ) : null}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDialog(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : editingPassenger ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default PassengersPage;
