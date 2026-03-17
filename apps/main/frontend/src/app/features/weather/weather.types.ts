export interface Weather {
  city: string;
  country: string;
  temperature_celsius: number;
  feels_like_celsius: number;
  humidity: number;
  description: string;
  wind_speed_mps: number;
  icon: string;
}

export interface ForecastDay {
  date: string;
  temperature_min: number;
  temperature_max: number;
  description: string;
  icon: string;
}

export interface Forecast {
  city: string;
  country: string;
  days: ForecastDay[];
}
