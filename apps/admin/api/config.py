import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    app_name: str = Field(default="Jernkorset API", description="Application name")
    app_version: str = Field(default="1.0.0", description="API version")
    debug: bool = Field(default=False, description="Debug mode")

    # Data paths
    data_dir: Path = Field(
        default_factory=lambda: Path(__file__).parent.parent / "data",
        description="Directory containing CSV data files",
    )
    letters_file: str = Field(
        default="placed_letters.csv", description="Letters CSV filename"
    )
    places_file: str = Field(
        default="places_cleanup.csv", description="Places CSV filename"
    )

    # Anthropic API
    anthropic_api_key: Optional[str] = Field(
        default=None, description="Anthropic API key"
    )

    # CORS
    cors_origins: list[str] = Field(default=["*"], description="Allowed CORS origins")

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log format string",
    )

    @property
    def letters_path(self) -> Path:
        """Full path to the letters CSV file."""
        return self.data_dir / self.letters_file

    @property
    def places_path(self) -> Path:
        """Full path to the places CSV file."""
        return self.data_dir / self.places_file

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
