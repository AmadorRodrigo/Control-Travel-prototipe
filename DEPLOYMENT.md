# Deploy e verificação de produção

## O que mudou

- Senhas novas exigem 8–128 caracteres, maiúscula, minúscula e número. O login continua aceitando senhas antigas.
- Recuperação por e-mail: token aleatório de 256 bits, somente SHA-256 no banco, expiração padrão de 30 minutos, uso único. Redefinir revoga todas as sessões e todos os outros links do usuário.
- Contas já vinculadas não podem mais trocar senha pelo primeiro acesso; devem usar **Esqueci minha senha**. Cadastro inicial de passageiro continua seguindo o fluxo existente.
- `POST /api/auth/forgot-password` recebe `{ "email": "..." }` e retorna mensagem genérica, mesmo para conta ausente/inativa. Limites retornam 429. Falhas SMTP são registradas sem endereço, senha ou token; não há fila persistente nem reenvio automático.
- `POST /api/auth/reset-password` recebe `{ "token": "...", "new_password": "..." }`. Token inválido, usado ou expirado retorna 400; senha inválida retorna 422.
- A migration `20260924_0005` adiciona `password_reset_tokens`; não altera dados existentes. O downgrade apaga essa tabela e seus links e não deve ser executado como rollback rotineiro.
- Limpeza de registros expirados no startup e a cada hora; buckets de rate limit a cada minuto. Execute migrations antes de iniciar a API.
- Pool explícito: 5 conexões + 10 de overflow, timeout 30 s, recycle 1800 s, por processo. O SQLAlchemy já tinha limites padrão; a mudança os torna explícitos.

## Render + Neon + SMTP

As instruções abaixo preparam o deploy. Não criam contas nem publicam automaticamente. Os nomes `SEU-FRONTEND` e `SEU-BACKEND` são placeholders que devem ser substituídos pelos domínios reais.

1. Crie um projeto PostgreSQL no Neon, na mesma região do backend quando possível. Copie a conexão com TLS e use o prefixo `postgresql+psycopg2://` em `DATABASE_URL`. Preserve `sslmode=require` e os parâmetros fornecidos pelo Neon; escape caracteres especiais da senha na URL. Nunca coloque essa URL em variáveis `VITE_*`.
2. Configure um remetente SMTP verificado. Para Resend, verifique um domínio de envio e crie uma API key. O domínio de e-mail é necessário mesmo usando o subdomínio padrão do Render para o site. Não confunda domínio do aplicativo com domínio do remetente.
3. Crie um **Web Service** Python no Render com o repositório deste projeto:

   | Campo | Valor |
   |---|---|
   | Root Directory | `backend` |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `sh start.sh` |
   | Health Check Path | `/health` |
   | Python | `PYTHON_VERSION=3.12.14` |
   | Instâncias/workers | 1 / 1 |

   O script aplica migrations e usa o `PORT` fornecido pelo Render. Não aumente workers/réplicas enquanto o limitador for em memória.

4. Configure estas variáveis no backend (valores secretos somente no dashboard):

   ```dotenv
   APP_ENV=production
   ENABLE_DOCS=false
   DATABASE_URL=<conexão Neon com TLS>
   SECRET_KEY=<valor aleatório com pelo menos 32 caracteres>
   DEFAULT_ADMIN_PASSWORD=<valor forte diferente do padrão>
   FRONTEND_URL=https://SEU-FRONTEND.onrender.com
   CORS_ORIGINS=https://SEU-FRONTEND.onrender.com
   RESET_PASSWORD_URL=https://SEU-FRONTEND.onrender.com/reset-password
   TRUSTED_HOSTS=SEU-BACKEND.onrender.com
   COOKIE_SECURE=true
   COOKIE_SAMESITE=none
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   REFRESH_TOKEN_EXPIRE_DAYS=7
   PASSWORD_RESET_EXPIRE_MINUTES=30
   PASSWORD_RESET_RATE_LIMIT_PER_MINUTE=5
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=2465
   SMTP_USE_SSL=true
   SMTP_USER=resend
   SMTP_PASSWORD=<API key Resend>
   SMTP_FROM=Control Travel <acesso@SEU-DOMINIO-VERIFICADO>
   SMTP_TIMEOUT_SECONDS=10
   ```

   Deixe `COOKIE_DOMAIN` sem definir para cookie restrito ao host da API. Gere o segredo localmente com `python3 -c 'import secrets; print(secrets.token_hex(64))'`. `DEFAULT_ADMIN_PASSWORD` é validada por compatibilidade com a configuração existente; a conta real é criada pela tela inicial, não por essa variável.

   Subdomínios diferentes de `onrender.com` podem ser tratados como sites distintos pelo navegador. `SameSite=None; Secure` permite cookies entre sites, mas navegadores que bloqueiam cookies de terceiros ainda podem impedir renovação. Para uso confiável, prefira domínio próprio com `app.exemplo.com` e `api.exemplo.com` (`COOKIE_SAMESITE=lax`) ou uma origem única com proxy `/api`. Atualize CORS, reset URL, hosts e CSP juntos. Refresh e logout agora validam `Origin`; com `SameSite=None`, clientes precisam enviar uma origem autorizada.

   Configure proxies confiáveis somente depois de confirmar o caminho de rede. `TRUSTED_PROXIES` aceita IPs exatos; não use `*`. Verifique que duas conexões externas reais recebem buckets distintos e que um `X-Forwarded-For` enviado pelo cliente não permite falsificar IP. Sem essa validação, o limite por IP pode ser compartilhado por todos atrás do proxy.

5. Crie um **Static Site**:

   | Campo | Valor |
   |---|---|
   | Root Directory | `frontend` |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |
   | `VITE_API_BASE_URL` | `https://SEU-BACKEND.onrender.com` (sem `/api` final) |
   | Rewrite | `/*` → `/index.html` |

   `VITE_API_BASE_URL` é aplicada no build: qualquer alteração exige novo build. Configure os headers do Static Site no dashboard:

   | Path | Header | Valor |
   |---|---|---|
   | `/*` | `X-Content-Type-Options` | `nosniff` |
   | `/*` | `X-Frame-Options` | `DENY` |
   | `/*` | `Referrer-Policy` | `no-referrer` |
   | `/*` | `Cache-Control` | `no-cache` |
   | `/assets/*` | `Cache-Control` | `public, max-age=31536000, immutable` |
   | `/reset-password` | `Cache-Control` | `no-store` |
   | `/*` | `Content-Security-Policy` | valor abaixo |

   ```text
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://SEU-BACKEND.onrender.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
   ```

   A CSP deve estar no HTML do frontend. Headers da API não protegem o documento em outra origem. Não registre query strings de `/reset-password` em logs/analytics, pois contêm o token. O frontend remove a query ao carregar e usa `no-referrer`, mas isso não remove logs já feitos pelo host.

6. Conclua o setup do administrador antes de expor o serviço a usuários. O endpoint inicial é público enquanto não existe administrador. Confirme envio real para uma conta sua, abra o link e tente reutilizá-lo. Nenhum e-mail real é enviado pelos testes automatizados.

## Docker em produção

Mantenha Docker como alternativa. Configure `.env` conforme `.env.example`, com HTTPS, SMTP, segredo forte, `CORS_ORIGINS=https://seu-dominio`, `RESET_PASSWORD_URL=https://seu-dominio/reset-password`, `TRUSTED_HOSTS=seu-dominio`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax` e **`VITE_API_BASE_URL=` vazio**. Coloque um terminador TLS à frente do Nginx; o Compose não emite certificados nem publica HTTPS sozinho.

```sh
docker compose -f docker-compose.prod.yml up --build -d
```

Nginx fornece CSP para a mesma origem, limite de corpo de 1 MB, cache imutável em `/assets/` e `no-store` para HTML. Modelos Pydantic limitam campos após receber o corpo; não substituem um limite de bytes no proxy. Para o backend nativo no Render, confirme o limite da borda ou adicione um proxy se necessário.

## Limites e operação

Consultado em 24/09/2026; confira os dashboards antes de contratar:

- [Render Free](https://render.com/docs/free): 750 horas/mês por workspace e suspensão após 15 minutos sem tráfego. O tempo de retomada varia; não prometa 30–50 segundos. O próprio Render posiciona o plano gratuito para projetos pessoais/testes. Bandwidth e build minutes dependem do plano do workspace, não assuma os antigos 100 GB. [Preços atuais](https://render.com/pricing).
- Render bloqueia SMTP em 25/465/587 no gratuito. [Resend documenta TLS implícito em 2465](https://resend.com/docs/send-with-smtp), fora dessa lista; valide conectividade no serviço real. Alternativamente, use um plano com SMTP permitido. Não desative TLS.
- [Neon Free](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md): 0,5 GB por projeto, 100 CU-horas/mês e 5 GB de transferência pública por projeto. Retenção de recuperação é limitada e depende do plano. Configure exportações/backups e teste restauração; não trate backup como concluído apenas por usar Neon.
- [Resend](https://resend.com/pricing): confirme a cota transacional no dashboard; a oferta gratuita divulgada é 3.000 e-mails/mês e 100/dia. A entrega depende do domínio verificado, reputação e limites do provedor.

Não foi demonstrada capacidade de 100 usuários concorrentes. O acesso autenticado consulta `users` no banco para validar `token_version`, e Argon2 consome memória por login simultâneo. Meça p95, CPU, RAM, conexões e taxa de 429 com a carga real, especialmente em 512 MB. O pool limita conexões, não garante capacidade. Reiniciar o processo limpa os rate limits; múltiplos workers exigem armazenamento compartilhado.

O envio SMTP é tarefa em processo após a resposta: reinício pode perder o envio; o usuário pode pedir outro link. Limpeza horária remove registros expirados; monitore crescimento se o volume mudar. `/health` verifica o processo, não disponibilidade do banco. Monitore logs de falha de SMTP/cleanup, latência, memória e espaço no banco.

Rollback de código: use o deploy anterior no Render, preservando a tabela nova (compatível com código antigo). Faça backup antes de futuras migrations destrutivas; não execute `alembic downgrade` automaticamente. Valide login, refresh, reset e um fluxo de reserva após cada deploy.

## Testes locais isolados

```sh
docker compose -p control-travel-readiness-test -f compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p control-travel-readiness-test -f compose.test.yml down
cd frontend
npm ci
npm run build
```

O banco de testes usa tmpfs e nome `control_travel_test`. O pytest recusa executar limpeza em outro banco. Testa tokens usados/expirados, reset simultâneo, revogação de sessões, mensagens genéricas, SMTP simulado, CORS/Origin, rate limits, senha forte e limpeza seletiva. Credenciais/serviços externos não são necessários. No primeiro comando, um código de saída diferente de zero indica falha.


Após gerar `frontend/dist`, execute o smoke test do Nginx a partir da raiz do repositório:

```sh
docker run --rm --add-host backend:127.0.0.1 \
  --mount "type=bind,source=$PWD/infra/nginx/frontend.conf,target=/etc/nginx/conf.d/default.conf,readonly" \
  --mount "type=bind,source=$PWD/infra/nginx/smoke-test.sh,target=/smoke-test.sh,readonly" \
  --mount "type=bind,source=$PWD/frontend/dist,target=/usr/share/nginx/html,readonly" \
  nginx:1.27-alpine sh /smoke-test.sh
```

## Resumo para revisão

**O que mudou:** recuperação de senha com migration e UI, política de senha, revogação de sessões, limites de conexão, limpeza periódica, rate limit de setup, cache/CSP no frontend e guia de deploy.

**Por quê:** permitir recuperação por e-mail e evitar reutilização de links/sessões, crescimento de registros expirados e configurações incompatíveis entre ambientes.

**Como testar:** comandos acima. Foram executados 31 testes de backend em PostgreSQL 16, build Vite, Ruff e smoke test Nginx. Também foram verificados os fluxos de login/recuperação/reset em Chrome com Playwright e API simulada. Os testes de UI não enviaram e-mails nem alteraram contas reais.

**Impacto:** uma tabela nova; senha forte apenas em criação/alteração; primeiro acesso deixa de redefinir contas existentes; CORS passa a ser explícito; produção exige HTTPS/cookies seguros e SMTP; um único worker. Dependências de runtime permanecem iguais. Testes usam pytest/httpx/Ruff separados. Deploy público, entrega real de e-mail e capacidade de 100 usuários ainda exigem validação no ambiente final.

Sugestões de commits:

- `feat(auth): add secure email password recovery`
- `fix(production): bound resources and document deployment`
