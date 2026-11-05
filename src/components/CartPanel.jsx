
import {
  ArrowRight,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
} from "lucide-react";

import { formatPrice } from "../utils/formatPrice";

export default function CartPanel({
  items = [],
  lang = "en",
  t = {},
  onClose,
  onQuantity,
  onRemove,
  onCheckout,
}) {
  const isBn = lang === "bn";

  // Selected option price is the final unit price.
  const getItemPrice = (item) => {
    const selectedOption = item.selectedPriceOption;

    if (selectedOption?.optionId) {
      const selectedPrice = Number(
        selectedOption.selectedPrice
      );

      if (
        Number.isFinite(selectedPrice) &&
        selectedPrice >= 0
      ) {
        return selectedPrice;
      }
    }

    return Math.max(0, Number(item.price) || 0);
  };

  // Keep different selected options as separate cart items.
  const getCartKey = (item) =>
    item.cartKey ||
    `${item.id}:${item.selectedPriceOption?.optionId || "default"}`;

  const getQuantity = (item) =>
    Math.max(0, Number(item.quantity) || 0);

  const subtotal = items.reduce(
    (sum, item) =>
      sum + getItemPrice(item) * getQuantity(item),
    0
  );

  const totalQuantity = items.reduce(
    (sum, item) => sum + getQuantity(item),
    0
  );

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <aside
        className="cart-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t.yourCart || (isBn ? "আপনার কার্ট" : "Your cart")}
      >
        <div className="panel-heading">
          <div>
            <span className="section-kicker">
              PREBOTIX / {isBn ? "কার্ট" : "BAG"}
            </span>

            <h2>
              {t.yourCart || (isBn ? "আপনার কার্ট" : "Your Cart")}{" "}
              <span className="panel-count">
                ({totalQuantity})
              </span>
            </h2>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label={t.close || (isBn ? "বন্ধ করুন" : "Close")}
          >
            <X />
          </button>
        </div>

        {!items.length ? (
          <div className="cart-empty">
            <span className="empty-cart-icon">
              <ShoppingCart size={30} />
            </span>

            <h3>
              {t.cartEmpty || (isBn ? "কার্ট খালি" : "Your cart is empty")}
            </h3>

            <p>
              {t.cartEmptyText ||
                (isBn
                  ? "আপনার পছন্দের পণ্য কার্টে যোগ করুন।"
                  : "Add products to your cart to get started.")}
            </p>

            <button
              type="button"
              className="button button-primary"
              onClick={onClose}
            >
              {t.browse || (isBn ? "পণ্য দেখুন" : "Browse products")}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => {
                const itemPrice = getItemPrice(item);
                const quantity = getQuantity(item);
                const selectedOption = item.selectedPriceOption;
                const cartKey = getCartKey(item);

                const image = String(item.image || "").trim();

                const apiBase = (
                  import.meta.env.VITE_API_URL ||
                  "http://localhost:5000"
                ).replace(/\/api\/?$/, "");

                const imageSrc = /^https?:\/\//i.test(image)
                  ? image
                  : image.startsWith("/")
                    ? `${apiBase}${image}`
                    : image
                      ? `https://images.unsplash.com/${image}?auto=format&fit=crop&w=240&q=75`
                      : "https://placehold.co/240x180?text=Product";

                const productTitle = isBn
                  ? item.bn || item.title
                  : item.title || item.name;

                return (
                  <div className="cart-line" key={cartKey}>
                    <img
                      src={imageSrc}
                      alt={productTitle || "Product"}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src =
                          "https://placehold.co/240x180?text=Product";
                      }}
                    />

                    <div className="cart-line-info">
                      <h3>{productTitle}</h3>

                      {/* Selected option name only. */}
                      {selectedOption?.optionId && (
                        <div className="cart-selected-option">
                          <span>
                            {selectedOption.groupTitle ||
                              (isBn
                                ? "নির্বাচিত অপশন"
                                : "Selected option")}
                            :
                          </span>

                          <strong>
                            {selectedOption.optionText}
                          </strong>
                        </div>
                      )}

                      {/* One final unit price only. */}
                      <strong className="cart-item-price">
                        {formatPrice(itemPrice, lang)}
                      </strong>

                      <div className="quantity-control">
                        <button
                          type="button"
                          aria-label={
                            t.decreaseQty ||
                            (isBn ? "পরিমাণ কমান" : "Decrease quantity")
                          }
                          disabled={quantity <= 1}
                          onClick={() =>
                            onQuantity?.(cartKey, -1)
                          }
                        >
                          <Minus size={13} />
                        </button>

                        <span>{quantity}</span>

                        <button
                          type="button"
                          aria-label={
                            t.increaseQty ||
                            (isBn ? "পরিমাণ বাড়ান" : "Increase quantity")
                          }
                          disabled={
                            quantity >=
                            Math.max(0, Number(item.stock) || 0)
                          }
                          onClick={() =>
                            onQuantity?.(cartKey, 1)
                          }
                        >
                          <Plus size={13} />
                        </button>

                        <button
                          type="button"
                          className="remove-item"
                          aria-label={
                            t.remove || (isBn ? "সরান" : "Remove")
                          }
                          title={
                            t.remove || (isBn ? "সরান" : "Remove")
                          }
                          onClick={() => onRemove?.(cartKey)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Final line total. */}
                    <strong className="line-total">
                      {formatPrice(
                        itemPrice * quantity,
                        lang
                      )}
                    </strong>
                  </div>
                );
              })}
            </div>

            <div className="cart-summary">
              <div>
                <span>
                  {t.subtotal || (isBn ? "সাবটোটাল" : "Subtotal")}
                </span>

                <strong>
                  {formatPrice(subtotal, lang)}
                </strong>
              </div>

              <div>
                <span>
                  {t.delivery || (isBn ? "ডেলিভারি" : "Delivery")}
                </span>

                <span>
                  {t.shippingEstimate ||
                    (isBn ? "চেকআউটে নির্ধারিত হবে" : "Calculated at checkout")}
                </span>
              </div>

              <p>
                {t.deliveryNote ||
                  (isBn
                    ? "ডেলিভারি চার্জ ঠিকানা অনুযায়ী নির্ধারণ করা হবে।"
                    : "Delivery charge will be calculated based on your address.")}
              </p>

              <div className="summary-total">
                <span>
                  {t.total || (isBn ? "সর্বমোট" : "Total")}
                </span>

                <strong>
                  {formatPrice(subtotal, lang)}*
                </strong>
              </div>

              <button
                type="button"
                className="button button-primary checkout-button"
                onClick={onCheckout}
              >
                {t.proceed ||
                  (isBn ? "চেকআউট করুন" : "Proceed to checkout")}
                <ArrowRight size={17} />
              </button>

              <button
                type="button"
                className="continue-button"
                onClick={onClose}
              >
                <ArrowLeft size={15} />

                {t.continue ||
                  (isBn ? "কেনাকাটা চালিয়ে যান" : "Continue shopping")}
              </button>

              <small>
                * {t.demoWarning || ""}
              </small>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
