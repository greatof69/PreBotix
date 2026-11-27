import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../shared/DashboardLayout";
import FloatingCalculator from "../shared/FloatingCalculator";
import ModeratorEarnings from "./ModeratorEarnings";
import SupplyDashboard from "../shared/SupplyDashboard";
import SupplyStockDashboard from "../shared/SupplyStockDashboard";
import ModeratorProductStockDashboard from "../shared/ModeratorProductStockDashboard";
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

const MODERATOR_ATTENDANCE_CACHE_KEY = "prebotix-moderator-attendance-v1";
const MODERATOR_ACTIVE_TAB_KEY = "prebotix-moderator-active-tab-v1";
const MODERATOR_VALID_TABS = [
  "dashboard",
  "orders",
  "courier",
  "supply",
  "supplyStock",
  "productStock",
  "history",
  "messages",
  "sales",
  "attendance",
  "earnings",
  "profile",
];

function readModeratorActiveTab() {
  try {
    const savedTab = window.localStorage.getItem(MODERATOR_ACTIVE_TAB_KEY);
    return MODERATOR_VALID_TABS.includes(savedTab) ? savedTab : "dashboard";
  } catch {
    return "dashboard";
  }
}

function saveModeratorActiveTab(tab) {
  try {
    if (MODERATOR_VALID_TABS.includes(tab)) {
      window.localStorage.setItem(MODERATOR_ACTIVE_TAB_KEY, tab);
    }
  } catch {}
}

function readModeratorAttendanceCache() {
  try {
    const raw = window.localStorage.getItem(MODERATOR_ATTENDANCE_CACHE_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function saveModeratorAttendanceCache(value) {
  try {
    window.localStorage.setItem(
      MODERATOR_ATTENDANCE_CACHE_KEY,
      JSON.stringify({ ...value, cachedAt: Date.now() })
    );
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

  const [tab, setTab] = useState(readModeratorActiveTab);
  const [allowedTabs, setAllowedTabs] = useState({
    dashboard: true,
    orders: true,
    courier: true,
    supply: true,
    supplyStock: true,
    productStock: true,
    history: true,
    messages: true,
    sales: true,
    attendance: true,
    earnings: true,
    profile: true,
  });

  // Restore and persist the moderator's last opened tab across page refreshes.
  useEffect(() => {
    saveModeratorActiveTab(tab);
  }, [tab]);

  const [orders, setOrders] = useState(() => readModeratorListCache("prebotix-moderator-orders-v1"));
  const [orderHistory, setOrderHistory] = useState(() => readModeratorListCache("prebotix-moderator-history-v1"));
  const [messages, setMessages] = useState(() => readModeratorListCache("prebotix-moderator-messages-v1"));
  const [todayAttendance, setTodayAttendance] = useState(() => readModeratorAttendanceCache()?.todayAttendance ?? null);
  const [attendanceHistory, setAttendanceHistory] = useState(() => readModeratorAttendanceCache()?.attendanceHistory ?? []);
  const [attendanceSettings, setAttendanceSettings] = useState(() => readModeratorAttendanceCache()?.attendanceSettings ?? null);
  const [transitionAvailableAt, setTransitionAvailableAt] = useState(() => readModeratorAttendanceCache()?.transitionAvailableAt ?? null);
  const [transitionClock, setTransitionClock] = useState(Date.now());
  const attendanceLoadedRef = useRef(!!readModeratorAttendanceCache());
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
    try {
      window.localStorage.removeItem(MODERATOR_ACTIVE_TAB_KEY);
    } catch {}
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

  // Admin-controlled tab visibility is loaded from the backend.
  // Backend middleware independently enforces the same permissions.
  useEffect(() => {
    let alive = true;
    request("/permissions")
      .then((data) => {
        if (!alive) return;
        const next = data?.tabs && typeof data.tabs === "object" ? data.tabs : {};
        setAllowedTabs((current) => ({ ...current, ...next }));
      })
      .catch((err) => {
        if (alive) console.error("Could not load moderator permissions:", err.message);
      });
    return () => { alive = false; };
  }, [request]);

  useEffect(() => {
    if (!allowedTabs[tab]) {
      const fallback = MODERATOR_VALID_TABS.find((item) => allowedTabs[item]);
      if (fallback) setTab(fallback);
    }
  }, [allowedTabs, tab]);

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
    // Use the cached attendance immediately; show a loader only on the very first load.
    if (!silent && !attendanceLoadedRef.current) setAttendanceLoading(true);

    try {
      const [todayData, historyData] = await Promise.all([
        request("/attendance/today"),
        request("/attendance"),
      ]);

      setTodayAttendance(todayData?.attendance || null);
      setAttendanceSettings(todayData?.settings || null);
      setTransitionAvailableAt(todayData?.transitionAvailableAt || null);
      setTransitionClock(Date.now());
      const nextAttendanceHistory = Array.isArray(historyData?.attendance)
        ? historyData.attendance
        : [];
      setAttendanceHistory(nextAttendanceHistory);
      saveModeratorAttendanceCache({
        todayAttendance: todayData?.attendance || null,
        attendanceHistory: nextAttendanceHistory,
        attendanceSettings: todayData?.settings || null,
        transitionAvailableAt: todayData?.transitionAvailableAt || null,
      });
      attendanceLoadedRef.current = true;
    } catch (err) {
      if (!silent) {
        setError(err.message || "Could not load attendance.");
      }
    } finally {
      setAttendanceLoading(false);
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


  const getWeeklyOffDaysText = (days) => {
    if (!Array.isArray(days)) {
      if (typeof days === "string") {
        days = days.split(",").map((day) => day.trim()).filter(Boolean);
      } else {
        return "â€”";
      }
    }

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const dayNamesBn = [
      "à¦°à¦¬à¦¿à¦¬à¦¾à¦°",
      "à¦¸à§‹à¦®à¦¬à¦¾à¦°",
      "à¦®à¦™à§à¦—à¦²à¦¬à¦¾à¦°",
      "à¦¬à§à¦§à¦¬à¦¾à¦°",
      "à¦¬à§ƒà¦¹à¦¸à§à¦ªà¦¤à¦¿à¦¬à¦¾à¦°",
      "à¦¶à§à¦•à§à¦°à¦¬à¦¾à¦°",
      "à¦¶à¦¨à¦¿à¦¬à¦¾à¦°",
    ];

    if (!days.length) return "â€”";

    return days
      .map((day) => {
        // Admin saves weekday indexes: 0 = Sunday, 6 = Saturday
        if (Number.isInteger(day) && day >= 0 && day <= 6) {
          return lang === "bn" ? dayNamesBn[day] : dayNames[day];
        }

        // Also support weekday names if returned as strings
        const index = dayNames.findIndex(
          (name) => name.toLowerCase() === String(day).trim().toLowerCase()
        );

        if (index !== -1) {
          return lang === "bn" ? dayNamesBn[index] : dayNames[index];
        }

        return String(day);
      })
      .join(", ");
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

    const timer =
      tab === "earnings"
        ? null
        : window.setInterval(() => loadActiveTab(true), 15000);

    return () => {
      if (timer) window.clearInterval(timer);
    };
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
      id: "supplyStock",
      label: t("Supply Stock", "à¦¸à¦¾à¦ªà§à¦²à¦¾à¦‡ à¦¸à§à¦Ÿà¦•"),
      labelBn: "à¦¸à¦¾à¦ªà§à¦²à¦¾à¦‡ à¦¸à§à¦Ÿà¦•",
      icon: "ðŸ“¦",
    },
    {
      id: "productStock",
      label: t("Product Stock", "প্রোডাক্ট স্টক"),
      labelBn: "প্রোডাক্ট স্টক",
      icon: "📦",
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
  ].filter((item) => allowedTabs[item.id]);

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
    String(order?.courier?.provider || "").toLowerCase() === "pathao" &&
    Boolean(String(order?.courier?.consignmentId || "").trim())
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
                  {t("Pathao Tracking", "Pathao à¦Ÿà§à¦°à§à¦¯à¦¾à¦•à¦¿à¦‚")}
                </h2>
                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  {t(
                    "View Pathao bookings created by Admin. This section is read-only.",
                    "Admin-à¦à¦° à¦¤à§ˆà¦°à¦¿ Pathao booking à¦¦à§‡à¦–à§à¦¨à¥¤ à¦à¦‡ à¦¬à¦¿à¦­à¦¾à¦—à¦Ÿà¦¿ à¦¶à§à¦§à§ à¦¦à§‡à¦–à¦¾à¦° à¦œà¦¨à§à¦¯à¥¤"
                  )}
                </p>
              </div>

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

            {loading && !ordersLoadedRef.current ? (
              <p>{t("Loading orders...", "à¦…à¦°à§à¦¡à¦¾à¦° à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>
            ) : courierOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t(
                  "No Pathao bookings found. Orders appear here after Admin creates a booking.",
                  "à¦•à§‹à¦¨à§‹ Pathao booking à¦ªà¦¾à¦“à§Ÿà¦¾ à¦¯à¦¾à§Ÿà¦¨à¦¿à¥¤ Admin booking à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦²à§‡ à¦à¦–à¦¾à¦¨à§‡ à¦¦à§‡à¦–à¦¾ à¦¯à¦¾à¦¬à§‡à¥¤"
                )}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {courierOrders.map((order, index) => {
                  const address = order?.shippingAddress || {};
                  const courier = order?.courier || {};
                  const orderId = idOf(order);
                  const courierStatus =
                    courier.orderStatus ||
                    courier.orderStatusSlug ||
                    (courier.bookingStatus === "booked" ? "Booked" : "N/A");

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
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            padding: "5px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {String(courierStatus).toUpperCase()}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
                            {[address.addressLine, address.city]
                              .filter(Boolean)
                              .join(", ") || "N/A"}
                          </p>
                        </div>

                        <div>
                          <strong>Consignment ID</strong>
                          <p
                            style={{
                              margin: "5px 0",
                              overflowWrap: "anywhere",
                              fontWeight: 700,
                            }}
                          >
                            {courier.consignmentId}
                          </p>
                        </div>

                        <div>
                          <strong>{t("Pathao Charge", "Pathao à¦šà¦¾à¦°à§à¦œ")}</strong>
                          <p style={{ margin: "5px 0", fontWeight: 700 }}>
                            {money(courier.deliveryFee)}
                          </p>
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
                              <li key={item?._id || itemIndex} style={{ marginTop: 5 }}>
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

                      {address.note && (
                        <p style={{ marginTop: 12, overflowWrap: "anywhere" }}>
                          <strong>{t("Customer Note", "à¦•à§à¦°à§‡à¦¤à¦¾à¦° à¦¨à§‹à¦Ÿ")}:</strong>{" "}
                          {address.note}
                        </p>
                      )}

                      {courier.trackingUrl ? (
                        <a
                          href={courier.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-block",
                            marginTop: 14,
                            color: "#1d4ed8",
                            fontWeight: 700,
                          }}
                        >
                          {t("Track Parcel", "à¦ªà¦¾à¦°à§à¦¸à§‡à¦² à¦Ÿà§à¦°à§à¦¯à¦¾à¦• à¦•à¦°à§à¦¨")} â†—
                        </a>
                      ) : (
                        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 14 }}>
                          {t(
                            "Tracking link is not available yet. Use the Consignment ID to check the parcel with Pathao.",
                            "Tracking link à¦à¦–à¦¨à§‹ à¦ªà¦¾à¦“à§Ÿà¦¾ à¦¯à¦¾à§Ÿà¦¨à¦¿à¥¤ Consignment ID à¦¦à¦¿à§Ÿà§‡ Pathao-à¦¤à§‡ à¦ªà¦¾à¦°à§à¦¸à§‡à¦² à¦šà§‡à¦• à¦•à¦°à§à¦¨à¥¤"
                          )}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
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

        {tab === "supply" && <SupplyDashboard request={request} lang={lang} />}

        {tab === "supplyStock" && (
          <SupplyStockDashboard request={request} lang={lang} />
        )}

        {tab === "productStock" && (
          <ModeratorProductStockDashboard request={request} lang={lang} />
        )}

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
          <section style={cardStyle}>
            <h2 style={{ margin: 0 }}>
              {t("Work Attendance", "à¦•à¦¾à¦œà§‡à¦° à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿")}
            </h2>

            <div style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                {t("REQUIRED WORK TIME", "à¦ªà§à¦°à§Ÿà§‹à¦œà¦¨à§€à§Ÿ à¦•à¦¾à¦œà§‡à¦° à¦¸à¦®à§Ÿ")}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 7 }}>
                {attendanceSettings?.shiftStart && attendanceSettings?.shiftEnd
                  ? `${attendanceSettings.shiftStart} â€“ ${attendanceSettings.shiftEnd}`
                  : t("Not configured by Admin", "Admin à¦à¦–à¦¨à§‹ à¦¸à¦®à§Ÿ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ à¦•à¦°à§‡à¦¨à¦¨à¦¿")}
              </div>
              {attendanceSettings?.shiftStart && attendanceSettings?.shiftEnd && (
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
                  {t("Required duration", "à¦®à§‹à¦Ÿ à¦•à¦¾à¦œà§‡à¦° à¦¸à¦®à§Ÿ")}:{" "}
                  {attendanceDuration((() => {
                    const [startHour, startMinute] = attendanceSettings.shiftStart.split(":").map(Number);
                    const [endHour, endMinute] = attendanceSettings.shiftEnd.split(":").map(Number);
                    const startMinutes = startHour * 60 + startMinute;
                    let endMinutes = endHour * 60 + endMinute;
                    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
                    return endMinutes - startMinutes;
                  })())}
                </div>            
              )}

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t("WEEKLY OFF DAYS", "à¦¸à¦¾à¦ªà§à¦¤à¦¾à¦¹à¦¿à¦• à¦›à§à¦Ÿà¦¿à¦° à¦¦à¦¿à¦¨")}
                </div>

                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginTop: 7,
                    color: "#dc2626",
                  }}
                >
                  {getWeeklyOffDaysText(attendanceSettings?.weeklyOffDays)}
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 12,
              padding: 13,
              borderRadius: 10,
              background: "#eff6ff",
              color: "#1e40af",
              fontSize: 13,
              lineHeight: 1.65,
            }}>
              <strong>{t("Work Rules", "à¦•à¦¾à¦œà§‡à¦° à¦¨à¦¿à§Ÿà¦®")}</strong>
              <div>
                {t(
                  "à¦•à¦¾à¦œ à¦¶à§à¦°à§ à¦•à¦°à¦²à§‡ Present à¦à¦¬à¦‚ à¦•à¦¾à¦œ à¦¶à§‡à¦· à¦•à¦°à¦²à§‡ End à¦šà¦¾à¦ªà§à¦¨à¥¤",
                  "à¦•à¦¾à¦œ à¦¶à§à¦°à§ à¦•à¦°à¦²à§‡ Present à¦à¦¬à¦‚ à¦•à¦¾à¦œ à¦¶à§‡à¦· à¦•à¦°à¦²à§‡ End à¦šà¦¾à¦ªà§à¦¨à¥¤"
                )}
              </div>
            </div>

            {!attendanceSettings?.scheduleEnabled && (
              <p style={{
                color: "#9a3412",
                background: "#fff7ed",
                borderRadius: 8,
                padding: 10,
                margin: "12px 0 0",
                fontSize: 13,
              }}>
                {t(
                  "Attendance is not available until Admin enables and configures your schedule.",
                  "Admin à¦¶à¦¿à¦¡à¦¿à¦‰à¦² à¦šà¦¾à¦²à§ à¦“ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£ à¦¨à¦¾ à¦•à¦°à¦¾ à¦ªà¦°à§à¦¯à¦¨à§à¦¤ à¦‰à¦ªà¦¸à§à¦¥à¦¿à¦¤à¦¿ à¦¦à§‡à¦“à§Ÿà¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤"
                )}
              </p>
            )}

            {attendanceLoading && !attendanceSettings ? (
              <p style={{ color: "#64748b", marginBottom: 0 }}>
                {t("Loading work time...", "à¦•à¦¾à¦œà§‡à¦° à¦¸à¦®à§Ÿ à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}
              </p>
            ) : (
              <div style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 16,
              }}>
                {!todayAttendance && (
                  <button
                    type="button"
                    style={successButton}
                    disabled={
                      !!attendanceActionLoading ||
                      !attendanceSettings?.scheduleEnabled ||
                      !attendanceSettings?.shiftStart ||
                      !attendanceSettings?.shiftEnd ||
                      transitionRemainingMs > 0
                    }
                    onClick={() => runAttendanceAction("check-in", "/attendance/check-in")}
                  >
                    {attendanceActionLoading === "check-in"
                      ? t("Please wait...", "à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨...")
                      : t("Present", "Present")}
                  </button>
                )}

                {todayAttendance && !todayAttendance.checkOut && (
                  <button
                    type="button"
                    style={dangerButton}
                    disabled={!!attendanceActionLoading}
                    onClick={() => runAttendanceAction("check-out", "/attendance/check-out")}
                  >
                    {attendanceActionLoading === "check-out"
                      ? t("Please wait...", "à¦…à¦ªà§‡à¦•à§à¦·à¦¾ à¦•à¦°à§à¦¨...")
                      : t("End", "End")}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "earnings" && <ModeratorEarnings request={request} lang={lang} />}

        {["sales", "profile"].includes(tab) && (
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>{title}</h2>
            <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
              {t(
                "This section still needs to be connected to its backend endpoint.",
                "à¦à¦‡ à¦¬à¦¿à¦­à¦¾à¦—à¦Ÿà¦¿ à¦šà¦¾à¦²à§ à¦•à¦°à¦¤à§‡ à¦¸à¦‚à¦¶à§à¦²à¦¿à¦·à§à¦Ÿ API à¦¯à§à¦•à§à¦¤ à¦•à¦°à¦¤à§‡ à¦¹à¦¬à§‡à¥¤"
              )}
            </p>
          </section>
        )}      </div>
      <FloatingCalculator />
    </DashboardLayout>
  );
}


