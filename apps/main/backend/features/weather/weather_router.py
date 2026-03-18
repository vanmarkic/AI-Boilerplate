from fastapi import APIRouter, Depends, Path

from core.dependencies import get_weather_service
from features.weather.weather_schema import ForecastResponse, WeatherResponse
from features.weather.weather_service import WeatherService

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get(
    "/{city}",
    response_model=WeatherResponse,
    operation_id="getCurrentWeather",
)
async def get_current_weather(
    city: str = Path(min_length=1, max_length=100),
    service: WeatherService = Depends(get_weather_service),
) -> WeatherResponse:
    """Get current weather for a city via OpenWeatherMap."""
    return await service.get_current_weather(city)


@router.get(
    "/{city}/forecast",
    response_model=ForecastResponse,
    operation_id="getWeatherForecast",
)
async def get_weather_forecast(
    city: str = Path(min_length=1, max_length=100),
    service: WeatherService = Depends(get_weather_service),
) -> ForecastResponse:
    """Get 5-day weather forecast for a city."""
    return await service.get_forecast(city)
