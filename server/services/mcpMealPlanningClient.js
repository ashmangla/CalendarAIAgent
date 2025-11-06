const axios = require('axios');
const { google } = require('googleapis');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

/**
 * MCP Meal Planning Client
 * Can work with a Python MCP server or call Spoonacular API directly
 * When used as an MCP tool, it formats the meal plan and creates a Google Doc
 */
class MCPMealPlanningClient extends EventEmitter {
  constructor() {
    super();
    this.spoonacularApiKey = process.env.SPOONACULAR_API_KEY;
    this.baseUrl = 'https://api.spoonacular.com';
    this.mcpServerPath = process.env.MCP_MEAL_PLANNING_SERVER_PATH || null;
  }

  // Note: Event detection is now handled by the agent (LLM) based on context.
  // The agent analyzes the event and decides when to use the meal planning MCP tool.
  // No hardcoded pattern matching is needed - the agent has access to the meal planning
  // tool and will call it when appropriate based on the event title and context.

  /**
   * Call Spoonacular API directly (fallback if MCP server not available)
   */
  async callSpoonacularAPI(endpoint, params = {}) {
    if (!this.spoonacularApiKey) {
      throw new Error('SPOONACULAR_API_KEY environment variable not set');
    }

    params.apiKey = this.spoonacularApiKey;
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await axios.get(url, { params, timeout: 30000 });
      return response.data;
    } catch (error) {
      console.error('Spoonacular API error:', error);
      if (error.response) {
        throw new Error(`Spoonacular API error: ${error.response.data.message || error.response.statusText}`);
      }
      throw new Error(`Failed to call Spoonacular API: ${error.message}`);
    }
  }

  /**
   * Generate meal plan using Spoonacular API
   */
  async generateMealPlan({ days = 7, targetCalories = 2000, diet = '', exclude = '' }) {
    const params = {
      timeFrame: days === 7 ? 'week' : 'day',
      targetCalories: targetCalories
    };

    if (diet) {
      params.diet = diet;
    }
    if (exclude) {
      params.exclude = exclude;
    }

    return await this.callSpoonacularAPI('/mealplanner/generate', params);
  }

  /**
   * Format meal plan data into structured text for Google Doc
   */
  formatMealPlanForDoc(mealPlanData, preferences) {
    let docContent = '';
    
    // Header
    const eventDate = preferences.eventDate ? new Date(preferences.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : new Date().toLocaleDateString();
    
    docContent += `WEEKLY MEAL PLAN\n`;
    docContent += `Generated: ${eventDate}\n\n`;
    
    if (preferences.familySize) {
      docContent += `Family Size: ${preferences.familySize}\n`;
    }
    if (preferences.diet) {
      docContent += `Dietary Preference: ${preferences.diet}\n`;
    }
    if (preferences.exclude) {
      docContent += `Exclusions: ${preferences.exclude}\n`;
    }
    docContent += `Daily Calorie Target: ${preferences.targetCalories || 2000}\n`;
    docContent += `\n${'='.repeat(50)}\n\n`;

    // Process meals
    if (mealPlanData.meals) {
      // Group meals by day
      const mealsByDay = {};
      mealPlanData.meals.forEach(meal => {
        const day = meal.day || 'Unknown';
        if (!mealsByDay[day]) {
          mealsByDay[day] = [];
        }
        mealsByDay[day].push(meal);
      });

      // Format each day
      Object.keys(mealsByDay).sort().forEach(day => {
        docContent += `DAY ${day}\n`;
        docContent += `${'-'.repeat(30)}\n\n`;
        
        mealsByDay[day].forEach(meal => {
          docContent += `🍽️ ${meal.title}\n`;
          docContent += `   Ready in: ${meal.readyInMinutes || 'N/A'} minutes\n`;
          docContent += `   Servings: ${meal.servings || 'N/A'}\n`;
          if (meal.id) {
            docContent += `   Recipe ID: ${meal.id}\n`;
            docContent += `   Recipe URL: https://spoonacular.com/recipes/-${meal.id}\n`;
          }
          docContent += `\n`;
        });
        
        docContent += `\n`;
      });
    }

    // Add nutrients summary if available
    if (mealPlanData.nutrients) {
      docContent += `\n${'='.repeat(50)}\n`;
      docContent += `NUTRITION SUMMARY\n`;
      docContent += `${'-'.repeat(30)}\n\n`;
      docContent += `Calories: ${mealPlanData.nutrients.calories || 'N/A'}\n`;
      docContent += `Protein: ${mealPlanData.nutrients.protein || 'N/A'}g\n`;
      docContent += `Fat: ${mealPlanData.nutrients.fat || 'N/A'}g\n`;
      docContent += `Carbohydrates: ${mealPlanData.nutrients.carbohydrates || 'N/A'}g\n`;
    }

    // Add grocery list if available
    if (mealPlanData.items && mealPlanData.items.length > 0) {
      docContent += `\n${'='.repeat(50)}\n`;
      docContent += `GROCERY LIST\n`;
      docContent += `${'-'.repeat(30)}\n\n`;
      
      mealPlanData.items.forEach(item => {
        docContent += `☑ ${item.name}`;
        if (item.aisle) {
          docContent += ` (${item.aisle})`;
        }
        docContent += `\n`;
      });
    }

    return docContent;
  }

  /**
   * Create Google Doc with meal plan content
   */
  async createMealPlanDocument(content, eventDate, tokens) {
    if (!tokens || !tokens.access_token) {
      throw new Error('Google authentication required. Please sign in to Google Calendar.');
    }

    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(tokens);

      const docs = google.docs({ version: 'v1', auth: oauth2Client });

      // Format date for filename
      const dateStr = eventDate 
        ? new Date(eventDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      const docTitle = `Meal Plan - ${dateStr}`;

      // Create document
      const doc = await docs.documents.create({
        requestBody: {
          title: docTitle
        }
      });

      const documentId = doc.data.documentId;

      // Insert content
      const requests = [];
      
      if (doc.data.body && doc.data.body.content && doc.data.body.content.length > 0) {
        const firstElement = doc.data.body.content[0];
        if (firstElement.paragraph && firstElement.endIndex > firstElement.startIndex) {
          requests.push({
            deleteContentRange: {
              range: {
                startIndex: firstElement.startIndex,
                endIndex: firstElement.endIndex - 1
              }
            }
          });
        }
      }

      if (content) {
        requests.push({
          insertText: {
            location: {
              index: 1
            },
            text: content
          }
        });
      }

      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: documentId,
          requestBody: {
            requests: requests
          }
        });
      }

      const docUrl = `https://docs.google.com/document/d/${documentId}`;

      return {
        documentId: documentId,
        url: docUrl,
        title: docTitle
      };
    } catch (error) {
      console.error('Error creating Google Doc:', error);
      throw new Error(`Failed to create Google Doc: ${error.message}`);
    }
  }

  /**
   * Main method: Generate meal plan using MCP tool pattern and create Google Doc
   * This is called by the event analyzer when a meal prep event is detected
   */
  async generateMealPlanForEvent(event, tokens, preferences = {}) {
    try {
      // Use user preferences, falling back to defaults only if not provided
      // Default values are defined in generateMealPlan function signature
      const userPreferences = {
        days: preferences.days !== undefined ? preferences.days : 7,
        familySize: preferences.familySize || null,
        targetCalories: preferences.targetCalories !== undefined ? preferences.targetCalories : 2000,
        diet: preferences.diet || '',
        exclude: preferences.exclude || '',
        eventDate: event.date || event.start?.dateTime || event.start?.date || new Date().toISOString()
      };

      console.log(`🍽️  Generating meal plan for event: "${event.title}"`);
      console.log(`   User preferences: ${JSON.stringify(userPreferences)}`);

      // Generate meal plan using Spoonacular API with user preferences
      // The generateMealPlan function has default values, but we pass user preferences explicitly
      const mealPlan = await this.generateMealPlan({
        days: userPreferences.days,
        targetCalories: userPreferences.targetCalories,
        diet: userPreferences.diet,
        exclude: userPreferences.exclude
      });

      // Format for document
      const docContent = this.formatMealPlanForDoc(mealPlan, userPreferences);

      // Create Google Doc
      const doc = await this.createMealPlanDocument(
        docContent,
        userPreferences.eventDate,
        tokens
      );

      console.log(`✅ Meal plan document created: ${doc.url}`);

      return {
        success: true,
        mealPlan: mealPlan,
        document: doc,
        preferences: userPreferences
      };
    } catch (error) {
      console.error('Error in generateMealPlanForEvent:', error);
      throw error;
    }
  }
}

module.exports = new MCPMealPlanningClient();

