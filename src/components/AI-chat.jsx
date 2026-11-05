
import { useEffect, useRef, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const initialMessage = {
  role: "assistant",
  text: "Hi! 👋 Welcome to PreBotix. Ask me about robotics, electronics, or which product is right for your project.",
  products: [],
};

function getProductTitle(product, lang) {
  return lang === "bn"
    ? product.bn || product.title
    : product.title || product.bn || "Product";
}

function getProductImage(image) {
  if (!image) return "";

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:")
  ) {
    return image;
  }

  return `${API}/${image.replace(/^\/+/, "")}`;
}

function formatPrice(price, lang) {
  const amount = Number(price);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat(
    lang === "bn" ? "bn-BD" : "en-BD",
    {
      style: "currency",
      currency: "BDT",
      maximumFractionDigits: 2,
    }
  ).format(amount);
}

export default function AIChat({
  isOpen,
  onClose,
  products = [],
  lang = "en",
  onDetails,
  onAdd,
}) {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const sendMessage = async (event) => {
    event?.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    if (text.length > 2000) {
      setError("Please keep your message under 2000 characters.");
      return;
    }

    const updatedMessages = [
      ...messages,
      { role: "user", text },
    ];

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, text }) => ({
            role,
            text,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not get an AI response."
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.reply || "How can I help you?",
          products: Array.isArray(data.recommendedProducts)
            ? data.recommendedProducts
            : [],
        },
      ]);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to PreBotix server. Check that the backend is running."
          : err.message
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const openRecommendedProduct = (recommendation) => {
    // Use the full product object already loaded by App.jsx.
    const product = products.find(
      (item) => String(item.id) === String(recommendation.id)
    );

    if (!product) {
      setError(
        lang === "bn"
          ? "পণ্যের বিস্তারিত এখন লোড করা যাচ্ছে না। আবার চেষ্টা করুন।"
          : "Product details are not available yet. Please try again."
      );
      return;
    }

    setError("");
    onDetails?.(product);
    onClose?.();
  };

  const addRecommendedProduct = (recommendation) => {
    const product = products.find(
      (item) => String(item.id) === String(recommendation.id)
    );

    if (!product) {
      setError(
        lang === "bn"
          ? "পণ্যটি এখন পাওয়া যাচ্ছে না।"
          : "This product is not available right now."
      );
      return;
    }

    if (Number(product.stock) <= 0) {
      setError(
        lang === "bn"
          ? "পণ্যটি বর্তমানে স্টকে নেই।"
          : "This product is currently out of stock."
      );
      return;
    }

    setError("");
    onAdd?.(product);
  };

  return (
    <section
      role="dialog"
      aria-label="PreBotix AI chat"
      aria-modal="false"
      style={styles.panel}
    >
      <header style={styles.header}>
        <div>
          <strong style={styles.brand}>PreBotix AI</strong>
          <div style={styles.subtitle}>
            {lang === "bn"
              ? "রোবটিক্স ও ইলেকট্রনিক্স সহকারী"
              : "Robotics & Electronics Assistant"}
          </div>
          <div style={styles.status}>
            <span style={styles.statusDot} />
            {lang === "bn"
              ? "পণ্য সাজেশনের জন্য প্রস্তুত"
              : "Product recommendations"}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          style={styles.closeButton}
        >
          ✕
        </button>
      </header>

      <div aria-live="polite" style={styles.conversation}>
        {messages.map((message, index) => (
          <div
            key={`${index}-${message.role}`}
            style={{
              alignSelf:
                message.role === "user" ? "flex-end" : "flex-start",
              width: message.products?.length ? "100%" : "auto",
              maxWidth: message.role === "user" ? "88%" : "100%",
            }}
          >
            <div
              style={{
                ...styles.bubble,
                background:
                  message.role === "user" ? "#164e63" : "#172b40",
                borderColor:
                  message.role === "user" ? "#267c91" : "#2a4054",
              }}
            >
              {message.text}
            </div>

            {message.role === "assistant" &&
              message.products?.length > 0 && (
                <div style={styles.recommendations}>
                  <div style={styles.recommendationHeading}>
                    <span>✦</span>
                    {lang === "bn"
                      ? "আপনার জন্য সাজেস্ট করা পণ্য"
                      : "Recommended products"}
                  </div>

                  {message.products.map((recommendation) => {
                    const product = products.find(
                      (item) =>
                        String(item.id) === String(recommendation.id)
                    );

                    const title = getProductTitle(
                      product || recommendation,
                      lang
                    );

                    const image = getProductImage(
                      product?.image || recommendation.image
                    );

                    const currentPrice = Number(
  recommendation.currentPrice ??
    recommendation.price ??
    product?.price
);

console.log("PreBotix AI PRICE DEBUG:", {
  productId: recommendation.id,
  recommendationTitle: recommendation.title,
  backendPrice: recommendation.price,
  backendCurrentPrice: recommendation.currentPrice,
  frontendProductTitle: product?.title,
  frontendProductPrice: product?.price,
  displayedPrice: currentPrice,
});

                    const stock = Number(
                      product?.stock ?? recommendation.stock ?? 0
                    );

                    const oldPrice = Number(
                      recommendation.oldPrice ??
                        product?.oldPrice
                    );

                    const inStock =
                      stock > 0 &&
                      recommendation.inStock !== false;

                    return (
                      <article
                        key={recommendation.id}
                        style={styles.productCard}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openRecommendedProduct(recommendation)
                          }
                          style={styles.productDetailsButton}
                          aria-label={
                            lang === "bn"
                              ? `${title} পণ্যের বিস্তারিত দেখুন`
                              : `View details for ${title}`
                          }
                        >
                          <div style={styles.imageWrap}>
                            {image ? (
                              <img
                                src={image}
                                alt={title}
                                loading="lazy"
                                style={styles.productImage}
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span style={styles.imagePlaceholder}>
                                <span style={{ fontSize: "25px" }}>⚙</span>
                                <span>
                                  {lang === "bn" ? "ছবি নেই" : "No image"}
                                </span>
                              </span>
                            )}
                          </div>

                          <div style={styles.productInfo}>
                            <span style={styles.category}>
                              {product?.category ||
                                recommendation.category ||
                                "PreBotix"}
                            </span>

                            <strong style={styles.productTitle}>
                              {title}
                            </strong>

                            <div style={styles.priceRow}>
                              <strong style={styles.currentPrice}>
                                {formatPrice(currentPrice, lang)}
                              </strong>

                              {Number.isFinite(oldPrice) &&
                                oldPrice > currentPrice && (
                                  <del style={styles.oldPrice}>
                                    {formatPrice(oldPrice, lang)}
                                  </del>
                                )}
                            </div>

                            <span
                              style={{
                                ...styles.stock,
                                color: inStock ? "#7ce9b0" : "#ffaaaa",
                              }}
                            >
                              {inStock
                                ? lang === "bn"
                                  ? `স্টকে আছে · ${stock}টি`
                                  : `In stock · ${stock}`
                                : lang === "bn"
                                  ? "স্টকে নেই"
                                  : "Out of stock"}
                            </span>

                            <span style={styles.detailsHint}>
                              {lang === "bn"
                                ? "বিস্তারিত দেখুন →"
                                : "View details →"}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={!inStock}
                          onClick={() =>
                            addRecommendedProduct(recommendation)
                          }
                          style={{
                            ...styles.addButton,
                            opacity: inStock ? 1 : 0.45,
                            cursor: inStock ? "pointer" : "not-allowed",
                          }}
                        >
                          {inStock
                            ? lang === "bn"
                              ? "＋ কার্টে যোগ করুন"
                              : "＋ Add to cart"
                            : lang === "bn"
                              ? "স্টকে নেই"
                              : "Out of stock"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
          </div>
        ))}

        {loading && (
          <div style={styles.typing}>
            <span style={styles.statusDot} />
            {lang === "bn"
              ? "PreBotix AI উত্তর তৈরি করছে..."
              : "PreBotix AI is thinking..."}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}

      <form onSubmit={sendMessage} style={styles.form}>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            lang === "bn"
              ? "পণ্য বা প্রজেক্ট সম্পর্কে জিজ্ঞেস করুন..."
              : "Ask about a product or project..."
          }
          aria-label="Type your message"
          maxLength={2000}
          disabled={loading}
          style={styles.input}
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            ...styles.sendButton,
            opacity: loading || !input.trim() ? 0.55 : 1,
          }}
        >
          {loading ? "…" : lang === "bn" ? "পাঠান" : "Send"}
        </button>
      </form>
    </section>
  );
}

const styles = {
  panel: {
    position: "fixed",
    right: "20px",
    bottom: "100px",
    zIndex: 99999,
    width: "370px",
    maxWidth: "calc(100vw - 24px)",
    height: "min(650px, calc(100dvh - 125px))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "#f1f5f9",
    background: "#0b1929",
    border: "1px solid #47e3ef",
    borderRadius: "18px",
    boxShadow: "0 12px 40px rgba(0,0,0,.45)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "15px",
    background: "#102338",
    borderBottom: "1px solid #254154",
  },
  brand: {
    color: "#47e3ef",
    fontSize: "17px",
  },
  subtitle: {
    marginTop: "3px",
    color: "#a7b8c9",
    fontSize: "12px",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "7px",
    color: "#7ce9b0",
    fontSize: "11px",
  },
  statusDot: {
    display: "inline-block",
    flexShrink: 0,
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#7ce9b0",
  },
  closeButton: {
    padding: "8px 11px",
    color: "#fff",
    background: "#20384d",
    border: "1px solid #355168",
    borderRadius: "8px",
    cursor: "pointer",
  },
  conversation: {
    flex: 1,
    overflowY: "auto",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  bubble: {
    padding: "11px 13px",
    border: "1px solid",
    borderRadius: "13px",
    fontSize: "14px",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  recommendations: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "12px",
  },
  recommendationHeading: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: "#47e3ef",
    fontSize: "13px",
    fontWeight: 700,
  },
  productCard: {
    padding: "10px",
    background: "#102338",
    border: "1px solid #29465c",
    borderRadius: "13px",
  },
  productDetailsButton: {
    display: "flex",
    alignItems: "flex-start",
    gap: "11px",
    width: "100%",
    padding: 0,
    textAlign: "left",
    color: "inherit",
    background: "transparent",
    border: 0,
    cursor: "pointer",
  },
  imageWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "96px",
    height: "100px",
    overflow: "hidden",
    background: "#f8fafc",
    borderRadius: "9px",
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  imagePlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    color: "#64748b",
    fontSize: "10px",
  },
  productInfo: {
    display: "flex",
    flex: 1,
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "5px",
  },
  category: {
    color: "#91a9bc",
    fontSize: "10px",
    textTransform: "uppercase",
  },
  productTitle: {
    color: "#f1f5f9",
    fontSize: "13px",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  priceRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
  },
  currentPrice: {
    color: "#47e3ef",
    fontSize: "14px",
  },
  oldPrice: {
    color: "#91a9bc",
    fontSize: "11px",
  },
  stock: {
    fontSize: "11px",
  },
  detailsHint: {
    marginTop: "2px",
    color: "#47e3ef",
    fontSize: "11px",
  },
  addButton: {
    width: "100%",
    marginTop: "10px",
    padding: "10px",
    color: "#07111f",
    background: "#47e3ef",
    border: 0,
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
  },
  typing: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#47e3ef",
    fontSize: "12px",
  },
  error: {
    margin: 0,
    padding: "8px 14px",
    color: "#ffb4b4",
    fontSize: "12px",
    overflowWrap: "anywhere",
  },
  form: {
    display: "flex",
    gap: "8px",
    padding: "12px",
    borderTop: "1px solid #254154",
    background: "#0e1e30",
  },
  input: {
    minWidth: 0,
    flex: 1,
    padding: "12px",
    color: "#fff",
    background: "#172b40",
    border: "1px solid #355168",
    borderRadius: "10px",
    outlineColor: "#47e3ef",
  },
  sendButton: {
    padding: "0 14px",
    color: "#07111f",
    background: "#47e3ef",
    border: 0,
    borderRadius: "9px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
