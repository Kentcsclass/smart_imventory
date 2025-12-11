import React, { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Barcode from "react-barcode";

const API_BASE = "http://127.0.0.1:5000";

const CATEGORIES = [
  "Electronics",
  "Furniture",
  "Office Supplies",
  "Beverages",
  "Safety Supplies",
  "Components",
];

const TYPES = ["Finished Good", "Component", "Consumable", "Service"];

// --- Helpers ---
function computeInvoiceTotalsFromInvoice(invoice) {
  let subtotal = 0;
  (invoice.lines || []).forEach((l) => {
    subtotal += (l.price || 0) * (l.quantity || 0);
  });
  const discountRate = Math.max(0, Math.min(100, invoice.discountRate || 0));
  const taxRate = Math.max(0, Math.min(100, invoice.taxRate || 0));
  const discountAmount = (subtotal * discountRate) / 100;
  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = (afterDiscount * taxRate) / 100;
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total, discountRate, taxRate };
}

// Simple card for stats
function StatCard({ label, value, secondary }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      {secondary != null && (
        <div style={styles.statSecondary}>{secondary}</div>
      )}
    </div>
  );
}

// Modal wrapper
function Modal({ title, onClose, children }) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2>{title}</h2>
          <button style={styles.buttonSecondary} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

// Charts (stock by item + stock by category) with category-click filter
function InventoryCharts({ items, selectedCategory, onCategorySelect }) {
  const filteredForItems = selectedCategory
    ? items.filter((i) => i.category === selectedCategory)
    : items;

  const perItem = filteredForItems.map((i) => ({
    name: i.name,
    quantity: i.quantity || 0,
  }));

  const perCategoryMap = new Map();
  items.forEach((i) => {
    const key = i.category || "Uncategorized";
    const prev = perCategoryMap.get(key) || 0;
    perCategoryMap.set(key, prev + (i.quantity || 0));
  });
  const perCategory = Array.from(perCategoryMap.entries()).map(
    ([name, quantity]) => ({ name, quantity })
  );

  const handleCategoryBarClick = (data) => {
    if (!onCategorySelect) return;
    const name = data?.payload?.name;
    if (!name) return;
    if (selectedCategory === name) {
      onCategorySelect(null);
    } else {
      onCategorySelect(name);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={styles.chartCard}>
        <div style={styles.chartTitleRow}>
          <div style={styles.chartTitle}>Stock by Item</div>
          {selectedCategory && (
            <button
              style={styles.buttonSecondary}
              onClick={() => onCategorySelect && onCategorySelect(null)}
            >
              Clear filter ({selectedCategory})
            </button>
          )}
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={perItem}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip />
            <Bar dataKey="quantity" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.chartCard}>
        <div style={styles.chartTitle}>Stock by Category</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={perCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="quantity" onClick={handleCategoryBarClick} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12, marginTop: 4, color: "#6b7280" }}>
          Click a bar to filter the "Stock by Item" chart by that category.
        </div>
      </div>
    </div>
  );
}

// Form used for both Add + Edit
function ItemForm({ initial, onSubmit, submitLabel }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      category: "",
      type: "",
      quantity: 0,
      minStockLevel: 0,
      price: 0,
      sku: "",
      description: "",
      location: "",
      supplier: "",
      expirationDate: "",
    }
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]:
        name === "quantity" || name === "minStockLevel" || name === "price"
          ? Number(value)
          : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <label>
          Name
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Category
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          >
            <option value="">Select...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            required
          >
            <option value="">Select...</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.formRow}>
        <label>
          Quantity
          <input
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
            min={0}
          />
        </label>
        <label>
          Min Stock
          <input
            type="number"
            name="minStockLevel"
            value={form.minStockLevel}
            onChange={handleChange}
            min={0}
          />
        </label>
        <label>
          Price
          <input
            type="number"
            step="0.01"
            name="price"
            value={form.price}
            onChange={handleChange}
            min={0}
          />
        </label>
      </div>

      <div style={styles.formRow}>
        <label>
          SKU
          <input name="sku" value={form.sku} onChange={handleChange} />
        </label>
        <label>
          Expiration Date
          <input
            type="date"
            name="expirationDate"
            value={form.expirationDate || ""}
            onChange={handleChange}
          />
        </label>
      </div>

      <div style={styles.formRow}>
        <label>
          Location
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
          />
        </label>
        <label>
          Supplier
          <input
            name="supplier"
            value={form.supplier}
            onChange={handleChange}
          />
        </label>
      </div>

      <label>
        Description
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
        />
      </label>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button type="submit" style={styles.buttonPrimary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// Adjust Stock form (manual)
function AdjustStockForm({ current, onSubmit }) {
  const [delta, setDelta] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit(delta);
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <p>Current quantity: {current}</p>
      <label>
        Adjustment (can be negative)
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
        />
      </label>
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button type="submit" style={styles.buttonPrimary}>
          Apply
        </button>
      </div>
    </form>
  );
}

// Receive Stock via barcode (scan to add quantity)
function ReceiveStockForm({ items, onReceive }) {
  const [code, setCode] = useState("");
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setMessage("Scan or type a barcode / SKU first.");
      return;
    }
    const quantity = Number(qty) || 0;
    if (quantity <= 0) {
      setMessage("Quantity must be at least 1.");
      return;
    }

    const item =
      items.find((i) => i.sku === trimmed) ||
      items.find((i) => String(i.id) === trimmed);

    if (!item) {
      setMessage(`No item found for code "${trimmed}".`);
      return;
    }

    await onReceive(item.id, quantity);
    setMessage(`Stock updated for "${item.name}".`);
    setCode("");
    setQty(1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <p style={{ fontSize: 13, color: "#4b5563" }}>
        Scan or type the item barcode / SKU to increase its stock. This uses the
        same code as printed barcodes.
      </p>
      <label>
        Barcode / SKU
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </label>
      <label>
        Quantity to add
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
          onKeyDown={handleKeyDown}
        />
      </label>
      {message && (
        <div style={{ fontSize: 13, color: "#2563eb" }}>{message}</div>
      )}
      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button type="submit" style={styles.buttonPrimary}>
          Add to Stock
        </button>
      </div>
    </form>
  );
}

// Barcode print form
function BarcodePrintForm({ item, quantity, onQuantityChange }) {
  const raw = Number.isFinite(quantity) ? quantity : 1;
  const safeQuantity = Math.min(Math.max(raw || 1, 1), 100);

  const handleChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (Number.isNaN(val)) {
      onQuantityChange(1);
    } else {
      onQuantityChange(Math.min(Math.max(val, 1), 100));
    }
  };

  const labels = Array.from({ length: safeQuantity }, (_, idx) => idx);
  const barcodeValue = item.sku || String(item.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p>
        Barcodes for: <strong>{item.name}</strong>
        <br />
        SKU: <strong>{barcodeValue}</strong>
      </p>
      <label>
        Quantity (1–100)
        <input
          type="number"
          min={1}
          max={100}
          value={safeQuantity}
          onChange={handleChange}
          style={{ marginLeft: 8, width: 80 }}
        />
      </label>

      <div style={styles.barcodePreviewGrid}>
        {labels.map((i) => (
          <div key={i} style={styles.barcodeCard}>
            <Barcode
              value={barcodeValue}
              height={40}
              width={1.5}
              displayValue
            />
          </div>
        ))}
      </div>

      <div style={{ textAlign: "right" }}>
        <button
          type="button"
          style={styles.buttonPrimary}
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
    </div>
  );
}

// View item details
function ItemDetails({ item, onPrintBarcodes }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <DetailRow label="Name" value={item.name} />
      <DetailRow label="Category" value={item.category} />
      <DetailRow label="Type" value={item.type} />
      <DetailRow label="SKU" value={item.sku} />
      <DetailRow label="Quantity" value={item.quantity} />
      <DetailRow label="Min Stock" value={item.minStockLevel} />
      <DetailRow
        label="Price"
        value={`$${Number(item.price || 0).toFixed(2)}`}
      />
      <DetailRow label="Location" value={item.location} />
      <DetailRow label="Supplier" value={item.supplier} />
      <DetailRow label="Batch #" value={item.batchNumber} />
      <DetailRow label="Expiration" value={item.expirationDate || "N/A"} />
      <DetailRow label="Description" value={item.description} />
      {onPrintBarcodes && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            style={styles.buttonPrimary}
            onClick={onPrintBarcodes}
          >
            Print Barcodes
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ width: 120, fontWeight: 600 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

// --- INVOICES LIST + EDIT ---
function InvoicesView({ invoices, onEdit, canEdit }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
      }}
    >
      <h2 style={{ margin: 0 }}>Invoices History</h2>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        These invoices are saved automatically whenever you print from the POS.
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Customer</th>
              <th>User</th>
              <th style={{ textAlign: "right" }}>Subtotal</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", fontSize: 13 }}>
                  No invoices yet. Create and print one from the Sales / POS
                  view.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const totals = computeInvoiceTotalsFromInvoice(inv);
              const dateStr = inv.printedAt
                ? new Date(inv.printedAt).toLocaleString()
                : "";
              return (
                <tr key={inv.id}>
                  <td>{inv.number}</td>
                  <td>{dateStr}</td>
                  <td>{inv.customerName || "-"}</td>
                  <td>{inv.createdBy || "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    ${totals.subtotal.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    ${totals.total.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {canEdit && (
                      <button
                        type="button"
                        style={styles.buttonSecondary}
                        onClick={() => onEdit(inv.id)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceEditForm({ invoice, onSubmit }) {
  const [draft, setDraft] = useState(() => ({
    ...invoice,
    lines: (invoice.lines || []).map((l) => ({ ...l })),
  }));

  const totals = computeInvoiceTotalsFromInvoice(draft);

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateLine = (index, field, value) => {
    setDraft((prev) => {
      const lines = prev.lines.map((l, i) =>
        i === index ? { ...l, [field]: value } : l
      );
      return { ...prev, lines };
    });
  };

  const removeLine = (index) => {
    setDraft((prev) => {
      const lines = prev.lines.filter((_, i) => i !== index);
      return { ...prev, lines };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(draft);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <DetailRow label="Invoice No" value={draft.number} />
        </div>
        <div style={{ flex: 1 }}>
          <DetailRow
            label="Printed At"
            value={
              draft.printedAt ? new Date(draft.printedAt).toLocaleString() : "-"
            }
          />
        </div>
      </div>

      <div style={styles.formRow}>
        <label>
          Customer Name
          <input
            value={draft.customerName || ""}
            onChange={(e) => updateField("customerName", e.target.value)}
          />
        </label>
        <label>
          Customer Phone
          <input
            value={draft.customerPhone || ""}
            onChange={(e) => updateField("customerPhone", e.target.value)}
          />
        </label>
      </div>

      <div style={styles.formRow}>
        <label>
          Discount (%)
          <input
            type="number"
            min={0}
            max={100}
            value={draft.discountRate || 0}
            onChange={(e) =>
              updateField("discountRate", Number(e.target.value) || 0)
            }
          />
        </label>
        <label>
          Tax (%)
          <input
            type="number"
            min={0}
            max={100}
            value={draft.taxRate || 0}
            onChange={(e) => updateField("taxRate", Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <div style={{ maxHeight: 250, overflowY: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>SKU</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Line Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.lines.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", fontSize: 13 }}>
                  No lines. (You can keep invoice as a record with no items.)
                </td>
              </tr>
            )}
            {draft.lines.map((line, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{line.name}</td>
                <td>{line.sku}</td>
                <td style={{ textAlign: "right" }}>
                  <input
                    type="number"
                    min={0}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(index, "quantity", Number(e.target.value) || 0)
                    }
                    style={{ width: 70 }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={line.price}
                    onChange={(e) =>
                      updateLine(index, "price", Number(e.target.value) || 0)
                    }
                    style={{ width: 80 }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  ${(line.price * line.quantity).toFixed(2)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    style={styles.buttonSecondary}
                    onClick={() => removeLine(index)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: "right", fontSize: 13 }}>
        <div>
          <strong>Subtotal:</strong> ${totals.subtotal.toFixed(2)}
        </div>
        <div>
          <strong>Discount ({totals.discountRate}%):</strong> -$
          {totals.discountAmount.toFixed(2)}
        </div>
        <div>
          <strong>Tax ({totals.taxRate}%):</strong> +$
          {totals.taxAmount.toFixed(2)}
        </div>
        <div>
          <strong>Total:</strong> ${totals.total.toFixed(2)}
        </div>
      </div>

      <div style={{ textAlign: "right", marginTop: 8 }}>
        <button type="submit" style={styles.buttonPrimary}>
          Save Changes
        </button>
      </div>
    </form>
  );
}

// --- SALES / POS VIEW ---
function SalesView({
  items,
  onSell,
  onVoidInvoice,
  onSaveInvoice,
  currentUser,
}) {
  const [scanValue, setScanValue] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [lines, setLines] = useState([]);
  const [message, setMessage] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [discountRate, setDiscountRate] = useState(0);

  const [invoiceNumber] = useState(
    "INV-" + new Date().getTime().toString(36).toUpperCase()
  );

  // Search by item name / SKU in POS
  const [itemSearch, setItemSearch] = useState("");

  const matchingItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return [];
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          (i.sku || "").toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [items, itemSearch]);

  const handleAddToInvoice = async () => {
    const code = scanValue.trim();
    if (!code) {
      setMessage("Enter or scan a barcode (SKU).");
      return;
    }
    const qty = Number(scanQty) || 1;
    if (qty <= 0) {
      setMessage("Quantity must be at least 1.");
      return;
    }

    const item =
      items.find((i) => i.sku === code) ||
      items.find((i) => String(i.id) === code);

    if (!item) {
      setMessage(`No item found for code "${code}".`);
      return;
    }

    if (item.quantity < qty) {
      setMessage(
        `Not enough stock for "${item.name}". Available: ${item.quantity}, requested: ${qty}.`
      );
      return;
    }

    setLines((prev) => {
      const existingIndex = prev.findIndex((l) => l.id === item.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: qty,
        },
      ];
    });

    if (onSell) {
      await onSell(item.id, qty); // adjust stock in backend
    }

    setMessage("");
    setScanValue("");
    setScanQty(1);
  };

  const handleScanInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddToInvoice();
    }
  };

  const handleVoidInvoiceClick = async () => {
    if (!lines.length) {
      setMessage("No items in invoice to void.");
      return;
    }
    if (onVoidInvoice) {
      await onVoidInvoice(lines); // restore stock in backend
    }
    setLines([]);
    setMessage("Invoice voided. Stock restored.");
  };

  const invoiceTotals = useMemo(() => {
    let subtotal = 0;
    lines.forEach((l) => {
      subtotal += l.price * l.quantity;
    });

    const safeDiscount = Math.max(0, Math.min(100, discountRate || 0));
    const safeTax = Math.max(0, Math.min(100, taxRate || 0));

    const discountAmount = (subtotal * safeDiscount) / 100;
    const afterDiscount = Math.max(subtotal - discountAmount, 0);
    const taxAmount = (afterDiscount * safeTax) / 100;
    const total = afterDiscount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
      safeDiscount,
      safeTax,
    };
  }, [lines, taxRate, discountRate]);

  const printInvoice = async () => {
    if (!lines.length) {
      setMessage("No items to print. Add items to the invoice first.");
      return;
    }

    const printedAt = new Date().toISOString();

    const invoiceData = {
      number: invoiceNumber,
      printedAt,
      customerName,
      customerPhone,
      taxRate,
      discountRate,
      lines: lines.map((l) => ({ ...l })),
    };

    if (onSaveInvoice) {
      await onSaveInvoice(invoiceData); // save to backend
    }

    window.print();
  };

  const now = new Date();
  const invoiceDate = now.toLocaleDateString();
  const invoiceTime = now.toLocaleTimeString();

  return (
    <div className="invoice-print-wrapper" style={styles.invoiceWrapper}>
      <div className="invoice-card" style={styles.salesCard}>
        {/* Header */}
        <div style={styles.invoiceHeader}>
          <div>
            <h2 style={{ margin: 0 }}>INVOICE</h2>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Inventory &amp; Sales System
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <strong>Cashier:</strong> {currentUser?.username || "-"}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div>
              <strong>No:</strong> {invoiceNumber}
            </div>
            <div>
              <strong>Date:</strong> {invoiceDate}
            </div>
            <div>
              <strong>Time:</strong> {invoiceTime}
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div style={styles.customerRow}>
          <label style={{ flex: 2 }}>
            Customer Name
            <input
              className="no-print"
              style={styles.salesInput}
              placeholder="Customer full name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <div className="print-only" style={styles.printTextField}>
              {customerName || "________________________"}
            </div>
          </label>
          <label style={{ flex: 1 }}>
            Phone
            <input
              className="no-print"
              style={styles.salesInput}
              placeholder="Phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <div className="print-only" style={styles.printTextField}>
              {customerPhone || "________________"}
            </div>
          </label>
        </div>

        {/* Scan / add item */}
        <div className="no-print" style={styles.salesFormRow}>
          <label style={{ flex: 2 }}>
            Barcode / SKU
            <input
              autoFocus
              style={styles.salesInput}
              placeholder="Scan or type barcode..."
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={handleScanInputKeyDown}
            />
          </label>
          <label style={{ width: 120 }}>
            Qty
            <input
              type="number"
              min={1}
              style={styles.salesInput}
              value={scanQty}
              onChange={(e) => setScanQty(Number(e.target.value) || 1)}
              onKeyDown={handleScanInputKeyDown}
            />
          </label>
          <div style={{ alignSelf: "flex-end" }}>
            <button
              type="button"
              style={styles.buttonPrimary}
              onClick={handleAddToInvoice}
            >
              Add
            </button>
          </div>
        </div>

        {/* POS item search by name / SKU */}
        <div className="no-print" style={{ marginTop: 8 }}>
          <label style={{ fontSize: 13 }}>
            Search item by name / SKU
            <input
              style={{ ...styles.salesInput, marginTop: 4 }}
              placeholder="Start typing item name or SKU..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </label>
          {itemSearch && (
            <div
              style={{
                marginTop: 4,
                maxHeight: 150,
                overflowY: "auto",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              {matchingItems.length === 0 && (
                <div style={{ padding: 6, fontSize: 12, color: "#6b7280" }}>
                  No matching items.
                </div>
              )}
              {matchingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "6px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                  onClick={() => {
                    setScanValue(item.sku || String(item.id));
                    setItemSearch("");
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    SKU: {item.sku || item.id} · In stock: {item.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {message && (
          <div
            className="no-print"
            style={{ color: "#b91c1c", fontSize: 13, marginTop: 4 }}
          >
            {message}
          </div>
        )}

        {/* Items table */}
        <div style={styles.invoiceTableWrapper}>
          <table style={styles.invoiceTable}>
            <thead>
              <tr>
                <th style={{ width: "5%" }}>#</th>
                <th style={{ width: "40%" }}>Item</th>
                <th style={{ width: "20%" }}>SKU</th>
                <th style={{ width: "10%", textAlign: "right" }}>Qty</th>
                <th style={{ width: "12%", textAlign: "right" }}>Price</th>
                <th style={{ width: "13%", textAlign: "right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", fontSize: 13 }}>
                    No items in this invoice yet.
                  </td>
                </tr>
              )}
              {lines.map((line, index) => (
                <tr key={line.id}>
                  <td style={{ textAlign: "center" }}>{index + 1}</td>
                  <td>{line.name}</td>
                  <td>{line.sku}</td>
                  <td style={{ textAlign: "right" }}>{line.quantity}</td>
                  <td style={{ textAlign: "right" }}>
                    ${line.price.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    ${(line.price * line.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tax / Discount */}
        <div style={styles.taxDiscountRow}>
          <label>
            Discount (%)
            <input
              className="no-print"
              type="number"
              min={0}
              max={100}
              style={styles.salesInput}
              value={discountRate}
              onChange={(e) => setDiscountRate(Number(e.target.value) || 0)}
            />
            <div className="print-only" style={styles.printTextField}>
              {invoiceTotals.safeDiscount}%
            </div>
          </label>
          <label>
            Tax (%)
            <input
              className="no-print"
              type="number"
              min={0}
              max={100}
              style={styles.salesInput}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
            />
            <div className="print-only" style={styles.printTextField}>
              {invoiceTotals.safeTax}%
            </div>
          </label>
        </div>

        {/* Footer */}
        <div style={styles.invoiceFooter}>
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={styles.buttonSecondary}
              onClick={() => setLines([])}
            >
              Clear Invoice (keep stock)
            </button>
            <button
              type="button"
              style={styles.buttonDanger}
              onClick={handleVoidInvoiceClick}
            >
              Void Invoice (restore stock)
            </button>
          </div>
          <div style={styles.invoiceTotals}>
            {customerName && (
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                <strong>Customer:</strong> {customerName}{" "}
                {customerPhone && <>· {customerPhone}</>}
              </div>
            )}
            <div>
              <span style={styles.invoiceTotalsLabel}>Subtotal:</span>{" "}
              <span style={styles.invoiceTotalsValue}>
                ${invoiceTotals.subtotal.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={styles.invoiceTotalsLabel}>
                Discount ({invoiceTotals.safeDiscount}%):
              </span>{" "}
              <span style={styles.invoiceTotalsValue}>
                -${invoiceTotals.discountAmount.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={styles.invoiceTotalsLabel}>
                Tax ({invoiceTotals.safeTax}%):
              </span>{" "}
              <span style={styles.invoiceTotalsValue}>
                +${invoiceTotals.taxAmount.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={styles.invoiceTotalsLabel}>Total:</span>{" "}
              <span style={styles.invoiceTotalsValue}>
                ${invoiceTotals.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="no-print" style={{ textAlign: "right", marginTop: 8 }}>
          <button
            type="button"
            style={styles.buttonPrimary}
            onClick={printInvoice}
          >
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Admin Users Management View ---
function UsersAdminView({ apiBase }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("saler");

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${apiBase}/api/users`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
      setError("Error loading users from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError("");
    if (!newUsername.trim() || !newPassword) {
      setError("Username and password are required.");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          setError("User already exists.");
        } else {
          setError("Failed to create user.");
        }
        return;
      }
      await loadUsers();
      setNewUsername("");
      setNewPassword("");
      setNewRole("saler");
    } catch (err) {
      console.error(err);
      setError("Error creating user.");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!selectedUserId) {
      setError("Select a user first.");
      return;
    }
    if (!resetPassword) {
      setError("New password is required.");
      return;
    }
    try {
      const res = await fetch(
        `${apiBase}/api/users/${selectedUserId}/password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: resetPassword }),
        }
      );
      if (!res.ok) {
        setError("Failed to reset password.");
        return;
      }
      setResetPassword("");
      alert("Password updated.");
    } catch (err) {
      console.error(err);
      setError("Error resetting password.");
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "100%",
      }}
    >
      <h2 style={{ margin: 0 }}>System Users</h2>
      <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
        Only admins can access this page. Use it to create new system users and
        reset passwords.
      </p>

      {error && (
        <div style={{ fontSize: 13, color: "#b91c1c" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <section>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Create New User</h3>
        <form
          onSubmit={handleCreateUser}
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          <input
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            style={{
              ...styles.salesInput,
              maxWidth: 180,
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              ...styles.salesInput,
              maxWidth: 180,
            }}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            style={{
              ...styles.salesInput,
              maxWidth: 140,
            }}
          >
            <option value="saler">Saler</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" style={styles.buttonPrimary}>
            Create User
          </button>
        </form>
      </section>

      <section style={{ flex: 1, minHeight: 0 }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Existing Users</h3>
        {loading ? (
          <div style={{ fontSize: 13 }}>Loading users...</div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", fontSize: 13 }}>
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={
                      selectedUserId === u.id
                        ? styles.tableRowSelected
                        : undefined
                    }
                  >
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {u.updatedAt
                        ? new Date(u.updatedAt).toLocaleString()
                        : "-"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        style={styles.buttonSecondary}
                        onClick={() =>
                          setSelectedUserId(
                            selectedUserId === u.id ? null : u.id
                          )
                        }
                      >
                        {selectedUserId === u.id ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Reset Password</h3>
        <form
          onSubmit={handleResetPassword}
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          <input
            placeholder="New password"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            style={{
              ...styles.salesInput,
              maxWidth: 200,
            }}
          />
          <button type="submit" style={styles.buttonPrimary}>
            Update Password for Selected User
          </button>
        </form>
      </section>
    </div>
  );
}

// --- Received Stock History (Admin only) ---
function ReceivedStockView({ receipts }) {
  const sorted = useMemo(() => {
    const arr = Array.isArray(receipts) ? receipts : [];
    return [...arr].sort((a, b) => {
      const da = new Date(a.receivedAt || a.createdAt || 0);
      const db = new Date(b.receivedAt || b.createdAt || 0);
      return db - da; // newest first
    });
  }, [receipts]);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
      }}
    >
      <h2 style={{ margin: 0 }}>Received Stock History</h2>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Records of stock received via barcode/sku. Sorted by date and time
        (newest first). Visible to admins only.
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Item</th>
              <th>SKU</th>
              <th style={{ textAlign: "right" }}>Received Qty</th>
              <th style={{ textAlign: "right" }}>Previous Qty</th>
              <th style={{ textAlign: "right" }}>New Qty</th>
              <th>Received By</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", fontSize: 13 }}>
                  No received stock records yet.
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const dt = r.receivedAt || r.createdAt;
              const dateStr = dt ? new Date(dt).toLocaleString() : "-";
              const itemName = r.itemName || r.name || "-";
              return (
                <tr key={r.id}>
                  <td>{dateStr}</td>
                  <td>{itemName}</td>
                  <td>{r.sku || ""}</td>
                  <td style={{ textAlign: "right" }}>{r.quantity ?? ""}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.previousQuantity ?? ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {r.newQuantity ?? ""}
                  </td>
                  <td>{r.receivedBy || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function App() {
  // --- Auth state ---
  const [user, setUser] = useState(null); // { username, role }

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- Inventory state ---
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);

  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [barcodeQuantity, setBarcodeQuantity] = useState(1);

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  const [activeView, setActiveView] = useState("inventory");

  // invoice history
  const [invoices, setInvoices] = useState([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  // received stock history
  const [receipts, setReceipts] = useState([]);

  // load items + invoices (+ receipts) from backend on mount
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [itemsRes, invoicesRes] = await Promise.all([
          fetch(`${API_BASE}/api/items`),
          fetch(`${API_BASE}/api/invoices`),
        ]);
        const [itemsData, invoicesData] = await Promise.all([
          itemsRes.json(),
          invoicesRes.json(),
        ]);
        setItems(itemsData || []);
        setInvoices(invoicesData || []);

        // Load received stock history (if backend supports it)
        try {
          const receiptsRes = await fetch(`${API_BASE}/api/receipts`);
          if (receiptsRes.ok) {
            const receiptsData = await receiptsRes.json();
            setReceipts(receiptsData || []);
          } else {
            setReceipts([]);
          }
        } catch (err) {
          console.error("Failed to load receipts", err);
          setReceipts([]);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load data from backend. Check your Flask server.");
      }
    };
    fetchAll();
  }, []);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) || null,
    [items, selectedId]
  );

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === editingInvoiceId) || null,
    [invoices, editingInvoiceId]
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        (item.sku || "").toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term)
      );
    });
  }, [items, search]);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + (i.quantity || 0), 0),
    [items]
  );

  const lowStockItems = useMemo(
    () =>
      items.filter(
        (i) =>
          typeof i.minStockLevel === "number" &&
          i.minStockLevel > 0 &&
          i.quantity < i.minStockLevel
      ),
    [items]
  );

  const totalValue = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + (i.quantity || 0) * (i.price || 0),
        0
      ),
    [items]
  );

  const uniqueCategoriesCount = useMemo(
    () => new Set(items.map((i) => i.category)).size,
    [items]
  );

  // --- Inventory handlers wired to backend ---
  async function handleAddItem(data) {
    try {
      const res = await fetch(`${API_BASE}/api/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create item");
      const newItem = await res.json();
      setItems((prev) => [...prev, newItem]);
      setSelectedId(newItem.id);
      setIsAddOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error creating item");
    }
  }

  async function handleEditItem(data) {
    if (!selectedItem) return;
    try {
      const res = await fetch(`${API_BASE}/api/items/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setIsEditOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error updating item");
    }
  }

  async function handleAdjustStock(delta) {
    if (!selectedItem) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/items/${selectedItem.id}/adjust_stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delta, changedBy: user?.username }),
        }
      );
      if (!res.ok) throw new Error("Failed to adjust stock");
      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setIsAdjustOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error adjusting stock");
    }
  }

  // Receive stock: call backend /api/receipts so it both adjusts stock AND records history
  async function handleReceiveStock(itemId, quantity) {
    try {
      const res = await fetch(`${API_BASE}/api/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          quantity,
          receivedBy: user?.username,
        }),
      });
      if (!res.ok) throw new Error("Failed to receive stock");
      const data = await res.json();
      const updated = data.updatedItem || data.item || null;
      const receipt = data.receipt || null;

      if (updated) {
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      if (receipt) {
        setReceipts((prev) => [receipt, ...prev]);
      }
    } catch (err) {
      console.error(err);
      alert("Error increasing stock / recording receipt");
    }
  }

  async function handleDeleteItem() {
    if (!selectedItem) return;
    if (!window.confirm("Delete this item?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/items/${selectedItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete item");
      setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
      setSelectedId(null);
      setIsViewOpen(false);
      setIsEditOpen(false);
      setIsAdjustOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error deleting item");
    }
  }

  // stock change from POS (sell)
  async function handleSell(itemId, quantity) {
    try {
      const res = await fetch(
        `${API_BASE}/api/items/${itemId}/adjust_stock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delta: -quantity,
            changedBy: user?.username,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to decrease stock");
      const updated = await res.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      console.error(err);
      alert("Error updating stock during sale");
    }
  }

  async function handleVoidInvoice(lines) {
    try {
      const updatedMap = {};
      await Promise.all(
        (lines || []).map(async (line) => {
          const res = await fetch(
            `${API_BASE}/api/items/${line.id}/adjust_stock`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                delta: line.quantity,
                changedBy: user?.username,
              }),
            }
          );
          if (res.ok) {
            const updated = await res.json();
            updatedMap[updated.id] = updated;
          }
        })
      );
      if (Object.keys(updatedMap).length > 0) {
        setItems((prev) => prev.map((item) => updatedMap[item.id] || item));
      }
    } catch (err) {
      console.error(err);
      alert("Error restoring stock when voiding invoice");
    }
  }

  // Save invoice to backend
  async function handleSaveInvoice(invoiceData) {
    try {
      const payload = {
        number: invoiceData.number,
        printedAt: invoiceData.printedAt,
        customerName: invoiceData.customerName,
        customerPhone: invoiceData.customerPhone,
        taxRate: invoiceData.taxRate,
        discountRate: invoiceData.discountRate,
        applyStockChange: false, // stock already changed when scanning
        lines: (invoiceData.lines || []).map((l) => ({
          itemId: l.id,
          name: l.name,
          sku: l.sku,
          price: l.price,
          quantity: l.quantity,
        })),
        createdBy: user?.username,
      };
      const res = await fetch(`${API_BASE}/api/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save invoice");
      const saved = await res.json();
      setInvoices((prev) => [saved, ...prev]);
    } catch (err) {
      console.error(err);
      alert("Error saving invoice");
    }
  }

  // Update existing invoice (no stock changes here)
  async function handleUpdateInvoice(draft) {
    try {
      const payload = {
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        taxRate: draft.taxRate,
        discountRate: draft.discountRate,
        lines: (draft.lines || []).map((l) => ({
          itemId: l.itemId || l.id || null,
          name: l.name,
          sku: l.sku,
          price: l.price,
          quantity: l.quantity,
        })),
      };
      const res = await fetch(`${API_BASE}/api/invoices/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update invoice");
      const saved = await res.json();
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === saved.id ? saved : inv))
      );
      setEditingInvoiceId(null);
    } catch (err) {
      console.error(err);
      alert("Error updating invoice");
    }
  }

  // --- Login handlers (username / password against backend) ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setLoginError("Invalid username or password.");
        } else {
          setLoginError("Server error during login.");
        }
        return;
      }
      const data = await res.json();
      setUser({ username: data.username, role: data.role || "saler" });
      setLoginPassword("");
    } catch (err) {
      console.error(err);
      setLoginError("Could not connect to backend (CORS or server down).");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveView("inventory");
    setLoginUsername("");
    setLoginPassword("");
    setLoginError("");
  };

  // If not logged in, show login only
  if (!user) {
    return (
      <>
        <style>
          {`
          body {
            margin: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            background: #111827;
          }
        `}
        </style>
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#111827",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              padding: 24,
              width: "min(360px, 100% - 32px)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Login</h2>
            <p style={{ fontSize: 13, color: "#4b5563", marginTop: 0 }}>
              Sign in with your system username and password. Admin users get
              access to inventory management, user management, received stock
              history and invoice editing.
            </p>
            <form
              onSubmit={handleLoginSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <label style={{ fontSize: 13 }}>
                Username
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                  placeholder="Enter your username"
                  required
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                  placeholder="Enter your password"
                  required
                />
              </label>
              {loginError && (
                <div style={{ fontSize: 13, color: "#b91c1c" }}>
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                style={{
                  marginTop: 4,
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  const isAdmin = user.role === "admin";
  const isSaler = user.role === "saler";

  return (
    <>
      {/* Print-specific styles */}
      <style>
        {`
        @media print {
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .invoice-print-wrapper {
            padding: 16px !important;
          }
          .invoice-card {
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
        }
        .print-only {
          display: none;
        }
      `}
      </style>

      <div style={styles.app}>
        {/* Sidebar */}
        <aside className="no-print" style={styles.sidebar}>
          <h1 style={styles.sidebarTitle}>Inventory System</h1>

          <div style={{ fontSize: 11, marginBottom: 8, color: "#9ca3af" }}>
            Logged in as <strong>{user.username}</strong> ({user.role})
          </div>

          <div style={styles.sidebarNavLinks}>
            <button
              type="button"
              style={{
                ...styles.sidebarNavButton,
                ...(activeView === "inventory"
                  ? styles.sidebarNavButtonActive
                  : {}),
              }}
              onClick={() => setActiveView("inventory")}
            >
              Inventory View
            </button>
            <button
              type="button"
              style={{
                ...styles.sidebarNavButton,
                ...(activeView === "sales"
                  ? styles.sidebarNavButtonActive
                  : {}),
              }}
              onClick={() => setActiveView("sales")}
            >
              Sales / POS
            </button>
            <button
              type="button"
              style={{
                ...styles.sidebarNavButton,
                ...(activeView === "invoices"
                  ? styles.sidebarNavButtonActive
                  : {}),
              }}
              onClick={() => setActiveView("invoices")}
            >
              Invoices
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  style={{
                    ...styles.sidebarNavButton,
                    ...(activeView === "receipts"
                      ? styles.sidebarNavButtonActive
                      : {}),
                  }}
                  onClick={() => setActiveView("receipts")}
                >
                  Received Stock (Admin)
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.sidebarNavButton,
                    ...(activeView === "users"
                      ? styles.sidebarNavButtonActive
                      : {}),
                  }}
                  onClick={() => setActiveView("users")}
                >
                  Users (Admin)
                </button>
              </>
            )}
          </div>

          {activeView === "inventory" && isAdmin && (
            <button
              style={{
                ...styles.buttonPrimary,
                width: "100%",
                marginBottom: 8,
                marginTop: 8,
              }}
              onClick={() => setIsAddOpen(true)}
            >
              + Add New Item
            </button>
          )}

          {/* New sidebar button: Receive stock via barcode */}
          <button
            style={{
              ...styles.buttonSecondary,
              width: "100%",
              marginBottom: 8,
              marginTop: 4,
              fontSize: 13,
            }}
            onClick={() => setIsReceiveOpen(true)}
          >
            Receive Stock (Scan)
          </button>

          {activeView !== "sales" && (
            <input
              style={styles.searchInput}
              placeholder="Search by name, SKU, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          {activeView === "inventory" && (
            <div style={styles.navList}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...styles.navItem,
                    ...(item.id === selectedId ? styles.navItemActive : {}),
                  }}
                  onClick={() => {
                    setSelectedId(item.id);
                    setIsViewOpen(true);
                  }}
                >
                  <div style={styles.navItemName}>{item.name}</div>
                  <div style={styles.navItemSub}>
                    {item.category} · {item.sku}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  No items match your search.
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            style={{
              ...styles.buttonSecondary,
              marginTop: 8,
              fontSize: 12,
              padding: "4px 8px",
            }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          {activeView === "inventory" && (
            <div
              className="no-print"
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <section style={styles.statsRow}>
                <StatCard label="Total Quantity" value={totalItems} />
                <StatCard
                  label="Low Stock"
                  value={lowStockItems.length}
                  secondary={
                    lowStockItems.length > 0
                      ? lowStockItems.map((i) => i.name).join(", ")
                      : "All good"
                  }
                />
                <StatCard
                  label="Total Inventory Value"
                  value={`$${totalValue.toFixed(2)}`}
                />
                <StatCard label="Categories" value={uniqueCategoriesCount} />
              </section>

              <section>
                <InventoryCharts
                  items={items}
                  selectedCategory={selectedCategoryFilter}
                  onCategorySelect={setSelectedCategoryFilter}
                />
              </section>

              <section style={styles.tableSection}>
                <div style={styles.tableHeaderRow}>
                  <h2 style={{ margin: 0 }}>Items</h2>
                  {selectedItem && isAdmin && (
                    <div>
                      <button
                        style={styles.buttonSecondary}
                        onClick={() => setIsAdjustOpen(true)}
                      >
                        Adjust Stock
                      </button>
                      <button
                        style={styles.buttonSecondary}
                        onClick={() => setIsEditOpen(true)}
                      >
                        Edit
                      </button>
                      <button
                        style={styles.buttonDanger}
                        onClick={handleDeleteItem}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th>SKU</th>
                        <th>Qty</th>
                        <th>Min</th>
                        <th>Price</th>
                        <th>Location</th>
                        <th>Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const isLow =
                          typeof item.minStockLevel === "number" &&
                          item.minStockLevel > 0 &&
                          item.quantity < item.minStockLevel;
                        return (
                          <tr
                            key={item.id}
                            style={
                              item.id === selectedId
                                ? styles.tableRowSelected
                                : undefined
                            }
                            onClick={() => {
                              setSelectedId(item.id);
                              setIsViewOpen(true);
                            }}
                          >
                            <td>{item.name}</td>
                            <td>{item.category}</td>
                            <td>{item.type}</td>
                            <td>{item.sku}</td>
                            <td style={isLow ? { color: "#b91c1c" } : {}}>
                              {item.quantity}
                            </td>
                            <td>{item.minStockLevel}</td>
                            <td>${Number(item.price || 0).toFixed(2)}</td>
                            <td>{item.location}</td>
                            <td>{item.supplier}</td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center" }}>
                            No items. Add one from the sidebar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeView === "sales" && (
            <section
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
            >
              <SalesView
                items={items}
                onSell={handleSell}
                onVoidInvoice={handleVoidInvoice}
                onSaveInvoice={handleSaveInvoice}
                currentUser={user}
              />
            </section>
          )}

          {activeView === "invoices" && (
            <InvoicesView
              invoices={invoices}
              onEdit={(id) => {
                if (isAdmin) setEditingInvoiceId(id); // only admin can edit
              }}
              canEdit={isAdmin}
            />
          )}

          {activeView === "receipts" && isAdmin && (
            <ReceivedStockView receipts={receipts} />
          )}

          {activeView === "users" && isAdmin && (
            <UsersAdminView apiBase={API_BASE} />
          )}
        </main>

        {/* Modals */}
        {isAddOpen && isAdmin && (
          <Modal title="Add New Item" onClose={() => setIsAddOpen(false)}>
            <ItemForm onSubmit={handleAddItem} submitLabel="Save Item" />
          </Modal>
        )}

        {isEditOpen && selectedItem && isAdmin && (
          <Modal title="Edit Item" onClose={() => setIsEditOpen(false)}>
            <ItemForm
              initial={selectedItem}
              onSubmit={handleEditItem}
              submitLabel="Save Changes"
            />
          </Modal>
        )}

        {isAdjustOpen && selectedItem && isAdmin && (
          <Modal
            title={`Adjust Stock – ${selectedItem.name}`}
            onClose={() => setIsAdjustOpen(false)}
          >
            <AdjustStockForm
              current={selectedItem.quantity}
              onSubmit={handleAdjustStock}
            />
          </Modal>
        )}

        {isViewOpen && selectedItem && (
          <Modal
            title={`Item Details – ${selectedItem.name}`}
            onClose={() => setIsViewOpen(false)}
          >
            <ItemDetails
              item={selectedItem}
              onPrintBarcodes={() => {
                setBarcodeQuantity(1);
                setIsBarcodeOpen(true);
              }}
            />
          </Modal>
        )}

        {isBarcodeOpen && selectedItem && (
          <Modal
            title={`Print Barcodes – ${selectedItem.name}`}
            onClose={() => setIsBarcodeOpen(false)}
          >
            <BarcodePrintForm
              item={selectedItem}
              quantity={barcodeQuantity}
              onQuantityChange={setBarcodeQuantity}
            />
          </Modal>
        )}

        {isReceiveOpen && (
          <Modal
            title="Receive Stock via Barcode"
            onClose={() => setIsReceiveOpen(false)}
          >
            <ReceiveStockForm items={items} onReceive={handleReceiveStock} />
          </Modal>
        )}

        {editingInvoiceId && selectedInvoice && isAdmin && (
          <Modal
            title={`Edit Invoice – ${selectedInvoice.number}`}
            onClose={() => setEditingInvoiceId(null)}
          >
            <InvoiceEditForm
              invoice={selectedInvoice}
              onSubmit={handleUpdateInvoice}
            />
          </Modal>
        )}
      </div>
    </>
  );
}

// --- Styles ---
const styles = {
  app: {
    display: "flex",
    height: "100vh",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    background: "#f3f4f6",
    color: "#111827",
  },
  sidebar: {
    width: 280,
    background: "#111827",
    color: "#e5e7eb",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 4,
  },
  sidebarNavLinks: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 8,
  },
  sidebarNavButton: {
    borderRadius: 6,
    padding: "6px 8px",
    border: "1px solid #374151",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: 13,
    textAlign: "left",
    cursor: "pointer",
  },
  sidebarNavButtonActive: {
    background: "#1f2937",
  },
  searchInput: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #374151",
    background: "#111827",
    color: "#e5e7eb",
    fontSize: 13,
  },
  navList: {
    marginTop: 12,
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  navItem: {
    padding: 8,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  navItemActive: {
    background: "#1f2937",
  },
  navItemName: {
    fontWeight: 500,
  },
  navItemSub: {
    fontSize: 11,
    color: "#9ca3af",
  },
  main: {
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#ffffff",
    borderRadius: 8,
    padding: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  statLabel: { fontSize: 12, color: "#6b7280" },
  statValue: { fontSize: 20, fontWeight: 600 },
  statSecondary: { marginTop: 4, fontSize: 12, color: "#4b5563" },
  tableSection: {
    background: "#ffffff",
    borderRadius: 8,
    padding: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  tableHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  tableWrapper: {
    overflow: "auto",
    flex: 1,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  tableRowSelected: {
    background: "#eff6ff",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    background: "#ffffff",
    borderRadius: 10,
    width: "min(700px, 100% - 32px)",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalBody: {
    padding: 16,
    overflowY: "auto",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
    gap: 12,
  },
  buttonPrimary: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 13,
  },
  buttonSecondary: {
    background: "#e5e7eb",
    color: "#111827",
    border: "none",
    borderRadius: 6,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 13,
  },
  buttonDanger: {
    background: "#b91c1c",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 13,
  },
  chartCard: {
    background: "#ffffff",
    borderRadius: 8,
    padding: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },
  chartTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  barcodePreviewGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    maxHeight: 300,
    overflowY: "auto",
    padding: 4,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#f9fafb",
  },
  barcodeCard: {
    padding: 8,
    background: "#ffffff",
    borderRadius: 6,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  // Sales / Invoice styles
  invoiceWrapper: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: 8,
  },
  salesCard: {
    background: "#ffffff",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
    maxWidth: 800,
    fontSize: 13,
  },
  invoiceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 8,
    marginBottom: 8,
  },
  customerRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  salesFormRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    marginTop: 8,
  },
  taxDiscountRow: {
    display: "flex",
    gap: 8,
    marginTop: 8,
    maxWidth: 400,
  },
  salesInput: {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
  },
  printTextField: {
    fontSize: 13,
    paddingTop: 4,
  },
  invoiceTableWrapper: {
    marginTop: 12,
    flex: 1,
    overflowY: "auto",
  },
  invoiceTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  invoiceFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
    gap: 12,
  },
  invoiceTotals: {
    textAlign: "right",
    fontSize: 13,
  },
  invoiceTotalsLabel: {
    fontWeight: 500,
    marginRight: 4,
  },
  invoiceTotalsValue: {
    fontWeight: 700,
  },
};

export default App;
