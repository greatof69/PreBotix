
import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  ShoppingCart,
  Truck,
  ChevronRight,
  Plus,
  Minus,
  ArrowLeft,
  PackageCheck,
  Star,
  Shield,
  ShieldCheck,
} from "lucide-react";

import {
  getTitle,
  getDescription,
  categoryLabel,
  productType,
} from "../utils/productHelpers";

import { formatPrice } from "../utils/formatPrice";
import { products as defaultProducts } from "../data/products";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export default function ProductDetails({
  product,
  products: liveProducts = defaultProducts,
  lang = "en",
  t = {},
  onBack,
  onAdd,
  onSelect,
  qty = 0,
  user,
  isAdmin = false,
  isModerator = false,
}) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState("description");
  const [selectedOptionId, setSelectedOptionId] = useState("");

  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({
    x: 50,
    y: 50,
  });

  const imageWrapRef = useRef(null);

  useEffect(() => {
    setQuantity(1);
    setActiveImage(0);
    setActiveTab("description");
    setSelectedOptionId("");
    setIsZooming(false);
    setZoomPosition({ x: 50, y: 50 });
  }, [product?.id]);

  const role = String(user?.role || "").toLowerCase();

  const adminView =
    isAdmin || role === "admin" || user?.isAdmin === true;

  const moderatorView =
    isModerator || role === "moderator";

  const canAddToCart = !adminView && !moderatorView;
  const isBn = lang === "bn";

  console.log("PRODUCT DETAILS OPTION DEBUG:", {
  id: product?.id,
  enabled: product?.priceOptionsEnabled,
  title: product?.priceOptionsTitle,
  options: product?.priceOptions,
});

  // CUSTOMER PRICE OPTIONS
  const priceOptionsEnabled =
    product?.priceOptionsEnabled === true;

  const priceOptions = Array.isArray(product?.priceOptions)
    ? product.priceOptions.filter((option) => {
        if (
          !option ||
          typeof option.id !== "string" ||
          !option.id.trim() ||
          typeof option.text !== "string"
        ) {
          return false;
        }

        const price = Number(option.price);

        return (
          option.price !== "" &&
          option.price !== null &&
          option.price !== undefined &&
          Number.isFinite(price) &&
          price >= 0
        );
      })
    : [];

  const selectedOption = priceOptionsEnabled
    ? priceOptions.find(
        (option) => option.id === selectedOptionId
      ) || null
    : null;

  const selectedFinalPrice = selectedOption
    ? Number(selectedOption.price)
    : null;

  // PRODUCT STOCK
  const stock = Math.max(0, Number(product?.stock) || 0);
  const cartQty = Math.max(0, Number(qty) || 0);
  const remaining = Math.max(0, stock - cartQty);

  const title = product ? getTitle(product, lang) : "";

  const description = product
    ? getDescription(product, lang)
    : "";

  const soldOut = t.soldOut || (isBn ? "স্টক শেষ" : "Sold out");

  // NORMAL PRODUCT SELLING PRICE
  const sellMin = Math.max(0, Number(product?.price) || 0);
  const sellMaxValue = Number(product?.priceMax);

  const hasSellRange =
    Number.isFinite(sellMaxValue) &&
    sellMaxValue > sellMin;

  // NORMAL PRODUCT ORIGINAL PRICE
  const originalMinValue = Number(product?.oldPrice);
  const originalMaxValue = Number(product?.oldPriceMax);

  const hasOriginalMin =
    product?.oldPrice !== undefined &&
    product?.oldPrice !== null &&
    product?.oldPrice !== "" &&
    Number.isFinite(originalMinValue) &&
    originalMinValue > 0;

  const hasOriginalRange =
    hasOriginalMin &&
    Number.isFinite(originalMaxValue) &&
    originalMaxValue >= originalMinValue;

  const hasSingleOriginal =
    hasOriginalMin &&
    originalMinValue > sellMin;

  const displayOriginalRange = hasOriginalRange;

  const displaySingleOriginal =
    !hasOriginalRange && hasSingleOriginal;

  // --------------------------------------------------
  // PRICE OPTIONS ORIGINAL PRICE CALCULATION
  // --------------------------------------------------

  // Read originalPrice directly from the saved option.
  const getOptionOriginalPrice = (option) => {
    const rawOriginal = option?.originalPrice;

    if (
      rawOriginal === undefined ||
      rawOriginal === null ||
      String(rawOriginal).trim() === ""
    ) {
      return null;
    }

    const original = Number(rawOriginal);

    return Number.isFinite(original) && original > 0
      ? original
      : null;
  };

  // Create selling/original price pairs.
  const validOptionPairs = priceOptions
    .map((option) => {
      const selling = Number(option.price);
      const original = getOptionOriginalPrice(option);

      return {
        id: option.id,
        text: option.text,
        selling,
        original:
          original !== null && original > selling
            ? original
            : null,
      };
    })
    .filter(
      (option) =>
        Number.isFinite(option.selling) &&
        option.selling >= 0
    )
    .sort((a, b) => a.selling - b.selling);

  // Lowest and highest selling price.
  const optionMinPrice = validOptionPairs.length
    ? validOptionPairs[0].selling
    : sellMin;

  const optionMaxPrice = validOptionPairs.length
    ? validOptionPairs[validOptionPairs.length - 1].selling
    : sellMin;

  // Only include original prices that are higher than
  // their corresponding option selling prices.
  const optionOriginalPairs = validOptionPairs.filter(
    (option) =>
      option.original !== null &&
      option.original > option.selling
  );

  const optionOriginalPrices = optionOriginalPairs.map(
    (option) => option.original
  );

  const hasOptionOriginalRange =
    priceOptionsEnabled &&
    optionOriginalPrices.length > 0;

  const minOptionOriginal = hasOptionOriginalRange
    ? Math.min(...optionOriginalPrices)
    : null;

  const maxOptionOriginal = hasOptionOriginalRange
    ? Math.max(...optionOriginalPrices)
    : null;

  // Get the original price of the currently selected option.
  const selectedOptionPriceData = selectedOption
    ? validOptionPairs.find(
        (option) => option.id === selectedOption.id
      ) || null
    : null;

  const selectedOriginalPrice =
    selectedOptionPriceData?.original ?? null;

  const hasSelectedOriginalPrice =
    selectedOriginalPrice !== null &&
    selectedOriginalPrice >
      (selectedOptionPriceData?.selling ?? 0);

  // MULTIPLIER
  const displayMultiplier =
    adminView || moderatorView ? quantity : 1;

  // RELATED PRODUCTS
  const otherProducts = (
    Array.isArray(liveProducts) ? liveProducts : []
  ).filter(
    (item) => item && item.id !== product?.id
  );

  // IMAGE URL
  const imageSrc = (image, width = 900) => {
    const value = String(image || "").trim();

    if (!value) {
      return `https://placehold.co/${width}x700?text=PreBotix`;
    }

    if (/^(https?:|data:|blob:)/i.test(value)) {
      return value;
    }

    if (value.startsWith("/")) {
      return `${API}${value}`;
    }

    return `https://images.unsplash.com/${value}?auto=format&fit=crop&w=${width}&q=82`;
  };

  // PRODUCT GALLERY
  const gallery = (() => {
    if (!product) return [];

    const uploadedImages = Array.isArray(product.images)
      ? product.images
      : [];

    const images = [
      product.image,
      ...uploadedImages,
    ]
      .map((image) =>
        typeof image === "string"
          ? image
          : image?.url || image?.image
      )
      .filter(Boolean);

    return [...new Set(images)].map((image, index) => ({
      id: `${product.id}-${index}`,
      image,
    }));
  })();

  // RELATED PRODUCTS
  const related = [...otherProducts]
    .sort((a, b) => {
      if (
        a.category === product?.category &&
        b.category !== product?.category
      ) {
        return -1;
      }

      if (
        a.category !== product?.category &&
        b.category === product?.category
      ) {
        return 1;
      }

      return 0;
    })
    .slice(0, 4);

  // SPECIFICATIONS
  const specifications = product
    ? [
        [
          isBn ? "ক্যাটাগরি" : "Category",
          categoryLabel(product.category, lang),
        ],
        [
          isBn ? "পণ্যের ধরন" : "Product type",
          productType(product.category, lang),
        ],
        [
          isBn ? "স্টকের অবস্থা" : "Availability",
          stock > 0
            ? isBn
              ? "স্টকে আছে"
              : "In stock"
            : soldOut,
        ],
        [
          isBn ? "ব্যবহারের ক্ষেত্র" : "Recommended for",
          isBn
            ? "শিক্ষার্থী, মেকার ও রোবোটিক্স প্রজেক্ট"
            : "Students, makers and robotics projects",
        ],
        [
          isBn ? "ডেলিভারি" : "Delivery",
          isBn
            ? "ঠিকানা অনুযায়ী নিশ্চিত করা হবে"
            : "Confirmed after address review",
        ],
      ]
    : [];

  // FORMAT PRICE RANGE
  const formatRange = (min, max) => {
    const minValue = Number(min);
    const maxValue = Number(max);

    if (
      max === undefined ||
      max === null ||
      max === "" ||
      !Number.isFinite(maxValue) ||
      maxValue <= minValue
    ) {
      return formatPrice(minValue || 0, lang);
    }

    return `${formatPrice(minValue, lang)} – ${formatPrice(
      maxValue,
      lang
    )}`;
  };

  // IMAGE ZOOM
  const handleImageMouseMove = (event) => {
    if (!imageWrapRef.current) return;

    const rect = imageWrapRef.current.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setZoomPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const handleImageMouseLeave = () => {
    setIsZooming(false);
    setZoomPosition({ x: 50, y: 50 });
  };

  function goBack() {
  if (typeof onBack === "function") {
    onBack();
  } else {
    window.location.assign("/");
  }
}

  // ADD TO CART
  // Existing cart logic preserved.
  const handleAddToCart = () => {
    if (typeof onAdd !== "function") return;

    if (remaining < 1 || quantity > remaining) return;

    if (priceOptionsEnabled && !selectedOption) return;

    const optionSnapshot = selectedOption
      ? {
          optionId: selectedOption.id,
          groupTitle: product.priceOptionsTitle || "",
          optionText: selectedOption.text,
          selectedPrice: selectedFinalPrice,
          selectedOriginalPrice: hasSelectedOriginalPrice
            ? selectedOriginalPrice
            : null,
        }
      : null;

    onAdd(product, quantity, optionSnapshot);

    setQuantity(1);
  };

  if (!product) {
    return (
      <section className="product-detail-page">
        <button
          type="button"
          className="back-link"
          onClick={goBack}
        >
          <ArrowLeft size={16} />
          {isBn ? "সব পণ্যে ফিরে যান" : "Back to products"}
        </button>

        <h2>
          {isBn
            ? "পণ্যটি খুঁজে পাওয়া যায়নি"
            : "Product not found"}
        </h2>
      </section>
    );
  }

  // --------------------------------------------------
  // CURRENT SELLING PRICE DISPLAY
  // --------------------------------------------------

  const currentPriceText = selectedOption
    ? formatPrice(
        selectedFinalPrice * displayMultiplier,
        lang
      )
    : priceOptionsEnabled && validOptionPairs.length > 0
      ? formatRange(
          optionMinPrice * displayMultiplier,
          optionMaxPrice * displayMultiplier
        )
      : hasSellRange
        ? formatRange(
            sellMin * displayMultiplier,
            sellMaxValue * displayMultiplier
          )
        : formatPrice(
            sellMin * displayMultiplier,
            lang
          );

  // EXISTING CART BUTTON PRICE LOGIC
  const cartButtonPrice = selectedOption
    ? selectedFinalPrice * quantity
    : optionMinPrice * quantity;

  const canPurchase =
    remaining > 0 &&
    quantity <= remaining &&
    (
      !priceOptionsEnabled ||
      Boolean(selectedOption)
    );

  return (
    <section className="product-detail-page">
      <button
        type="button"
        className="back-link"
        onClick={goBack}
      >
        <ArrowLeft size={16} />
        {isBn ? "সব পণ্যে ফিরে যান" : "Back to products"}
      </button>

      <div className="product-detail-layout">
        {/* PRODUCT GALLERY */}
        <div className="detail-gallery">
          <div
            className={`detail-image-wrap ${
              isZooming ? "image-zoom-active" : ""
            }`}
            ref={imageWrapRef}
            onMouseEnter={() => setIsZooming(true)}
            onMouseMove={handleImageMouseMove}
            onMouseLeave={handleImageMouseLeave}
          >
            <img
              className="detail-main-image"
              src={imageSrc(
                gallery[activeImage]?.image || product.image,
                1200
              )}
              alt={title}
              style={{
                transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
              }}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src =
                  "https://placehold.co/900x700?text=PreBotix";
              }}
            />

            <span className="detail-image-label">
              PREBOTIX / {isBn ? "পণ্য" : "PRODUCT"}{" "}
              {String(product.id ?? "").padStart(3, "0")}
            </span>
          </div>

          {gallery.length > 1 && (
            <div
              className="detail-thumbnails"
              aria-label={
                isBn ? "পণ্যের ছবি" : "Product image gallery"
              }
            >
              {gallery.map((item, index) => (
                <button
                  type="button"
                  key={item.id ?? index}
                  className={
                    activeImage === index
                      ? "detail-thumb active"
                      : "detail-thumb"
                  }
                  onClick={() => setActiveImage(index)}
                  aria-label={`${isBn ? "ছবি" : "Image"} ${
                    index + 1
                  }`}
                  aria-pressed={activeImage === index}
                >
                  <img
                    src={imageSrc(item.image, 220)}
                    alt={`${title} ${index + 1}`}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src =
                        "https://placehold.co/220x180?text=Product";
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PRODUCT INFORMATION */}
        <div className="detail-copy">
          <div className="detail-breadcrumb">
            <button type="button" onClick={goBack}>
              {isBn ? "হোম" : "HOME"}
            </button>

            <ChevronRight size={12} />

            <button type="button" onClick={goBack}>
              {isBn ? "শপ" : "SHOP"}
            </button>

            <ChevronRight size={12} />

            {categoryLabel(product.category, lang)}
          </div>

          <span className="section-kicker">
            {categoryLabel(product.category, lang)}
          </span>

          <h1 className="detail-title">{title}</h1>

          <div className="detail-rating">
            <span className="stars" aria-label="5 stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} />
              ))}
            </span>

            <span>
              {isBn
                ? "মেকারদের পছন্দ · নমুনা রেটিং"
                : "Maker favourite · demo rating"}
            </span>
          </div>

          {/* PRICE DISPLAY */}
          <div className="detail-price">
            <span>{currentPriceText}</span>

            {priceOptionsEnabled ? (
              selectedOption ? (
                hasSelectedOriginalPrice ? (
                  <del>
                    {formatPrice(
                      selectedOriginalPrice * displayMultiplier,
                      lang
                    )}
                  </del>
                ) : null
              ) : hasOptionOriginalRange ? (
                <del>
                  {formatRange(
                    minOptionOriginal * displayMultiplier,
                    maxOptionOriginal * displayMultiplier
                  )}
                </del>
              ) : displayOriginalRange ? (
                <del>
                  {formatRange(
                    originalMinValue * displayMultiplier,
                    originalMaxValue * displayMultiplier
                  )}
                </del>
              ) : displaySingleOriginal ? (
                <del>
                  {formatPrice(
                    originalMinValue * displayMultiplier,
                    lang
                  )}
                </del>
              ) : null
            ) : displayOriginalRange ? (
              <del>
                {formatRange(
                  originalMinValue * displayMultiplier,
                  originalMaxValue * displayMultiplier
                )}
              </del>
            ) : displaySingleOriginal ? (
              <del>
                {formatPrice(
                  originalMinValue * displayMultiplier,
                  lang
                )}
              </del>
            ) : null}
          </div>

          {/* CUSTOMER PRICE OPTIONS */}
          {priceOptionsEnabled && priceOptions.length > 0 && (
            <div className="detail-price-options">
              <div className="detail-option-title-wrap">
                <div className="detail-option-title-icon">
                  <PackageCheck size={18} />
                </div>

                <div className="detail-option-title-content">
                  <div
                    className="detail-option-heading"
                    style={{
                      display: "block",
                      visibility: "visible",
                      opacity: 1,
                      color: "#00c9f5",
                      fontSize: "16px",
                      fontWeight: 800,
                      minHeight: "22px",
                    }}
                  >
                    {String(product?.priceOptionsTitle || "TITLE NOT FOUND")}
                  </div>

                  <span className="detail-option-subtitle">
                    {isBn
                      ? "আপনার প্রয়োজন অনুযায়ী একটি অপশন বেছে নিন"
                      : "Select the option that best fits your needs"}
                  </span>
                </div>

                <span className="detail-option-required">
                  {isBn ? "আবশ্যক" : "REQUIRED"}
                </span>
              </div>

              <select
                id="prebotix-price-option"
                className="detail-option-select"
                value={selectedOptionId}
                onChange={(event) =>
                  setSelectedOptionId(event.target.value)
                }
              >
                <option value="">
                  {isBn
                    ? "একটি অপশন নির্বাচন করুন"
                    : "Select an option"}
                </option>

                {priceOptions.map((option) => {
                  const optionPrice = Number(option.price);
                  const optionOriginal =
                    getOptionOriginalPrice(option);

                  const showOriginal =
                    optionOriginal !== null &&
                    optionOriginal > optionPrice;

                  return (
                    <option
                      key={option.id}
                      value={option.id}
                    >
                      {option.text} — {formatPrice(optionPrice, lang)}
                    </option>
                  );
                })}
              </select>

              {selectedOption && (
                <p className="detail-selected-option flex items-center gap-1">
                  <ShieldCheck size={15} />

                  {isBn
                    ? "নির্বাচিত অপশন:"
                    : "Selected option:"}{" "}

                  <strong>{selectedOption.text}</strong>

                </p>
              )}

              {!selectedOption && (
                <small className="detail-option-hint">
                  {isBn
                    ? "দাম নিশ্চিত করতে এবং কার্টে যোগ করতে একটি অপশন নির্বাচন করুন।"
                    : "Select an option to confirm the final price and add this product to cart."}
                </small>
              )}
            </div>
          )}

          {priceOptionsEnabled && priceOptions.length === 0 && (
            <p className="detail-option-hint">
              {isBn
                ? "এই পণ্যের অপশন এখনো যোগ করা হয়নি।"
                : "Options for this product are not available yet."}
            </p>
          )}

          <p
            className="detail-description"
            style={{ whiteSpace: "pre-line" }}
          >
            {description}
          </p>

          <div className="detail-stock">
            <span className="stock-pulse" />

            {stock > 0
              ? `${stock} ${
                  isBn ? "টি স্টকে আছে" : "available in stock"
                }`
              : soldOut}
          </div>

          {/* QUANTITY */}
          <div className="detail-quantity">
            <span>
              {t.quantity || (isBn ? "পরিমাণ" : "Quantity")}
            </span>

            <div>
              <button
                type="button"
                onClick={() =>
                  setQuantity((value) => Math.max(1, value - 1))
                }
                aria-label={
                  t.decreaseQty ||
                  (isBn ? "পরিমাণ কমান" : "Decrease quantity")
                }
              >
                <Minus size={15} />
              </button>

              <strong>{quantity}</strong>

              <button
                type="button"
                onClick={() =>
                  setQuantity((value) =>
                    adminView || moderatorView
                      ? value + 1
                      : Math.min(
                          Math.max(1, remaining),
                          value + 1
                        )
                  )
                }
                disabled={
                  !adminView &&
                  !moderatorView &&
                  quantity >= remaining
                }
                aria-label={
                  t.increaseQty ||
                  (isBn ? "পরিমাণ বাড়ান" : "Increase quantity")
                }
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* ADD TO CART */}
          {canAddToCart && (
            <button
              type="button"
              className="button button-primary detail-add-button"
              disabled={!canPurchase}
              onClick={handleAddToCart}
            >
              <ShoppingCart size={17} />

              {isBn ? "কার্টে যোগ করুন" : "Add to cart"}
              {" · "}

              {selectedOption
                ? formatPrice(cartButtonPrice, lang)
                : priceOptionsEnabled && priceOptions.length > 0
                  ? formatRange(optionMinPrice, optionMaxPrice)
                  : hasSellRange
                    ? formatRange(sellMin, sellMaxValue)
                    : formatPrice(cartButtonPrice, lang)}
            </button>
          )}

          {/* SERVICE INFORMATION */}
          <div className="detail-service-box">
            <div>
              <ShieldCheck />

              <span>
                <strong>
                  {isBn ? "যাচাইকৃত পণ্য" : "Quality checked"}
                </strong>

                <small>
                  {isBn
                    ? "কেনার আগে পণ্যের বিবরণ যাচাই করুন"
                    : "Check product details before purchase"}
                </small>
              </span>
            </div>

            <div>
              <Truck />

              <span>
                <strong>
                  {isBn
                    ? "সারা বাংলাদেশে ডেলিভারি"
                    : "Nationwide delivery"}
                </strong>

                <small>
                  {isBn
                    ? "ঠিকানা অনুযায়ী ডেলিভারি চার্জ"
                    : "Shipping based on address"}
                </small>
              </span>
            </div>

            <div>
              <Shield />

              <span>
                <strong>
                  {isBn ? "মেকার সাপোর্ট" : "Maker support"}
                </strong>

                <small>
                  {isBn
                    ? "প্রজেক্টে সহায়তা"
                    : "Help for your build"}
                </small>
              </span>
            </div>

            <div>
              <PackageCheck />

              <span>
                <strong>
                  {isBn ? "অর্ডারের তথ্য" : "Order information"}
                </strong>

                <small>
                  {isBn
                    ? "চেকআউটে অর্ডারের তথ্য নিশ্চিত করুন"
                    : "Confirm order details at checkout"}
                </small>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCT INFORMATION */}
      <div className="detail-information">
        <div className="detail-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "description"}
            className={
              activeTab === "description" ? "active" : ""
            }
            onClick={() => setActiveTab("description")}
          >
            {isBn ? "বিবরণ" : "Description"}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "specifications"}
            className={
              activeTab === "specifications" ? "active" : ""
            }
            onClick={() => setActiveTab("specifications")}
          >
            {isBn ? "স্পেসিফিকেশন" : "Specifications"}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reviews"}
            className={
              activeTab === "reviews" ? "active" : ""
            }
            onClick={() => setActiveTab("reviews")}
          >
            {isBn ? "রিভিউ (০)" : "Reviews (0)"}
          </button>
        </div>

        {activeTab === "description" && (
          <div className="detail-tab-content">
            <h2>
              {isBn
                ? "পণ্যের বিস্তারিত তথ্য"
                : "Product Details"}
            </h2>

            <p
              className="product-full-description"
              style={{ whiteSpace: "pre-line" }}
            >
              {(
                isBn
                  ? product.detailsBn || product.bnDetails
                  : product.details || product.fullDescription
              ) ||
                (isBn
                  ? "এই পণ্যের বিস্তারিত তথ্য শিগগিরই যোগ করা হবে।"
                  : "Detailed information for this product will be added soon.")}
            </p>

            <div className="detail-note">
              <ShieldCheck size={18} />

              <span>
                {isBn
                  ? "অর্ডার করার আগে পণ্যের দাম, স্টক ও বৈশিষ্ট্য যাচাই করুন।"
                  : "Please verify the price, stock and specifications before ordering."}
              </span>
            </div>
          </div>
        )}

        {activeTab === "specifications" && (
          <div className="detail-tab-content">
            <h2>
              {isBn ? "স্পেসিফিকেশন" : "Specifications"}
            </h2>

            <div className="specification-table">
              {specifications.map(([label, value]) => (
                <div
                  className="specification-row"
                  key={label}
                >
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="detail-tab-content review-empty">
            <Star size={25} />

            <h2>
              {isBn
                ? "এখনো কোনো রিভিউ নেই"
                : "No reviews yet"}
            </h2>

            <p>
              {isBn
                ? "রিভিউ ফিচার চালু হলে এখানে ক্রেতাদের মতামত দেখা যাবে।"
                : "Customer reviews will appear here once the review feature is connected."}
            </p>
          </div>
        )}
      </div>

      {/* RELATED PRODUCTS */}
      {related.length > 0 && (
        <section className="related-products">
          <div className="related-heading">
            <div>
              <span className="section-kicker">
                {isBn
                  ? "আপনার পছন্দ হতে পারে"
                  : "YOU MAY ALSO LIKE"}
              </span>

              <h2>
                {isBn
                  ? "সম্পর্কিত পণ্য"
                  : "Related products"}
              </h2>
            </div>

            <button
              type="button"
              className="text-link"
              onClick={goBack}
            >
              {isBn ? "সব পণ্য দেখুন" : "Shop all products"}
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="related-grid">
            {related.map((item) => (
              <article
                className="related-card"
                key={item.id}
              >
                <img
                  src={imageSrc(item.image, 450)}
                  alt={getTitle(item, lang)}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src =
                      "https://placehold.co/450x350?text=Product";
                  }}
                />

                <span>
                  {categoryLabel(item.category, lang)}
                </span>

                <h3>{getTitle(item, lang)}</h3>

                <strong>
                  {formatPrice(item.price, lang)}
                </strong>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    if (typeof onSelect === "function") {
                      setActiveImage(0);
                      setActiveTab("description");
                      setQuantity(1);
                      setSelectedOptionId("");
                      onSelect(item);
                    }
                  }}
                >
                  {isBn ? "পণ্য দেখুন" : "View product"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
