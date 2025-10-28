# Calendar Events App

A React web application with an Express.js server that displays calendar events. The app supports both Google Calendar integration and mock data, with AI-powered event analysis and smart preparation suggestions.

## Features

- **Google Calendar Integration**: Connect your Google account to fetch real calendar events
- **Fallback to Sample Data**: Use built-in sample events if you prefer not to connect Google Calendar
- **React Frontend**: Clean, responsive UI with modern design
- **Express.js Backend**: RESTful API serving calendar data
- **AI Event Analysis**: OpenAI-powered agent that analyzes events and suggests preparation tasks
- **Smart Event Classification**: Automatically categorizes events (travel, meetings, concerts, etc.)
- **Mock Data**: 10 different event types including:
  - Travel events
  - Concert events  
  - Band practice sessions
  - Pickup appointments
- **Smart Suggestions**: Event-specific preparation recommendations with:
  - Prioritized task lists
  - Time estimates for each task
  - Preparation timelines
  - Pro tips and advice
- **Responsive Design**: Mobile-friendly layout
- **Error Handling**: Graceful error handling for server connectivity
- **Loading States**: Visual feedback during data fetching
- **Easy Authentication**: Simple Google OAuth integration with option to skip

## Project Structure

```
app1/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── CalendarEvents.js
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── server/                 # Express.js backend
│   └── server.js
├── package.json           # Root package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm
- OpenAI API key (for AI event analysis feature)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   npm run install-client
   ```
   Or install all at once:
   ```bash
   npm run install-all
   ```

2. **Set up OpenAI API Key:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Edit `.env` file and add your API key:
     ```
     OPENAI_API_KEY=your_actual_api_key_here
     ```

### Running the Application

#### Development Mode (Recommended)

Run both server and client concurrently:
```bash
npm run dev
```

This will start:
- Express server on `http://localhost:5000`
- React client on `http://localhost:3000`

#### Individual Components

**Server only:**
```bash
npm run server
```

**Client only:**
```bash
npm run client
```

**Production mode:**
```bash
npm start
```

## API Endpoints

### GET /api/calendar/events
Returns mock calendar events data.

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": "1",
      "title": "Business Trip to New York",
      "type": "travel",
      "date": "2025-10-05T09:00:00Z",
      "endDate": "2025-10-08T18:00:00Z",
      "description": "Client meetings and conference attendance",
      "location": "New York, NY"
    }
  ],
  "message": "Calendar events retrieved successfully"
}
```

### POST /api/analyze-event
Analyzes a specific calendar event using AI and returns preparation suggestions.

**Request Body:**
```json
{
  "eventId": "1"
}
```

**Response:**
```json
{
  "success": true,
  "event": { /* event object */ },
  "analysis": {
    "eventSummary": "Travel preparation for...",
    "preparationTasks": [
      {
        "task": "Check passport/ID validity",
        "priority": "High",
        "category": "Documentation",
        "estimatedTime": "5 minutes"
      }
    ],
    "timeline": {
      "1 week before": ["Book transportation", "Check documentation"]
    },
    "tips": ["Check weather forecast for destination"],
    "estimatedPrepTime": "4-6 hours"
  }
}
```

### GET /api/health
Health check endpoint to verify server status.

## Mock Data

The application includes 10 pre-configured events:

1. **Travel Events**: Business trips, vacations
2. **Concert Events**: Rock concerts, jazz performances, classical music
3. **Band Practice**: Weekly rehearsals and new song sessions  
4. **Pickup Events**: Airport pickups, school pickups

## Technologies Used

- **Frontend**: React 18, Axios, CSS3
- **Backend**: Express.js, CORS
- **Development**: Concurrently, Nodemon

## OpenAI Integration

The application uses OpenAI's GPT-3.5-turbo model to analyze calendar events and provide intelligent preparation suggestions. 

### Setup Required:
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Set the `OPENAI_API_KEY` environment variable in your `.env` file
3. The server will automatically detect the API key and enable AI analysis

### Without OpenAI Key:
- The app will still function normally for viewing calendar events
- AI analysis feature will show an error message requesting API key setup
- No mock data or fallback responses are provided

## Google Calendar Setup

For Google Calendar integration, see [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md) for detailed setup instructions.

### Quick Setup:
1. Get Google API credentials from [Google Cloud Console](https://console.cloud.google.com/)
2. Create a `.env` file in the `client` directory with your credentials
3. Install dependencies: `npm install` (in client directory)
4. Run the app: `npm start`

## Future Enhancements

- Event creation and editing functionality
- Event filtering and search
- Calendar view (monthly/weekly)
- Custom AI prompts for different event types
- Multiple calendar support
- Event synchronization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License