from datetime import datetime
from bson.objectid import ObjectId
from flask import Flask, jsonify, request
from flask_cors import CORS
from mongita import MongitaClientDisk
from werkzeug.security import generate_password_hash, check_password_hash

# -----------------------------
# Setup
# -----------------------------
app = Flask(__name__)

# CORS: allow React dev (localhost:5173) to call this API
CORS(
    app,
    resources={r"/api/*": {"origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]}},
    supports_credentials=True,
)


@app.after_request
def add_cors_headers(response):
    """
    Extra safety: ensure CORS headers are ALWAYS present,
    including for preflight OPTIONS.
    """
    origin = request.headers.get("Origin")
    if origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        response.headers.setdefault("Access-Control-Allow-Origin", origin)
        response.headers.setdefault("Vary", "Origin")
    response.headers.setdefault("Access-Control-Allow-Credentials", "true")
    response.headers.setdefault(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
    )
    response.headers.setdefault(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
    )
    return response


client = MongitaClientDisk()
db = client["inventory_db"]
items_col = db["items"]
invoices_col = db["invoices"]
users_col = db["users"]
receipts_col = db["receipts"]  # store received-stock records

# -----------------------------
# Helpers (JSON conversion)
# -----------------------------


def _to_jsonable(value):
    """
    Recursively convert Mongo/Mongita types to JSON-safe types:
      - ObjectId -> str
      - datetime -> ISO string
      - list / dict -> walk through children
    """
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    return value


def doc_to_dict(doc):
    """Convert a Mongo/Mongita document to a fully JSON-safe dict."""
    if not doc:
        return None

    raw = dict(doc)
    raw = _to_jsonable(raw)

    # Promote _id to id
    if "_id" in raw:
        raw["id"] = raw["_id"]
        del raw["_id"]

    return raw


# -----------------------------
# Seed helpers
# -----------------------------


def generate_batch_number():
    """Generate batch number like BATCH-2025-003 based on count."""
    count = items_col.count_documents({})
    year = datetime.now().year
    return f"BATCH-{year}-{str(count + 1).zfill(3)}"


def seed_items_if_empty():
    """Insert initial demo items if collection is empty."""
    if items_col.count_documents({}) > 0:
        return

    demo_items = [
        {
            "name": "Wireless Mouse",
            "category": "Electronics",
            "type": "Finished Good",
            "quantity": 150,
            "minStockLevel": 50,
            "price": 29.99,
            "sku": "ELEC-MOUSE-001",
            "description": "Ergonomic wireless mouse with USB receiver",
            "location": "Warehouse A - Aisle 3",
            "supplier": "TechSupply Co.",
            "expirationDate": None,
        },
        {
            "name": "Office Desk Chair",
            "category": "Furniture",
            "type": "Finished Good",
            "quantity": 25,
            "minStockLevel": 15,
            "price": 249.99,
            "sku": "FURN-CHAIR-002",
            "description": "Adjustable office chair with lumbar support",
            "location": "Warehouse B - Section 2",
            "supplier": "FurniturePro Inc.",
            "expirationDate": None,
        },
        {
            "name": "Printer Paper (Ream)",
            "category": "Office Supplies",
            "type": "Consumable",
            "quantity": 200,
            "minStockLevel": 100,
            "price": 5.49,
            "sku": "OFFICE-PAPER-003",
            "description": "500-sheet pack of standard A4 printer paper",
            "location": "Warehouse A - Aisle 1",
            "supplier": "OfficeWorld Distributors",
            "expirationDate": None,
        },
        {
            "name": "USB-C Cable",
            "category": "Electronics",
            "type": "Component",
            "quantity": 80,
            "minStockLevel": 40,
            "price": 9.99,
            "sku": "ELEC-CABLE-004",
            "description": "1.5m USB-C to USB-C charging cable",
            "location": "Warehouse A - Aisle 4",
            "supplier": "TechSupply Co.",
            "expirationDate": None,
        },
        {
            "name": "Bottled Water (Case)",
            "category": "Beverages",
            "type": "Consumable",
            "quantity": 60,
            "minStockLevel": 30,
            "price": 12.99,
            "sku": "BEV-WATER-005",
            "description": "24-pack of bottled drinking water",
            "location": "Warehouse C - Cold Storage",
            "supplier": "FreshDrinks Ltd.",
            "expirationDate": "2025-06-30",
        },
    ]

    for itm in demo_items:
        itm["batchNumber"] = generate_batch_number()
        items_col.insert_one(itm)


def seed_users_if_empty():
    """
    Create a default admin user if no users exist.
    username: admin
    password: admin123
    role: admin
    """
    if users_col.count_documents({}) > 0:
        return

    password_hash = generate_password_hash("admin123")
    users_col.insert_one(
        {
            "username": "admin",
            "passwordHash": password_hash,
            "role": "admin",
            "createdAt": datetime.utcnow(),
        }
    )


seed_items_if_empty()
seed_users_if_empty()

# -----------------------------
# ITEMS / INVENTORY
# -----------------------------


@app.route("/api/items", methods=["GET"])
def list_items():
    """
    GET /api/items
    Optional query params:
      - search: filters by name/sku/category (case-insensitive)
    """
    search = request.args.get("search", "").strip().lower()
    docs = list(items_col.find({}))

    result = []
    for d in docs:
        d = doc_to_dict(d)
        if not search:
            result.append(d)
        else:
            if (
                search in (d.get("name", "").lower())
                or search in (d.get("sku", "").lower())
                or search in (d.get("category", "").lower())
            ):
                result.append(d)

    return jsonify(result), 200


@app.route("/api/items", methods=["POST"])
def create_item():
    """
    POST /api/items
    body: {
      name, category, type, quantity, minStockLevel,
      price, sku, description, location, supplier, expirationDate
    }
    """
    try:
        data = request.get_json(force=True) or {}
    except Exception as e:
        return jsonify({"error": f"Invalid JSON: {e}"}), 400

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Missing or empty 'name'"}), 400

    try:
        quantity = int(data.get("quantity") or 0)
        min_stock = int(data.get("minStockLevel") or 0)
        price = float(data.get("price") or 0)
    except Exception as e:
        return jsonify({"error": f"Bad numeric field: {e}"}), 400

    item = {
        "name": name,
        "category": data.get("category") or "",
        "type": data.get("type") or "",
        "quantity": quantity,
        "minStockLevel": min_stock,
        "price": price,
        "sku": data.get("sku") or "",
        "description": data.get("description") or "",
        "location": data.get("location") or "",
        "supplier": data.get("supplier") or "",
        "expirationDate": data.get("expirationDate") or None,
        "batchNumber": generate_batch_number(),
    }

    try:
        res = items_col.insert_one(item)
        item["_id"] = res.inserted_id
        return jsonify(doc_to_dict(item)), 201
    except Exception as e:
        return jsonify({"error": f"DB insert failed: {e}"}), 500


@app.route("/api/items/<item_id>", methods=["GET"])
def get_item(item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid item id"}), 400

    doc = items_col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Item not found"}), 404

    return jsonify(doc_to_dict(doc)), 200


@app.route("/api/items/<item_id>", methods=["PUT"])
def update_item(item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid item id"}), 400

    data = request.get_json(force=True) or {}

    update_fields = {}
    for field in [
        "name",
        "category",
        "type",
        "quantity",
        "minStockLevel",
        "price",
        "sku",
        "description",
        "location",
        "supplier",
        "expirationDate",
    ]:
        if field in data:
            value = data[field]
            if field in ("quantity", "minStockLevel"):
                value = int(value)
            if field == "price":
                value = float(value)
            update_fields[field] = value

    if not update_fields:
        return jsonify({"error": "Nothing to update"}), 400

    result = items_col.update_one({"_id": oid}, {"$set": update_fields})
    if result.matched_count == 0:
        return jsonify({"error": "Item not found"}), 404

    doc = items_col.find_one({"_id": oid})
    return jsonify(doc_to_dict(doc)), 200


@app.route("/api/items/<item_id>", methods=["DELETE"])
def delete_item(item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid item id"}), 400

    result = items_col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"error": "Item not found"}), 404

    return jsonify({"status": "ok"}), 200


@app.route("/api/items/<item_id>/adjust_stock", methods=["POST"])
def adjust_stock(item_id):
    """
    POST /api/items/<id>/adjust_stock
    body: { "delta": number, "changedBy"?: "username" }   (delta can be negative)

    This will:
      1) Update the item's quantity.
      2) If delta > 0, create a receipt record in `receipts_col`
         so you have a permanent log of received stock.
    """
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid item id"}), 400

    data = request.get_json(force=True) or {}
    try:
        delta = int(data.get("delta") or 0)
    except Exception as e:
        return jsonify({"error": f"Bad delta value: {e}"}), 400

    changed_by = data.get("changedBy") or None

    doc = items_col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Item not found"}), 404

    # 1) Update stock
    new_qty = max(0, int(doc.get("quantity") or 0) + delta)
    items_col.update_one({"_id": oid}, {"$set": {"quantity": new_qty}})

    # 2) If stock is increased, record a receipt
    if delta > 0:
        now = datetime.utcnow()
        receipt_doc = {
            "itemId": oid,
            "sku": doc.get("sku") or "",
            "name": doc.get("name") or "",
            "quantity": delta,
            "receivedAt": now,
            "createdAt": now,
            "receivedBy": changed_by,
        }
        receipts_col.insert_one(receipt_doc)

    updated = items_col.find_one({"_id": oid})
    return jsonify(doc_to_dict(updated)), 200


# -----------------------------
# INVOICE TOTALS HELPER
# -----------------------------


def compute_invoice_totals(inv_doc):
    """Helper used by invoices endpoints and /api/stats if needed."""
    lines = inv_doc.get("lines") or []
    subtotal = 0.0
    for l in lines:
        subtotal += float(l.get("price") or 0) * int(l.get("quantity") or 0)

    tax_rate = float(inv_doc.get("taxRate") or 0)
    discount_rate = float(inv_doc.get("discountRate") or 0)

    discount_amount = subtotal * discount_rate / 100.0
    after_dis = max(0.0, subtotal - discount_amount)
    tax_amount = after_dis * tax_rate / 100.0
    total = after_dis + tax_amount

    return {
        "subtotal": round(subtotal, 2),
        "discountRate": discount_rate,
        "discountAmount": round(discount_amount, 2),
        "taxRate": tax_rate,
        "taxAmount": round(tax_amount, 2),
        "total": round(total, 2),
    }


# -----------------------------
# SALES / INVOICES
# -----------------------------


@app.route("/api/invoices", methods=["GET"])
def list_invoices():
    """
    GET /api/invoices
    returns all invoices with totals calculated on the backend
    """
    docs = list(invoices_col.find({}))
    # Sort in Python to avoid Mongita datetime issues
    docs.sort(key=lambda d: str(d.get("printedAt") or ""), reverse=True)

    result = []
    for inv in docs:
        inv_dict = doc_to_dict(inv)
        inv_dict["totals"] = compute_invoice_totals(inv)
        result.append(inv_dict)

    return jsonify(result), 200


@app.route("/api/invoices", methods=["POST"])
def create_invoice():
    """
    POST /api/invoices
    body example:
    {
      "number": "INV-XXXX",
      "printedAt": "2025-01-01T12:00:00Z" (optional; if missing, backend uses now),
      "customerName": "John Doe",
      "customerPhone": "123456",
      "taxRate": 10,
      "discountRate": 5,
      "lines": [
        { "itemId": "<id>", "name": "...", "sku": "...", "price": 10.5, "quantity": 2 }
      ],
      "applyStockChange": true | false,
      "createdBy": "username"
    }

    If applyStockChange = true, stock is reduced here.
    (If your React already reduces stock per scan, set it to false.)
    """
    data = request.get_json(force=True) or {}
    number = data.get("number")
    lines = data.get("lines") or []

    if not number or not lines:
        return jsonify({"error": "number and lines are required"}), 400

    printed_at_str = data.get("printedAt")
    if printed_at_str:
        try:
            dt = datetime.fromisoformat(printed_at_str.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.utcnow()
        printed_at = dt.replace(tzinfo=None)  # store naive
    else:
        printed_at = datetime.utcnow()

    tax_rate = float(data.get("taxRate") or 0)
    discount_rate = float(data.get("discountRate") or 0)
    customer_name = data.get("customerName") or ""
    customer_phone = data.get("customerPhone") or ""
    created_by = data.get("createdBy") or ""

    # Normalize lines
    norm_lines = []
    for l in lines:
        item_id_str = l.get("itemId")
        try:
            item_oid = ObjectId(item_id_str) if item_id_str else None
        except Exception:
            item_oid = None

        norm_lines.append(
            {
                "itemId": item_oid,
                "name": l.get("name") or "",
                "sku": l.get("sku") or "",
                "price": float(l.get("price") or 0),
                "quantity": int(l.get("quantity") or 0),
            }
        )

    invoice = {
        "number": number,
        "printedAt": printed_at,
        "customerName": customer_name,
        "customerPhone": customer_phone,
        "taxRate": tax_rate,
        "discountRate": discount_rate,
        "lines": norm_lines,
        "createdBy": created_by,
    }

    # Optionally apply stock change here
    apply_stock = bool(data.get("applyStockChange"))
    if apply_stock:
        for line in norm_lines:
            if line["itemId"]:
                doc = items_col.find_one({"_id": line["itemId"]})
                if doc:
                    new_qty = max(
                        0,
                        int(doc.get("quantity") or 0) - int(line["quantity"] or 0),
                    )
                    items_col.update_one(
                        {"_id": line["itemId"]}, {"$set": {"quantity": new_qty}}
                    )

    res = invoices_col.insert_one(invoice)
    invoice["_id"] = res.inserted_id
    inv_dict = doc_to_dict(invoice)
    inv_dict["totals"] = compute_invoice_totals(invoice)
    return jsonify(inv_dict), 201


@app.route("/api/invoices/<invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    try:
        oid = ObjectId(invoice_id)
    except Exception:
        return jsonify({"error": "Invalid invoice id"}), 400

    doc = invoices_col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Invoice not found"}), 404

    inv_dict = doc_to_dict(doc)
    inv_dict["totals"] = compute_invoice_totals(doc)
    return jsonify(inv_dict), 200


@app.route("/api/invoices/<invoice_id>", methods=["PUT"])
def update_invoice(invoice_id):
    """
    PUT /api/invoices/<id>
    body: partial invoice (same shape as create, but we do NOT touch stock here)
    This matches your React behavior: editing invoice doesn't change stock.
    """
    try:
        oid = ObjectId(invoice_id)
    except Exception:
        return jsonify({"error": "Invalid invoice id"}), 400

    data = request.get_json(force=True) or {}
    update_fields = {}

    if "customerName" in data:
        update_fields["customerName"] = data.get("customerName") or ""

    if "customerPhone" in data:
        update_fields["customerPhone"] = data.get("customerPhone") or ""

    if "taxRate" in data:
        update_fields["taxRate"] = float(data.get("taxRate") or 0)

    if "discountRate" in data:
        update_fields["discountRate"] = float(data.get("discountRate") or 0)

    if "lines" in data:
        norm_lines = []
        for l in data.get("lines") or []:
            item_id_str = l.get("itemId")
            try:
                item_oid = ObjectId(item_id_str) if item_id_str else None
            except Exception:
                item_oid = None

            norm_lines.append(
                {
                    "itemId": item_oid,
                    "name": l.get("name") or "",
                    "sku": l.get("sku") or "",
                    "price": float(l.get("price") or 0),
                    "quantity": int(l.get("quantity") or 0),
                }
            )
        update_fields["lines"] = norm_lines

    if not update_fields:
        return jsonify({"error": "Nothing to update"}), 400

    res = invoices_col.update_one({"_id": oid}, {"$set": update_fields})
    if res.matched_count == 0:
        return jsonify({"error": "Invoice not found"}), 404

    doc = invoices_col.find_one({"_id": oid})
    inv_dict = doc_to_dict(doc)
    inv_dict["totals"] = compute_invoice_totals(doc)
    return jsonify(inv_dict), 200


# -----------------------------
# RECEIPTS (received stock log)
# -----------------------------


@app.route("/api/receipts", methods=["GET", "POST", "OPTIONS"])
def receipts():
    """
    GET /api/receipts
      -> Return all receipt records (newest first)

    POST /api/receipts
      body: { "itemId": "<id string>", "quantity": <number>, "receivedBy"?: "name" }

      -> Increases the item's quantity by `quantity`
         and creates a receipt record.
         Returns: { "updatedItem": {...}, "receipt": {...} }
    """
    # --- Preflight for CORS ---
    if request.method == "OPTIONS":
        # after_request will add headers; 204 is fine for preflight
        return ("", 204)

    # --- List receipts ---
    if request.method == "GET":
        docs = list(receipts_col.find({}))
        docs.sort(
            key=lambda d: str(d.get("receivedAt") or d.get("createdAt") or ""),
            reverse=True,
        )
        result = [doc_to_dict(d) for d in docs]
        return jsonify(result), 200

    # --- Create receipt + increase stock (POST) ---
    data = request.get_json(force=True) or {}

    item_id_str = data.get("itemId")
    if not item_id_str:
        return jsonify({"error": "itemId is required"}), 400

    try:
        oid = ObjectId(item_id_str)
    except Exception:
        return jsonify({"error": "Invalid itemId"}), 400

    try:
        qty = int(data.get("quantity") or 0)
    except Exception as e:
        return jsonify({"error": f"Bad quantity value: {e}"}), 400

    if qty <= 0:
        return jsonify({"error": "quantity must be > 0"}), 400

    doc = items_col.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Item not found"}), 404

    old_qty = int(doc.get("quantity") or 0)
    new_qty = max(0, old_qty + qty)

    # Update item stock
    items_col.update_one({"_id": oid}, {"$set": {"quantity": new_qty}})

    now = datetime.utcnow()
    receipt_doc = {
        "itemId": oid,
        "sku": doc.get("sku") or "",
        "name": doc.get("name") or "",
        "quantity": qty,
        "previousQuantity": old_qty,
        "newQuantity": new_qty,
        "receivedAt": now,
        "createdAt": now,
        "receivedBy": data.get("receivedBy") or None,
    }
    res = receipts_col.insert_one(receipt_doc)
    receipt_doc["_id"] = res.inserted_id

    updated_item = items_col.find_one({"_id": oid})

    return (
        jsonify(
            {
                "updatedItem": doc_to_dict(updated_item),
                "receipt": doc_to_dict(receipt_doc),
            }
        ),
        201,
    )


# -----------------------------
# DASHBOARD STATS
# -----------------------------


@app.route("/api/stats", methods=["GET"])
def stats():
    """
    GET /api/stats
    Returns data used in the dashboard cards:
      - totalQuantity
      - lowStockCount
      - lowStockItems (names)
      - totalInventoryValue
      - uniqueCategoriesCount
    """
    docs = list(items_col.find({}))

    total_quantity = 0
    low_stock_items = []
    total_value = 0.0
    categories = set()

    for d in docs:
        qty = int(d.get("quantity") or 0)
        min_stock = int(d.get("minStockLevel") or 0)
        price = float(d.get("price") or 0)
        total_quantity += qty
        total_value += qty * price

        cat = d.get("category")
        if cat:
            categories.add(cat)

        if min_stock > 0 and qty < min_stock:
            low_stock_items.append(d.get("name") or "")

    return jsonify(
        {
            "totalQuantity": total_quantity,
            "lowStockCount": len(low_stock_items),
            "lowStockItems": low_stock_items,
            "totalInventoryValue": round(total_value, 2),
            "uniqueCategoriesCount": len(categories),
        }
    ), 200


# -----------------------------
# AUTH & USERS (username/password)
# -----------------------------


@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    """
    POST /api/login
    body: { "username": "...", "password": "..." }
    Returns: { "username": "...", "role": "admin"|"saler" } on success
    """
    if request.method == "OPTIONS":
        # Preflight handled by after_request; just return 204
        return ("", 204)

    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = users_col.find_one({"username": username})
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    if not check_password_hash(user.get("passwordHash", ""), password):
        return jsonify({"error": "Invalid username or password"}), 401

    return jsonify(
        {
            "username": user["username"],
            "role": user.get("role", "saler"),
        }
    ), 200


@app.route("/api/users", methods=["GET"])
def list_users():
    """
    GET /api/users
    Returns all users WITHOUT password hashes.
    Used by the admin-only Users Management page in the frontend.
    """
    docs = list(users_col.find({}))

    public_users = []
    for d in docs:
        d = doc_to_dict(d)
        if "passwordHash" in d:
            del d["passwordHash"]
        public_users.append(d)

    return jsonify(public_users), 200


@app.route("/api/users", methods=["POST"])
def create_user():
    """
    POST /api/users
    body: { "username": "...", "password": "...", "role": "admin"|"saler" }
    (In a real system, this should be restricted to admins via auth.)
    """
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = data.get("role") or "saler"

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    if role not in ("admin", "saler"):
        return jsonify({"error": "role must be 'admin' or 'saler'"}), 400

    # Check if username already exists
    if users_col.find_one({"username": username}):
        return jsonify({"error": "Username already exists"}), 400

    password_hash = generate_password_hash(password)
    doc = {
        "username": username,
        "passwordHash": password_hash,
        "role": role,
        "createdAt": datetime.utcnow(),
    }
    res = users_col.insert_one(doc)
    doc["_id"] = res.inserted_id
    user = doc_to_dict(doc)
    if "passwordHash" in user:
        del user["passwordHash"]

    return jsonify(user), 201


@app.route("/api/users/<user_id>/password", methods=["PUT"])
def change_user_password(user_id):
    """
    PUT /api/users/<id>/password
    body: { "password": "newPassword" }
    """
    try:
        oid = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid user id"}), 400

    data = request.get_json(force=True) or {}
    new_password = data.get("password") or ""
    if not new_password:
        return jsonify({"error": "password is required"}), 400

    password_hash = generate_password_hash(new_password)

    res = users_col.update_one({"_id": oid}, {"$set": {"passwordHash": password_hash}})
    if res.matched_count == 0:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"status": "ok"}), 200


# -----------------------------
# HEALTH CHECK
# -----------------------------


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    # Use 0.0.0.0 if you want other devices to access, else 127.0.0.1 is fine.
    app.run(host="127.0.0.1", port=5000, debug=True)
