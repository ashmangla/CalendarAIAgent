# MotherBoard - System Architecture

## Overview

MotherBoard is an AI-powered calendar assistant that helps users prepare for events, manage their schedule, and organize wishlist items. The system integrates with Google Calendar and uses OpenAI's LLM for intelligent event analysis and voice command processing.

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
│  │ - Uber Modal │  │             │  │                       │ │
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
│  │ - Event      │  │ - Auth       │  │ - EventAnalyzer       │ │
│  │   Analysis   │  │ - Sync       │  │ - WishlistAnalyzer    │ │
│  │ - Caching    │  │              │  │ - VoiceAdapter       │ │
│  └──────────────┘  └──────────────┘  │ - ConflictService    │ │
│                                      │ - EventsStore        │ │
│                                      │ - WishlistStore      │ │
│                                      │ - AnalysisCache      │ │
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
          │ - Matching      │  │                  │
          └─────────────────┘  └──────────────────┘
```

## Component Structure

### Frontend Components

```
App.js (Root)
├── Navigation (Home, Today's Events, Analyze Events, Wishlist)
├── CalendarEvents (Main calendar view)
│   ├── EventAnalysis (AI analysis panel)
│   ├── EventDetails (Event details panel)
│   ├── VoiceAssistant (Voice commands)
│   └── GoogleAuth (Authentication)
└── Wishlist (Wishlist management)
```

### Backend Services

```
server/
├── server.js (Express app, routes setup)
├── eventAnalyzer.js (AI event analysis)
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
    ├── eventsStore.js (In-memory event storage)
    ├── wishlistStore.js (Wishlist item storage)
    ├── analysisCache.js (AI analysis caching)
    ├── calendarConflictService.js (Conflict detection)
    └── weatherService.js (Weather integration)
```

## Data Flow

### 1. Voice Command Flow

```
User speaks → VoiceAssistant
    ↓
Web Speech API (transcription)
    ↓
POST /api/voice/process { transcript }
    ↓
VoiceAdapter.parseIntent() (LLM or Mock)
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
User clicks "Analyze Event"
    ↓
POST /api/analyze-event { event }
    ↓
Check AnalysisCache (already analyzed?)
    ↓
┌──────────────┬─────────────────────┐
│  Cached      │  Not Cached         │
│  ↓           │  ↓                  │
│ Return cache │ EventAnalyzer       │
│              │   ↓                 │
│              │ OpenAI API          │
│              │   ↓                 │
│              │ Parse response      │
│              │   ↓                 │
│              │ Cache result        │
│              │   ↓                 │
│              │ Return analysis     │
└──────────────┴─────────────────────┘
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

### EventAnalyzer

- **Purpose**: AI-powered event preparation analysis
- **Model**: GPT-3.5-turbo
- **Output**: Structured JSON with tasks, checklists, priorities
- **Caching**: Results cached until event day ends
- **Features**:
  - Weather integration for outdoor events
  - Context-specific checklists (travel, music, etc.)
  - Task date/time suggestions (always future)

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

#### AnalysisCache
- Caches AI analysis results
- Expires at end of event day
- Prevents re-analysis of same events
- Tracks metadata (analyzedAt, expirationDate)

## API Endpoints

### Voice Routes (`/api/voice`)

- `POST /process` - Parse voice transcript, return intent and event details
- `POST /check-conflict` - Check for calendar conflicts, suggest alternatives
- `POST /create-event` - Create calendar event (Google or local)
- `POST /add-to-wishlist` - Add item to wishlist via voice
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
  metadata: {
    analyzedAt: string,
    expirationDate: string,
    fromCache: boolean
  }
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
- **Cache**: AnalysisCache (expires automatically)

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

### 1. Event Analysis (EventAnalyzer)
- **When**: User clicks "Analyze Event"
- **Model**: GPT-3.5-turbo
- **Input**: Event details, weather data (if available)
- **Output**: Structured preparation tasks and checklists

### 2. Voice Intent Parsing (OpenAIVoiceAdapter)
- **When**: User speaks a command
- **Model**: GPT-3.5-turbo
- **Input**: Transcript, conversation history
- **Output**: Intent, event details, follow-up questions

### 3. Wishlist Matching (WishlistAnalyzer)
- **When**: User clicks "Find Time"
- **Model**: GPT-3.5-turbo
- **Input**: Wishlist items, free time slots
- **Output**: Matched items with reasoning and suggestions

## External Services

### Google Calendar API
- **Purpose**: Sync real calendar events
- **Auth**: OAuth 2.0
- **Operations**: Read events, create events, delete events
- **Scopes**: `calendar.events.readonly`, `calendar.events`

### OpenAI API
- **Purpose**: LLM-powered analysis and parsing
- **Model**: GPT-3.5-turbo
- **Usage**:
  - Event analysis (checklists, preparation tasks)
  - Voice command parsing (intent, details, follow-ups)
  - Wishlist matching (duration estimation, suggestions)

## Recent Changes

### Latest Updates (Nov 2024)

1. **Simplified Wishlist**
   - Removed duplicate WishlistReview modal
   - Single Wishlist tab component
   - Shows 3 matches inline with user choice
   - Auto-cleanup of past/scheduled items

2. **LLM-Based Voice Assistant**
   - Follow-up question loop (max 5 questions)
   - Conversation state management
   - Support for wishlist additions via voice

3. **Event Color Coding**
   - Doctor appointments: Bright orange
   - To-dos: Yellow
   - Everyday tasks: Green
   - Work tasks: Blue (with daily meeting variants)

4. **Event Deletion**
   - Delete from both Google Calendar and local events
   - Confirmation dialogs
   - UI cleanup after deletion

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
│   ├── eventAnalyzer.js                 # AI event analysis
│   ├── routes/
│   │   ├── voice.js                     # Voice endpoints
│   │   ├── googleCalendar.js            # Google Calendar API
│   │   └── wishlist.js                  # Wishlist endpoints
│   └── services/
│       ├── voice/                       # Voice adapters
│       ├── eventsStore.js               # Event storage
│       ├── wishlistStore.js             # Wishlist storage
│       ├── analysisCache.js             # Analysis caching
│       └── calendarConflictService.js   # Conflict detection
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
- [ ] **Task delegation system** - See [DELEGATION_DESIGN.md](./DELEGATION_DESIGN.md) for detailed architecture
- [ ] **Document upload for meeting prep** - See [DOCUMENT_UPLOAD_DESIGN.md](./DOCUMENT_UPLOAD_DESIGN.md) for analysis and recommended phased approach

