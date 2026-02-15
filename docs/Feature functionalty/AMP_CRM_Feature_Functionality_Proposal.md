# Amplus CRM - Feature & Functionality Proposal

## 1. Purpose
This document presents what Amplus Subsidy Solutions will receive as part of the CRM platform.

The system will provide an end-to-end operations framework for lead handling, client management, project execution, invoicing, and internal control for back-office teams.

## 2. User Roles
The CRM will support two primary roles:

1. Admin
- Full access across all modules
- User management and role/module access control
- Configuration management and workflow supervision
- Project/invoice governance and operational oversight

2. User
- Access only to assigned modules
- Day-to-day execution based on access rights
- Controlled visibility across lead/client/project workflows

## 3. Dashboard & Operational Visibility
The platform will provide a role-aware dashboard with:

- Admin-specific executive metrics and distribution insights
- User-specific "My Work" execution dashboard
- Pending task visibility with direct action navigation
- Stage-level progress indicators
- KPI readiness for future reports

## 4. Lead Management
The CRM will include complete lead lifecycle management:

- Manual lead creation with structured multi-step intake form
- WordPress contact-form webhook intake
- Lead sharing across authorized users
- Lead pipeline statuses: NEW, CONTACTED, FOLLOW_UP, CONVERTED, LOST
- Lead temperature classification: HOT/WARM/COLD (time-driven)
- Lead notes with author and date-time
- Call log with date-time, duration, and summary
- Follow-up reports (1/2/3) with multiple entries support
- Timeline and activity history for auditability
- Conversion flow from lead to client and project

## 5. Client Management
The CRM will provide a centralized client module:

- Client master creation and maintenance
- Linkage from converted lead or direct onboarding
- Contact and profile tracking
- Client-to-project mapping

## 6. Project Management & Execution
Each converted or onboarded client project will support:

- Milestone-based project structure
- Task-level execution tracking
- Assignment, comments, and collaboration
- PDF document upload for task evidence
- Stage tabs with status indicators
- Automated progression logic based on task completion
- Project timeline with execution events
- Project process tracking panel for operational checkpoints

## 7. Project Process Tracking (Admin-Controlled)
The CRM will provide an admin-managed process-tracking section at project level, including:

- CTA shared date
- Inquiry forwarding date
- Milestone checkpoint dates (M1/M2/M3)
- Advance received date and amount
- Final invoice completion date
- Approx project and service values

All updates will be time-stamped and actor-tracked for reporting and governance.

## 8. Invoice Management
The CRM will include client/project-linked invoice operations:

- Step-based invoice creation and structured editing
- Standard line item based invoice structure
- Tax and discount handling
- Status tracking: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
- Payment entry logging (offline/online reference support)
- Dedicated invoice details page for full lifecycle operations
- Dedicated in-app invoice PDF page (with back navigation context)
- In-app PDF controls: zoom, reset, rotate, and download
- Professional invoice PDF generation with table-safe layout and wrapped line-item descriptions
- View and download invoice PDF

## 9. Notifications & Live Activity
The system will include collaboration support through:

- Browser notifications
- Live activity feed (admin always visible)
- User live-activity visibility controlled by admin setting

## 10. Access Control & Security
The CRM will enforce enterprise-grade access discipline:

- JWT authentication
- Role-based controls (Admin/User)
- Module-level access assignment by admin
- Sidebar and route visibility based on assigned modules
- API-level permission checks
- Report endpoint visibility restricted to authorized admin scope

## 11. Audit & Reporting Readiness
The solution will be built with long-term reporting and compliance readiness:

- Structured data capture across modules
- Timeline and actor tracking
- Audit logs for critical actions
- Data model extensibility for future reports such as:
  - Response time analytics
  - Conversion and communication statistics
  - Stage-wise execution performance
  - Revenue/invoice realization tracking

## 12. Scalability & Future Expansion
The platform will be designed for modular growth.

Future modules can be added without reworking core workflows, including:

- Advanced reporting and exports
- Configurable workflow engine
- SLA and escalation matrix
- Finance and reconciliation extensions
- Broader integration suite

## 13. Deliverables
The CRM delivery will include:

- Web application (frontend + backend)
- Database models and business workflows
- Admin settings and access controls
- Documentation and operational guidance
- Deployment-ready environment placeholders
- Enterprise workflow pages for list -> detail -> PDF navigation journeys

## 14. Outcome
Amplus CRM will provide a structured, controlled, and scalable internal operations system that improves execution discipline, visibility, and decision-making across the full business journey from inquiry to project closure and billing.
