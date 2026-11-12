import { useEffect, useState } from "react";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  education: "",
  experience: "",
  reason: "",
};

const inputStyle = {
  width: "100%",
  padding: "12px 13px",
  border: "1px solid #d1d5db",
  borderRadius: 9,
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fff",
};

export default function ModeratorApplicationPage({ lang = "en" }) {
  const isBn = lang === "bn";
  const [enabled, setEnabled] = useState(null);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [cv, setCv] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const t = (en, bn) => (isBn ? bn : en);

  useEffect(() => {
    let active = true;

    fetch(`${API}/api/moderator-applications/status`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Could not check application status.");
        }

        if (active) {
          setEnabled(
            data.enabled === true ||
            data.moderatorApplicationsEnabled === true ||
            data.settings?.moderatorApplicationsEnabled === true
          );
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not check application status.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!cv) {
      setError(t("Please attach your CV/Resume.", "আপনার CV/Resume সংযুক্ত করুন।"));
      return;
    }

    if (cv.size > 5 * 1024 * 1024) {
      setError(t("CV must be 5 MB or smaller.", "CV সর্বোচ্চ ৫ MB হতে পারবে।"));
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value.trim());
      });

      payload.append("cv", cv);

      const response = await fetch(`${API}/api/moderator-applications`, {
        method: "POST",
        body: payload,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Application submission failed.");
      }

      setSuccess(
        data.message ||
          t(
            "Your application has been submitted successfully.",
            "আপনার আবেদন সফলভাবে জমা হয়েছে।"
          )
      );

      setForm(initialForm);
      setCv(null);

      const fileInput = document.getElementById("moderator-application-cv");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setError(err.message || "Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    ["name", t("Full Name", "সম্পূর্ণ নাম"), "text", 120],
    ["email", t("Email Address", "ইমেইল ঠিকানা"), "email", 254],
    ["phone", t("Phone Number", "ফোন নম্বর"), "tel", 30],
    ["address", t("Present Address", "বর্তমান ঠিকানা"), "text", 500],
    ["education", t("Education", "শিক্ষাগত যোগ্যতা"), "text", 300],
  ];

  if (checking) {
    return (
      <main style={{ maxWidth: 760, margin: "35px auto", padding: 20 }}>
        {t("Checking application availability...", "আবেদনের সুবিধা যাচাই হচ্ছে...")}
      </main>
    );
  }

  if (enabled !== true) {
    return (
      <main style={{ maxWidth: 760, margin: "35px auto", padding: 20 }}>
        <section style={{ padding: 28, border: "1px solid #e5e7eb", borderRadius: 14, textAlign: "center" }}>
          <h1>{t("Moderator Applications", "মডারেটর আবেদন")}</h1>
          <p style={{ color: "#6b7280" }}>
            {t(
              "Moderator applications are currently closed. Please check again later.",
              "এই মুহূর্তে মডারেটর আবেদন গ্রহণ বন্ধ রয়েছে। পরে আবার দেখুন।"
            )}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: "35px auto", padding: "20px 16px" }}>
      <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.05)" }}>
        <h1 style={{ marginTop: 0, fontSize: 27 }}>
          {t("Apply for Moderator", "মডারেটর পদে আবেদন")}
        </h1>

        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          {t(
            "Fill in the information below. You do not need to log in to apply.",
            "নিচের তথ্যগুলো পূরণ করে আবেদন করুন। আবেদন করতে Login করার প্রয়োজন নেই।"
          )}
        </p>

        {error && (
          <div role="alert" style={{ padding: 12, marginBottom: 14, borderRadius: 9, background: "#fef2f2", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {success && (
          <div role="status" style={{ padding: 12, marginBottom: 14, borderRadius: 9, background: "#ecfdf5", color: "#047857" }}>
            {success}
          </div>
        )}

        <form onSubmit={submitApplication} style={{ display: "grid", gap: 16 }}>
          {fields.map(([name, label, type, maxLength]) => (
            <label key={name} style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 650 }}>
              {label}
              <input
                required
                name={name}
                type={type}
                maxLength={maxLength}
                value={form[name]}
                onChange={updateField}
                style={inputStyle}
              />
            </label>
          ))}

          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 650 }}>
            {t("Skills & Experience", "দক্ষতা ও অভিজ্ঞতা")}
            <textarea
              required
              name="experience"
              maxLength={2000}
              rows={4}
              value={form.experience}
              onChange={updateField}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 650 }}>
            {t("Why do you want to join PreBotix?", "আপনি কেন PreBotix-এ যোগ দিতে চান?")}
            <textarea
              required
              name="reason"
              maxLength={2000}
              rows={4}
              value={form.reason}
              onChange={updateField}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 650 }}>
            {t("Upload CV / Resume (PDF, DOC, DOCX — max 5 MB)", "CV / Resume আপলোড করুন (PDF, DOC, DOCX — সর্বোচ্চ ৫ MB)")}
            <input
              id="moderator-application-cv"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              onChange={(event) => setCv(event.target.files?.[0] || null)}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "13px 18px",
              border: 0,
              borderRadius: 9,
              background: submitting ? "#64748b" : "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting
              ? t("Submitting...", "জমা হচ্ছে...")
              : t("Submit Application", "আবেদন জমা দিন")}
          </button>
        </form>
      </section>
    </main>
  );
}