import { useCallback, useEffect, useState } from "react";

const panelStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 18,
  minWidth: 0,
  boxSizing: "border-box",
};
const buttonStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 9,
  padding: "9px 13px",
  cursor: "pointer",
  fontWeight: 650,
  fontSize: 13,
};
const activeButtonStyle = {
  ...buttonStyle,
  color: "#fff",
  background: "#1d4ed8",
  borderColor: "#1d4ed8",
};
const muted = { color: "#64748b", fontSize: 13 };
const money = (value) => `৳${Number(value || 0).toLocaleString("en-BD")}`;
const dateText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

export default function SupplyDashboard({ request, lang = "en", isAdmin = false }) {
  const bn = lang === "bn";
  const [view, setView] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [connection, setConnection] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [sendingOrder, setSendingOrder] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      if (view === "orders") {
        const data = await request("/supply/orders");
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      } else if (view === "success" || view === "cancel") {
        const data = await request(`/supply/history?type=${view}`);
        setHistory(Array.isArray(data?.orders) ? data.orders : []);
      } else if (view === "settings" && isAdmin) {
        const data = await request("/supply/connection");
        setConnection(data || null);
      }
    } catch (err) {
      setError(err?.message || (bn ? "তথ্য লোড করা যায়নি।" : "Could not load Supply data."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [request, view, isAdmin, bn]);

  useEffect(() => {
    load(false);
    if (view === "settings") return undefined;
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load, view]);

  const sendToMoveDrop = async (orderNumber) => {
    
    setSendingOrder(orderNumber);
    setError("");
    try {
      await request(`/supply/orders/${encodeURIComponent(orderNumber)}/send`, {
        method: "POST",
      });
      await load(true);
    } catch (err) {
      setError(err?.message || (bn ? "MoveDrop-এর জন্য অর্ডার Ready করা যায়নি।" : "Could not queue this order for MoveDrop."));
    } finally {
      setSendingOrder("");
    }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError(bn ? "নতুন API Key লিখুন।" : "Enter the new API key first.");
      return;
    }
    setSavingKey(true);
    setError("");
    try {
      await request("/supply/connection", {
        method: "PUT",
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      setApiKey("");
      const data = await request("/supply/connection");
      setConnection(data || null);
    } catch (err) {
      setError(err?.message || (bn ? "API Key সংরক্ষণ করা যায়নি।" : "Could not save the API key."));
    } finally {
      setSavingKey(false);
    }
  };

  const tabs = [
    { id: "orders", icon: "📦", en: "Supply Orders", bn: "সাপ্লাই অর্ডার" },
    { id: "success", icon: "✅", en: "Success History", bn: "সফল অর্ডার" },
    { id: "cancel", icon: "🚫", en: "Cancel History", bn: "বাতিল অর্ডার" },
    ...(isAdmin ? [{ id: "settings", icon: "🔐", en: "Connection Settings", bn: "কানেকশন সেটিংস" }] : []),
  ];
  const rows = view === "orders" ? orders : history;

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>📦 {bn ? "সাপ্লাই ম্যানেজমেন্ট" : "Supply Management"}</h2>
          <p style={{ ...muted, margin: "5px 0 0" }}>
            {bn ? "Order Management-এ Confirm করার পর Send to MoveDrop চাপুন। এরপর MoveDrop API থেকে অর্ডার Fetch করবে।" : "Confirm the order, then select Send to MoveDrop. MoveDrop will fetch queued orders through its API."}
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={() => load(false)} disabled={loading}>
          {loading ? (bn ? "লোড হচ্ছে…" : "Loading…") : (bn ? "↻ রিফ্রেশ" : "↻ Refresh")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map((item) => (
          <button key={item.id} type="button" style={view === item.id ? activeButtonStyle : buttonStyle} onClick={() => setView(item.id)}>
            <span aria-hidden="true">{item.icon}</span> {bn ? item.bn : item.en}
          </button>
        ))}
      </div>

      {error && <div role="alert" style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: 11, borderRadius: 9, marginBottom: 12 }}>{error}</div>}

      {view === "settings" && isAdmin ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>{bn ? "MoveDrop API সংযোগ" : "MoveDrop API Connection"}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <strong>{bn ? "API Key Status:" : "API Key Status:"}</strong>
            <span style={{ color: connection?.configured ? "#047857" : "#b91c1c", fontWeight: 700 }}>
              {connection?.configured ? (bn ? "● কনফিগার করা আছে" : "● Configured") : (bn ? "● কনফিগার করা নেই" : "● Not configured")}
            </span>
          </div>
          <p style={{ ...muted, margin: 0 }}>{connection?.message || (bn ? "সংযোগের তথ্য লোড করুন।" : "Load connection status to check the server configuration.")}</p>
          <div><strong>{bn ? "Authentication Header:" : "Authentication Header:"}</strong> <code>X-API-KEY</code></div>
          {connection?.baseUrl ? <div style={{ overflowWrap: "anywhere" }}><strong>{bn ? "API Base URL:" : "API Base URL:"}</strong> <code>{connection.baseUrl}</code></div> : null}
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="movedrop-admin-api-key" style={{ fontWeight: 650, fontSize: 13 }}>{bn ? "নতুন MoveDrop API Key" : "New MoveDrop API Key"}</label>
            <input
              id="movedrop-admin-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={bn ? "নতুন API Key লিখুন" : "Enter a new API key"}
              style={{ width: "100%", maxWidth: 520, boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", fontSize: 14 }}
            />
            <div>
              <button type="button" style={activeButtonStyle} onClick={saveApiKey} disabled={savingKey || !apiKey.trim()}>
                {savingKey ? (bn ? "সংরক্ষণ হচ্ছে…" : "Saving…") : (bn ? "🔐 API Key সংরক্ষণ" : "🔐 Save API Key")}
              </button>
            </div>
          </div>
          <p style={{ ...muted, margin: 0 }}>{bn ? "API Key encrypted অবস্থায় Database-এ সংরক্ষণ হবে। এটি আর Dashboard-এ দেখানো হবে না। Encryption-এর জন্য Render-এ MOVEDROP_WEBHOOK_ENCRYPTION_KEY সেট থাকতে হবে।" : "The API key is encrypted before being stored and is never shown again. MOVEDROP_WEBHOOK_ENCRYPTION_KEY must be configured in the backend environment."}</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <strong>{bn ? (view === "orders" ? "Ready / Processing Orders" : view === "success" ? "সফল অর্ডার" : "বাতিল অর্ডার") : (view === "orders" ? "Ready / Processing Orders" : view === "success" ? "Success History" : "Cancel History")}</strong>
            <span style={muted}>{rows.length} {bn ? "টি অর্ডার" : "orders"}</span>
          </div>
          {loading && rows.length === 0 ? <p style={muted}>{bn ? "লোড হচ্ছে…" : "Loading…"}</p> : rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 12px", color: "#64748b" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{view === "orders" ? "📦" : view === "success" ? "✅" : "🚫"}</div>
              {bn ? "এখনো কোনো অর্ডার নেই।" : "No orders found in this section."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((order) => {
                const address = order.shippingAddress || {};
                const items = Array.isArray(order.items) ? order.items : [];
                return (
                  <article key={order._id || order.orderNumber} style={{ border: "1px solid #e5e7eb", borderRadius: 11, padding: 13, display: "grid", gap: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>#{order.orderNumber || order._id}</strong>
                      <span style={{ fontSize: 12, fontWeight: 700, color: order.status === "delivered" ? "#047857" : order.status === "cancelled" ? "#b91c1c" : "#1d4ed8", textTransform: "uppercase" }}>{order.status}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13 }}>
                      <div><span style={muted}>{bn ? "গ্রাহক" : "Customer"}</span><div style={{ fontWeight: 600 }}>{address.fullName || "—"}</div></div>
                      <div><span style={muted}>{bn ? "ফোন" : "Phone"}</span><div style={{ fontWeight: 600 }}>{address.phone || "—"}</div></div>
                      <div><span style={muted}>{bn ? "মোট" : "Total"}</span><div style={{ fontWeight: 700 }}>{money(order.total)}</div></div>
                      <div><span style={muted}>{bn ? "Confirm Time" : "Confirmed"}</span><div>{dateText(order.confirmedAt)}</div></div>
                    </div>
                    <div style={{ fontSize: 13, color: "#334155" }}>
                      {items.map((item, index) => <div key={item._id || `${item.productId}-${index}`}>{item.title} × {item.quantity}{item.selectedPriceOption?.optionText ? ` (${item.selectedPriceOption.optionText})` : ""}</div>)}
                    </div>
                    <div style={{ ...muted, overflowWrap: "anywhere" }}>{[address.addressLine, address.city].filter(Boolean).join(", ")}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                      <span style={{ fontSize: 12, color: order.moveDropSentAt ? "#047857" : "#64748b", fontWeight: 650 }}>
                        {order.moveDropSentAt
                          ? (bn ? `MoveDrop-এ পাঠানো হয়েছে: ${dateText(order.moveDropSentAt)}` : `Queued for MoveDrop: ${dateText(order.moveDropSentAt)}`)
                          : (bn ? "এখনো MoveDrop-এ পাঠানো হয়নি" : "Not yet sent to MoveDrop")}
                      </span>
                      {view === "orders" && (
                        <button type="button" style={order.moveDropSentAt ? { ...buttonStyle, color: "#047857", borderColor: "#86efac", cursor: "default" } : activeButtonStyle}
                          onClick={() => sendToMoveDrop(order.orderNumber)}
                          disabled={Boolean(order.moveDropSentAt) || Boolean(sendingOrder)}>
                          {sendingOrder === order.orderNumber
                            ? (bn ? "পাঠানো হচ্ছে…" : "Sending…")
                            : order.moveDropSentAt
                              ? (bn ? "✓ MoveDrop-এ পাঠানো হয়েছে" : "✓ Sent to MoveDrop")
                              : (bn ? "MoveDrop-এ পাঠান" : "Send to MoveDrop")}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
