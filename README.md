# Pharmacy Management System

A DBMS mini project: pharmacy staff manage medicines, suppliers, purchases and sales billing from the browser. Stock levels, expiry dates and low-stock warnings are tracked automatically, and every action (add, update, delete, search) is stored in MySQL and can be viewed in MySQL Workbench. Built with **Node.js + Express + MySQL** (mysql2, bcrypt, JWT) and a plain HTML/CSS/JavaScript front end.

All users, medicines and records in the sample data are fictional.

---

## Table of Contents

1. [Setup](#1-setup)
2. [Roles](#2-roles)
3. [Business rules](#3-business-rules)
4. [Database design](#4-database-design)
5. [Where each DBMS concept is used](#5-where-each-dbms-concept-is-used)
6. [Key features and modules](#6-key-features-and-modules)
7. [File structure](#8-file-structure)
8. [Demo flow](#9-demo-flow-10-minutes)
9. [Troubleshooting](#10-troubleshooting)

---

## 1. Setup

### Requirements
- **Node.js** 16 or newer (check with `node -v` and `npm -v`)
- **MySQL Server 5.7+ or 8.0+** running on port `3306`, and **MySQL Workbench** (or any MySQL client)

### Steps
1. Start MySQL (Windows Services, or open your connection in MySQL Workbench).
2. Open MySQL Workbench, connect to your server (`127.0.0.1:3306`), go to **File → Open SQL Script**, choose `database/schema.sql` and click the lightning bolt. This creates `pharmacy_db` with 9 tables and sample data. The app also creates missing tables on startup, so this step is a backup. Re-running the script resets the sample data.
3. Open a terminal in the `web-app` folder and create your configuration file:
   ```bash
   cd web-app
   copy .env.example .env        # Mac/Linux: cp .env.example .env
   ```
4. Open `web-app/.env` and enter your MySQL password:
   ```ini
   # MySQL Database Configuration
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password_here
   DB_NAME=pharmacy_db

   # Web Server Port
   PORT=3000

   # JWT Secret for Session Authentication (use any long random text)
   JWT_SECRET=change_this_to_a_random_secret
   ```
5. Install and start:
   ```bash
   npm install
   npm start
   ```
6. Open **http://localhost:3000**.

The real `.env` file is git-ignored, so passwords are never uploaded.

### Demo logins

| User ID / Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| `1` or `admin` | `admin` | Admin | Full access (billing, inventory, pricing, suppliers, staff accounts) |
| `2` or `mark` | `mark123` | Employee | POS billing, inventory search, drug details |
| `3` or `clark` | `clark123` | Employee | POS billing, inventory search, drug details |

Passwords are stored only as bcrypt hashes. New staff accounts can be added through the User module. These are demo accounts for learning only.

---

## 2. Roles

| | Employee | Admin |
| :--- | :--- | :--- |
| Log in, change own password | Yes | Yes |
| Search medicines, view drug details | Yes | Yes |
| POS billing, receipts, customer returns | Yes | Yes |
| Internal messages | Yes | Yes |
| Add / edit / delete medicines, prices, validity, shelf place | - | Yes |
| Manage suppliers (companies) and purchases | - | Yes |
| Manage staff accounts | - | Yes |
| View login history | - | Yes |

---

## 3. Business rules

- A medicine is linked to a supplier company, so at least one company must exist before a drug can be added.
- **Expiry alert:** medicines expiring within **30 days** are listed as warnings.
- **Low-stock alert:** medicines with **10 units or fewer** are listed as warnings.
- A sale is accepted only if enough stock is available. On checkout the stock is reduced and the receipt is saved to the sales history.
- A customer return adds the returned quantity back to stock.
- Every login is recorded with the user and the time.
- Sessions use JWT tokens; passwords are hashed with bcrypt (10 salt rounds).

---

## 4. Database design

Database: `pharmacy_db` · 9 tables · InnoDB · `utf8mb4`

| Table | Purpose |
| :--- | :--- |
| `company` | Pharmaceutical manufacturers and suppliers |
| `drugs` | Drug inventory: barcode, name, dose, pricing, expiry, shelf place, quantity, supplier |
| `purchase` | Procurement orders and supplier deals |
| `sales` | Active POS checkout cart |
| `history_sales` | Saved sales and receipts with cashier username and timestamp |
| `users` | User and employee accounts with bcrypt password hashes |
| `login` | Login session audit trail |
| `inbox` | Received internal messages |
| `message_history` | Sent internal messages |

```
COMPANY 1──N DRUGS ──< PURCHASE
                 │
                 └──< SALES (cart) ──> HISTORY_SALES
USERS 1──N LOGIN          USERS ──< INBOX / MESSAGE_HISTORY
```

The ER diagram and relational schema are in `diagram/`. Run `SHOW CREATE TABLE drugs;` in MySQL Workbench to see the exact keys and constraints of any table.

### The checkout transaction (`web-app/src/routes/sales.js`)

```
CHECKOUT
START TRANSACTION
  read the cart items
  check that every item has enough stock
  INSERT the sale into history_sales
  UPDATE drugs   quantity - sold quantity
  clear the cart
COMMIT        (any error -> ROLLBACK, nothing is saved)
```

Because the steps run as one transaction, a sale is either saved completely or not at all, so stock and sales records can never disagree.

---

## 5. Where each DBMS concept is used

| Concept | Where |
| :--- | :--- |
| DDL: CREATE TABLE, primary keys, foreign keys, indexes | `database/schema.sql` |
| Sample data with INSERT | `database/schema.sql` |
| INSERT / UPDATE / DELETE / SELECT for every module | `web-app/src/routes/*.js` |
| Parameterised queries (SQL-injection safe) | all route files |
| Transactions (COMMIT / ROLLBACK) | `routes/sales.js` (checkout, returns) |
| Aggregates for dashboard counters | `routes/stats.js` |
| Date-based filtering (expiry within 30 days) | `routes/drugs.js` |
| Connection pool and automatic table creation | `src/db.js` |
| Password hashing, JWT authentication, role checks | `routes/auth.js`, `middleware/auth.js` |

---

## 6. Key features and modules

- **Dashboard:** live clock and date, real-time metrics, active session indicators, and expiry / stock alert badges.
- **Company management:** full CRUD for pharmaceutical suppliers, with search and a telephone directory.
- **Drug inventory:** barcode lookup, batch codes, dosages, costs, shelf locations and retail prices.
- **Drug tools:** search, price editing, validity renewal, shelf relocation, expired-drug warnings (30 days or less) and low-stock warnings (10 units or fewer).
- **Purchases:** track supplier purchase deals, order volumes, costs and expenditure totals.
- **Point of sale and billing:** cart management, stock validation, atomic transactions, receipts, customer returns with restocking, and shift sales reports.
- **User administration:** staff accounts, role assignment and secure password updates with bcrypt.
- **Session and audit logs:** history of all staff logins with timestamps and user IDs.
- **Internal messaging:** messages between pharmacists and administration.

---

## 7. File structure

```text
Pharmacy-Management-System/
├── database/
│   └── schema.sql             Tables, constraints and sample data
├── diagram/
│   ├── ER_diagram.png         Entity-Relationship diagram
│   └── RelationalSchema.png   Relational schema
├── web-app/
│   ├── public/
│   │   ├── assets/            Logos, icons and images
│   │   ├── css/style.css      UI styling
│   │   ├── js/app.js          Client-side routing, API calls, dynamic UI
│   │   └── index.html         Single-page interface
│   ├── src/
│   │   ├── middleware/auth.js JWT authentication and role checks
│   │   ├── routes/            audit, auth, companies, drugs, messages,
│   │   │                      purchases, sales, stats, users
│   │   ├── db.js              MySQL connection pool and auto-migration
│   │   └── server.js          Express startup
│   ├── test/api-test.js       Automated API tests
│   ├── .env.example           Environment template
│   ├── package.json
│   └── README.md
├── .env.example
├── .gitignore
└── README.md
```

---

## 8. Demo flow (10 minutes)

1. **Start:** run `npm start`, open `http://localhost:3000` and log in as `admin`.
2. **Dashboard:** show the live clock, the counters and the expiry / low-stock badges.
3. **Company:** add a supplier company, then run `SELECT * FROM company;` in MySQL Workbench to show the new row.
4. **Drugs:** add a medicine linked to that company (the Supplier list comes from the `company` table), then show it in `drugs`.
5. **Purchase:** record a purchase deal and show it in the `purchase` table.
6. **POS billing:** log in as `mark`, add the medicine to the cart and check out. Explain the transaction, then show that the stock dropped in `drugs` and the receipt is in `history_sales`.
7. **Return:** process a customer return and show that stock is restored.
8. **Alerts:** open the expired and low-stock lists.
9. **Audit and messages:** show the login history, send a message from `mark` to `admin` and read it in the inbox.
10. **Security:** show a password hash in the `users` table and a failed login with a wrong password.

---

## 9. Troubleshooting

- **Database connection refused / access denied**
  - Check that the MySQL service is running.
  - Check `DB_USER` and `DB_PASSWORD` in `web-app/.env`, and test the same credentials in MySQL Workbench.
- **Port 3000 already in use**
  - Change `PORT=3000` in `web-app/.env` to another port (for example `3001`), or stop the old process with `netstat -ano | findstr :3000` and `taskkill /PID <PID> /F`.
- **`npm error: package.json not found`**
  - You are in the wrong folder. Run `cd web-app` first.
- **Supplier Company list is empty in Add Drug**
  - Add a company in the Company module first.

---
