"""Third-party API client for OpenWeatherMap.

Encapsulates all HTTP communication with the external service.
This is the integration boundary — the rest of the feature
depends only on typed dicts/schemas, never on raw HTTP details.
"""

from typing import Any

import httpx

from core.config import settings

_BASE_URL = "https://api.openweathermap.org/data/2.5"


class WeatherApiError(Exception):
    """Raised when the third-party weather API returns an error."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class WeatherClient:
    """HTTP client for OpenWeatherMap API."""

    def __init__(self) -> None:
        self.api_key = settings.openweathermap_api_key

    async def get_current(self, city: str) -> dict[str, Any]:
        """Fetch current weather for a city."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{_BASE_URL}/weather",
                params={
                    "q": city,
                    "appid": self.api_key,
                    "units": "metric",
                },
                timeout=10.0,
            )
        if response.status_code != 200:
            raise WeatherApiError(
                status_code=response.status_code,
                detail=f"Weather API error: {response.text}",
            )
        return response.json()

    async def get_forecast(self, city: str) -> dict[str, Any]:
        """Fetch 5-day forecast for a city."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{_BASE_URL}/forecast",
                params={
                    "q": city,
                    "appid": self.api_key,
                    "units": "metric",
                },
                timeout=10.0,
            )
        if response.status_code != 200:
            raise WeatherApiError(
                status_code=response.status_code,
                detail=f"Weather API error: {response.text}",
            )
        return response.json()
