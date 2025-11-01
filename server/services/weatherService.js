const axios = require('axios');

class WeatherService {
  constructor() {
    // Open-Meteo is free and requires no API key!
    this.geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
    this.weatherUrl = 'https://api.open-meteo.com/v1/forecast';
  }

  /**
   * Get weather forecast for a specific date and location
   * @param {string} location - Location (city name or coordinates)
   * @param {Date} eventDate - Date of the event
   * @returns {Promise<Object>} Weather data
   */
  async getWeatherForEvent(location, eventDate) {
    try {
      console.log('🌤️ getWeatherForEvent called:', { location, eventDate });
      const now = new Date();
      const eventDateTime = new Date(eventDate);
      const hoursUntilEvent = (eventDateTime - now) / (1000 * 60 * 60);

      console.log('🌤️ Time calculation:', { now: now.toISOString(), eventDateTime: eventDateTime.toISOString(), hoursUntilEvent });

      // Open-Meteo provides 7-day forecast (168 hours)
      if (hoursUntilEvent > 168) {
        console.log('🌤️ Event is too far in the future for accurate weather forecast (max 7 days)');
        return null;
      }

      // If event is more than 24 hours in the past, don't fetch weather
      // Allow events from today even if they've already happened
      if (hoursUntilEvent < -24) {
        console.log('🌤️ Event is more than 24 hours in the past, hours until event:', hoursUntilEvent);
        return null;
      }

      // Get coordinates for the location
      console.log('🌤️ Getting coordinates for:', location);
      const geoData = await this.getCoordinates(location);
      console.log('🌤️ Geocoding result:', geoData);
      if (!geoData) {
        console.log('🌤️ Failed to get coordinates for location');
        return null;
      }

      // Format date for API (YYYY-MM-DD)
      const startDate = now.toISOString().split('T')[0];
      const eventDateStr = eventDateTime.toISOString().split('T')[0];

      // Get weather forecast from Open-Meteo
      const weatherData = await axios.get(this.weatherUrl, {
        params: {
          latitude: geoData.lat,
          longitude: geoData.lon,
          hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m',
          temperature_unit: 'celsius',
          wind_speed_unit: 'kmh',
          timezone: 'auto',
          start_date: startDate,
          end_date: eventDateStr
        }
      });

      // Find the forecast closest to the event time
      const closestForecast = this.findClosestForecast(weatherData.data.hourly, eventDateTime);

      if (!closestForecast) {
        return null;
      }

      // Map weather code to condition
      const condition = this.getWeatherCondition(closestForecast.weather_code);

      return {
        temperature: Math.round(closestForecast.temperature_2m),
        feelsLike: Math.round(closestForecast.apparent_temperature),
        description: condition.description,
        main: condition.main,
        humidity: closestForecast.relative_humidity_2m,
        windSpeed: Math.round(closestForecast.wind_speed_10m),
        precipitation: closestForecast.precipitation_probability,
        location: `${geoData.name}, ${geoData.country}`
      };
    } catch (error) {
      console.error('Error fetching weather data:', error.message);
      return null;
    }
  }

  /**
   * Get coordinates for a location using Open-Meteo geocoding
   * @param {string} location - Location name
   * @returns {Promise<Object>} Coordinates and location info
   */
  async getCoordinates(location) {
    try {
      // Extract city from full address if needed
      // E.g., "Redmond High School, 17272 NE 104th St, Redmond, WA 98052, USA" -> "Redmond"
      let searchLocation = location;
      let cityName = null;

      // Check if it's a US address with ZIP code pattern
      const zipMatch = location.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*\d{5}/);
      if (zipMatch) {
        // Extract just the city name (state abbreviations don't work well with Open-Meteo)
        cityName = zipMatch[1].trim();
        console.log('🌤️ Extracted city from address:', cityName);
      } else {
        // Try to extract city from comma-separated address
        const parts = location.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          // For addresses like "School, Street, City, State, ZIP, Country"
          // Try the third-to-last part which is usually the city
          cityName = parts[parts.length - 3];
          console.log('🌤️ Extracted city from parts:', cityName);
        } else if (parts.length >= 2) {
          // For simpler addresses, try second-to-last
          cityName = parts[parts.length - 2];
          console.log('🌤️ Using second-to-last part as city:', cityName);
        }
      }

      // Use the extracted city name or fall back to original location
      searchLocation = cityName || location;
      console.log('🌤️ Geocoding search for:', searchLocation);

      const response = await axios.get(this.geocodingUrl, {
        params: {
          name: searchLocation,
          count: 1,
          language: 'en',
          format: 'json'
        }
      });

      console.log('🌤️ Geocoding API response:', response.data);

      if (response.data && response.data.results && response.data.results.length > 0) {
        const data = response.data.results[0];
        console.log('🌤️ Geocoding success:', { lat: data.latitude, lon: data.longitude, name: data.name });
        return {
          lat: data.latitude,
          lon: data.longitude,
          name: data.name,
          country: data.country || data.country_code
        };
      }

      console.log('🌤️ No geocoding results found');
      return null;
    } catch (error) {
      console.error('🌤️ Error getting coordinates:', error.message);
      return null;
    }
  }

  /**
   * Find the forecast closest to the event time
   * @param {Object} hourlyData - Hourly forecast data from Open-Meteo
   * @param {Date} eventDate - Event date
   * @returns {Object} Closest forecast
   */
  findClosestForecast(hourlyData, eventDate) {
    if (!hourlyData || !hourlyData.time) {
      return null;
    }

    let closestIndex = 0;
    let smallestDiff = Infinity;

    for (let i = 0; i < hourlyData.time.length; i++) {
      const forecastDate = new Date(hourlyData.time[i]);
      const diff = Math.abs(forecastDate - eventDate);

      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = i;
      }
    }

    return {
      temperature_2m: hourlyData.temperature_2m[closestIndex],
      apparent_temperature: hourlyData.apparent_temperature[closestIndex],
      precipitation_probability: hourlyData.precipitation_probability[closestIndex],
      weather_code: hourlyData.weather_code[closestIndex],
      wind_speed_10m: hourlyData.wind_speed_10m[closestIndex],
      relative_humidity_2m: hourlyData.relative_humidity_2m[closestIndex]
    };
  }

  /**
   * Convert WMO weather code to human-readable condition
   * @param {number} code - WMO weather code
   * @returns {Object} Weather condition
   */
  getWeatherCondition(code) {
    // WMO Weather interpretation codes
    const weatherCodes = {
      0: { main: 'Clear', description: 'clear sky' },
      1: { main: 'Clear', description: 'mainly clear' },
      2: { main: 'Clouds', description: 'partly cloudy' },
      3: { main: 'Clouds', description: 'overcast' },
      45: { main: 'Fog', description: 'foggy' },
      48: { main: 'Fog', description: 'depositing rime fog' },
      51: { main: 'Drizzle', description: 'light drizzle' },
      53: { main: 'Drizzle', description: 'moderate drizzle' },
      55: { main: 'Drizzle', description: 'dense drizzle' },
      61: { main: 'Rain', description: 'slight rain' },
      63: { main: 'Rain', description: 'moderate rain' },
      65: { main: 'Rain', description: 'heavy rain' },
      71: { main: 'Snow', description: 'slight snow fall' },
      73: { main: 'Snow', description: 'moderate snow fall' },
      75: { main: 'Snow', description: 'heavy snow fall' },
      77: { main: 'Snow', description: 'snow grains' },
      80: { main: 'Rain', description: 'slight rain showers' },
      81: { main: 'Rain', description: 'moderate rain showers' },
      82: { main: 'Rain', description: 'violent rain showers' },
      85: { main: 'Snow', description: 'slight snow showers' },
      86: { main: 'Snow', description: 'heavy snow showers' },
      95: { main: 'Thunderstorm', description: 'thunderstorm' },
      96: { main: 'Thunderstorm', description: 'thunderstorm with slight hail' },
      99: { main: 'Thunderstorm', description: 'thunderstorm with heavy hail' }
    };

    return weatherCodes[code] || { main: 'Unknown', description: 'unknown conditions' };
  }

  /**
   * Generate weather-based suggestions for an event
   * @param {Object} weather - Weather data
   * @param {string} eventType - Type of event
   * @param {string} eventTitle - Event title
   * @returns {Array<string>} Array of suggestions
   */
  generateWeatherSuggestions(weather, eventType, eventTitle) {
    if (!weather) {
      return [];
    }

    const suggestions = [];
    const isOutdoorEvent = this.isOutdoorEvent(eventType, eventTitle);

    // Temperature-based suggestions
    if (weather.temperature < 10) {
      suggestions.push(`🧥 It will be cold (${weather.temperature}°C). Dress warmly and consider bringing a jacket.`);
    } else if (weather.temperature > 30) {
      suggestions.push(`🌡️ It will be hot (${weather.temperature}°C). Stay hydrated and consider light clothing.`);
    } else if (weather.temperature >= 20 && weather.temperature <= 25) {
      suggestions.push(`☀️ Perfect weather expected (${weather.temperature}°C). It's a beautiful day!`);
    }

    // Rain/weather condition suggestions
    if (weather.main === 'Rain' || weather.precipitation > 70) {
      suggestions.push(`☔ Rain expected (${Math.round(weather.precipitation)}% chance). Bring an umbrella and wear waterproof clothing.`);
      if (isOutdoorEvent) {
        suggestions.push(`🏃 Consider bringing a rain jacket or poncho for outdoor activities.`);
      }
    } else if (weather.main === 'Snow') {
      suggestions.push(`❄️ Snow expected. Dress warmly and wear appropriate footwear.`);
    } else if (weather.main === 'Clear' && isOutdoorEvent) {
      suggestions.push(`🌞 Clear skies expected. Perfect weather for outdoor activities!`);
      if (weather.temperature > 20) {
        suggestions.push(`🕶️ Don't forget sunscreen and sunglasses.`);
      }
    } else if (weather.main === 'Clouds') {
      suggestions.push(`☁️ Cloudy conditions expected. ${weather.description}.`);
    } else if (weather.main === 'Thunderstorm') {
      suggestions.push(`⛈️ Thunderstorms expected. Consider rescheduling outdoor activities or find indoor alternatives.`);
    } else if (weather.main === 'Drizzle') {
      suggestions.push(`🌧️ Light rain expected. Bring an umbrella just in case.`);
    } else if (weather.main === 'Fog') {
      suggestions.push(`🌫️ Foggy conditions expected. Allow extra travel time and drive carefully.`);
    }

    // Wind suggestions
    if (weather.windSpeed > 30) {
      suggestions.push(`💨 Strong winds expected (${weather.windSpeed} km/h). Secure loose items.`);
    }

    // Humidity suggestions
    if (weather.humidity > 80 && weather.temperature > 25) {
      suggestions.push(`💧 High humidity (${weather.humidity}%). It might feel muggy.`);
    }

    // Event-specific suggestions
    if (isOutdoorEvent) {
      if (weather.main === 'Clear' && weather.temperature > 15) {
        suggestions.push(`✨ Great conditions for your ${eventType || 'outdoor event'}!`);
      }
    }

    return suggestions;
  }

  /**
   * Determine if an event is likely outdoors
   * @param {string} eventType - Event type
   * @param {string} eventTitle - Event title
   * @returns {boolean}
   */
  isOutdoorEvent(eventType, eventTitle) {
    const outdoorKeywords = [
      'outdoor', 'park', 'beach', 'picnic', 'hike', 'walk', 'run', 'bike',
      'soccer', 'football', 'baseball', 'tennis', 'golf', 'sports',
      'concert', 'festival', 'fair', 'market', 'barbecue', 'bbq',
      'garden', 'camping', 'fishing', 'swimming', 'surfing'
    ];

    const titleLower = (eventTitle || '').toLowerCase();
    const typeLower = (eventType || '').toLowerCase();

    return outdoorKeywords.some(keyword =>
      titleLower.includes(keyword) || typeLower.includes(keyword)
    );
  }
}

module.exports = new WeatherService();
