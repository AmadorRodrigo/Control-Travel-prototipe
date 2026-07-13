import { useEffect, useState } from "react";
import { getMySeats } from "../services/api";
import AppHeader from "../components/AppHeader";

function MySeatsPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const result = await getMySeats();
        setData(result);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <AppHeader
          title="Minha poltrona"
          description="Visualize sua poltrona e andar nas viagens em que você foi alocado."
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage === "Nenhum cadastro de passageiro vinculado a este usuário."
              ? "Você ainda não foi vinculado a nenhum passageiro. Aguarde o administrador configurar seu acesso."
              : errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <p className="text-sm text-slate-500">Carregando suas informações...</p>
          </div>
        ) : data ? (
          <>
            <article className="rounded-3xl bg-white p-5 shadow-card">
              <h2 className="text-lg font-semibold text-slate-900">
                Seus dados cadastrados
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <p><span className="font-medium text-slate-800">Nome:</span> {data.passageiro.nome}</p>
                <p><span className="font-medium text-slate-800">Documento:</span> {data.passageiro.documento}</p>
                <p><span className="font-medium text-slate-800">Nascimento:</span> {data.passageiro.data_nascimento}</p>
                <p><span className="font-medium text-slate-800">Telefone:</span> {data.passageiro.telefone}</p>
                <p className="sm:col-span-2">
                  <span className="font-medium text-slate-800">Emergência:</span> {data.passageiro.contato_emergencia}
                </p>
              </div>
            </article>

            <article className="rounded-3xl bg-white p-5 shadow-card">
              <h2 className="text-lg font-semibold text-slate-900">
                Suas poltronas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Viagens em que você foi alocado pelo administrador.
              </p>

              {data.assentos.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Você ainda não foi alocado em nenhuma poltrona.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.assentos.map((assento) => (
                    <div
                      key={assento.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {assento.viagem.titulo}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {assento.viagem.origem} → {assento.viagem.destino}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="block text-2xl font-bold text-slate-900">
                            {assento.numero}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {assento.andar === "inferior" ? "Andar inferior" : "Andar superior"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-800">Partida:</span>{" "}
                          {new Date(assento.viagem.data_partida).toLocaleString("pt-BR")}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">Status:</span>{" "}
                          {assento.viagem.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default MySeatsPage;
