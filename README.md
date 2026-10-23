# Pharmacy Management System

A full-stack **web application** for managing a pharmacy, built with **Node.js**, **Express** and **MySQL**.

It lets pharmacy staff manage medicines and stock, suppliers, purchases, sales billing and user accounts from the browser. Every action (add, update, delete, search) is stored in a MySQL database (`pharmacy_db`) and can be viewed in MySQL Workbench.

**Main features:** secure login with roles, dashboard with live time and alerts, drug inventory, supplier management, purchases, point-of-sale billing with receipts, expiry and low-stock warnings, internal messaging, and login history.

---

---

## 📋 Table of Contents
- [Quickstart](#-quickstart)
- [Prerequisites](#-prerequisites)
- [Project Structure](#-project-structure)
- [Database Setup (MySQL Workbench)](#-database-setup-mysql-workbench)
- [Environment Configuration](#-environment-configuration)
- [Default Login Credentials](#-default-login-credentials)
- [Key Features & Modules](#-key-features--modules)
- [REST API Reference](#-rest-api-reference)
- [My Contributions](#-my-contributions)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ⚡ Quickstart

Get the web application running in three simple steps:

```bash
# 1. Navigate to the web application directory
cd web-app

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

Open your browser at:
👉 **`http://localhost:3000`**

Default Administrator Credentials:
- **User ID / Username:** `1` or `admin`
- **Password:** `admin`

---

## ⚙️ Prerequisites

1. **Node.js**:
   - Version 16.0.0 or higher (tested on Node v20.x).
   - Check version:
     ```bash
     node -v
     npm -v
     ```
2. **MySQL Server & MySQL Workbench**:
   - MySQL 5.7+ or 8.0+ running on port `3306`.
   - MySQL Workbench (or CLI / any MySQL client).

---

## 📂 Project Structure

```text
Pharmacy-Management-System/
├── .github/                       # GitHub workflow and issue templates
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── custom.md
│   └── workflows/
│       └── stale.yml
├── database/                      # MySQL database schema and migrations
│   └── schema.sql                 # Complete database schema with tables and initial seed data
├── diagram/                       # Database design documentation
│   ├── ER_diagram.png             # Entity-Relationship diagram
│   └── RelationalSchema.png       # Relational schema architecture
├── web-app/                       # Full-Stack Web Application (Node.js + Express)
│   ├── public/                    # Frontend static assets
│   │   ├── assets/                # Logos, icons, and medicine imagery
│   │   ├── css/
│   │   │   └── style.css          # Healthcare UI design system & responsive styling
│   │   ├── js/
│   │   │   └── app.js             # Client-side SPA routing, API fetchers, and dynamic UI
│   │   └── index.html             # Single-Page Application interface
│   ├── src/                       # Backend Express source code
│   │   ├── middleware/
│   │   │   └── auth.js            # JWT token authentication and role checking
│   │   ├── routes/                # REST API endpoints
│   │   │   ├── audit.js           # Login audit logs
│   │   │   ├── auth.js            # Authentication and password changes
│   │   │   ├── companies.js       # Pharmaceutical supplier management
│   │   │   ├── drugs.js           # Inventory CRUD, pricing, validity, alerts
│   │   │   ├── messages.js        # Internal messaging and inbox
│   │   │   ├── purchases.js       # Procurement orders and supplier deals
│   │   │   ├── sales.js           # POS billing, cart, and historical sales
│   │   │   ├── stats.js           # Dashboard metrics and stock counters
│   │   │   └── users.js           # Staff account administration
│   │   ├── db.js                  # MySQL2 connection pool & auto-migration
│   │   └── server.js              # Express application bootstrap
│   ├── test/                      # Test suite
│   │   └── api-test.js            # Automated API integration tests
│   ├── .env                       # Local environment variables (git-ignored)
│   ├── .env.example               # Environment variables template
│   ├── package.json               # Node.js dependencies and scripts
│   └── README.md                  # Web application reference guide
├── .env.example                   # Root environment configuration template
├── .gitignore                     # Git ignore rules
├── CODE_OF_CONDUCT.md             # Contributor Covenant Code of Conduct
└── README.md                      # Project documentation
```

---

## 🗄️ Database Setup (MySQL Workbench)

The web application automatically initializes the database schema and default tables on startup if they do not exist. Alternatively, you can run the SQL script manually in MySQL Workbench:

1. Open **MySQL Workbench** and connect to your MySQL Server instance (`127.0.0.1:3306`).
2. Open [`database/schema.sql`](database/schema.sql) (**File** ➔ **Open SQL Script...**).
3. Execute the script by clicking the lightning bolt icon or pressing `Ctrl + Shift + Enter`.
4. Refresh the **Schemas** panel on the left to view the **`pharmacy_db`** schema:
   - `company`: Pharmaceutical manufacturers/suppliers
   - `drugs`: Drug inventory (barcode, name, dose, pricing, expiry, company)
   - `purchase`: Procurement orders and supplier deals
   - `sales`: Active POS checkout cart
   - `history_sales`: Persistent historical sales records with cashier username and timestamp
   - `users`: User and employee accounts with bcrypt password hashes
   - `login`: User login session audit trail
   - `inbox`: Internal staff messaging inbox
   - `message_history`: Internal sent messages tracking

---

## 🔑 Environment Configuration

Database connection settings are configured in [`web-app/.env`](web-app/.env) (refer to [`web-app/.env.example`](web-app/.env.example)):

```ini
# MySQL Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=pharmacy_db

# Web Server Port
PORT=3000

# JWT Secret for Session Authentication
JWT_SECRET=pharmacy_mgmt_jwt_secret_key_2026
```

---

## 🔐 Default Login Credentials

The initial seed provides default accounts for system access:

| User ID / Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`1`** or **`admin`** | **`admin`** | **Admin** | Full system access (Billing, Inventory, Pricing, Suppliers, Staff Accounts) |
| **`2`** or **`mark`** | **`mark123`** | **Employee** | POS Billing, Inventory Search, Drug details |
| **`3`** or **`clark`** | **`clark123`** | **Employee** | POS Billing, Inventory Search, Drug details |

*(New staff accounts and passwords can be added or updated via the User module).*

---

## 🧩 Key Features & Modules

- **Dashboard**: Live clock and date, real-time metrics, active session indicators, and expiry/stock alert badges.
- **Company Management**: Complete CRUD operations for pharmaceutical suppliers with search and telephone directory.
- **Drug Inventory**: Full medicine lifecycle management with barcode lookup, batch codes, dosages, costs, shelf locations, and retail prices.
- **Drug Sub-tools**: Dynamic search, price editing, validity renewal, shelf relocation, expired drug warnings (&le; 30 days), and low-stock warnings (&le; 10 units).
- **Purchases & Procurement**: Track supplier purchase deals, order volumes, costs, and expenditure totals.
- **Point of Sale (POS) & Billing**: Real-time cart management, stock validation, atomic transactions, receipt generation, customer returns/restocking, and shift sales revenue reports.
- **User Administration**: Staff profile creation, role assignment, and secure password updates with `bcrypt`.
- **Session & Audit Logs**: Historical records of all staff logins with timestamps and user identifiers.
- **Internal Messaging**: Inter-staff messaging system between pharmacists and administration.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user, issue JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/auth/change-password` | Update current user password |
| `GET` | `/api/companies` | List all suppliers (with search) |
| `POST` | `/api/companies` | Add new supplier |
| `PUT` | `/api/companies/:name` | Update supplier details |
| `DELETE` | `/api/companies/:name` | Delete supplier |
| `GET` | `/api/drugs` | List all medicines |
| `GET` | `/api/drugs/search` | Search medicines by query, company, type |
| `POST` | `/api/drugs` | Add medicine to inventory |
| `PUT` | `/api/drugs/:barcode` | Update medicine details |
| `PUT` | `/api/drugs/:barcode/price` | Modify cost & selling prices |
| `PUT` | `/api/drugs/:barcode/validity` | Update expiry and production dates |
| `PUT` | `/api/drugs/:barcode/move` | Update storage rack/shelf position |
| `DELETE` | `/api/drugs/:barcode` | Delete medicine record |
| `GET` | `/api/drugs/alerts/expired` | Filter medicines expiring within 30 days |
| `GET` | `/api/drugs/alerts/almost-finish` | Filter low-stock medicines (&le; 10 units) |
| `GET` | `/api/purchases` | List procurement deals |
| `POST` | `/api/purchases` | Create procurement order |
| `PUT` | `/api/purchases/:barcode` | Update procurement order |
| `DELETE` | `/api/purchases/:barcode` | Delete procurement order |
| `GET` | `/api/sales/cart` | View current POS checkout cart |
| `POST` | `/api/sales/cart` | Add medicine to POS cart |
| `DELETE` | `/api/sales/cart/:id` | Remove item from POS cart |
| `DELETE` | `/api/sales/cart` | Clear POS cart |
| `POST` | `/api/sales/checkout` | Finalize POS sale, decrement stock, record transaction |
| `GET` | `/api/sales/history` | Query shift sales ledger by date |
| `POST` | `/api/sales/return` | Customer return & restock inventory |
| `GET` | `/api/users` | List staff accounts (Admin) |
| `POST` | `/api/users` | Create staff account (Admin) |
| `PUT` | `/api/users/:id` | Update staff account |
| `DELETE` | `/api/users/:id` | Delete staff account (Admin) |
| `GET` | `/api/messages/inbox` | List received messages |
| `POST` | `/api/messages/send` | Send internal message |
| `DELETE` | `/api/messages/inbox/:id` | Delete message |
| `GET` | `/api/audit/logins` | View user login history |
| `GET` | `/api/stats/summary` | Dashboard summary indicators |

---

## 🌟 My Contributions

- **Architecture Migration**: Transformed the legacy desktop Java Swing application into an enterprise-ready, cross-platform full-stack web application powered by Node.js, Express, and MySQL.
- **Modern Responsive Web Interface**: Designed and built an intuitive Single Page Application (SPA) frontend utilizing clean Vanilla CSS, dynamic layouts, healthcare color scheme, and fluid micro-animations.
- **RESTful API Backend**: Implemented modular, scalable Express route handlers and middleware adhering to RESTful standards.
- **Security & Session Authentication**: Replaced plaintext desktop authentication with industry-standard JSON Web Tokens (JWT) and `bcrypt` password hashing (salt rounds: 10).
- **Real-Time POS Billing & Inventory Sync**: Engineered an atomic point-of-sale checkout system that automatically validates stock availability, decrements inventory, generates printable receipts, and records shift ledgers.
- **Database Architecture Modernization**: Designed normalized SQL schema with InnoDB foreign key constraints, cascading updates/deletes, auto-increment identifiers, and `utf8mb4` Unicode support.
- **Automated Verification Suite**: Authored comprehensive integration tests (`web-app/test/api-test.js`) validating authentication, CRUD operations, database constraints, and POS workflows.
- **Repository Optimization**: Removed legacy Java bytecode (`.class`), obsolete IDE metadata (NetBeans/Eclipse), and legacy build scripts, producing a streamlined, maintainable codebase.

---

## 🛠️ Troubleshooting

- **Database Connection Refused / Access Denied**:
  - Verify that MySQL Server service is running on your machine.
  - Check your credentials in [`web-app/.env`](web-app/.env). Ensure `DB_USER` and `DB_PASSWORD` match your MySQL setup.
  - Test connecting to MySQL Workbench with the same credentials.
- **Port 3000 Already in Use**:
  - Change `PORT=3000` in [`web-app/.env`](web-app/.env) to another port (e.g., `PORT=3001`).

---
