from pydantic import BaseModel, Field


class WeatherResponse(BaseModel):
    """Current weather data for a city."""

    city: str
    country: str
    temperature_celsius: float
    feels_like_celsius: float
    humidity: int = Field(ge=0, le=100)
    description: str
    wind_speed_mps: float
    icon: str


class ForecastDay(BaseModel):
    """Single day forecast entry."""

    date: str
    temperature_min: float
    temperature_max: float
    description: str
    icon: str


class ForecastResponse(BaseModel):
    """Multi-day weather forecast for a city."""

    city: str
    country: str
    days: list[ForecastDay]
