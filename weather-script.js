// OpenWeatherMap API Configuration
const API_KEY = '1472b0f2b01f24206cdfde6a32d4826d'; // Free API Key (limited requests)
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const errorMessage = document.getElementById('errorMessage');
const currentWeatherSection = document.getElementById('currentWeather');
const forecastSection = document.getElementById('forecastSection');
const hourlySection = document.getElementById('hourlySection');
const loadingSpinner = document.getElementById('loadingSpinner');
const recentList = document.getElementById('recentList');

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
locationBtn.addEventListener('click', handleGeolocation);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});

// Load Recent Searches from LocalStorage
function loadRecentSearches() {
  const recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
  recentList.innerHTML = '';
  
  if (recent.length === 0) {
    recentList.innerHTML = '<p style="color: #7f8c8d;">No recent searches</p>';
    return;
  }

  recent.forEach(city => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.textContent = city;
    item.addEventListener('click', () => {
      searchInput.value = city;
      handleSearch();
    });
    recentList.appendChild(item);
  });
}

// Save Search to LocalStorage
function saveSearch(city) {
  let recent = JSON.parse(localStorage.getItem('recentSearches')) || [];
  recent = recent.filter(c => c.toLowerCase() !== city.toLowerCase());
  recent.unshift(city);
  recent = recent.slice(0, 5); // Keep only last 5 searches
  localStorage.setItem('recentSearches', JSON.stringify(recent));
  loadRecentSearches();
}

// Handle Search
function handleSearch() {
  const city = searchInput.value.trim();
  if (!city) {
    showError('Please enter a city name');
    return;
  }
  fetchWeatherByCity(city);
}

// Handle Geolocation
function handleGeolocation() {
  if ('geolocation' in navigator) {
    showLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      () => {
        showError('Unable to access your location. Please enable location permissions.');
        showLoading(false);
      }
    );
  } else {
    showError('Geolocation is not supported by your browser');
  }
}

// Fetch Weather by City Name
async function fetchWeatherByCity(city) {
  try {
    showLoading(true);
    hideError();

    // Get coordinates from city name
    const geoResponse = await fetch(
      `${GEO_URL}/direct?q=${city}&limit=1&appid=${API_KEY}`
    );
    const geoData = await geoResponse.json();

    if (!geoData.length) {
      showError('City not found. Please try again.');
      showLoading(false);
      return;
    }

    const { lat, lon, name, state, country } = geoData[0];
    fetchWeatherByCoords(lat, lon, `${name}${state ? ', ' + state : ''}, ${country}`);
    saveSearch(city);
  } catch (error) {
    showError('Failed to fetch weather data. Please try again.');
    console.error('Error:', error);
    showLoading(false);
  }
}

// Fetch Weather by Coordinates
async function fetchWeatherByCoords(latitude, longitude, cityName = null) {
  try {
    showLoading(true);
    hideError();

    // Current Weather
    const currentResponse = await fetch(
      `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
    );
    const currentData = await currentResponse.json();

    if (!currentResponse.ok) {
      showError('Failed to fetch weather data');
      showLoading(false);
      return;
    }

    // Forecast
    const forecastResponse = await fetch(
      `${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
    );
    const forecastData = await forecastResponse.json();

    // One Call API for UV Index (if available with your API key tier)
    let uvIndex = 'N/A';
    try {
      const uvResponse = await fetch(
        `${BASE_URL}/uvi?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`
      );
      const uvData = await uvResponse.json();
      uvIndex = uvData.value ? uvData.value.toFixed(1) : 'N/A';
    } catch (e) {
      console.log('UV Index not available');
    }

    // Update UI
    updateCurrentWeather(currentData, uvIndex);
    updateForecast(forecastData);
    updateHourlyForecast(forecastData);
    showLoading(false);
  } catch (error) {
    showError('Failed to fetch weather data. Please try again.');
    console.error('Error:', error);
    showLoading(false);
  }
}

// Update Current Weather Display
function updateCurrentWeather(data, uvIndex) {
  const { name, sys, main, weather, wind, clouds, visibility } = data;
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  document.getElementById('cityName').textContent = name + (sys.country ? ', ' + sys.country : '');
  document.getElementById('weatherDate').textContent = date;
  document.getElementById('temperature').textContent = Math.round(main.temp);
  document.getElementById('weatherDescription').textContent = weather[0].main + ' - ' + weather[0].description;
  document.getElementById('feelsLike').textContent = `Feels like ${Math.round(main.feels_like)}°C`;
  document.getElementById('humidity').textContent = main.humidity + '%';
  document.getElementById('windSpeed').textContent = (wind.speed * 3.6).toFixed(1) + ' km/h';
  document.getElementById('pressure').textContent = main.pressure + ' hPa';
  document.getElementById('visibility').textContent = (visibility / 1000).toFixed(1) + ' km';
  document.getElementById('clouds').textContent = clouds.all + '%';
  document.getElementById('uvIndex').textContent = uvIndex;

  // Weather Icon
  const iconCode = weather[0].icon;
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
  document.getElementById('weatherIcon').src = iconUrl;

  currentWeatherSection.classList.remove('hidden');
}

// Update 5-Day Forecast
function updateForecast(data) {
  const forecastContainer = document.getElementById('forecastContainer');
  forecastContainer.innerHTML = '';

  // Get forecast for every 8th item (24-hour intervals)
  const dailyForecasts = data.list.filter((item, index) => index % 8 === 0).slice(0, 5);

  dailyForecasts.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const iconUrl = `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`;
    const temp = Math.round(item.main.temp);
    const desc = item.weather[0].main;

    const forecastCard = document.createElement('div');
    forecastCard.className = 'forecast-card';
    forecastCard.innerHTML = `
      <div class="forecast-date">${dateStr}</div>
      <div class="forecast-icon">
        <img src="${iconUrl}" alt="${desc}" style="width: 50px; height: 50px;">
      </div>
      <div class="forecast-temp">${temp}°C</div>
      <div class="forecast-desc">${desc}</div>
    `;
    forecastContainer.appendChild(forecastCard);
  });

  forecastSection.classList.remove('hidden');
}

// Update Hourly Forecast
function updateHourlyForecast(data) {
  const hourlyContainer = document.getElementById('hourlyContainer');
  hourlyContainer.innerHTML = '';

  // Get next 24 hours (8 items, each representing 3 hours)
  const hourlyData = data.list.slice(0, 8);

  hourlyData.forEach(item => {
    const date = new Date(item.dt * 1000);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const iconUrl = `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`;
    const temp = Math.round(item.main.temp);
    const desc = item.weather[0].main;

    const hourlyCard = document.createElement('div');
    hourlyCard.className = 'hourly-card';
    hourlyCard.innerHTML = `
      <div class="hourly-time">${timeStr}</div>
      <div class="hourly-icon">
        <img src="${iconUrl}" alt="${desc}" style="width: 50px; height: 50px;">
      </div>
      <div class="hourly-temp">${temp}°C</div>
      <div class="hourly-desc">${desc}</div>
    `;
    hourlyContainer.appendChild(hourlyCard);
  });

  hourlySection.classList.remove('hidden');
}

// Show/Hide Loading Spinner
function showLoading(show) {
  loadingSpinner.classList.toggle('hidden', !show);
}

// Show Error Message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
}

// Hide Error Message
function hideError() {
  errorMessage.classList.remove('show');
}

// Initialize on Page Load
window.addEventListener('load', () => {
  loadRecentSearches();
  // Optional: Load default city on startup
  // fetchWeatherByCity('New York');
});