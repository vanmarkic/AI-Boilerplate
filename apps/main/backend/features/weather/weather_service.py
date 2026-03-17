"""Weather service — maps raw API responses to domain schemas.

This layer isolates the rest of the app from the third-party API's
response shape. If the external API changes, only this file and
weather_client.py need updating.
"""

from typing import Any

from features.weather.weather_client import WeatherClient
from features.weather.weather_schema import (
    ForecastDay,
    ForecastResponse,
    WeatherResponse,
)


class WeatherService:
    def __init__(self, client: WeatherClient) -> None:
        self.client = client

    async def get_current_weather(self, city: str) -> WeatherResponse:
        """Get current weather, mapped to domain schema."""
        data = await self.client.get_current(city)
        return self._map_current(data)

    async def get_forecast(self, city: str) -> ForecastResponse:
        """Get multi-day forecast, mapped to domain schema."""
        data = await self.client.get_forecast(city)
        return self._map_forecast(data)

    @staticmethod
    def _map_current(data: dict[str, Any]) -> WeatherResponse:
        main = data["main"]
        weather = data["weather"][0]
        wind = data["wind"]
        return WeatherResponse(
            city=data["name"],
            country=data["sys"]["country"],
            temperature_celsius=main["temp"],
            feels_like_celsius=main["feels_like"],
            humidity=main["humidity"],
            description=weather["description"],
            wind_speed_mps=wind["speed"],
            icon=weather["icon"],
        )

    @staticmethod
    def _map_forecast(data: dict[str, Any]) -> ForecastResponse:
        seen_dates: set[str] = set()
        days: list[ForecastDay] = []
        for entry in data["list"]:
            date = entry["dt_txt"].split(" ")[0]
            if date in seen_dates:
                continue
            seen_dates.add(date)
            weather = entry["weather"][0]
            days.append(
                ForecastDay(
                    date=date,
                    temperature_min=entry["main"]["temp_min"],
                    temperature_max=entry["main"]["temp_max"],
                    description=weather["description"],
                    icon=weather["icon"],
                )
            )
            if len(days) >= 5:
                break
        return ForecastResponse(
            city=data["city"]["name"],
            country=data["city"]["country"],
            days=days,
        )
