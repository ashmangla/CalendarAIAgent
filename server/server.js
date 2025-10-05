require('dotenv').config();
const express = require('express');
const cors = require('cors');
const CalendarEventAnalyzer = require('./eventAnalyzer');
const uberRoutes = require('./routes/uber');

const app = express();

// Initialize the event analyzer
let eventAnalyzer;
try {
  eventAnalyzer = new CalendarEventAnalyzer();
  console.log('✅ OpenAI Event Analyzer initialized successfully');
} catch (error) {
  console.log('⚠️  OpenAI Event Analyzer initialization failed:', error.message);
  console.log('💡 Set OPENAI_API_KEY environment variable to enable AI analysis');
}
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock calendar events data (with analysis tracking)
let mockCalendarEvents = [
  {
    id: '1',
    title: 'Business Trip to New York',
    type: 'travel',
    date: '2025-10-05T09:00:00Z',
    endDate: '2025-10-08T18:00:00Z',
    description: 'Client meetings and conference attendance',
    location: 'New York, NY',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '2',
    title: 'Rock Concert - The Electric Blues',
    type: 'concert',
    date: '2025-10-12T20:00:00Z',
    endDate: '2025-10-12T23:00:00Z',
    description: 'Live performance at Madison Square Garden',
    location: 'Madison Square Garden, NY',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '3',
    title: 'Band Practice Session',
    type: 'band practice',
    date: '2025-10-03T19:00:00Z',
    endDate: '2025-10-03T22:00:00Z',
    description: 'Weekly practice for upcoming gig',
    location: 'Music Studio B, Downtown',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '4',
    title: 'Airport Pickup - Sarah',
    type: 'pickup',
    date: '2025-10-07T14:30:00Z',
    endDate: '2025-10-07T16:00:00Z',
    description: 'Pick up Sarah from JFK Airport',
    location: 'JFK Airport Terminal 4',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '5',
    title: 'Weekend Trip to Mountains',
    type: 'travel',
    date: '2025-10-14T08:00:00Z',
    endDate: '2025-10-16T20:00:00Z',
    description: 'Hiking and camping adventure',
    location: 'Rocky Mountain National Park',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '6',
    title: 'Jazz Concert - Blue Note Quartet',
    type: 'concert',
    date: '2025-10-20T19:30:00Z',
    endDate: '2025-10-20T22:30:00Z',
    description: 'Intimate jazz performance',
    location: 'Blue Note Jazz Club',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '7',
    title: 'Band Practice - New Songs',
    type: 'band practice',
    date: '2025-10-10T18:00:00Z',
    endDate: '2025-10-10T21:00:00Z',
    description: 'Learning new repertoire for winter performances',
    location: 'Community Center Room 3',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '8',
    title: 'Family Pickup - Kids from School',
    type: 'pickup',
    date: '2025-10-04T15:15:00Z',
    endDate: '2025-10-04T16:00:00Z',
    description: 'Weekly pickup duty for soccer practice',
    location: 'Riverside Elementary School',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '9',
    title: 'European Vacation',
    type: 'travel',
    date: '2025-11-01T06:00:00Z',
    endDate: '2025-11-15T22:00:00Z',
    description: 'Two-week tour of Italy and France',
    location: 'Europe',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '10',
    title: 'Classical Concert - Symphony Orchestra',
    type: 'concert',
    date: '2025-10-25T20:00:00Z',
    endDate: '2025-10-25T22:30:00Z',
    description: 'Beethoven\'s 9th Symphony performance',
    location: 'Lincoln Center',
    isAnalyzed: false,
    aiGenerated: false
  }
];

// Routes
app.get('/api/calendar/events', (req, res) => {
  try {
    // Simulate API delay
    setTimeout(() => {
      res.json({
        success: true,
        events: mockCalendarEvents,
        message: 'Calendar events retrieved successfully'
      });
    }, 500);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve calendar events',
      error: error.message
    });
  }
});

// Event analysis endpoint
app.post('/api/analyze-event', async (req, res) => {
  try {
    // Check if event analyzer is available
    if (!eventAnalyzer) {
      return res.status(503).json({
        success: false,
        message: 'AI Event Analysis is not available. Please set OPENAI_API_KEY environment variable.'
      });
    }

    const { eventId } = req.body;
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    // Find the event by ID
    const event = mockCalendarEvents.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Analyze the event using our AI agent
    const analysis = await eventAnalyzer.analyzeEvent(event);
    
    // Mark the event as analyzed
    event.isAnalyzed = true;
    
    res.json({
      success: true,
      event: event,
      analysis: analysis,
      message: 'Event analyzed successfully'
    });
  } catch (error) {
    console.error('Error analyzing event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze event',
      error: error.message
    });
  }
});

// Add selected AI tasks as calendar events
app.post('/api/add-ai-tasks', (req, res) => {
  try {
    const { selectedTasks, originalEventId } = req.body;
    
    if (!selectedTasks || !Array.isArray(selectedTasks) || selectedTasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected tasks array is required'
      });
    }

    if (!originalEventId) {
      return res.status(400).json({
        success: false,
        message: 'Original event ID is required'
      });
    }

    const addedEvents = [];
    let nextId = Math.max(...mockCalendarEvents.map(e => parseInt(e.id))) + 1;

    selectedTasks.forEach(task => {
      const newEvent = {
        id: nextId.toString(),
        title: `📋 ${task.task}`,
        type: 'ai-preparation',
        date: task.suggestedDate,
        endDate: null,
        description: `AI-generated preparation task for event ID ${originalEventId}.\n\n${task.description}\n\nEstimated time: ${task.estimatedTime}\nPriority: ${task.priority}\nCategory: ${task.category}`,
        location: null,
        isAnalyzed: false,
        aiGenerated: true,
        originalEventId: originalEventId,
        taskId: task.id,
        priority: task.priority,
        category: task.category,
        estimatedTime: task.estimatedTime
      };

      mockCalendarEvents.push(newEvent);
      addedEvents.push(newEvent);
      nextId++;
    });

    res.json({
      success: true,
      addedEvents: addedEvents,
      message: `Successfully added ${addedEvents.length} AI-generated preparation tasks`
    });
  } catch (error) {
    console.error('Error adding AI tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add AI tasks',
      error: error.message
    });
  }
});

// Uber service routes
app.use('/api/uber', uberRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Calendar events: http://localhost:${PORT}/api/calendar/events`);
});