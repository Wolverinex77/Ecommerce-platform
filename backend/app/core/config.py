from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 900

    safepay_api_key: str
    safepay_merchant_key: str
    safepay_webhook_secret: str

    database_url: str

    model_config = SettingsConfigDict(
        env_file="app/core/.env",
        extra="ignore"
    )


settings = Settings() #type:ignore