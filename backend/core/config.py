from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CodeMentor API"
    debug: bool = False
    frontend_url: str = "http://localhost:3000"

    database_url: str = ""
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_jwt_secret: str = ""
    openrouter_api_key: str = ""
    piston_url: str = "http://localhost:2000/api/v2/execute"


settings = Settings()
