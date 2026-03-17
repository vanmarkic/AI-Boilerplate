"""Tests for weather third-party integration.

Uses unittest.mock to patch the external API client so tests
run without network access or a real API key.
"""

from unittest.mock import AsyncMock, patch

import pytest

from features.weather.weather_client import WeatherApiError, WeatherClient
from features.weather.weather_service import WeatherService

MOCK_CURRENT_RESPONSE: dict = {
    "name": "London",
    "sys": {"country": "GB"},
    "main": {"temp": 15.2, "feels_like": 14.0, "humidity": 72},
    "weather": [{"description": "scattered clouds", "icon": "03d"}],
    "wind": {"speed": 5.1},
}

MOCK_FORECAST_RESPONSE: dict = {
    "city": {"name": "London", "country": "GB"},
    "list": [
        {
            "dt_txt": "2026-03-17 12:00:00",
            "main": {"temp_min": 10.0, "temp_max": 16.0},
            "weather": [{"description": "light rain", "icon": "10d"}],
        },
        {
            "dt_txt": "2026-03-18 12:00:00",
            "main": {"temp_min": 8.0, "temp_max": 14.0},
            "weather": [{"description": "clear sky", "icon": "01d"}],
        },
    ],
}


@pytest.fixture()
def weather_client() -> WeatherClient:
    with patch.object(WeatherClient, "__init__", lambda self: None):
        client = WeatherClient()
        client.api_key = "test-key"
        return client


@pytest.fixture()
def weather_service(weather_client: WeatherClient) -> WeatherService:
    return WeatherService(client=weather_client)


class TestGetCurrentWeather:
    async def test_returns_mapped_weather(
        self, weather_service: WeatherService
    ) -> None:
        weather_service.client.get_current = AsyncMock(
            return_value=MOCK_CURRENT_RESPONSE
        )
        result = await weather_service.get_current_weather("London")
        assert result.city == "London"
        assert result.country == "GB"
        assert result.temperature_celsius == 15.2
        assert result.humidity == 72
        assert result.description == "scattered clouds"

    async def test_propagates_api_error(
        self, weather_service: WeatherService
    ) -> None:
        weather_service.client.get_current = AsyncMock(
            side_effect=WeatherApiError(404, "City not found")
        )
        with pytest.raises(WeatherApiError, match="City not found"):
            await weather_service.get_current_weather("FakeCity")


class TestGetForecast:
    async def test_returns_mapped_forecast(
        self, weather_service: WeatherService
    ) -> None:
        weather_service.client.get_forecast = AsyncMock(
            return_value=MOCK_FORECAST_RESPONSE
        )
        result = await weather_service.get_forecast("London")
        assert result.city == "London"
        assert len(result.days) == 2
        assert result.days[0].date == "2026-03-17"
        assert result.days[1].description == "clear sky"

    async def test_deduplicates_same_day_entries(
        self, weather_service: WeatherService
    ) -> None:
        data = {
            **MOCK_FORECAST_RESPONSE,
            "list": [
                MOCK_FORECAST_RESPONSE["list"][0],
                {
                    **MOCK_FORECAST_RESPONSE["list"][0],
                    "dt_txt": "2026-03-17 18:00:00",
                },
            ],
        }
        weather_service.client.get_forecast = AsyncMock(return_value=data)
        result = await weather_service.get_forecast("London")
        assert len(result.days) == 1
