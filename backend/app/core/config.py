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
    trusted_hosts: str = "localhost,127.0.0.1"
    max_page_size: int = 50
    default_page_size: int = 10
    login_rate_limit_per_minute: int = 5
    login_username_rate_limit_per_minute: int = 5
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]


settings = Settings()
