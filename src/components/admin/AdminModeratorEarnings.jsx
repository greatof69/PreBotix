import React, { useCallback, useEffect, useMemo, useState } from "react";

const panel = {
  background: "var(--admin-card-bg, var(--card-bg, #fff))",
  border: "1px solid var(--admin-border, #e5e7eb)",
  borderRadius: 14,
  padding: 16,
  minWidth: 0,
};
const field = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid var(--admin-border, #d1d5db)",
  background: "var(--input-bg, transparent)",
  color: "inherit",
  font: "inherit",
};
const btn = {
  border: 0,
  borderRadius: 9,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};
const primary = { ...btn, background: "#2563eb", color: "#fff" };
const green = { ...btn, background: "#15803d", color: "#fff" };
const muted = { color: "var(--muted-text, #6b7280)", fontSize: 13 };
const money = (v) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const currentPeriod = () => localDate().slice(0, 7);
const getId = (v) => String(v?._id || v?.id || v || "");

function SummaryCards({ summary = {} }) {
  const items = [
    ["Total Earned", summary.totalEarned],
    ["Total Paid", summary.totalPaid],
    ["Total Due", summary.totalDue],
    ["Total Debit", summary.totalDebit],
    ["Balance", summary.balance],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ ...panel, padding: 13 }}>
          <div style={muted}>{label}</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 7 }}>{money(value)}</div>
        </div>
      ))}
    </div>
  );
}

function PaymentEditor({ entry, request, moderatorId, onDone }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [reference, setReference] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const due = Math.max(0, Number(entry.amount || 0) - Number(entry.paidAmount || 0));

  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(amount) > 0) || Number(amount) > due + 0.000001) {
      alert(`Amount must be greater than 0 and not exceed remaining due (${money(due)}).`);
      return;
    }
    setBusy(true);
    try {
      await request(
        `/moderator-earnings/${moderatorId}/entries/${getId(entry)}/pay`,
        {
          method: "PATCH",
          body: JSON.stringify({
            amount: Number(amount),
            method,
            reference,
            accountName,
            accountNumber,
            notes,
          }),
        }
      );
      await onDone();
      setAmount("");
      setReference("");
      setAccountName("");
      setAccountNumber("");
      setNotes("");
      alert("Payment recorded successfully.");
    } catch (err) {
      alert(err.message || "Payment could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  if (due <= 0) return <div style={muted}>Fully paid</div>;

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 12 }}>
      <input style={field} type="number" min="0.01" max={due} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Payment amount (due ${money(due)})`} />
      <select style={field} value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="bkash">bKash</option>
        <option value="nagad">Nagad</option>
        <option value="bank">Bank</option>
        <option value="cash">Cash</option>
      </select>
      <input style={field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction/reference ID" />
      <input style={field} value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" />
      <input style={field} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" />
      <input style={field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment notes" />
      <button style={green} type="submit" disabled={busy}>{busy ? "Saving..." : "Record Payment"}</button>
    </form>
  );
}

export default function AdminModeratorEarnings({ request, lang = "en" }) {
  const bn = String(lang).toLowerCase().startsWith("bn");
  const t = (en, bangla) => bn ? bangla : en;
  const [period, setPeriod] = useState(currentPeriod);
  const [moderators, setModerators] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settingsText, setSettingsText] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(localDate);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const selected = useMemo(
    () => moderators.find((x) => getId(x.moderator) === selectedId),
    [moderators, selectedId]
  );

  const loadDetail = useCallback(async (id = selectedId, p = period) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const data = await request(`/moderator-earnings/${id}?period=${encodeURIComponent(p)}`);
    setDetail(data);
    const s = data.settings || {};
    const editable = {
      fixedSalary: s.fixedSalary || { enabled: false, amount: 0, currency: "BDT", effectiveFrom: "" },
      commission: s.commission || { enabled: false, method: "profit_percentage", rate: 0 },
      performanceBonus: s.performanceBonus || { enabled: false, rules: [] },
      festivalBonuses: Array.isArray(s.festivalBonuses) ? s.festivalBonuses : [],
      payoutPreference: s.payoutPreference || { method: "", accountName: "", accountNumber: "" },
      notes: s.notes || "",
    };
    setSettingsText(JSON.stringify(editable, null, 2));
  }, [request, selectedId, period]);

  const loadList = useCallback(async (p = period) => {
    setLoading(true);
    setError("");
    try {
      const data = await request(`/moderator-earnings?period=${encodeURIComponent(p)}`);
      const rows = Array.isArray(data.moderators) ? data.moderators : [];
      setModerators(rows);
      const nextId = rows.some((x) => getId(x.moderator) === selectedId)
        ? selectedId
        : getId(rows[0]?.moderator);
      setSelectedId(nextId);
      if (nextId) await loadDetail(nextId, p);
      else setDetail(null);
    } catch (err) {
      setError(err.message || "Could not load moderator earnings.");
    } finally {
      setLoading(false);
    }
  }, [request, period, selectedId, loadDetail]);

  useEffect(() => {
    loadList(period);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseModerator = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setError("");
    if (!id) return;
    setLoading(true);
    try {
      await loadDetail(id, period);
    } catch (err) {
      setError(err.message || "Could not load moderator details.");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!selectedId) return;
    let parsed;
    try {
      parsed = JSON.parse(settingsText);
    } catch {
      alert("Settings JSON is invalid. Please correct it before saving.");
      return;
    }
    const required = ["fixedSalary", "commission", "performanceBonus", "festivalBonuses", "payoutPreference"];
    if (!required.every((key) => Object.prototype.hasOwnProperty.call(parsed, key))) {
      alert("All settings sections are required. Keep every nested settings key in the JSON.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      alert("Please provide an effective date in YYYY-MM-DD format.");
      return;
    }
    setSavingSettings(true);
    try {
      await request(`/moderator-earnings/${selectedId}/settings`, {
        method: "PUT",
        body: JSON.stringify({ ...parsed, effectiveFrom }),
      });
      await loadList(period);
      alert("Settings saved. The new settings use the selected effective date.");
    } catch (err) {
      alert(err.message || "Settings could not be saved.");
    } finally {
      setSavingSettings(false);
    }
  };

  const entries = Array.isArray(detail?.entries) ? detail.entries : [];
  const moderator = detail?.moderator || selected?.moderator || {};
  const summary = detail?.summary || selected?.summary || {};

  return (
    <section style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>{t("Moderator Earnings", "মডারেটর আয়")}</h2>
          <p style={muted}>{t("Monthly ledger, salary settings and installment payments.", "মাসিক লেজার, বেতন সেটিংস ও কিস্তিতে পেমেন্ট।")}</p>
        </div>
        <button type="button" style={btn} onClick={() => loadList(period)} disabled={loading}>↻ {t("Refresh", "রিফ্রেশ")}</button>
      </header>

      <div style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={muted}>{t("Earnings month", "আয়ের মাস")}</span>
          <input style={field} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={muted}>{t("Select moderator", "মডারেটর নির্বাচন")}</span>
          <select style={field} value={selectedId} onChange={(e) => chooseModerator(e.target.value)}>
            <option value="">{t("Select moderator", "মডারেটর নির্বাচন করুন")}</option>
            {moderators.map((row) => {
              const m = row.moderator || {};
              return <option key={getId(m)} value={getId(m)}>{m.name || m.email || getId(m)}</option>;
            })}
          </select>
        </label>
      </div>

      {error && <div role="alert" style={{ ...panel, color: "#dc2626" }}>{error}</div>}
      {loading && <div style={muted}>{t("Loading earnings...", "আয়ের তথ্য লোড হচ্ছে...")}</div>}
      {!loading && moderators.length === 0 && !error && (
        <div style={panel}>{t("No moderator earnings data found for this period.", "এই মাসের কোনো মডারেটর আয়ের তথ্য পাওয়া যায়নি।")}</div>
      )}

      {detail && (
        <>
          <div style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ margin: "0 0 5px" }}>{moderator.name || "Moderator"}</h3>
                <div style={muted}>{moderator.email || ""} {moderator.phone ? `· ${moderator.phone}` : ""}</div>
              </div>
              <button type="button" style={primary} onClick={() => setShowSettings((v) => !v)}>
                {showSettings ? t("Close Settings", "সেটিংস বন্ধ") : t("Edit Earnings Settings", "আয়ের সেটিংস সম্পাদনা")}
              </button>
            </div>
          </div>

          <SummaryCards summary={summary} />

          {showSettings && (
            <div style={{ ...panel, display: "grid", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{t("Moderator Earnings Settings", "মডারেটর আয়ের সেটিংস")}</h3>
              <p style={muted}>
                {t("Edit the complete settings object. Keep all five nested sections. Changes are effective-dated; historical settings are preserved.", "সম্পূর্ণ সেটিংস অবজেক্ট সম্পাদনা করুন। পাঁচটি nested section অক্ষত রাখুন। কার্যকর তারিখ অনুযায়ী নতুন সেটিংস প্রযোজ্য হবে; পুরোনো হিসাব সংরক্ষিত থাকবে।")}
              </p>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={muted}>{t("New settings effective from", "নতুন সেটিংস কার্যকর হবে")}</span>
                <input style={field} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </label>
              <textarea
                style={{ ...field, minHeight: 300, fontFamily: "monospace", fontSize: 13 }}
                spellCheck={false}
                value={settingsText}
                onChange={(e) => setSettingsText(e.target.value)}
              />
              <button type="button" style={primary} onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? t("Saving...", "সংরক্ষণ হচ্ছে...") : t("Save Settings", "সেটিংস সংরক্ষণ")}
              </button>
              <p style={muted}>{t("The backend may reject a duplicate effective date or changes that overlap an existing ledger period.", "একই কার্যকর তারিখ পুনরায় ব্যবহার করলে অথবা বিদ্যমান লেজার পিরিয়ডের সঙ্গে সংঘর্ষ হলে Backend পরিবর্তন প্রত্যাখ্যান করতে পারে।")}</p>
            </div>
          )}

          <div style={{ ...panel, minWidth: 0 }}>
            <h3 style={{ marginTop: 0 }}>{t("Earnings Ledger", "আয়ের লেজার")}</h3>
            {entries.length === 0 ? (
              <p style={muted}>{t("No ledger entries for this month.", "এই মাসে কোনো লেজার এন্ট্রি নেই।")}</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {entries.map((entry) => {
                  const amount = Number(entry.amount || 0);
                  const paid = Number(entry.paidAmount || 0) || (entry.status === "paid" ? amount : 0);
                  const due = Math.max(0, amount - paid);
                  const transactions = Array.isArray(entry.paymentTransactions) && entry.paymentTransactions.length
                    ? entry.paymentTransactions
                    : entry.payment ? [entry.payment] : [];
                  return (
                    <article key={getId(entry)} style={{ border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: 12, padding: 13, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <strong>{String(entry.entryType || "entry").replaceAll("_", " ")}</strong>
                          <div style={muted}>{entry.description || entry.sourceOrderNumber || entry.period || ""}</div>
                        </div>
                        <strong>{money(amount)}</strong>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 13 }}>
                        <span>Paid: <b>{money(paid)}</b></span>
                        <span>Due: <b style={{ color: due > 0 ? "#d97706" : "#15803d" }}>{money(due)}</b></span>
                        <span>Status: <b>{entry.status || "pending"}</b></span>
                      </div>
                      {transactions.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <strong style={{ fontSize: 13 }}>{t("Payment history", "পেমেন্ট ইতিহাস")}</strong>
                          <div style={{ display: "grid", gap: 6, marginTop: 7 }}>
                            {transactions.map((tx, index) => (
                              <div key={tx._id || index} style={{ ...muted, padding: 8, borderRadius: 8, background: "var(--admin-subtle-bg, rgba(127,127,127,.08))" }}>
                                <b>{money(tx.amount)}</b> · {tx.method || "—"} · {tx.reference || "No reference"}
                                {tx.paidAt ? ` · ${new Date(tx.paidAt).toLocaleString()}` : ""}
                                {tx.notes ? ` · ${tx.notes}` : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {due > 0 && (
                        <PaymentEditor
                          entry={entry}
                          request={request}
                          moderatorId={selectedId}
                          onDone={() => loadList(period)}
                        />
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
