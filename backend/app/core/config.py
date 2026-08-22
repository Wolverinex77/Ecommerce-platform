from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 900
    safepay_api_key: str
    safepay_merchant_key: str = "sec_0dd8d926-3c4a-4d00-b916-65e21c0c94eb"
    safepay_webhook_secret: str = "ed1334db6c5b43579e1f2ed0faa9e2aa3dff46b15c4ebca0d6f574902989abd8"
    database_url: str = "postgresql://postgres:7002@localhost/E-Commerce"

    model_config = SettingsConfigDict(
        env_file="app/core/.env",
        extra="ignore"
    )

settings = Settings() #type:ignore