# Travel Seat Manager

Boilerplate full stack para controle de viagens sem venda, cadastro de viajantes, autenticação segura, gestão de assentos por andar e reserva com proteção de concorrência.

## Estrutura

```text
.
├── backend
│   ├── alembic
│   │   ├── versions
│   │   │   └── 20260624_0001_initial_schema.py
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── app
│   │   ├── core
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── http.py
│   │   │   ├── rate_limit.py
│   │   │   └── security.py
│   │   ├── routes
│   │   │   ├── auth.py
│   │   │   ├── passageiros.py
│   │   │   └── viagens.py
│   │   ├── dependencies.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── alembic.ini
│   └── requirements.txt
├── frontend
│   ├── src
│   │   ├── components
│   │   │   ├── AppHeader.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context
│   │   │   └── AuthContext.jsx
│   │   ├── pages
│   │   │   ├── LoginPage.jsx
│   │   │   ├── PassengersPage.jsx
│   │   │   └── TripsPage.jsx
│   │   ├── services
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── infra
│   └── nginx
│       └── frontend.conf
├── .env
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Como subir em desenvolvimento

1. Ajuste o arquivo `.env`.
2. Execute `docker compose up --build`.
3. O backend aplica `alembic upgrade head` antes de iniciar.
4. Acesse o frontend em `http://localhost:5173`.
5. Acesse a API em `http://localhost:8000/docs`.

## Como subir em produção

1. Revise `.env` com `ENABLE_DOCS=false` e `COOKIE_SECURE=true` se estiver usando HTTPS.
2. Execute `docker compose -f docker-compose.prod.yml up --build -d`.
3. O frontend sobe em `Nginx` e faz proxy de `/api` para o backend.

## Credenciais iniciais

- Usuário: valor de `DEFAULT_ADMIN_USERNAME`
- Senha: valor de `DEFAULT_ADMIN_PASSWORD`

## O que é Alembic

`Alembic` é a ferramenta de migrations do ecossistema `SQLAlchemy`. Em vez de depender de `Base.metadata.create_all()` ou recriar o banco quando o modelo muda, você versiona cada alteração de schema em arquivos de migration.

Na prática, ele resolve problemas como:
- adicionar coluna sem apagar dados
- criar tabela nova de forma controlada
- ajustar índices e constraints com histórico
- sincronizar ambientes `dev`, `staging` e `produção`

### Como funciona no projeto

- Os modelos vivem em `backend/app/models.py`.
- As migrations vivem em `backend/alembic/versions`.
- O arquivo `backend/alembic/env.py` conecta o Alembic à configuração do projeto.
- A migration inicial já cria `users`, `passageiros`, `viagens`, `assentos`, `idempotency_keys` e `refresh_sessions`.

### Comandos úteis

- Criar nova migration: `cd backend && alembic revision --autogenerate -m "descricao_da_mudanca"`
- Aplicar migrations: `cd backend && alembic upgrade head`
- Voltar uma migration: `cd backend && alembic downgrade -1`
- Ver histórico: `cd backend && alembic history`

## Funcionalidades já aplicadas

- Login com `JWT access token`.
- `Refresh token` em cookie `HttpOnly` com rotação e revogação em logout.
- Endpoint `GET /api/auth/me` para recuperar o usuário autenticado.
- `Rate limiting` em memória por IP e por usuário.
- `Idempotency-Key` no cadastro de passageiros.
- Paginação com limite máximo configurável.
- Módulo de viagens com geração automática de assentos por andar.
- Reserva de assento com `SELECT ... FOR UPDATE` para reduzir disputa simultânea.
- `GZip`, `TrustedHostMiddleware` e headers de segurança.

## Segurança aplicada

- `POST /api/auth/login`: limite por IP e username.
- `POST /api/auth/refresh`: refresh token validado, rotacionado e associado a sessão persistida.
- `POST /api/auth/logout`: revoga a sessão de refresh atual.
- `GET /api/passageiros` e `GET /api/viagens`: limites por usuário e IP.
- `POST /api/passageiros`: idempotência + `unique constraint` em `documento`.
- `POST /api/viagens/{id}/assentos/reservar`: trava otimista via banco para evitar corrida de reserva.
- Frontend com bloqueio de múltiplos envios em login, cadastro e reserva.

## Baixo custo em produção

- O `rate limit` atual é em memória, ideal para uma única instância e baixo custo.
- Se houver escala horizontal, migre o limitador para `Redis`.
- O frontend de produção usa `Nginx` estático, reduzindo consumo de CPU e memória.
- O backend usa `gunicorn` com `uvicorn worker`, suficiente para cargas iniciais pequenas e médias.
- O `PostgreSQL` continua isolado em container dedicado com volume persistente.

## Próximas evoluções recomendadas

- Adicionar testes automatizados de API e interface.
- Incluir `Redis` ao escalar para múltiplas réplicas.
- Criar trilha de auditoria por reserva, remarcação e cancelamento.
- Implementar refresh token por dispositivo, com tela de sessões ativas.
- Adicionar observabilidade com métricas, tracing e alertas.
