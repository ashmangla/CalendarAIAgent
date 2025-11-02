# Delegation System - Architecture Design

## Requirements Analysis

### Core Functionality Needed
1. **Contact/Family Member Management**
   - Store family members/contacts
   - Link contacts to main user account
   - Contact info (name, email, phone, relationship)

2. **Task Assignment**
   - Assign tasks to specific family members
   - Track assignment status (pending, accepted, declined, completed)
   - Allow reassignment
   - Track original assigner

3. **Notification & Communication**
   - Notify delegatee when task assigned
   - Notify assigner when task accepted/declined/completed
   - Communication channel (email, in-app, SMS?)

4. **Task Visibility**
   - Assigned tasks appear in delegatee's view
   - Original assigner sees status
   - Shared calendar or separate "Delegated Tasks" view?

5. **Task Completion**
   - Delegatee marks task complete
   - Original assigner notified
   - Task completion affects original event preparation

## Architecture Options

### Option A: Simple Email-Based (MVP)

**Approach**: 
- Store contacts locally
- Send email notifications
- Tasks stay in assigner's calendar but marked "delegated"
- No separate accounts needed

**Pros**:
- Simple to implement
- No authentication complexity
- Works immediately
- Low infrastructure needs

**Cons**:
- No centralized task tracking
- Assignee doesn't see task in their calendar
- Limited status updates
- Requires email service

**Data Model**:
```javascript
Contact {
  id: string,
  name: string,
  email: string,
  phone?: string,
  relationship: 'spouse' | 'child' | 'parent' | 'other',
  createdAt: string
}

TaskAssignment {
  id: string,
  taskId: string, // Reference to calendar event
  assignerId: string, // User ID
  assigneeEmail: string, // Contact email
  status: 'pending' | 'accepted' | 'declined' | 'completed',
  assignedAt: string,
  respondedAt?: string,
  completedAt?: string
}
```

---

### Option B: Shared Calendar (Google Calendar Integration)

**Approach**:
- Use Google Calendar shared calendars
- Create task in assignee's shared calendar
- Both parties see it
- Google handles notifications

**Pros**:
- Tasks visible to both parties
- Uses existing Google infrastructure
- Real-time sync
- Familiar calendar interface

**Cons**:
- Requires Google Calendar sharing setup
- Complex permissions management
- Only works with Google Calendar users
- Harder to track status

**Implementation**:
- Create shared calendar per family member
- Add tasks to shared calendar
- Use Google Calendar API sharing features

---

### Option C: In-App Delegation with Accounts (Full Feature)

**Approach**:
- Family members create accounts (or guest accounts)
- Tasks stored separately with assignment metadata
- In-app notification system
- Shared task board view

**Pros**:
- Full control over UX
- Rich status tracking
- Can add comments/updates
- Scalable to teams

**Cons**:
- Complex (authentication, accounts, UI)
- Family members need to sign up
- More infrastructure needed
- Longer development time

**Data Model**:
```javascript
Contact {
  id: string,
  name: string,
  email: string,
  userId?: string, // If they have account
  isRegistered: boolean,
  relationship: string,
  invitedAt: string
}

DelegatedTask {
  id: string,
  originalTaskId: string, // Reference to calendar event
  originalEventId: string,
  assignerId: string,
  assigneeId: string, // Contact ID
  title: string,
  description: string,
  dueDate: string,
  priority: string,
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'declined',
  createdAt: string,
  acceptedAt?: string,
  completedAt?: string,
  comments: Comment[]
}
```

---

### Option D: Hybrid - Simple Assignment + Email (Recommended for MVP)

**Approach**:
- Contacts stored locally (no accounts needed)
- Tasks remain in assigner's calendar
- Add "assignedTo" field to events
- Email notifications for assignments
- Simple status tracking via email replies or in-app
- Optional: Add tasks to assignee's Google Calendar if they share access

**Pros**:
- Balance of simplicity and functionality
- Works with existing architecture
- No complex account system
- Can evolve to Option C later
- Email works for non-users

**Cons**:
- Status updates require manual tracking
- Tasks in assigner's calendar (may be confusing)

---

## Recommended Approach: Option D (Hybrid)

### Implementation Plan

#### Phase 1: Basic Delegation (MVP)
1. **Contact Management**
   - Add contacts/family members
   - Store name, email, relationship
   - Simple CRUD interface

2. **Task Assignment**
   - Add "Delegate" button on tasks in EventAnalysis
   - Select contact from dropdown
   - Mark task with `assignedTo: contactId`
   - Add visual indicator in calendar

3. **Email Notification**
   - Send email when task assigned
   - Include task details and link (if applicable)
   - Simple email template

#### Phase 2: Status Tracking
4. **Task Status**
   - Track: pending, accepted, completed
   - Status visible to assigner
   - Simple status updates

5. **Email Reply Processing** (Optional)
   - Parse email replies for status updates
   - Or: In-app status if assignee has access

#### Phase 3: Enhanced Features
6. **Google Calendar Sharing** (If both use Google)
   - Optionally add to assignee's calendar
   - Requires calendar sharing setup

7. **Task Board View**
   - View all delegated tasks
   - Filter by assignee, status
   - Quick status updates

---

## Data Model Changes

### Event/Task Schema Extension

```javascript
// Add to existing Event model
{
  ...existingFields,
  assignedTo: string | null, // Contact ID
  assignedBy: string | null, // User ID (assigner)
  assignmentStatus: 'pending' | 'accepted' | 'completed' | null,
  assignedAt: string | null,
  acceptedAt: string | null,
  completedAt: string | null
}
```

### New Models

```javascript
// Contact
Contact {
  id: string,
  userId: string, // Owner of this contact list
  name: string,
  email: string,
  phone?: string,
  relationship: string,
  createdAt: string,
  updatedAt: string
}

// Task Assignment (optional separate tracking)
TaskAssignment {
  id: string,
  taskEventId: string, // Reference to delegated task event
  originalEventId: string, // The main event
  assignerId: string,
  assigneeContactId: string,
  status: 'pending' | 'accepted' | 'declined' | 'completed',
  notes?: string,
  createdAt: string,
  updatedAt: string
}
```

---

## UI Changes Required

### 1. Contact Management Component
- Add "Family/Contacts" tab or section
- CRUD for contacts
- List view with edit/delete

### 2. EventAnalysis Component
- Add "Delegate" button/icon on each task card
- Modal/dropdown to select contact
- Visual indicator for delegated tasks

### 3. Calendar View
- Show badge/icon on delegated tasks
- Different styling for delegated vs personal tasks
- Filter option: "Show delegated tasks"

### 4. Task Details View
- Show assignment info (who it's assigned to)
- Show status (if tracked)
- Option to reassign or cancel assignment

---

## Backend Changes Required

### New Services

1. **ContactService/ContactStore**
   - Manage contacts per user
   - CRUD operations
   - Contact validation

2. **DelegationService**
   - Handle task assignments
   - Status tracking
   - Email notifications
   - Reassignment logic

### New Routes

```
POST /api/contacts - Add contact
GET /api/contacts - Get user's contacts
PUT /api/contacts/:id - Update contact
DELETE /api/contacts/:id - Delete contact

POST /api/delegate/task - Delegate task to contact
GET /api/delegate/tasks - Get delegated tasks (filtered by assigner/assignee)
PUT /api/delegate/task/:id/status - Update assignment status
POST /api/delegate/task/:id/reassign - Reassign task
```

### Modified Routes

```
POST /api/add-ai-tasks
  - Add `assignedTo` parameter
  - Create task with assignment info
  - Send notification email
```

---

## Notification Strategy

### Email Notifications

**When Task Assigned**:
```
Subject: [MotherBoard] Task Assigned: "Pack instrument case"

Hi [Contact Name],

[Your Name] has assigned you a preparation task for their event:
"[Original Event Title]" on [Date]

Task: [Task Title]
Due: [Suggested Date/Time]
Priority: [High/Medium/Low]
Description: [Task description]

[Optional: Link to view/accept in app]

Reply to this email to update status (accepted/declined/completed)
```

**Email Service Options**:
- **Nodemailer** (Simple, SMTP)
- **SendGrid** (Reliable, API-based)
- **AWS SES** (Scalable, AWS ecosystem)

---

## Integration Points

### Where to Add Delegation

1. **EventAnalysis Component** (`client/src/components/EventAnalysis.js`)
   - Add "Delegate" button on task cards
   - Modal to select contact
   - Visual indicator for delegated tasks

2. **Task Creation** (`server/server.js` - `/api/add-ai-tasks`)
   - Accept `assignedTo` parameter
   - Set assignment metadata
   - Trigger email notification

3. **Event Display** (`client/src/components/CalendarEvents.js`)
   - Show delegation badge/icon
   - Filter delegated tasks
   - Status indicators

4. **New: Contacts Component**
   - Manage family members
   - Add/edit/delete contacts

---

## Technical Considerations

### Email Service Setup
- Need email service (SMTP or API)
- Email templates
- Reply parsing (if tracking via email)
- Rate limiting (don't spam)

### Storage
- Contacts: In-memory store (like EventsStore)
- Assignments: Can use extendedProperties in Google Calendar or separate store
- For MVP: Both in-memory, can migrate to DB later

### Authentication
- **For MVP**: No authentication needed for contacts
- Contacts belong to session/user
- Later: Can add contact sharing between family members

### Google Calendar Integration
- If assignee has Google Calendar and shares access:
  - Can add task directly to their calendar
  - Requires calendar sharing permissions
  - More complex but better UX

---

## MVP Implementation Checklist

### Phase 1 (Basic)
- [ ] Create ContactStore service
- [ ] Create Contacts UI component
- [ ] Add "Delegate" button to EventAnalysis
- [ ] Modify `/api/add-ai-tasks` to accept `assignedTo`
- [ ] Add assignment metadata to event model
- [ ] Basic email notification (using Nodemailer)
- [ ] Visual indicators in calendar

### Phase 2 (Status Tracking)
- [ ] Track assignment status
- [ ] Status update endpoints
- [ ] UI for status display
- [ ] Email reply parsing (optional)

### Phase 3 (Enhanced)
- [ ] Task reassignment
- [ ] Delegated tasks filter view
- [ ] Comments/notes on assignments
- [ ] Google Calendar sharing option

---

## Open Questions

1. **Do family members need accounts?**
   - **MVP**: No, email-based is fine
   - **Future**: Could add guest accounts

2. **Where should delegated tasks appear?**
   - **Option A**: Only in assigner's calendar (marked as delegated)
   - **Option B**: Also in assignee's calendar (if Google Calendar sharing)
   - **Option C**: Separate "Delegated Tasks" board

3. **How to handle task completion?**
   - **MVP**: Assigner manually marks complete
   - **Future**: Assignee can mark complete (requires account/access)

4. **Notification channel?**
   - **MVP**: Email only
   - **Future**: In-app notifications, SMS, push notifications

5. **Reassignment?**
   - **MVP**: Cancel and reassign manually
   - **Future**: One-click reassignment

---

## Recommended Path Forward

1. **Start with Option D (Hybrid)**
   - Simple contact management
   - Email notifications
   - Basic status tracking
   - Visual indicators

2. **Evolve as needed**
   - Add Google Calendar sharing if both parties use it
   - Add account system if family members want in-app access
   - Add task board if delegation becomes frequent

3. **Keep it simple initially**
   - Don't over-engineer
   - Focus on core use case: "I need someone to do this task"
   - Add complexity only when needed

---

## Estimated Complexity

- **MVP (Phase 1)**: ~2-3 days
  - Contact management: 1 day
  - Task assignment: 1 day
  - Email notifications: 0.5 day
  - UI integration: 0.5 day

- **Phase 2**: +1-2 days
  - Status tracking: 1 day
  - Status UI: 0.5 day
  - Email parsing (optional): 0.5 day

- **Phase 3**: +2-3 days
  - Reassignment: 0.5 day
  - Task board: 1 day
  - Google Calendar sharing: 1-1.5 days

