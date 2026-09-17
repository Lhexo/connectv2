# Technical Stack Documentation - Version 2 (TECH_STACK.md)

## 1. Core Platform & Runtime Environment
- **Runtime Environment**: Node.js v18+ runtime execution container running on Cloud Run.
- **Language**: TypeScript ~5.8.2 (Strict mode with end-to-end typing across Express backend and React SPA).
- **Application Server**: Express.js (`express` v4.21.2) listening on HTTP Port `3000` bound to `0.0.0.0` behind Nginx reverse proxy.
- **Frontend Framework**: React 19.0.0 + React DOM 19.0.0 bundled with Vite 6.2.0 (`@vitejs/plugin-react` v5.0.4, `@tailwindcss/vite` v4.1.14).
- **Build & Dev Tooling**:
  - `tsx` (v4.21.0) TypeScript runner for zero-compilation server execution in dev mode.
  - `esbuild` (v0.28.1) for bundling `server.ts` into a single, self-contained CommonJS output (`dist/server.cjs`) for production.
  - `simulate_workflow.ts` CLI tool simulating Danea Easyfatt desktop client HTTP/XML requests.

---

## 2. Database & Persistence Architecture (Version 2 SQLite Upgrade)
- **Database Engine**: **SQLite 3 via `better-sqlite3` (v12.4.1)** operating on `database.db`.
- **Architectural Shift**: Version 2 completely replaced the legacy `db.json` file-backed store with a robust, relational SQLite database.
- **Pragma Configuration**: `PRAGMA foreign_keys = ON` enforced on connection initialization.
- **Relational Integrity**: Foreign key constraints with explicit `ON DELETE CASCADE` and `ON DELETE SET NULL` cascade rules.
- **Auto-Migration Engine**: On server boot, `server.ts` executes relational schema initialization (`CREATE TABLE IF NOT EXISTS`) and incremental column migrations (`ALTER TABLE ... ADD COLUMN ...`).
- **Database Schema Tables**:
  - `users`: Team member user profiles, password hashes, roles, departments, avatars.
  - `clients`: Customer directory, Easyfatt customer code (`code`), contact details, notes, assigned agent (`agente`).
  - `suppliers`: Supplier directory, category, terms, contact details.
  - `tags`: Global task tagging system with hex colors.
  - `categories`: Hierarchical category tree with parent-child relationship (`parent_id`).
  - `tasks`: Core operational task records, priority levels, status, deadline, assigned user, linked client/supplier, duration minutes.
  - `task_tags`: Junction table associating tasks with tags.
  - `task_history`: Audit trail tracking task status changes, edits, and assignments.
  - `calls`: Phone call records with caller type (cliente, fornitore, esterno), duration in seconds & minutes, linked task, category, client/supplier, user.
  - `attachments`: File attachments uploaded to tasks.
  - `backups`: Database backup records and export history.
  - `task_notes`: Internal discussion notes attached to tasks.
  - `user_notification_settings`: Per-user notification preferences.
  - `user_notifications`: Real-time user notification bell queue.
  - `products`: Easyfatt product catalog, prices, VAT, stock, category hierarchy, supplier details, dimensions, weights, and online customization overrides.
  - `product_variants`: Protocol 3 Taglie e Colori variants (`Size`, `Color`, `Barcode`, `AvailableQty`).
  - `product_extra_barcodes`: Multi-pack packaging barcodes (`PackageQty`).
  - `orders`: E-commerce customer orders generated on the platform or imported from Easyfatt.
  - `order_items`: Line items linked to orders.
  - `easyfatt_settings`: Easyfatt XML integration settings (credentials, default VAT, payment, min order total, product link filter).
  - `company_header`: Custom company header data included in generated `EasyfattDocuments` XML files.
  - `payment_methods`: Configurable payment terms (due offset days, installments, end-of-month fine mese flag).

---

## 3. Backend Middleware & API Services
- **Body Parsing**: Express JSON parser (`express.json({ limit: '50mb' })`) and URL-encoded parser (`express.urlencoded({ extended: true, limit: '50mb' })`).
- **Cookie & Session Management**: `cookie-parser` (v1.4.7) for HTTP session handling.
- **Password Security**: `bcryptjs` (v3.0.3) for secure password hashing and verification.
- **File Upload Engine**: `multer` (v2.1.1) handling `multipart/form-data` uploads into the `/uploads/` directory with static web serving via `express.static('uploads')`.
- **XML Parsing & Building**:
  - `fast-xml-parser` (v5.9.3) for bidirectional conversion between Easyfatt-XML and JavaScript objects.
  - Custom UNICODE UTF-8 entity escaping (`&amp;`, `&lt;`, `&gt;`), decimal dot formatting (`.`), and ISO date handling (`YYYY-MM-DD`).
- **Excel & Document Generation**:
  - `xlsx` (SheetJS v0.18.5) and `exceljs` (v4.4.0) for exporting Poste Italiane shipment files in XLSX/CSV format.
  - `adm-zip` (v0.5.16) and `archiver` (v7.0.1) for ZIP archive creation during backup/export workflows.

---

## 4. Frontend Architecture & UI Ecosystem
- **Core Library**: React 19.0.0 with functional components and React Hooks.
- **Routing Engine**: `react-router-dom` v7.13.1 handling client-side SPA routing (`/`, `/easyfatt`, `/tasks`, `/tasks/new`, `/tasks/:id`, `/clients`, `/clients/:id`, `/suppliers`, `/suppliers/:id`, `/users`, `/poste-generator`, `/settings`, `/login`).
- **Styling System**: Tailwind CSS v4 (`tailwindcss` v4.1.14 with `@tailwindcss/vite`) imported via global `@import "tailwindcss";`.
- **Class Utilities**: `clsx` (v2.1.1) and `tailwind-merge` (v3.5.0) combined into `cn()` utility (`src/lib/utils.ts`).
- **Icon Set**: `lucide-react` (v0.546.0) vector icon set.
- **Animations**: `motion` / `framer-motion` (v12.23.24) for smooth route transitions, modal dialogs, and toast notifications.
- **PDF & Canvas Printing**: `jspdf` (v4.2.1) and `html2canvas` (v1.4.1) for rendering PDF invoices, quotes, and order receipts directly in the browser.

---

## 5. Danea Easyfatt-XML Integration Specifications
- **Supported Easyfatt Protocols**:
  - **Protocol 1** (`AppVersion="DaneaEasyfatt.2006.17.00"`): Legacy Easyfatt protocol.
  - **Protocol 2** (`AppVersion="2"`): Incremental synchronization, product upload, HTTP/FTP image transfer handshake.
  - **Protocol 3** (`AppVersion="3"`): Taglie & Colori variants support (`<Variants><Variant>`).
- **Data Encoding & Formatting Constraints**:
  - File Encoding: UNICODE UTF-8 without BOM.
  - Entity Escaping: `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`.
  - Decimal Separator: `.` (Dot, NO thousands separators).
  - ISO Dates: `YYYY-MM-DD` (e.g., `2026-07-24`).
- **Catalog Synchronization Modes**:
  - `full`: Complete catalog synchronization (`<Products><Product>`). Unlisted items deleted/deactivated.
  - `incremental`: Differential sync using `<UpdatedProducts>` for additions/updates and `<DeletedProducts>` with `<Code>` for removals.
- **Image Upload Handshake**:
  - Upon receiving product catalog XML, server responds with `OK\nImageSendURL=http://<host>/api/easyfatt/upload-images\nImageSendFinishURL=http://<host>/api/easyfatt/sync-finish`.
  - Easyfatt pushes images via `multipart/form-data` with `file` and `fileName`.

---

## 6. Environment Variables & System Configuration
Documented in `.env.example`:
```env
# Server Runtime
PORT=3000
NODE_ENV=development

# Easyfatt Synchronization Security Credentials
EASYFATT_SYNC_USER=admin
EASYFATT_SYNC_PASS=password123

# Application Secret Key
SECRET_KEY=your_secret_key_here
```

---

## 7. Reactive Catalog Filtering & Backorder Engine
- **Dynamic Real-Time Counters**: Product count badges (e.g. total matching items, per-category counts, stock availability counters) are calculated dynamically from `agentBaseFilteredProducts` and `orderBaseFilteredProducts`. They respond instantly to keyword searches, commission rate thresholds, external link filters, and stock toggles.
- **Auto-Hiding Category Navigation**: Categories and subcategories with 0 visible products under the current active filter set are automatically omitted from the category navigation list (`productCategories`), keeping the UI clutter-free.
- **Backorder (Pre-ordine) Order Processing**: Items with stock level `<= 0` (Out of Stock) remain visible and orderable. Adding zero-stock items automatically tags the order entry as a **Pre-ordine (Backorder)** with dedicated visual indicators (`Clock` badges and amber action triggers) and explicit feedback notifications.

