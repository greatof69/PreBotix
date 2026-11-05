
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Send,
  UserRound,
  Tag,
  MapPin,
  Clock3,
  CheckCircle2,
  Cpu,
  LoaderCircle,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

  

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export default function ContactPage({ onBack }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const change = (e) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  };

  const goBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    if (busy) return;

    setBusy(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${API}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Message could not be sent. Please try again."
        );
      }

      setNotice(
        "Thanks! Your message has been saved. Our team will get back to you."
      );

      setForm({
        name: "",
        email: "",
        subject: "",
        message: "",
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to send your message. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pb-contact-page">
      {/* Hero banner */}
      <section className="pb-contact-hero">
        <div className="pb-contact-hero-grid" />

        <div className="pb-contact-hero-content">
          <div className="pb-contact-eyebrow">
            <span className="pb-contact-live-dot" />
            GET IN TOUCH
          </div>

          <h1>
            Contact <span>PreBotix</span>
          </h1>

          <p>
            Questions about an order, a product, or your next project?
            <br className="pb-contact-desktop-break" />
            Send us a message. We’re here to help!
          </p>

          <div className="pb-contact-hero-line" />
        </div>

        <div className="pb-contact-hero-art" aria-hidden="true">
          <div className="pb-contact-orbit pb-contact-orbit-one" />
          <div className="pb-contact-orbit pb-contact-orbit-two" />

          <div className="pb-contact-chip">
            <Cpu size={64} strokeWidth={1.3} />
            <span>PREBOTIX</span>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="pb-contact-container">
        <div className="pb-contact-layout">
          {/* Left information panel */}
          <aside className="pb-contact-sidebar">
            <div className="pb-contact-info-card">
              <div className="pb-contact-info-icon">
                <Mail size={34} strokeWidth={1.8} />
              </div>

              <div>
                <h3>Email support</h3>

                <p>
                  Send your question through the form.
                  Your message is saved securely for our support team.
                </p>

                <a
                  className="pb-contact-info-detail"
                  href="mailto:1rahulhalder2026@gmail.com"
                >
                  <Mail size={19} />
                  1rahulhalder2026@gmail.com
                </a>
              </div>
            </div>

            <div className="pb-contact-info-card">
              <div className="pb-contact-info-icon pb-contact-icon-blue">
                <MessageCircle size={34} strokeWidth={1.8} />
              </div>

              <div>
                <h3>Order support</h3>

                <p>
                  Include your order number if your message is about
                  an existing order.
                </p>

                <div className="pb-contact-info-detail pb-contact-muted-detail">
                  <Clock3 size={19} />
                  Sat – Thu, 10:00 AM – 8:00 PM
                </div>
              </div>
            </div>

            <div className="pb-contact-info-card">
              <div className="pb-contact-info-icon pb-contact-icon-purple">
                <MapPin size={34} strokeWidth={1.8} />
              </div>

              <div>
                <h3>Our location</h3>

                <p>
                  GP - Cha 60/1, Mohakhali Warlessgate, Banani Dakha
                  <br />
                  (Online support)
                </p>
              </div>
            </div>

            <div className="pb-contact-handwriting">
              Let’s build something amazing!
              <span />
            </div>
          </aside>

          {/* Right form panel */}
          <section className="pb-contact-form-card">
            <div className="pb-contact-form-heading">
              <div className="pb-contact-send-icon">
                <Send size={43} strokeWidth={1.7} />
              </div>

              <div>
                <h2>Send us a message</h2>
                <p>All fields except subject are required.</p>
              </div>
            </div>

            {notice && (
              <div
                className="pb-contact-alert pb-contact-success"
                role="status"
              >
                <CheckCircle2 size={21} />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div
                className="pb-contact-alert pb-contact-error"
                role="alert"
              >
                <MessageSquareText size={21} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit}>
              <div className="pb-contact-fields">
                <label className="pb-contact-field">
                  <span>
                    Your name <b>*</b>
                  </span>

                  <div className="pb-contact-input-wrap">
                    <UserRound size={21} />

                    <input
                      name="name"
                      value={form.name}
                      onChange={change}
                      placeholder="Enter your full name"
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>

                <label className="pb-contact-field">
                  <span>
                    Email address <b>*</b>
                  </span>

                  <div className="pb-contact-input-wrap">
                    <Mail size={21} />

                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={change}
                      placeholder="you@example.com"
                      maxLength={254}
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <label className="pb-contact-field pb-contact-field-wide">
                  <span>Subject</span>

                  <div className="pb-contact-input-wrap">
                    <Tag size={21} />

                    <input
                      name="subject"
                      value={form.subject}
                      onChange={change}
                      placeholder="Order support, product question..."
                      maxLength={180}
                    />
                  </div>
                </label>

                <label className="pb-contact-field pb-contact-field-wide">
                  <span>
                    Message <b>*</b>
                  </span>

                  <div className="pb-contact-textarea-wrap">
                    <MessageSquareText size={21} />

                    <textarea
                      name="message"
                      value={form.message}
                      onChange={change}
                      placeholder="Tell us what you need..."
                      rows={5}
                      minLength={5}
                      maxLength={5000}
                      required
                    />

                    <span className="pb-contact-char-count">
                      {form.message.length}/5000
                    </span>
                  </div>
                </label>
              </div>

              <div className="pb-contact-form-footer">
                <button
                  type="submit"
                  className="pb-contact-submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <LoaderCircle
                        size={21}
                        className="pb-contact-spinner"
                      />
                      Sending message...
                    </>
                  ) : (
                    <>
                      <Send size={21} />
                      Send message
                    </>
                  )}
                </button>
              </div>

              <div className="pb-contact-form-security">
                <ShieldCheck size={16} />
                Your information is submitted securely to our support team.
              </div>
            </form>
          </section>
        </div>

        
      </div>
    </main>
  );
}
