
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Plus,
  Heart,
  Clock3,
} from "lucide-react";

import {
  getTitle,
  categoryLabel,
  tagLabel,
} from "../utils/productHelpers";

import { formatPrice } from "../utils/formatPrice";
import NotifyMeButton from "./NotifyMeButton";

export default function ProductCard({
  product,
  lang = "en",
  t = {},
  onAdd,
  onDetails,
  qty = 0,
  isFavorite = false,
  onToggleFavorite = () => {},
  isAdmin = false,
  isModerator = false,
  user = null,
  onEditProduct,
  onDeleteProduct,
  imagePriority = false,
  onImageSettled,
}) {
  const isBangla = lang === "bn";

  const [now, setNow] = useState(() => Date.now());
  const [imageFailed, setImageFailed] = useState(false);

  // ==============================
  // DISCOUNT COUNTDOWN
  // ==============================

  useEffect(() => {
    const endTime = product.discountEndsAt
      ? new Date(product.discountEndsAt).getTime()
      : NaN;

    if (!Number.isFinite(endTime) || endTime <= Date.now()) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const currentTime = Date.now();

      setNow(currentTime);

      if (currentTime >= endTime) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [product.discountEndsAt]);

  const title = getTitle(product, lang);
  const stock = Math.max(0, Number(product.stock) || 0);
  const outOfStock = stock === 0;

  // ==============================
  // PRODUCT IMAGE
  // ==============================

  const image = String(product.image ?? "").trim();

  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:5000"
  )
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

  const imageSrc = !image
    ? ""
    : /^(https?:\/\/|blob:|data:)/i.test(image)
      ? image
      : `${apiBase}/${image.replace(/^\/+/, "")}`;

  useEffect(() => {
    if (!imageSrc && imagePriority) {
      onImageSettled?.(product.id);
    }
  }, [imageSrc, imagePriority, product.id, onImageSettled]);

  // Reset failed image when product image changes.
  useEffect(() => {
    setImageFailed(false);
  }, [imageSrc]);

  // ==============================
  // PRICE OPTIONS
  // ==============================

  const hasPriceOptions =
    product.priceOptionsEnabled === true &&
    Array.isArray(product.priceOptions) &&
    product.priceOptions.length > 0;

  const validCardOptions = hasPriceOptions
    ? product.priceOptions
        .map((option) => ({
          ...option,
          price: Number(option.price),
          originalPrice:
            option.originalPrice === undefined ||
            option.originalPrice === null ||
            option.originalPrice === ""
              ? undefined
              : Number(option.originalPrice),
        }))
        .filter(
          (option) =>
            Number.isFinite(option.price) &&
            option.price >= 0
        )
        .sort((a, b) => a.price - b.price)
    : [];

  const selectedCardOption = validCardOptions.length
    ? product.priceOptionsDisplay === "max"
      ? validCardOptions[validCardOptions.length - 1]
      : validCardOptions[0]
    : null;

  // ==============================
  // PRICE CALCULATION
  // ==============================

  const regularPrice = Number(product.price);
  const regularPriceMax = Number(product.priceMax);

  const discountPrice = Number(product.discountPrice);
  const discountPriceMax = Number(product.discountPriceMax);

  const hasRegularRange =
    Number.isFinite(regularPriceMax) &&
    regularPriceMax > regularPrice;

  const hasDiscountRange =
    Number.isFinite(discountPriceMax) &&
    discountPriceMax > discountPrice;

  const discountEndTime = product.discountEndsAt
    ? new Date(product.discountEndsAt).getTime()
    : NaN;

  const hasActiveDiscount =
    Number.isFinite(discountEndTime) &&
    discountEndTime > now;

  const hasValidDiscountPrice =
    Number.isFinite(discountPrice) &&
    Number.isFinite(regularPrice) &&
    discountPrice >= 0 &&
    discountPrice < regularPrice;

  const hasValidDiscountRange =
    hasActiveDiscount &&
    hasValidDiscountPrice &&
    (
      !hasDiscountRange ||
      discountPriceMax <
        (hasRegularRange ? regularPriceMax : regularPrice)
    );

  const displayPrice = selectedCardOption
    ? selectedCardOption.price
    : hasValidDiscountRange
      ? discountPrice
      : regularPrice;

  // ==============================
  // ORIGINAL PRICE
  // ==============================

  let originalPrice = null;

  if (selectedCardOption) {
    const optionOriginal = selectedCardOption.originalPrice;

    if (
      Number.isFinite(optionOriginal) &&
      optionOriginal > selectedCardOption.price
    ) {
      originalPrice = optionOriginal;
    }
  } else {
    const oldPrice = Number(product.oldPrice);

    if (
      Number.isFinite(oldPrice) &&
      oldPrice > displayPrice
    ) {
      originalPrice = oldPrice;
    } else if (
      hasValidDiscountRange &&
      regularPrice > displayPrice
    ) {
      originalPrice = regularPrice;
    }
  }

  const showOriginalPrice =
    Number.isFinite(originalPrice) &&
    originalPrice > displayPrice;

  // ==============================
  // COUNTDOWN TEXT
  // ==============================

  const remainingSeconds = hasActiveDiscount
    ? Math.max(
        0,
        Math.floor((discountEndTime - now) / 1000)
      )
    : 0;

  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const pad = (value) => String(value).padStart(2, "0");

  const countdownText =
    days > 0
      ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  // ==============================
  // STAFF / WISHLIST
  // ==============================

  const isStaff = isAdmin || isModerator;
  const canUseWishlist = !isStaff;

  // ==============================
  // BUTTON LABELS
  // ==============================

  const detailsLabel = isBangla
    ? "বিস্তারিত দেখুন"
    : "View details";

  const wishlistLabel = isFavorite
    ? isBangla
      ? "উইশলিস্ট থেকে সরান"
      : "Remove from wishlist"
    : isBangla
      ? "উইশলিস্টে যোগ করুন"
      : "Add to wishlist";

  const cartLabel = outOfStock
    ? isBangla
      ? "স্টক শেষ"
      : "Out of stock"
    : hasPriceOptions
      ? isBangla
        ? "অপশন নির্বাচন করুন"
        : "Choose an option"
      : isBangla
        ? "কার্টে যোগ করুন"
        : "Add to cart";

  // ==============================
  // ADD TO CART
  // ==============================

  const handleAdd = (event) => {
    event.stopPropagation();

    if (outOfStock) return;

    if (
      !isAdmin &&
      !isModerator &&
      product.priceOptionsEnabled === true &&
      Array.isArray(product.priceOptions) &&
      product.priceOptions.some(
        (option) =>
          option &&
          String(option.text || "").trim() &&
          Number.isFinite(Number(option.price)) &&
          Number(option.price) >= 0
      )
    ) {
      onDetails?.(product);
      return;
    }

    if (qty >= stock) return;

    onAdd?.(product);
  };

  // ==============================
  // COMPONENT UI
  // ==============================

  return (
    <article
      id={`product-card-${product.id}`}

      className={`product-card ${
        outOfStock ? "out-of-stock" : ""
      } ${
        isStaff ? "product-card--staff" : ""
      }`}
      onClick={() => onDetails?.(product)}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onSelectStart={(event) => event.preventDefault()}
      draggable={false}
      style={{
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* PRODUCT IMAGE */}

      <button
        type="button"
        className="product-image product-image-button"
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          event.stopPropagation();
          onDetails?.(product);
        }}
        aria-label={`${detailsLabel}: ${title}`}
      >
        {imageSrc && !imageFailed ? (
          <img
            key={imageSrc}
            src={imageSrc}
            alt={title}
            loading={imagePriority ? "eager" : "lazy"}
            fetchPriority={imagePriority ? "high" : "auto"}
            decoding="async"
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            onLoad={() => {
              if (imagePriority) {
                onImageSettled?.(product.id);
              }
            }}
            onError={() => {
              console.error(
                "[PreBotix] Product image failed:",
                {
                  id: product.id,
                  title: product.title,
                  image: product.image,
                  attemptedUrl: imageSrc,
                }
              );

              setImageFailed(true);

              if (imagePriority) {
                onImageSettled?.(product.id);
              }
            }}
          />
        ) : (
          <div className="product-image-placeholder">
            {isBangla ? "ছবি নেই" : "Image unavailable"}
          </div>
        )}

        {product.tag && (
          <span className="product-tag">
            {tagLabel(product.tag, lang)}
          </span>
        )}

        <span className="product-category">
          {categoryLabel(product.category, lang)}
        </span>

        {outOfStock && (
          <span className="product-stock-badge">
            {isBangla ? "স্টক শেষ" : "Out of Stock"}
          </span>
        )}

        <span className="quick-view">
          {detailsLabel}
          <ArrowRight size={14} />
        </span>
      </button>

      {/* ADMIN CONTROLS */}

      {isAdmin && (
        <div
          className="pb-storefront-product-admin-actions"
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 12px 0",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="pb-storefront-edit"
            style={{
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 7,
              padding: "6px 9px",
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={(event) => {
              event.stopPropagation();
              document
                .getElementById(`product-card-${product.id}`)
                ?.classList.remove("pb-stock-focus");

              onEditProduct?.(product);
            }}
          >
            ✎ {isBangla ? "পণ্য সম্পাদনা" : "Edit product"}
          </button>

          <button
            type="button"
            className="pb-storefront-delete"
            style={{
              border: "1px solid #dc2626",
              background: "#dc2626",
              color: "#fff",
              borderRadius: 7,
              padding: "6px 9px",
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteProduct?.(product);
            }}
          >
            {isBangla ? "মুছে ফেলুন" : "Delete"}
          </button>
        </div>
      )}

      {/* PRODUCT INFO */}

      <div className="product-info">

        {/* PRODUCT TITLE */}

        <button
          type="button"
          className="product-title-button"
          onClick={(event) => {
            event.stopPropagation();
            onDetails?.(product);
          }}
        >
          <h3>{title}</h3>
        </button>

        {/* STOCK AND COUNTDOWN */}

        <div className="product-stock-offer-row">
          <div className="product-stock-text">
            {outOfStock ? (
              <span className="stock-unavailable">
                {isBangla ? "স্টক শেষ" : "Out of stock"}
              </span>
            ) : (
              <span className="stock-available">
                <span className="stock-dot" />
                {isBangla
                  ? `স্টকে আছে ${stock}টি`
                  : `${stock} available in stock`}
              </span>
            )}
          </div>

          {outOfStock &&
            !isAdmin &&
            String(user?.role || "").toLowerCase() !== "admin" &&
            user?.isAdmin !== true && (
            <NotifyMeButton
              product={product}
              lang={lang}
              user={user}
              compact
            />
          )}

          {hasActiveDiscount && hasValidDiscountPrice && (
            <div
              className="product-countdown"
              title={
                isBangla
                  ? "অফার শেষ হতে বাকি"
                  : "Time left on offer"
              }
              aria-label={`${
                isBangla
                  ? "অফার শেষ হতে বাকি"
                  : "Offer ends in"
              } ${countdownText}`}
            >
              <Clock3
                size={14}
                className="countdown-icon"
              />

              <span className="countdown-time">
                {countdownText}
              </span>
            </div>
          )}
        </div>

        {/* PRODUCT PRICE */}

        <div className="product-bottom">
          <div className="product-price-group">
            <strong>
              {formatPrice(displayPrice, lang)}
            </strong>

            {showOriginalPrice && (
              <>
                <del
                  className="product-original-price"
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                  }}
                >
                  {formatPrice(originalPrice, lang)}
                </del>

                {(
                  formatPrice(originalPrice, lang).match(/\d/g) || []
                ).length > 4 && (
                  <span
                    className="original-price-dots"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                )}
              </>
            )}
          </div>

          {/* PRODUCT ACTIONS */}

          <div
            className={`product-actions ${
              isStaff ? "product-actions--staff" : ""
            }`}
          >
            <button
              type="button"
              className="details-mini"
              onClick={(event) => {
                event.stopPropagation();
                onDetails?.(product);
              }}
              aria-label={detailsLabel}
              title={detailsLabel}
            >
              <ArrowRight
                size={16}
                className="details-mini-arrow"
              />
            </button>

            {canUseWishlist && (
              <button
                type="button"
                className={`favorite-button ${
                  isFavorite ? "is-favorite" : ""
                }`}
                aria-label={wishlistLabel}
                aria-pressed={isFavorite}
                title={wishlistLabel}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFavorite?.(product.id);
                }}
              >
                <Heart
                  size={18}
                  fill={isFavorite ? "#ef4444" : "none"}
                  color={
                    isFavorite
                      ? "#ef4444"
                      : "currentColor"
                  }
                  strokeWidth={2}
                />
              </button>
            )}

            {!isStaff && (
              <button
                type="button"
                className="round-arrow"
                aria-label={cartLabel}
                title={cartLabel}
                disabled={
                  outOfStock ||
                  (!hasPriceOptions && qty >= stock)
                }
                onClick={handleAdd}
              >
                {qty > 0 && !outOfStock && !hasPriceOptions ? (
                  <span className="add-count">
                    {qty}
                  </span>
                ) : (
                  <Plus size={18} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}


