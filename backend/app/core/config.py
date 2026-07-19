from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Travel Seat Manager API"
    app_env: str = "development"
    enable_docs: bool = True
    secret_key: str = "change-this-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    database_url: str = "postgresql+psycopg2://travel_user:travel_password@postgres:5432/travel_manager"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    trusted_hosts: str = "localhost,127.0.0.1"
    trusted_proxies: str = ""
    max_page_size: int = 50
    default_page_size: int = 10
    login_rate_limit_per_minute: int = 5
    login_username_rate_limit_per_minute: int = 5
    setup_rate_limit_per_minute: int = 5
    authenticated_read_rate_limit_per_minute: int = 60
    authenticated_write_rate_limit_per_minute: int = 20
    idempotency_ttl_minutes: int = 10
    refresh_cookie_name: str = "travel_refresh_token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None
    default_admin_username: str = "admin"
    default_admin_email: str = "admin@example.com"
    default_admin_password: str = "Admin123!"
    max_sessions_per_user: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.frontend_url and self.frontend_url not in origins:
            origins.append(self.frontend_url)
        return origins

    @property
    def trusted_proxies_set(self) -> set[str]:
        return {p.strip() for p in self.trusted_proxies.split(",") if p.strip()}


settings = Settings()


def validate_settings() -> None:
    placeholder_keys = {"change-this-in-production", "admin", "secret", ""}
    if settings.secret_key in placeholder_keys or len(settings.secret_key) < 32:
        raise RuntimeError(
            "SECRET_KEY is insecure: set a random value of at least 32 characters. "
            "Generate one with: python3 -c \"import secrets; print(secrets.token_hex(64))\""
        )

    placeholder_passwords = {"Admin123!", "Admin123", "admin", "password", ""}
    if settings.app_env == "production" and settings.default_admin_password in placeholder_passwords:
        raise RuntimeError(
            "DEFAULT_ADMIN_PASSWORD must be changed before deploying to production."
        )
