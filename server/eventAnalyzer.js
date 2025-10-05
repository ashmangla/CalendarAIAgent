const { OpenAI } = require('openai');

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
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert event preparation assistant. Analyze calendar events and provide detailed preparation suggestions.

            Return your response as a JSON object with this exact structure:
            {
              "eventSummary": "Brief description of the event and what preparation is needed",
              "preparationTasks": [
                {
                  "id": "unique_task_id",
                  "task": "Description of the task",
                  "priority": "High|Medium|Low",
                  "category": "Category name (e.g., Transportation, Documentation, etc.)",
                  "estimatedTime": "Time estimate (e.g., '15 minutes', '2 hours')",
                  "suggestedDate": "ISO date string when this task should be completed",
                  "description": "Detailed description of what this task involves"
                }
              ],
              "timeline": {
                "timeframe": ["task1", "task2"]
              },
              "tips": ["tip1", "tip2", "tip3", "tip4", "tip5"],
              "estimatedPrepTime": "Total preparation time estimate"
            }

            IMPORTANT REQUIREMENTS:
            - Provide exactly 4-5 key preparation suggestions/tasks
            - Each task must have a unique ID (use format: task_1, task_2, etc.)
            - Provide 2-10 specific items to prepare for each task (in the description field)
            - Include realistic suggestedDate for each task (relative to event date)
            - Provide exactly 4-5 practical tips
            - Make tasks actionable and specific to the event type`
          },
          {
            role: "user",
            content: `Analyze this calendar event and suggest comprehensive preparation tasks:

            Event Title: ${event.title}
            Event Type: ${event.type}
            Date: ${event.date}
            ${event.endDate ? `End Date: ${event.endDate}` : ''}
            ${event.location ? `Location: ${event.location}` : ''}
            ${event.description ? `Description: ${event.description}` : ''}

            Focus on practical, actionable preparation tasks specific to this type of event.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return this.parseOpenAIResponse(completion.choices[0].message.content);
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
        return JSON.parse(jsonMatch[0]);
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


}

module.exports = CalendarEventAnalyzer;