# Pharmacy Management System - Web Application

A modern, responsive full-stack web application converted from the original Java Swing desktop project. Connected directly to **MySQL Server** (compatible with MySQL Workbench under connection name `DBMS`), offering real-time synchronization, parameterized queries, and instant visibility of all inventory and billing transactions.

---

## 📋 Table of Contents
- [Prerequisites](#-prerequisites)
- [Database Configuration (.env)](#-database-configuration-env)
- [Installation & Running](#-installation--running)
- [Default Login Credentials](#-default-login-credentials)
- [How to View Data in MySQL Workbench](#-how-to-view-data-in-mysql-workbench)
- [Features & Modules](#-features--modules)
- [REST API Reference](#-rest-api-reference)

---

## ⚙️ Prerequisites

1. **Node.js**:
   - Node.js v16+ (tested on Node v20.17.0).
   - Verify with:
     ```bash
     node -v
     npm -v
     ```
2. **MySQL Server & MySQL Workbench**:
   - MySQL 5.7+ or 8.0+ running on port `3306`.
   - MySQL Workbench installed with your local connection (e.g. `DBMS`).

---

## 🔑 Database Configuration (.env)

All database settings are centralized in [`web-app/.env`](file:///d:/DBMS/Pharmacy-Management-System/web-app/.env).

1. Open [`web-app/.env`](file:///d:/DBMS/Pharmacy-Management-System/web-app/.env):
   ```ini
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password_here
   DB_NAME=pharmacy_db
   PORT=3000
   JWT_SECRET=pharmacy_mgmt_jwt_secret_key_2026
   ```
2. Replace `your_password_here` with your actual MySQL `root` password.
3. Save the file.

> [!NOTE]
> If `pharmacy_db` does not exist on your MySQL server yet, the application will automatically run `CREATE DATABASE IF NOT EXISTS pharmacy_db` and initialize all tables and default administrator data on its first launch!

---

## 🚀 Installation & Running

From the `web-app/` directory:

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Start the web application
npm start
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🔐 Default Login Credentials

| User ID / Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`1`** or **`admin`** | **`admin`** | **Admin** | Full system access (Billing, Inventory, Pricing, Suppliers, Staff Accounts) |
| **`2`** or **`mark`** | **`mark123`** | **Employee** | POS Billing, Inventory Search, Drug details |
| **`3`** or **`clark`** | **`clark123`** | **Employee** | POS Billing, Inventory Search, Drug details |

*Note: You can add new employees or change passwords anytime in the User or Setting tabs.*

---

## 🗄️ How to View Data in MySQL Workbench

Every Add, Edit, Delete, Checkout, and Return action is immediately committed to MySQL.

To view changes in MySQL Workbench:
1. Open **MySQL Workbench** and double-click your connection: **`DBMS`** (or `Local instance 3306`).
2. In the left sidebar under the **Schemas** tab, right-click and click **Refresh All** (or click the refresh icon).
3. Expand **`pharmacy_db`** ➔ **Tables**:
   - `company`: Pharmaceutical manufacturers/suppliers.
   - `drugs`: Live medicine stock, quantities, selling & cost prices, shelf locations, and expiration dates.
   - `purchase`: Procurement orders from suppliers.
   - `sales`: Active POS checkout cart.
   - `history_sales`: Persistent historical sales ledger with cashier username, date, and time.
   - `users`: Staff profiles and roles.
   - `login`: User login session audit trail.
   - `inbox`: Internal staff messages.
   - `message_history`: Outgoing message tracking.
4. Right-click any table (e.g., `drugs` or `history_sales`) and select **Select Rows - Limit 1000** to see live rows!

---

## 🧩 Features & Modules

- **Dashboard**:
  - Live ticking digital clock (`HH:MM:SS`) and date (`DD-MM-YYYY`).
  - Active user session indicator: `Login As: Admin`, `User Name: admin`.
  - Notification badges for expiring drugs and low-stock medicines.
  - Interactive navigation cards and quick-action shortcuts.
- **Company Management**:
  - Add, update, delete, and search pharmaceutical suppliers with phone and address records.
- **Drugs Inventory**:
  - Add new medicines with barcode, dosage, type, unit costs, selling prices, company link, and storage rack code.
  - Live stock quantity display with color-coded warnings (green for normal, red for low stock).
- **Drug Details & Sub-tools**:
  - **Search Drug**: Instant barcode or name lookup.
  - **Edit Price**: Modify cost and retail selling prices.
  - **Renew Validity**: Update production date and expiration date.
  - **Move Drug**: Relocate medicine shelf/rack position (e.g. `N-Right`, `A-Left`).
  - **Expired Drugs Alert**: Detects drugs expiring in &le; 30 days or already expired.
  - **Almost Finished Alert**: Flags medicines with stock &le; 10 units.
- **Purchases**:
  - Manage supplier procurement orders, order quantities, unit prices, and auto-calculated amounts.
  - Aggregated procurement spending totals.
- **Sales & POS Billing**:
  - Point-of-Sale cart with real-time stock availability verification.
  - Checkout transaction: atomically decrements inventory stock in `drugs`, saves records to `history_sales`, and clears cart.
  - Printable sales receipt with invoice number and timestamp.
  - Shift Sales ledger with filter by date and daily revenue summaries.
  - Drug Retrieval / Customer return restocks inventory directly.
- **User Administration**:
  - Create, edit, and delete employee profiles.
  - Passwords automatically encrypted with `bcrypt`.
- **Setting & Audit**:
  - Change user account password.
  - Review login audit history with timestamp and user ID.
- **Staff Messaging**:
  - Public & direct internal messages between pharmacists and administration.
- **About Modals & Contact Footer**:
  - Retains all original contact numbers (`01128284736 / 01014033489`, `045/3397825`) and location (`Alexandria / Elraml Station / st-Elshazly`).

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user, returns JWT token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `POST` | `/api/auth/change-password` | Update user password |
| `GET` | `/api/companies` | List all companies (optional `?search=`) |
| `POST` | `/api/companies` | Add company |
| `PUT` | `/api/companies/:name` | Update company |
| `DELETE` | `/api/companies/:name` | Delete company |
| `GET` | `/api/drugs` | List all drugs |
| `GET` | `/api/drugs/search` | Search drugs by query, company, type |
| `POST` | `/api/drugs` | Add new drug |
| `PUT` | `/api/drugs/:barcode` | Update drug |
| `PUT` | `/api/drugs/:barcode/price` | Update cost & selling prices |
| `PUT` | `/api/drugs/:barcode/validity`| Renew validity & dates |
| `PUT` | `/api/drugs/:barcode/move` | Move shelf location |
| `DELETE` | `/api/drugs/:barcode` | Delete drug |
| `GET` | `/api/drugs/alerts/expired` | Expired / expiring soon drugs |
| `GET` | `/api/drugs/alerts/almost-finish` | Low stock drugs (&le; 10) |
| `GET` | `/api/purchases` | List procurement deals |
| `POST` | `/api/purchases` | Add purchase deal |
| `PUT` | `/api/purchases/:barcode` | Update purchase deal |
| `DELETE` | `/api/purchases/:barcode` | Delete purchase deal |
| `GET` | `/api/sales/cart` | Get active POS cart |
| `POST` | `/api/sales/cart` | Add item to cart |
| `DELETE` | `/api/sales/cart/:id` | Remove item from cart |
| `DELETE` | `/api/sales/cart` | Clear entire cart |
| `POST` | `/api/sales/checkout` | Complete sale, decrement stock & log history |
| `GET` | `/api/sales/history` | Historical sales records (shift sales) |
| `POST` | `/api/sales/return` | Customer drug return & restock |
| `GET` | `/api/users` | List staff users |
| `POST` | `/api/users` | Create staff user (Admin only) |
| `PUT` | `/api/users/:id` | Update staff user |
| `DELETE` | `/api/users/:id` | Delete staff user (Admin only) |
| `GET` | `/api/messages/inbox` | List inbox messages |
| `POST` | `/api/messages/send` | Send message |
| `DELETE` | `/api/messages/inbox/:id` | Delete message |
| `GET` | `/api/audit/logins` | User login session history |
| `GET` | `/api/stats/summary` | Live dashboard metrics |
