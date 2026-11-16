import { useCallback, useEffect, useState } from "react";

const PROVIDERS = [
  { adapter: "pathao", name: "Pathao" },
  { adapter: "steadfast", name: "Steadfast" },
  { adapter: "redx", name: "REDX" },
  { adapter: "ecourier", name: "eCourier" },
  { adapter: "paperfly", name: "Paperfly" },
];

const CREDENTIAL_FIELDS = {
  pathao: [],
  steadfast: [
    ["apiKey", "API Key"],
    ["secretKey", "Secret Key"],
  ],
  redx: [
    ["accessToken", "Access Token"],
  ],
  ecourier: [
    ["apiKey", "API Key"],
    ["apiSecret", "API Secret"],
    ["userId", "User ID"],
  ],
  paperfly: [
    ["apiKey", "API Key"],
    ["username", "Username"],
    ["password", "Password"],
  ],
};

const emptyForm = () => ({
  name: "",
  adapter: "pathao",
  environment: "sandbox",
  baseUrl: "",
  enabled: false,
  settings: {
    storeId: "",
    defaultWeight: "0.5",
    deliveryType: "48",
    itemType: "2",
    pickupAddress: "",
    pickupPhone: "",
  },
  credentials: {},
  zonesText: "[]",
});

const styles = {
  panel: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 18,
    marginTop: 22,
    background: "var(--pb-card-bg, #fff)",
    color: "var(--pb-text, #111827)",
  },
  input: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "var(--pb-input-bg, #fff)",
    color: "inherit",
    fontSize: 14,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  },
  field: { minWidth: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: 14,
  },
  button: {
    padding: "9px 14px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontWeight: 600,
  },
  primary: {
    padding: "10px 15px",
    borderRadius: 8,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
};

function Field({ label, value, onChange, type = "text", placeholder = "", disabled = false }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        style={styles.input}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <select
        style={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CourierProviderSettings({ request }) {
  const [providers, setProviders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request("/courier-providers");
      setProviders(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || "Could not load courier providers.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const updateForm = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const updateSetting = (key, value) => {
    setForm((previous) => ({
      ...previous,
      settings: { ...previous.settings, [key]: value },
    }));
  };

  const updateCredential = (key, value) => {
    setForm((previous) => ({
      ...previous,
      credentials: { ...previous.credentials, [key]: value },
    }));
  };

  const startCreate = () => {
    setEditingId("");
    setForm(emptyForm());
    setMessage("");
    setError("");
  };

  const startEdit = (provider) => {
    setEditingId(provider._id);
    setForm({
      name: provider.name || "",
      adapter: provider.adapter,
      environment: provider.environment || "sandbox",
      baseUrl: provider.baseUrl || "",
      enabled: Boolean(provider.enabled),
      settings: {
        storeId: provider.settings?.storeId || "",
        defaultWeight: String(provider.settings?.defaultWeight ?? 0.5),
        deliveryType: String(provider.settings?.deliveryType ?? 48),
        itemType: String(provider.settings?.itemType ?? 2),
        pickupAddress: provider.settings?.pickupAddress || "",
        pickupPhone: provider.settings?.pickupPhone || "",
      },
      credentials: {},
      zonesText: JSON.stringify(provider.zones || [], null, 2),
    });
    setMessage("");
    setError("");
  };

  const saveProvider = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const zones = JSON.parse(form.zonesText || "[]");
      if (!Array.isArray(zones)) {
        throw new Error("Zones must be a JSON array.");
      }

      const payload = {
        name: form.name.trim(),
        environment: form.environment,
        baseUrl: form.baseUrl.trim(),
        enabled: form.enabled,
        settings: {
          storeId: form.settings.storeId,
          defaultWeight: Number(form.settings.defaultWeight),
          deliveryType: Number(form.settings.deliveryType),
          itemType: Number(form.settings.itemType),
          pickupAddress: form.settings.pickupAddress,
          pickupPhone: form.settings.pickupPhone,
        },
        zones,
      };

      const credentialEntries = Object.entries(form.credentials)
        .filter(([, value]) => String(value).trim() !== "");

      if (credentialEntries.length) {
        payload.credentials = Object.fromEntries(credentialEntries);
      }

      if (!editingId) {
        payload.adapter = form.adapter;
        payload.code = form.name.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        if (form.adapter !== "pathao" && !payload.credentials) {
          throw new Error("Enter the courier API credentials first.");
        }
      }

      if (editingId) {
        await request(`/courier-providers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage("Courier provider updated successfully.");
      } else {
        await request("/courier-providers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Courier provider added successfully.");
      }

      setEditingId("");
      setForm(emptyForm());
      await loadProviders();
    } catch (err) {
      setError(err.message || "Could not save courier provider.");
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = async (provider) => {
    setError("");
    setMessage("");

    try {
      await request(`/courier-providers/${provider._id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      setMessage(
        provider.enabled
          ? `${provider.name} disabled.`
          : `${provider.name} enabled.`
      );
      await loadProviders();
    } catch (err) {
      setError(err.message || "Could not update provider.");
    }
  };

  const testProvider = async (provider) => {
    if (provider.adapter === "paperfly") {
      setError("Paperfly test is unavailable until its merchant API flow is verified.");
      return;
    }

    if (provider.adapter === "ecourier") {
      setError("eCourier test is temporarily disabled because its current POST /packages test may create a shipment. A verified read-only test is required.");
      return;
    }

    setTestingId(provider._id);
    setError("");
    setMessage("");

    try {
      const path = provider.adapter === "pathao"
        ? "/pathao/test"
        : `/courier-providers/${provider._id}/test`;

      const result = await request(path, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setMessage(result.message || "Connection test successful.");
      await loadProviders();
    } catch (err) {
      setError(err.message || "Courier connection test failed.");
      await loadProviders();
    } finally {
      setTestingId("");
    }
  };

  const setDefault = async (provider) => {
    if (!window.confirm(`Set ${provider.name} as the default courier for new bookings?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await request(
        `/courier-providers/${provider._id}/default`,
        { method: "PATCH", body: JSON.stringify({}) }
      );
      setMessage(result.message || "Default courier updated.");
      await loadProviders();
    } catch (err) {
      setError(err.message || "Could not change default courier.");
    }
  };

  const credentialFields = CREDENTIAL_FIELDS[form.adapter] || [];

  return (
    <section style={styles.panel}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 19 }}>Courier Provider Settings</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.75 }}>
            Manage courier companies, API configuration and default delivery provider.
          </p>
        </div>

        <button type="button" style={styles.primary} onClick={startCreate}>
          + Add Courier
        </button>
      </div>

      {message && (
        <div role="status" style={{
          marginTop: 14,
          padding: 11,
          borderRadius: 8,
          background: "#dcfce7",
          color: "#166534",
          fontSize: 13,
        }}>{message}</div>
      )}

      {error && (
        <div role="alert" style={{
          marginTop: 14,
          padding: 11,
          borderRadius: 8,
          background: "#fee2e2",
          color: "#991b1b",
          fontSize: 13,
        }}>{error}</div>
      )}

      <div style={{ marginTop: 18 }}>
        <h4 style={{ margin: "0 0 10px" }}>Configured Providers</h4>

        {loading ? (
          <p>Loading courier providers...</p>
        ) : providers.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No courier providers configured yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {providers.map((provider) => (
              <div key={provider._id} style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 13,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}>
                <div style={{ minWidth: 180, flex: 1 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}>
                    <strong>{provider.name}</strong>
                    {provider.isDefault && (
                      <span style={{
                        fontSize: 11,
                        padding: "3px 7px",
                        borderRadius: 20,
                        background: "#dbeafe",
                        color: "#1d4ed8",
                      }}>DEFAULT</span>
                    )}
                    <span style={{
                      fontSize: 11,
                      padding: "3px 7px",
                      borderRadius: 20,
                      background: provider.enabled ? "#dcfce7" : "#f3f4f6",
                      color: provider.enabled ? "#166534" : "#6b7280",
                    }}>{provider.enabled ? "Enabled" : "Disabled"}</span>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 5 }}>
                    {provider.adapter.toUpperCase()} · {provider.environment}
                    {" · "}
                    {provider.hasCredentials || provider.adapter === "pathao"
                      ? "Credentials configured"
                      : "Credentials missing"}
                  </div>

                  <div style={{ fontSize: 12, marginTop: 5 }}>
                    Connection: {
                      provider.lastConnectionTestStatus === "success"
                        ? "Successful"
                        : provider.lastConnectionTestStatus === "failed"
                          ? "Failed"
                          : "Not tested"
                    }
                    {provider.lastConnectionTestMessage
                      ? ` — ${provider.lastConnectionTestMessage}`
                      : ""}
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                }}>
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => startEdit(provider)}
                  >Edit</button>

                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => toggleProvider(provider)}
                    disabled={provider.isDefault && provider.enabled}
                  >{provider.enabled ? "Disable" : "Enable"}</button>

                  <button
                    type="button"
                    style={styles.button}
                    disabled={
                      testingId === provider._id ||
                      provider.adapter === "paperfly" ||
                      provider.adapter === "ecourier"
                    }
                    onClick={() => testProvider(provider)}
                  >
                    {testingId === provider._id ? "Testing..." : "Test API"}
                  </button>

                  {!provider.isDefault && (
                    <button
                      type="button"
                      style={styles.primary}
                      disabled={!provider.enabled}
                      onClick={() => setDefault(provider)}
                    >Set Default</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={saveProvider} style={{
        marginTop: 22,
        paddingTop: 18,
        borderTop: "1px solid #e5e7eb",
      }}>
        <h4 style={{ margin: "0 0 14px" }}>
          {editingId ? "Edit Courier Provider" : "Add New Courier Provider"}
        </h4>

        <div style={styles.grid}>
          <Field
            label="Company Name"
            value={form.name}
            onChange={(value) => updateForm("name", value)}
            placeholder="e.g. Steadfast"
          />

          {!editingId && (
            <SelectField
              label="Courier Adapter"
              value={form.adapter}
              onChange={(value) => {
                updateForm("adapter", value);
                updateForm("credentials", {});
              }}
              options={PROVIDERS.map((item) => ({
                value: item.adapter,
                label: item.name,
              }))}
            />
          )}

          <SelectField
            label="Environment"
            value={form.environment}
            onChange={(value) => updateForm("environment", value)}
            options={[
              { value: "sandbox", label: "Sandbox" },
              { value: "live", label: "Live" },
            ]}
          />

          <Field
            label="API Base URL (optional)"
            value={form.baseUrl}
            onChange={(value) => updateForm("baseUrl", value)}
            placeholder="https://..."
          />
        </div>

        <h4 style={{ margin: "20px 0 12px" }}>API Credentials</h4>

        {form.adapter === "pathao" ? (
          <p style={{ fontSize: 13, opacity: 0.75 }}>
            Pathao credentials are read from backend environment variables.
            Do not enter or expose them here.
          </p>
        ) : (
          <>
            {editingId && (
              <p style={{ fontSize: 12, opacity: 0.75 }}>
                Saved credentials are hidden. Leave fields blank to keep the
                existing credentials. Enter new values only when rotating keys.
              </p>
            )}
            <div style={styles.grid}>
              {credentialFields.map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  type="password"
                  value={form.credentials[key] || ""}
                  onChange={(value) => updateCredential(key, value)}
                  placeholder={editingId ? "Leave blank to keep saved value" : label}
                />
              ))}
            </div>
            {form.adapter === "paperfly" && (
              <p style={{ fontSize: 12, color: "#b45309" }}>
                Paperfly credentials are stored securely, but API testing and
                booking are not enabled until the official merchant API flow is verified.
              </p>
            )}
          </>
        )}

        <h4 style={{ margin: "20px 0 12px" }}>Pickup & Parcel Settings</h4>

        <div style={styles.grid}>
          <Field
            label="Store ID"
            value={form.settings.storeId}
            onChange={(value) => updateSetting("storeId", value)}
          />
          <Field
            label="Default Weight (kg)"
            value={form.settings.defaultWeight}
            onChange={(value) => updateSetting("defaultWeight", value)}
            type="number"
          />
          <Field
            label="Delivery Type"
            value={form.settings.deliveryType}
            onChange={(value) => updateSetting("deliveryType", value)}
            type="number"
          />
          <Field
            label="Item Type"
            value={form.settings.itemType}
            onChange={(value) => updateSetting("itemType", value)}
            type="number"
          />
          <Field
            label="Pickup Phone"
            value={form.settings.pickupPhone}
            onChange={(value) => updateSetting("pickupPhone", value)}
          />
          <Field
            label="Pickup Address"
            value={form.settings.pickupAddress}
            onChange={(value) => updateSetting("pickupAddress", value)}
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={styles.label}>Delivery Zones (JSON array)</label>
          <textarea
            value={form.zonesText}
            onChange={(event) => updateForm("zonesText", event.target.value)}
            rows={7}
            spellCheck={false}
            style={{
              ...styles.input,
              resize: "vertical",
              fontFamily: "monospace",
            }}
          />
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            Each entry needs cityName. Optional fields: country, cityId,
            zoneName, zoneId, areaName, areaId, enabled.
          </p>
        </div>

        <label style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
          fontSize: 13,
        }}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => updateForm("enabled", event.target.checked)}
          />
          Enable this courier provider
        </label>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 9,
          marginTop: 18,
        }}>
          <button type="submit" style={styles.primary} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Add Provider"}
          </button>

          <button
            type="button"
            style={styles.button}
            onClick={startCreate}
          >Clear Form</button>

          <button
            type="button"
            style={styles.button}
            onClick={loadProviders}
          >Refresh Providers</button>
        </div>
      </form>
    </section>
  );
}
