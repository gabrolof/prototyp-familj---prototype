# Family Subscriptions Prototype (Local-Only)

Next.js App Router prototype for a family e-commerce purchase flow (2+ mobile subscriptions) with deterministic eligibility and pricing logic.

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Local JSON mock data + in-memory state only (no backend)

## Prerequisites

- Node.js LTS (recommended: Node 20+)
- npm
- Windows PC local environment

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Routes

- `/` landing page with product cards and CTAs
- `/flow` full family configuration stepper
- `/confirmation` mock order success page

## Project Structure

- `app/components` reusable UI components
- `app/lib` deterministic rule engine and types
- `app/data` mock customer/catalog/test datasets

## Mock/Test Data

- `app/data/mockCustomers.json`
  - SSN, ownership history, binding compatibility, existing family state
- `app/data/mockCatalog.json`
  - Tier prices (main/sub) and phone device catalog
- `app/data/testCases.json`
  - End-to-end deterministic scenarios and expected outcomes
- `app/data/qaMappings.json`
  - QA helper mapping: SSN scenario summaries + explicit msisdn outcome examples

## Debug Panel Usage

In `/flow`, use the debug panel to:

1. Switch SSN quickly from predefined scenarios.
2. Apply one-click example combinations (`SSN + MSISDN`) for renewal/new/list outcomes.
3. Inspect computed classification and offer pricing per line.

## Implemented Business Rules

- Exactly 1 main line and minimum 2 total lines required for checkout.
- Sub-lines inherit the selected family tier (single tier for all lines).
- SSN login determines customer context and ownership.
- Offer engine supports:
  - `NEW_CUSTOMER` (main -100, sub -50, 24 months)
  - `RENEWAL` (main -80, sub -40, 24 months)
  - `NONE` fallback list pricing
- Renewal blocked when line is in binding and marked incompatible.
- Cart totals include monthly + one-time totals and binding max capped at 24 months.

## Notes

- Authentication is mocked as SSN input only.
- No external APIs or backend persistence are used.
- This is a prototype focused on rule correctness and flow clarity.
