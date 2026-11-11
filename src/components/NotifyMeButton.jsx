import { useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function NotifyMeButton({
  product,
  lang = "en",
  user = null,
  compact = false,
}) {
  const isBn = lang === "bn";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(String(user?.email || ""));
  const [name, setName] = useState(String(user?.name || ""));
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState(false);

  if (Number(product?.stock || 0) > 0) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setFeedback("");
    setSuccess(false);

    try {
      const response = await fetch(`${API}/api/stock-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(product.id),
          email: email.trim(),
          customerName: name.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not save your notification request.");
      }

      setSuccess(true);
      setFeedback(
        data.duplicate
          ? (isBn ? "এই পণ্যের জন্য আপনার অনুরোধ আগে থেকেই আছে।" : "You are already subscribed for this product.")
          : (isBn ? "পণ্যটি স্টকে এলে ইমেইল পাঠানো হবে।" : "We'll email you when this product is back in stock.")
      );
      setOpen(false);
    } catch (error) {
      setFeedback(
        error.message === "Failed to fetch"
          ? (isBn ? "সার্ভারের সাথে সংযোগ করা যাচ্ছে না।" : "Cannot connect to PreBotix server.")
          : error.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`pb-notify-wrap ${compact ? "pb-notify-compact" : ""}`} onClick={(event) => event.stopPropagation()}>
      {!success && (
        <button
          type="button"
          className="pb-notify-trigger"
          onClick={() => {
            setOpen((value) => !value);
            setFeedback("");
          }}
          aria-expanded={open}
        >
          <Bell size={compact ? 13 : 16} />
          {compact
            ? (isBn ? "Notify" : "Notify")
            : (isBn ? "Notify me when available" : "Notify me when available")}
        </button>
      )}

      {open && (
        <form className="pb-notify-form" onSubmit={submit}>
          {!user?.email && (
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isBn ? "আপনার নাম (ঐচ্ছিক)" : "Your name (optional)"}
              maxLength={120}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={isBn ? "আপনার ইমেইল ঠিকানা" : "Your email address"}
            maxLength={254}
            required
          />
          <button type="submit" disabled={loading}>
            {loading
              ? (isBn ? "সেভ হচ্ছে..." : "Saving...")
              : (isBn ? "Notify করুন" : "Notify me")}
          </button>
        </form>
      )}

      {success && (
        <span className="pb-notify-success">
          <CheckCircle2 size={14} />
          {feedback}
        </span>
      )}
      {!success && feedback && <span className="pb-notify-feedback">{feedback}</span>}
    </div>
  );
}
