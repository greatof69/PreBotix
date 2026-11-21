
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  X,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { formatPrice } from "../utils/formatPrice";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function CheckoutPanel({
  items = [],
  lang,
  t,
  onBack,
  onComplete,
}) {
  const bn = lang === "bn";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    note: "",
    payment: "cod",
    deliveryZone: "",
    paymentSenderNumber: "",
    paymentTransactionId: "",
  });

  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected option price is the final price.
  // It replaces the base price; it is never added to it.
  const getItemPrice = (item) => {
    const selectedPrice = Number(
      item.selectedPriceOption?.selectedPrice
    );

    if (
      item.selectedPriceOption?.optionId &&
      Number.isFinite(selectedPrice) &&
      selectedPrice >= 0
    ) {
      return selectedPrice;
    }

    return Number(item.price) || 0;
  };

  const getCartKey = (item) =>
    item.cartKey ||
    `${item.id}:${item.selectedPriceOption?.optionId || "default"}`;

  // Load active payment methods and delivery zones.
  useEffect(() => {
    const controller = new AbortController();

    async function loadSettings() {
      setSettingsLoading(true);
      setSettingsError("");

      try {
        const response = await fetch(
          `${API}/api/storefront-settings`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("SETTINGS_LOAD_FAILED");
        }

        const result = await response.json();

        const storefront =
          result?.settings ||
          result?.storefront ||
          result;

        const config = storefront?.paymentDelivery;

        if (!config) {
          throw new Error("SETTINGS_NOT_CONFIGURED");
        }

        const methods = (
          config.paymentMethods || []
        ).filter(
          (method) =>
            method.enabled === true &&
            ["cod", "manual", "online"].includes(method.type)
        );

        const zones = (
          config.deliveryZones || []
        ).filter((zone) => zone.enabled === true);

        if (!methods.length || !zones.length) {
          throw new Error("NO_ACTIVE_OPTIONS");
        }

        setSettings({
          ...config,
          paymentMethods: methods,
          deliveryZones: zones,
        });

        setForm((previous) => {
          const currentMethodExists = methods.some(
            (method) => method.id === previous.payment
          );

          const currentZoneExists = zones.some(
            (zone) => zone.id === previous.deliveryZone
          );

          return {
            ...previous,

            payment: currentMethodExists
              ? previous.payment
              : methods.find(
                  (method) => method.type === "cod"
                )?.id || methods[0].id,

            deliveryZone: currentZoneExists
              ? previous.deliveryZone
              : zones[0].id,
          };
        });
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error("Checkout settings error:", err);

        setSettingsError(
          bn
            ? "পেমেন্ট ও ডেলিভারি সেটিংস লোড করা যায়নি। আবার চেষ্টা করুন।"
            : "Could not load payment and delivery settings. Please try again."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSettingsLoading(false);
        }
      }
    }

    loadSettings();

    return () => controller.abort();
  }, [bn]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          getItemPrice(item) *
            Number(item.quantity || 0),
        0
      ),
    [items]
  );

  const selectedMethod =
    settings?.paymentMethods?.find(
      (method) => method.id === form.payment
    );

  const selectedZone =
    settings?.deliveryZones?.find(
      (zone) => zone.id === form.deliveryZone
    );

  const selectedPaymentId = String(
    selectedMethod?.id || ""
  ).toLowerCase();

  const isManualWalletPayment = [
    "bkash",
    "nagad",
  ].includes(selectedPaymentId);

  const charges = useMemo(() => {
    const threshold = Number(
      settings?.freeDeliveryThreshold || 0
    );

    const zoneFee = Number(selectedZone?.fee || 0);

    const configuredCodFee = Number(
      settings?.codFee || 0
    );

    const freeDelivery =
      threshold > 0 && subtotal >= threshold;

    const deliveryFee = freeDelivery ? 0 : zoneFee;

    const codFee =
      selectedMethod?.type === "cod"
        ? configuredCodFee
        : 0;

    return {
      freeDelivery,
      deliveryFee,
      codFee,
      total: subtotal + deliveryFee + codFee,
    };
  }, [settings, selectedZone, selectedMethod, subtotal]);

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const getMethodName = (method) =>
    bn
      ? method.nameBn || method.name || method.id
      : method.name || method.nameBn || method.id;

  const getZoneName = (zone) =>
    bn
      ? zone.nameBn || zone.name || zone.id
      : zone.name || zone.nameBn || zone.id;

  const getMethodDescription = (method) =>
    bn
      ? method.descriptionBn || method.description || ""
      : method.description || method.descriptionBn || "";

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    if (!items.length) {
      setError(
        bn ? "আপনার কার্ট খালি।" : "Your cart is empty."
      );
      return;
    }

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.address.trim() ||
      !form.city.trim()
    ) {
      setError(
        t?.required ||
          (bn
            ? "প্রয়োজনীয় তথ্য পূরণ করুন।"
            : "Please fill in all required fields.")
      );
      return;
    }

    const phone = form.phone
      .trim()
      .replace(/[\s-]/g, "");

    if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(phone)) {
      setError(
        t?.phoneInvalid ||
          (bn
            ? "সঠিক বাংলাদেশি মোবাইল নম্বর দিন।"
            : "Enter a valid Bangladeshi mobile number.")
      );
      return;
    }

    const email = form.email.trim();

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError(
        t?.emailInvalid ||
          (bn
            ? "সঠিক ইমেইল ঠিকানা দিন।"
            : "Enter a valid email address.")
      );
      return;
    }

    if (settingsLoading || !settings) {
      setError(
        settingsError ||
          (bn
            ? "পেমেন্ট ও ডেলিভারি সেটিংস লোড হওয়া পর্যন্ত অপেক্ষা করুন।"
            : "Please wait for payment and delivery settings to load.")
      );
      return;
    }

    if (!selectedMethod || !selectedZone) {
      setError(
        bn
          ? "পেমেন্ট পদ্ধতি ও ডেলিভারি এলাকা নির্বাচন করুন।"
          : "Please select a payment method and delivery zone."
      );
      return;
    }

    if (selectedMethod.type === "online") {
      setError(
        bn
          ? "অনলাইন পেমেন্ট এখনো চালু হয়নি। অন্য পেমেন্ট পদ্ধতি বেছে নিন।"
          : "Online payment is not integrated yet. Please choose another method."
      );
      return;
    }

    let paymentSenderNumber = "";
    let paymentTransactionId = "";

    if (isManualWalletPayment) {
      if (selectedMethod.type !== "manual") {
        setError(
          bn
            ? "এই পেমেন্ট পদ্ধতির সেটিংস সঠিক নয়।"
            : "This payment method is not configured correctly."
        );
        return;
      }

      paymentSenderNumber = form.paymentSenderNumber
        .trim()
        .replace(/[\s-]/g, "");

      paymentTransactionId =
        form.paymentTransactionId.trim();

      if (!/^01[3-9]\d{8}$/.test(paymentSenderNumber)) {
        setError(
          bn
            ? "সঠিক ১১ সংখ্যার বাংলাদেশি sender number দিন।"
            : "Enter a valid 11-digit Bangladeshi sender number."
        );
        return;
      }

      if (
        paymentTransactionId.length < 5 ||
        paymentTransactionId.length > 100
      ) {
        setError(
          bn
            ? "Transaction ID অবশ্যই ৫ থেকে ১০০ অক্ষরের মধ্যে হতে হবে।"
            : "Transaction ID must be between 5 and 100 characters."
        );
        return;
      }
    }

    const invalidPrice = items.some((item) => {
  const option = item.selectedPriceOption;

  if (!option?.optionId) return false;

  const price = Number(option.selectedPrice);

  return !Number.isFinite(price) || price < 0;
});

if (invalidPrice) {
  setError(
    bn
      ? "একটি পণ্যের মূল্য সঠিক নয়। কার্টে ফিরে আবার চেষ্টা করুন।"
      : "An item's selected price is invalid. Please return to cart and try again."
  );
  return;
}

    // Every option-enabled cart line must contain a valid option ID.
    const invalidOption = items.some(
      (item) =>
        item.priceOptionsEnabled &&
        !item.selectedPriceOption?.optionId
    );

    if (invalidOption) {
      setError(
        bn
          ? "প্রতিটি পণ্যের জন্য একটি মূল্য অপশন নির্বাচন করুন।"
          : "Please select a price option for every applicable product."
      );
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await onComplete({
        form: {
          ...form,
          name: form.name.trim(),
          phone,
          email: email.toLowerCase(),
          address: form.address.trim(),
          city: form.city.trim(),
          note: form.note.trim(),
          payment: selectedMethod.id,
          deliveryZone: selectedZone.id,
          paymentSenderNumber,
          paymentTransactionId,
        },

        // Estimates only. The backend calculates
        // and validates the actual order total.
        subtotal,
        estimatedDeliveryFee: charges.deliveryFee,
        estimatedCodFee: charges.codFee,

        // Never send client-calculated product prices.
        // Backend identifies the option and reads its
        // actual final price from the database.
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          ...(item.selectedPriceOption?.optionId
            ? {
                priceOptionId:
                  item.selectedPriceOption.optionId,
              }
            : {}),
        })),
      });
    } catch (err) {
      console.error("Order submission error:", err);

      setError(
        err?.message ||
          (bn
            ? "অর্ডার তৈরি করা যায়নি। আবার চেষ্টা করুন।"
            : "Could not place your order. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const checkoutTitle =
    bn && settings?.checkoutTitleBn
      ? settings.checkoutTitleBn
      : settings?.checkoutTitle || t?.checkout || "Checkout";

  const checkoutInstructions =
    bn && settings?.checkoutInstructionsBn
      ? settings.checkoutInstructionsBn
      : settings?.checkoutInstructions || "";

  const selectedMethodInstructions = selectedMethod
    ? bn
      ? selectedMethod.instructionsBn ||
        selectedMethod.instructions ||
        ""
      : selectedMethod.instructions ||
        selectedMethod.instructionsBn ||
        ""
    : "";

  return (
    <div className="modal-backdrop checkout-backdrop">
      <section
        className="checkout-panel"
        role="dialog"
        aria-modal="true"
        aria-label={checkoutTitle}
      >
        <div className="panel-heading">
          <div>
            <span className="section-kicker">
              PREBOTIX / {bn ? "অর্ডার" : "ORDER"}
            </span>

            <h2>{checkoutTitle}</h2>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onBack}
            disabled={submitting}
            aria-label={t?.close || "Close"}
          >
            <X />
          </button>
        </div>

        <div className="checkout-columns">
          <form className="checkout-form" onSubmit={submit}>
            <h3>
              {t?.customer ||
                (bn ? "গ্রাহকের তথ্য" : "Customer details")}
            </h3>

            <div className="form-grid">
              <label>
                {t?.fullName || (bn ? "পূর্ণ নাম" : "Full name")} *
                <input
                  name="name"
                  value={form.name}
                  onChange={change}
                  autoComplete="name"
                  required
                  disabled={submitting}
                  placeholder={bn ? "আপনার নাম" : "Your name"}
                />
              </label>

              <label>
                {t?.phone || (bn ? "মোবাইল" : "Phone")} *
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={change}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  disabled={submitting}
                  placeholder="01XXXXXXXXX"
                />
              </label>

              <label className="full-field">
                {t?.email || "Email"}
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={change}
                  autoComplete="email"
                  disabled={submitting}
                  placeholder="you@example.com"
                />
              </label>

              <label className="full-field">
                {t?.address || (bn ? "ঠিকানা" : "Address")} *
                <textarea
                  name="address"
                  value={form.address}
                  onChange={change}
                  autoComplete="street-address"
                  required
                  disabled={submitting}
                  rows={3}
                  placeholder={
                    bn
                      ? "বাড়ি, রোড, এলাকা"
                      : "House, road, area"
                  }
                />
              </label>

              <label className="full-field">
                {t?.city || (bn ? "শহর" : "City")} *
                <input
                  name="city"
                  value={form.city}
                  onChange={change}
                  autoComplete="address-level2"
                  required
                  disabled={submitting}
                  placeholder={bn ? "ঢাকা" : "Dhaka"}
                />
              </label>

              <label className="full-field">
                {t?.note || (bn ? "নোট" : "Note")}
                <textarea
                  name="note"
                  value={form.note}
                  onChange={change}
                  disabled={submitting}
                  rows={2}
                  placeholder={
                    bn
                      ? "অতিরিক্ত নির্দেশনা"
                      : "Any delivery instructions"
                  }
                />
              </label>
            </div>

            <h3 className="payment-heading">
              {bn ? "ডেলিভারি এলাকা" : "Delivery area"}
            </h3>

            {settingsLoading ? (
              <p>
                {bn ? "সেটিংস লোড হচ্ছে..." : "Loading settings..."}
              </p>
            ) : (
              <div className="payment-options">
                {(settings?.deliveryZones || []).map((zone) => (
                  <label
                    className={
                      form.deliveryZone === zone.id
                        ? "payment-option selected"
                        : "payment-option"
                    }
                    key={zone.id}
                  >
                    <input
                      type="radio"
                      name="deliveryZone"
                      value={zone.id}
                      checked={form.deliveryZone === zone.id}
                      onChange={change}
                      disabled={submitting}
                    />

                    <span>
                      <strong>{getZoneName(zone)}</strong>
                      <small>
                        {formatPrice(Number(zone.fee || 0), lang)}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <h3 className="payment-heading">
              {t?.payment ||
                (bn ? "পেমেন্ট পদ্ধতি" : "Payment method")}
            </h3>

            {settings?.paymentMethods?.length > 0 ? (
              <div className="payment-options">
                {settings.paymentMethods.map((method) => {
                  const disabled =
                    submitting || method.type === "online";

                  return (
                    <label
                      className={
                        form.payment === method.id
                          ? "payment-option selected"
                          : "payment-option"
                      }
                      key={method.id}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={method.id}
                        checked={form.payment === method.id}
                        onChange={change}
                        disabled={disabled}
                      />

                      <span>
                        <strong>{getMethodName(method)}</strong>

                        <small>
                          {getMethodDescription(method) ||
                            (method.type === "online"
                              ? bn
                                ? "অনলাইন পেমেন্ট এখনো চালু হয়নি"
                                : "Online payment is not integrated yet"
                              : method.type === "cod"
                                ? bn
                                  ? "পণ্য হাতে পেয়ে পেমেন্ট করুন"
                                  : "Pay when your order arrives"
                                : bn
                                  ? "নির্দেশনা অনুযায়ী পেমেন্ট করুন"
                                  : "Pay according to the store's instructions")}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              !settingsLoading && (
                <p>
                  {bn
                    ? "কোনো সক্রিয় পেমেন্ট পদ্ধতি নেই।"
                    : "No active payment methods are available."}
                </p>
              )
            )}

            {selectedMethodInstructions && (
              <p className="checkout-payment-instructions">
                {bn ? "পেমেন্ট নির্দেশনা: " : "Payment instructions: "}
                {selectedMethodInstructions}
              </p>
            )}

            {isManualWalletPayment && (
              <div className="manual-payment-fields">
                <h3>
                  {selectedPaymentId === "bkash" ? "bKash" : "Nagad"}{" "}
                  {bn ? "পেমেন্টের তথ্য" : "payment details"}
                </h3>

                <p>
                  {bn
                    ? "দোকানের নির্ধারিত নম্বরে Send Money করে নিচের তথ্য পূরণ করুন। পেমেন্ট যাচাইয়ের পর অর্ডার নিশ্চিত হবে।"
                    : "Send Money to the store's configured number and enter the details below. Your payment must be verified before confirmation."}
                </p>

                <label>
                  {bn
                    ? "যে নম্বর থেকে টাকা পাঠিয়েছেন"
                    : "Sender number"}{" "}
                  *
                  <input
                    type="tel"
                    name="paymentSenderNumber"
                    value={form.paymentSenderNumber}
                    onChange={change}
                    placeholder="01XXXXXXXXX"
                    autoComplete="off"
                    inputMode="numeric"
                    required
                    disabled={submitting}
                    maxLength={14}
                  />
                </label>

                <label>
                  Transaction ID *
                  <input
                    type="text"
                    name="paymentTransactionId"
                    value={form.paymentTransactionId}
                    onChange={change}
                    placeholder={
                      bn
                        ? "Transaction ID লিখুন"
                        : "Enter Transaction ID"
                    }
                    autoComplete="off"
                    required
                    disabled={submitting}
                    minLength={5}
                    maxLength={100}
                  />
                </label>
              </div>
            )}

            {checkoutInstructions && (
              <p className="checkout-payment-instructions">
                {checkoutInstructions}
              </p>
            )}

            {settingsError && (
              <p className="form-error" role="alert">
                {settingsError}
              </p>
            )}

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <p className="checkout-demo-warning">
              <ShieldCheck size={15} />
              {bn
                ? "চূড়ান্ত ডেলিভারি চার্জ ও মোট মূল্য সার্ভারে যাচাই করা হবে।"
                : "Final delivery charges and total are verified by the server."}
            </p>

            <div className="checkout-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={onBack}
                disabled={submitting}
              >
                <ArrowLeft size={15} />
                {t?.backCart ||
                  (bn ? "কার্টে ফিরে যান" : "Back to cart")}
              </button>

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  submitting ||
                  settingsLoading ||
                  !settings ||
                  !items.length
                }
              >
                {submitting ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="checkout-spinner"
                    />
                    {bn ? "অর্ডার হচ্ছে..." : "Placing order..."}
                  </>
                ) : (
                  <>
                    {t?.placeOrder ||
                      (bn ? "অর্ডার করুন" : "Place order")}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <aside className="order-summary">
            <h3>{bn ? "আপনার অর্ডার" : "Your order"}</h3>

            {items.map((item) => {
              const itemPrice = getItemPrice(item);
              const option = item.selectedPriceOption;

              return (
                <div
                  className="order-summary-line"
                  key={getCartKey(item)}
                >
                  <span className="summary-qty">
                    {Number(item.quantity || 0)}×
                  </span>

                  <span>
                    {bn
                      ? item.bn || item.title
                      : item.title}

                    {option?.optionId && (
                      <small className="order-summary-option">
                        {option.groupTitle
                          ? `${option.groupTitle}: `
                          : ""}
                        {option.optionText}
                      </small>
                    )}
                  </span>

                  <strong>
                    {formatPrice(
                      itemPrice * Number(item.quantity || 0),
                      lang
                    )}
                  </strong>
                </div>
              );
            })}

            <div className="summary-total">
              <span>
                {t?.subtotal ||
                  (bn ? "সাবটোটাল" : "Subtotal")}
              </span>

              <strong>{formatPrice(subtotal, lang)}</strong>
            </div>

            <div className="order-summary-delivery">
              <span>
                {bn ? "ডেলিভারি চার্জ" : "Delivery fee"}
              </span>

              <span>
                {settingsLoading
                  ? "—"
                  : charges.freeDelivery
                    ? bn
                      ? "ফ্রি"
                      : "Free"
                    : formatPrice(charges.deliveryFee, lang)}
              </span>
            </div>

            {charges.codFee > 0 && (
              <div className="order-summary-delivery">
                <span>{bn ? "COD চার্জ" : "COD fee"}</span>
                <span>{formatPrice(charges.codFee, lang)}</span>
              </div>
            )}

            <div className="summary-total">
              <span>
                {bn ? "আনুমানিক মোট" : "Estimated total"}
              </span>

              <strong>{formatPrice(charges.total, lang)}</strong>
            </div>

            {settings?.freeDeliveryThreshold > 0 && (
              <p>
                {bn
                  ? `৳${settings.freeDeliveryThreshold} বা তার বেশি অর্ডারে ফ্রি ডেলিভারি প্রযোজ্য।`
                  : `Free delivery applies to orders of ৳${settings.freeDeliveryThreshold} or more.`}
              </p>
            )}

            <p>
              {t?.shippingEstimate ||
                (bn
                  ? "ডেলিভারি চার্জ ও সময় নিশ্চিত করা হবে।"
                  : "Delivery charges and timing will be confirmed.")}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
