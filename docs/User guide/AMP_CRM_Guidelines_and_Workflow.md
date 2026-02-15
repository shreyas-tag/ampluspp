# Amplus CRM - Complete User Guide and Operational SOP

## 1. Purpose and Scope
This document is the operational source of truth for using Amplus CRM.

It covers the complete lifecycle:
Lead -> Client -> Project -> Milestones -> Tasks -> Documents -> Completion

This guide is written for teams who have never used the system before and need clear day-to-day usage instructions.

## 2. System Modules in Current Build
- Authentication and role-based access (`ADMIN`, `USER`)
- User management (admin only)
- Lead management (manual entry and WordPress webhook intake)
- Lead creation wizard (step-based intake flow)
- Lead communication (notes, calls, status, follow-up)
- Lead temperature and bucketing (`HOT`, `WARM`, `COLD`, `CONVERTED`)
- Client management
- Lead conversion to client + project
- Project stages, milestones, and tasks
- Task comments and PDF attachments
- Invoice management (client/project-wise)
- Invoice details page and in-app PDF viewer page
- Invoice payment tracking and invoice PDF export
- Automated task/milestone/stage/project progression
- Dashboard and pending-work views
- Notifications and live activity panel
- Admin system settings (including webhook controls)
- Audit logging

## 3. Roles and Permissions
### ADMIN
- Full access to all modules and records
- Can manage users and settings
- Can create/edit project structure (milestones/tasks)
- Can assign/reassign task owners and deadlines
- Always sees Live Activity panel
- Can enable/disable Live Activity visibility for non-admin users
- Can configure WordPress webhook key and activation state
- Can create/update invoices, record offline payments, and update invoice status

### USER
- Can work on lead and project records
- Can see assigned project execution scope
- Can add notes/calls and perform assigned task actions
- Cannot change admin-only settings or user management
- Live Activity visibility depends on admin setting

## 4. First-Time Admin Setup
1. Log in with admin credentials.
2. Go to `Settings` -> `System Config`.
3. Configure `Live Activity for Users` as required.
4. Configure `WordPress Contact Form Webhook`:
- Enter secure webhook key.
- Keep webhook enabled if website intake should be active.
- Save config.
5. Create required users in user management.
6. Verify categories/schemes are present in DB.

## 5. Lead Intake Standards (Manual + Website)

## Required lead identity fields
- Name of Promoter / Authorized Person
- Name of Enterprise / Business
- Phone Number

## Recommended primary contact fields
- Contact Person (if different)
- Email

## Location fields
- Address
- Taluka / Tehsil
- District
- City
- State

## Business profile fields
- Business Constitution Type
- Project Land Detail
- Gender of Partners / Directors
- Caste of Promoter / Partners / Entrepreneurs
- Manufacturing or Processing Details

## Financial fields
- Investment in Building / Construction
- Investment in Land
- Investment in Plant & Machinery
- Total Investment
- Bank Loan (If Any)
- Bank Loan (%)
- Own Contribution / Margin (%)

## Project context fields
- Project Type
- Availed Subsidy Previously
- Specific Ask / Highlight about Project

## Operational fields
- Source
- Requirement Type
- Next Follow-up

All of these fields are now supported in:
- Manual lead creation form
- Website webhook ingestion mapping
- Lead details display
- Lead details edit modal

## 6. WordPress Webhook Configuration and Usage

## Endpoint and security
- Endpoint: `/api/leads/webform`
- Header: `x-webhook-key`
- Request method: `POST`
- Content type: `application/json`

## Configuration behavior
- `Configured` means system has a webhook key (DB or env fallback).
- `Active` means key exists and webhook is enabled by admin setting.
- If disabled, website lead creation is blocked by design.

## Where to configure
- Admin path: `Settings` -> `System Config` -> `WordPress Contact Form Webhook`
- You can:
- Set/replace webhook key
- Enable/disable webhook intake
- Clear webhook key
- Copy endpoint/header instructions
- View `Last webhook received` status

## Website payload mapping
The webhook accepts both CRM-style keys and label-style keys from form plugins.

Core accepted keys include:
- `companyName` / `nameOfTheEnterpriseBusiness`
- `contactPerson` / promoter aliases
- `mobileNumber` / `phoneNo`
- `email` / `emailId`

Extended keys are mapped to full lead profile fields (location, business type, investment, finance mix, subsidy history, specific ask).

## 7. End-to-End Workflow

## Stage 1: Lead Creation
1. Create lead manually through the stepper flow or receive from website webhook.
2. Lead create steps:
- `Basic Details`
- `Location & Profile`
- `Financial Scope`
- `Operations`
2. Validate contact and business profile fields.
3. Confirm lead appears in lead list.

## Stage 2: Lead Qualification
1. Update status (`NEW`, `CONTACTED`, `FOLLOW_UP`, `LOST`, `CONVERTED`).
2. Add notes after each meaningful interaction.
3. Log calls with date/time, duration, and summary.
4. Set next follow-up.
5. Add follow-up reports (`1`, `2`, `3`) as needed; multiple entries per report number are supported.

## Stage 3: Lead Buckets and Priority
Lead buckets are automatic by recency:
- `HOT`: updated in last 2 days
- `WARM`: no update for 3-4 days
- `COLD`: no update for 5+ days
- `CONVERTED`: moved to converted bucket

## Stage 4: Lead Conversion
1. Use `Convert to Client` on qualified lead.
2. System creates:
- Client record
- Linked project
- Default milestones/tasks
3. Lead is marked converted and shown in converted tab.

## Stage 5: Project Execution
1. Open project stage tabs.
2. Work milestone-by-milestone, task-by-task.
3. Task details include guidance, comments, documents, and audit timeline.

## Stage 6: Task Completion Rules
- Task auto-moves to `IN_PROGRESS` when work starts (comment/upload).
- Task completion can be blocked when required documents are missing.
- Milestone status is auto-derived from task statuses.
- Stage status reflects aggregate milestone progress.
- Project completion is automatic when all required work is closed.

## Stage 7: Monitoring and Closure
1. Use role-specific dashboards:
- Admin: executive analytics and system-wide pending work
- User: "My Work" queue and assigned execution view
2. Validate timelines and audit trail completeness.
3. Confirm all required documents and closure conditions are met.

## Stage 8: Invoice and Payment Tracking
1. Create invoice against client and optionally project.
2. Add line items, tax, and discount details.
3. Set invoice due date and issue status.
4. Record offline payments (amount, method, paid date, reference, note).
5. Update invoice status (`DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`).
6. Open dedicated invoice details page for full invoice operations.
7. Use `View PDF` to open dedicated in-app PDF page.
8. Use PDF controls (zoom, rotate, reset, download) as required.

## 7A. Invoice Navigation Behavior
- From invoice list `Open`: user goes to invoice details page.
- From invoice list `View PDF`: user goes to invoice PDF page.
- From invoice details `View PDF`: user goes to invoice PDF page.
- PDF page `Back` returns to previous context:
- If opened from list -> back to list
- If opened from invoice details -> back to invoice details

## 8. Lead Details Screen - How to Use
From lead details page, users can:
- Update status and follow-up
- Add note
- Log call
- Add structured follow-up reports
- Edit full intake details (all profile fields)
- Convert lead to client/project (when ready)

The `Lead Intake Details` panel is the structured single view of all business, location, finance, and project ask fields.

## 9. Task and Document Collaboration Rules
- Comments should always contain clear action context.
- PDF upload should be used for proof documents.
- Actor and timestamp are preserved for comments, calls, and timeline events.
- Admin/user permissions are enforced for task execution actions.

## 10. Notifications and Live Activity
- Browser notifications are supported.
- Live Activity is real-time and role-aware.
- Admin always sees live activity.
- User visibility is controlled by admin setting.

## 11. Security and Audit Controls
- JWT-protected APIs
- Role-based authorization
- Assignment-aware task execution permissions
- Protected file access routes
- Webhook key validation for website intake
- Invoice lifecycle and payment actions captured in audit logs
- Settings and lifecycle audit events captured in audit logs

## 12. Daily Operations Checklist

## Admin daily checklist
1. Review dashboard and pending work.
2. Check overdue/unassigned tasks.
3. Validate stage progression bottlenecks.
4. Check webhook status (`Configured`, `Active`, `Last received`).
5. Review critical audit entries.

## User daily checklist
1. Review assigned work queue.
2. Update tasks with comments and documents.
3. Keep lead follow-ups updated with next action.
4. Log calls with complete summaries.

## 13. UAT / Handover Validation Checklist
1. Verify login and role behavior.
2. Verify manual lead create with full intake fields.
3. Verify lead details edit for all intake fields.
4. Verify WordPress webhook lead creation with configured key.
5. Verify webhook disable behavior blocks intake correctly.
6. Verify notes/calls/timeline updates.
7. Verify lead bucket behavior (`HOT`, `WARM`, `COLD`, `CONVERTED`).
8. Verify conversion to client + project.
9. Verify task assignment, comments, and PDF attachment flow.
10. Verify automation of task/milestone/stage/project status.
11. Verify dashboard KPIs and pending queue.
12. Verify role-split dashboard behavior (admin analytics vs user workboard).
13. Verify invoice open flow to dedicated details page.
14. Verify invoice PDF opens on dedicated page and back navigation returns to source page.
15. Verify invoice PDF controls (zoom/rotate/reset/download).
16. Verify invoice create/update, status transitions, payment entry, and PDF download.
17. Verify audit logs for major actions.

## 14. Document Control
This guide aligns to implemented code in:
- `/Users/shreyas/FinallyTogether/amp/ampluspp/be`
- `/Users/shreyas/FinallyTogether/amp/ampluspp/fe`

Update this file whenever process, fields, automation rules, or access controls change.
