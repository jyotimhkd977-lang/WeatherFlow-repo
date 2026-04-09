const WEATHERFLOW_STORAGE_KEY = "weatherflow_api_key";
const DEFAULT_CITY = "Seoul";

const elements = {
  searchForm: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  cityName: document.getElementById("cityName"),
  todayLabel: document.getElementById("todayLabel"),
  weatherDescription: document.getElementById("weatherDescription"),
  weatherMood: document.getElementById("weatherMood"),
  temperatureValue: document.getElementById("temperatureValue"),
  highTemp: document.getElementById("highTemp"),
  lowTemp: document.getElementById("lowTemp"),
  humidityValue: document.getElementById("humidityValue"),
  windValue: document.getElementById("windValue"),
  feelsLikeValue: document.getElementById("feelsLikeValue"),
  conditionHeadline: document.getElementById("conditionHeadline"),
  conditionText: document.getElementById("conditionText"),
  forecastStrip: document.getElementById("forecastStrip"),
  temperatureWrap: document.getElementById("temperatureWrap"),
  weatherIcon: document.getElementById("weatherIcon"),
};

function getApiKey() {
  const configuredKey =
    window.WEATHERFLOW_API_KEY &&
    window.WEATHERFLOW_API_KEY !== "YOUR_OPENWEATHERMAP_API_KEY"
      ? window.WEATHERFLOW_API_KEY
      : "";
  return localStorage.getItem(WEATHERFLOW_STORAGE_KEY) || configuredKey;
}

function saveApiKey() {
  const currentKey = getApiKey();
  const input = window.prompt("Enter your OpenWeatherMap API key", currentKey);

  if (input === null) {
    return;
  }

  const trimmedKey = input.trim();

  if (!trimmedKey) {
    localStorage.removeItem(WEATHERFLOW_STORAGE_KEY);
    updateStatus("API key removed");
    return;
  }

  localStorage.setItem(WEATHERFLOW_STORAGE_KEY, trimmedKey);
  updateStatus("API key saved");
  loadWeather(elements.cityInput.value.trim() || DEFAULT_CITY);
}

function updateStatus(label) {
  elements.weatherMood.textContent = label;
}

function getWeatherIconUrl(iconCode) {
  return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
}

function getCityShiftedDate(timestampSeconds, timezoneOffsetSeconds) {
  return new Date((timestampSeconds + timezoneOffsetSeconds) * 1000);
}

function formatDateTime(timezoneOffsetSeconds) {
  const now = new Date();
  const localTime = new Date(now.getTime() + timezoneOffsetSeconds * 1000);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(localTime);
}

function toTitleCase(text) {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeConditions(weatherMain, temp) {
  const rules = [
    {
      match: ["Thunderstorm"],
      headline: "Storm energy in the air.",
      text: "Expect an unsettled sky and keep an umbrella nearby for sudden downpours.",
    },
    {
      match: ["Drizzle", "Rain"],
      headline: "Soft rain moving through.",
      text: "Roads may stay slick, so it is a good moment for light layers and a slower pace.",
    },
    {
      match: ["Snow"],
      headline: "A crisp winter scene.",
      text: "Cold air is holding on, so bundle up and watch for slippery surfaces.",
    },
    {
      match: ["Clear"],
      headline: temp >= 28 ? "Bright skies and warm light." : "Clear sky, easy rhythm.",
      text:
        temp >= 28
          ? "Sunshine is strong today, which makes breathable clothing and hydration a smart choice."
          : "The sky is open and calm, ideal for a comfortable day outside.",
    },
    {
      match: ["Clouds", "Mist", "Fog", "Haze"],
      headline: "Muted sky, steady atmosphere.",
      text: "Cloud cover keeps the mood soft and balanced, with a gentle feel across the day.",
    },
  ];

  const summary = rules.find((rule) => rule.match.includes(weatherMain));
  return (
    summary || {
      headline: "Weather is flowing in real time.",
      text: "Current conditions are updating live so you can plan the next few hours with confidence.",
    }
  );
}

function animateTemperature() {
  elements.temperatureWrap.classList.remove("animate");
  window.requestAnimationFrame(() => {
    elements.temperatureWrap.classList.add("animate");
  });
}

function buildForecastCards(list, timezoneOffsetSeconds) {
  const groupedDays = list.reduce((accumulator, item) => {
    const shiftedDate = getCityShiftedDate(item.dt, timezoneOffsetSeconds);
    const dayKey = shiftedDate.toISOString().slice(0, 10);
    const localHour = shiftedDate.getUTCHours();

    if (!accumulator[dayKey]) {
      accumulator[dayKey] = {
        entries: [],
        representative: item,
        closestHourDistance: Math.abs(localHour - 12),
      };
    }

    accumulator[dayKey].entries.push(item);

    if (Math.abs(localHour - 12) < accumulator[dayKey].closestHourDistance) {
      accumulator[dayKey].representative = item;
      accumulator[dayKey].closestHourDistance = Math.abs(localHour - 12);
    }

    return accumulator;
  }, {});

  return Object.values(groupedDays)
    .slice(0, 5)
    .map((dayGroup, index) => {
      const item = dayGroup.representative;
      const date = getCityShiftedDate(item.dt, timezoneOffsetSeconds);
      const dayLabel = new Intl.DateTimeFormat("en-US", {
        weekday: index === 0 ? "long" : "short",
        timeZone: "UTC",
      }).format(date);
      const high = Math.round(
        Math.max(...dayGroup.entries.map((entry) => entry.main.temp_max))
      );
      const low = Math.round(
        Math.min(...dayGroup.entries.map((entry) => entry.main.temp_min))
      );

      return `
        <article class="forecast-card">
          <p class="forecast-day">${dayLabel}</p>
          <img
            class="forecast-icon"
            src="${getWeatherIconUrl(item.weather[0].icon)}"
            alt="${item.weather[0].description}"
          />
          <div class="forecast-temp">${Math.round(item.main.temp)}°</div>
          <p class="forecast-meta">${toTitleCase(item.weather[0].description)}</p>
          <p class="forecast-meta">H ${high}° · L ${low}°</p>
        </article>
      `;
    })
    .join("");
}

function updateWeatherUI(current, forecast) {
  const description = toTitleCase(current.weather[0].description);
  const summary = summarizeConditions(current.weather[0].main, current.main.temp);

  elements.cityName.textContent = `${current.name}, ${current.sys.country}`;
  elements.todayLabel.textContent = formatDateTime(current.timezone);
  elements.weatherDescription.textContent = description;
  elements.temperatureValue.textContent = Math.round(current.main.temp);
  elements.highTemp.textContent = `H: ${Math.round(current.main.temp_max)}°`;
  elements.lowTemp.textContent = `L: ${Math.round(current.main.temp_min)}°`;
  elements.humidityValue.textContent = `${current.main.humidity}%`;
  elements.windValue.textContent = `${current.wind.speed.toFixed(1)} m/s`;
  elements.feelsLikeValue.textContent = `${Math.round(current.main.feels_like)}°C`;
  elements.conditionHeadline.textContent = summary.headline;
  elements.conditionText.textContent = summary.text;
  updateStatus(current.weather[0].main);

  elements.weatherIcon.hidden = false;
  elements.weatherIcon.src = getWeatherIconUrl(current.weather[0].icon);
  elements.weatherIcon.alt = description;

  elements.cityInput.value = current.name;
  elements.forecastStrip.innerHTML = buildForecastCards(
    forecast.list,
    forecast.city.timezone
  );
  animateTemperature();
}

function renderError(message) {
  elements.cityName.textContent = "WeatherFlow";
  elements.todayLabel.textContent = "Unable to load weather";
  elements.weatherDescription.textContent = message;
  elements.temperatureValue.textContent = "--";
  elements.highTemp.textContent = "H: --°";
  elements.lowTemp.textContent = "L: --°";
  elements.humidityValue.textContent = "--%";
  elements.windValue.textContent = "-- m/s";
  elements.feelsLikeValue.textContent = "--°C";
  elements.conditionHeadline.textContent = "A quick check is needed.";
  elements.conditionText.textContent =
    "Confirm the city name and API key, then try again.";
  elements.forecastStrip.innerHTML =
    '<div class="forecast-placeholder">Forecast unavailable right now.</div>';
  elements.weatherIcon.hidden = true;
  updateStatus("Needs attention");
}

async function fetchWeatherByCity(city, apiKey) {
  const encodedCity = encodeURIComponent(city);
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodedCity}&appid=${apiKey}&units=metric`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodedCity}&appid=${apiKey}&units=metric`;

  const [currentResponse, forecastResponse] = await Promise.all([
    fetch(currentUrl),
    fetch(forecastUrl),
  ]);

  if (!currentResponse.ok || !forecastResponse.ok) {
    const currentError = await currentResponse.json().catch(() => ({}));
    const forecastError = await forecastResponse.json().catch(() => ({}));
    const message =
      currentError.message || forecastError.message || "Unable to fetch weather data.";
    throw new Error(message);
  }

  return Promise.all([currentResponse.json(), forecastResponse.json()]);
}

async function loadWeather(city) {
  const apiKey = getApiKey();

  if (!apiKey) {
    renderError("Add your OpenWeatherMap API key to get started.");
    return;
  }

  updateStatus("Refreshing...");
  elements.weatherDescription.textContent = "Fetching the latest conditions...";

  try {
    const [current, forecast] = await fetchWeatherByCity(city, apiKey);
    updateWeatherUI(current, forecast);
  } catch (error) {
    renderError(toTitleCase(error.message));
  }
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = elements.cityInput.value.trim();

  if (!city) {
    elements.cityInput.focus();
    return;
  }

  loadWeather(city);
});

loadWeather(DEFAULT_CITY);
