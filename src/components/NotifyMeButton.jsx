
import { useEffect, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export default function NotifyMeButton({
  product,
  lang = "en",
  user = null,
  compact = false,
}) {
  const isBn = lang === "bn";
  const isLoggedIn = Boolean(
    user?.email && String(user.email).trim()
  );

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(String(user?.email || ""));
  const [name, setName] = useState(
    String(user?.name || user?.fullName || "")
  );
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setEmail(String(user?.email || ""));
    setName(String(user?.name || user?.fullName || ""));
    setOpen(false);
    setFeedback("");
    setSuccess(false);
  }, [product?.id, user?.email, user?.name, user?.fullName]);

  if (Number(product?.stock || 0) > 0) return null;

  const submit = async (event) => {
    event?.preventDefault();

    if (loading || success) return;

    if (!isLoggedIn && !email.trim()) {
      setFeedback(
        isBn ? "আপনার ইমেইল দিন।" : "Please enter your email address."
      );
      return;
    }

    setLoading(true);
    setFeedback("");

    try {
      const response = await fetch(`${API}/api/stock-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: Number(product.id),
          email: email.trim(),
          customerName: name.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not save your notification request."
        );
      }

      setSuccess(true);
      setOpen(false);

      setFeedback(
        data.duplicate
          ? isBn
            ? "এই পণ্যের জন্য আপনার অনুরোধ আগে থেকেই আছে।"
            : "You are already subscribed for this product."
          : isBn
            ? "পণ্যটি স্টকে এলে আপনাকে ইমেইল করা হবে।"
            : "We'll email you when this product is back in stock."
      );
    } catch (error) {
      setFeedback(
        error.message === "Failed to fetch"
          ? isBn
            ? "সার্ভারের সাথে সংযোগ করা যাচ্ছে না।"
            : "Cannot connect to PreBotix server."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`pb-notify-wrap ${compact ? "pb-notify-compact" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {!success && (
        <button
          type="button"
          className="pb-notify-trigger"
          disabled={loading}
          onClick={() => {
            setFeedback("");

            if (isLoggedIn) {
              submit();
            } else {
              setOpen((value) => !value);
            }
          }}
          aria-expanded={open}
        >
          <Bell size={compact ? 13 : 16} />
          {isBn ? "Notify me when available" : "Notify me when available"}
        </button>
      )}

      {open && !isLoggedIn && (
        <form className="pb-notify-form" onSubmit={submit}>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={isBn ? "আপনার নাম" : "Your name"}
            maxLength={120}
          />

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={
              isBn ? "আপনার ইমেইল ঠিকানা" : "Your email address"
            }
            maxLength={254}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? isBn
                ? "পাঠানো হচ্ছে..."
                : "Submitting..."
              : isBn
                ? "Notify করুন"
                : "Notify me"}
          </button>
        </form>
      )}

      {success && (
        <span className="pb-notify-success">
          <CheckCircle2 size={14} />
          {feedback}
        </span>
      )}

      {!success && feedback && (
        <span className="pb-notify-feedback">{feedback}</span>
      )}
    </div>
  );
}
