
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const formatBDT = (value) => new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(Number(value) || 0);

const emptyProduct = {
  id: "",
  title: "",
  category: "",
  bn: "",
  image: "",
  price: "",
  oldPrice: "",
  costPrice: "0",
  stock: "0",
  tag: "",
  description: "",
  descriptionBn: "",
  discountEndsAt: "",
  active: true,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #dbe3ef",
  borderRadius: 9,
  fontSize: 14,
  background: "#fff",
};

const buttonStyle = {
  padding: "10px 15px",
  border: 0,
  borderRadius: 9,
  cursor: "pointer",
  fontWeight: 600,
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("prebotix-access-token-v1");
    sessionStorage.removeItem("prebotix-auth-user-v1");
    navigate("/login", { replace: true });
  };

  const [tab, setTab] = useState("orders");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);

  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem("prebotix-access-token-v1");

    const response = await fetch(`${API}/api/admin${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request(`/${tab}`);
      const key = tab === "users" ? "users" : tab;
      setRows(Array.isArray(data[key]) ? data[key] : []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [request, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRole = async (user, role) => {
    setError("");
    setMessage("");

    try {
      await request(`/users/${user._id || user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      setMessage("User role updated.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const updateStatus = async (order, status) => {
    setError("");
    setMessage("");

    try {
      await request(`/orders/${order._id || order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setMessage("Order status updated.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const startAddProduct = () => {
    setEditingProduct(null);
    setForm({ ...emptyProduct });
    setError("");
    setMessage("");
  };

  const startEditProduct = (product) => {
    setEditingProduct(product.id);

    setForm({
      id: String(product.id ?? ""),
      title: product.title ?? "",
      category: product.category ?? "",
      bn: product.bn ?? "",
      image: product.image ?? "",
      price: String(product.price ?? ""),
      oldPrice: product.oldPrice == null ? "" : String(product.oldPrice),
      costPrice: String(product.costPrice ?? 0),
      stock: String(product.stock ?? 0),
      tag: product.tag ?? "",
      description: product.description ?? "",
      descriptionBn: product.descriptionBn ?? "",
      discountEndsAt: product.discountEndsAt
        ? new Date(product.discountEndsAt).toISOString().slice(0, 16)
        : "",
      active: product.active !== false,
    });

    setError("");
    setMessage("");
  };

  const changeField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const id = Number(form.id);
    const price = Number(form.price);
    const costPrice = Number(form.costPrice);
    const stock = Number(form.stock);
    const oldPrice = form.oldPrice === "" ? undefined : Number(form.oldPrice);

    if (!Number.isSafeInteger(id) || id < 1) {
      setError("Product ID must be a positive whole number.");
      return;
    }

    if (!form.title.trim() || !form.category.trim() || !form.image.trim()) {
      setError("Product name, category and image URL are required.");
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(costPrice) ||
      costPrice < 0 ||
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      (oldPrice !== undefined &&
        (!Number.isFinite(oldPrice) || oldPrice < 0))
    ) {
      setError("Check selling price, cost price, regular price and stock.");
      return;
    }

    if (form.discountEndsAt && !Number.isFinite(Date.parse(form.discountEndsAt))) {
      setError("Enter a valid offer end date and time.");
      return;
    }

    const payload = {
      id,
      title: form.title.trim(),
      category: form.category.trim(),
      bn: form.bn,
      image: form.image.trim(),
      price,
      costPrice,
      stock,
      tag: form.tag,
      description: form.description,
      descriptionBn: form.descriptionBn,
      active: form.active,
      ...(oldPrice !== undefined ? { oldPrice } : {}),
      discountEndsAt: form.discountEndsAt
        ? new Date(form.discountEndsAt).toISOString()
        : null,
    };

    setSaving(true);

    try {
      if (editingProduct !== null) {
        const updates = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "id"));
        await request(`/products/${editingProduct}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        setMessage("Product updated successfully.");
      } else {
        await request("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Product created successfully.");
      }

      setForm({ ...emptyProduct });
      setEditingProduct(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    ["orders", "Orders"],
    ["users", "Users & Roles"],
    ["products", "Products"],
  ];

  const field = (name, label, options = {}) => (
    <label key={name} style={{ display: "grid", gap: 7, color: "#344256", fontSize: 13, fontWeight: 600 }}>
      {label}
      {options.multiline ? (
        <textarea
          name={name}
          value={form[name]}
          onChange={changeField}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          name={name}
          type={options.type || "text"}
          value={form[name]}
          onChange={changeField}
          min={options.min}
          step={options.step}
          required={options.required}
          style={inputStyle}
        />
      )}
    </label>
  );

  return (
    <div className="pb-dashboard">
      <aside className="pb-sidebar">
        <div className="pb-brand"><span className="pb-brand-mark">P</span><span><b>PreBotix</b><small>Smart Shopping. Better Life.</small></span></div>
        <div className="pb-nav-label">WORKSPACE</div>
        <nav className="pb-nav">
          {[
            ["orders", "▦", "Dashboard"],
            ["products", "▣", "Products"],
            ["orders", "▤", "Orders"],
            ["users", "♙", "Customers & Roles"],
          ].map(([value, icon, label], index) => (
            <button key={`${label}-${index}`} className={`pb-nav-item ${tab === value && (label === "Dashboard" || (label === "Products" && tab === "products") || (label === "Customers & Roles" && tab === "users")) ? "active" : ""}`} onClick={() => setTab(value)}>
              <span className="pb-nav-icon">{icon}</span><span>{label}</span>
              {label === "Orders" && <span className="pb-nav-count">{rows.length || 0}</span>}
            </button>
          ))}
        </nav>
        <div className="pb-sidebar-bottom">
          <div className="pb-avatar">A</div><div><b>Admin</b><small>Administrator</small></div><span className="pb-online-dot" />
        </div>
      </aside>

      <main className="pb-main">
        <div className="pb-topbar">
          <button className="pb-icon-button" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle dashboard navigation">☰</button>
          <div className="pb-search"><span>⌕</span><input aria-label="Search dashboard" placeholder="Search anything..." onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.value = ""; }} /></div>
          <div className="pb-top-actions"><span className="pb-currency">🇧🇩 <b>BDT ৳</b></span><button className="pb-tool-button" onClick={() => window.open("https://www.google.com/search?q=calculator", "_blank", "noopener,noreferrer")}>▦ Calculator</button><span className="pb-date-chip">24 Oct 2026 · Saturday</span><span className="pb-profile-mini">A</span><button type="button" className="pb-tool-button" onClick={handleLogout}>↪ Logout</button></div>
        </div>

        {menuOpen && <div className="pb-mobile-nav">{tabs.map(([value, label]) => <button key={value} className={tab === value ? "selected" : ""} onClick={() => { setTab(value); setMenuOpen(false); }}>{label}</button>)}</div>}

        <section className="pb-page-heading">
          <div><div className="pb-eyebrow">STORE MANAGEMENT</div><h1>{tab === "orders" ? "Admin Dashboard" : tab === "products" ? "Product Management" : "Customers & Roles"}</h1><p>Welcome back, Admin. Here's what's happening with your store today.</p></div>
          <button className="pb-primary-button" onClick={load}>↻ Refresh data</button>
        </section>

        <section className="pb-metric-grid">
          <article className="pb-metric-card"><span className="pb-metric-icon purple">↗</span><div><small>Total Sales</small><strong>{formatBDT(rows.filter(r => r.status === "delivered").reduce((sum, r) => sum + Number(r.total ?? r.subtotal ?? 0), 0))}</strong><em>Delivered order value shown</em></div><span className="pb-spark purple-line">⌁⌁⌁</span></article>
          <article className="pb-metric-card"><span className="pb-metric-icon green">▤</span><div><small>{tab === "products" ? "Products" : tab === "users" ? "Users" : "Total Orders"}</small><strong>{rows.length}</strong><em>Records loaded from API</em></div><span className="pb-spark green-line">⌁⌁⌁</span></article>
          <article className="pb-metric-card"><span className="pb-metric-icon blue">✓</span><div><small>{tab === "orders" ? "Delivered Orders" : "Active records"}</small><strong>{tab === "orders" ? rows.filter(r => r.status === "delivered").length : rows.filter(r => r.active !== false).length}</strong><em>Current loaded dataset</em></div><span className="pb-spark blue-line">⌁⌁⌁</span></article>
          <article className="pb-metric-card"><span className="pb-metric-icon orange">৳</span><div><small>Pending attention</small><strong>{tab === "orders" ? rows.filter(r => r.status === "pending").length : "—"}</strong><em>Needs review</em></div><span className="pb-spark orange-line">⌁⌁⌁</span></article>
        </section>

        {error && <div className="pb-alert error" role="alert">⚠ {error}</div>}
        {message && <div className="pb-alert success" role="status">✓ {message}</div>}

        {tab === "products" && (
          <section className="pb-panel pb-form-panel">
            <div className="pb-panel-heading"><div><h2>{editingProduct !== null ? `Edit product #${editingProduct}` : "Create a product"}</h2><p>Manage product details, pricing, inventory and visibility.</p></div><button className="pb-secondary-button" onClick={startAddProduct}>＋ New product</button></div>
            <form onSubmit={saveProduct}>
              <div className="pb-form-grid">
                {field("id", "Product ID", { type: "number", min: 1, required: true })}
                {field("title", "Product name", { required: true })}
                {field("category", "Category", { required: true })}
                {field("bn", "Bangla name")}
                {field("image", "Image URL", { required: true })}
                {field("costPrice", "Cost price (admin only)", { type: "number", min: 0, step: "any", required: true })}
                {field("price", "Selling price (৳)", { type: "number", min: 0, step: "any", required: true })}
                {field("oldPrice", "Regular / old price (৳)", { type: "number", min: 0, step: "any" })}
                {field("stock", "Stock quantity", { type: "number", min: 0, step: 1, required: true })}
                {field("tag", "Product tag")}
                {field("discountEndsAt", "Offer end date & time", { type: "datetime-local" })}
                {field("description", "Description", { multiline: true })}
                {field("descriptionBn", "Bangla description", { multiline: true })}
              </div>
              <label className="pb-check-label"><input type="checkbox" name="active" checked={form.active} onChange={changeField} /> Product is active and visible in the store</label>
              <div className="pb-form-actions"><button type="submit" disabled={saving} className="pb-primary-button">{saving ? "Saving…" : editingProduct !== null ? "Save changes" : "Create product"}</button><button type="button" className="pb-secondary-button" onClick={startAddProduct}>Clear form</button></div>
            </form>
          </section>
        )}

        <section className="pb-panel">
          <div className="pb-panel-heading"><div><h2>{tab === "orders" ? "Recent Orders" : tab === "users" ? "Users & Permissions" : "Product Inventory"}</h2><p>{tab === "orders" ? "Review orders and update their status." : tab === "users" ? "Manage customer and moderator roles." : "Edit product pricing, stock and availability."}</p></div><span className="pb-record-count">{rows.length} records</span></div>
          {loading ? <div className="pb-empty-state"><span className="pb-loader" />Loading {tab}…</div> : <div className="pb-table-wrap">
            {tab === "orders" && <table className="pb-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Update status</th></tr></thead><tbody>{rows.map(o => <tr key={o._id || o.id}><td><b>#{o.orderNumber || String(o._id || o.id).slice(-8)}</b></td><td>{o.shippingAddress?.fullName || o.user?.name || "Customer"}</td><td className="pb-money">{formatBDT(o.total ?? o.subtotal ?? 0)}</td><td><span className={`pb-status ${String(o.status || "pending").toLowerCase()}`}>{o.status || "pending"}</span></td><td><select className="pb-select" value={o.status || "pending"} onChange={e => updateStatus(o, e.target.value)}>{["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>)}</tbody></table>}
            {tab === "users" && <table className="pb-table"><thead><tr><th>User</th><th>Email</th><th>Current role</th><th>Permissions</th></tr></thead><tbody>{rows.map(u => <tr key={u._id || u.id}><td><div className="pb-user-cell"><span className="pb-table-avatar">{(u.name || "U").slice(0,1).toUpperCase()}</span><b>{u.name || "—"}</b></div></td><td>{u.email || "—"}</td><td><span className={`pb-status ${u.isAdmin || u.role === "admin" ? "confirmed" : "pending"}`}>{u.isAdmin ? "admin" : u.role || "customer"}</span></td><td>{u.isAdmin ? <span className="pb-muted">Protected administrator</span> : <select className="pb-select" value={u.role || "customer"} onChange={e => updateRole(u, e.target.value)}><option value="customer">Customer</option><option value="moderator">Moderator</option></select>}</td></tr>)}</tbody></table>}
            {tab === "products" && <table className="pb-table"><thead><tr><th>ID</th><th>Product</th><th>Sell price</th><th>Stock</th><th>Visibility</th><th>Action</th></tr></thead><tbody>{rows.map(p => <tr key={p._id || p.id}><td>#{p.id}</td><td><div className="pb-product-cell">{p.image && <img src={p.image} alt="" />}<b>{p.title || "—"}</b></div></td><td className="pb-money">{formatBDT(p.price ?? 0)}</td><td>{p.stock ?? 0}</td><td><span className={`pb-status ${p.active === false ? "cancelled" : "delivered"}`}>{p.active === false ? "Inactive" : "Active"}</span></td><td><button className="pb-small-button" onClick={() => startEditProduct(p)}>Edit</button></td></tr>)}</tbody></table>}
            {!rows.length && <div className="pb-empty-state">No records found for this section.</div>}
          </div>}
        </section>
        <footer className="pb-footer">© 2026 PreBotix · Admin workspace <span><i /> Secure session</span></footer>
      </main>
    </div>
  );
}





