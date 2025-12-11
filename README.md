# Smart Inventory & POS Management System

A full-stack **Inventory and Point of Sale (POS)** system for small shops and warehouses, built with **Flask (Python)**, **React**, and **Mongita** 

The system lets users:

- Manage inventory items (CRUD).
- Adjust and receive stock (with history).
- Sell items via a POS interface using barcodes/SKUs.
- Print customer invoices and item barcodes.
- Manage system users and roles (admin vs saler).

---

## Features

### Inventory Management
- Create, view, update, and delete items.
- Track quantity, minimum stock level, price, category, type, supplier, location, batch number, and expiration date.
- Dashboard with:
  - Total quantity in stock.
  - Low-stock count and list.
  - Total inventory value.
  - Number of unique categories.
- Charts:
  - Stock by item.
  - Stock by category (clickable filter).

### Stock Adjustments & Receiving
- Manual stock adjustment per item (positive or negative delta).
- Receive stock by scanning or typing barcode/SKU:
  - Increases item quantity.
  - Logs each receipt in a **Received Stock History** view.
  - Stores previous quantity, new quantity, and timestamp.

### Sales / POS
- POS screen for scanning barcodes/SKUs and adding items to an invoice.
- Per-line quantity and unit price.
- Automatic calculation of:
  - Subtotal
  - Discount (%)
  - Tax (%)
  - Grand total
- Invoice printing (browser print) with:
  - Invoice number
  - Date & time
  - Customer name and phone
  - Itemized list
- Saved invoices history (backend persists every printed invoice).

### Invoices History
- List of all invoices with:
  - Invoice number
  - Printed date/time
  - Customer
  - Subtotal and total
- Admins can open and **edit invoices** (update lines, prices, quantities, tax, discount).  
  Editing invoices does **not** change stock; it is for record correction only.

### Barcodes
- Generate and print barcodes for each item.
- Barcodes use either `sku` or the internal item ID.
- Printed barcodes can be scanned in the POS or Receive-Stock screens.

### User Management & Roles
- Login with username and password.
- Two roles:
  - `admin` – full access (inventory management, users, receipts view, invoice editing).
  - `saler` – sales/POS and basic views.
- Admin-only **Users** page:
  - Create new users (username, password, role).
  - Reset passwords for existing users.

### Received Stock History (Admin)
- Table of all stock receipts:
  - Item name
  - SKU
  - Quantity received
  - Previous quantity
  - New quantity
  - Date/time
  - Received by (optional)

---

## Tech Stack

**Backend**
- Python 3
- Flask
- Flask-CORS
- Mongita (`MongitaClientDisk`) – embedded document database
- Werkzeug security (password hashing)

**Frontend**
- React (with hooks)
- Vite (development server; port `5173` by default)
- Recharts (charts)
- `react-barcode` (printing barcodes)
- Fetch API for HTTP calls

---

## Architecture Overview

The project uses a classic client–server architecture:

- **Frontend (React)**  
  Runs in the browser, calling the backend via RESTful JSON APIs.  
  Main views:
  - Inventory View
  - Sales / POS
  - Invoices
  - Received Stock (Admin)
  - Users (Admin)

- **Backend (Flask)**  
  Exposes `/api/...` endpoints:
  - `/api/items` – inventory management
  - `/api/items/<id>/adjust_stock` – stock changes
  - `/api/receipts` – stock receipts (GET + POST)
  - `/api/invoices` – invoices (GET + POST)
  - `/api/invoices/<id>` – invoice detail/update
  - `/api/users`, `/api/users/<id>/password` – user management
  - `/api/login` – authentication
  - `/api/health` – health check

- **Database (Mongita)**  
  - Disk-based collections (e.g. `items`, `invoices`, `users`, `receipts`).
  - MongoDB-style `insert_one`, `find`, `update_one`, etc.
  - Handles persistence without requiring a separate DB server.

---

## Getting Started

### Prerequisites

- **Python 3.8+**
- **Node.js 16+** & **npm**

### Clone the Repository

```bash
git https://github.com/Kentcsclass/smart_imventory.git
cd smart_imventory
---

## Backend Setup (Flask + Mongita)

1. Go to the backend folder (where `app.py` lives):

   ```bash
   cd backend
   ```

2. (Optional) Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate      # on macOS / Linux
   venv\Scripts ctivate         # on Windows
   ```

3. Install dependencies:

   ```bash
   pip install flask flask-cors mongita werkzeug
   ```

4. Run the backend server:

   ```bash
   python app.py
   ```

   By default, it starts at:

   - URL: `http://127.0.0.1:5000`
   - Health check: `http://127.0.0.1:5000/api/health`

5. On first run, the backend will:

   - Seed **demo items** if the `items` collection is empty.
   - Seed a **default admin** user if the `users` collection is empty.

   **Default admin credentials:**

   - **Username:** `admin`  
   - **Password:** `admin123`  
   - **Role:** `admin`

---

## Frontend Setup (React + Vite)

1. Go to the frontend folder (where `package.json` and `src/App.jsx` are):

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Ensure `API_BASE` in `src/App.jsx` points to your backend:

   ```js
   const API_BASE = "http://127.0.0.1:5000";
   ```

4. Start the developmental server:

   ```bash
   npm run dev
   ```

   By default, Vite serves the app at:

   - `http://127.0.0.1:5173`

5. Open that URL in your browser and log in with the default admin credentials.

---

## Usage

### 1. Login

- Access the app at `http://127.0.0.1:5173`.
- Login with an existing user (e.g., `admin` / `admin123`).
- The sidebar shows:
  - Your username and role.
  - Navigation buttons:
    - Inventory View
    - Sales / POS
    - Invoices
    - Received Stock (Admin only)
    - Users (Admin only)

### 2. Inventory Management (Admin)

- Navigate to **Inventory View**.
- View dashboard statistics and charts.
- Click **+ Add New Item** to create a new product.
- Select an item to:
  - View details (modal).
  - Adjust stock.
  - Edit item.
  - Delete item.
- Use the search input in the sidebar to filter by name, SKU, or category.

### 3. Sales / POS

- Navigate to **Sales / POS**.
- Scan or type a barcode/SKU into the **Barcode / SKU** field.
- Set **Qty** and click **Add**.
- The invoice table shows each line with quantity and line total.
- Fill optional **Customer Name** and **Phone**.
- Set **Discount (%)** and **Tax (%)**.
- Click **Print Invoice**:
  - The invoice is printed via the browser print dialog.
  - The invoice is also saved in the backend (`/api/invoices`).
- Buttons:
  - **Clear Invoice (keep stock)** – empties the current invoice lines without changing stock.
  - **Void Invoice (restore stock)** – restores stock for the items in the current invoice.

Note: Stock is decreased at the time you add items to the invoice, via `/api/items/<id>/adjust_stock` with a negative `delta`.

### 4. Receiving Stock via Barcode

- Click **Receive Stock (Scan)** in the sidebar.
- In the modal:
  - Scan or type an item’s barcode/SKU.
  - Enter the quantity to add.
  - Submit the form.
- The backend:
  - Increases the item’s quantity.
  - Creates a receipt record in `/api/receipts` with:
    - previousQuantity
    - newQuantity
    - quantity received
    - receivedAt timestamp

### 5. Invoices History

- Navigate to the **Invoices** view.
- See all saved invoices with basic info (number, date/time, subtotal, total).
- Admin users can click **Edit**:
  - Adjust customer details.
  - Adjust discount and tax.
  - Modify lines’ quantities and prices.
  - Save changes.

### 6. Received Stock History (Admin)

- Navigate to **Received Stock (Admin)**.
- View a table of all stock receipt entries:
  - Date / time
  - Item name
  - SKU
  - Received quantity
  - Previous quantity
  - New quantity
  - ReceivedBy (if provided)

### 7. Users Management (Admin)

- Navigate to **Users (Admin)**.
- Create a new user with:
  - Username
  - Password
  - Role (`admin` or `saler`)
- View list of users:
  - Username
  - Role
  - CreatedAt / UpdatedAt
- Select a user and reset their password.

---

## Project Structure (Example)

Adapt to your actual folders:

```text
project-root/
├── backend/
│   ├── app.py
│   ├── requirements.txt        
│   └── ...              
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        └── App.jsx
```

---

## API Overview

### Items

- `GET /api/items`  
  List all items (optional `?search=` query).

- `POST /api/items`  
  Create a new item.

- `GET /api/items/<item_id>`  
  Get a single item.

- `PUT /api/items/<item_id>`  
  Update an item.

- `DELETE /api/items/<item_id>`  
  Delete an item.

- `POST /api/items/<item_id>/adjust_stock`  
  Body: `{ "delta": number }`  
  Adjust an item’s quantity. Positive delta increases stock, negative decreases it.

### Receipts (Received Stock)

- `GET /api/receipts`  
  List all receipt documents.

- `POST /api/receipts`  
  Body: `{ "itemId": "<id>", "quantity": number, "receivedBy"?: "string" }`  
  Increases quantity and logs a receipt.

### Invoices

- `GET /api/invoices`  
  List all invoices (newest first), including computed totals.

- `POST /api/invoices`  
  Create a new invoice.  
  Body includes: `number`, `printedAt`, `customerName`, `customerPhone`, `taxRate`, `discountRate`, `lines`, `applyStockChange`.

- `GET /api/invoices/<invoice_id>`  
  Get invoice with computed totals.

- `PUT /api/invoices/<invoice_id>`  
  Update invoice (no stock change).

### Users & Auth

- `POST /api/login`  
  Body: `{ "username": "...", "password": "..." }`  
  Returns `{ "username": "...", "role": "admin" | "saler" }` on success.

- `GET /api/users`  
  List users (without password hashes).

- `POST /api/users`  
  Create user. Body: `{ "username": "...", "password": "...", "role": "admin" | "saler" }`.

- `PUT /api/users/<user_id>/password`  
  Body: `{ "password": "newPassword" }`.

### Health Check

 `GET /api/health`  
  Returns `{ "status": "ok" }`.
## Known Limitations / Future Work

- No full session management (no JWT or cookie-based sessions yet).
- No HTTPS or advanced security hardening.
- Limited validation and error reporting in the UI.
- No automated tests (manual/integration testing only).
- Single-store design (no multi-branch inventory separation).

Possible future enhancements:

- Add robust authentication and authorization middleware.
- Implement more detailed reports (sales over time, top items, etc.).
- Support multiple warehouses/locations.
- Add data export (CSV/PDF) and backups.

---

## License
LICENSE: MIT recommended for open-source projects


