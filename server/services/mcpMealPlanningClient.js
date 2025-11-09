const axios = require('axios');
const { google } = require('googleapis');
const { spawn } = require('child_process');
const path = require('path');
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

      const pythonResult = await this.runPythonMealPlanGenerator({
        preferences: userPreferences
      });

      return {
        success: true,
        mealPlan: pythonResult.mealPlan,
        document: pythonResult.document,
        preferences: pythonResult.preferences,
        formattedText: pythonResult.formattedText
      };
    } catch (error) {
      console.error('Error in generateMealPlanForEvent:', error);
      throw error;
    }
  }

  runPythonMealPlanGenerator({ preferences }) {
    return new Promise((resolve, reject) => {
      // Try to use the venv Python first, fall back to system Python
      const venvPython = path.resolve(__dirname, '..', '..', 'mcp-servers', 'meal-planning', '.mealplan-venv', 'bin', 'python');
      const fs = require('fs');
      let pythonBin = process.env.PYTHON_MEAL_PLANNING_BIN || 'python3';
      
      // Check if venv exists and use it
      if (fs.existsSync(venvPython)) {
        pythonBin = venvPython;
        console.log('🐍 [MCP] Using venv Python:', venvPython);
      } else {
        console.log('🐍 [MCP] Venv not found, using system Python:', pythonBin);
      }
      
      const scriptPath = path.resolve(__dirname, '..', '..', 'mcp-servers', 'meal-planning', 'meal_planning_server.py');

      const timeFrame = preferences.days === 1 ? 'day' : 'week';

      const args = [
        scriptPath,
        '--time-frame', timeFrame,
      ];

      if (preferences.targetCalories) {
        args.push('--target-calories', String(preferences.targetCalories));
      }
      if (preferences.diet) {
        args.push('--diet', preferences.diet);
      }
      if (preferences.exclude) {
        args.push('--exclude', preferences.exclude);
      }
      if (preferences.familySize) {
        args.push('--family-size', String(preferences.familySize));
      }
      if (preferences.eventDate) {
        args.push('--event-date', preferences.eventDate);
      }

      const child = spawn(pythonBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_RUN_MODE: 'cli',
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        let errorMessage = 'Failed to start Python meal planning process';
        
        if (error.code === 'ENOENT') {
          errorMessage = 'Python not found. Please install Python 3 or set PYTHON_MEAL_PLANNING_BIN environment variable';
        } else {
          errorMessage = `Python process error: ${error.message}`;
        }
        
        console.error(`[MCP Meal Planning] ${errorMessage}`);
        reject(new Error(errorMessage));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          let errorMessage = 'Spoonacular API or Python MCP server failed';
          
          if (stderr.includes('SPOONACULAR_API_KEY')) {
            errorMessage = 'Spoonacular API key is missing or invalid';
          } else if (stderr.includes('rate limit') || stderr.includes('429')) {
            errorMessage = 'Spoonacular API rate limit exceeded';
          } else if (stderr.includes('ModuleNotFoundError') || stderr.includes('ImportError')) {
            errorMessage = 'Python dependencies missing (mcp or requests). Run: pip install mcp requests';
          } else if (stderr.includes('Network') || stderr.includes('Connection')) {
            errorMessage = 'Network error connecting to Spoonacular API';
          } else if (stderr) {
            errorMessage = `Meal planning error: ${stderr.substring(0, 200)}`;
          } else {
            errorMessage = `Python meal planner exited with code ${code}`;
          }
          
          console.error(`[MCP Meal Planning] ${errorMessage}`);
          return reject(new Error(errorMessage));
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (parseError) {
          const errorMsg = `Failed to parse meal planner output: ${parseError.message}`;
          console.error(`[MCP Meal Planning] ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      });
    });
  }
}

module.exports = new MCPMealPlanningClient();

