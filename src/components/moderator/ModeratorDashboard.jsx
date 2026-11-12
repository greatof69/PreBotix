import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../shared/DashboardLayout";
import FloatingCalculator from "../shared/FloatingCalculator";
import {
  clearAuthSession,
  authFetch,
} from "../../utils/authSession";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// -------------------- Styles --------------------

const cardStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 18,
  minWidth: 0,
  boxSizing: "border-box",
};

const buttonStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 8,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const primaryButton = {
  ...buttonStyle,
  background: "#2563eb",
  color: "#fff",
  borderColor: "#2563eb",
};

const successButton = {
  ...buttonStyle,
  background: "#059669",
  color: "#fff",
  borderColor: "#059669",
};

const dangerButton = {
  ...buttonStyle,
  background: "#dc2626",
  color: "#fff",
  borderColor: "#dc2626",
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: 10,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  fontSize: 14,
};

// -------------------- Helpers --------------------

function idOf(item) {
  return item?._id || item?.id;
}

function getList(data, key) {
  if (Array.isArray(data)) return data;

  const result = data?.[key] || data?.items || data?.data || [];

  return Array.isArray(result) ? result : [];
}

function readModeratorListCache(key) {
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasModeratorListCache(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value !== null && Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

function saveModeratorListCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function statusOf(order) {
  return String(order?.status || "pending").toLowerCase();
}

function money(value) {
  return `à§³${Number(value || 0).toLocaleString("en-BD")}`;
}

function getCustomerName(order) {
  return (
    order?.shippingAddress?.fullName ||
    order?.customer?.name ||
    order?.user?.name ||
    order?.customerName ||
    order?.name ||
    "Customer"
  );
}

function isMessageInDateRange(
  dateValue,
  range,
  startDate,
  endDate
) {
  if (range === "all") return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (range === "today") {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return date >= todayStart && date < tomorrow;
  }

  if (range === "7days" || range === "30days") {
    const from = new Date(todayStart);

    from.setDate(
      from.getDate() - (range === "7days" ? 6 : 29)
    );

    return date >= from && date <= now;
  }

  if (range === "custom") {
    if (startDate) {
      const from = new Date(`${startDate}T00:00:00`);

      if (date < from) return false;
    }

    if (endDate) {
      const to = new Date(`${endDate}T23:59:59.999`);

      if (date > to) return false;
    }

    return true;
  }

  return true;
}

function getCourierBookingText(order) {
  const address = order?.shippingAddress || {};
  const items = Array.isArray(order?.items) ? order.items : [];

  const itemLines = items.map((item) => {
    const name =
      item?.name ||
      item?.title ||
      item?.product?.name ||
      "Product";

    return `- ${name} x ${Number(item?.quantity || 1)}`;
  });

  return [
    "PREBOTIX - MANUAL COURIER BOOKING",
    `Order: ${order?.orderNumber || idOf(order) || "N/A"}`,
    `Customer: ${address.fullName || getCustomerName(order)}`,
    `Phone: ${address.phone || "N/A"}`,
    `Address: ${address.addressLine || "N/A"}`,
    `City: ${address.city || "N/A"}`,
    `Delivery Zone: ${order?.deliveryZone?.name || "N/A"}`,
    `Items:\n${itemLines.join("\n") || "- No items listed"}`,
    `Subtotal: ${money(order?.subtotal)}`,
    `Delivery Fee: ${money(order?.deliveryFee)}`,
    `COD Fee: ${money(order?.codFee)}`,
    `Order Total: ${money(order?.total)}`,
    `Payment Method: ${
      order?.paymentMethodLabel || order?.paymentMethod || "N/A"
    }`,
    `Payment Status: ${order?.paymentStatus || "unpaid"}`,
    `Customer Note: ${address.note || "None"}`,
  ].join("\n");
}


// -------------------- Component --------------------

export default function ModeratorDashboard({
  lang = "en",
  setLang,
  mobileOpen = false,
  setMobileOpen,
}) {
  const navigate = useNavigate();

  const [tab, setTab] = useState("dashboard");

  const [orders, setOrders] = useState(() => readModeratorListCache("prebotix-moderator-orders-v1"));
  const [orderHistory, setOrderHistory] = useState(() => readModeratorListCache("prebotix-moderator-history-v1"));
  const [messages, setMessages] = useState(() => readModeratorListCache("prebotix-moderator-messages-v1"));
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceSettings, setAttendanceSettings] = useState(null);
  const [transitionAvailableAt, setTransitionAvailableAt] = useState(null);
  const [transitionClock, setTransitionClock] = useState(Date.now());
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceActionLoading, setAttendanceActionLoading] = useState("");

  const transitionRemainingMs = transitionAvailableAt
    ? Math.max(0, new Date(transitionAvailableAt).getTime() - transitionClock)
    : 0;

  useEffect(() => {
    if (!transitionAvailableAt) return undefined;

    const timer = window.setInterval(() => {
      setTransitionClock(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [transitionAvailableAt]);

  const [replyDrafts, setReplyDrafts] = useState({});

  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("all");

  const [orderFilter, setOrderFilter] = useState("all");

  const [messageDateFilter, setMessageDateFilter] = useState("all");
  const [messageStartDate, setMessageStartDate] = useState("");
  const [messageEndDate, setMessageEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ordersLoadedRef = useRef(
    hasModeratorListCache("prebotix-moderator-orders-v1")
  );
  const historyLoadedRef = useRef(
    hasModeratorListCache("prebotix-moderator-history-v1")
  );
  const messagesLoadedRef = useRef(
    hasModeratorListCache("prebotix-moderator-messages-v1")
  );

  useEffect(() => {
    if (ordersLoadedRef.current) {
      saveModeratorListCache("prebotix-moderator-orders-v1", orders);
    }
  }, [orders]);

  useEffect(() => {
    if (historyLoadedRef.current) {
      saveModeratorListCache("prebotix-moderator-history-v1", orderHistory);
    }
  }, [orderHistory]);

  useEffect(() => {
    if (messagesLoadedRef.current) {
      saveModeratorListCache("prebotix-moderator-messages-v1", messages);
    }
  }, [messages]);

  const [historyActionId, setHistoryActionId] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [deletingAllMessages, setDeletingAllMessages] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const t = (en, bn) => (lang === "bn" ? bn : en);

  // -------------------- Logout --------------------

  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
    window.location.reload();
  };

  // -------------------- API Request --------------------

  const request = useCallback(async (path, options = {}) => {
    const response = await authFetch(
      `${API}/api/moderator${path}`,
      {
        ...options,
        headers: {
          ...options.headers,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = await response.text();

    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed (${response.status})`
      );
    }

    return data;
  }, []);

  // -------------------- Load Orders --------------------

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !ordersLoadedRef.current) setLoading(true);
    if (!silent) setError("");

    try {
      const data = await request("/orders");
      const nextOrders = getList(data, "orders");
      setOrders(nextOrders);
      ordersLoadedRef.current = true;
      saveModeratorListCache("prebotix-moderator-orders-v1", nextOrders);
    } catch (err) {
      if (!silent) setError(
        err.message ||
          t("Could not load orders.", "à¦…à¦°à§à¦¡à¦¾à¦° à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤")
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [request]);

  const deleteCourierOrder = useCallback(async (orderId) => {
    if (!orderId) return;

    const confirmed = window.confirm(
      t(
        "Delete this courier order? This cannot be undone.",
        "à¦à¦‡ à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦°à¦Ÿà¦¿ à¦®à§à¦›à¦¬à§‡à¦¨? à¦à¦Ÿà¦¿ à¦«à¦¿à¦°à¦¿à¦¯à¦¼à§‡ à¦†à¦¨à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤"
      )
    );
    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await request(`/courier-orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });

      setNotice(t("Courier order deleted.", "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦° à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"));
      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not delete courier order.");
    }
  }, [request, loadOrders, lang]);

  const deleteAllCourierOrders = useCallback(async () => {
    const typed = window.prompt(
      t(
        "You are about to permanently delete ALL courier orders. Type DELETE to confirm.",
        "à¦†à¦ªà¦¨à¦¿ à¦¸à¦¬ à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦° à¦¸à§à¦¥à¦¾à¦¯à¦¼à§€à¦­à¦¾à¦¬à§‡ à¦®à§à¦›à¦¤à§‡ à¦¯à¦¾à¦šà§à¦›à§‡à¦¨à¥¤ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à¦¤à§‡ DELETE à¦²à¦¿à¦–à§à¦¨à¥¤"
      )
    );
    if (String(typed || "").trim() !== "DELETE") return;

    setError("");
    setNotice("");

    try {
      await request("/courier-orders", {
        method: "DELETE",
      });

      setNotice(
        t(
          "All courier orders deleted successfully.",
          "à¦¸à¦¬ à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦° à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
        )
      );
      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not delete courier orders.");
    }
  }, [request, loadOrders, lang]);


  // -------------------- Load History --------------------

  const loadOrderHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !historyLoadedRef.current) setHistoryLoading(true);
    if (!silent) setError("");

    try {
      const data = await request("/order-history");

      const nextHistory = getList(data, "history");
      setOrderHistory(nextHistory);
      historyLoadedRef.current = true;
      saveModeratorListCache("prebotix-moderator-history-v1", nextHistory);
    } catch (err) {
      if (!silent) setError(
        err.message ||
          t(
            "Could not load Order History.",
            "à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
          )
      );
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, [request]);

  // -------------------- Complete Order --------------------

  async function completeOrder(order) {
    const orderId = idOf(order);

    if (!orderId) {
      setError(t("Order ID is missing.", "à¦…à¦°à§à¦¡à¦¾à¦° à¦†à¦‡à¦¡à¦¿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"));
      return;
    }

    const paymentStatus = String(
      order?.paymentStatus || "unpaid"
    ).toLowerCase();

    if (
      statusOf(order) !== "delivered" ||
      paymentStatus !== "paid"
    ) {
      setError(
        t(
          "Only delivered and paid orders can be completed.",
          "à¦¶à§à¦§à§ Delivered à¦à¦¬à¦‚ Paid à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿à¦¤à§‡ à¦¨à§‡à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤"
        )
      );
      return;
    }


    if (historyActionId) return;

    setHistoryActionId(String(orderId));
    setError("");
    setNotice("");

    try {
      await request(`/orders/${orderId}/done`, {
        method: "POST",
      });

      setNotice(
        t(
          "Order added to History successfully.",
          "à¦…à¦°à§à¦¡à¦¾à¦° à¦¸à¦«à¦²à¦­à¦¾à¦¬à§‡ à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿à¦¤à§‡ à¦¯à§‹à¦— à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
        )
      );

      await Promise.all([
        loadOrders(),
        loadOrderHistory(),
      ]);
    } catch (err) {
      setError(
        err.message ||
          t(
            "Could not complete order.",
            "à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿à¦¤à§‡ à¦¨à§‡à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
          )
      );
    } finally {
      setHistoryActionId("");
    }
  }

  // -------------------- Mark COD Cash as Paid --------------------

  async function markCodAsPaid(order) {
    const orderId = idOf(order);
    const paymentMethod = String(order?.paymentMethod || "").toLowerCase();
    const paymentStatus = String(order?.paymentStatus || "unpaid").toLowerCase();

    if (!orderId || statusOf(order) !== "delivered" || paymentMethod !== "cod" || paymentStatus === "paid") {
      setError(t(
        "Only delivered unpaid COD orders can be marked as paid.",
        "à¦¶à§à¦§à§ Delivered à¦à¦¬à¦‚ Unpaid COD à¦…à¦°à§à¦¡à¦¾à¦° Paid à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤"
      ));
      return;
    }

    if (saving || historyActionId) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request(`/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "paid" }),
      });

      setNotice(t(
        "COD cash received. Payment marked as paid. You can now click Done.",
        "COD-à¦à¦° à¦Ÿà¦¾à¦•à¦¾ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦—à§‡à¦›à§‡à¥¤ Payment Paid à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ à¦à¦–à¦¨ Done à¦šà¦¾à¦ªà¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡à¦¨à¥¤"
      ));
      await loadOrders();
    } catch (err) {
      setError(err.message || t(
        "Could not mark COD payment as paid.",
        "COD à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Paid à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
      ));
    } finally {
      setSaving(false);
    }
  }

  // -------------------- Verify / Reject bKash & Nagad --------------------

  async function updateModeratorPaymentStatus(order, paymentStatus) {
    const orderId = idOf(order);
    const paymentMethod = String(order?.paymentMethod || "").toLowerCase();
    const currentPaymentStatus = String(
      order?.paymentStatus || "unpaid"
    ).toLowerCase();

    if (
      !orderId ||
      !["bkash", "nagad"].includes(paymentMethod) ||
      currentPaymentStatus !== "pending" ||
      !["paid", "failed"].includes(paymentStatus)
    ) {
      setError(t(
        "Only pending bKash/Nagad payments can be verified or rejected.",
        "à¦¶à§à¦§à§ Pending bKash/Nagad à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Verify à¦…à¦¥à¦¬à¦¾ Reject à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤"
      ));
      return;
    }

    if (saving || historyActionId) return;

    let reason = "";

    if (paymentStatus === "failed") {
      const enteredReason = window.prompt(
        t(
          "Enter payment rejection reason (1â€“500 characters):",
          "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Reject à¦•à¦°à¦¾à¦° à¦•à¦¾à¦°à¦£ à¦²à¦¿à¦–à§à¦¨ (à§§â€“à§«à§¦à§¦ à¦…à¦•à§à¦·à¦°):"
        )
      );

      if (enteredReason === null) return;

      reason = enteredReason.trim();

      if (!reason || reason.length > 500) {
        setError(t(
          "Rejection reason must contain 1â€“500 characters.",
          "Reject à¦•à¦°à¦¾à¦° à¦•à¦¾à¦°à¦£ à§§â€“à§«à§¦à§¦ à¦…à¦•à§à¦·à¦°à§‡à¦° à¦®à¦§à§à¦¯à§‡ à¦¹à¦¤à§‡ à¦¹à¦¬à§‡à¥¤"
        ));
        return;
      }
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request(`/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus,
          ...(paymentStatus === "failed" ? { reason } : {}),
        }),
      });

      setNotice(
        paymentStatus === "paid"
          ? t(
              "Payment verified successfully. Admin and Moderator dashboards will show the updated status.",
              "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Verify à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ Admin à¦“ Moderator Dashboard-à¦ à¦†à¦ªà¦¡à§‡à¦Ÿà§‡à¦¡ à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸ à¦¦à§‡à¦–à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤"
            )
          : t(
              "Payment rejected successfully. The rejection reason has been saved.",
              "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Reject à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ Reject à¦•à¦°à¦¾à¦° à¦•à¦¾à¦°à¦£ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
            )
      );

      await loadOrders();
    } catch (err) {
      setError(err.message || t(
        "Could not update payment status.",
        "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
      ));
    } finally {
      setSaving(false);
    }
  }
  // -------------------- Delete History Entry --------------------

  async function deleteHistoryEntry(historyId) {
    if (!historyId || historyActionId) return;


    setHistoryActionId(String(historyId));
    setError("");
    setNotice("");

    try {
      await request(`/order-history/${historyId}`, {
        method: "DELETE",
      });

      setOrderHistory((previous) =>
        previous.filter(
          (item) => String(item._id) !== String(historyId)
        )
      );

      setNotice(
        t(
          "History entry deleted. Original order remains unchanged.",
          "à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦à¦¨à§à¦Ÿà§à¦°à¦¿ à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ à¦®à§‚à¦² à¦…à¦°à§à¦¡à¦¾à¦° à¦…à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¿à¦¤ à¦†à¦›à§‡à¥¤"
        )
      );
    } catch (err) {
      setError(
        err.message ||
          t(
            "Could not delete History entry.",
            "à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦à¦¨à§à¦Ÿà§à¦°à¦¿ à¦®à§à¦›à¦¤à§‡ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
          )
      );
    } finally {
      setHistoryActionId("");
    }
  }

  // -------------------- Update Order Status --------------------

  async function updateStatus(order, status) {
    const orderId = idOf(order);

    if (!orderId) {
      setError(
        t("Order ID is missing.", "à¦…à¦°à§à¦¡à¦¾à¦° à¦†à¦‡à¦¡à¦¿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤")
      );
      return;
    }

    const allowedStatuses = [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      setError(
        t("Invalid order status.", "à¦…à¦°à§à¦¡à¦¾à¦°à§‡à¦° à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸ à¦¸à¦ à¦¿à¦• à¦¨à¦¯à¦¼à¥¤")
      );
      return;
    }

    if (saving) return;

    let reason = "";

    if (status === "cancelled") {
      const confirmed = window.confirm(
        t(
          "Are you sure you want to cancel this order?",
          "à¦†à¦ªà¦¨à¦¿ à¦•à¦¿ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦¯à§‡ à¦à¦‡ à¦…à¦°à§à¦¡à¦¾à¦°à¦Ÿà¦¿ à¦¬à¦¾à¦¤à¦¿à¦² à¦•à¦°à¦¤à§‡ à¦šà¦¾à¦¨?"
        )
      );

      if (!confirmed) return;

      reason =
        window.prompt(
          t(
            "Enter the cancellation reason:",
            "à¦…à¦°à§à¦¡à¦¾à¦° à¦¬à¦¾à¦¤à¦¿à¦²à§‡à¦° à¦•à¦¾à¦°à¦£ à¦²à¦¿à¦–à§à¦¨:"
          )
        ) || "";

      if (!reason.trim()) {
        setError(
          t(
            "Cancellation reason is required.",
            "à¦…à¦°à§à¦¡à¦¾à¦° à¦¬à¦¾à¦¤à¦¿à¦²à§‡à¦° à¦•à¦¾à¦°à¦£ à¦²à¦¿à¦–à¦¤à§‡ à¦¹à¦¬à§‡à¥¤"
          )
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (status === "cancelled") {
        await request(`/orders/${orderId}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        });
      } else {
        await request(`/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      }

      const messages = {
        confirmed: [
          "Order confirmed successfully.",
          "à¦…à¦°à§à¦¡à¦¾à¦° à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤",
        ],
        processing: [
          "Order marked as processing.",
          "à¦…à¦°à§à¦¡à¦¾à¦° à¦ªà§à¦°à¦¸à§‡à¦¸à¦¿à¦‚ à¦¹à¦¿à¦¸à§‡à¦¬à§‡ à¦šà¦¿à¦¹à§à¦¨à¦¿à¦¤ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤",
        ],
        shipped: [
          "Order marked as shipped.",
          "à¦…à¦°à§à¦¡à¦¾à¦° à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤",
        ],
        delivered: [
          "Order marked as delivered.",
          "à¦…à¦°à§à¦¡à¦¾à¦° à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤",
        ],
        cancelled: [
          "Order cancelled successfully.",
          "à¦…à¦°à§à¦¡à¦¾à¦° à¦¬à¦¾à¦¤à¦¿à¦² à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤",
        ],
      };

      setNotice(t(...messages[status]));

      await loadOrders();
    } catch (err) {
      setError(
        err.message ||
          t("Could not update order.", "à¦…à¦°à§à¦¡à¦¾à¦° à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤")
      );
    } finally {
      setSaving(false);
    }
  }

  // -------------------- Customer Messages --------------------

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!silent && !messagesLoadedRef.current) setLoading(true);
    if (!silent) setError("");

    try {
      const data = await request("/messages");
      const nextMessages = getList(data, "messages");
      setMessages(nextMessages);
      messagesLoadedRef.current = true;
      saveModeratorListCache("prebotix-moderator-messages-v1", nextMessages);
    } catch (err) {
      if (!silent) setError(
        err.message ||
          t("Could not load messages.", "à¦®à§‡à¦¸à§‡à¦œ à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤")
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [request]);

  async function sendReply(message) {
    const messageId = idOf(message);
    const reply = String(replyDrafts[messageId] || "").trim();

    if (!messageId || !reply) {
      setError(
        t(
          "Please enter a reply first.",
          "à¦†à¦—à§‡ à¦à¦•à¦Ÿà¦¿ à¦‰à¦¤à§à¦¤à¦° à¦²à¦¿à¦–à§à¦¨à¥¤"
        )
      );
      return;
    }

    if (saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request(`/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({
          reply,
          status: "replied",
        }),
      });

      setReplyDrafts((previous) => ({
        ...previous,
        [messageId]: "",
      }));

      setNotice(
        t(
          "Reply sent successfully.",
          "à¦‰à¦¤à§à¦¤à¦° à¦¸à¦«à¦²à¦­à¦¾à¦¬à§‡ à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
        )
      );

      await loadMessages();
    } catch (err) {
      setError(
        err.message ||
          t("Could not send reply.", "à¦‰à¦¤à§à¦¤à¦° à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤")
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteFullMessage(message) {
    const messageId = idOf(message);

    if (
      !messageId ||
      deletingMessageId ||
      deletingAllMessages
    ) {
      return;
    }

    const confirmed = window.confirm(
      t(
        "Delete this customer message?",
        "à¦à¦‡ à¦—à§à¦°à¦¾à¦¹à¦•à§‡à¦° à¦®à§‡à¦¸à§‡à¦œà¦Ÿà¦¿ à¦®à§à¦›à¦¬à§‡à¦¨?"
      )
    );

    if (!confirmed) return;

    setDeletingMessageId(String(messageId));
    setError("");
    setNotice("");

    try {
      await request(`/messages/${messageId}`, {
        method: "DELETE",
      });

      setMessages((previous) =>
        previous.filter(
          (item) => String(idOf(item)) !== String(messageId)
        )
      );

      setReplyDrafts((previous) => {
        const next = { ...previous };
        delete next[messageId];
        return next;
      });

      setNotice(
        t(
          "Message deleted successfully.",
          "à¦®à§‡à¦¸à§‡à¦œ à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
        )
      );
    } catch (err) {
      setError(
        err.message ||
          t("Could not delete message.", "à¦®à§‡à¦¸à§‡à¦œ à¦®à§à¦›à¦¤à§‡ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤")
      );
    } finally {
      setDeletingMessageId("");
    }
  }

  async function deleteFilteredMessages(filteredMessages) {
    if (
      deletingAllMessages ||
      deletingMessageId ||
      loading
    ) {
      return;
    }

    const ids = filteredMessages.map(idOf).filter(Boolean);

    if (!ids.length) return;



    setDeletingAllMessages(true);
    setError("");
    setNotice("");

    try {
      for (let i = 0; i < ids.length; i += 200) {
        await request("/messages/bulk", {
          method: "DELETE",
          body: JSON.stringify({
            ids: ids.slice(i, i + 200),
          }),
        });
      }

      const deletedSet = new Set(ids.map(String));

      setMessages((previous) =>
        previous.filter(
          (item) => !deletedSet.has(String(idOf(item)))
        )
      );

      setReplyDrafts((previous) => {
        const next = { ...previous };
        ids.forEach((id) => delete next[id]);
        return next;
      });

      setNotice(
        t(
          `${ids.length} messages deleted successfully.`,
          `${ids.length}à¦Ÿà¦¿ à¦®à§‡à¦¸à§‡à¦œ à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤`
        )
      );
    } catch (err) {
      setError(
        err.message ||
          t(
            "Could not delete all filtered messages.",
            "à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦° à¦•à¦°à¦¾ à¦¸à¦¬ à¦®à§‡à¦¸à§‡à¦œ à¦®à§à¦›à¦¤à§‡ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
          )
      );

      await loadMessages();
    } finally {
      setDeletingAllMessages(false);
    }
  }

  // -------------------- Load Active Tab --------------------

  // -------------------- Attendance --------------------

  const loadAttendance = useCallback(async (silent = false) => {
    if (!silent) setAttendanceLoading(true);

    try {
      const [todayData, historyData] = await Promise.all([
        request("/attendance/today"),
        request("/attendance"),
      ]);

      setTodayAttendance(todayData?.attendance || null);
      setAttendanceSettings(todayData?.settings || null);
      setTransitionAvailableAt(todayData?.transitionAvailableAt || null);
      setTransitionClock(Date.now());
      setAttendanceHistory(
        Array.isArray(historyData?.attendance)
          ? historyData.attendance
          : []
      );
    } catch (err) {
      if (!silent) {
        setError(err.message || "Could not load attendance.");
      }
    } finally {
      if (!silent) setAttendanceLoading(false);
    }
  }, [request]);

  async function runAttendanceAction(action, path) {
    setAttendanceActionLoading(action);
    setError("");
    setNotice("");

    try {
      const data = await request(path, { method: "POST" });
      setNotice(data?.message || "Attendance updated successfully.");
      await loadAttendance(true);
    } catch (err) {
      setError(err.message || "Attendance action failed.");
    } finally {
      setAttendanceActionLoading("");
    }
  }

  const attendanceTime = (value) => {
    if (!value) return "â€”";

    try {
      return new Intl.DateTimeFormat(
        lang === "bn" ? "bn-BD" : "en-BD",
        {
          timeZone: attendanceSettings?.timezone || "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
        }
      ).format(new Date(value));
    } catch {
      return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const attendanceDuration = (value) => {
    const total = Math.max(0, Number(value || 0));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;

    return `${hours}h ${minutes}m`;
  };
  useEffect(() => {
    let refreshing = false;

    const loadActiveTab = async (silent = false) => {
      if (refreshing) return;

      refreshing = true;

      try {
        if (
          tab === "dashboard" ||
          tab === "orders" ||
          tab === "courier"
        ) {
          await loadOrders({ silent });
        } else if (tab === "history") {
          await loadOrderHistory({ silent });
        } else if (tab === "messages") {
          await loadMessages({ silent });
        } else if (tab === "attendance") {
          await loadAttendance(silent);
        }
      } finally {
        refreshing = false;
      }
    };

    loadActiveTab(false);

    const timer = window.setInterval(
      () => loadActiveTab(true),
      15000
    );

    return () => window.clearInterval(timer);
  }, [
    tab,
    loadOrders,
    loadOrderHistory,
    loadMessages,
    loadAttendance,
  ]);
  // -------------------- Navigation --------------------

  const navItems = [
    {
      id: "dashboard",
      label: t("Dashboard", "à¦¡à§à¦¯à¦¾à¦¶à¦¬à§‹à¦°à§à¦¡"),
      labelBn: "à¦¡à§à¦¯à¦¾à¦¶à¦¬à§‹à¦°à§à¦¡",
      icon: "â–¦",
    },
    {
      id: "orders",
      label: t("Assigned Orders", "à¦¬à¦°à¦¾à¦¦à§à¦¦ à¦…à¦°à§à¦¡à¦¾à¦°"),
      labelBn: "à¦¬à¦°à¦¾à¦¦à§à¦¦ à¦…à¦°à§à¦¡à¦¾à¦°",
      icon: "â–¤",
    },
    {
      id: "courier",
      label: t("Courier Orders", "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦°"),
      labelBn: "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦°",
      icon: "ðŸ“¦",
    },
    {
      id: "history",
      label: t("Order History", "à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿"),
      labelBn: "à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿",
      icon: "ðŸ—‚ï¸",
    },
    {
      id: "messages",
      label: t("Customer Messages", "à¦—à§à¦°à¦¾à¦¹à¦•à§‡à¦° à¦¬à¦¾à¦°à§à¦¤à¦¾"),
      labelBn: "à¦—à§à¦°à¦¾à¦¹à¦•à§‡à¦° à¦¬à¦¾à¦°à§à¦¤à¦¾",
      icon: "âœ‰",
    },
    {
      id: "sales",
      label: t("My Sales", "à¦†à¦®à¦¾à¦° à¦¬à¦¿à¦•à§à¦°à¦¯à¦¼"),
      labelBn: "à¦†à¦®à¦¾à¦° à¦¬à¦¿à¦•à§à¦°à¦¯à¦¼",
      icon: "â†—",
    },
    {
      id: "attendance",
      label: t("Attendance", "à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿"),
      labelBn: "à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿",
      icon: "â—·",
    },
    {
      id: "earnings",
      label: t("Earnings", "à¦†à¦¯à¦¼"),
      labelBn: "à¦†à¦¯à¦¼",
      icon: "à§³",
    },
    {
      id: "profile",
      label: t("Profile", "à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²"),
      labelBn: "à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²",
      icon: "â™™",
    },
  ];

  const title =
    navItems.find((item) => item.id === tab)?.label ||
    t("Moderator Dashboard", "à¦®à¦¡à¦¾à¦°à§‡à¦Ÿà¦° à¦¡à§à¦¯à¦¾à¦¶à¦¬à§‹à¦°à§à¦¡");

  // -------------------- Dashboard Data --------------------

  const pendingCount = orders.filter(
    (order) => statusOf(order) === "pending"
  ).length;

  const confirmedCount = orders.filter((order) =>
    ["confirmed", "processing", "shipped", "delivered"].includes(
      statusOf(order)
    )
  ).length;

  const cancelledCount = orders.filter(
    (order) => statusOf(order) === "cancelled"
  ).length;

  const visibleOrders =
    orderFilter === "all"
      ? orders
      : orders.filter(
          (order) => statusOf(order) === orderFilter
        );

  const courierOrders = orders.filter((order) =>
    ["confirmed", "processing", "shipped", "delivered"].includes(
      statusOf(order)
    )
  );

  const visibleOrderHistory = orderHistory.filter((item) => {
    const query = historySearch.trim().toLowerCase();

    const matchesSearch =
      !query ||
      [
        item.orderNumber,
        item.customerName,
        item.customerEmail,
        item.customerPhone,
        item.shippingAddress?.fullName,
        item.shippingAddress?.phone,
        item.shippingAddress?.email,
        item.paymentReference,
        item.paymentTransactionId,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

    if (!matchesSearch) return false;

    if (historyDateFilter === "all") return true;

    const date = new Date(
      item.completedAt || item.createdAt
    );

    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    if (historyDateFilter === "today") {
      return date >= todayStart && date <= now;
    }

    const days = historyDateFilter === "7days" ? 7 : 30;
    const from = new Date(todayStart);

    from.setDate(from.getDate() - (days - 1));

    return date >= from && date <= now;
  });

  const filteredMessages = messages.filter((message) =>
    isMessageInDateRange(
      message.createdAt,
      messageDateFilter,
      messageStartDate,
      messageEndDate
    )
  );

  // -------------------- Render --------------------

  return (
    <DashboardLayout
      role="moderator"
      title={title}
      subtitle={t(
        "Manage your assigned work",
        "à¦†à¦ªà¦¨à¦¾à¦° à¦¬à¦°à¦¾à¦¦à§à¦¦ à¦•à¦¾à¦œ à¦ªà¦°à¦¿à¦šà¦¾à¦²à¦¨à¦¾ à¦•à¦°à§à¦¨"
      )}
      activeTab={tab}
      onTabChange={(nextTab) => {
        setTab(nextTab);
        setError("");
        setNotice("");
      }}
      navItems={navItems}
      lang={lang}
      setLang={setLang}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      onLogout={handleLogout}
    >
      <div style={{ display: "grid", gap: 20 }}>
        {error && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              padding: 13,
              borderRadius: 9,
              overflowWrap: "anywhere",
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              background: "#ecfdf5",
              color: "#047857",
              border: "1px solid #a7f3d0",
              padding: 13,
              borderRadius: 9,
              overflowWrap: "anywhere",
            }}
          >
            {notice}
          </div>
        )}

        {/* ==================== Dashboard ==================== */}

        {tab === "dashboard" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
              {[
                [
                  t("Assigned Orders", "à¦¬à¦°à¦¾à¦¦à§à¦¦ à¦…à¦°à§à¦¡à¦¾à¦°"),
                  orders.length,
                ],
                [
                  t("Pending", "à¦…à¦ªà§‡à¦•à§à¦·à¦®à¦¾à¦£"),
                  pendingCount,
                ],
                [
                  t("In Progress", "à¦šà¦²à¦®à¦¾à¦¨"),
                  confirmedCount,
                ],
                [
                  t("Cancelled", "à¦¬à¦¾à¦¤à¦¿à¦²"),
                  cancelledCount,
                ],
              ].map(([label, value]) => (
                <div key={label} style={cardStyle}>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      marginTop: 8,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <section style={cardStyle}>
              <h2 style={{ fontSize: 18, marginTop: 0 }}>
                {t(
                  "Recent Assigned Orders",
                  "à¦¸à¦¾à¦®à§à¦ªà§à¦°à¦¤à¦¿à¦• à¦¬à¦°à¦¾à¦¦à§à¦¦ à¦…à¦°à§à¦¡à¦¾à¦°"
                )}
              </h2>

              <p style={{ color: "#6b7280", fontSize: 13 }}>
                {t(
                  "Manage orders and courier progress from the sections below.",
                  "à¦¨à¦¿à¦šà§‡à¦° à¦¬à¦¿à¦­à¦¾à¦—à¦—à§à¦²à§‹ à¦¥à§‡à¦•à§‡ à¦…à¦°à§à¦¡à¦¾à¦° à¦“ à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦°à§‡à¦° à¦…à¦—à§à¦°à¦—à¦¤à¦¿ à¦ªà¦°à¦¿à¦šà¦¾à¦²à¦¨à¦¾ à¦•à¦°à§à¦¨à¥¤"
                )}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  style={primaryButton}
                  onClick={() => setTab("orders")}
                >
                  {t("View Orders", "à¦…à¦°à§à¦¡à¦¾à¦° à¦¦à§‡à¦–à§à¦¨")}
                </button>

                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => setTab("courier")}
                >
                  {t("Courier Orders", "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦°")}
                </button>

                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => setTab("history")}
                >
                  {t("Order History", "à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿")}
                </button>
              </div>
            </section>
          </>
        )}

        {/* ==================== Assigned Orders ==================== */}

        {tab === "orders" && (
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 18, margin: 0 }}>
                {t("Assigned Orders", "à¦¬à¦°à¦¾à¦¦à§à¦¦ à¦…à¦°à§à¦¡à¦¾à¦°")}
              </h2>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <select
                  aria-label="Filter orders"
                  value={orderFilter}
                  onChange={(event) =>
                    setOrderFilter(event.target.value)
                  }
                  style={{
                    ...buttonStyle,
                    maxWidth: "100%",
                  }}
                >
                  <option value="all">{t("All statuses", "à¦¸à¦¬ à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸")}</option>
                  <option value="pending">{t("Pending", "à¦…à¦ªà§‡à¦•à§à¦·à¦®à¦¾à¦£")}</option>
                  <option value="confirmed">{t("Confirmed", "à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤")}</option>
                  <option value="processing">{t("Processing", "à¦ªà§à¦°à¦¸à§‡à¦¸à¦¿à¦‚")}</option>
                  <option value="shipped">{t("Shipped", "à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¯à¦¼à§‡à¦›à§‡")}</option>
                  <option value="delivered">{t("Delivered", "à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨")}</option>
                  <option value="cancelled">{t("Cancelled", "à¦¬à¦¾à¦¤à¦¿à¦²")}</option>
                </select>

                <button
                  type="button"
                  style={buttonStyle}
                  onClick={loadOrders}
                  disabled={loading}
                >
                  {loading
                    ? t("Loading...", "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")
                    : t("Refresh", "à¦°à¦¿à¦«à§à¦°à§‡à¦¶")}
                </button>
              </div>
            </div>

            {loading && !ordersLoadedRef.current ? (
              <p>{t("Loading orders...", "à¦…à¦°à§à¦¡à¦¾à¦° à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>
            ) : visibleOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t("No orders found.", "à¦•à§‹à¦¨à§‹ à¦…à¦°à§à¦¡à¦¾à¦° à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤")}
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 620,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr style={{ textAlign: "left", background: "#f9fafb" }}>
                      {[
                        t("Order", "à¦…à¦°à§à¦¡à¦¾à¦°"),
                        t("Customer", "à¦•à§à¦°à§‡à¦¤à¦¾"),
                        t("Total", "à¦®à§‹à¦Ÿ"),
                        t("Status", "à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸"),
                        t("Actions", "à¦…à§à¦¯à¦¾à¦•à¦¶à¦¨"),
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: 12,
                            borderBottom: "1px solid #e5e7eb",
                            fontSize: 12,
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {visibleOrders.map((order, index) => {
                      const status = statusOf(order);
                      const orderId = idOf(order);

                      return (
                        <tr key={orderId || index}>
                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {order.orderNumber ||
                              `#${String(orderId || "").slice(-8)}`}
                          </td>

                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {getCustomerName(order)}
                          </td>

                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {money(order.total)}
                          </td>

                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            {status}
                          </td>

                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 7,
                                flexWrap: "wrap",
                              }}
                            >
                              {status === "pending" && (
                                <button
                                  type="button"
                                  style={successButton}
                                  disabled={saving}
                                  onClick={() =>
                                    updateStatus(order, "confirmed")
                                  }
                                >
                                  {t("Confirm", "à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à§à¦¨")}
                                </button>
                              )}

                              {["pending", "confirmed"].includes(status) && (
                                <button
                                  type="button"
                                  style={dangerButton}
                                  disabled={saving}
                                  onClick={() =>
                                    updateStatus(order, "cancelled")
                                  }
                                >
                                  {t("Cancel", "à¦¬à¦¾à¦¤à¦¿à¦²")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ==================== Courier Orders ==================== */}

        {tab === "courier" && (
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  {t("Courier Orders", "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦°")}
                </h2>

                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  {t(
                    "Update delivery status and complete paid orders.",
                    "à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿ à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸ à¦†à¦ªà¦¡à§‡à¦Ÿ à¦•à¦°à§à¦¨ à¦à¦¬à¦‚ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿à¦¤à§‡ à¦¨à¦¿à¦¨à¥¤"
                  )}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{
                    ...buttonStyle,
                    background: "#dc2626",
                    color: "#fff",
                    border: "1px solid #dc2626",
                  }}
                  disabled={loading || courierOrders.length === 0}
                  onClick={deleteAllCourierOrders}
                >
                  Delete All ({courierOrders.length})
                </button>

                <button
                type="button"
                style={buttonStyle}
                onClick={loadOrders}
                disabled={loading}
              >
                {loading
                  ? t("Loading...", "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")
                  : t("Refresh", "à¦°à¦¿à¦«à§à¦°à§‡à¦¶")}
              </button>
              </div>
            </div>

            {loading && !ordersLoadedRef.current ? (
              <p>{t("Loading orders...", "à¦…à¦°à§à¦¡à¦¾à¦° à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>
            ) : courierOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t(
                  "No courier orders found.",
                  "à¦•à§‹à¦¨à§‹ à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦…à¦°à§à¦¡à¦¾à¦° à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
                )}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {courierOrders.map((order, index) => {
                  const address = order?.shippingAddress || {};
                  const orderId = idOf(order);
                  const status = statusOf(order);
                  const paymentStatus = String(
                    order?.paymentStatus || "unpaid"
                  ).toLowerCase();

                  return (
                    <article
                      key={orderId || index}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 16 }}>
                            {order?.orderNumber ||
                              `#${String(orderId || "").slice(-8)}`}
                          </h3>

                          <p style={{ margin: "6px 0", color: "#6b7280" }}>
                            {getCustomerName(order)}
                          </p>
                        </div>

                        <span
                          style={{
                            background:
                              status === "delivered"
                                ? "#dcfce7"
                                : "#eff6ff",
                            color:
                              status === "delivered"
                                ? "#166534"
                                : "#1d4ed8",
                            padding: "5px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {status.toUpperCase()}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
                          marginTop: 14,
                        }}
                      >
                        <div>
                          <strong>{t("Phone", "à¦«à§‹à¦¨")}</strong>
                          <p style={{ margin: "5px 0" }}>
                            {address.phone || "N/A"}
                          </p>
                        </div>

                        <div>
                          <strong>{t("Delivery Address", "à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿ à¦ à¦¿à¦•à¦¾à¦¨à¦¾")}</strong>
                          <p
                            style={{
                              margin: "5px 0",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {[
                              address.addressLine,
                              address.city,
                            ].filter(Boolean).join(", ") || "N/A"}
                          </p>
                        </div>

                        <div>
                          <strong>{t("Payment Method", "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦ªà¦¦à§à¦§à¦¤à¦¿")}</strong>
                          <p style={{ margin: "5px 0" }}>
                            {order?.paymentMethodLabel ||
                              order?.paymentMethod ||
                              "N/A"}
                          </p>
                        </div>

                        <div>
                          <strong>{t("Payment Status", "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸")}</strong>
                          <p
                            style={{
                              margin: "5px 0",
                              color:
                                paymentStatus === "paid"
                                  ? "#047857"
                                  : "#b45309",
                              fontWeight: 700,
                            }}
                          >
                            {paymentStatus.toUpperCase()}
                          </p>

                          {paymentStatus === "failed" &&
                            order?.paymentRejectionReason && (
                              <p
                                style={{
                                  margin: "6px 0",
                                  color: "#dc2626",
                                  fontSize: 13,
                                  whiteSpace: "pre-wrap",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                <strong>
                                  {t("Rejection Reason:", "Reject à¦•à¦°à¦¾à¦° à¦•à¦¾à¦°à¦£:")}
                                </strong>{" "}
                                {order.paymentRejectionReason}
                              </p>
                            )}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#f9fafb",
                          borderRadius: 10,
                          padding: 12,
                          marginTop: 14,
                        }}
                      >
                        <strong>{t("Order Items", "à¦…à¦°à§à¦¡à¦¾à¦°à§‡à¦° à¦ªà¦£à§à¦¯")}</strong>

                        {Array.isArray(order?.items) && order.items.length ? (
                          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                            {order.items.map((item, itemIndex) => (
                              <li
                                key={item?._id || itemIndex}
                                style={{ marginTop: 5 }}
                              >
                                {item?.name ||
                                  item?.title ||
                                  item?.product?.name ||
                                  "Product"}
                                {" Ã— "}
                                {Number(item?.quantity || 1)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: "#6b7280" }}>
                            {t("No items listed.", "à¦•à§‹à¦¨à§‹ à¦ªà¦£à§à¦¯ à¦¨à§‡à¦‡à¥¤")}
                          </p>
                        )}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(110px, 1fr))",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        {[
                          [
                            t("Subtotal", "à¦¸à¦¾à¦¬à¦Ÿà§‹à¦Ÿà¦¾à¦²"),
                            order?.subtotal,
                          ],
                          [
                            t("Delivery Fee", "à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿ à¦šà¦¾à¦°à§à¦œ"),
                            order?.deliveryFee,
                          ],
                          [
                            t("COD Fee", "COD à¦šà¦¾à¦°à§à¦œ"),
                            order?.codFee,
                          ],
                          [
                            t("Order Total", "à¦®à§‹à¦Ÿ à¦…à¦°à§à¦¡à¦¾à¦°"),
                            order?.total,
                          ],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span
                              style={{
                                color: "#6b7280",
                                fontSize: 12,
                              }}
                            >
                              {label}
                            </span>
                            <div style={{ fontWeight: 700, marginTop: 4 }}>
                              {money(value)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {address.note && (
                        <p style={{ marginTop: 12, overflowWrap: "anywhere" }}>
                          <strong>
                            {t("Customer Note", "à¦•à§à¦°à§‡à¦¤à¦¾à¦° à¦¨à§‹à¦Ÿ")}:
                          </strong>{" "}
                          {address.note}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 16,
                        }}
                      >
                        <button
                          type="button"
                          style={primaryButton}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                getCourierBookingText(order)
                              );

                              setNotice(
                                t(
                                  "Courier booking details copied.",
                                  "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦¬à§à¦•à¦¿à¦‚à¦¯à¦¼à§‡à¦° à¦¤à¦¥à§à¦¯ à¦•à¦ªà¦¿ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤"
                                )
                              );
                              setError("");
                            } catch {
                              setError(
                                t(
                                  "Could not copy. Check clipboard permissions.",
                                  "à¦•à¦ªà¦¿ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤ à¦¬à§à¦°à¦¾à¦‰à¦œà¦¾à¦°à§‡à¦° clipboard permission à¦ªà¦°à§€à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨à¥¤"
                                )
                              );
                            }
                          }}
                        >
                          {t("Copy Courier Details", "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦¤à¦¥à§à¦¯ à¦•à¦ªà¦¿ à¦•à¦°à§à¦¨")}
                        </button>

                        {status === "confirmed" && (
                          <button
                            type="button"
                            style={successButton}
                            disabled={saving}
                            onClick={() =>
                              updateStatus(order, "processing")
                            }
                          >
                            {t("Mark Processing", "à¦ªà§à¦°à¦¸à§‡à¦¸à¦¿à¦‚ à¦¶à§à¦°à§ à¦•à¦°à§à¦¨")}
                          </button>
                        )}

                        {status === "processing" && (
                          <button
                            type="button"
                            style={successButton}
                            disabled={saving}
                            onClick={() =>
                              updateStatus(order, "shipped")
                            }
                          >
                            {t("Mark Shipped", "à¦¶à¦¿à¦ªà¦¡ à¦¹à¦¿à¦¸à§‡à¦¬à§‡ à¦šà¦¿à¦¹à§à¦¨à¦¿à¦¤ à¦•à¦°à§à¦¨")}
                          </button>
                        )}

                        {status === "shipped" && (
                          <button
                            type="button"
                            style={successButton}
                            disabled={saving}
                            onClick={() =>
                              updateStatus(order, "delivered")
                            }
                          >
                            {t("Mark Delivered", "à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦•à¦°à§à¦¨")}
                          </button>
                        )}

                        {status === "delivered" &&
                          String(order?.paymentMethod || "").toLowerCase() === "cod" &&
                          paymentStatus !== "paid" && (
                            <button
                              type="button"
                              style={successButton}
                              disabled={saving || Boolean(historyActionId)}
                              onClick={() => markCodAsPaid(order)}
                            >
                              {t("Mark as Paid", "Paid à¦¹à¦¿à¦¸à§‡à¦¬à§‡ à¦šà¦¿à¦¹à§à¦¨à¦¿à¦¤ à¦•à¦°à§à¦¨")}
                            </button>
                          )}

                        {status === "delivered" && paymentStatus === "paid" && (
                          <button
                            type="button"
                            style={successButton}
                            disabled={Boolean(historyActionId)}
                            onClick={() => completeOrder(order)}
                          >
                            {historyActionId === String(orderId)
                              ? t("Saving...", "à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦¹à¦šà§à¦›à§‡...")
                              : t("Done", "à¦¸à¦®à§à¦ªà¦¨à§à¦¨")}
                          </button>
                        )}

                        {["bkash", "nagad"].includes(
                          String(order?.paymentMethod || "").toLowerCase()
                        ) && paymentStatus === "pending" && (
                          <>
                            <button
                              type="button"
                              style={successButton}
                              disabled={saving || Boolean(historyActionId)}
                              onClick={() =>
                                updateModeratorPaymentStatus(order, "paid")
                              }
                            >
                              {t("Verify Payment", "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Verify à¦•à¦°à§à¦¨")}
                            </button>

                            <button
                              type="button"
                              style={dangerButton}
                              disabled={saving || Boolean(historyActionId)}
                              onClick={() =>
                                updateModeratorPaymentStatus(order, "failed")
                              }
                            >
                              {t("Reject Payment", "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ Reject à¦•à¦°à§à¦¨")}
                            </button>
                          </>
                        )}
                      
                        <button
                          type="button"
                          style={{
                            ...buttonStyle,
                            background: "#dc2626",
                            color: "#fff",
                            border: "1px solid #dc2626",
                          }}
                          disabled={saving || Boolean(historyActionId)}
                          onClick={() => deleteCourierOrder(orderId)}
                        >
                          Delete
                        </button>
</div>
                    </article>
                  );
                })}
              </div>
            )}

            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 18 }}>
              {t(
                "Copy Courier Details prepares text for manual booking. It does not create a courier booking or tracking number.",
                "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦¤à¦¥à§à¦¯ à¦•à¦ªà¦¿ à¦•à¦°à¦²à§‡ à¦®à§à¦¯à¦¾à¦¨à§à¦¯à¦¼à¦¾à¦² à¦¬à§à¦•à¦¿à¦‚à¦¯à¦¼à§‡à¦° à¦Ÿà§‡à¦•à§à¦¸à¦Ÿ à¦¤à§ˆà¦°à¦¿ à¦¹à¦¯à¦¼à¥¤ à¦à¦Ÿà¦¿ à¦¨à¦¿à¦œà§‡ à¦¥à§‡à¦•à§‡ à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦° à¦¬à§à¦•à¦¿à¦‚ à¦¬à¦¾ à¦Ÿà§à¦°à§à¦¯à¦¾à¦•à¦¿à¦‚ à¦¨à¦®à§à¦¬à¦° à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§‡ à¦¨à¦¾à¥¤"
              )}
            </p>
          </section>
        )}

        {/* ==================== Order History ==================== */}

        {tab === "history" && (
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  {t("Order History", "à¦…à¦°à§à¦¡à¦¾à¦° à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿")}
                </h2>

                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  {t(
                    "Completed and paid orders.",
                    "à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦à¦¬à¦‚ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦—à§à¦°à¦¹à¦£ à¦•à¦°à¦¾ à¦…à¦°à§à¦¡à¦¾à¦°à¥¤"
                  )}
                </p>
              </div>

              <button
                type="button"
                style={buttonStyle}
                disabled={historyLoading}
                onClick={loadOrderHistory}
              >
                {historyLoading
                  ? t("Loading...", "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")
                  : t("Refresh History", "à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦°à¦¿à¦«à§à¦°à§‡à¦¶")}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <input
                value={historySearch}
                onChange={(event) =>
                  setHistorySearch(event.target.value)
                }
                placeholder={t(
                  "Search order, customer, phone, email or transaction",
                  "à¦…à¦°à§à¦¡à¦¾à¦°, à¦•à§à¦°à§‡à¦¤à¦¾, à¦«à§‹à¦¨, à¦‡à¦®à§‡à¦‡à¦² à¦¬à¦¾ à¦Ÿà§à¦°à¦¾à¦¨à¦œà§à¦¯à¦¾à¦•à¦¶à¦¨ à¦–à§à¦à¦œà§à¦¨"
                )}
                style={{
                  ...inputStyle,
                  flex: "1 1 240px",
                }}
              />

              <select
                value={historyDateFilter}
                onChange={(event) =>
                  setHistoryDateFilter(event.target.value)
                }
                style={{
                  ...inputStyle,
                  width: "auto",
                  maxWidth: "100%",
                }}
              >
                <option value="all">{t("All dates", "à¦¸à¦¬ à¦¤à¦¾à¦°à¦¿à¦–")}</option>
                <option value="today">{t("Today", "à¦†à¦œ")}</option>
                <option value="7days">{t("Last 7 days", "à¦—à¦¤ à§­ à¦¦à¦¿à¦¨")}</option>
                <option value="30days">{t("Last 30 days", "à¦—à¦¤ à§©à§¦ à¦¦à¦¿à¦¨")}</option>
              </select>
            </div>

            <p style={{ color: "#6b7280", fontSize: 13 }}>
              {visibleOrderHistory.length} / {orderHistory.length}{" "}
              {t("orders", "à¦Ÿà¦¿ à¦…à¦°à§à¦¡à¦¾à¦°")}
            </p>

            {historyLoading && !historyLoadedRef.current ? (
              <p>{t("Loading History...", "à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>
            ) : visibleOrderHistory.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t(
                  "No History entries found.",
                  "à¦•à§‹à¦¨à§‹ à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
                )}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {visibleOrderHistory.map((item, index) => {
                  const historyId = idOf(item);
                  const busy =
                    historyActionId === String(historyId);

                  return (
                    <article
                      key={historyId || index}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 15,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                          <strong>
                            {item.orderNumber ||
                              `#${String(item.orderId || "").slice(-8)}`}
                          </strong>

                          <p style={{ margin: "7px 0" }}>
                            {item.customerName ||
                              item.shippingAddress?.fullName ||
                              "Customer"}
                          </p>

                          <p
                            style={{
                              margin: "5px 0",
                              color: "#6b7280",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {item.customerPhone ||
                              item.shippingAddress?.phone ||
                              item.customerEmail ||
                              item.shippingAddress?.email ||
                              "N/A"}
                          </p>
                        </div>

                        <div style={{ minWidth: 130 }}>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>
                            {money(item.total)}
                          </div>

                          <p style={{ margin: "6px 0" }}>
                            {t("Payment:", "à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ:")}{" "}
                            {item.paymentStatus || "N/A"}
                          </p>

                          <p style={{ margin: "5px 0" }}>
                            {t("Method:", "à¦ªà¦¦à§à¦§à¦¤à¦¿:")}{" "}
                            {item.paymentMethodLabel ||
                              item.paymentMethod ||
                              "N/A"}
                          </p>

                          <p style={{ margin: "5px 0" }}>
                            {t("Courier:", "à¦•à§à¦°à¦¿à¦¯à¦¼à¦¾à¦°:")}{" "}
                            {item.courier?.provider || "N/A"}
                          </p>

                          {item.courier?.consignmentId && (
                            <p
                              style={{
                                margin: "5px 0",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {t("Tracking ID:", "à¦Ÿà§à¦°à§à¦¯à¦¾à¦•à¦¿à¦‚ à¦†à¦‡à¦¡à¦¿:")}{" "}
                              {item.courier.consignmentId}
                            </p>
                          )}
                        </div>
                      </div>

                      <p
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {t("Completed:", "à¦¸à¦®à§à¦ªà¦¨à§à¦¨:")}{" "}
                        {item.completedAt
                          ? new Date(item.completedAt).toLocaleString(
                              lang === "bn" ? "bn-BD" : "en-US"
                            )
                          : "N/A"}
                      </p>

                      <button
                        type="button"
                        style={{
                          ...dangerButton,
                          opacity: busy ? 0.6 : 1,
                        }}
                        disabled={!historyId || Boolean(historyActionId)}
                        onClick={() =>
                          deleteHistoryEntry(historyId)
                        }
                      >
                        {busy
                          ? t("Deleting...", "à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦šà§à¦›à§‡...")
                          : t(
                              "Delete History Entry",
                              "à¦¹à¦¿à¦¸à§à¦Ÿà§‹à¦°à¦¿ à¦à¦¨à§à¦Ÿà§à¦°à¦¿ à¦®à§à¦›à§à¦¨"
                            )}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ==================== Customer Messages ==================== */}

        {tab === "messages" && (
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <h2 style={{ fontSize: 18, margin: 0 }}>
                {t("Customer Messages", "à¦—à§à¦°à¦¾à¦¹à¦•à§‡à¦° à¦¬à¦¾à¦°à§à¦¤à¦¾")}
              </h2>

              <button
                type="button"
                style={buttonStyle}
                onClick={loadMessages}
                disabled={loading || deletingAllMessages}
              >
                {loading
                  ? t("Loading...", "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")
                  : t("Refresh", "à¦°à¦¿à¦«à§à¦°à§‡à¦¶")}
              </button>
            </div>

            {/* Date filters */}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                marginTop: 18,
                padding: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                {t("Filter by date:", "à¦¤à¦¾à¦°à¦¿à¦– à¦…à¦¨à§à¦¯à¦¾à¦¯à¦¼à§€ à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦°:")}
              </label>

              <select
                value={messageDateFilter}
                onChange={(event) =>
                  setMessageDateFilter(event.target.value)
                }
                style={{
                  ...inputStyle,
                  width: "auto",
                  maxWidth: "100%",
                }}
              >
                <option value="all">{t("All dates", "à¦¸à¦¬ à¦¤à¦¾à¦°à¦¿à¦–")}</option>
                <option value="today">{t("Today", "à¦†à¦œ")}</option>
                <option value="7days">{t("Last 7 days", "à¦—à¦¤ à§­ à¦¦à¦¿à¦¨")}</option>
                <option value="30days">{t("Last 30 days", "à¦—à¦¤ à§©à§¦ à¦¦à¦¿à¦¨")}</option>
                <option value="custom">{t("Custom range", "à¦¨à¦¿à¦œà§‡à¦° à¦¤à¦¾à¦°à¦¿à¦–")}</option>
              </select>

              {messageDateFilter === "custom" && (
                <>
                  <label style={{ fontSize: 12, color: "#475569" }}>
                    {t("From", "à¦¶à§à¦°à§")}
                  </label>

                  <input
                    type="date"
                    value={messageStartDate}
                    max={messageEndDate || undefined}
                    onChange={(event) =>
                      setMessageStartDate(event.target.value)
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                    }}
                  />

                  <label style={{ fontSize: 12, color: "#475569" }}>
                    {t("To", "à¦¶à§‡à¦·")}
                  </label>

                  <input
                    type="date"
                    value={messageEndDate}
                    min={messageStartDate || undefined}
                    onChange={(event) =>
                      setMessageEndDate(event.target.value)
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                    }}
                  />

                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => {
                      setMessageStartDate("");
                      setMessageEndDate("");
                    }}
                  >
                    {t("Clear dates", "à¦¤à¦¾à¦°à¦¿à¦– à¦®à§à¦›à§à¦¨")}
                  </button>
                </>
              )}

              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                {filteredMessages.length} / {messages.length}{" "}
                {t("messages", "à¦Ÿà¦¿ à¦¬à¦¾à¦°à§à¦¤à¦¾")}
              </div>

              <button
                type="button"
                style={{
                  ...dangerButton,
                  opacity:
                    filteredMessages.length === 0 ||
                    deletingAllMessages ||
                    loading
                      ? 0.55
                      : 1,
                }}
                disabled={
                  filteredMessages.length === 0 ||
                  deletingAllMessages ||
                  loading ||
                  Boolean(deletingMessageId)
                }
                onClick={() =>
                  deleteFilteredMessages(filteredMessages)
                }
              >
                {deletingAllMessages
                  ? t("Deleting...", "à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦šà§à¦›à§‡...")
                  : t(
                      "Delete All Filtered Messages",
                      "à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦° à¦•à¦°à¦¾ à¦¸à¦¬ à¦¬à¦¾à¦°à§à¦¤à¦¾ à¦®à§à¦›à§à¦¨"
                    )}
              </button>
            </div>

            {/* Message list */}

            <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
              {loading && !messagesLoadedRef.current ? (
                <p>{t("Loading messages...", "à¦¬à¦¾à¦°à§à¦¤à¦¾ à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>
              ) : filteredMessages.length === 0 ? (
                <p style={{ color: "#6b7280" }}>
                  {t(
                    "No messages found for this date filter.",
                    "à¦à¦‡ à¦¤à¦¾à¦°à¦¿à¦–à§‡à¦° à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦°à§‡ à¦•à§‹à¦¨à§‹ à¦¬à¦¾à¦°à§à¦¤à¦¾ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
                  )}
                </p>
              ) : (
                filteredMessages.map((message, index) => {
                  const messageId = idOf(message);

                  const customer =
                    message?.name ||
                    message?.customer?.name ||
                    message?.user?.name ||
                    "Customer";

                  const publicReplies = (
                    Array.isArray(message.replies)
                      ? message.replies
                      : []
                  ).filter(
                    (entry) =>
                      String(entry.visibility || "public").toLowerCase() !==
                      "private"
                  );

                  return (
                    <article
                      key={messageId || index}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 15,
                        background: "#fff",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>
                            {customer}
                          </div>

                          {message.email && (
                            <div
                              style={{
                                fontSize: 13,
                                color: "#6b7280",
                                marginTop: 4,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {message.email}
                            </div>
                          )}

                          {message.createdAt && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#64748b",
                                marginTop: 5,
                              }}
                            >
                              {t("Submitted:", "à¦œà¦®à¦¾ à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡:")}{" "}
                              {new Date(message.createdAt).toLocaleString(
                                lang === "bn" ? "bn-BD" : "en-US"
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          style={{
                            ...dangerButton,
                            opacity:
                              deletingMessageId === String(messageId)
                                ? 0.6
                                : 1,
                          }}
                          disabled={
                            !messageId ||
                            Boolean(deletingMessageId) ||
                            deletingAllMessages
                          }
                          onClick={() => deleteFullMessage(message)}
                        >
                          {deletingMessageId === String(messageId)
                            ? t("Deleting...", "à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¾ à¦¹à¦šà§à¦›à§‡...")
                            : t("Delete Message", "à¦¬à¦¾à¦°à§à¦¤à¦¾ à¦®à§à¦›à§à¦¨")}
                        </button>
                      </div>

                      <p
                        style={{
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.6,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {message.message ||
                          message.content ||
                          message.text ||
                          ""}
                      </p>

                      {/* Public replies */}

                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          marginTop: 12,
                        }}
                      >
                        {publicReplies.map((entry, replyIndex) => (
                          <div
                            key={
                              entry._id ||
                              `${entry.senderRole}-${replyIndex}`
                            }
                            style={{
                              background:
                                entry.senderRole === "moderator"
                                  ? "#eff6ff"
                                  : "#f0fdf4",
                              border: "1px solid #dbe5ee",
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <strong>
                                {entry.senderRole === "moderator"
                                  ? t("Moderator", "à¦®à¦¡à¦¾à¦°à§‡à¦Ÿà¦°")
                                  : t("Support Team", "à¦¸à¦¾à¦ªà§‹à¦°à§à¦Ÿ à¦Ÿà¦¿à¦®")}
                              </strong>

                              {entry.createdAt && (
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: "#64748b",
                                  }}
                                >
                                  {new Date(entry.createdAt).toLocaleString(
                                    lang === "bn" ? "bn-BD" : "en-US"
                                  )}
                                </span>
                              )}
                            </div>

                            <p
                              style={{
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.6,
                                margin: "8px 0 0",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {entry.text}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Reply input */}

                      <textarea
                        rows={3}
                        value={replyDrafts[messageId] || ""}
                        onChange={(event) =>
                          setReplyDrafts((previous) => ({
                            ...previous,
                            [messageId]: event.target.value,
                          }))
                        }
                        placeholder={t(
                          "Write your reply...",
                          "à¦†à¦ªà¦¨à¦¾à¦° à¦‰à¦¤à§à¦¤à¦° à¦²à¦¿à¦–à§à¦¨..."
                        )}
                        style={{
                          ...inputStyle,
                          marginTop: 12,
                          resize: "vertical",
                          fontFamily: "inherit",
                        }}
                      />

                      <button
                        type="button"
                        style={{
                          ...primaryButton,
                          marginTop: 8,
                        }}
                        disabled={
                          saving ||
                          deletingAllMessages ||
                          Boolean(deletingMessageId)
                        }
                        onClick={() => sendReply(message)}
                      >
                        {saving
                          ? t("Saving...", "à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦¹à¦šà§à¦›à§‡...")
                          : t("Send Reply", "à¦‰à¦¤à§à¦¤à¦° à¦ªà¦¾à¦ à¦¾à¦¨")}
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ==================== Other Sections ==================== */}

        {tab === "attendance" && (
          <section style={{ display: "grid", gap: 16 }}>
            <div style={cardStyle}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}>
                <div>
                  <h2 style={{ margin: 0 }}>
                    {t("My Attendance", "à¦†à¦®à¦¾à¦° à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿")}
                  </h2>
                  <p style={{ color: "#6b7280", margin: "6px 0 0" }}>
                    {t("Daily shift, check-in and work summary",
                      "à¦¦à§ˆà¦¨à¦¿à¦• à¦¶à¦¿à¦«à¦Ÿ, à¦šà§‡à¦•-à¦‡à¦¨ à¦“ à¦•à¦¾à¦œà§‡à¦° à¦¹à¦¿à¦¸à¦¾à¦¬")}
                  </p>
                </div>
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={attendanceLoading}
                  onClick={() => loadAttendance(false)}
                >
                  {attendanceLoading
                    ? t("Refreshing...", "à¦°à¦¿à¦«à§à¦°à§‡à¦¶ à¦¹à¦šà§à¦›à§‡...")
                    : t("Refresh", "à¦°à¦¿à¦«à§à¦°à§‡à¦¶")}
                </button>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginTop: 18,
              }}>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 13 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {t("Shift", "à¦¶à¦¿à¦«à¦Ÿ")}
                  </div>
                  <strong>
                    {attendanceSettings?.shiftStart && attendanceSettings?.shiftEnd
                      ? `${attendanceSettings.shiftStart} â€“ ${attendanceSettings.shiftEnd}`
                      : t("Not configured", "à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ à¦•à¦°à¦¾ à¦¹à§Ÿà¦¨à¦¿")}
                  </strong>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 13 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {t("Timezone", "à¦Ÿà¦¾à¦‡à¦®à¦œà§‹à¦¨")}
                  </div>
                  <strong>{attendanceSettings?.timezone || "Asia/Dhaka"}</strong>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 13 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {t("Late grace", "à¦¦à§‡à¦°à¦¿à¦° à¦›à¦¾à§œ")}
                  </div>
                  <strong>
                    {Number(attendanceSettings?.lateGraceMinutes || 0)} {t("minutes", "à¦®à¦¿à¦¨à¦¿à¦Ÿ")}
                  </strong>
                </div>
              </div>

              {!attendanceSettings?.scheduleEnabled && (
                <p style={{
                  background: "#fff7ed",
                  color: "#9a3412",
                  borderRadius: 8,
                  padding: 12,
                  margin: "14px 0 0",
                }}>
                  {t(
                    "The attendance schedule is currently disabled by Admin. Check-in is unavailable until Admin enables and configures it.",
                    "à¦…à§à¦¯à¦¾à¦¡à¦®à¦¿à¦¨ à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨à§‡ à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿à¦° à¦¶à¦¿à¦¡à¦¿à¦‰à¦² à¦¬à¦¨à§à¦§ à¦°à§‡à¦–à§‡à¦›à§‡à¦¨à¥¤ à¦¶à¦¿à¦¡à¦¿à¦‰à¦² à¦šà¦¾à¦²à§ à¦“ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ à¦¨à¦¾ à¦•à¦°à¦¾ à¦ªà¦°à§à¦¯à¦¨à§à¦¤ Check In à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤"
                  )}
                </p>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>
                {t("Today's Attendance", "à¦†à¦œà¦•à§‡à¦° à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿")}
              </h3>

              {attendanceLoading && !todayAttendance ? (
                <p style={{ color: "#6b7280" }}>{t("Loading attendance...", "à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿à¦° à¦¤à¦¥à§à¦¯ à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>
              ) : (
                <>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Status", "à¦…à¦¬à¦¸à§à¦¥à¦¾")}
                      </div>
                      <strong style={{ textTransform: "capitalize" }}>
                        {todayAttendance?.status?.replaceAll("-", " ") ||
                          t("Not checked in", "à¦šà§‡à¦•-à¦‡à¦¨ à¦•à¦°à¦¾ à¦¹à§Ÿà¦¨à¦¿")}
                      </strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Check In", "à¦šà§‡à¦•-à¦‡à¦¨")}
                      </div>
                      <strong>{attendanceTime(todayAttendance?.checkIn)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Check Out", "à¦šà§‡à¦•-à¦†à¦‰à¦Ÿ")}
                      </div>
                      <strong>{attendanceTime(todayAttendance?.checkOut)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Late", "à¦¦à§‡à¦°à¦¿")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.lateMinutes)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Break", "à¦¬à¦¿à¦°à¦¤à¦¿")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.breakMinutes)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Working Time", "à¦•à¦¾à¦œà§‡à¦° à¦¸à¦®à§Ÿ")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.workingMinutes)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Overtime", "à¦…à¦¤à¦¿à¦°à¦¿à¦•à§à¦¤ à¦¸à¦®à§Ÿ")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.overtimeMinutes)}</strong>
                    </div>
                  </div>

                  {todayAttendance?.isWeeklyOff && (
                    <p style={{ color: "#92400e", marginBottom: 0 }}>
                      {t("Today is your weekly off day.", "à¦†à¦œ à¦†à¦ªà¦¨à¦¾à¦° à¦¸à¦¾à¦ªà§à¦¤à¦¾à¦¹à¦¿à¦• à¦›à§à¦Ÿà¦¿à¦° à¦¦à¦¿à¦¨à¥¤")}
                    </p>
                  )}

                  {transitionRemainingMs > 0 && (
                    <p style={{
                      background: "#fff7ed",
                      color: "#9a3412",
                      border: "1px solid #fed7aa",
                      borderRadius: 8,
                      padding: 12,
                      margin: "16px 0 0",
                      fontWeight: 600,
                    }}>
                      {t("Next work can start in", "à¦ªà¦°à¦¬à¦°à§à¦¤à§€ à¦•à¦¾à¦œ à¦¶à§à¦°à§ à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡")}{" "}
                      {String(Math.floor(transitionRemainingMs / 60000)).padStart(2, "0")}m{" "}
                      {String(Math.floor((transitionRemainingMs % 60000) / 1000)).padStart(2, "0")}s
                    </p>
                  )}

                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 18,
                  }}>
                    <button
                      type="button"
                      style={successButton}
                      disabled={
                        !!attendanceActionLoading ||
                        !!todayAttendance ||
                        !attendanceSettings?.scheduleEnabled ||
                        transitionRemainingMs > 0 ||
                        !attendanceSettings?.shiftStart ||
                        !attendanceSettings?.shiftEnd
                      }
                      onClick={() => runAttendanceAction("check-in", "/attendance/check-in")}
                    >
                      {attendanceActionLoading === "check-in"
                        ? t("Checking in...", "à¦šà§‡à¦•-à¦‡à¦¨ à¦¹à¦šà§à¦›à§‡...")
                        : t("Check In", "à¦šà§‡à¦•-à¦‡à¦¨")}
                    </button>

                    {todayAttendance && !todayAttendance.checkOut && (
                      <>
                        {todayAttendance.breaks?.some((item) => !item.endedAt) ? (
                          <button
                            type="button"
                            style={primaryButton}
                            disabled={!!attendanceActionLoading}
                            onClick={() => runAttendanceAction("break-end", "/attendance/break/end")}
                          >
                            {attendanceActionLoading === "break-end"
                              ? t("Ending break...", "à¦¬à¦¿à¦°à¦¤à¦¿ à¦¶à§‡à¦· à¦¹à¦šà§à¦›à§‡...")
                              : t("End Break", "à¦¬à¦¿à¦°à¦¤à¦¿ à¦¶à§‡à¦· à¦•à¦°à§à¦¨")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={buttonStyle}
                            disabled={!!attendanceActionLoading}
                            onClick={() => runAttendanceAction("break-start", "/attendance/break/start")}
                          >
                            {attendanceActionLoading === "break-start"
                              ? t("Starting break...", "à¦¬à¦¿à¦°à¦¤à¦¿ à¦¶à§à¦°à§ à¦¹à¦šà§à¦›à§‡...")
                              : t("Start Break", "à¦¬à¦¿à¦°à¦¤à¦¿ à¦¶à§à¦°à§ à¦•à¦°à§à¦¨")}
                          </button>
                        )}

                        <button
                          type="button"
                          style={dangerButton}
                          disabled={
                            !!attendanceActionLoading ||
                            !!todayAttendance.breaks?.some((item) => !item.endedAt)
                          }
                          onClick={() => {
                            if (window.confirm(t(
                              "Are you sure you want to check out?",
                              "à¦†à¦ªà¦¨à¦¿ à¦•à¦¿ Check Out à¦•à¦°à¦¤à§‡ à¦šà¦¾à¦¨?"
                            ))) {
                              runAttendanceAction("check-out", "/attendance/check-out");
                            }
                          }}
                        >
                          {attendanceActionLoading === "check-out"
                            ? t("Checking out...", "à¦šà§‡à¦•-à¦†à¦‰à¦Ÿ à¦¹à¦šà§à¦›à§‡...")
                            : t("Check Out", "à¦šà§‡à¦•-à¦†à¦‰à¦Ÿ")}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>
                {t("Attendance History", "à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿à¦° à¦‡à¦¤à¦¿à¦¹à¦¾à¦¸")}
              </h3>

              {attendanceHistory.length === 0 ? (
                <p style={{ color: "#6b7280" }}>
                  {t("No attendance records found.", "à¦•à§‹à¦¨à§‹ à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿à¦° à¦°à§‡à¦•à¦°à§à¦¡ à¦ªà¦¾à¦“à§Ÿà¦¾ à¦¯à¦¾à§Ÿà¦¨à¦¿à¥¤")}
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 650,
                    fontSize: 13,
                  }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        {[t("Date", "à¦¤à¦¾à¦°à¦¿à¦–"), t("Status", "à¦…à¦¬à¦¸à§à¦¥à¦¾"), t("Check In", "à¦šà§‡à¦•-à¦‡à¦¨"), t("Check Out", "à¦šà§‡à¦•-à¦†à¦‰à¦Ÿ"), t("Working", "à¦•à¦¾à¦œà§‡à¦° à¦¸à¦®à§Ÿ"), t("Overtime", "à¦…à¦¤à¦¿à¦°à¦¿à¦•à§à¦¤")].map((heading) => (
                          <th key={heading} style={{ padding: 11, borderBottom: "1px solid #e5e7eb" }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((item) => (
                        <tr key={item._id || item.workDate}>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{item.workDate || "â€”"}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>
                            {item.status?.replaceAll("-", " ") || "â€”"}
                          </td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{attendanceTime(item.checkIn)}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{attendanceTime(item.checkOut)}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{attendanceDuration(item.workingMinutes)}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{attendanceDuration(item.overtimeMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {["sales", "earnings", "profile"].includes(tab) && (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>{title}</h2>
            <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
              {t(
                "This section still needs to be connected to its backend endpoint.",
                "à¦à¦‡ à¦¬à¦¿à¦­à¦¾à¦—à¦Ÿà¦¿ à¦šà¦¾à¦²à§ à¦•à¦°à¦¤à§‡ à¦¸à¦‚à¦¶à§à¦²à¦¿à¦·à§à¦Ÿ à¦¬à§à¦¯à¦¾à¦•à¦à¦¨à§à¦¡ API à¦¯à§à¦•à§à¦¤ à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡à¥¤"
              )}
            </p>
          </section>
        )}      </div>
      <FloatingCalculator />
    </DashboardLayout>
  );
}
