import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WeatherStore } from './weather.store';

@Component({
  selector: 'app-weather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="weather-search">
      <input
        type="text"
        placeholder="Enter city name..."
        [ngModel]="cityInput()"
        (ngModelChange)="cityInput.set($event)"
        (keyup.enter)="search()"
      />
      <button (click)="search()">Get Weather</button>
      <button (click)="searchForecast()">Get Forecast</button>
    </div>

    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as error) {
      <p class="error">{{ error }}</p>
    }

    @if (store.weather(); as w) {
      <div class="weather-card">
        <h2>{{ w.city }}, {{ w.country }}</h2>
        <p class="temp">{{ w.temperature_celsius }}&deg;C</p>
        <p>Feels like {{ w.feels_like_celsius }}&deg;C</p>
        <p>{{ w.description }}</p>
        <p>Humidity: {{ w.humidity }}% &middot; Wind: {{ w.wind_speed_mps }} m/s</p>
      </div>
    }

    @if (store.forecast(); as f) {
      <div class="forecast">
        <h2>{{ f.city }}, {{ f.country }} — 5-Day Forecast</h2>
        @for (day of f.days; track day.date) {
          <div class="forecast-day">
            <strong>{{ day.date }}</strong>
            <span>{{ day.temperature_min }}&deg; / {{ day.temperature_max }}&deg;C</span>
            <span>{{ day.description }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class WeatherComponent {
  protected readonly store = inject(WeatherStore);
  protected readonly cityInput = signal('');

  search(): void {
    const city = this.cityInput().trim();
    if (city) {
      this.store.loadWeather(city);
    }
  }

  searchForecast(): void {
    const city = this.cityInput().trim();
    if (city) {
      this.store.loadForecast(city);
    }
  }
}
