import { useState } from 'react';
import { Button } from '@aspect/react-ui';
import { api } from '../core/api';
import type { Weather as WeatherData, Forecast } from '../core/api.types';

export default function Weather() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (type: 'weather' | 'forecast') => {
    const trimmed = city.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      if (type === 'weather') {
        setWeather(await api.getWeather(trimmed));
      } else {
        setForecast(await api.getForecast(trimmed));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-lg flex flex-col gap-lg" style={{ maxWidth: '40rem' }}>
      <h1 className="text-2xl font-bold">Weather</h1>
      <div className="flex gap-sm">
        <input className="input-base" placeholder="Enter city" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search('weather'); }} style={{ flex: 1 }} />
        <Button onClick={() => void search('weather')} disabled={loading}>Weather</Button>
        <Button variant="outline" onClick={() => void search('forecast')} disabled={loading}>Forecast</Button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {weather && (
        <div className="card">
          <h2 className="card-title">{weather.city}, {weather.country}</h2>
          <p>{weather.description}</p>
          <p className="text-2xl font-bold">{weather.temperature_celsius}°C</p>
          <p className="text-sm text-muted-foreground">Feels like {weather.feels_like_celsius}°C · Humidity {weather.humidity}% · Wind {weather.wind_speed_mps} m/s</p>
        </div>
      )}
      {forecast && (
        <div className="card">
          <h2 className="card-title">{forecast.city} — 5-Day Forecast</h2>
          <div className="grid gap-sm" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {forecast.days.map((day) => (
              <div key={day.date} className="p-sm text-center">
                <p className="text-sm font-bold">{day.date}</p>
                <p className="text-sm">{day.description}</p>
                <p className="text-sm">{day.temperature_min}° / {day.temperature_max}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
