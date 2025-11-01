const { OpenAI } = require('openai');
const weatherService = require('./services/weatherService');

class CalendarEventAnalyzer {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async analyzeEvent(event) {
    // Fetch weather data if location is provided
    let weatherData = null;
    let weatherSuggestions = [];

    if (event.location && event.date) {
      try {
        weatherData = await weatherService.getWeatherForEvent(event.location, event.date);
        if (weatherData) {
          weatherSuggestions = weatherService.generateWeatherSuggestions(
            weatherData,
            event.type,
            event.title
          );
          console.log(`🌤️  Weather data fetched for ${event.location}: ${weatherData.description}`);
        }
      } catch (error) {
        console.warn('Could not fetch weather data:', error.message);
      }
    }
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert event preparation assistant. Analyze calendar events and provide detailed preparation suggestions with specific checklists.

            Return your response as a JSON object with this exact structure:
            {
              "eventSummary": "Brief description of the event and what preparation is needed",
              "preparationTasks": [
                {
                  "id": "unique_task_id",
                  "task": "Description of the task",
                  "priority": "High|Medium|Low",
                  "category": "Category name (e.g., Equipment, Transportation, Documentation, etc.)",
                  "estimatedTime": "Time estimate (e.g., '15 minutes', '2 hours')",
                  "suggestedDate": "ISO date string when this task should be completed",
                  "description": "Detailed checklist of specific items to prepare (e.g., 'Pack instrument case, music sheets, metronome, spare strings, tuner, uniform, water bottle')"
                }
              ],
              "timeline": {
                "timeframe": ["task1", "task2"]
              },
              "tips": ["tip1", "tip2", "tip3", "tip4", "tip5"],
              "estimatedPrepTime": "Total preparation time estimate"
            }

            CONTEXT-SPECIFIC REQUIREMENTS:
            - For MUSIC CLASSES: Include instrument, music sheets, accessories, uniform, transportation
            - For TRAVEL (both local and global trips): MUST include transportation planning with Uber/ride booking option, packing lists, documents, accommodation details. For local trips, suggest Uber booking. For global trips, include airport transportation and Uber for local transit.
            - For MEETINGS: Include agenda, materials, technology, location details, and transportation (Uber booking option if location requires travel)
            - For CONCERTS/SHOWS: Include tickets, transportation (including Uber booking option), attire, timing
            - For WORK EVENTS: Include professional attire, materials, technology, preparation, and transportation (Uber booking option if needed)
            - For CELEBRATIONS: Include gifts, attire, transportation (including Uber booking option), timing
            
            TRANSPORTATION REQUIREMENTS:
            - For any event that requires travel (local or global): Always include a transportation task with category "Transportation" that mentions "Book Uber ride" or "Arrange transportation" in the checklist
            - Include specific details like: "Book Uber from [origin] to [destination]", "Check Uber fare estimate", "Schedule Uber pickup time"

            IMPORTANT REQUIREMENTS:
            - Provide exactly 4-6 key preparation suggestions/tasks
            - Each task must have a unique ID (use format: task_1, task_2, etc.)
            - Provide specific, actionable checklists in the description field (comma-separated items)
            - Include realistic suggestedDate for each task (relative to event date)
            - Provide exactly 4-5 practical tips
            - Make tasks actionable and specific to the event type and context`
          },
          {
            role: "user",
            content: `Analyze this calendar event and suggest comprehensive preparation tasks:

            CURRENT DATE AND TIME: ${new Date().toISOString()}

            Event Title: ${event.title}
            Event Type: ${event.type}
            Event Date: ${event.date}
            ${event.endDate ? `End Date: ${event.endDate}` : ''}
            ${event.location ? `Location: ${event.location}` : ''}
            ${event.description ? `Description: ${event.description}` : ''}
            ${weatherData ? `
            WEATHER FORECAST:
            - Location: ${weatherData.location}
            - Temperature: ${weatherData.temperature}°C (Feels like ${weatherData.feelsLike}°C)
            - Conditions: ${weatherData.description}
            - Precipitation: ${Math.round(weatherData.precipitation)}% chance
            - Wind: ${weatherData.windSpeed} km/h
            - Humidity: ${weatherData.humidity}%

            Weather-based suggestions:
            ${weatherSuggestions.map(s => `- ${s}`).join('\n            ')}
            ` : ''}

            IMPORTANT: All suggested dates and times MUST be in the future (after the current date/time shown above).
            Never suggest preparation tasks with dates/times in the past. If a task was supposed to be done earlier,
            suggest it for a future time that still allows adequate preparation before the event.

            ${weatherData ? 'WEATHER CONSIDERATIONS: Incorporate the weather forecast and suggestions into your preparation tasks and tips. For outdoor events, prioritize weather-appropriate items.' : ''}

            Focus on practical, actionable preparation tasks specific to this type of event.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const analysis = this.parseOpenAIResponse(completion.choices[0].message.content);

      // Add weather data to the response if available
      if (weatherData) {
        analysis.weather = {
          temperature: weatherData.temperature,
          feelsLike: weatherData.feelsLike,
          description: weatherData.description,
          main: weatherData.main,
          precipitation: Math.round(weatherData.precipitation),
          windSpeed: weatherData.windSpeed,
          humidity: weatherData.humidity,
          location: weatherData.location,
          suggestions: weatherSuggestions,
          fetchedAt: new Date().toISOString(),
          queryLocation: event.location
        };
      }

      return analysis;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`Failed to analyze event with AI: ${error.message}`);
    }
  }

  parseOpenAIResponse(content) {
    try {
      // Try to parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure all suggested dates/times are in the future
        if (parsed.preparationTasks && Array.isArray(parsed.preparationTasks)) {
          parsed.preparationTasks = parsed.preparationTasks.map(task => {
            if (task.suggestedDate) {
              task.suggestedDate = this.ensureFutureDate(task.suggestedDate);
            }
            return task;
          });
        }
        
        return parsed;
      }
      
      // If no JSON found, throw error
      throw new Error('Invalid JSON response from OpenAI');
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      // Return a fallback response structure
      return {
        eventSummary: "Analysis could not be completed due to response format error.",
        preparationTasks: [
          {
            task: "Review event details manually",
            priority: "Medium",
            category: "Planning",
            estimatedTime: "10 minutes"
          }
        ],
        timeline: {
          "1 day before": ["Review event details"]
        },
        tips: ["Double-check event time and location"],
        estimatedPrepTime: "30 minutes"
      };
    }
  }

  /**
   * Ensure the suggested date is in the future
   * If the date is in the past, adjust it to be at least 1 hour from now
   * @param {string} suggestedDate - ISO date string
   * @returns {string} ISO date string in the future
   */
  ensureFutureDate(suggestedDate) {
    try {
      const now = new Date();
      const suggested = new Date(suggestedDate);
      
      // If suggested date is in the past or less than 1 hour from now, adjust it
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      
      if (suggested <= oneHourFromNow) {
        // Set to 1 hour from now
        return oneHourFromNow.toISOString();
      }
      
      return suggested.toISOString();
    } catch (error) {
      console.error('Error ensuring future date:', error);
      // If parsing fails, return 1 hour from now
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      return oneHourFromNow.toISOString();
    }
  }


}

module.exports = CalendarEventAnalyzer;
