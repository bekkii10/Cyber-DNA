from pydantic_settings import BaseSettings
from typing import Optional
from urllib.parse import quote_plus

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cyber-DNA Platform API"
    API_V1_STR: str = "/api"
    
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    
    DATABASE_URI: str = "sqlite:///./cyberdna.db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.POSTGRES_SERVER and self.POSTGRES_USER and self.POSTGRES_DB:
            encoded_password = quote_plus(self.POSTGRES_PASSWORD) if self.POSTGRES_PASSWORD else ""
            return f"postgresql://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"
        return self.DATABASE_URI

    class Config:
        env_file = ".env"

settings = Settings()
