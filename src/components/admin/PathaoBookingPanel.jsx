import { useCallback, useEffect, useState } from "react";

const inputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px 11px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  fontSize: 14,
};

const labelStyle = {
  display: "grid",
  gap: 6,
  color: "#374151",
  fontSize: 13,
  fontWeight: 600,
};

function unwrapList(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;

  return [];
}

function optionId(item) {
  return String(
    item?.id ??
    item?.city_id ??
    item?.zone_id ??
    item?.area_id ??
    ""
  );
}

function optionName(item) {
  return (
    item?.name ??
    item?.city_name ??
    item?.zone_name ??
    item?.area_name ??
    ""
  );
}

function money(value) {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? `৳${amount.toLocaleString("en-BD")}`
    : "—";
}

export default function PathaoBookingPanel({
  order,
  request,
  onBooked,
}) {
  const address = order?.shippingAddress || {};

  const customerName =
    address.fullName ||
    order?.customer?.name ||
    order?.customerName ||
    "";

  const customerPhone =
    address.phone ||
    order?.customer?.phone ||
    "";

  const customerAddress = [
    address.addressLine,
    address.city,
  ]
    .filter(Boolean)
    .join(", ");

  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  const isCod =
    String(order?.paymentMethod || "").toLowerCase() === "cod" &&
    String(order?.paymentStatus || "").toLowerCase() !== "paid";

  const courier = order?.courier || {};

  const alreadyBooked = Boolean(
    String(courier.consignmentId || "").trim()
  );

  const bookingStatus = String(
    courier.bookingStatus || ""
  ).toLowerCase();

  const bookingLocked =
    bookingStatus === "booking" ||
    bookingStatus === "unknown";

  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [areas, setAreas] = useState([]);

  const [cityId, setCityId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [areaId, setAreaId] = useState("");

  const [weight, setWeight] = useState("0.5");
  const [specialInstruction, setSpecialInstruction] = useState("");

  const [quote, setQuote] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attemptNeedsReview, setAttemptNeedsReview] = useState(false);

  const loadCities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request("/pathao/cities");

      setCities(
        unwrapList(result, ["cities", "data"])
      );
    } catch (err) {
      setError(
        err.message ||
        "Could not load Pathao cities."
      );
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (!alreadyBooked && !bookingLocked) {
      loadCities();
    }
  }, [alreadyBooked, bookingLocked, loadCities]);

  const loadZones = async (nextCityId) => {
    setCityId(nextCityId);
    setZoneId("");
    setAreaId("");

    setZones([]);
    setAreas([]);
    setQuote(null);
    setError("");

    if (!nextCityId) return;

    setLoadingZones(true);

    try {
      const result = await request(
        `/pathao/cities/${encodeURIComponent(nextCityId)}/zones`
      );

      setZones(
        unwrapList(result, ["zones", "data"])
      );
    } catch (err) {
      setError(err.message || "Could not load Pathao zones.");
    } finally {
      setLoadingZones(false);
    }
  };

  const loadAreas = async (nextZoneId) => {
    setZoneId(nextZoneId);
    setAreaId("");

    setAreas([]);
    setQuote(null);
    setError("");

    if (!nextZoneId) return;

    setLoadingAreas(true);

    try {
      const result = await request(
        `/pathao/zones/${encodeURIComponent(nextZoneId)}/areas`
      );

      setAreas(
        unwrapList(result, ["areas", "data"])
      );
    } catch (err) {
      setError(err.message || "Could not load Pathao areas.");
    } finally {
      setLoadingAreas(false);
    }
  };

  const validateForm = () => {
    if (!cityId || !zoneId || !areaId) {
      setError("Select Pathao city, zone and area first.");
      return false;
    }

    const numericWeight = Number(weight);

    if (
      !Number.isFinite(numericWeight) ||
      numericWeight < 0.5 ||
      numericWeight > 10
    ) {
      setError("Parcel weight must be between 0.5 and 10 kg.");
      return false;
    }

    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !customerAddress.trim()
    ) {
      setError("Customer name, phone and address are required.");
      return false;
    }

    return true;
  };

  const getQuote = async () => {
    if (!validateForm()) return;

    setQuoting(true);
    setError("");
    setNotice("");
    setQuote(null);

    try {
      const result = await request("/pathao/price-plan", {
        method: "POST",
        body: JSON.stringify({
          recipient_city: Number(cityId),
          recipient_zone: Number(zoneId),
          item_weight: Number(weight),
        }),
      });

      const pricePlan =
        result?.pricePlan ||
        result?.data?.data ||
        result?.data ||
        result;

      if (
        pricePlan?.final_price == null &&
        pricePlan?.price == null
      ) {
        throw new Error(
          "Pathao did not return a valid delivery price. Please try again."
        );
      }

      setQuote(pricePlan);

      setNotice(
        "Pathao delivery price calculated successfully. Review the details before booking."
      );
    } catch (err) {
      setError(
        err.message ||
        "Could not calculate Pathao delivery charge."
      );
    } finally {
      setQuoting(false);
    }
  };

  const createBooking = async () => {
    if (
      alreadyBooked ||
      bookingLocked ||
      attemptNeedsReview
    ) {
      return;
    }

    if (!validateForm()) return;

    if (!quote) {
      setError(
        "Calculate the Pathao delivery charge before creating a booking."
      );
      return;
    }

    const orderId = order?._id || order?.id;

    if (!orderId) {
      setError("Order ID is missing.");
      return;
    }

    const confirmed = window.confirm(
      "LIVE PATHAO BOOKING CONFIRMATION\n\n" +
      "This will create a REAL parcel booking in your Pathao merchant account.\n\n" +
      "Customer: " + customerName + "\n" +
      "Phone: " + customerPhone + "\n" +
      "Address: " + customerAddress + "\n" +
      "Estimated Pathao charge: " +
      money(quote.final_price ?? quote.price) +
      "\n\n" +
      "Are you sure you want to create this LIVE booking?"
    );

    if (!confirmed) return;

    setBooking(true);
    setError("");
    setNotice("");
    setAttemptNeedsReview(false);

    try {
      const result = await request(
        `/orders/${encodeURIComponent(orderId)}/pathao`,
        {
          method: "POST",
          body: JSON.stringify({
            recipientCity: Number(cityId),
            recipientZone: Number(zoneId),
            recipientArea: Number(areaId),
            itemWeight: Number(weight),
            specialInstruction: specialInstruction.trim(),
          }),
        }
      );

      const bookingData =
        result?.data?.data ||
        result?.data ||
        result?.courier ||
        result;

      const consignmentId =
        bookingData?.consignmentId ||
        bookingData?.consignment_id;

      if (!consignmentId) {
        setAttemptNeedsReview(true);

        throw new Error(
          "Pathao booking response did not contain a consignment ID. Refresh the order and verify the Pathao Merchant Portal before trying again."
        );
      }

      setNotice(
        `LIVE Pathao booking created successfully. Consignment ID: ${consignmentId}`
      );

      await onBooked?.(result);
    } catch (err) {
      setAttemptNeedsReview(true);

      setError(
        (err.message || "Pathao booking request failed.") +
        " Do not retry until the order status and Pathao Merchant Portal have been checked."
      );
    } finally {
      setBooking(false);
    }
  };

  const consignmentId = courier.consignmentId;
  const trackingUrl = courier.trackingUrl;

  const deliveryCharge =
    quote?.final_price ??
    quote?.price ??
    quote?.delivery_fee ??
    quote?.deliveryFee;

  const displayedStatus =
    courier.orderStatus ||
    courier.orderStatusSlug ||
    "Booked";

  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid #dbeafe",
        background: "#f8fbff",
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <strong style={{ color: "#1e40af" }}>
          Pathao Courier
        </strong>

        {alreadyBooked && (
          <span style={{ color: "#047857", fontSize: 12, fontWeight: 700 }}>
            BOOKED
          </span>
        )}

        {!alreadyBooked && bookingStatus === "unknown" && (
          <span style={{ color: "#b45309", fontSize: 12, fontWeight: 700 }}>
            NEEDS VERIFICATION
          </span>
        )}

        {!alreadyBooked && bookingStatus === "booking" && (
          <span style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 700 }}>
            BOOKING IN PROGRESS
          </span>
        )}
      </div>

      {alreadyBooked ? (
        <div
          style={{
            display: "grid",
            gap: 7,
            marginTop: 10,
            fontSize: 13,
          }}
        >
          <div>
            <strong>Consignment ID:</strong> {consignmentId}
          </div>

          <div>
            <strong>Booking status:</strong> {displayedStatus}
          </div>

          <div>
            <strong>Pathao charge:</strong>{" "}
            {money(courier.deliveryFee)}
          </div>

          {courier.merchantOrderId && (
            <div>
              <strong>Merchant order ID:</strong>{" "}
              {courier.merchantOrderId}
            </div>
          )}

          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#1d4ed8",
                fontWeight: 700,
              }}
            >
              Track this parcel
            </a>
          )}
        </div>
      ) : bookingLocked ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            color: "#92400e",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {bookingStatus === "unknown"
            ? "The booking request may have reached Pathao, but PreBotix could not confirm its result. Check the Pathao Merchant Portal using the merchant order ID before taking further action. Automatic retry is disabled."
            : "A Pathao booking request is already in progress. Do not submit another request."}

          {courier.lastError && (
            <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>
              <strong>Last error:</strong> {courier.lastError}
            </div>
          )}
        </div>
      ) : (
        <>
          <p
            style={{
              margin: "7px 0 12px",
              color: "#6b7280",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Select the customer's actual Pathao destination. Pathao IDs are separate from PreBotix checkout delivery zones.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            <label style={labelStyle}>
              Pathao City

              <select
                style={inputStyle}
                value={cityId}
                disabled={loading || booking}
                onChange={(e) => loadZones(e.target.value)}
              >
                <option value="">Select city</option>

                {cities.map((item) => (
                  <option
                    key={optionId(item)}
                    value={optionId(item)}
                  >
                    {optionName(item)}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Pathao Zone

              <select
                style={inputStyle}
                value={zoneId}
                disabled={!cityId || booking || loadingZones}
                onChange={(e) => loadAreas(e.target.value)}
              >
                <option value="">Select zone</option>

                {zones.map((item) => (
                  <option
                    key={optionId(item)}
                    value={optionId(item)}
                  >
                    {optionName(item)}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Pathao Area

              <select
                style={inputStyle}
                value={areaId}
                disabled={!zoneId || booking || loadingAreas}
                onChange={(e) => {
                  setAreaId(e.target.value);
                  setQuote(null);
                }}
              >
                <option value="">Select area</option>

                {areas.map((item) => (
                  <option
                    key={optionId(item)}
                    value={optionId(item)}
                  >
                    {optionName(item)}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Parcel weight (kg)

              <input
                style={inputStyle}
                type="number"
                min="0.5"
                max="10"
                step="0.1"
                value={weight}
                disabled={booking}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setQuote(null);
                }}
              />
            </label>
          </div>

          <label style={{ ...labelStyle, marginTop: 10 }}>
            Special instruction (optional)

            <textarea
              style={{
                ...inputStyle,
                minHeight: 62,
                resize: "vertical",
              }}
              value={specialInstruction}
              maxLength={500}
              disabled={booking}
              onChange={(e) => setSpecialInstruction(e.target.value)}
              placeholder="e.g. Call before delivery"
            />
          </label>

          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              lineHeight: 1.7,
              overflowWrap: "anywhere",
            }}
          >
            <div>
              <strong>Recipient:</strong>{" "}
              {customerName || "Missing name"}
            </div>

            <div>
              <strong>Phone:</strong>{" "}
              {customerPhone || "Missing phone"}
            </div>

            <div>
              <strong>Address:</strong>{" "}
              {customerAddress || "Missing address"}
            </div>

            <div>
              <strong>Items:</strong>{" "}
              {items.map((item, index) => (
                `${item?.name || item?.title || "Product"} × ${item?.quantity || 1}`
              )).join(", ") || "—"}
            </div>

            <div>
              <strong>Collect on delivery:</strong>{" "}
              {isCod ? money(order?.total ?? order?.totalAmount) : money(0)}
              {" "}
              {isCod ? "(COD)" : "(prepaid order)"}
            </div>
          </div>

          {quote && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                background: "#ecfdf5",
                color: "#065f46",
                fontSize: 13,
              }}
            >
              <strong>
                Estimated Pathao charge: {money(deliveryCharge)}
              </strong>

              {quote?.discount > 0 && (
                <div>
                  Discount: {money(quote.discount)}
                </div>
              )}

              {quote?.message && (
                <div>{quote.message}</div>
              )}

              <div style={{ marginTop: 5, fontSize: 11 }}>
                This is a price estimate, not a parcel booking.
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={getQuote}
              disabled={quoting || booking || loading}
              style={{
                border: "1px solid #2563eb",
                color: "#1d4ed8",
                background: "#fff",
                borderRadius: 8,
                padding: "9px 12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {quoting ? "Calculating..." : "Calculate Delivery Charge"}
            </button>

            <button
              type="button"
              onClick={createBooking}
              disabled={
                booking ||
                loading ||
                bookingLocked ||
                attemptNeedsReview ||
                !quote
              }
              style={{
                border: "1px solid #2563eb",
                color: "#fff",
                background: booking ? "#93c5fd" : "#2563eb",
                borderRadius: 8,
                padding: "9px 12px",
                fontWeight: 700,
                cursor: booking ? "wait" : "pointer",
                opacity: !quote ? 0.6 : 1,
              }}
            >
              {booking ? "Creating LIVE booking..." : "Create LIVE Pathao Booking"}
            </button>
          </div>

          {attemptNeedsReview && (
            <p
              style={{
                color: "#92400e",
                fontSize: 12,
                marginTop: 10,
                lineHeight: 1.6,
              }}
            >
              This booking attempt needs verification. Refresh the order and check the Pathao Merchant Portal before trying again.
            </p>
          )}
        </>
      )}

      {error && (
        <p
          role="alert"
          style={{
            color: "#b91c1c",
            fontSize: 12,
            margin: "10px 0 0",
            overflowWrap: "anywhere",
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          style={{
            color: "#047857",
            fontSize: 12,
            margin: "10px 0 0",
            overflowWrap: "anywhere",
          }}
        >
          {notice}
        </p>
      )}

      {loading && (
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 0 }}>
          Loading Pathao cities...
        </p>
      )}

      {loadingZones && (
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 0 }}>
          Loading Pathao zones...
        </p>
      )}

      {loadingAreas && (
        <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 0 }}>
          Loading Pathao areas...
        </p>
      )}
    </div>
  );
}