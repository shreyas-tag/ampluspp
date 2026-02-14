# AMP CRM - Lead to Client Project Management System

This repository now contains a complete starter for an internal backoffice CRM:

- `ampluspp/be/` -> Node.js + Express + MongoDB backend
- `ampluspp/fe/` -> React + Vite frontend

## Implemented Core Flow

- Role-based login (`ADMIN`, `USER`)
- Lead creation (manual + WordPress webhook)
- Shared lead list across users with search/filter
- Lead heat color coding (`HOT`, `WARM`, `COLD`) based on last interaction
- Lead detail timeline with dated notes and call logs
- Lead conversion -> auto create `Client` + `Project`
- Direct client creation with optional auto project
- Project milestones + tasks + comments + PDF uploads
- Milestone/task/project timeline tracking
- Static catalog in DB: 3 categories + 33 schemes/services
- Browser real-time updates via Socket.IO + notification feed
- Browser notification API support
- Enterprise UI flow:
  - separate list and create pages for leads/clients
  - modal actions and confirmation dialogs for critical transitions
  - standardized tags/badges/status chips
- Reporting-ready data capture:
  - lead first-response metrics
  - communication stats counters
  - lead status history and project stage history
  - audit logs on key operations

## Backend Setup (`ampluspp/be`)

1. Create env file:

```bash
cd /Users/shreyas/FinallyTogether/amp/ampluspp/be
cp .env.example .env
```

2. Install dependencies and run:

```bash
npm install
npm run dev
```

3. Seed static catalog:

```bash
npm run seed:all
```

4. Create first admin user in `users` collection (role `ADMIN`):

```bash
npm run create:admin -- --name="Admin Name" --email="admin@yourcompany.com" --password="StrongPassword123!"
```

### WordPress Contact Form Intake Endpoint

- Endpoint: `POST /api/leads/webform`
- Header: `x-webhook-key: <WORDPRESS_WEBHOOK_KEY>` (if configured)
- Body example:

```json
{
  "companyName": "ABC Pvt Ltd",
  "contactPerson": "John",
  "mobileNumber": "9876543210",
  "email": "john@abc.com",
  "city": "Pune",
  "state": "Maharashtra",
  "message": "Interested in subsidy guidance"
}
```

### Reporting Summary Endpoint

- Endpoint: `GET /api/meta/report-summary`
- Returns:
  - conversion rate
  - average first response time
  - task completion rate
  - stage distribution
  - audit events in last 7 days

## Frontend Setup (`ampluspp/fe`)

1. Create env file:

```bash
cd /Users/shreyas/FinallyTogether/amp/ampluspp/fe
cp .env.example .env
```

2. Install dependencies and run:

```bash
npm install
npm run dev
```

3. Login with the admin user you created in DB using `create:admin`.

## Key Frontend Routes

- `/leads` -> lead list
- `/leads/new` -> create lead
- `/leads/:id` -> lead detail + action dialogs
- `/clients` -> client list
- `/clients/new` -> create client
- `/projects` -> project list
- `/projects/:id` -> project execution board
- `/users` -> admin user management

## Notes for Scale & Next Modules

- Architecture is modular by domains: auth, leads, clients, projects, catalog, notifications
- Static catalog already stored in MongoDB (not text/json)
- Easy extension points: payment tracker, accounts module, WhatsApp integration, reminders scheduler, audit trails
