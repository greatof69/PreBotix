import { useEffect, useRef, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const initialMessage = {
  role: "assistant",
  text: "Hi! 👋 Welcome to PreBotix. Ask me about robotics, electronics, or which product is right for your project.",
  products: [],
};

const STORAGE_KEY = "prebotix_ai_chat_v1";

// Page reload korleo conversation ferot ashbe
function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [initialMessage];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) && parsed.length ? parsed : [initialMessage];
  } catch {
    return [initialMessage];
  }
}

function saveMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full hole image bad diye save kori
    try {
      const light = messages.map(({ image, ...rest }) =>
        image ? { ...rest, text: rest.text || "📷 Image" } : rest
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch {
      // ignore
    }
  }
}

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

  return new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AIChat({
  isOpen,
  onClose,
  products = [],
  lang = "en",
  onDetails,
  onAdd,
}) {
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const menuRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0); // chat clear korle pending reply ignore korar jonno
  const closeTimerRef = useRef(null); // menu hover-e ektu delay diye bondho korar jonno
  const pointerTypeRef = useRef("mouse");
  const menuBoxRef = useRef(null);

  // Save conversation on every change.
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Scroll to latest message.
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  // Focus input when chat opens.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Stop camera when chat closes.
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setMenuOpen(false);
    }
  }, [isOpen]);

  // Attach camera stream to video.
  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  // Release image preview URL when it changes or component unmounts.
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Menu khola thakle:
  // - menu-r bairey click korle ba Esc chapole bondho hobe
  // - mouse button + box + majher gap-er bhitore thakle khola thakbe
  // - mouse oi area-r bairey gele bondho hobe
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;

      const a = menuRef.current?.getBoundingClientRect();
      const b = menuBoxRef.current?.getBoundingClientRect();

      if (!a) return;

      // button + box + majher gap, sob mile ekta area
      const pad = 6;
      const left = Math.min(a.left, b?.left ?? a.left) - pad;
      const top = Math.min(a.top, b?.top ?? a.top) - pad;
      const right = Math.max(a.right, b?.right ?? a.right) + pad;
      const bottom = Math.max(a.bottom, b?.bottom ?? a.bottom) + pad;

      const inside =
        e.clientX >= left &&
        e.clientX <= right &&
        e.clientY >= top &&
        e.clientY <= bottom;

      clearTimeout(closeTimerRef.current);

      if (!inside) {
        closeTimerRef.current = setTimeout(() => setMenuOpen(false), 120);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointermove", onMove);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointermove", onMove);
      clearTimeout(closeTimerRef.current);
    };
  }, [menuOpen]);

  // Release camera when component unmounts.
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
  };

  const closeChat = () => {
    stopCamera();
    setMenuOpen(false);
    onClose?.();
  };

  const startCamera = async () => {
    setMenuOpen(false);
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported by this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });

      // If chat closed while permission was pending, stop the stream.
      if (!isOpen) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : err.message || "Could not access camera."
      );
    }
  };

  const selectImage = (file) => {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please select a JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be below 10 MB.");
      return;
    }

    setError("");

    // Image shudhu preview hishebe thake, Send dile jabe
    setImagePreview(URL.createObjectURL(file));
    setImageFile(file);
  };

  const handleFileInput = (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    selectImage(file);
  };

  const captureCameraImage = () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      setError("Camera is not ready. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    const maxSize = 1280;

    const scale = Math.min(
      1,
      maxSize / Math.max(video.videoWidth, video.videoHeight)
    );

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Could not capture the image.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture the image.");
          return;
        }

        const file = new File([blob], "prebotix-camera.jpg", {
          type: "image/jpeg",
        });

        selectImage(file);
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  };

  const removeSelectedImage = () => {
    setImagePreview("");
    setImageFile(null);
  };

  // Delete the whole conversation and reset everything.
  const clearChat = () => {
    const ok = window.confirm(
      lang === "bn"
        ? "সব মেসেজ মুছে ফেলতে চান?"
        : "Delete all messages in this chat?"
    );

    if (!ok) return;

    requestIdRef.current += 1; // pending AI reply ar ashbe na
    stopCamera();
    setMenuOpen(false);
    setMessages([initialMessage]);
    setInput("");
    setError("");
    setLoading(false);
    removeSelectedImage();
    inputRef.current?.focus();
  };

  const sendMessage = async (event) => {
    event?.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    if (text.length > 2000) {
      setError("Please keep your message under 2000 characters.");
      return;
    }

    const updatedMessages = [...messages, { role: "user", text }];

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setLoading(true);

    const myRequestId = ++requestIdRef.current;

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

      if (myRequestId !== requestIdRef.current) return;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not get an AI response.");
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
      if (myRequestId !== requestIdRef.current) return;

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

  // Image (+ optional text) ekshathe pathay, product PreBotix-e ache kina bole
  const sendImageMessage = async (event) => {
    event?.preventDefault();

    if (!imageFile || loading) return;

    setLoading(true);
    setError("");
    setMenuOpen(false);

    const myRequestId = ++requestIdRef.current;
    const caption = input.trim();

    try {
      const imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const image = new Image();

          image.onload = () => {
            const maxSize = 1280;

            const scale = Math.min(
              1,
              maxSize / Math.max(image.width, image.height)
            );

            const canvas = document.createElement("canvas");

            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);

            const ctx = canvas.getContext("2d");

            if (!ctx) {
              reject(new Error("Could not process the image."));
              return;
            }

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };

          image.onerror = () => {
            reject(new Error("Could not read the selected image."));
          };

          image.src = reader.result;
        };

        reader.onerror = () => {
          reject(new Error("Could not read the selected image."));
        };

        reader.readAsDataURL(imageFile);
      });

      const response = await fetch(`${API}/api/image-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageUrl,
          caption,
          catalog: products.map((product) => ({
            id: product.id,
            title: product.title,
            category: product.category,
          })),
        }),
      });

      const data = await response.json();

      if (myRequestId !== requestIdRef.current) return;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Image analysis failed.");
      }

      const recommendations = (data.matches || [])
        .map((match) => {
          const product = products.find(
            (item) => String(item.id) === String(match.id)
          );

          if (!product) return null;

          return {
            id: product.id,
            title: product.title,
            bn: product.bn,
            category: product.category,
            image: product.image,
            price: product.discountPrice || product.price,
            currentPrice: product.discountPrice || product.price,
            oldPrice: product.oldPrice,
            stock: product.stock,
            inStock: Number(product.stock) > 0,
            confidence: match.confidence,
          };
        })
        .filter(Boolean);

      const userMessage = {
        role: "user",
        text: caption, // auto text nei: user ja likhbe shudhu seta
        image: imageUrl,
      };

      const assistantMessage = {
        role: "assistant",
        text: recommendations.length
          ? lang === "bn"
            ? "হ্যাঁ, এই পণ্যটি PreBotix-এ আছে। নিচে মিল পাওয়া পণ্য দেওয়া হলো।"
            : "Yes, this product is available at PreBotix. Here are the matching products."
          : lang === "bn"
            ? "দুঃখিত, এই পণ্যটি এখন PreBotix-এর ক্যাটালগে পাওয়া যায়নি। অন্য ছবি দিয়ে চেষ্টা করুন বা পণ্যের নাম লিখে জিজ্ঞেস করুন।"
            : "Sorry, this product is not available in the PreBotix catalog right now. Try another image or ask me by product name.",
        products: recommendations,
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);

      setInput("");
      removeSelectedImage();
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return;

      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to PreBotix server."
          : err.message
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleComposerSubmit = (event) => {
    if (imageFile) {
      sendImageMessage(event);
    } else {
      sendMessage(event);
    }
  };

  const openRecommendedProduct = (recommendation) => {
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
    closeChat();
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

  // Do not render the chat when closed.
  if (!isOpen) return null;

  return (
    <>
      {/* Background: click outside chat to close */}
      <div
        aria-hidden="true"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeChat();
          }
        }}
        style={styles.backdrop}
      />

      <section
        onMouseDown={(event) => event.stopPropagation()}
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
            onClick={closeChat}
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
                {message.image && (
                  <img
                    src={message.image}
                    alt="Uploaded image"
                    style={styles.userImage}
                  />
                )}

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

                      const stock = Number(
                        product?.stock ?? recommendation.stock ?? 0
                      );

                      const oldPrice = Number(
                        recommendation.oldPrice ?? product?.oldPrice
                      );

                      const inStock =
                        stock > 0 && recommendation.inStock !== false;

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

        {imagePreview && (
          <div style={styles.previewBar}>
            <img
              src={imagePreview}
              alt="Selected image"
              style={styles.previewImage}
            />

            <button
              type="button"
              onClick={removeSelectedImage}
              style={styles.removeImageButton}
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleComposerSubmit} style={styles.form}>
          {/* Attachment menu */}
          <div
            ref={menuRef}
            style={styles.menuWrap}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              clearTimeout(closeTimerRef.current);
              setMenuOpen(true);
            }}
          >
            <button
              type="button"
              style={styles.menuButton}
              onPointerDown={(e) => {
                pointerTypeRef.current = e.pointerType;
              }}
              onClick={() =>
                // Mouse: hover-e already open, click-e bondho hobe na. Touch: toggle.
                setMenuOpen((open) =>
                  pointerTypeRef.current === "mouse" ? true : !open
                )
              }
              aria-label="Chat menu"
              aria-expanded={menuOpen}
            >
              +
            </button>

            {menuOpen && (
              <div style={styles.attachmentMenuOuter}>
                <div ref={menuBoxRef} style={styles.attachmentMenu}>
                  <button
                    type="button"
                    style={styles.attachmentItem}
                    disabled={loading}
                    onClick={() => {
                      setMenuOpen(false);
                      startCamera();
                    }}
                  >
                    📷 {lang === "bn" ? "ক্যামেরা ইনপুট" : "Camera Input"}
                  </button>

                  <button
                    type="button"
                    style={styles.attachmentItem}
                    disabled={loading}
                    onClick={() => {
                      setMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    🖼 {lang === "bn" ? "ছবি আপলোড" : "Image Upload"}
                  </button>

                  <button
                    type="button"
                    style={styles.deleteItem}
                    onClick={clearChat}
                  >
                    🗑 {lang === "bn" ? "চ্যাট মুছুন" : "Delete chat"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload product image"
            onChange={handleFileInput}
            style={styles.hiddenInput}
          />

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
            disabled={loading || (!input.trim() && !imageFile)}
            style={{
              ...styles.sendButton,
              opacity: loading || (!input.trim() && !imageFile) ? 0.55 : 1,
            }}
          >
            {loading ? "…" : lang === "bn" ? "পাঠান" : "Send"}
          </button>
        </form>

        {/* Camera modal */}
        {cameraOpen && (
          <div style={styles.cameraOverlay}>
            <div style={styles.cameraDialog}>
              <div style={styles.cameraHeader}>
                <strong>{lang === "bn" ? "ক্যামেরা" : "Camera Input"}</strong>

                <button
                  type="button"
                  onClick={stopCamera}
                  style={styles.removeImageButton}
                  aria-label="Close camera"
                >
                  ✕
                </button>
              </div>

              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={styles.cameraVideo}
              />

              <div style={styles.cameraActions}>
                <button
                  type="button"
                  onClick={stopCamera}
                  style={styles.cameraCancelButton}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={captureCameraImage}
                  style={styles.cameraCaptureButton}
                >
                  📷 Capture
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 99998,
    background: "transparent",
  },

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
    minHeight: 0,
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
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    borderTop: "1px solid #254154",
    background: "#0e1e30",
    width: "100%",
    boxSizing: "border-box",
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
    boxSizing: "border-box",
    width: "100%",
  },

  sendButton: {
    padding: "0 14px",
    minHeight: "42px",
    color: "#07111f",
    background: "#47e3ef",
    border: 0,
    borderRadius: "9px",
    fontWeight: 700,
    cursor: "pointer",
  },

  menuWrap: {
    position: "relative",
    flexShrink: 0,
    width: "42px",
    height: "42px",
  },

  menuButton: {
    width: "42px",
    height: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#47e3ef",
    background: "#172b40",
    border: "1px solid #355168",
    borderRadius: "10px",
    fontSize: "28px",
    cursor: "pointer",
    flexShrink: 0,
  },

  // Invisible wrapper: button ar visible box-er majhe gap-ta hover "bridge" hoye thake
  attachmentMenuOuter: {
    position: "absolute",
    left: "0",
    bottom: "100%",
    paddingBottom: "30px", // box ta button theke 30px upore (aro upore chaile baran)
    zIndex: 100002,
    pointerEvents: "auto",
  },

  attachmentMenu: {
    width: "190px",
    padding: "7px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    background: "#172b40",
    border: "1px solid #47e3ef",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,.45)",
  },

  attachmentItem: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    width: "100%",
    padding: "12px",
    color: "#f1f5f9",
    background: "transparent",
    border: 0,
    borderRadius: "8px",
    textAlign: "left",
    fontSize: "13px",
    cursor: "pointer",
  },

  deleteItem: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    width: "100%",
    padding: "12px",
    marginTop: "2px",
    color: "#ffb4b4",
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.3)",
    borderRadius: "8px",
    textAlign: "left",
    fontSize: "13px",
    cursor: "pointer",
  },

  hiddenInput: {
    display: "none",
  },

  previewBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "8px 10px 14px",
    padding: "8px",
    background: "#172b40",
    border: "1px solid #355168",
    borderRadius: "10px",
  },

  previewImage: {
    width: "55px",
    height: "55px",
    objectFit: "cover",
    borderRadius: "7px",
  },

  removeImageButton: {
    width: "30px",
    height: "30px",
    color: "#fff",
    background: "#29465c",
    border: 0,
    borderRadius: "7px",
    cursor: "pointer",
  },

  userImage: {
    display: "block",
    width: "180px",
    maxWidth: "100%",
    maxHeight: "200px",
    marginTop: "7px",
    objectFit: "contain",
    borderRadius: "10px",
    border: "1px solid #355168",
  },

  cameraOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 100001,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "15px",
    background: "transparent",
  },

  cameraDialog: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  cameraHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#47e3ef",
  },

  cameraVideo: {
    width: "100%",
    maxHeight: "390px",
    background: "#000",
    borderRadius: "12px",
    objectFit: "contain",
  },

  cameraActions: {
    display: "flex",
    gap: "10px",
  },

  cameraCancelButton: {
    flex: 1,
    padding: "12px",
    color: "#fff",
    background: "#29465c",
    border: 0,
    borderRadius: "9px",
    cursor: "pointer",
  },

  cameraCaptureButton: {
    flex: 2,
    padding: "12px",
    color: "#07111f",
    background: "#47e3ef",
    border: 0,
    borderRadius: "9px",
    fontWeight: 700,
    cursor: "pointer",
  },
};