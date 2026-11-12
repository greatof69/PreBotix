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
  return `৳${Number(value || 0).toLocaleString("en-BD")}`;
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
          t("Could not load orders.", "অর্ডার লোড করা যায়নি।")
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
        "এই কুরিয়ার অর্ডারটি মুছবেন? এটি ফিরিয়ে আনা যাবে না।"
      )
    );
    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await request(`/courier-orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });

      setNotice(t("Courier order deleted.", "কুরিয়ার অর্ডার মুছে ফেলা হয়েছে।"));
      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not delete courier order.");
    }
  }, [request, loadOrders, lang]);

  const deleteAllCourierOrders = useCallback(async () => {
    const typed = window.prompt(
      t(
        "You are about to permanently delete ALL courier orders. Type DELETE to confirm.",
        "আপনি সব কুরিয়ার অর্ডার স্থায়ীভাবে মুছতে যাচ্ছেন। নিশ্চিত করতে DELETE লিখুন।"
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
          "সব কুরিয়ার অর্ডার মুছে ফেলা হয়েছে।"
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
            "অর্ডার হিস্টোরি লোড করা যায়নি।"
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
      setError(t("Order ID is missing.", "অর্ডার আইডি পাওয়া যায়নি।"));
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
          "শুধু Delivered এবং Paid অর্ডার হিস্টোরিতে নেওয়া যাবে।"
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
          "অর্ডার সফলভাবে হিস্টোরিতে যোগ হয়েছে।"
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
            "অর্ডার হিস্টোরিতে নেওয়া যায়নি।"
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
        "শুধু Delivered এবং Unpaid COD অর্ডার Paid করা যাবে।"
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
        "COD-এর টাকা পাওয়া গেছে। Payment Paid হয়েছে। এখন Done চাপতে পারবেন।"
      ));
      await loadOrders();
    } catch (err) {
      setError(err.message || t(
        "Could not mark COD payment as paid.",
        "COD পেমেন্ট Paid করা যায়নি।"
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
        "শুধু Pending bKash/Nagad পেমেন্ট Verify অথবা Reject করা যাবে।"
      ));
      return;
    }

    if (saving || historyActionId) return;

    let reason = "";

    if (paymentStatus === "failed") {
      const enteredReason = window.prompt(
        t(
          "Enter payment rejection reason (1–500 characters):",
          "পেমেন্ট Reject করার কারণ লিখুন (১–৫০০ অক্ষর):"
        )
      );

      if (enteredReason === null) return;

      reason = enteredReason.trim();

      if (!reason || reason.length > 500) {
        setError(t(
          "Rejection reason must contain 1–500 characters.",
          "Reject করার কারণ ১–৫০০ অক্ষরের মধ্যে হতে হবে।"
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
              "পেমেন্ট Verify হয়েছে। Admin ও Moderator Dashboard-এ আপডেটেড স্ট্যাটাস দেখা যাবে।"
            )
          : t(
              "Payment rejected successfully. The rejection reason has been saved.",
              "পেমেন্ট Reject হয়েছে। Reject করার কারণ সংরক্ষণ করা হয়েছে।"
            )
      );

      await loadOrders();
    } catch (err) {
      setError(err.message || t(
        "Could not update payment status.",
        "পেমেন্ট স্ট্যাটাস আপডেট করা যায়নি।"
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
          "হিস্টোরি এন্ট্রি মুছে ফেলা হয়েছে। মূল অর্ডার অপরিবর্তিত আছে।"
        )
      );
    } catch (err) {
      setError(
        err.message ||
          t(
            "Could not delete History entry.",
            "হিস্টোরি এন্ট্রি মুছতে সমস্যা হয়েছে।"
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
        t("Order ID is missing.", "অর্ডার আইডি পাওয়া যায়নি।")
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
        t("Invalid order status.", "অর্ডারের স্ট্যাটাস সঠিক নয়।")
      );
      return;
    }

    if (saving) return;

    let reason = "";

    if (status === "cancelled") {
      const confirmed = window.confirm(
        t(
          "Are you sure you want to cancel this order?",
          "আপনি কি নিশ্চিত যে এই অর্ডারটি বাতিল করতে চান?"
        )
      );

      if (!confirmed) return;

      reason =
        window.prompt(
          t(
            "Enter the cancellation reason:",
            "অর্ডার বাতিলের কারণ লিখুন:"
          )
        ) || "";

      if (!reason.trim()) {
        setError(
          t(
            "Cancellation reason is required.",
            "অর্ডার বাতিলের কারণ লিখতে হবে।"
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
          "অর্ডার নিশ্চিত হয়েছে।",
        ],
        processing: [
          "Order marked as processing.",
          "অর্ডার প্রসেসিং হিসেবে চিহ্নিত হয়েছে।",
        ],
        shipped: [
          "Order marked as shipped.",
          "অর্ডার পাঠানো হয়েছে।",
        ],
        delivered: [
          "Order marked as delivered.",
          "অর্ডার ডেলিভারি সম্পন্ন হয়েছে।",
        ],
        cancelled: [
          "Order cancelled successfully.",
          "অর্ডার বাতিল হয়েছে।",
        ],
      };

      setNotice(t(...messages[status]));

      await loadOrders();
    } catch (err) {
      setError(
        err.message ||
          t("Could not update order.", "অর্ডার আপডেট করা যায়নি।")
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
          t("Could not load messages.", "মেসেজ লোড করা যায়নি।")
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
          "আগে একটি উত্তর লিখুন।"
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
          "উত্তর সফলভাবে পাঠানো হয়েছে।"
        )
      );

      await loadMessages();
    } catch (err) {
      setError(
        err.message ||
          t("Could not send reply.", "উত্তর পাঠানো যায়নি।")
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
        "এই গ্রাহকের মেসেজটি মুছবেন?"
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
          "মেসেজ মুছে ফেলা হয়েছে।"
        )
      );
    } catch (err) {
      setError(
        err.message ||
          t("Could not delete message.", "মেসেজ মুছতে সমস্যা হয়েছে।")
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
          `${ids.length}টি মেসেজ মুছে ফেলা হয়েছে।`
        )
      );
    } catch (err) {
      setError(
        err.message ||
          t(
            "Could not delete all filtered messages.",
            "ফিল্টার করা সব মেসেজ মুছতে সমস্যা হয়েছে।"
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
    if (!value) return "—";

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
      label: t("Dashboard", "ড্যাশবোর্ড"),
      labelBn: "ড্যাশবোর্ড",
      icon: "▦",
    },
    {
      id: "orders",
      label: t("Assigned Orders", "বরাদ্দ অর্ডার"),
      labelBn: "বরাদ্দ অর্ডার",
      icon: "▤",
    },
    {
      id: "courier",
      label: t("Courier Orders", "কুরিয়ার অর্ডার"),
      labelBn: "কুরিয়ার অর্ডার",
      icon: "📦",
    },
    {
      id: "history",
      label: t("Order History", "অর্ডার হিস্টোরি"),
      labelBn: "অর্ডার হিস্টোরি",
      icon: "🗂️",
    },
    {
      id: "messages",
      label: t("Customer Messages", "গ্রাহকের বার্তা"),
      labelBn: "গ্রাহকের বার্তা",
      icon: "✉",
    },
    {
      id: "sales",
      label: t("My Sales", "আমার বিক্রয়"),
      labelBn: "আমার বিক্রয়",
      icon: "↗",
    },
    {
      id: "attendance",
      label: t("Attendance", "উপস্থিতি"),
      labelBn: "উপস্থিতি",
      icon: "◷",
    },
    {
      id: "earnings",
      label: t("Earnings", "আয়"),
      labelBn: "আয়",
      icon: "৳",
    },
    {
      id: "profile",
      label: t("Profile", "প্রোফাইল"),
      labelBn: "প্রোফাইল",
      icon: "♙",
    },
  ];

  const title =
    navItems.find((item) => item.id === tab)?.label ||
    t("Moderator Dashboard", "মডারেটর ড্যাশবোর্ড");

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
        "আপনার বরাদ্দ কাজ পরিচালনা করুন"
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
                  t("Assigned Orders", "বরাদ্দ অর্ডার"),
                  orders.length,
                ],
                [
                  t("Pending", "অপেক্ষমাণ"),
                  pendingCount,
                ],
                [
                  t("In Progress", "চলমান"),
                  confirmedCount,
                ],
                [
                  t("Cancelled", "বাতিল"),
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
                  "সাম্প্রতিক বরাদ্দ অর্ডার"
                )}
              </h2>

              <p style={{ color: "#6b7280", fontSize: 13 }}>
                {t(
                  "Manage orders and courier progress from the sections below.",
                  "নিচের বিভাগগুলো থেকে অর্ডার ও কুরিয়ারের অগ্রগতি পরিচালনা করুন।"
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
                  {t("View Orders", "অর্ডার দেখুন")}
                </button>

                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => setTab("courier")}
                >
                  {t("Courier Orders", "কুরিয়ার অর্ডার")}
                </button>

                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => setTab("history")}
                >
                  {t("Order History", "অর্ডার হিস্টোরি")}
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
                {t("Assigned Orders", "বরাদ্দ অর্ডার")}
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
                  <option value="all">{t("All statuses", "সব স্ট্যাটাস")}</option>
                  <option value="pending">{t("Pending", "অপেক্ষমাণ")}</option>
                  <option value="confirmed">{t("Confirmed", "নিশ্চিত")}</option>
                  <option value="processing">{t("Processing", "প্রসেসিং")}</option>
                  <option value="shipped">{t("Shipped", "পাঠানো হয়েছে")}</option>
                  <option value="delivered">{t("Delivered", "ডেলিভারি সম্পন্ন")}</option>
                  <option value="cancelled">{t("Cancelled", "বাতিল")}</option>
                </select>

                <button
                  type="button"
                  style={buttonStyle}
                  onClick={loadOrders}
                  disabled={loading}
                >
                  {loading
                    ? t("Loading...", "লোড হচ্ছে...")
                    : t("Refresh", "রিফ্রেশ")}
                </button>
              </div>
            </div>

            {loading && !ordersLoadedRef.current ? (
              <p>{t("Loading orders...", "অর্ডার লোড হচ্ছে...")}</p>
            ) : visibleOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t("No orders found.", "কোনো অর্ডার পাওয়া যায়নি।")}
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
                        t("Order", "অর্ডার"),
                        t("Customer", "ক্রেতা"),
                        t("Total", "মোট"),
                        t("Status", "স্ট্যাটাস"),
                        t("Actions", "অ্যাকশন"),
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
                                  {t("Confirm", "নিশ্চিত করুন")}
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
                                  {t("Cancel", "বাতিল")}
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
                  {t("Courier Orders", "কুরিয়ার অর্ডার")}
                </h2>

                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  {t(
                    "Update delivery status and complete paid orders.",
                    "ডেলিভারি স্ট্যাটাস আপডেট করুন এবং পেমেন্ট সম্পন্ন অর্ডার হিস্টোরিতে নিন।"
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
                  ? t("Loading...", "লোড হচ্ছে...")
                  : t("Refresh", "রিফ্রেশ")}
              </button>
              </div>
            </div>

            {loading && !ordersLoadedRef.current ? (
              <p>{t("Loading orders...", "অর্ডার লোড হচ্ছে...")}</p>
            ) : courierOrders.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t(
                  "No courier orders found.",
                  "কোনো কুরিয়ার অর্ডার পাওয়া যায়নি।"
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
                          <strong>{t("Phone", "ফোন")}</strong>
                          <p style={{ margin: "5px 0" }}>
                            {address.phone || "N/A"}
                          </p>
                        </div>

                        <div>
                          <strong>{t("Delivery Address", "ডেলিভারি ঠিকানা")}</strong>
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
                          <strong>{t("Payment Method", "পেমেন্ট পদ্ধতি")}</strong>
                          <p style={{ margin: "5px 0" }}>
                            {order?.paymentMethodLabel ||
                              order?.paymentMethod ||
                              "N/A"}
                          </p>
                        </div>

                        <div>
                          <strong>{t("Payment Status", "পেমেন্ট স্ট্যাটাস")}</strong>
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
                                  {t("Rejection Reason:", "Reject করার কারণ:")}
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
                        <strong>{t("Order Items", "অর্ডারের পণ্য")}</strong>

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
                                {" × "}
                                {Number(item?.quantity || 1)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: "#6b7280" }}>
                            {t("No items listed.", "কোনো পণ্য নেই।")}
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
                            t("Subtotal", "সাবটোটাল"),
                            order?.subtotal,
                          ],
                          [
                            t("Delivery Fee", "ডেলিভারি চার্জ"),
                            order?.deliveryFee,
                          ],
                          [
                            t("COD Fee", "COD চার্জ"),
                            order?.codFee,
                          ],
                          [
                            t("Order Total", "মোট অর্ডার"),
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
                            {t("Customer Note", "ক্রেতার নোট")}:
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
                                  "কুরিয়ার বুকিংয়ের তথ্য কপি হয়েছে।"
                                )
                              );
                              setError("");
                            } catch {
                              setError(
                                t(
                                  "Could not copy. Check clipboard permissions.",
                                  "কপি করা যায়নি। ব্রাউজারের clipboard permission পরীক্ষা করুন।"
                                )
                              );
                            }
                          }}
                        >
                          {t("Copy Courier Details", "কুরিয়ার তথ্য কপি করুন")}
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
                            {t("Mark Processing", "প্রসেসিং শুরু করুন")}
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
                            {t("Mark Shipped", "শিপড হিসেবে চিহ্নিত করুন")}
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
                            {t("Mark Delivered", "ডেলিভারি সম্পন্ন করুন")}
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
                              {t("Mark as Paid", "Paid হিসেবে চিহ্নিত করুন")}
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
                              ? t("Saving...", "সংরক্ষণ হচ্ছে...")
                              : t("Done", "সম্পন্ন")}
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
                              {t("Verify Payment", "পেমেন্ট Verify করুন")}
                            </button>

                            <button
                              type="button"
                              style={dangerButton}
                              disabled={saving || Boolean(historyActionId)}
                              onClick={() =>
                                updateModeratorPaymentStatus(order, "failed")
                              }
                            >
                              {t("Reject Payment", "পেমেন্ট Reject করুন")}
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
                "কুরিয়ার তথ্য কপি করলে ম্যানুয়াল বুকিংয়ের টেক্সট তৈরি হয়। এটি নিজে থেকে কুরিয়ার বুকিং বা ট্র্যাকিং নম্বর তৈরি করে না।"
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
                  {t("Order History", "অর্ডার হিস্টোরি")}
                </h2>

                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  {t(
                    "Completed and paid orders.",
                    "সম্পন্ন এবং পেমেন্ট গ্রহণ করা অর্ডার।"
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
                  ? t("Loading...", "লোড হচ্ছে...")
                  : t("Refresh History", "হিস্টোরি রিফ্রেশ")}
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
                  "অর্ডার, ক্রেতা, ফোন, ইমেইল বা ট্রানজ্যাকশন খুঁজুন"
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
                <option value="all">{t("All dates", "সব তারিখ")}</option>
                <option value="today">{t("Today", "আজ")}</option>
                <option value="7days">{t("Last 7 days", "গত ৭ দিন")}</option>
                <option value="30days">{t("Last 30 days", "গত ৩০ দিন")}</option>
              </select>
            </div>

            <p style={{ color: "#6b7280", fontSize: 13 }}>
              {visibleOrderHistory.length} / {orderHistory.length}{" "}
              {t("orders", "টি অর্ডার")}
            </p>

            {historyLoading && !historyLoadedRef.current ? (
              <p>{t("Loading History...", "হিস্টোরি লোড হচ্ছে...")}</p>
            ) : visibleOrderHistory.length === 0 ? (
              <p style={{ color: "#6b7280" }}>
                {t(
                  "No History entries found.",
                  "কোনো হিস্টোরি পাওয়া যায়নি।"
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
                            {t("Payment:", "পেমেন্ট:")}{" "}
                            {item.paymentStatus || "N/A"}
                          </p>

                          <p style={{ margin: "5px 0" }}>
                            {t("Method:", "পদ্ধতি:")}{" "}
                            {item.paymentMethodLabel ||
                              item.paymentMethod ||
                              "N/A"}
                          </p>

                          <p style={{ margin: "5px 0" }}>
                            {t("Courier:", "কুরিয়ার:")}{" "}
                            {item.courier?.provider || "N/A"}
                          </p>

                          {item.courier?.consignmentId && (
                            <p
                              style={{
                                margin: "5px 0",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {t("Tracking ID:", "ট্র্যাকিং আইডি:")}{" "}
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
                        {t("Completed:", "সম্পন্ন:")}{" "}
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
                          ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                          : t(
                              "Delete History Entry",
                              "হিস্টোরি এন্ট্রি মুছুন"
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
                {t("Customer Messages", "গ্রাহকের বার্তা")}
              </h2>

              <button
                type="button"
                style={buttonStyle}
                onClick={loadMessages}
                disabled={loading || deletingAllMessages}
              >
                {loading
                  ? t("Loading...", "লোড হচ্ছে...")
                  : t("Refresh", "রিফ্রেশ")}
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
                {t("Filter by date:", "তারিখ অনুযায়ী ফিল্টার:")}
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
                <option value="all">{t("All dates", "সব তারিখ")}</option>
                <option value="today">{t("Today", "আজ")}</option>
                <option value="7days">{t("Last 7 days", "গত ৭ দিন")}</option>
                <option value="30days">{t("Last 30 days", "গত ৩০ দিন")}</option>
                <option value="custom">{t("Custom range", "নিজের তারিখ")}</option>
              </select>

              {messageDateFilter === "custom" && (
                <>
                  <label style={{ fontSize: 12, color: "#475569" }}>
                    {t("From", "শুরু")}
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
                    {t("To", "শেষ")}
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
                    {t("Clear dates", "তারিখ মুছুন")}
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
                {t("messages", "টি বার্তা")}
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
                  ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                  : t(
                      "Delete All Filtered Messages",
                      "ফিল্টার করা সব বার্তা মুছুন"
                    )}
              </button>
            </div>

            {/* Message list */}

            <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
              {loading && !messagesLoadedRef.current ? (
                <p>{t("Loading messages...", "বার্তা লোড হচ্ছে...")}</p>
              ) : filteredMessages.length === 0 ? (
                <p style={{ color: "#6b7280" }}>
                  {t(
                    "No messages found for this date filter.",
                    "এই তারিখের ফিল্টারে কোনো বার্তা পাওয়া যায়নি।"
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
                              {t("Submitted:", "জমা দেওয়া হয়েছে:")}{" "}
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
                            ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                            : t("Delete Message", "বার্তা মুছুন")}
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
                                  ? t("Moderator", "মডারেটর")
                                  : t("Support Team", "সাপোর্ট টিম")}
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
                          "আপনার উত্তর লিখুন..."
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
                          ? t("Saving...", "সংরক্ষণ হচ্ছে...")
                          : t("Send Reply", "উত্তর পাঠান")}
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
                    {t("My Attendance", "আমার উপস্থিতি")}
                  </h2>
                  <p style={{ color: "#6b7280", margin: "6px 0 0" }}>
                    {t("Daily shift, check-in and work summary",
                      "দৈনিক শিফট, চেক-ইন ও কাজের হিসাব")}
                  </p>
                </div>
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={attendanceLoading}
                  onClick={() => loadAttendance(false)}
                >
                  {attendanceLoading
                    ? t("Refreshing...", "রিফ্রেশ হচ্ছে...")
                    : t("Refresh", "রিফ্রেশ")}
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
                    {t("Shift", "শিফট")}
                  </div>
                  <strong>
                    {attendanceSettings?.shiftStart && attendanceSettings?.shiftEnd
                      ? `${attendanceSettings.shiftStart} – ${attendanceSettings.shiftEnd}`
                      : t("Not configured", "নির্ধারণ করা হয়নি")}
                  </strong>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 13 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {t("Timezone", "টাইমজোন")}
                  </div>
                  <strong>{attendanceSettings?.timezone || "Asia/Dhaka"}</strong>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 13 }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {t("Late grace", "দেরির ছাড়")}
                  </div>
                  <strong>
                    {Number(attendanceSettings?.lateGraceMinutes || 0)} {t("minutes", "মিনিট")}
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
                    "অ্যাডমিন বর্তমানে উপস্থিতির শিডিউল বন্ধ রেখেছেন। শিডিউল চালু ও নির্ধারণ না করা পর্যন্ত Check In করা যাবে না।"
                  )}
                </p>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>
                {t("Today's Attendance", "আজকের উপস্থিতি")}
              </h3>

              {attendanceLoading && !todayAttendance ? (
                <p style={{ color: "#6b7280" }}>{t("Loading attendance...", "উপস্থিতির তথ্য লোড হচ্ছে...")}</p>
              ) : (
                <>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Status", "অবস্থা")}
                      </div>
                      <strong style={{ textTransform: "capitalize" }}>
                        {todayAttendance?.status?.replaceAll("-", " ") ||
                          t("Not checked in", "চেক-ইন করা হয়নি")}
                      </strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Check In", "চেক-ইন")}
                      </div>
                      <strong>{attendanceTime(todayAttendance?.checkIn)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Check Out", "চেক-আউট")}
                      </div>
                      <strong>{attendanceTime(todayAttendance?.checkOut)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Late", "দেরি")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.lateMinutes)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Break", "বিরতি")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.breakMinutes)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Working Time", "কাজের সময়")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.workingMinutes)}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {t("Overtime", "অতিরিক্ত সময়")}
                      </div>
                      <strong>{attendanceDuration(todayAttendance?.overtimeMinutes)}</strong>
                    </div>
                  </div>

                  {todayAttendance?.isWeeklyOff && (
                    <p style={{ color: "#92400e", marginBottom: 0 }}>
                      {t("Today is your weekly off day.", "আজ আপনার সাপ্তাহিক ছুটির দিন।")}
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
                      {t("Global transition gap ends in", "Global transition gap শেষ হবে")}{" "}
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

                        !attendanceSettings?.shiftStart ||
                        !attendanceSettings?.shiftEnd
                      }
                      onClick={() => runAttendanceAction("check-in", "/attendance/check-in")}
                    >
                      {attendanceActionLoading === "check-in"
                        ? t("Checking in...", "চেক-ইন হচ্ছে...")
                        : t("Check In", "চেক-ইন")}
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
                              ? t("Ending break...", "বিরতি শেষ হচ্ছে...")
                              : t("End Break", "বিরতি শেষ করুন")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={buttonStyle}
                            disabled={!!attendanceActionLoading}
                            onClick={() => runAttendanceAction("break-start", "/attendance/break/start")}
                          >
                            {attendanceActionLoading === "break-start"
                              ? t("Starting break...", "বিরতি শুরু হচ্ছে...")
                              : t("Start Break", "বিরতি শুরু করুন")}
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
                              "আপনি কি Check Out করতে চান?"
                            ))) {
                              runAttendanceAction("check-out", "/attendance/check-out");
                            }
                          }}
                        >
                          {attendanceActionLoading === "check-out"
                            ? t("Checking out...", "চেক-আউট হচ্ছে...")
                            : t("Check Out", "চেক-আউট")}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>
                {t("Attendance History", "উপস্থিতির ইতিহাস")}
              </h3>

              {attendanceHistory.length === 0 ? (
                <p style={{ color: "#6b7280" }}>
                  {t("No attendance records found.", "কোনো উপস্থিতির রেকর্ড পাওয়া যায়নি।")}
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
                        {[t("Date", "তারিখ"), t("Status", "অবস্থা"), t("Check In", "চেক-ইন"), t("Check Out", "চেক-আউট"), t("Working", "কাজের সময়"), t("Overtime", "অতিরিক্ত")].map((heading) => (
                          <th key={heading} style={{ padding: 11, borderBottom: "1px solid #e5e7eb" }}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((item) => (
                        <tr key={item._id || item.workDate}>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{item.workDate || "—"}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>
                            {item.status?.replaceAll("-", " ") || "—"}
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
                "এই বিভাগটি চালু করতে সংশ্লিষ্ট ব্যাকএন্ড API যুক্ত করতে হবে।"
              )}
            </p>
          </section>
        )}      </div>
      <FloatingCalculator />
    </DashboardLayout>
  );
}