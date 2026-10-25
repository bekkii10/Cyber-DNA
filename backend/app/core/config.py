from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from urllib.parse import quote_plus
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cyber-DNA Platform API"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    DATABASE_URI: str = "sqlite:///./cyberdna.db"
    ML_MODEL_PATH: str = "models/cyberdna_v25_isolation_forest.joblib"
    ML_CONFIG_PATH: str = "models/cyberdna_v25_config.json"
    ML_ENABLED: bool = True
    ML_WINDOW_MINUTES: int = 60
    AI_PROVIDER: str = "openai"
    AI_MODEL: str = "gpt-6-luna"
    OPENAI_API_KEY: Optional[str] = None
    CYBERDNA_BOOTSTRAP_SECRET: Optional[str] = None
    CYBERDNA_COOKIE_SECURE: bool = False
    AI_TIMEOUT_SECONDS: float = 30.0
    AI_MAX_HISTORY: int = 8
    AI_MAX_RECORDS: int = 25

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.POSTGRES_SERVER and self.POSTGRES_USER and self.POSTGRES_DB:
            encoded_password = quote_plus(self.POSTGRES_PASSWORD) if self.POSTGRES_PASSWORD else ""
            return f"postgresql://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"
        return self.DATABASE_URI

    # Resolve .env relative to the backend package, not the shell working directory.
    model_config = SettingsConfigDict(env_file=str(Path(__file__).resolve().parents[2] / ".env"), extra="ignore")

settings = Settings()
