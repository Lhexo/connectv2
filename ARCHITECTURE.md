# Comprehensive System Architecture & Business Logic - Version 2 (ARCHITECTURE.md)

## 1. System Overview & Core Capabilities
This platform is an integrated ERP, CRM, Task Management, Phone Call Tracker, Poste Italiane Shipment Generator, and Danea Easyfatt E-Commerce Synchronization Hub designed to bridge desktop **Danea Easyfatt** software instances with an operational web system.

### Key Data Streams & Workflows:
1. **Catalog & Stock Synchronization (Easyfatt -> Site)**: Receives product catalogs, pricing tiers (Net 1-9 & Gross 1-9), stock quantities, size/color variants (`Protocol 3`), and product images from Danea Easyfatt.
2. **Order Synchronization (Site -> Easyfatt)**: Formats e-commerce orders into standard `EasyfattDocuments` XML files for download and automatic entry into Danea Easyfatt.
3. **Spedizioni Poste Generator (`/poste-generator`)**: Parses Easyfatt XML documents or manual inputs to generate validated CSV/XLSX shipment list files formatted for Poste Italiane / Crono / Crono Express web shipping portals.
4. **CRM & Interactive Call Tracker**: Tracks customer and supplier interaction logs with a live stopwatch call timer, reason categorization, and direct links to tasks and contacts.
5. **Operational Task Engine**: Task assignment, priority status, subtasks checklist, internal discussion notes, audit history trail (`task_history`), attachments, and real-time notification queue.
6. **Reactive Catalog & Backorder Engine**: Dynamic real-time product/category counters, automatic hiding of empty categories under active filters, and backorder ("Pre-ordine") processing for zero-stock items.


---

## 2. Directory & Module Structure

```
/
├── server.ts                  # Express Backend: REST API, SQLite database, Easyfatt XML Handlers, Auth
├── simulate_workflow.ts       # CLI Tool: Simulates real Danea Easyfatt HTTP/XML client requests
├── database.db                # SQLite 3 Database File (Persistent Storage)
├── uploads/                   # Public static folder for Easyfatt product images & task attachments
├── index.html                 # Web HTML entry point
├── vite.config.ts             # Vite build & dev server config with Tailwind CSS plugin
├── package.json               # Package manifests, scripts (dev, build, start)
└── src/
    ├── main.tsx               # React application entry point
    ├── App.tsx                # Main SPA layout shell, top navigation bar, call modal & route router
    ├── types.ts               # Universal TypeScript interfaces (User, Client, Supplier, Product, Order, Task, Call, Notification, etc.)
    ├── index.css              # Global CSS with Tailwind directive (@import "tailwindcss";)
    ├── lib/
    │   ├── api.ts             # HTTP fetch client with authorization headers & error handling
    │   └── utils.ts           # Helper functions (cn classnames, date & currency formatters)
    ├── components/
    │   ├── AppGuard.tsx       # Auth & Role-Based Access Control wrapper component
    │   ├── Toast.tsx          # Floating toast notification component
    │   └── ConfirmModal.tsx   # Reusable confirmation modal dialog
    └── pages/
        ├── Dashboard.tsx      # System overview: KPIs, stock alerts, recent sync logs, task stats
        ├── TaskList.tsx       # Operational task board: filters (status, priority, assignee), search, create task
        ├── TaskDetail.tsx     # Task workspace: subtasks checklist, comment thread, call history, attachments
        ├── TaskForm.tsx       # Modal/form view to create or edit tasks
        ├── ClientList.tsx     # Customer directory: search, Easyfatt code linking, contact info, agent filter
        ├── ClientDetail.tsx   # Customer profile: purchase history, linked orders, custom notes, call history
        ├── SupplierList.tsx   # Supplier directory: search, linked products count, contact info
        ├── SupplierDetail.tsx # Supplier profile: catalog items, purchase prices, contact info, call history
        ├── Easyfatt.tsx       # Easyfatt Hub: Order downloads, Product catalog, Client directory, XML configuration, Admin tabs
        ├── PosteGenerator.tsx # Spedizioni Poste Italiane CSV/XLSX shipment list generator
        ├── UserManagement.tsx # Team management: add/edit users, assign roles (admin, manager, operator, agent)
        ├── Settings.tsx       # Easyfatt XML credentials, company header setup, payment methods, system backups
        └── Login.tsx          # Authenticated sign-in view
```

---

## 3. Database Schema & Domain Entities (`database.db`)

### A. Users & Team Management (`users`)
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT NOT NULL - Full display name
- `email`: TEXT UNIQUE NOT NULL COLLATE NOCASE - User login email
- `password`: TEXT NOT NULL DEFAULT 'password123' - Hashed or encrypted password
- `department`: TEXT - Department or team identifier
- `role`: TEXT - Role (`admin` | `amministratore` | `manager` | `operator` | `agent` | `agente`)
- `avatar`: TEXT - Profile avatar image URL or initials string
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### B. Clients / Customer Directory (`clients`)
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `code`: TEXT - Easyfatt Customer Code (`CustomerCode`)
- `name`: TEXT NOT NULL - Company or customer name (`CustomerName`)
- `contact`: TEXT - Reference contact person (`CustomerReference`)
- `phone`: TEXT - Telephone number (`CustomerTel`)
- `email`: TEXT - Email address (`CustomerEmail`)
- `city`: TEXT - City name (`CustomerCity`)
- `notes`: TEXT - Internal notes or parsed Danea metadata (`---DANEA_METADATA---`)
- `agente`: TEXT - Assigned sales agent name

### C. Suppliers / Fornitori (`suppliers`)
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT NOT NULL - Supplier business name (`SupplierName`)
- `contact`: TEXT - Contact person
- `phone`: TEXT - Telephone number
- `email`: TEXT - Email address
- `category`: TEXT - Product or supply category
- `notes`: TEXT - Supplier terms and notes (`SupplierNotes`)

### D. Tags & Categories (`tags`, `categories`)
- `tags`: `id`, `name`, `color` (Hex code)
- `categories`: `id`, `name`, `parent_id` (Self-referencing foreign key for nested category tree)

### E. Tasks & Activities (`tasks`, `task_tags`, `task_history`, `task_notes`, `attachments`)
- `tasks`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `title`: TEXT NOT NULL
  - `description`: TEXT
  - `internal_notes`: TEXT - Confidential internal notes
  - `category_id`: INTEGER (FK -> categories)
  - `assignee_id`: INTEGER (FK -> users)
  - `status`: TEXT DEFAULT 'Nuovo' (`Nuovo`, `In Corso`, `In Attesa`, `Completato`)
  - `type`: TEXT (`cliente`, `interno`, `fornitore`)
  - `priority`: TEXT DEFAULT 'Media' (`Bassa`, `Media`, `Alta`, `Urgente`)
  - `client_id`: INTEGER (FK -> clients)
  - `supplier_id`: INTEGER (FK -> suppliers)
  - `creator_id`: INTEGER (FK -> users)
  - `deadline`: TEXT - Expiration date ISO string
  - `duration_minutes`: INTEGER DEFAULT 0
  - `created_at`, `updated_at`: DATETIME
- `task_tags`: `task_id`, `tag_id` (Junction table)
- `task_history`: `id`, `task_id`, `user_id`, `action`, `details`, `timestamp`
- `task_notes`: `id`, `task_id`, `user_id`, `content`, `created_at`, `updated_at`
- `attachments`: `id`, `task_id`, `file_name`, `file_path`, `file_type`, `created_at`

### F. Call Logger (`calls`)
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `caller_name`: TEXT NOT NULL - Name of caller
- `caller_type`: TEXT CHECK(caller_type IN ('cliente', 'fornitore', 'esterno'))
- `reason`: TEXT - Discussion summary
- `duration`: INTEGER - Stopwatch duration in seconds
- `duration_minutes`: INTEGER DEFAULT 0 - Duration in minutes
- `task_id`: INTEGER (FK -> tasks)
- `client_id`: INTEGER (FK -> clients)
- `supplier_id`: INTEGER (FK -> suppliers)
- `category_id`: INTEGER (FK -> categories)
- `user_id`: INTEGER (FK -> users)
- `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### G. Real-time Notifications (`user_notifications`, `user_notification_settings`)
- `user_notifications`: `id`, `user_id`, `type`, `title`, `message`, `related_id`, `is_read`, `created_at`
- `user_notification_settings`: `user_id`, `task_deadline`, `new_task`, `comments`, `weekly_report`

### H. Easyfatt Product Catalog & Variants (`products`, `product_variants`, `product_extra_barcodes`)
- `products`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `code`: TEXT NOT NULL UNIQUE - Easyfatt Product Code (`Code`)
  - `description`: TEXT NOT NULL - Plain text description (`Description`)
  - `price`: REAL NOT NULL DEFAULT 0.0 - Primary net list price (`NetPrice1`)
  - `vat_code`: TEXT DEFAULT '22' - Tax rate code (`Vat`)
  - `um`: TEXT DEFAULT 'pz' - Unit of measure (`Um`)
  - `stock`: REAL DEFAULT 0 - Stock quantity (`AvailableQty`)
  - `barcode`, `category`, `subcategory`, `description_html`, `producer_name`, `link`, `notes`, `image_file_name`
  - `supplier_code`, `supplier_name`, `supplier_product_code`, `supplier_net_price`, `supplier_gross_price`, `supplier_notes`
  - `manage_warehouse`, `warehouse_location`, `min_stock`, `ordered_qty`
  - `weight_um`, `net_weight`, `gross_weight`, `size_um`, `net_size_x`, `net_size_y`, `net_size_z`
  - `custom_field1`, `custom_field2`, `custom_field3`, `custom_field4`
  - `online_promo`, `online_warranty`, `online_category_image`, `online_notes`, `online_customized` - Online customization overrides
- `product_variants`: `id`, `product_id`, `size`, `color`, `barcode`, `available_qty` (Protocol 3 Taglie e Colori)
- `product_extra_barcodes`: `id`, `product_id`, `barcode`, `package_qty` (Packaging barcodes)

### I. Easyfatt Orders & Invoice Documents (`orders`, `order_items`)
- `orders`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `client_id`: INTEGER NOT NULL (FK -> clients)
  - `agent_id`: INTEGER (FK -> users)
  - `date`: TEXT NOT NULL - Document date ISO string (`Date`)
  - `number`: TEXT - Document number (`Number`)
  - `payment_name`: TEXT - Payment method (`PaymentName`)
  - `payment_bank`: TEXT - Bank details (`PaymentBank`)
  - `notes`: TEXT - Document internal comment (`InternalComment`)
  - `total`: REAL DEFAULT 0.0 - Document total (`Total`)
  - `status`: TEXT DEFAULT 'Nuovo' (`Nuovo`, `In Lavorazione`, `Completato`, `Annullato`)
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `order_items`: `id`, `order_id`, `product_code`, `description`, `qty`, `price`, `vat_code`, `um`

### J. System Configuration (`easyfatt_settings`, `company_header`, `payment_methods`)
- `easyfatt_settings`: `id=1`, `username`, `password`, `default_payment`, `min_order_total`, `default_notes`, `default_vat`, `prices_include_vat`, `product_link_filter`
- `company_header`: `id=1`, `company_name`, `company_address`, `company_postcode`, `company_city`, `company_province`, `company_country`, `company_vat_code`, `company_fiscal_code`, `company_tel`, `company_fax`, `company_email`, `company_pec`, `company_website`, `company_logo`
- `payment_methods`: `id`, `name`, `offset_days`, `installments`, `fine_mese`

---

## 4. Easyfatt-XML Endpoints & Workflows

### Endpoint Table

| Route Path | Method | Auth Required | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/easyfatt/upload-products` | `POST` | Base64 / Basic Auth | Receives Easyfatt catalog XML (Full or Incremental mode) |
| `/api/easyfatt/upload-images` | `POST` | Base64 / Basic Auth | Receives product image files via multipart upload |
| `/api/easyfatt/download-orders` | `POST` / `GET` | Base64 / Basic Auth | Generates & exports pending web orders in Easyfatt-XML format |
| `/api/easyfatt/sync-finish` | `GET` | Base64 / Basic Auth | Handshake confirmation called by Easyfatt upon finishing image sync |
| `/api/poste/generate` | `POST` | Bearer Web Auth | Parses Easyfatt XML documents to produce Poste Italiane shipment files |
| `/api/calls` | `POST` / `GET` | Bearer Web Auth | Logs phone call entries with timer and links to tasks/contacts |
| `/api/notifications` | `GET` | Bearer Web Auth | Fetches real-time notification queue for top bell icon |

---

## 5. Security & Access Control (RBAC Matrix)

| Feature / Action | Admin | Manager | Operator | Agent (`agente`) |
| :--- | :---: | :---: | :---: | :---: |
| Dashboard & Operational KPIs | Yes | Yes | Yes | Redirected to Easyfatt |
| Task Board & Details | Yes | Yes | Yes | No |
| Phone Call Stopwatch Logger | Yes | Yes | Yes | No |
| Client & Supplier Directory View | Yes | Yes | Yes | Assigned Clients Only |
| Easyfatt Catalog & Orders View | Yes | Yes | Yes | Yes (Filtered by Agent) |
| Poste Italiane Generator | Yes | Yes | Yes | No |
| Easyfatt Settings & Credentials Config | Yes | No | No | No |
| Company Header & Payment Terms Config | Yes | No | No | No |
| User Account & Role Management | Yes | No | No | No |
| Trigger Easyfatt Test Workflow | Yes | No | No | No |

---

## 6. Reactive Catalog Architecture & Backorder Logic
1. **Dynamic Base Filtering (`agentBaseFilteredProducts` & `orderBaseFilteredProducts`)**:
   - The catalog filtering pipeline decouples base filters (search query, stock availability filter, link status, commission rate filter) from category selection.
   - Base filters generate dynamic derived product lists representing all matching items across all categories.
2. **Auto-Hiding Empty Categories**:
   - Unique categories and subcategories are extracted dynamically from the base-filtered product sets.
   - Categories with 0 matching items under the active base filters are hidden from the navigation sidebars and category selector tabs automatically.
3. **Dynamic Real-Time Counters**:
   - Total matching item counts and per-category product counts update instantly as search terms or stock filters change.
4. **Out of Stock & Backorder ("Pre-ordine") Handling**:
   - Products with `stock <= 0` remain visible in the catalog for agents and administrators.
   - When added to an order, zero-stock items trigger backorder mode ("Pre-ordine").
   - UI elements display amber badges (`Clock` icon) and action triggers for pre-order items, providing clear visual status distinction from regular in-stock items.

