# MotherBoard - System Architecture

## Overview

MotherBoard is an AI-powered calendar assistant that helps users prepare for events, manage their schedule, and organize wishlist items. The system integrates with Google Calendar and uses OpenAI's LLM for intelligent event analysis and voice command processing.

## Tech Stack

| Technology | Purpose | Rationale |
| --- | --- | --- |
| React + React DOM | Build the SPA UI and manage component state | Mature ecosystem, fast iteration, integrates well with existing team skills |
| Custom CSS (modular styles) | Responsive layout, theming, calendar/event visuals | Full control over styling without pulling in heavy UI frameworks |
| Axios | HTTP client for REST calls between client and server | Promise-based API, interceptors, consistent error handling |
| Web Speech API | Browser-native speech recognition and synthesis | No extra dependency, works across modern browsers for real-time voice UX |
| OpenAI GPT-3.5-turbo | Event checklist generation, voice intent parsing, wishlist matching, color classification fallback, meal plan fallback | Provides rich reasoning, language understanding, reduces need for custom NLP |
| Spoonacular API | Meal plan generation with nutritional data | Professional meal planning with recipes, ingredients, and nutrition facts |
| Python MCP Server | Meal planning service integration via stdio | Modular meal planning service with venv isolation, calls Spoonacular API |
| Node.js + Express | REST backend, routing, middleware, session handling | Lightweight server with huge community support and easy integration with JS stack |
| Google Calendar API (`googleapis`) | OAuth2 auth, fetch/create/delete real calendar events | Native integration with users’ primary calendars, reliable source of truth |
| Google Docs API (Drive readonly scope) | Fetch and summarize meeting docs referenced in events | Enables richer AI prep by grounding checklists in real materials |
| In-memory stores (`eventsStore`, `wishlistStore`) | Temporary storage for events/wishlist while prototyping | Keeps data flow simple without database overhead for MVP |
| Google Calendar extended properties | Persist `isAnalyzed` metadata on real events | Survives server restarts, avoids duplicate analysis for synced events |
| Browser `localStorage` | Track daily Morning Review completion | Lightweight persistence for user-specific UI state |
| `documentProcessor` service | Detect/summarize Google Docs URLs before LLM prompt | Compresses large docs to fit token limits and improves analysis quality |
| `calendarConflictService` | Conflict detection and alternative slot suggestions | Encapsulates scheduling logic for reuse by voice assistant & UI |
| npm scripts + concurrently + nodemon | Local development workflow, parallel client/server start | Speeds up feedback loop, hot reloads without manual restarts |
| Voice Interface | MediaRecorder + Whisper (OpenAI) for STT, Web Speech API for TTS, custom `VoiceAssistant` | Accurate transcription across accents, browser-native playback, supports follow-up loop orchestration |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   App.js    │  │CalendarEvents│  │    VoiceAssistant     │  │
│  │             │  │              │  │                       │  │
│  │ - Routing   │  │ - Event List │  │ - Speech Recognition  │  │
│  │ - Nav Menu │  │ - Calendar   │  │ - Speech Synthesis    │  │
│  │             │  │ - Analysis   │  │ - Voice Commands      │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ EventAnalysis│  │  Wishlist   │  │    GoogleAuth        │ │
│  │              │  │              │  │                       │ │
│  │ - AI Analysis│  │ - Item List  │  │ - OAuth Flow         │ │
│  │ - Checklists │  │ - Matching   │  │ - Session Mgmt       │ │
│  │ - Uber Modal │  │ - Find Time  │  │                       │ │
│  │ - Meal Plans │  │             │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST API
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Server (Express.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  /api/voice │  │ /api/calendar│  │   /api/wishlist       │  │
│  │             │  │              │  │                       │  │
│  │ - Process   │  │ - Events CRUD│  │ - Items CRUD          │  │
│  │ - Create    │  │ - Google Sync│  │ - Find Time           │  │
│  │ - Delete    │  │              │  │ - Matching            │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  /api/analyze│  │ /api/google- │  │   Services            │ │
│  │              │  │   calendar   │  │                       │ │
│  │ - Event      │  │ - Auth       │  │ - EventAgent          │ │
│  │   Analysis   │  │ - Sync       │  │ - EventAnalyzer       │ │
│  │ - Document   │  │              │  │ - WishlistAnalyzer    │ │
│  │   Context    │  │              │  │ - VoiceAdapter       │ │
│  │ - Meal Plans │  │              │  │ - ConflictService    │ │
│  └──────────────┘  └──────────────┘  │ - EventsStore        │ │
│                                      │ - WishlistStore      │ │
│                                      │ - DocumentProcessor  │ │
│                                      │ - MCPMealPlanClient  │ │
│                                      └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
          ┌─────────▼────────┐  ┌────────▼─────────┐
          │  OpenAI API     │  │ Google Calendar  │
          │  (LLM)          │  │     API         │
          │                 │  │                  │
          │ - Event Analysis│  │ - OAuth2         │
          │ - Voice Parsing │  │ - Event Sync     │
          │ - Matching      │  │ - Metadata       │
          │ - Meal Fallback │  │                  │
          └─────────────────┘  └──────────────────┘
                    │
          ┌─────────▼────────┐  ┌────────▼─────────┐
          │ Spoonacular API │  │ Python MCP Server│
          │                 │  │                  │
          │ - Meal Plans    │  │ - Subprocess     │
          │ - Recipes       │  │ - Venv Isolated  │
          │ - Nutrition     │  │ - CLI Mode       │
          └─────────────────┘  └──────────────────┘
```

## Component Structure

### Frontend Components

```
App.js (Root)
├── Navigation (Home, Today's Events, Generate Event Milestones, Wishlist)
├── CalendarEvents (Main calendar view)
│   ├── EventAnalysis (AI checklist panel)
│   ├── EventDetails (Event details panel)
│   ├── VoiceAssistant (Voice commands)
│   └── GoogleAuth (Authentication)
└── Wishlist (Wishlist management)
```

### Backend Services

```
server/
├── server.js (Express app, routes setup)
├── eventAnalyzer.js (AI event analysis orchestrator)
├── routes/
│   ├── voice.js (Voice command processing)
│   ├── googleCalendar.js (Google Calendar integration)
│   ├── wishlist.js (Wishlist management)
│   └── uber.js (Uber booking - mock)
└── services/
    ├── voice/
    │   ├── VoiceAdapter.js (Abstract interface)
    │   ├── OpenAIVoiceAdapter.js (LLM-based parsing)
    │   ├── MockVoiceAdapter.js (Fallback)
    │   └── VoiceAdapterFactory.js (Factory pattern)
    ├── eventAgent.js (Agentic event analysis with meal planning)
    ├── mcpMealPlanningClient.js (Python MCP server integration)
    ├── eventsStore.js (In-memory event storage)
    ├── wishlistStore.js (Wishlist item storage)
    ├── documentProcessor.js (Google Docs content + summarization)
    ├── calendarConflictService.js (Conflict detection)
    ├── taskCache.js (Remaining task tracking)
    └── weatherService.js (Weather integration)
```

## Data Flow

### 1. Voice Command Flow

```
User speaks → VoiceAssistant (MediaRecorder)
    ↓
POST /api/voice/transcribe { audio }
    ↓
Whisper (OpenAI) → transcript + confidence
    ↓
POST /api/voice/process { transcript, context }
    ↓
Intent: add_event | delete_event | add_to_wishlist
    ↓
┌─────────────────┬──────────────────┬─────────────────────┐
│   add_event      │  delete_event    │  add_to_wishlist     │
│                 │                  │                      │
│ Check conflicts │ Find event       │ Add to WishlistStore │
│ ↓               │ ↓                │ ↓                    │
│ Create event    │ Delete event     │ Return success       │
│ (Google/local)  │ (Google/local)   │                      │
└─────────────────┴──────────────────┴─────────────────────┘
```

### 2. Event Analysis Flow

```
User clicks "Generate Checklist"
    ↓
POST /api/analyze-event { event }
    ↓
Server checks metadata (event.isAnalyzed / Google extended properties)
    ↓
If already analyzed → return cached remaining tasks
    ↓
EventAnalyzer gathers context (description edits, Google Docs URLs, weather)
    ↓
Detect if meal prep event → shouldAttemptMealPlan = true
    ↓
If meal prep detected:
  ├─ Show meal plan preferences form (days, people, diet, calories)
  ├─ User submits → POST /api/generate-meal-plan
  ├─ Try Spoonacular API (via Python MCP server)
  └─ If fails → LLM fallback with user preferences
    ↓
EventAgent (OpenAI) generates tasks, checklists, timelines
    ↓
Response returned to client
    ↓
User selects tasks → POST /api/add-ai-tasks
    ↓
Tasks added to Google Calendar with metadata
    ↓
Original event marked as analyzed (isAnalyzed: true, tasksCount: N)
```

### 3. Wishlist Matching Flow

```
User clicks "Find Time" in Wishlist tab
    ↓
POST /api/wishlist/find-time { events, daysToCheck: 14 }
    ↓
WishlistStore.getUnscheduledItems()
    ↓
findFreeSlots() (2+ hour gaps)
    ↓
WishlistAnalyzer.matchItemsToSlots()
    ↓
For each item: analyzeItem() → estimate duration
    ↓
LLM matching: match items to slots
    ↓
Generate suggestion messages (LLM)
    ↓
Return top 3 matches
    ↓
Frontend shows matches → User chooses → Schedule
```

## Key Services

### VoiceAdapter (Strategy Pattern)

```
VoiceAdapter (Abstract)
    │
    ├── OpenAIVoiceAdapter
    │   └── Uses GPT-3.5-turbo for:
    │       - Intent parsing (add/delete/wishlist)
    │       - Event detail extraction
    │       - Follow-up questions (max 5)
    │       - Response generation
    │
    └── MockVoiceAdapter
        └── Fallback when OpenAI unavailable
            - Basic regex parsing
            - Simple templated responses
```

### EventAgent

- **Purpose**: Agentic event preparation analysis with meal planning
- **Model**: GPT-3.5-turbo
- **Output**: Structured JSON with tasks, checklists, priorities, meal plans
- **Architecture**: Modular agent with tool integration (MCP meal planning)
- **Features**:
  - Meal prep detection (keywords: meal, lunch, dinner, breakfast, snack + prep)
  - Spoonacular API integration via Python MCP server subprocess
  - LLM fallback for meal planning when Spoonacular fails
  - User preferences integration (days, people, diet, calories, exclusions)
  - Context-specific checklists (travel, music, meal prep, etc.)
  - Task date/time suggestions (always future)

### EventAnalyzer

- **Purpose**: Orchestrates event analysis workflow
- **Responsibilities**: 
  - Gathers context (weather, documents, meal plans)
  - Calls EventAgent for AI analysis
  - Manages metadata (isAnalyzed flags)
  - Handles caching of remaining tasks
- **Document Context**: Fetches/summarizes Google Docs linked in event descriptions
- **Metadata**: Uses `isAnalyzed` flags (local + Google extended properties) to prevent duplicate analyses

### WishlistAnalyzer

- **Purpose**: Match wishlist items to free calendar slots
- **Model**: GPT-3.5-turbo
- **Features**:
  - Duration estimation for activities
  - Smart matching (time of day, day of week, location)
  - Generates personalized suggestion messages
  - Returns top 3 matches

### Storage Services

#### EventsStore
- In-memory store for calendar events
- Syncs with Google Calendar
- Handles both mock and real events

#### WishlistStore
- In-memory store for wishlist items
- Auto-cleanup of past-dated items
- Supports scheduled (with date/time) and unscheduled items

#### Metadata Tracking
- Analyzed status stored on events (React state) and via Google Calendar extended properties
- Prevents re-analysis once checklist tasks have been scheduled
- Cleared when events are deleted or refreshed

## API Endpoints

### Voice Routes (`/api/voice`)

- `POST /transcribe` - Convert audio input to text via Whisper
- `POST /process` - Parse voice transcript, return intent and event details
- `POST /check-conflict` - Check for calendar conflicts, suggest alternatives
- `POST /create-event` - Create calendar event (Google or local)
- `POST /add-to-wishlist` - Add item to wishlist via voice
- `POST /update-wishlist` - Update wishlist item details via voice
- `POST /delete-wishlist` - Remove a wishlist item via voice
- `POST /generate-response` - Generate voice response message

### Calendar Routes (`/api/calendar`)

- `GET /events` - Get all calendar events
- `DELETE /events/:eventId` - Delete event (Google or local)

### Wishlist Routes (`/api/wishlist`)

- `GET /items` - Get all active wishlist items (auto-cleanup past items)
- `POST /items` - Add wishlist item
- `DELETE /items/:id` - Delete wishlist item
- `POST /find-time` - Find free slots and match wishlist items
- `POST /analyze-item` - Analyze single item for duration estimation

### Analysis Routes (`/api`)

- `POST /analyze-event` - Analyze event and generate checklist
- `POST /generate-meal-plan` - Generate meal plan with user preferences
- `POST /add-ai-tasks` - Add AI-generated tasks to calendar
- `GET /event-status/:eventId` - Get analysis metadata for event

### Google Calendar Routes (`/api/google-calendar`)

- `GET /auth` - Initiate OAuth flow
- `GET /callback` - OAuth callback handler
- `POST /events` - Fetch events from Google Calendar
- `POST /disconnect` - Disconnect Google Calendar

## Data Models

### Event

```javascript
{
  id: string,
  title: string,
  date: string (ISO), // or YYYY-MM-DD
  time: string (HH:MM),
  endDate: string (ISO),
  duration: number (minutes),
  location: string,
  description: string,
  type: string, // 'meeting', 'travel', 'band practice', etc.
  isAnalyzed: boolean,
  isChecklistEvent: boolean,
  isGeneratedEvent: boolean,
  isRecurring: boolean,
  category: string,
  // Google Calendar specific
  eventId: string, // Google Calendar ID
  createdInGoogle: boolean
}
```

### WishlistItem

```javascript
{
  id: string,
  title: string,
  description: string,
  date: string (YYYY-MM-DD) | null,
  time: string (HH:MM) | null,
  duration: number (minutes) | null,
  priority: 'low' | 'medium' | 'high',
  location: string | null,
  category: string,
  createdAt: string (ISO),
  updatedAt: string (ISO),
  source: 'voice' | 'manual'
}
```

### Analysis Result

```javascript
{
  eventSummary: string,
  preparationTasks: [
    {
      id: string,
      task: string,
      priority: 'High' | 'Medium' | 'Low',
      checklist: string[],
      suggestedDate: string (ISO),
      suggestedTime: string (HH:MM),
      estimatedDuration: number
    }
  ],
  tips: string[],
  timeline: Record<string, string[]>
}
```

## State Management

### Frontend State

- **React useState/useEffect**: Component-level state
- **Props**: Parent-child communication
- **Callbacks**: Cross-component updates
- **localStorage**: Morning review date tracking

### Backend State

- **In-memory stores**: EventsStore, WishlistStore
- **Session-based**: Google Calendar tokens (express-session)
- **Metadata flags**: `isAnalyzed` stored on events and Google extended properties

## Authentication Flow

```
User clicks "Sign in with Google"
    ↓
GET /api/google-calendar/auth
    ↓
Redirect to Google OAuth consent screen
    ↓
User grants permissions
    ↓
GET /api/google-calendar/callback?code=...
    ↓
Exchange code for tokens
    ↓
Store tokens in session
    ↓
Fetch user info & calendar events
    ↓
Return to app (authenticated)
```

## AI Integration Points

### 1. Voice Transcription (Whisper)
- **When**: VoiceAssistant finishes recording audio
- **Model**: whisper-1 (OpenAI)
- **Input**: Audio blob (webm/ogg/mp3) captured via MediaRecorder
- **Output**: Transcript text, segment timings, confidence heuristics

### 2. Event Analysis (EventAnalyzer)
- **When**: User clicks "Analyze Event"
- **Model**: GPT-3.5-turbo
- **Input**: Event details, weather data (if available)
- **Output**: Structured preparation tasks and checklists

### 3. Voice Intent Parsing (OpenAIVoiceAdapter)
- **When**: User speaks a command
- **Model**: GPT-3.5-turbo
- **Input**: Transcript, conversation history
- **Output**: Intent, event details, follow-up questions

### 4. Wishlist Matching (WishlistAnalyzer)
- **When**: User clicks "Find Time"
- **Model**: GPT-3.5-turbo
- **Input**: Wishlist items, free time slots
- **Output**: Matched items with reasoning and suggestions

### 5. Meal Plan Generation (EventAgent + MCP)
- **When**: User analyzes meal prep event and submits preferences
- **Primary**: Spoonacular API via Python MCP server (subprocess)
- **Fallback**: GPT-3.5-turbo with user preferences
- **Input**: Event details, user preferences (days, people, diet, calories, exclusions)
- **Output**: Formatted meal plan with recipes, ingredients, nutrition (or AI-generated equivalent)

## External Services

### Google Calendar API
- **Purpose**: Sync real calendar events
- **Auth**: OAuth 2.0
- **Operations**: Read events, create events, delete events
- **Scopes**: `calendar.events.readonly`, `calendar.events`

### OpenAI API
- **Purpose**: LLM-powered analysis and parsing
- **Model**: GPT-3.5-turbo (analysis), Whisper-1 (transcription)
- **Usage**:
  - Voice transcription (Whisper)
  - Event analysis (checklists, preparation tasks)
  - Voice command parsing (intent, details, follow-ups)
  - Wishlist matching (duration estimation, suggestions)
  - Meal plan fallback (when Spoonacular unavailable)

### Spoonacular API
- **Purpose**: Professional meal planning and nutrition data
- **Integration**: Called via Python MCP server subprocess
- **Features**:
  - Weekly/daily meal plan generation
  - Recipe details with ingredients and instructions
  - Nutritional information (calories, macros)
  - Dietary restrictions and preferences support
- **Fallback**: LLM-generated meal plans when API unavailable

## Recent Changes

### Latest Updates (Nov 2025)

1. **Meal Plan Generation with LLM Fallback** ⭐ NEW
   - Automatic meal prep event detection (keywords: meal, lunch, dinner + prep)
   - User preferences form (days, people, diet, calories, exclusions)
   - Primary: Spoonacular API via Python MCP server subprocess
   - Fallback: LLM-generated meal plans with user preferences
   - Automatic venv detection (`.mealplan-venv/bin/python`)
   - Enhanced error handling with specific failure messages
   - Source indicators (Spoonacular vs LLM) in UI and logs

2. **Metadata-based Analysis Tracking**
   - Removed in-memory analysis cache
   - `isAnalyzed` stored on events and Google extended properties
   - Prevents duplicate checklist generation
   - Enhanced logging for Google Calendar sync debugging

3. **Task Cache System**
   - Server-side cache for remaining (unscheduled) tasks
   - Hydration support for analyzed events
   - Linked tasks tracking with `tasksCount` metadata

4. **Document-Aware Checklists**
   - Event descriptions can include Google Docs URLs
   - `documentProcessor` fetches/summarizes docs for EventAnalyzer prompts

5. **Calendar UX Improvements**
   - Calendar highlights the active event day
   - Uniform action buttons ("Add to Calendar", "Re-generate checklist")
   - Navigation tab renamed to "Generate Event Milestones"
   - Meal plan preferences modal with form validation

6. **Logo & Visual Refresh**
   - Updated header logo
   - Streamlined Uber booking entry point inside checklist items only

7. **Whisper-powered Voice Capture**
   - Browser records audio with MediaRecorder
   - Audio sent to `/api/voice/transcribe` for Whisper STT
   - Transcript fed into existing intent parsing and follow-up flow

## File Organization

```
CalendarAIAgent/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CalendarEvents.js      # Main calendar view
│   │   │   ├── EventAnalysis.js        # AI analysis panel
│   │   │   ├── VoiceAssistant.js       # Voice commands
│   │   │   ├── Wishlist.js             # Wishlist management
│   │   │   ├── GoogleAuth.js           # OAuth flow
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── googleCalendarService.js
│   │   └── App.js                       # Root component
│   └── package.json
├── server/
│   ├── server.js                        # Express app
│   ├── eventAnalyzer.js                 # AI event analysis orchestrator
│   ├── routes/
│   │   ├── voice.js                     # Voice endpoints
│   │   ├── googleCalendar.js            # Google Calendar API
│   │   └── wishlist.js                  # Wishlist endpoints
│   └── services/
│       ├── voice/                       # Voice adapters
│       ├── eventAgent.js                # Agentic analysis with meal planning
│       ├── mcpMealPlanningClient.js     # Python MCP server integration
│       ├── eventsStore.js               # Event storage
│       ├── wishlistStore.js             # Wishlist storage
│       ├── documentProcessor.js         # Google Docs processing
│       ├── taskCache.js                 # Remaining task tracking
│       └── calendarConflictService.js   # Conflict detection
├── mcp-servers/
│   └── meal-planning/
│       ├── meal_planning_server.py      # Python MCP server
│       ├── requirements.txt             # Python dependencies
│       └── .mealplan-venv/              # Python virtual environment
├── ARCHITECTURE.md                      # This file
└── package.json
```

## Future Enhancements

- [ ] Persistent storage (database instead of in-memory)
- [ ] User accounts and multi-user support
- [ ] Real Uber API integration
- [ ] Calendar sharing and collaboration
- [ ] Mobile app (React Native)
- [ ] Push notifications for wishlist suggestions
- [ ] Recurring event handling improvements
- [ ] **Task delegation system** – see [DELEGATION_DESIGN.md](./DELEGATION_DESIGN.md) for detailed architecture
- [ ] **Document upload for meeting prep** – see [DOCUMENT_UPLOAD_DESIGN.md](./DOCUMENT_UPLOAD_DESIGN.md) for analysis and phased approach