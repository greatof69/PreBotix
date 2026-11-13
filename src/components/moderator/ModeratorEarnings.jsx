import React, { useCallback, useEffect, useState } from "react";

const panel = {
  border: "1px solid var(--admin-border, #e5e7eb)",
  borderRadius: 14,
  padding: 15,
  background: "var(--admin-card-bg, var(--card-bg, #fff))",
  minWidth: 0,
};
const field = {
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid var(--admin-border, #d1d5db)",
  background: "var(--input-bg, transparent)",
  color: "inherit",
  font: "inherit",
};
const muted = { color: "var(--muted-text, #6b7280)", fontSize: 13 };
const money = (v) => `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const getId = (v) => String(v?._id || v?.id || v || "");

export default function ModeratorEarnings({ request, lang = "en" }) {
  const bn = String(lang).toLowerCase().startsWith("bn");
  const t = (en, bangla) => bn ? bangla : en;
  const [period, setPeriod] = useState(monthNow);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p) => {
    setLoading(true);
    setError("");
    try {
      const result = await request(`/earnings?period=${encodeURIComponent(p)}`);
      setData(result);
    } catch (err) {
      setError(err.message || "Could not load your earnings.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const summary = data?.summary || {};
  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <section style={{ display: "grid", gap: 15, minWidth: 0 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t("My Earnings", "আমার আয়")}</h2>
          <p style={muted}>{t("Your monthly earnings and payment history.", "আপনার মাসিক আয় ও পেমেন্টের ইতিহাস।")}</p>
        </div>
        <button
          type="button"
          onClick={() => load(period)}
          disabled={loading}
          style={{
            ...field,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            fontWeight: 600,
          }}
        >
          {loading ? t("Refreshing...", "রিফ্রেশ হচ্ছে...") : t("↻ Refresh", "↻ রিফ্রেশ")}
        </button>
      </header>

      <label style={{ ...panel, display: "inline-grid", gap: 6, maxWidth: 260 }}>
        <span style={muted}>{t("Select month", "মাস নির্বাচন")}</span>
        <input style={field} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </label>

      {error && <div role="alert" style={{ ...panel, color: "#dc2626" }}>{error}</div>}
      {loading && <p style={muted}>{t("Loading earnings...", "আয়ের তথ্য লোড হচ্ছে...")}</p>}

      {!loading && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
            {[
              ["Total Earned", summary.totalEarned],
              ["Total Paid", summary.totalPaid],
              ["Remaining Due", summary.totalDue],
              ["Total Debit", summary.totalDebit],
              ["Balance", summary.balance],
            ].map(([label, value]) => (
              <div key={label} style={panel}>
                <div style={muted}>{t(label, ({
                  "Total Earned": "মোট আয়",
                  "Total Paid": "মোট পরিশোধ",
                  "Remaining Due": "বকেয়া",
                  "Total Debit": "মোট ডেবিট",
                  Balance: "ব্যালেন্স",
                })[label])}</div>
                <div style={{ fontSize: 21, fontWeight: 800, marginTop: 7 }}>{money(value)}</div>
              </div>
            ))}
          </div>

          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>{t("Earnings Ledger", "আয়ের লেজার")}</h3>
            {entries.length === 0 ? (
              <p style={muted}>{t("No earnings entries for this month.", "এই মাসে কোনো আয়ের এন্ট্রি নেই।")}</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {entries.map((entry) => {
                  const amount = Number(entry.amount || 0);
                  const paid = Number(entry.paidAmount || 0) || (entry.status === "paid" ? amount : 0);
                  const due = Math.max(0, amount - paid);
                  const transactions = Array.isArray(entry.paymentTransactions) && entry.paymentTransactions.length
                    ? entry.paymentTransactions
                    : entry.payment ? [entry.payment] : [];
                  return (
                    <article key={getId(entry)} style={{ border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: 11, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <strong>{String(entry.entryType || "entry").replaceAll("_", " ")}</strong>
                          <div style={muted}>{entry.description || entry.sourceOrderNumber || entry.period || ""}</div>
                        </div>
                        <strong>{money(amount)}</strong>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 9, fontSize: 13 }}>
                        <span>Paid: <b>{money(paid)}</b></span>
                        <span>Due: <b>{money(due)}</b></span>
                        <span>Status: <b>{entry.status || "pending"}</b></span>
                      </div>
                      {transactions.length > 0 && (
                        <div style={{ marginTop: 11 }}>
                          <strong style={{ fontSize: 13 }}>{t("Payment history", "পেমেন্ট ইতিহাস")}</strong>
                          <div style={{ display: "grid", gap: 6, marginTop: 7 }}>
                            {transactions.map((tx, index) => (
                              <div key={tx._id || index} style={{ ...muted, padding: 8, borderRadius: 8, background: "var(--admin-subtle-bg, rgba(127,127,127,.08))" }}>
                                <b>{money(tx.amount)}</b> · {tx.method || "—"} · {tx.reference || "—"}
                                {tx.paidAt ? ` · ${new Date(tx.paidAt).toLocaleString()}` : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

