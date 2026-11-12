import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../shared/DashboardLayout";
import { clearAuthSession, getAccessToken, authFetch } from "../../utils/authSession";
import FloatingCalculator from "../shared/FloatingCalculator";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 20,
  minWidth: 0,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fff",
};

const buttonStyle = {
  padding: "9px 13px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: "#2563eb",
  borderColor: "#2563eb",
  color: "#fff",
};

const dangerButtonStyle = {
  ...buttonStyle,
  background: "#dc2626",
  borderColor: "#dc2626",
  color: "#fff",
};

const successButtonStyle = {
  ...buttonStyle,
  background: "#059669",
  borderColor: "#059669",
  color: "#fff",
};

function formatBDT(value) {
  const amount = Number(value || 0);
  return `৳${amount.toLocaleString("en-BD")}`;
}

function getId(item) {
  return item?._id || item?.id;
}

function getOrderStatus(order) {
  return String(order?.status || "pending").toLowerCase();
}

function getOrderCustomer(order) {
  return (
    order?.customer?.name ||
    order?.user?.name ||
    order?.customerName ||
    order?.name ||
    "Customer"
  );
}

function getOrderTotal(order) {
  return order?.total ?? order?.totalAmount ?? order?.amount ?? 0;
}

function getOrderList(data) {
  if (Array.isArray(data)) return data;
  return data?.orders || data?.items || data?.data || [];
}

function getUserList(data) {
  if (Array.isArray(data)) return data;
  return data?.users || data?.items || data?.data || [];
}

function readAdminListCache(key) {
  try {
    const cached = window.localStorage.getItem(key);
    const parsed = cached ? JSON.parse(cached) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAdminListCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Could not save admin list cache:", err);
  }
}

function readAdminSettingsCache(key, fallback) {
  try {
    const cached = window.localStorage.getItem(key);
    const parsed = cached ? JSON.parse(cached) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...fallback, ...parsed }
      : fallback;
  } catch {
    return fallback;
  }
}

function hasAdminSettingsCache(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    return !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function saveAdminSettingsCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Could not save admin settings cache:", err);
  }
}
function isMessageInDateRange(createdAt, filter, startDate, endDate) {
  if (filter === "all") return true;
  if (!createdAt) return false;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (filter === "today") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date >= today && date < tomorrow;
  }

  if (filter === "7days" || filter === "30days") {
    const from = new Date(today);
    from.setDate(from.getDate() - (filter === "7days" ? 6 : 29));
    return date >= from && date <= now;
  }

  if (filter === "custom") {
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


function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 18, margin: 0 }}>{children}</h2>
      {right}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: "#6b7280",
        background: "#f9fafb",
        borderRadius: 10,
      }}
    >
      {children}
    </div>
  );
}

export default function AdminDashboard({
  lang = "en",
  setLang,
  mobileOpen = false,
  setMobileOpen,
}) {
  const navigate = useNavigate();

  const [tab, setTab] = useState("orders");

  const [orders, setOrders] = useState(() =>
    readAdminListCache("prebotix-admin-orders-v1")
  );
  const [orderHistory, setOrderHistory] = useState(() =>
    readAdminListCache("prebotix-admin-history-v1")
  );
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyActionId, setHistoryActionId] = useState("");
  const [deletingAllHistory, setDeletingAllHistory] = useState(false);
  const [users, setUsers] = useState(() =>
    readAdminListCache("prebotix-admin-users-v1")
  );
  const [messages, setMessages] = useState(() =>
    readAdminListCache("prebotix-admin-messages-v1")
  );
  const [stockProducts, setStockProducts] = useState(() => {
    try {
      const cached = window.localStorage.getItem("prebotix-admin-stock-catalog-v1");
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [stockCatalogLoaded, setStockCatalogLoaded] = useState(false);
  const [stockNotifications, setStockNotifications] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockEditId, setStockEditId] = useState(null);
  const [stockEditValue, setStockEditValue] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockSavingId, setStockSavingId] = useState(null);
  const [paymentDeliverySettings, setPaymentDeliverySettings] = useState(() => readAdminSettingsCache("prebotix-admin-payment-delivery-v1", {
    paymentMethods: [],
    deliveryZones: [],
    freeDeliveryThreshold: 0,
    codFee: 0,
    checkoutTitle: "Payment & Delivery",
    checkoutTitleBn: "পেমেন্ট ও ডেলিভারি",
    checkoutInstructions: "",
    checkoutInstructionsBn: "",
  }));
  
  const [loadingPaymentDelivery, setLoadingPaymentDelivery] = useState(false);
  const [paymentDeliverySettingsLoaded, setPaymentDeliverySettingsLoaded] = useState(true)
  const [generalSettings, setGeneralSettings] = useState(() => readAdminSettingsCache("prebotix-admin-general-settings-v1", {
    websiteName: "PreBotix",
    logo: "",
    favicon: "",
    siteDescription: "",
  }));
  const [announcementSettings, setAnnouncementSettings] = useState(() => readAdminSettingsCache("prebotix-admin-announcements-v1", {
  announcement: "",
  announcementBn: "",
  announcement1: "",
  announcement1Bn: "",
}));

const [savingAnnouncements, setSavingAnnouncements] = useState(false);
  const [loadingGeneralSettings, setLoadingGeneralSettings] = useState(false);
  const [generalSettingsLoaded, setGeneralSettingsLoaded] = useState(true)
  const [savingGeneralSettings, setSavingGeneralSettings] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState("");
  useEffect(() => {
    if (!generalSettingsLoaded) return;
    saveAdminSettingsCache("prebotix-admin-general-settings-v1", generalSettings);
    saveAdminSettingsCache("prebotix-admin-announcements-v1", announcementSettings);
  }, [generalSettings, announcementSettings, generalSettingsLoaded]);

  useEffect(() => {
    if (!paymentDeliverySettingsLoaded) return;
    saveAdminSettingsCache("prebotix-admin-payment-delivery-v1", paymentDeliverySettings);
  }, [paymentDeliverySettings, paymentDeliverySettingsLoaded]);

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");


  const [orderFilter, setOrderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [messageDateFilter, setMessageDateFilter] = useState("all");
  const [messageStartDate, setMessageStartDate] = useState("");
  const [messageEndDate, setMessageEndDate] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [deletingAllMessages, setDeletingAllMessages] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState("");
  const [deletingAllOrders, setDeletingAllOrders] = useState(false);

  const t = (en, bn) => (lang === "bn" ? bn : en);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
    window.location.reload();
  };

  const request = useCallback(async (path, options = {}) => {
    const token = getAccessToken();

    if (!token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await authFetch(`${API}/api/admin${path}`, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
      },
    });

    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Request failed (${response.status})`
      );
    }

    return data;
  }, []);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingOrders(true);

    try {
      const data = await request("/orders");
      const nextOrders = getOrderList(data);
      setOrders(nextOrders);
      saveAdminListCache("prebotix-admin-orders-v1", nextOrders);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load orders.");
    } finally {
      if (!silent) setLoadingOrders(false);
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
    setMessage("");

    try {
      await request(`/courier-orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });

      setMessage(t("Courier order deleted.", "কুরিয়ার অর্ডার মুছে ফেলা হয়েছে।"));
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
    setMessage("");

    try {
      await request("/courier-orders", {
        method: "DELETE",
      });

      setMessage(
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

  const loadOrderHistory = useCallback(async ({ silent = false } = {}) => {
  if (!silent) setHistoryLoading(true);

  try {
    const data = await request("/order-history");
    const nextHistory = Array.isArray(data)
      ? data
      : data?.history || data?.items || data?.data || [];
    setOrderHistory(nextHistory);
    saveAdminListCache("prebotix-admin-history-v1", nextHistory);
  } catch (err) {
    if (!silent) setError(err.message || "Could not load order history.");
  } finally {
    if (!silent) setHistoryLoading(false);
  }
}, [request]);

const completeOrder = async (order) => {
  const orderId = getId(order);

  if (!orderId) {
    setError("Order ID is missing.");
    return;
  }

  const paymentStatus = String(order?.paymentStatus || "unpaid").toLowerCase();

  if (
    getOrderStatus(order) !== "delivered" ||
    paymentStatus !== "paid"
  ) {
    setError("Only delivered and paid orders can be completed.");
    return;
  }

  setHistoryActionId(orderId);
  setError("");
  setMessage("");

  try {
    await request(`/orders/${orderId}/done`, { method: "POST" });
    setMessage("Order added to History successfully.");
    await Promise.all([loadOrders(), loadOrderHistory()]);
  } catch (err) {
    setError(err.message || "Could not complete this order.");
  } finally {
    setHistoryActionId("");
  }
};

const deleteHistoryEntry = async (historyId) => {

  setHistoryActionId(historyId);
  setError("");

  try {
    await request(`/order-history/${historyId}`, { method: "DELETE" });
    setOrderHistory((previous) =>
      previous.filter((item) => item._id !== historyId)
    );
    setMessage("History entry deleted. The original order was not deleted.");
  } catch (err) {
    setError(err.message || "Could not delete History entry.");
  } finally {
    setHistoryActionId("");
  }
};

const deleteAllHistory = async () => {

  setDeletingAllHistory(true);
  setError("");

  try {
    await request("/order-history", { method: "DELETE" });
    setOrderHistory([]);
    setMessage("All History entries deleted.");
  } catch (err) {
    setError(err.message || "Could not delete Order History.");
  } finally {
    setDeletingAllHistory(false);
  }
};

  const loadUsers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingUsers(true);

    try {
      const data = await request("/users");
      const nextUsers = getUserList(data);
      setUsers(nextUsers);
      saveAdminListCache("prebotix-admin-users-v1", nextUsers);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load users.");
    } finally {
      if (!silent) setLoadingUsers(false);
    }
  }, [request]);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await request("/messages");
      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);
      saveAdminListCache("prebotix-admin-messages-v1", nextMessages);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load messages.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [request]);


  useEffect(() => {
    if (!stockCatalogLoaded) return;

    try {
      window.localStorage.setItem(
        "prebotix-admin-stock-catalog-v1",
        JSON.stringify(stockProducts)
      );
    } catch (err) {
      console.warn("Could not cache stock catalog:", err);
    }
  }, [stockProducts, stockCatalogLoaded]);
  const loadStockNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await request("/stock-notifications");
      setStockNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load stock notifications.");
    }
  }, [request]);

  const loadStockCatalog = useCallback(async ({ silent = false } = {}) => {
    let hasCachedCatalog = false;
    try {
      const cached = window.localStorage.getItem("prebotix-admin-stock-catalog-v1");
      hasCachedCatalog = cached !== null && Array.isArray(JSON.parse(cached));
    } catch {
      hasCachedCatalog = false;
    }

    if (!silent && !hasCachedCatalog) setLoadingStock(true);
    if (!silent) setError("");

    try {
      const productData = await request("/products");
      setStockProducts(Array.isArray(productData.products) ? productData.products : []);
      setStockCatalogLoaded(true);
    } catch (err) {
      if (!silent) setError(err.message || "Could not load product stock catalog.");
    }

    try {
      const notificationData = await request("/stock-notifications");
      setStockNotifications(Array.isArray(notificationData.notifications) ? notificationData.notifications : []);
    } catch (err) {
      if (!silent) console.warn("Could not load stock notifications:", err);
    } finally {
      if (!silent) setLoadingStock(false);
    }
  }, [request]);

  const saveStockQuantity = useCallback(async (product) => {
    const productId = String(product.id);
    const newStock = Number(stockEditValue);

    if (!Number.isSafeInteger(newStock) || newStock < 0) {
      setError(t("Enter a valid stock quantity (0 or more).", "সঠিক স্টক সংখ্যা লিখুন (০ বা তার বেশি)।"));
      return;
    }

    setStockSavingId(productId);
    setError("");
    setMessage("");

    try {
      const data = await request(`/products/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: newStock }),
      });

      const updatedProduct = data.product || data.data?.product || null;

      setStockProducts((previous) =>
        previous.map((item) =>
          String(item.id) === productId
            ? { ...item, ...(updatedProduct || {}), stock: newStock }
            : item
        )
      );

      setStockEditId(null);
      setStockEditValue("");
      setMessage(t("Stock quantity updated.", "স্টকের পরিমাণ আপডেট হয়েছে।"));
    } catch (err) {
      setError(err.message || "Could not update stock quantity.");
    } finally {
      setStockSavingId(null);
    }
  }, [request, stockEditValue, t]);

  const toggleStockAvailability = useCallback(async (product) => {
    const productId = String(product.id);
    const newStock = Number(product.stock) > 0 ? 0 : 1;

    setStockSavingId(productId);
    setError("");
    setMessage("");

    try {
      const data = await request(`/products/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: newStock }),
      });

      const updatedProduct = data.product || data.data?.product || null;

      setStockProducts((previous) =>
        previous.map((item) =>
          String(item.id) === productId
            ? { ...item, ...(updatedProduct || {}), stock: newStock }
            : item
        )
      );

      setMessage(
        newStock > 0
          ? t("Product marked In Stock.", "পণ্যটি স্টকে আছে হিসেবে সেট হয়েছে।")
          : t("Product marked Out of Stock.", "পণ্যটি স্টক শেষ হিসেবে সেট হয়েছে।")
      );
    } catch (err) {
      setError(err.message || "Could not update stock availability.");
    } finally {
      setStockSavingId(null);
    }
  }, [request, t]);


  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyVisibility, setReplyVisibility] = useState({});
  const [replyingId, setReplyingId] = useState(null);

  const replyToMessage = useCallback(async (item) => {
    const id = item._id || item.id;
    const reply = (replyDrafts[id] || "").trim();
    const visibility = replyVisibility[id] || "public";

    if (!reply) {
      setError(t("Please write a reply first.", "আগে উত্তর লিখুন।"));
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(`/messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          reply,
          visibility,
          status: "replied",
        }),
      });

      setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      setReplyVisibility((prev) => ({ ...prev, [id]: "public" }));
      setReplyingId(null);

      setMessage(
        visibility === "private"
          ? t(
            "Private reply saved. Moderator cannot see it.",
            "প্রাইভেট উত্তর সংরক্ষিত হয়েছে। মডারেটর দেখতে পারবেন না।"
          )
          : t("Reply sent successfully.", "উত্তর পাঠানো হয়েছে।")
      );

      await loadMessages();
    } catch (err) {
      setError(err.message || t("Could not send reply.", "উত্তর পাঠানো যায়নি।"));
    } finally {
      setSaving(false);
    }
  }, [replyDrafts, replyVisibility, request, loadMessages, lang]);

const deleteFullMessage = async (item) => {
  const id = getId(item);

  if (!id || deletingMessageId || deletingAllMessages) return;

  setDeletingMessageId(id);
  setError("");
  setMessage("");

  try {
    await request(`/messages/${id}`, {
      method: "DELETE",
    });

    setMessages((prev) =>
      prev.filter((messageItem) => String(getId(messageItem)) !== String(id))
    );

    setReplyDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setReplyVisibility((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (String(replyingId) === String(id)) {
      setReplyingId(null);
    }

    setMessage(
      t(
        "Customer message and all replies deleted.",
        "কাস্টমার মেসেজ ও সব উত্তর মুছে ফেলা হয়েছে।"
      )
    );
  } catch (err) {
    setError(
      err.message ||
        t(
          "Could not delete customer message.",
          "মেসেজ মুছতে সমস্যা হয়েছে।"
        )
    );
  } finally {
    setDeletingMessageId(null);
  }
};


const deleteFilteredMessages = async () => {
  if (deletingAllMessages || deletingMessageId) return;

  const ids = filteredMessages.map(getId).filter(Boolean);

  if (ids.length === 0) return;

  setDeletingAllMessages(true);
  setError("");
  setMessage("");

  try {
    for (let i = 0; i < ids.length; i += 200) {
      await request("/messages/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: ids.slice(i, i + 200) }),
      });
    }

    const deletedIds = new Set(ids);

    setMessages((prev) =>
      prev.filter((item) => !deletedIds.has(getId(item)))
    );

    setReplyDrafts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });

    setReplyVisibility((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });

    setReplyingId(null);

    setMessage(
      t(
        `${ids.length} customer messages and their replies deleted.`,
        `${ids.length}টি কাস্টমার মেসেজ ও সব উত্তর মুছে ফেলা হয়েছে।`
      )
    );
  } catch (err) {
    setError(
      err.message ||
        t("Could not delete filtered messages.", "মেসেজ মুছতে সমস্যা হয়েছে।")
    );
    await loadMessages();
  } finally {
    setDeletingAllMessages(false);
  }
};



  const loadGeneralSettings = useCallback(async () => {
    setLoadingGeneralSettings(true);
    setError("");

    try {
      const data = await request("/storefront-settings");
      setGeneralSettings({
        websiteName: data?.settings?.general?.websiteName || "PreBotix",
        logo: data?.settings?.general?.logo || "",
        favicon: data?.settings?.general?.favicon || "",
        siteDescription: data?.settings?.general?.siteDescription || "",
      });
      setAnnouncementSettings({
        announcement: data?.settings?.announcement || "",
        announcementBn: data?.settings?.announcementBn || "",
        announcement1: data?.settings?.announcement1 || "",
        announcement1Bn: data?.settings?.announcement1Bn || "",
      });
      setGeneralSettingsLoaded(true);
    } catch (err) {
      setError(err.message || "Could not load general settings.");
    } finally {
      setLoadingGeneralSettings(false);
    }
  }, [request]);

  const saveGeneralSettings = async () => {
    setSavingGeneralSettings(true);
    setError("");
    setMessage("");

    try {
      const data = await request("/storefront-settings", {
        method: "PUT",
        body: JSON.stringify({ general: generalSettings }),
      });

      setGeneralSettings({
        websiteName: data?.settings?.general?.websiteName || generalSettings.websiteName,
        logo: data?.settings?.general?.logo || "",
        favicon: data?.settings?.general?.favicon || "",
        siteDescription: data?.settings?.general?.siteDescription || "",
      });
      setMessage("General settings saved successfully.");
    } catch (err) {
      setError(err.message || "Could not save general settings.");
    } finally {
      setSavingGeneralSettings(false);
    }
  };

  const saveAnnouncementSettings = async () => {
  setSavingAnnouncements(true);
  setError("");
  setMessage("");

  try {
    await request("/storefront-settings", {
      method: "PUT",
      body: JSON.stringify(announcementSettings),
    });

    setMessage("Announcement settings saved successfully.");
  } catch (err) {
    setError(err.message || "Could not save announcements.");
  } finally {
    setSavingAnnouncements(false);
  }
};

  const uploadGeneralAsset = async (asset, file) => {
    if (!file) return;

    setUploadingAsset(asset);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await authFetch(
        `${API}/api/admin/storefront-settings/upload/${asset}`,
        {
          method: "POST",
          body: formData,
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
        throw new Error(data?.message || `Upload failed (${response.status}).`);
      }

      const savedGeneral = data?.settings?.general || {};
      setGeneralSettings((current) => ({
        ...current,
        [asset]: savedGeneral[asset] || current[asset],
      }));
      setMessage(`${asset === "logo" ? "Logo" : "Favicon"} uploaded successfully.`);
    } catch (err) {
      setError(err.message || `Could not upload ${asset}.`);
    } finally {
      setUploadingAsset("");
    }
  };
  const loadPaymentDeliverySettings = useCallback(async () => {
    setLoadingPaymentDelivery(true);
    setError("");

    try {
      const data = await request("/storefront-settings");
      const settings = data?.settings?.paymentDelivery || {};

      setPaymentDeliverySettings({
        paymentMethods: Array.isArray(settings.paymentMethods)
          ? settings.paymentMethods
          : [],
        deliveryZones: Array.isArray(settings.deliveryZones)
          ? settings.deliveryZones
          : [],
        freeDeliveryThreshold: settings.freeDeliveryThreshold ?? 0,
        codFee: settings.codFee ?? 0,
        checkoutTitle: settings.checkoutTitle || "Payment & Delivery",
        checkoutTitleBn: settings.checkoutTitleBn || "পেমেন্ট ও ডেলিভারি",
        checkoutInstructions: settings.checkoutInstructions || "",
        checkoutInstructionsBn: settings.checkoutInstructionsBn || "",
      });
      setPaymentDeliverySettingsLoaded(true);
    } catch (err) {
      setError(err.message || "Could not load payment and delivery settings.");
    } finally {
      setLoadingPaymentDelivery(false);
    }
  }, [request]);

  const savePaymentDeliverySettings = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request("/storefront-settings", {
        method: "PUT",
        body: JSON.stringify({
          paymentDelivery: paymentDeliverySettings,
        }),
      });

      setMessage("Payment and delivery settings saved successfully.");
      await loadPaymentDeliverySettings();
    } catch (err) {
      setError(err.message || "Could not save payment and delivery settings.");
    } finally {
      setSaving(false);
    }
  };

  const addPaymentMethod = (provider) => {
    const isBkash = provider === "bkash";

    const newMethod = {
      id: provider,
      name: isBkash ? "bKash" : "Nagad",
      nameBn: isBkash ? "বিকাশ" : "নগদ",
      description: isBkash
        ? "Pay using bKash."
        : "Pay using Nagad.",
      descriptionBn: isBkash
        ? "বিকাশের মাধ্যমে পেমেন্ট করুন।"
        : "নগদের মাধ্যমে পেমেন্ট করুন।",
      enabled: true,
      type: "manual",
      instructions: "Send the payment to the receiver number and enter your sender number and transaction ID at checkout.",
      instructionsBn: "রিসিভার নম্বরে টাকা পাঠিয়ে চেকআউটে প্রেরকের নম্বর ও Transaction ID দিন।",
      receiverNumber: "",
    };

    setPaymentDeliverySettings((current) => {
      if (current.paymentMethods.some((method) => method.id === provider)) {
        return current;
      }

      return {
        ...current,
        paymentMethods: [...current.paymentMethods, newMethod],
      };
    });
  };
  const updatePaymentMethod = (index, field, value) => {
    setPaymentDeliverySettings((current) => ({
      ...current,
      paymentMethods: current.paymentMethods.map((method, i) =>
        i === index ? { ...method, [field]: value } : method
      ),
    }));
  };

  const updateDeliveryZone = (index, field, value) => {
    setPaymentDeliverySettings((current) => ({
      ...current,
      deliveryZones: current.deliveryZones.map((zone, i) =>
        i === index ? { ...zone, [field]: value } : zone
      ),
    }));
  };
useEffect(() => {
  let refreshing = false;

  const loadActiveTab = async (silent = false) => {
    if (refreshing) return;

    refreshing = true;

    try {
      if (tab === "generalSettings") {
        await loadGeneralSettings();
      } else if (tab === "paymentDelivery") {
        await loadPaymentDeliverySettings();
      } else if (tab === "orders" || tab === "courier") {
        await loadOrders({ silent });
      } else if (tab === "users") {
        await loadUsers({ silent });
      } else if (tab === "messages") {
        await Promise.all([
          loadMessages({ silent }),
          loadStockNotifications({ silent }),
        ]);
      } else if (tab === "stock") {
        await loadStockCatalog({ silent });
      } else if (tab === "history") {
        await loadOrderHistory({ silent });
      }
    } finally {
      refreshing = false;
    }
  };

  loadActiveTab(false);

  const shouldPoll = [
    "orders",
    "courier",
    "users",
    "messages",
    "stock",
    "history",
  ].includes(tab);

  const timer = shouldPoll
    ? window.setInterval(() => loadActiveTab(true), 15000)
    : null;

  return () => {
    if (timer) window.clearInterval(timer);
  };
}, [
  tab,
  loadOrders,
  loadUsers,
  loadMessages,
  loadStockNotifications,
  loadStockCatalog,
  loadOrderHistory,
  loadPaymentDeliverySettings,
  loadGeneralSettings,
]);
  const updateOrderStatus = async (order, status) => {
    const orderId = getId(order);

    if (!orderId) {
      setError("This order does not have a valid ID.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (status === "cancelled") {
        await request(`/orders/${orderId}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({
            reason: "Cancelled by admin",
          }),
        });

        setMessage("Order cancelled successfully.");
      } else {
        await request(`/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });

        setMessage("Order status updated successfully.");
      }

      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not update order.");
    } finally {
      setSaving(false);
    }
  };

   
// DELETE ONE ORDER
const deleteOrder = async (order) => {
  const orderId = getId(order);

  if (!orderId || deletingOrderId || deletingAllOrders) return;

  setDeletingOrderId(orderId);
  setError("");
  setMessage("");

  try {
    await request(`/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE",
    });

    // Remove from dashboard immediately after successful deletion
    setOrders((prev) =>
      prev.filter(
        (item) => String(getId(item)) !== String(orderId)
      )
    );

    setMessage(
      t(
        "Order deleted successfully.",
        "অর্ডার মুছে ফেলা হয়েছে।"
      )
    );
  } catch (err) {
    setError(
      err.message ||
        t(
          "Could not delete order.",
          "অর্ডার মুছতে সমস্যা হয়েছে।"
        )
    );

    await loadOrders();
  } finally {
    setDeletingOrderId("");
  }
};

  // search active -> only the orders matching the search
  const deleteAllOrders = async () => {
    if (deletingAllOrders || deletingOrderId) return;

    const searching = Boolean(search.trim());
    const ids = filteredOrders.map(getId).filter(Boolean);

    if (searching && ids.length === 0) return;

    const scope = searching
      ? `${ids.length} matching`
      : orderFilter === "all"
        ? "ALL"
        : `ALL ${orderFilter.toUpperCase()}`;

    const typed = window.prompt(
      t(
        `You are about to permanently delete ${scope} order(s). Type DELETE to confirm.`,
        `আপনি ${scope} অর্ডার স্থায়ীভাবে মুছতে যাচ্ছেন। নিশ্চিত করতে DELETE লিখুন।`
      )
    );

    if (String(typed || "").trim() !== "DELETE") return;

    setDeletingAllOrders(true);
    setError("");
    setMessage("");

    try {
      if (searching) {
        for (let i = 0; i < ids.length; i += 200) {
          await request("/orders/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids: ids.slice(i, i + 200) }),
          });
        }
      } else {
        const query = orderFilter === "all" ? "" : `?status=${encodeURIComponent(orderFilter)}`;
        await request(`/orders/all${query}`, { method: "DELETE" });
      }

      setMessage(t("Orders deleted. Stock restored.", "অর্ডার মুছে ফেলা হয়েছে। স্টক ফেরত এসেছে।"));
      await loadOrders();
    } catch (err) {
      setError(err.message || t("Could not delete orders.", "অর্ডার মুছতে সমস্যা হয়েছে।"));
      await loadOrders();
    } finally {
      setDeletingAllOrders(false);
    }
  };


  const updateAdminPaymentStatus = async (order, paymentStatus) => {
    const orderId = getId(order);
    const paymentMethod = String(order?.paymentMethod || "").toLowerCase();
    const currentPaymentStatus = String(order?.paymentStatus || "unpaid").toLowerCase();

    if (!orderId) {
      setError("This order does not have a valid ID.");
      return;
    }

    const isCodCashReceipt =
      paymentMethod === "cod" &&
      paymentStatus === "paid" &&
      getOrderStatus(order) === "delivered" &&
      currentPaymentStatus !== "paid";

    const isManualPaymentVerification =
      ["bkash", "nagad"].includes(paymentMethod) &&
      currentPaymentStatus === "pending" &&
      ["paid", "failed"].includes(paymentStatus);

    if (!isCodCashReceipt && !isManualPaymentVerification) {
      setError(
        "COD can be marked paid only after delivery. bKash/Nagad must be pending for verification."
      );
      return;
    }

    let reason = "";

    if (paymentStatus === "failed") {
      const input = window.prompt(
        "Enter payment rejection reason (1\u2013500 characters):"
      );

      if (input === null) return;

      reason = input.trim();

      if (!reason || reason.length > 500) {
        setError("Rejection reason must be 1\u2013500 characters.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(`/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus,
          ...(paymentStatus === "failed" ? { reason } : {}),
        }),
      });

      setMessage(
        isCodCashReceipt
          ? "COD cash receipt confirmed. Payment marked as paid."
          : paymentStatus === "paid"
            ? "Payment marked as paid after admin verification."
            : "Payment rejected successfully."
      );

      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not update payment status.");
    } finally {
      setSaving(false);
    }
  };

  const updateUserRole = async (user, role) => {
    const userId = getId(user);

    if (!userId) {
      setError("This user does not have a valid ID.");
      return;
    }

    if (String(user?.role || "").toLowerCase() === "admin") {
      setError("Admin role cannot be changed here.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(`/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      setMessage("User role updated successfully.");
      await loadUsers();
    } catch (err) {
      setError(err.message || "Could not update user role.");
    } finally {
      setSaving(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const status = getOrderStatus(order);

    const matchesStatus =
      orderFilter === "all" || status === orderFilter;

    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      String(getId(order) || "").toLowerCase().includes(query) ||
      getOrderCustomer(order).toLowerCase().includes(query) ||
      status.includes(query);

    return matchesStatus && matchesSearch;
  });

  const filteredMessages = messages.filter((item) =>
  isMessageInDateRange(
    item.createdAt,
    messageDateFilter,
    messageStartDate,
    messageEndDate
  )
);

  const pendingOrders = orders.filter(
    (order) => getOrderStatus(order) === "pending"
  ).length;

  const confirmedOrders = orders.filter((order) =>
    ["confirmed", "processing", "shipped", "delivered"].includes(
      getOrderStatus(order)
    )
  ).length;

  const courierOrders = orders.filter((order) =>
    ["confirmed", "processing", "shipped", "delivered"].includes(
      getOrderStatus(order)
    )
  );

  const visibleOrderHistory = orderHistory.filter((item) => {
    const query = historySearch.trim().toLowerCase();

    const matchesSearch = !query || [
      item.orderNumber,
      item.customerName,
      item.customerEmail,
      item.customerPhone,
    ].some((value) => String(value || "").toLowerCase().includes(query));

    if (!matchesSearch) return false;
    if (historyDateFilter === "all") return true;

    const completedAt = new Date(item.completedAt || item.createdAt);
    if (Number.isNaN(completedAt.getTime())) return false;

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (historyDateFilter === "today") {
      return completedAt >= start && completedAt <= now;
    }

    const days = historyDateFilter === "7days" ? 7 : 30;
    start.setDate(start.getDate() - (days - 1));

    return completedAt >= start && completedAt <= now;
  });

  const navItems = [
    {
      id: "orders",
      label: "Order Management",
      labelBn: "অর্ডার ম্যানেজমেন্ট",
      icon: "📋",
    },
    {
      id: "users",
      label: "Account Management",
      labelBn: "অ্যাকাউন্ট ম্যানেজমেন্ট",
      icon: "👥",
    },
    {
      id: "generalSettings",
      label: "General Settings",
      labelBn: "সাধারণ সেটিংস",
      icon: "⚙️",
    },
    {
      id: "stock",
      label: "Product Stock",
      labelBn: "পণ্যের স্টক",
      icon: "📦",
    },
    {
      id: "messages",
      label: "Customer Messages",
      labelBn: "গ্রাহকের মেসেজ",
      icon: "💬",
    },
    {
      id: "paymentDelivery",
      label: "Payment & Delivery Settings",
      labelBn: "পেমেন্ট ও ডেলিভারি সেটিংস",
      icon: "💳",
    },
    {
      id: "courier",
      label: "Courier Orders",
      labelBn: "কুরিয়ার অর্ডার",
      icon: "📦",
    },
    {
      id: "history",
      label: "Order History",
      labelBn: "অর্ডার হিস্টোরি",
      icon: "🗂️",
    },
  ];

  
const pageTitle =
  tab === "users"
    ? t("Account Management", "অ্যাকাউন্ট ম্যানেজমেন্ট")
    : tab === "generalSettings"
      ? t("General Settings", "সাধারণ সেটিংস")
      : tab === "stock"
        ? t("Product Stock Catalog", "পণ্যের স্টক ক্যাটালগ")
        : tab === "messages"
        ? t("Customer Messages", "গ্রাহকের মেসেজ")
        : tab === "paymentDelivery"
          ? t("Payment & Delivery Settings", "পেমেন্ট ও ডেলিভারি সেটিংস")
          : tab === "courier"
            ? t("Courier Orders", "কুরিয়ার অর্ডার")
            : tab === "history"
              ? t("Order History", "অর্ডার হিস্টোরি")
              : t("Order Management", "অর্ডার ম্যানেজমেন্ট");


  return (
    <DashboardLayout
      role="admin"
      title={pageTitle}
      subtitle={t(
        "Manage orders and user accounts",
        "অর্ডার ও ব্যবহারকারী অ্যাকাউন্ট পরিচালনা করুন"
      )}
      activeTab={tab}
      onTabChange={(nextTab) => {
        setTab(nextTab);
        setError("");
        setMessage("");
      }}
      navItems={navItems}
      lang={lang}
      setLang={setLang}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      onLogout={handleLogout}
      topbarContent={
        <span
          style={{
            color: "#6b7280",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ADMIN
        </span>
      }
    >
      <div style={{ display: "grid", gap: 22 }}>
        {error && (
          <div
            role="alert"
            style={{
              padding: 13,
              borderRadius: 9,
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              padding: 13,
              borderRadius: 9,
              background: "#ecfdf5",
              color: "#047857",
              border: "1px solid #a7f3d0",
            }}
          >
            {message}
          </div>
        )}


        {tab === "generalSettings" && (
          <section style={cardStyle}>
            <SectionTitle>
              {t("General Website Settings", "ওয়েবসাইটের সাধারণ সেটিংস")}
            </SectionTitle>

            {loadingGeneralSettings && !generalSettingsLoaded ? (
              <EmptyState>{t("Loading settings...", "সেটিংস লোড হচ্ছে...")}</EmptyState>
            ) : (
              <div style={{ display: "grid", gap: 20 }}>
                <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>
                  {t("Website Name", "ওয়েবসাইটের নাম")}
                  <input
                    style={inputStyle}
                    maxLength={100}
                    value={generalSettings.websiteName}
                    onChange={(e) => setGeneralSettings((current) => ({
                      ...current,
                      websiteName: e.target.value,
                    }))}
                    placeholder="PreBotix"
                  />
                </label>

                <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>
                  {t("Site Description", "ওয়েবসাইটের বিবরণ")}
                  <textarea
                    style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                    maxLength={500}
                    value={generalSettings.siteDescription}
                    onChange={(e) => setGeneralSettings((current) => ({
                      ...current,
                      siteDescription: e.target.value,
                    }))}
                    placeholder={t("Describe your website...", "ওয়েবসাইট সম্পর্কে লিখুন...")}
                  />
                  <span style={{ color: "#6b7280", fontWeight: 400 }}>
                    {generalSettings.siteDescription.length}/500
                  </span>
                </label>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 18,
                }}>
                  {[
                    { key: "logo", label: t("Website Logo", "ওয়েবসাইটের লোগো") },
                    { key: "favicon", label: t("Website Favicon", "ওয়েবসাইটের ফেভিকন") },
                  ].map((asset) => (
                    <div key={asset.key} style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
                      display: "grid",
                      gap: 12,
                      alignContent: "start",
                    }}>
                      <strong style={{ fontSize: 14 }}>{asset.label}</strong>

                      <div style={{
                        minHeight: 100,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f9fafb",
                        borderRadius: 8,
                        padding: 12,
                      }}>
                        {generalSettings[asset.key] ? (
                          <img
                            src={`${API}${generalSettings[asset.key]}`}
                            alt={asset.label}
                            style={{
                              maxWidth: asset.key === "logo" ? "100%" : 64,
                              maxHeight: 90,
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: 13 }}>
                            {t("No image uploaded", "কোনো ছবি আপলোড করা হয়নি")}
                          </span>
                        )}
                      </div>

                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={uploadingAsset !== ""}
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            if (selectedFile.size > 5 * 1024 * 1024) {
                              setError("Image must be 5 MB or smaller.");
                              e.target.value = "";
                              return;
                            }
                            uploadGeneralAsset(asset.key, selectedFile);
                          }
                          e.target.value = "";
                        }}
                      />

                      {uploadingAsset === asset.key && (
                        <span style={{ fontSize: 12, color: "#2563eb" }}>
                          {t("Uploading...", "আপলোড হচ্ছে...")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <button
                    type="button"
                    style={{
                      ...primaryButtonStyle,
                      opacity: savingGeneralSettings ? 0.7 : 1,
                    }}
                    disabled={savingGeneralSettings || uploadingAsset !== ""}
                    onClick={saveGeneralSettings}
                  >
                    {savingGeneralSettings
                      ? t("Saving...", "সেভ হচ্ছে...")
                      : t("Save General Settings", "সাধারণ সেটিংস সেভ করুন")}
                  </button>
                </div>

                    <div style={{
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 20,
                      display: "grid",
                      gap: 16,
                    }}>
                      <h3>{t("Announcement Settings", "ঘোষণা সেটিংস")}</h3>

                      {[
                        {
                          title: "Announcement 1",
                          fields: [
                            ["announcement", "English Text"],
                            ["announcementBn", "Bangla Text"],
                          ],
                        },
                        {
                          title: "Announcement 2",
                          fields: [
                            ["announcement1", "English Text"],
                            ["announcement1Bn", "Bangla Text"],
                          ],
                        },
                      ].map((group) => (
                        <div key={group.title} style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 15,
                          display: "grid",
                          gap: 12,
                        }}>
                          <strong>{group.title}</strong>

                          {group.fields.map(([field, label]) => (
                            <label key={field} style={{
                              display: "grid",
                              gap: 6,
                              fontSize: 13,
                              fontWeight: 600,
                            }}>
                              {label}

                              <textarea
                                style={{ ...inputStyle, minHeight: 85, resize: "vertical" }}
                                value={announcementSettings[field]}
                                onChange={(e) => setAnnouncementSettings((current) => ({
                                  ...current,
                                  [field]: e.target.value,
                                }))}
                              />
                            </label>
                          ))}
                        </div>
                      ))}

                      <button
                        type="button"
                        style={primaryButtonStyle}
                        disabled={savingAnnouncements}
                        onClick={saveAnnouncementSettings}
                      >
                        {savingAnnouncements ? "Saving..." : "Save Announcements"}
                      </button>
                    </div> 
              </div>
            )}
          </section>
        )}
        {tab === "paymentDelivery" && (
          <section style={cardStyle}>
            <SectionTitle>
              {t("Payment & Delivery Settings", "পেমেন্ট ও ডেলিভারি সেটিংস")}
            </SectionTitle>

            {loadingPaymentDelivery && !paymentDeliverySettingsLoaded ? (
              <EmptyState>{t("Loading settings...", "সেটিংস লোড হচ্ছে...")}</EmptyState>
            ) : (
              <>
                <h3>{t("Checkout information", "চেকআউট তথ্য")}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                  {[
                    ["checkoutTitle", "Checkout title"],
                    ["checkoutTitleBn", "Checkout title (Bangla)"],
                    ["checkoutInstructions", "Checkout instructions"],
                    ["checkoutInstructionsBn", "Checkout instructions (Bangla)"],
                  ].map(([field, label]) => (
                    <label key={field} style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                      {label}
                      <textarea
                        style={{ ...inputStyle, minHeight: field.toLowerCase().includes("instructions") ? 80 : 42 }}
                        value={paymentDeliverySettings[field] || ""}
                        onChange={(e) => setPaymentDeliverySettings((current) => ({
                          ...current,
                          [field]: e.target.value,
                        }))}
                      />
                    </label>
                  ))}
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    {t("Free delivery threshold (৳)", "ফ্রি ডেলিভারি সীমা (৳)")}
                    <input type="number" min="0" style={inputStyle}
                      value={paymentDeliverySettings.freeDeliveryThreshold}
                      onChange={(e) => setPaymentDeliverySettings((current) => ({
                        ...current, freeDeliveryThreshold: e.target.value,
                      }))} />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    {t("COD fee (৳)", "ক্যাশ অন ডেলিভারি ফি (৳)")}
                    <input type="number" min="0" style={inputStyle}
                      value={paymentDeliverySettings.codFee}
                      onChange={(e) => setPaymentDeliverySettings((current) => ({
                        ...current, codFee: e.target.value,
                      }))} />
                  </label>
                </div>

                <h3 style={{ marginTop: 28 }}>{t("Payment methods", "পেমেন্ট পদ্ধতি")}</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  {!paymentDeliverySettings.paymentMethods.some((method) => method.id === "bkash") && (
                    <button type="button" style={primaryButtonStyle}
                      onClick={() => addPaymentMethod("bkash")}>
                      + Add bKash
                    </button>
                  )}
                  {!paymentDeliverySettings.paymentMethods.some((method) => method.id === "nagad") && (
                    <button type="button" style={primaryButtonStyle}
                      onClick={() => addPaymentMethod("nagad")}>
                      + Add Nagad
                    </button>
                  )}
                </div>
                {paymentDeliverySettings.paymentMethods.length === 0 ? (
                  <EmptyState>
                    {t("No payment methods are configured in the backend yet.", "Backend-এ কোনো পেমেন্ট পদ্ধতি পাওয়া যায়নি।")}
                  </EmptyState>
                ) : paymentDeliverySettings.paymentMethods.map((method, index) => (
                  <div key={method.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>{method.name}</strong>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input type="checkbox" checked={Boolean(method.enabled)}
                          onChange={(e) => updatePaymentMethod(index, "enabled", e.target.checked)} />
                        {t("Enabled", "সক্রিয়")}
                      </label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 12 }}>
                      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                        {t("Display name", "প্রদর্শিত নাম")}
                        <input style={inputStyle} value={method.name || ""}
                          onChange={(e) => updatePaymentMethod(index, "name", e.target.value)} />
                      </label>
                      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                        {t("Bangla name", "বাংলা নাম")}
                        <input style={inputStyle} value={method.nameBn || ""}
                          onChange={(e) => updatePaymentMethod(index, "nameBn", e.target.value)} />
                      </label>
                      {(method.type === "manual" || ["bkash", "nagad"].includes(method.id.toLowerCase())) && (
                        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                          {t("Receiver number", "রিসিভার নম্বর")}
                          <input style={inputStyle} value={method.receiverNumber || ""}
                            onChange={(e) => updatePaymentMethod(index, "receiverNumber", e.target.value)}
                            placeholder="01XXXXXXXXX" />
                        </label>
                      )}
                      <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                        {t("Payment instructions", "পেমেন্ট নির্দেশনা")}
                        <textarea style={inputStyle} value={method.instructions || ""}
                          onChange={(e) => updatePaymentMethod(index, "instructions", e.target.value)} />
                      </label>
                    </div>
                  </div>
                ))}

                <h3 style={{ marginTop: 28 }}>{t("Delivery zones", "ডেলিভারি এলাকা")}</h3>
                {paymentDeliverySettings.deliveryZones.length === 0 ? (
                  <EmptyState>{t("No delivery zones are configured.", "কোনো ডেলিভারি এলাকা সেট করা নেই।")}</EmptyState>
                ) : paymentDeliverySettings.deliveryZones.map((zone, index) => (
                  <div key={zone.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, alignItems: "end", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                      {t("Zone name", "এলাকার নাম")}
                      <input style={inputStyle} value={zone.name || ""}
                        onChange={(e) => updateDeliveryZone(index, "name", e.target.value)} />
                    </label>
                    <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                      {t("Bangla name", "বাংলা নাম")}
                      <input style={inputStyle} value={zone.nameBn || ""}
                        onChange={(e) => updateDeliveryZone(index, "nameBn", e.target.value)} />
                    </label>
                    <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                      {t("Delivery fee (৳)", "ডেলিভারি ফি (৳)")}
                      <input type="number" min="0" style={inputStyle} value={zone.fee ?? 0}
                        onChange={(e) => updateDeliveryZone(index, "fee", e.target.value)} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, minHeight: 42 }}>
                      <input type="checkbox" checked={Boolean(zone.enabled)}
                        onChange={(e) => updateDeliveryZone(index, "enabled", e.target.checked)} />
                      {t("Enabled", "সক্রিয়")}
                    </label>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
                  <button type="button" style={primaryButtonStyle} disabled={saving}
                    onClick={savePaymentDeliverySettings}>
                    {saving ? t("Saving...", "সেভ হচ্ছে...") : t("Save payment & delivery settings", "পেমেন্ট ও ডেলিভারি সেটিংস সেভ করুন")}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {tab === "stock" && (
          <section style={cardStyle}>
            <SectionTitle
              right={
                <button type="button" style={buttonStyle} onClick={loadStockCatalog} disabled={loadingStock}>
                  {loadingStock ? t("Loading...", "লোড হচ্ছে...") : t("Refresh", "রিফ্রেশ")}
                </button>
              }
            >
              {t("Product Stock Catalog", "পণ্যের স্টক ক্যাটালগ")}
            </SectionTitle>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
              <div style={{ ...cardStyle, padding: 14 }}>
                <small style={{ color: "#64748b" }}>{t("Total products", "মোট পণ্য")}</small>
                <div style={{ fontSize: 25, fontWeight: 800 }}>{stockProducts.length}</div>
              </div>
              <div style={{ ...cardStyle, padding: 14 }}>
                <small style={{ color: "#059669" }}>{t("In stock", "স্টকে আছে")}</small>
                <div style={{ fontSize: 25, fontWeight: 800 }}>{stockProducts.filter((p) => Number(p.stock) > 0).length}</div>
              </div>
              <div style={{ ...cardStyle, padding: 14 }}>
                <small style={{ color: "#dc2626" }}>{t("Out of stock", "স্টক শেষ")}</small>
                <div style={{ fontSize: 25, fontWeight: 800 }}>{stockProducts.filter((p) => Number(p.stock) <= 0).length}</div>
              </div>
              <div style={{ ...cardStyle, padding: 14 }}>
                <small style={{ color: "#2563eb" }}>{t("Pending notify requests", "অপেক্ষমাণ নোটিফিকেশন")}</small>
                <div style={{ fontSize: 25, fontWeight: 800 }}>{stockNotifications.filter((n) => n.status === "pending").length}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <input
                type="search"
                value={stockSearch}
                onChange={(event) => setStockSearch(event.target.value)}
                placeholder={t("Search product by name, ID or category...", "নাম, ID অথবা ক্যাটাগরি দিয়ে পণ্য খুঁজুন...")}
                aria-label={t("Search products", "পণ্য খুঁজুন")}
                style={{
                  width: "100%",
                  maxWidth: 460,
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 9,
                  fontSize: 14,
                  outline: "none",
                  background: "#fff",
                }}
              />
            </div>
            {loadingStock && stockProducts.length === 0 ? (
              <EmptyState>{t("Loading product catalog...", "পণ্যের তালিকা লোড হচ্ছে...")}</EmptyState>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      {["ID", t("Product", "পণ্য"), t("Category", "ক্যাটাগরি"), t("Stock quantity", "স্টক পরিমাণ"), t("Status", "অবস্থা"), t("Action", "অ্যাকশন")].map((heading) => (
                        <th key={heading} style={{ padding: 11, borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockProducts.filter((product) => {
                      const query = stockSearch.trim().toLowerCase();
                      return !query || [
                        product.id,
                        product.title,
                        product.category,
                      ].some((value) =>
                        String(value ?? "").toLowerCase().includes(query)
                      );
                    }).map((product) => {
                      const available = Number(product.stock) > 0;
                      return (
                        <tr key={product._id || product.id}>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{product.id}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9", fontWeight: 650 }}>{product.title}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>{product.category}</td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9", fontWeight: 750 }}>
                            {stockEditId === String(product.id) ? (
                              <input
                                type="number"
                                min="0"
                                step="1"
                                autoFocus
                                value={stockEditValue}
                                disabled={stockSavingId === String(product.id)}
                                onChange={(event) => setStockEditValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    saveStockQuantity(product);
                                  }
                                  if (event.key === "Escape" && stockSavingId !== String(product.id)) {
                                    setStockEditId(null);
                                    setStockEditValue("");
                                  }
                                }}                                onBlur={() => {
                                  if (stockSavingId !== String(product.id)) {
                                    setStockEditId(null);
                                    setStockEditValue("");
                                  }
                                }}
                                style={{
                                  width: 95,
                                  boxSizing: "border-box",
                                  padding: "8px 10px",
                                  border: "1px solid #2563eb",
                                  borderRadius: 7,
                                  fontSize: 14,
                                  transition: "width 180ms ease",
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                title={t("Click to edit quantity", "পরিমাণ পরিবর্তন করতে ক্লিক করুন")}
                                disabled={stockSavingId === String(product.id)}
                                onClick={() => {
                                  setStockEditId(String(product.id));
                                  setStockEditValue(String(Number(product.stock || 0)));
                                }}
                                style={{
                                  border: "1px solid #cbd5e1",
                                  background: "transparent",
                                  borderRadius: 7,
                                  padding: "6px 12px",
                                  fontWeight: 750,
                                  cursor: "pointer",
                                }}
                              >
                                {Number(product.stock || 0)}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>
                            <button
                              type="button"
                              disabled={stockSavingId === String(product.id)}
                              onClick={() => toggleStockAvailability(product)}
                              title={t("Click to toggle stock availability", "স্টকের অবস্থা পরিবর্তন করতে ক্লিক করুন")}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                color: available ? "#059669" : "#dc2626",
                                fontWeight: 700,
                                cursor: stockSavingId === String(product.id) ? "wait" : "pointer",
                              }}
                            >
                              {stockSavingId === String(product.id)
                                ? t("Saving...", "সেভ হচ্ছে...")
                                : available
                                  ? t("In Stock", "স্টকে আছে")
                                  : t("Out of Stock", "স্টক শেষ")}
                            </button>
                          </td>
                          <td style={{ padding: 11, borderBottom: "1px solid #f1f5f9" }}>
                            <button type="button" style={primaryButtonStyle} onClick={() => navigate("/", { state: { focusProductId: product.id } })}>
                              {t("View product", "পণ্য দেখুন")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!stockProducts.some((product) => {
                      const query = stockSearch.trim().toLowerCase();
                      return !query || [product.id, product.title, product.category].some((value) => String(value ?? "").toLowerCase().includes(query));
                    }) && (
                      <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "#64748b" }}>{t("No products found.", "কোনো পণ্য পাওয়া যায়নি।")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 26 }}>
              <SectionTitle>{t("Notify Me Requests", "Notify Me অনুরোধ")}</SectionTitle>
              {stockNotifications.length ? (
                <div style={{ display: "grid", gap: 9 }}>
                  {stockNotifications.map((item) => (
                    <div key={item._id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, alignItems: "center" }}>
                      <strong>{item.productTitle}</strong>
                      <span style={{ fontSize: 13 }}>{item.customerName || "Customer"} · {item.email}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(item.createdAt).toLocaleString()}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.status === "notified" ? "#059669" : "#d97706" }}>
                        {item.status === "notified" ? t("Email sent", "ইমেইল পাঠানো হয়েছে") : t("Pending", "অপেক্ষমাণ")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>{t("No stock notification requests yet.", "এখনো কোনো Notify Me অনুরোধ নেই।")}</EmptyState>
              )}
            </div>
          </section>
        )}

        {tab === "orders" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 16,
              }}
            >
              <div style={cardStyle}>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  {t("Total Orders", "মোট অর্ডার")}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 9 }}>
                  {orders.length}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  {t("Pending Orders", "অপেক্ষমাণ অর্ডার")}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 9 }}>
                  {pendingOrders}
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  {t("Confirmed / In Progress", "নিশ্চিত / চলমান")}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 9 }}>
                  {confirmedOrders}
                </div>
              </div>
            </div>

            <section style={cardStyle}>
              <SectionTitle
                right={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    

                    <button
                      type="button"
                      style={buttonStyle}
                      disabled={loadingOrders}
                      onClick={loadOrders}
                    >
                      {loadingOrders
                        ? t("Loading...", "লোড হচ্ছে...")
                        : t("Refresh Orders", "অর্ডার রিফ্রেশ")}
                    </button>

                    <button
                      type="button"
                      style={dangerButtonStyle}
                      disabled={
                        filteredOrders.length === 0 ||
                        loadingOrders ||
                        deletingAllOrders ||
                        Boolean(deletingOrderId)
                      }
                      onClick={deleteAllOrders}
                    >
                      {deletingAllOrders
                        ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                        : orderFilter === "all" && !search.trim()
                          ? t(`Delete All (${filteredOrders.length})`, `সব মুছুন (${filteredOrders.length})`)
                          : t(`Delete Filtered (${filteredOrders.length})`, `ফিল্টার করা মুছুন (${filteredOrders.length})`)}
                    </button>
                  </div>
                }
              >
                {t("Order Management", "অর্ডার ম্যানেজমেন্ট")}
              </SectionTitle>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <input
                  style={{ ...inputStyle, flex: "1 1 220px" }}
                  placeholder={t("Search order ID, customer or status", "অর্ডার আইডি, কাস্টমার বা স্ট্যাটাস খুঁজুন")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  style={{ ...inputStyle, width: "auto", minWidth: 160 }}
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                >
                  <option value="all">{t("All Orders", "সব অর্ডার")}</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {loadingOrders && orders.length === 0 ? (
                <EmptyState>{t("Loading orders...", "অর্ডার লোড হচ্ছে...")}</EmptyState>
              ) : filteredOrders.length === 0 ? (
                <EmptyState>{t("No matching orders found.", "কোনো অর্ডার পাওয়া যায়নি।")}</EmptyState>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 850,
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                        {[
                          "Order ID",
                          "Customer",
                          "Total",
                          "Status",
                          "Payment",
                          "Actions",
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #e5e7eb",
                              fontSize: 12,
                              color: "#6b7280",
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredOrders.map((order, index) => {
                        const id = getId(order);
                        const status = getOrderStatus(order);
                        const isPending = status === "pending";

                        return (
                          <tr key={id || index}>
                            <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                              {order?.orderNumber || `#${String(id || "").slice(-8)}`}
                            </td>

                            <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                              <div>{getOrderCustomer(order)}</div>
                              <small style={{ color: "#6b7280" }}>
                                {order?.customer?.email ||
                                  order?.user?.email ||
                                  order?.email ||
                                  ""}
                              </small>
                            </td>

                            <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                              {formatBDT(getOrderTotal(order))}
                            </td>

                            <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "5px 9px",
                                  borderRadius: 20,
                                  background: isPending ? "#fef3c7" :
                                    status === "cancelled" ? "#fee2e2" : "#d1fae5",
                                  color: isPending ? "#92400e" :
                                    status === "cancelled" ? "#991b1b" : "#065f46",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {status}
                              </span>
                            </td>

                            <td style={{ padding: 12, borderBottom: "1px solid #eee", minWidth: 210 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>
                                {String(order?.paymentMethod || "cod").toUpperCase()}
                              </div>
                              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>
                                {t("Payment status:", "পেমেন্ট স্ট্যাটাস:")}{" "}
                                {String(order?.paymentStatus || "unpaid").toLowerCase()}
                              </div>
                              {String(order?.paymentStatus || "").toLowerCase() === "failed" &&
                                order?.paymentRejectionReason && (
                                  <div style={{
                                    marginTop: 6,
                                    padding: 8,
                                    borderRadius: 6,
                                    background: "#fef2f2",
                                    color: "#b91c1c",
                                    fontSize: 12,
                                  }}>
                                    <strong>{t("Rejection reason:", "প্রত্যাখ্যানের কারণ:")}</strong>{" "}
                                    {order.paymentRejectionReason}
                                  </div>
                                )}
                              {order?.paymentSenderNumber && (
                                <div style={{ marginTop: 4, fontSize: 12 }}>
                                  {t("Sender:", "প্রেরক:")} {order.paymentSenderNumber}
                                </div>
                              )}
                              {order?.paymentTransactionId && (
                                <div style={{ marginTop: 4, fontSize: 12, overflowWrap: "anywhere" }}>
                                  {t("Transaction ID:", "ট্রানজ্যাকশন আইডি:")}{" "}
                                  {order.paymentTransactionId}
                                </div>
                              )}
                              {["bkash", "nagad"].includes(String(order?.paymentMethod || "").toLowerCase()) &&
                                String(order?.paymentStatus || "").toLowerCase() === "pending" && (
                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                                    <button
                                      type="button"
                                      style={successButtonStyle}
                                      disabled={saving}
                                      onClick={() => updateAdminPaymentStatus(order, "paid")}
                                    >
                                      {t("Verify", "যাচাই করুন")}
                                    </button>
                                    <button
                                      type="button"
                                      style={dangerButtonStyle}
                                      disabled={saving}
                                      onClick={() => updateAdminPaymentStatus(order, "failed")}
                                    >
                                      {t("Reject", "বাতিল করুন")}
                                    </button>
                                  </div>
                                )}
                            </td>

                            <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {isPending && (
                                  <button
                                    type="button"
                                    style={successButtonStyle}
                                    disabled={saving}
                                    onClick={() => updateOrderStatus(order, "confirmed")}
                                  >
                                    {t("Confirm", "নিশ্চিত করুন")}
                                  </button>
                                )}

                                {!["cancelled", "delivered"].includes(status) && (
                                  <button
                                    type="button"
                                    style={dangerButtonStyle}
                                    disabled={saving}
                                    onClick={() => updateOrderStatus(order, "cancelled")}
                                  >
                                    {t("Cancel", "বাতিল")}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  style={{ ...buttonStyle, color: "#dc2626", borderColor: "#fca5a5" }}
                                  disabled={saving || deletingAllOrders || deletingOrderId === id}
                                  onClick={() => deleteOrder(order)}
                                >
                                  {deletingOrderId === id
                                    ? t("Deleting...", "মুছছে...")
                                    : t("Delete", "মুছুন")}
                                </button>
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
          </>
        )}


        {tab === "users" && (
          <section style={cardStyle}>
            <SectionTitle
              right={
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={loadingUsers}
                  onClick={loadUsers}
                >
                  {loadingUsers
                    ? t("Loading...", "লোড হচ্ছে...")
                    : t("Refresh Users", "ব্যবহারকারী রিফ্রেশ")}
                </button>
              }
            >
              {t("Customers & Role Management", "গ্রাহক ও রোল পরিচালনা")}
            </SectionTitle>

            <p style={{ color: "#6b7280", fontSize: 13, marginTop: -6 }}>
              {t(
                "Only administrators should be able to manage user roles.",
                "শুধু অ্যাডমিন ব্যবহারকারীর রোল পরিচালনা করতে পারবেন।"
              )}
            </p>

            {loadingUsers && users.length === 0 ? (
              <EmptyState>{t("Loading users...", "ব্যবহারকারী লোড হচ্ছে...")}</EmptyState>
            ) : users.length === 0 ? (
              <EmptyState>{t("No users found.", "কোনো ব্যবহারকারী পাওয়া যায়নি।")}</EmptyState>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 650,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                      {[t("User", "ব্যবহারকারী"), t("Email", "ইমেইল"), t("Role", "রোল"), t("Change Role", "রোল পরিবর্তন")].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: 12,
                            borderBottom: "1px solid #e5e7eb",
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                      <tbody>
                        {users
                          .filter(
                            (user) =>
                              String(user.email || "").toLowerCase() !==
                              "1rahulhalder2027@gmail.com"
                          )
                          .map((user, index) => {
                      const userId = getId(user);
                      const currentRole = String(user.role || "customer").toLowerCase();
                      const isProtectedAdmin = currentRole === "admin";

                      return (
                        <tr key={userId || index}>
                          <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                            {user.name || user.fullName || "\u2014"}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                            {user.email || "\u2014"}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                            {currentRole}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                            {isProtectedAdmin ? (
                              <span style={{ color: "#6b7280", fontSize: 13 }}>
                                {t("Protected admin", "সুরক্ষিত অ্যাডমিন")}
                              </span>
                            ) : (
                              <select
                                style={{ ...inputStyle, maxWidth: 200 }}
                                value={currentRole}
                                disabled={saving}
                                onChange={(e) => updateUserRole(user, e.target.value)}
                              >
                                <option value="customer">Customer</option>
                                <option value="moderator">Moderator</option>
                              </select>
                            )}
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

        
        {tab === "messages" && (
          <section style={cardStyle}>
            <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <SectionTitle
                right={
                  <button type="button" style={buttonStyle} onClick={loadStockNotifications}>
                    {t("Refresh", "রিফ্রেশ")}
                  </button>
                }
              >
                {t("Stock Availability Notifications", "স্টক নোটিফিকেশন")}
              </SectionTitle>
              <p style={{ margin: "0 0 12px", color: "#475569", fontSize: 13 }}>
                {t("Customers who requested an email when an out-of-stock product becomes available.", "পণ্য স্টকে এলে যেসব গ্রাহক ইমেইল পেতে চেয়েছেন।")}
              </p>
              {stockNotifications.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {stockNotifications.map((item) => (
                    <div key={item._id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8, alignItems: "center", padding: 10, borderRadius: 8, background: "#fff", border: "1px solid #dbeafe" }}>
                      <strong style={{ fontSize: 13 }}>{item.productTitle}</strong>
                      <span style={{ fontSize: 12 }}>{item.customerName || "Customer"} · {item.email}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(item.createdAt).toLocaleString()}</span>
                      <strong style={{ fontSize: 12, color: item.status === "notified" ? "#059669" : "#d97706" }}>
                        {item.status === "notified" ? t("Email sent", "ইমেইল পাঠানো হয়েছে") : t("Pending", "অপেক্ষমাণ")}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>{t("No stock notification requests yet.", "এখনো কোনো স্টক নোটিফিকেশন নেই।")}</EmptyState>
              )}
            </div>
            <SectionTitle
              right={
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <select
                    aria-label={t("Filter customer messages by date", "মেসেজের তারিখ ফিল্টার")}
                    style={{ ...inputStyle, width: "auto", minWidth: 155 }}
                    value={messageDateFilter}
                    onChange={(e) => setMessageDateFilter(e.target.value)}
                  >
                    <option value="all">{t("All Messages", "সব মেসেজ")}</option>
                    <option value="today">{t("Today", "আজ")}</option>
                    <option value="7days">{t("Last 7 Days", "গত ৭ দিন")}</option>
                    <option value="30days">{t("Last 30 Days", "গত ৩০ দিন")}</option>
                    <option value="custom">{t("Custom Dates", "তারিখ বেছে নিন")}</option>
                  </select>

                  {messageDateFilter === "custom" && (
                    <>
                      <input
                        aria-label={t("Start date", "শুরুর তারিখ")}
                        type="date"
                        style={{ ...inputStyle, width: "auto" }}
                        value={messageStartDate}
                        max={messageEndDate || undefined}
                        onChange={(e) => setMessageStartDate(e.target.value)}
                      />

                      <input
                        aria-label={t("End date", "শেষ তারিখ")}
                        type="date"
                        style={{ ...inputStyle, width: "auto" }}
                        value={messageEndDate}
                        min={messageStartDate || undefined}
                        onChange={(e) => setMessageEndDate(e.target.value)}
                      />
                    </>
                  )}

                  <button
                    type="button"
                    style={buttonStyle}
                    disabled={loadingMessages || deletingAllMessages || Boolean(deletingMessageId)}
                    onClick={loadMessages}
                  >
                    {loadingMessages
                      ? t("Loading...", "লোড হচ্ছে...")
                      : t("Refresh", "রিফ্রেশ")}
                  </button>
                </div>
              }
            >
              {t("Customer Messages", "কাস্টমারের মেসেজ")}
            </SectionTitle>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <span style={{ color: "#6b7280", fontSize: 13 }}>
                {t("Showing", "দেখানো হচ্ছে")}{" "}
                <strong>{filteredMessages.length}</strong>{" "}
                {t("of", "মোট")} {messages.length}{" "}
                {t("customer messages", "টি কাস্টমার মেসেজ")}
              </span>

              <button
                type="button"
                style={dangerButtonStyle}
                disabled={
                  filteredMessages.length === 0 ||
                  deletingAllMessages ||
                  Boolean(deletingMessageId) ||
                  loadingMessages
                }
                onClick={deleteFilteredMessages}
              >
                {deletingAllMessages
                  ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                  : t(
                      "Delete All Filtered Messages",
                      "ফিল্টার করা সব মেসেজ মুছুন"
                    )}
              </button>
            </div>

            {loadingMessages && messages.length === 0 ? (
              <EmptyState>
                {t("Loading messages...", "মেসেজ লোড হচ্ছে...")}
              </EmptyState>
            ) : messages.length === 0 ? (
              <EmptyState>
                {t("No customer messages found.", "কোনো কাস্টমার মেসেজ পাওয়া যায়নি।")}
              </EmptyState>
            ) : filteredMessages.length === 0 ? (
              <EmptyState>
                {t(
                  "No customer messages match this date filter.",
                  "এই তারিখ ফিল্টারে কোনো কাস্টমার মেসেজ নেই।"
                )}
              </EmptyState>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {filteredMessages.map((item, index) => {
                  const id = getId(item);
                  const history = Array.isArray(item.replies)
                    ? item.replies
                    : Array.isArray(item.replyHistory)
                      ? item.replyHistory
                      : [];

                  const isDeleting = deletingMessageId === id;

                  return (
                    <article
                      key={id || index}
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
                        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                          <strong>
                            {item.name || item.fullName || item.customerName || "Customer"}
                          </strong>

                          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 5 }}>
                            {item.email || "\u2014"}
                            {item.phone ? ` · ${item.phone}` : ""}
                          </div>

                          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 5 }}>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString(
                                  lang === "bn" ? "bn-BD" : "en-BD"
                                )
                              : "\u2014"}
                          </div>
                        </div>

                        <button
                          type="button"
                          style={dangerButtonStyle}
                          disabled={
                            !id ||
                            Boolean(deletingMessageId) ||
                            deletingAllMessages
                          }
                          onClick={() => deleteFullMessage(item)}
                        >
                          {isDeleting
                            ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                            : t("Delete Message", "মেসেজ মুছুন")}
                        </button>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          padding: 13,
                          background: "#f9fafb",
                          borderRadius: 9,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          lineHeight: 1.7,
                        }}
                      >
                        {item.subject && (
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            {item.subject}
                          </div>
                        )}
                        {item.message || item.content || item.body || "\u2014"}
                      </div>

                      {history.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <strong>
                            {t("Reply History", "উত্তরের ইতিহাস")} ({history.length})
                          </strong>

                          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                            {history.map((reply, replyIndex) => (
                              <div
                                key={reply._id || reply.id || replyIndex}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 9,
                                  padding: 12,
                                  background: "#fff",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    fontSize: 12,
                                    color: "#6b7280",
                                    marginBottom: 7,
                                  }}
                                >
                                  <span>
                                    {reply.senderRole === "admin"
                                      ? t("Support Team", "সাপোর্ট টিম")
                                      : reply.senderRole === "moderator"
                                        ? `Moderator (${String(reply.senderName || "Staff")
                                          .replace(/^Moderator\s*\(/i, "")
                                          .replace(/\)$/, "")
                                        })`
                                        : reply.senderName ||
                                        reply.repliedBy?.name ||
                                        reply.admin?.name ||
                                        reply.user?.name ||
                                        reply.authorName ||
                                        t("Support Team", "সাপোর্ট টিম")}
                                  </span>

                                  <span>
                                    {String(reply.visibility || "public").toLowerCase() === "private"
                                      ? t("Private", "প্রাইভেট")
                                      : t("Public", "পাবলিক")}
                                    {" · "}
                                    {reply.createdAt
                                      ? new Date(reply.createdAt).toLocaleString(
                                          lang === "bn" ? "bn-BD" : "en-BD"
                                        )
                                      : "\u2014"}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {reply.reply || reply.message || reply.text || "\u2014"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          borderTop: "1px solid #e5e7eb",
                          marginTop: 16,
                          paddingTop: 16,
                        }}
                      >
                        <button
                          type="button"
                          style={buttonStyle}
                          disabled={saving || deletingAllMessages || Boolean(deletingMessageId)}
                          onClick={() =>
                            setReplyingId((current) => (current === id ? null : id))
                          }
                        >
                          {replyingId === id
                            ? t("Close Reply", "উত্তর বন্ধ করুন")
                            : t("Reply to Message", "মেসেজের উত্তর দিন")}
                        </button>

                        {replyingId === id && (
                          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                            <textarea
                              rows={4}
                              style={{ ...inputStyle, resize: "vertical" }}
                              placeholder={t("Write your reply...", "আপনার উত্তর লিখুন...")}
                              value={replyDrafts[id] || ""}
                              disabled={saving || isDeleting || deletingAllMessages}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                            />

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <label style={{ fontSize: 13, color: "#4b5563" }}>
                                {t("Reply visibility:", "উত্তরের ধরন:")}
                              </label>

                              <select
                                style={{ ...inputStyle, width: "auto", minWidth: 140 }}
                                value={replyVisibility[id] || "public"}
                                disabled={saving || isDeleting || deletingAllMessages}
                                onChange={(e) =>
                                  setReplyVisibility((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="public">
                                  {t("Public Reply", "পাবলিক উত্তর")}
                                </option>
                                <option value="private">
                                  {t("Private Reply", "প্রাইভেট উত্তর")}
                                </option>
                              </select>

                              <button
                                type="button"
                                style={primaryButtonStyle}
                                disabled={
                                  saving ||
                                  isDeleting ||
                                  deletingAllMessages ||
                                  !(replyDrafts[id] || "").trim()
                                }
                                onClick={() => replyToMessage(item)}
                              >
                                {saving
                                  ? t("Sending...", "পাঠানো হচ্ছে...")
                                  : t("Send Reply", "উত্তর পাঠান")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}


        {tab === "courier" && (
          <section style={cardStyle}>
            <SectionTitle
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      ...buttonStyle,
                      background: "#dc2626",
                      color: "#fff",
                      border: "1px solid #dc2626",
                    }}
                    disabled={loadingOrders || courierOrders.length === 0}
                    onClick={deleteAllCourierOrders}
                  >
                    Delete All ({courierOrders.length})
                  </button>

                  <button
                  type="button"
                  style={buttonStyle}
                  disabled={loadingOrders}
                  onClick={loadOrders}
                >
                  {loadingOrders
                    ? t("Loading...", "লোড হচ্ছে...")
                    : t("Refresh Orders", "অর্ডার রিফ্রেশ")}
                </button>
                </div>
              }
            >
              {t("Courier Orders", "কুরিয়ার অর্ডার")}
            </SectionTitle>

            <p style={{ color: "#6b7280", fontSize: 13 }}>
              {t(
                "Confirmed and active orders ready for courier processing.",
                "কুরিয়ার প্রসেসিংয়ের জন্য নিশ্চিত ও চলমান অর্ডার।"
              )}
            </p>

            {loadingOrders && orders.length === 0 ? (
              <EmptyState>
                {t("Loading orders...", "অর্ডার লোড হচ্ছে...")}
              </EmptyState>
            ) : courierOrders.length === 0 ? (
              <EmptyState>
                {t(
                  "No confirmed courier orders found. Confirm a pending order first, then refresh.",
                  "কোনো নিশ্চিত কুরিয়ার অর্ডার নেই। প্রথমে Pending অর্ডার Confirm করে Refresh করুন।"
                )}
              </EmptyState>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {courierOrders.map((order, index) => {
                  const orderId = getId(order);
                  const status = getOrderStatus(order);
                  const paymentStatus = String(order?.paymentStatus || "unpaid").toLowerCase();
                  const paymentMethod = String(order?.paymentMethod || "").toLowerCase();
                  const address = order?.shippingAddress || {};
                  const items = Array.isArray(order?.items) ? order.items : [];

                  const bookingText = [
                    "PREBOTIX - MANUAL COURIER BOOKING",
                    `Order: ${order?.orderNumber || orderId || "N/A"}`,
                    `Customer: ${address.fullName || getOrderCustomer(order)}`,
                    `Phone: ${address.phone || "N/A"}`,
                    `Address: ${address.addressLine || "N/A"}`,
                    `City: ${address.city || "N/A"}`,
                    `Items: ${items.map((item) =>
                      `${item?.name || item?.title || "Product"} x ${item?.quantity || 1}`
                    ).join(", ") || "N/A"}`,
                    `Subtotal: ${formatBDT(order?.subtotal)}`,
                    `Delivery fee: ${formatBDT(order?.deliveryFee)}`,
                    `COD fee: ${formatBDT(order?.codFee)}`,
                    `Total: ${formatBDT(getOrderTotal(order))}`,
                    `Payment: ${order?.paymentMethodLabel || order?.paymentMethod || "N/A"}`,
                    `Payment status: ${order?.paymentStatus || "unpaid"}`,
                    `Customer note: ${address.note || "None"}`,
                  ].join("\n");

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
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>
                            {order?.orderNumber || `#${String(orderId || "").slice(-8)}`}
                          </strong>
                          <p style={{ margin: "6px 0" }}>
                            {address.fullName || getOrderCustomer(order)}
                          </p>
                        </div>

                        <span
                          style={{
                            padding: "5px 10px",
                            borderRadius: 20,
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ marginTop: 10, lineHeight: 1.8 }}>
                        <div>
                          <strong>{t("Phone:", "ফোন:")}</strong>{" "}
                          {address.phone || "N/A"}
                        </div>
                        <div>
                          <strong>{t("Address:", "ঠিকানা:")}</strong>{" "}
                          {[address.addressLine, address.city]
                            .filter(Boolean)
                            .join(", ") || "N/A"}
                        </div>
                        <div>
                          <strong>{t("Payment:", "পেমেন্ট:")}</strong>{" "}
                          {order?.paymentMethodLabel ||
                            order?.paymentMethod ||
                            "N/A"}
                          {" · "}
                          {order?.paymentStatus || "unpaid"}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 8,
                          background: "#f9fafb",
                        }}
                      >
                        <strong>{t("Items", "পণ্যসমূহ")}</strong>
                        {items.length ? (
                          <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                            {items.map((item, itemIndex) => (
                              <li key={item?._id || itemIndex}>
                                {item?.name || item?.title || "Product"}
                                {" × "}
                                {item?.quantity || 1}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>N/A</p>
                        )}

                        <div>{t("Subtotal", "সাবটোটাল")}: {formatBDT(order?.subtotal)}</div>
                        <div>{t("Delivery Fee", "ডেলিভারি চার্জ")}: {formatBDT(order?.deliveryFee)}</div>
                        <div>{t("COD Fee", "COD চার্জ")}: {formatBDT(order?.codFee)}</div>
                        <strong>
                          {t("Order Total", "সর্বমোট")}: {formatBDT(getOrderTotal(order))}
                        </strong>
                      </div>

                      {address.note && (
                        <p>
                          <strong>{t("Customer Note:", "ক্রেতার নোট:")}</strong>{" "}
                          {address.note}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 14,
                        }}
                      >
                        <button
                          type="button"
                          style={primaryButtonStyle}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(bookingText);
                              setError("");
                              setMessage(
                                t(
                                  "Courier booking details copied.",
                                  "কুরিয়ার বুকিংয়ের তথ্য কপি হয়েছে।"
                                )
                              );
                            } catch {
                              setError(
                                t(
                                  "Clipboard access failed. Allow clipboard permission in your browser.",
                                  "কপি করা যায়নি। ব্রাউজারের Clipboard permission পরীক্ষা করুন।"
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
                            style={successButtonStyle}
                            disabled={saving}
                            onClick={() => updateOrderStatus(order, "processing")}
                          >
                            {t("Mark Processing", "প্রসেসিং শুরু করুন")}
                          </button>
                        )}

                        {status === "processing" && (
                          <button
                            type="button"
                            style={successButtonStyle}
                            disabled={saving}
                            onClick={() => updateOrderStatus(order, "shipped")}
                          >
                            {t("Mark Shipped", "শিপড হিসেবে চিহ্নিত করুন")}
                          </button>
                        )}

                        {status === "shipped" && (
                          <button
                            type="button"
                            style={successButtonStyle}
                            disabled={saving}
                            onClick={() => updateOrderStatus(order, "delivered")}
                          >
                            {t("Mark Delivered", "ডেলিভার্ড হিসেবে চিহ্নিত করুন")}
                          </button>
                        )}

                        {status === "delivered" &&
                          paymentMethod === "cod" &&
                          paymentStatus !== "paid" && (
                            <button
                              type="button"
                              style={successButtonStyle}
                              disabled={saving || historyActionId === orderId}
                              onClick={() => updateAdminPaymentStatus(order, "paid")}
                            >
                              {saving ? "Saving..." : "Mark as Paid"}
                            </button>
                          )}

                        {status === "delivered" && paymentStatus === "paid" && (
                          <button
                            type="button"
                            style={primaryButtonStyle}
                            disabled={historyActionId === orderId}
                            onClick={() => completeOrder(order)}
                          >
                            {historyActionId === orderId ? "Saving..." : "Done"}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={saving || historyActionId === orderId}
                          onClick={() => deleteCourierOrder(orderId)}
                          style={{
                            ...buttonStyle,
                            background: "#dc2626",
                            color: "#fff",
                            border: "1px solid #dc2626",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 16 }}>
              {t(
                "Copying prepares details for manual courier booking. It does not create a Pathao booking or tracking number.",
                "কপি করলে ম্যানুয়াল কুরিয়ার বুকিংয়ের তথ্য তৈরি হবে। এতে Pathao বুকিং বা ট্র্যাকিং নম্বর তৈরি হবে না।"
              )}
            </p>
          </section>
        )}

        {tab === "history" && (
          <section style={cardStyle}>
            <SectionTitle
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

                  <button
                    type="button"
                    style={{
                      ...buttonStyle,
                      background: "#dc2626",
                      color: "#fff",
                      borderColor: "#dc2626",
                    }}
                    disabled={deletingAllHistory || orderHistory.length === 0}
                    onClick={deleteAllHistory}
                  >
                    {deletingAllHistory ? "Deleting..." : "Delete All History"}
                  </button>
                </div>
              }
            >
              {t("Order History", "অর্ডার হিস্টোরি")}
            </SectionTitle>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                margin: "16px 0",
              }}
            >
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={t(
                  "Search order, customer, email or phone",
                  "অর্ডার, গ্রাহক, ইমেইল বা ফোন খুঁজুন"
                )}
                style={{ ...inputStyle, flex: "1 1 240px" }}
              />

              <select
                value={historyDateFilter}
                onChange={(event) => setHistoryDateFilter(event.target.value)}
                style={{ ...inputStyle, flex: "0 1 180px" }}
              >
                <option value="all">{t("All dates", "সব তারিখ")}</option>
                <option value="today">{t("Today", "আজ")}</option>
                <option value="7days">{t("Last 7 days", "গত ৭ দিন")}</option>
                <option value="30days">{t("Last 30 days", "গত ৩০ দিন")}</option>
              </select>
            </div>

            {historyLoading && orderHistory.length === 0 ? (
              <EmptyState>Loading Order History...</EmptyState>
            ) : visibleOrderHistory.length === 0 ? (
              <EmptyState>No History entries found.</EmptyState>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {visibleOrderHistory.map((item) => (
                  <article
                    key={item._id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 16,
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
                      <div>
                        <strong>{item.orderNumber || item.orderId}</strong>
                        <p style={{ margin: "6px 0" }}>
                          {item.customerName || "Customer"}
                        </p>
                        <p style={{ margin: "4px 0", color: "#6b7280" }}>
                          {item.customerPhone || item.customerEmail || "No contact"}
                        </p>
                      </div>

                      <div>
                        <strong>{formatBDT(item.total)}</strong>
                        <p style={{ margin: "6px 0" }}>
                          Payment: {item.paymentStatus || "N/A"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          Courier: {item.courier?.provider || "N/A"}
                        </p>
                      </div>
                    </div>

                    <p style={{ color: "#6b7280", fontSize: 12 }}>
                      Completed:{" "}
                      {item.completedAt
                        ? new Date(item.completedAt).toLocaleString()
                        : "N/A"}
                    </p>

                    <button
                      type="button"
                      style={buttonStyle}
                      disabled={historyActionId === item._id}
                      onClick={() => deleteHistoryEntry(item._id)}
                    >
                      {historyActionId === item._id
                        ? t("Deleting...", "মুছে ফেলা হচ্ছে...")
                        : t("Delete History Entry", "হিস্টোরি এন্ট্রি মুছুন")}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        <FloatingCalculator />

      </div>

  <style>{`
  @media (max-width: 640px) {
    table {
      font-size: 12px;
    }
  }
`}</style>
    </DashboardLayout>
    
  );
}
