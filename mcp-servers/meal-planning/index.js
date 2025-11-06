#!/usr/bin/env node

/**
 * Meal Planning MCP Server
 * Provides tools for generating meal plans using Spoonacular API
 * and creating Google Docs with meal plans
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const { google } = require('googleapis');

// Configuration
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY || '';
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

// Server setup
const server = new Server(
  {
    name: 'meal-planning-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Generate meal plan using Spoonacular API
 */
async function generateMealPlan({ days = 7, targetCalories = 2000, diet = '', exclude = '' }) {
  if (!SPOONACULAR_API_KEY) {
    throw new Error('SPOONACULAR_API_KEY environment variable not set');
  }

  try {
    const params = {
      apiKey: SPOONACULAR_API_KEY,
      timeFrame: days === 7 ? 'week' : 'day',
      targetCalories: targetCalories
    };

    if (diet) {
      params.diet = diet;
    }
    if (exclude) {
      params.exclude = exclude;
    }

    const response = await axios.get(`${SPOONACULAR_BASE_URL}/mealplanner/generate`, {
      params,
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    console.error('Error generating meal plan:', error);
    if (error.response) {
      throw new Error(`Spoonacular API error: ${error.response.data.message || error.response.statusText}`);
    }
    throw new Error(`Failed to generate meal plan: ${error.message}`);
  }
}

/**
 * Format meal plan data into structured text
 */
function formatMealPlanForDoc(mealPlanData, preferences) {
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

  return docContent;
}

/**
 * Create Google Doc with meal plan content
 */
async function createMealPlanDocument(content, eventDate, googleTokens) {
  if (!googleTokens || !googleTokens.access_token) {
    throw new Error('Google authentication required');
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(googleTokens);

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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_meal_plan',
        description: 'Generate a weekly meal plan based on preferences and create a Google Doc. Use this when the user asks about meal planning for an event.',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to plan (1-7)',
              default: 7
            },
            familySize: {
              type: 'number',
              description: 'Number of people in the family',
              default: 2
            },
            targetCalories: {
              type: 'number',
              description: 'Daily calorie target (e.g., 2000)',
              default: 2000
            },
            diet: {
              type: 'string',
              description: 'Diet type: vegetarian, vegan, paleo, primal, ketogenic, pescetarian, or empty string for none',
              default: ''
            },
            exclude: {
              type: 'string',
              description: 'Comma-separated ingredients to exclude (e.g., "shellfish, nuts, dairy")',
              default: ''
            },
            eventDate: {
              type: 'string',
              description: 'Event date in ISO format (e.g., 2025-10-15)',
              default: ''
            },
            googleTokens: {
              type: 'object',
              description: 'Google OAuth tokens for creating documents',
              properties: {
                access_token: { type: 'string' },
                refresh_token: { type: 'string' },
                scope: { type: 'string' },
                token_type: { type: 'string' },
                expiry_date: { type: 'number' }
              },
              required: ['access_token']
            }
          },
          required: ['googleTokens']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'generate_meal_plan') {
    try {
      const {
        days = 7,
        familySize = 2,
        targetCalories = 2000,
        diet = '',
        exclude = '',
        eventDate = '',
        googleTokens
      } = args;

      // Generate meal plan
      const mealPlan = await generateMealPlan({
        days,
        targetCalories,
        diet,
        exclude
      });

      // Format for document
      const docContent = formatMealPlanForDoc(mealPlan, {
        days,
        familySize,
        targetCalories,
        diet,
        exclude,
        eventDate
      });

      // Create Google Doc
      const doc = await createMealPlanDocument(
        docContent,
        eventDate,
        googleTokens
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Meal plan generated successfully for ${days} day(s)!`,
              document: {
                title: doc.title,
                url: doc.url,
                documentId: doc.documentId
              },
              mealPlan: {
                totalMeals: mealPlan.meals ? mealPlan.meals.length : 0,
                nutrients: mealPlan.nutrients || {}
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Meal Planning MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

