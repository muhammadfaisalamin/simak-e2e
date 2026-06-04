# SIMAK E2E Test Suite

![Playwright](https://img.shields.io/badge/Playwright-1.58-45ba4b?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088ff?logo=githubactions&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)

A production-grade end-to-end and API test suite for **SIMAK** (Academic Management Information System), a multi-role web application managing student registration, course enrollment, grading, and academic reporting.

---

## Overview

This suite validates three user roles (**Admin**, **Lecturer**, **Student**) across UI and API layers, using a structured approach to test isolation, data management, and CI/CD integration.

| Layer | Tests | Roles Covered |
|---|---|---|
| UI (browser) | 90 | Admin, Student |
| API (headless) | 45 | Admin (session) |
| **Total** | **135** | |

The pipeline runs automatically on every push to `main`, deploys live HTML reports to GitHub Pages, and uses an SSH tunnel to reach the private VPS database securely — no database port ever exposed to the internet.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [Playwright 1.58](https://playwright.dev) | Browser automation + API request testing |
| TypeScript | Type-safe test code and page objects |
| PostgreSQL (`pg`) | Direct SQL access for test data factories |
| Prisma | Schema source of truth for DB structure |
| GitHub Actions | CI/CD pipeline |
| `gh-pages` | Automated HTML report deployment |

---

## Architecture & Design Patterns

### 1. Page Object Model (POM)

Each page has a dedicated class encapsulating locators, navigation, and composite actions. This keeps test files focused on intent, not implementation.

```
tests/
├── admin/pages/
│   ├── AssessmentPage.ts       ← locators + actions for Assessment management
│   ├── CoursePage.ts
│   ├── GradeComponentPage.ts
│   └── ReregistrationPage.ts
└── student/pages/
    └── ReregistrationStudentPage.ts
```

Example pattern — composite action that hides the multi-step UI flow:
```typescript
// In AssessmentPage.ts
async createAssessment(name: string, gcName: string, percentage = '100') {
  await this.openCreateModal();
  await this.fillSingleComponentForm(name, gcName, percentage);
  await this.submitForm();
  await this.nameInput.waitFor({ state: 'hidden' });
}

// In the test — reads like a sentence
await assessmentPage.createAssessment('UTS 2025', 'Ujian Tulis', '100');
```

### 2. Playwright Fixtures for Dependency Injection

Custom fixtures compose the page object, navigation, and cleanup tracker into a single injectable object — keeping tests clean and eliminating boilerplate.

```typescript
export const test = authTest.extend<ReregistrationFixtures>({
  reregistrationPage: async ({ page }, use) => {
    const rp = new ReregistrationPage(page);
    await rp.goto();
    await use(rp);
  },
  trackForCleanup: async ({}, use) => {
    const ids: string[] = [];
    await use({ reregistrationId: (id) => ids.push(id) });
    // Teardown — runs after every test, pass or fail
    for (const id of ids) await deleteReregistrationById(id);
  },
});
```

### 3. SQL Data Factories

Test data is seeded directly via SQL (not through the UI), making setup fast, deterministic, and independent from form validation. 13 factories cover the full domain model.

```
tests/factories/
├── period.factory.ts
├── reregistration.factory.ts
├── reregister-detail.factory.ts
├── krs.factory.ts / khs.factory.ts
├── academic-class.factory.ts
├── schedule.factory.ts
├── course.factory.ts / assessment.factory.ts
├── grade-component.factory.ts
├── major.factory.ts
└── student.factory.ts
```

Each factory is responsible for its own INSERT and DELETE, with FK-aware teardown order to avoid constraint violations.

### 4. Auth State Persistence (storageState)

Login is performed **once per role** in a dedicated setup project, then the session cookie is saved to `.auth/*.json` and reused across all tests in that role — eliminating repeated login overhead.

```typescript
// playwright.config.ts
{ name: 'admin', dependencies: ['setup-admin'],
  use: { storageState: '.auth/admin.json' } }
```

### 5. Test Isolation Strategy

Each test is fully independent:

- **UI tests**: seed data via SQL factory → run test → clean up via SQL (in fixture teardown)
- **API tests**: global setup seeds a shared dataset before all API tests → global teardown removes it after
- No shared mutable state between tests — `fullyParallel: true` within each project

Unique IDs use `randomUUID().slice(0, 8)` to prevent `@@unique` constraint collisions across consecutive runs.

---

## Test Coverage

### UI Tests — Admin Role

| Spec | Scenarios | Pattern |
|---|---|---|
| `grade-component.spec.ts` | CRUD + duplicate validation | POM + fixture + factory |
| `assessment.spec.ts` | CRUD + multi-component form + % validation | POM + fixture + factory |
| `course.spec.ts` | CRUD + search + duplicate validation | POM + fixture + factory |
| `reregistration.spec.ts` | CRUD + activate + period dependency | POM + fixture + factory |
| `dashboard.spec.ts` | Navigation + role-based routing | Auth state |

### UI Tests — Student Role

| Spec | Scenarios | Pattern |
|---|---|---|
| `reregistration-student.spec.ts` | View, form submit, payment status badges, PDF link | POM + fixture + factory |

### API Tests

| Spec | Endpoints | Key Assertions |
|---|---|---|
| `pdf.api.spec.ts` | `/api/pdf` — KRS, KHS, Transcript, Reregister, Assessment, Aggregate reports | Content-Type: `application/pdf`, valid PDF magic bytes |
| `excel.api.spec.ts` | `/api/excel` — 7 report types + schedule export | Content-Type: Excel MIME, 200/400/404 |
| `grade.api.spec.ts` | `/api/grade` — actual grades + empty template | Two export modes, identical filename |
| `avatar.api.spec.ts` | `/api/avatar` — student photo serving | `image/*` MIME, `inline` disposition |
| `payment.api.spec.ts` | `/api/payment` — receipt file, inline/download modes | `Content-Disposition` toggle, byte-identical body |

---

## CI/CD Pipeline

```
Push to main
     │
     ▼
GitHub Actions Runner (ubuntu-latest)
     │
     ├── Checkout + Node.js 20 + npm ci
     ├── Cache Playwright Binaries        ← saves ~90s on cache hit
     ├── Install Playwright Chromium
     │
     ├── SSH Tunnel Setup ─────────────────────────────────────────┐
     │   ├── Write private key (Windows \r safe)                   │
     │   ├── ssh-keyscan (non-fatal)                               │
     │   ├── Test SSH auth with verbose log                        │
     │   └── Open tunnel: runner:5432 ←──SSH──→ VPS:5432          │
     │                                                             │
     ├── Verify port 5432 open (nc -z)                            │
     ├── Reconstruct .env.test from Secrets                       │
     │                                                             │
     ├── npm run test:api ─────────────────────────────────────────┤
     │   ├── setup-admin    → save admin.json (storageState)      │
     │   ├── setup-api-data → INSERT seed rows via tunnel ────────┘
     │   └── api            → HTTP requests to VPS app
     │
     ├── npm run test:ui:clean
     │   ├── setup-admin / setup-student → storageState
     │   └── admin / student → browser tests against VPS app
     │
     ├── Upload HTML reports as artifact  (if: always)
     ├── Deploy to GitHub Pages           (if: push to main)
     │   ├── playwright-report-api/ → /api/
     │   └── playwright-report-ui/  → /ui/
     └── Close SSH Tunnel                 (if: always)
```

**Security note:** The VPS database port (5432) is never exposed to the internet. All factory SQL goes through an encrypted SSH tunnel. The `GITHUB_TOKEN` is passed via environment variable, not printed in script arguments.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL accessible locally or via SSH tunnel
- A running instance of the SIMAK application

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/simak-e2e.git
cd simak-e2e
npm install
npx playwright install chromium
```

### Configuration

Copy and fill in `.env.test`:

```env
TEST_BASE_URL=http://localhost:3000

DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/simakdb

TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=yourpassword

TEST_STUDENT_EMAIL=student@example.com
TEST_STUDENT_PASSWORD=yourpassword

TEST_LECTURER_EMAIL=lecturer@example.com
TEST_LECTURER_PASSWORD=yourpassword
```

### Running Tests

```bash
# UI tests (all roles)
npm run test:ui

# API tests
npm run test:api

# All tests
npm run test:all

# Open HTML report
npm run report:ui
npm run report:api
```

---

## Project Structure

```
simak-e2e/
├── .github/
│   └── workflows/
│       └── e2e-tests.yml          ← GitHub Actions pipeline
│
├── tests/
│   ├── auth/                      ← Login setup per role (storageState)
│   │   ├── admin.setup.ts
│   │   ├── lecturer.setup.ts
│   │   └── student.setup.ts
│   │
│   ├── admin/
│   │   ├── pages/                 ← Page Object Models
│   │   ├── courses/               ← Grade component, Assessment, Course specs
│   │   └── reregistrations/      ← Reregistration CRUD spec
│   │
│   ├── student/
│   │   ├── pages/
│   │   └── reregistrations/      ← Student reregistration flow spec
│   │
│   ├── api/
│   │   ├── global.setup.ts        ← Seed shared API test data
│   │   ├── global.teardown.ts     ← Remove shared API test data
│   │   ├── helpers/               ← Seed file reader + DB helpers
│   │   ├── pdf.api.spec.ts
│   │   ├── excel.api.spec.ts
│   │   ├── grade.api.spec.ts
│   │   ├── avatar.api.spec.ts
│   │   └── payment.api.spec.ts
│   │
│   ├── factories/                 ← SQL insert/delete helpers (13 factories)
│   └── fixtures/                  ← Playwright fixture extensions (6 fixtures)
│
├── prisma/
│   └── schema.prisma              ← DB schema source of truth
│
├── playwright.config.ts           ← Multi-project config (admin/lecturer/student/api)
└── package.json
```

---

## Key Engineering Decisions

| Decision | Rationale |
|---|---|
| Direct SQL factories over UI seeding | 10× faster setup, immune to form validation changes |
| `storageState` per role | Login once, reuse session — no repeated auth in every test |
| `randomUUID()` for test data names | Prevents `@@unique` constraint collisions across runs |
| SSH tunnel over exposed DB port | Security — DB never reachable from internet |
| `COALESCE` in global setup student update | Non-destructive — fills nulls, never overwrites real data |
| Playwright binary caching in CI | Saves ~90 seconds on cache-hit runs |
| Graceful `test.skip` for file-dependent tests | Avoids false failures when optional resources (avatars, receipts) are absent |

---

## Reports

Live HTML reports are published to GitHub Pages after every successful push to `main`:

- **API Report**: `https://USERNAME.github.io/simak-e2e/api/`
- **UI Report**: `https://USERNAME.github.io/simak-e2e/ui/`

Reports include test timeline, failure screenshots, and video recordings for failed tests.
