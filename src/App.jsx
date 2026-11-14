import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { heroSlides, heroSlidesBn } from "./data/heroSlides";
import { copy } from "./data/translations";
import { resizeImage } from "./utils/resizeImage";
import { getTitle, productMatchesQuery, productSearchScore } from "./utils/productHelpers";

const ProductDetails = lazy(() => import("./components/ProductDetails"));
const CartPanel = lazy(() => import("./components/CartPanel"));
const CheckoutPanel = lazy(() => import("./components/CheckoutPanel"));
const OrderSuccess = lazy(() => import("./components/OrderSuccess"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
const AccountModal = lazy(() => import("./components/AccountModal"));
import StoreSearch from "./components/StoreSearch";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import RoleGuard from "./components/RoleGuard";
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard"));
const ModeratorDashboard = lazy(() => import("./components/moderator/ModeratorDashboard"));
const InlineProductEditor = lazy(() => import("./components/InlineProductEditor"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ModeratorApplicationPage = lazy(() => import("./pages/ModeratorApplicationPage"));
import BackToTop from "./components/BackToTop";
const CustomProjectPage = lazy(() => import("./pages/CustomProjectPage"));
import FloatingContactWidget from "./components/FloatingContactWidget";
const AIChat = lazy(() => import("./components/AI-chat"));
import {
  getAccessToken,
  getAuthUser,
  saveAuthSession,
  clearAuthSession,
  authFetch,
  saveAuthUser,
} from "./utils/authSession";

const ProductBulkImport = lazy(() => import("./components/ProductBulkImport"));

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const PRODUCT_CACHE_KEY = "prebotix-products-cache-v1";

function readCachedProducts() {
  try {
    const cached = localStorage.getItem(PRODUCT_CACHE_KEY);
    const parsed = cached ? JSON.parse(cached) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Role -> home path. Used after login and when a logged-in user opens /login.
function getRoleOfUser(user) {
  if (!user) return "";
  if (user.isAdmin === true) return "admin";
  return String(user.role || "customer").toLowerCase();
}

function getHomePathForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "moderator") return "/moderator";
  return "/";
}


export default function App() {
  const location = useLocation();
  const navigate = useNavigate();


  // NOTICE (declared early so every handler below can use showNotice)
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);



  const showNotice = useCallback((message, duration = 2600) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(
      () => setNotice(""),
      duration
    );
  }, []);

  useEffect(
    () => () => window.clearTimeout(noticeTimer.current),
    []
  );

  // PRODUCTS FROM MONGODB API + INSTANT LOCAL CACHE
  const [products, setProducts] = useState(() => readCachedProducts());

  const [productsLoaded, setProductsLoaded] = useState(
    () => readCachedProducts().length > 0
  );

  const [productsError, setProductsError] = useState("");

  // Save the latest successful product data for the next visit.
  useEffect(() => {
    if (!productsLoaded) return;

    try {
      localStorage.setItem(
        PRODUCT_CACHE_KEY,
        JSON.stringify(products)
      );
    } catch (error) {
      console.warn("[PreBotix] Product cache could not be saved:", error);
    }
  }, [products, productsLoaded]);
  // undefined = editor closed, null = "Add Product", object = "Edit Product".
  const [productEditor, setProductEditor] = useState(undefined);
  const [productEditorKey, setProductEditorKey] = useState(0);
  const [productDraftToRestore, setProductDraftToRestore] = useState(null);

  const openProductEditor = async (product) => {
    setProductEditorKey((key) => key + 1);

    if (!product) {
      setProductEditor(null);
      return;
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/products`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !Array.isArray(data.products)) {
        throw new Error(data.message || "Could not load full product details.");
      }

      const fullProduct = data.products.find(
        (item) => Number(item.id) === Number(product.id)
      );

      if (!fullProduct) {
        throw new Error("Product not found in Admin product list.");
      }

      console.log("[PreBotix] Full product loaded:", {
        id: fullProduct.id,
        costPrice: fullProduct.costPrice,
        costPriceMax: fullProduct.costPriceMax,
      });

      setProductEditor({
        ...fullProduct,
        priceOptions: Array.isArray(fullProduct.priceOptions)
          ? fullProduct.priceOptions.map((option) => ({ ...option }))
          : [],
      });
    } catch (error) {
      console.error("[PreBotix] Product editor load failed:", error);
      showNotice(error.message || "Could not load product details.", 3500);
    }
  };

  const handleCloseProductEditor = useCallback(() => {
    setProductEditor(undefined);
  }, []);

  // Called by the editor after it has taken the incoming draft.
  const handleDraftRestored = useCallback(() => {
    setProductDraftToRestore(null);
  }, []);

  const [productBulkImportOpen, setProductBulkImportOpen] =
    useState(false);
  const [storefrontSettings, setStorefrontSettings] = useState(() => {
    try {
      const cached = window.localStorage.getItem("prebotix-storefront-settings-v1");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/storefront-settings`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.settings) {
          try {
            window.localStorage.setItem(
              "prebotix-storefront-settings-v1",
              JSON.stringify(data.settings)
            );
          } catch {}
          setStorefrontSettings(data.settings);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Apply branding saved in Admin General Settings.
  useEffect(() => {
    const general = storefrontSettings?.general;
    if (!general) return;

    const websiteName = general.websiteName?.trim() || "PreBotix";
    document.title = websiteName;

    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement("meta");
      descriptionMeta.setAttribute("name", "description");
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.setAttribute(
      "content",
      general.siteDescription || ""
    );

    if (general.favicon) {
      let faviconLink = document.querySelector('link[rel~="icon"]');
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.setAttribute("rel", "icon");
        document.head.appendChild(faviconLink);
      }

      const faviconUrl = /^https?:\/\//i.test(general.favicon)
        ? general.favicon
        : `${API_BASE_URL.replace(/\/+$/, "")}${general.favicon.startsWith("/") ? "" : "/"}${general.favicon}`;

      faviconLink.setAttribute("href", faviconUrl);
    }
  }, [storefrontSettings]);
  // Keep other open storefront tabs in sync with edits made by Admin.
  useEffect(() => {
    let active = true;
    const syncStorefront = async () => {
      try {
        const [productResponse, settingsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/products`),
          fetch(`${API_BASE_URL}/api/storefront-settings`),
        ]);
        const [productData, settingsData] = await Promise.all([
          productResponse.json().catch(() => ({})),
          settingsResponse.json().catch(() => ({})),
        ]);
        if (!active) return;
        if (productResponse.ok && Array.isArray(productData.products)) {
          setProducts((current) =>
            JSON.stringify(current) === JSON.stringify(productData.products)
              ? current
              : productData.products
          );
          setProductsLoaded(true);
        }
        if (settingsResponse.ok && settingsData.settings) {
          try {
            window.localStorage.setItem(
              "prebotix-storefront-settings-v1",
              JSON.stringify(settingsData.settings)
            );
          } catch {}
          setStorefrontSettings(settingsData.settings);
        }
      } catch {
        /* Keep the last successfully loaded storefront data. */
      }
    };
    const timer = window.setInterval(syncStorefront, 15000);
    window.addEventListener("focus", syncStorefront);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", syncStorefront);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setProductsError("");

        const response = await fetch(`${API_BASE_URL}/api/products`, {
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !Array.isArray(data.products)) {
          throw new Error(data.message || "Could not load products.");
        }

        setProducts(data.products);
        setProductsLoaded(true);
        setProductsError("");
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Product loading failed:", error);

        // Keep cached products visible if the API is temporarily unavailable.
        if (!productsLoaded) {
          setProductsError(error.message);
        }
      }
    }

    loadProducts();

    return () => controller.abort();
  }, []);


  const reloadPublicProducts = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.products)) {
      throw new Error(data.message || "Could not reload products.");
    }
    setProducts(data.products);
    setProductsLoaded(true);
    return data.products;
  }, []);

  const handleProductSaved = useCallback(async () => {
    await reloadPublicProducts();
    showNotice("Product saved to MongoDB. Storefront updated.", 3500);
  }, [reloadPublicProducts, showNotice]);

  const handleProductDeleted = useCallback(
    async (product) => {
      const productId = product?.id;
      if (!Number.isSafeInteger(Number(productId)) || Number(productId) < 1) {
        showNotice("Could not delete product: invalid product ID.", 3500);
        return;
      }

      const token = getAccessToken();
      if (!token) {
        showNotice("Admin login required to delete products.", 3500);
        return;
      }

      try {
        const response = await authFetch(
          `${API_BASE_URL}/api/admin/products/${Number(productId)}`,
          {
            method: "DELETE",
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Product could not be deleted.");
        }
        await reloadPublicProducts();
        showNotice(data.message || "Product deleted. Storefront updated.", 3500);
      } catch (error) {
        showNotice(error.message || "Product could not be deleted.", 3500);
      }
    },
    [reloadPublicProducts, showNotice]
  );

  const [lang, setLang] = useState("en");

  // HERO SLIDER
  const [slideState, setSlideState] = useState({
    active: 0,
    prev: null,
    dir: 0,
  });

  const activeSlide = slideState.active;
  const prevSlide = slideState.prev;
  const slideDir = slideState.dir;

  const goToSlide = (target, dir) =>
    setSlideState((state) => {
      const next =
        typeof target === "function" ? target(state.active) : target;

      if (next === state.active) return state;

      const direction = dir ?? (next > state.active ? 1 : -1);

      return {
        active: next,
        prev: state.active,
        dir: direction,
      };
    });

  const slideText = (index) => {
    const base =
      lang === "bn"
        ? { ...heroSlides[index], ...heroSlidesBn[index] }
        : heroSlides[index];
    const edited = storefrontSettings?.slides?.[index];
    if (!edited) return base;
    return {
      ...base,
      badge: edited.badge || base.badge,
      headlineA: edited.headlineA || base.headlineA,
      headlineB: edited.headlineB || base.headlineB,
      subtitle: edited.subtitle || base.subtitle,
      label: edited.label || base.label,
      image: edited.image || base.image,
      cta: edited.cta || base.cta,
    };
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      goToSlide((current) => (current + 1) % heroSlides.length, 1);
    }, 5500);

    return () => window.clearTimeout(timer);
  }, [activeSlide]);

  const [mobileOpen, setMobileOpen] = useState(false);

  // SEARCH AND CATEGORY
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const [category, setCategory] = useState("all");
  const [categoryOpen, setCategoryOpen] = useState(false);

  const imageSearchRef = useRef(null);
  const categoryRef = useRef(null);
  const searchBoxRef = useRef(null);

  const [imageStatus, setImageStatus] = useState("idle");
  const [imageMatches, setImageMatches] = useState([]);
  const [imagePreview, setImagePreview] = useState("");

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.category))],
    [products]
  );

  // CART
  const [cartItems, setCartItems] = useState([]);

  const getCartKey = (item) => {
    const optionId =
      item.selectedPriceOption?.optionId ||
      item.priceOptionId ||
      "";

    return `${item.id}:${optionId || "default"}`;
  };

  const getAccountStorageKey = (baseKey, user) => {
    const identity = user?._id || user?.id || user?.email;

    if (!identity) return "";

    return `${baseKey}:${encodeURIComponent(
      String(identity).trim().toLowerCase()
    )}`;
  };

  const cartStorageAccountRef = useRef("");
  const skipNextCartSaveRef = useRef(true);

  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [order, setOrder] = useState(null);

  // ACCOUNT
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState("login");

  const [accountUser, setAccountUser] = useState(() => getAuthUser());

  const currentRole = String(accountUser?.role || "").toLowerCase();

  const isAdminUser =
    accountUser?.isAdmin === true || currentRole === "admin";

  const isModeratorUser = currentRole === "moderator";

  // PRODUCT DETAILS AND NAVIGATION
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recentIds, setRecentIds] = useState([]);
  const [showCatalogPage, setShowCatalogPage] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [productsRefreshing, setProductsRefreshing] = useState(true);

  const [settledProductImages, setSettledProductImages] = useState(
  () => new Set()
);

const handleProductImageSettled = useCallback((productId) => {
  setSettledProductImages((current) => {
    if (current.has(String(productId))) return current;

    const next = new Set(current);
    next.add(String(productId));

    if (next.size >= Math.min(2, products.length)) {
      setProductsRefreshing(false);
    }

    return next;
  });
}, [products.length]);

  // Sync browser URLs with existing storefront state.
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, "") || "/";

    if (path === "/wishlist" && (isAdminUser || isModeratorUser)) {
      setShowWishlist(false);
      setShowCatalogPage(true);
      setSelectedProduct(null);
      setAccountOpen(false);
      navigate("/products", { replace: true });
      return;
    }

    if (
      path === "/products" ||
      path === "/shop" ||
      path === "/wishlist"
    ) {
      setShowCatalogPage(true);
      setShowWishlist(path === "/wishlist");
      setSelectedProduct(null);
      setAccountOpen(false);
      return;
    }

    if (path === "/custom") {
      setShowCatalogPage(false);
      setShowWishlist(false);
      setSelectedProduct(null);
      setAccountOpen(false);
      return;
    }
    const productMatch = path.match(/^\/products\/([^/]+)$/);
    if (productMatch) {
      const productId = decodeURIComponent(productMatch[1]);
      const product = products.find((item) => String(item.id) === productId);

      setShowCatalogPage(false);
      setShowWishlist(false);
      setAccountOpen(false);

      if (product) {
        setSelectedProduct(product);
      }
      return;
    }

    // /login and /register: already logged-in users go to their own home.
    if (path === "/login" || path === "/register") {
      const savedUser = getAuthUser();
      const savedToken = getAccessToken();

      if (savedUser && savedToken) {
        setAccountOpen(false);
        navigate("/", { replace: true });
        return;
      }

      setShowCatalogPage(false);
      setShowWishlist(false);
      setAccountMode(path === "/register" ? "register" : "login");
      setAccountOpen(true);
      return;
    }

    // /account: opened only when the user goes there on purpose
    // (never automatically after login).
    if (path === "/account" || path === "/account/orders") {
      setShowCatalogPage(false);
      setShowWishlist(false);

      const savedUser = getAuthUser();
      const savedToken = getAccessToken();

      if (savedUser && savedToken) {
        const role = getRoleOfUser(savedUser);

        if (role === "admin" || role === "moderator") {
          setAccountOpen(false);
          navigate("/", { replace: true });
          return;
        }

        setAccountUser(savedUser);
        setAccountMode("dashboard");
      } else {
        setAccountUser(null);
        setAccountMode("login");
      }

      setAccountOpen(true);
      return;
    }

    if (path === "/" || path === "/index.html") {
      setShowCatalogPage(false);
      setShowWishlist(false);
      setAccountOpen(false);
    }
  }, [
    location.pathname,
    products,
    productsLoaded,
    isAdminUser,
    isModeratorUser,
    navigate,
  ]);

  // ACCOUNT-SPECIFIC WISHLIST
  const [favoriteIds, setFavoriteIds] = useState([]);

  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountOtp, setAccountOtp] = useState("");
  const [accountOtpExpiresAt, setAccountOtpExpiresAt] = useState(null);
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [myOrders, setMyOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");


  // Keep React state in sync when authFetch detects an expired session.
  useEffect(() => {
  const handleSessionExpired = () => {
    cartStorageAccountRef.current = "";
    skipNextCartSaveRef.current = true;

    setAccountUser(null);
    setCartItems([]);
    setFavoriteIds([]);
    setMyOrders([]);
    setOrdersError("Your session has expired. Please log in again.");

    setAccountMode("login");
    setAccountPassword("");
    setAccountOtp("");
    setAccountNewPassword("");
    setAccountMessage("");
    setAccountOpen(false);

    setCartOpen(false);
    setCheckoutOpen(false);
  };

  const handleUserUpdated = () => {
    setAccountUser(getAuthUser());
  };

  window.addEventListener(
    "prebotix:session-expired",
    handleSessionExpired
  );

  window.addEventListener(
    "prebotix:user-updated",
    handleUserUpdated
  );

  return () => {
    window.removeEventListener(
      "prebotix:session-expired",
      handleSessionExpired
    );

    window.removeEventListener(
      "prebotix:user-updated",
      handleUserUpdated
    );
  };
}, []);

  
  // Keep the logged-in user's role synchronized with the backend.
  useEffect(() => {
    let active = true;

    const syncCurrentUser = async () => {
      if (!getAccessToken()) return;

      try {
        const response = await authFetch(
          `${API_BASE_URL}/api/auth/me`
        );

        if (!response.ok) return;

        const data = await response.json();

        if (!active || !data.success || !data.user) return;

        const currentUser = getAuthUser();

        const roleChanged =
          currentUser?.role !== data.user.role ||
          currentUser?.isAdmin !== data.user.isAdmin;

        if (roleChanged) {
          saveAuthUser(data.user);
          setAccountUser(data.user);
        }
      } catch (error) {
        console.warn(
          "[PreBotix] User sync failed:",
          error.message
        );
      }
    };

    syncCurrentUser();

    const intervalId = window.setInterval(
      syncCurrentUser,
      5000
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);


  const t = copy[lang];

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const recentList = recentIds
    .map((id) =>
      products.find((product) => String(product.id) === String(id))
    )
    .filter(Boolean);

  // SAVE CART ONLY TO THE CURRENT ACCOUNT
  useEffect(() => {
    if (!productsLoaded) return;

    if (skipNextCartSaveRef.current) {
      skipNextCartSaveRef.current = false;
      return;
    }

    if (!accountUser) return;

    const cartKey = getAccountStorageKey("prebotix-cart-v1", accountUser);

    if (!cartKey || cartStorageAccountRef.current !== cartKey) return;

    try {
      localStorage.setItem(
        cartKey,
        JSON.stringify(
          cartItems.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            priceOptionId:
              item.selectedPriceOption?.optionId || "",
          }))
        )
      );
    } catch {
      // Cart remains usable in the current session.
    }
  }, [cartItems, accountUser, productsLoaded]);

  // SAVE WISHLIST ONLY TO THE CURRENT ACCOUNT
  useEffect(() => {
    if (!accountUser) return;

    const wishlistKey = getAccountStorageKey(
      "prebotix-wishlist-v1",
      accountUser
    );

    const cartKey = getAccountStorageKey(
      "prebotix-cart-v1",
      accountUser
    );

    if (
      !wishlistKey ||
      cartStorageAccountRef.current !== cartKey
    ) {
      return;
    }

    try {
      localStorage.setItem(
        wishlistKey,
        JSON.stringify(favoriteIds)
      );
    } catch {
      // Wishlist remains usable in the current session.
    }
  }, [favoriteIds, accountUser]);

  // LOAD CART FOR THE CURRENT ACCOUNT
  useEffect(() => {
    if (!productsLoaded) return;

    if (!accountUser) {
      cartStorageAccountRef.current = "";
      skipNextCartSaveRef.current = true;
      setCartItems([]);
      return;
    }

    const storageKey = getAccountStorageKey(
      "prebotix-cart-v1",
      accountUser
    );

    if (!storageKey) return;

    cartStorageAccountRef.current = storageKey;
    skipNextCartSaveRef.current = true;

    try {
      const savedItems = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
      );

      if (!Array.isArray(savedItems)) {
        setCartItems([]);
        return;
      }

      const restoredItems = savedItems
        .map((saved) => {
          const product = products.find(
            (item) => String(item.id) === String(saved.id)
          );

          if (!product) return null;

          const quantity = Math.max(
            1,
            Math.min(
              Number(product.stock) || 1,
              Number(saved.quantity) || 1
            )
          );

          const optionId = String(saved.priceOptionId || "");

          const selectedOption = optionId
            ? (product.priceOptions || []).find(
                (option) => String(option.id) === optionId
              )
            : null;

          // An option-based cart line must still have a valid option.
          if (optionId && !selectedOption) return null;

          if (product.priceOptionsEnabled && !selectedOption) {
            return null;
          }

          const selectedPriceOption = selectedOption
            ? {
                optionId: String(selectedOption.id),
                groupTitle: product.priceOptionsTitle || "",
                optionText: selectedOption.text || "",
                selectedPrice: Number(selectedOption.price),
              }
            : null;

          const cartKey = `${product.id}:${
            optionId || "default"
          }`;

          return {
            ...product,
            price: selectedOption
              ? Number(selectedOption.price)
              : Number(product.price),
            quantity,
            selectedPriceOption,
            cartKey,
          };
        })
        .filter(Boolean);

      setCartItems(restoredItems);
    } catch {
      setCartItems([]);
    }
  }, [productsLoaded, products, accountUser]);

  // PRODUCT FILTERING
  const visibleProducts = useMemo(() => {
    const query = searchQuery.trim();
    return products
      .map((product) => ({
        product,
        score: productSearchScore(product, query),
      }))
      .filter(({ product, score }) => {
        const productCategory = String(product.category || "")
          .trim()
          .toUpperCase();
        const matchesCategory =
          category === "all" ||
          (category === "projects"
            ? productCategory === "ROBOTICS KIT"
            : category === "components"
              ? productCategory !== "ROBOTICS KIT"
              : product.category === category);
        return score > 0 && matchesCategory;
      })
      .sort((a, b) => (query ? b.score - a.score : 0))
      .map(({ product }) => product);
  }, [products, searchQuery, category]);

  const searchSuggestions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) return [];

    return products
      .map((product) => ({
        product,
        score: productSearchScore(product, query),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.product);
  }, [products, searchQuery]);

  // SAVE WISHLIST
  useEffect(() => {
    try {
      localStorage.setItem(
        "prebotix-wishlist-v1",
        JSON.stringify(favoriteIds)
      );
    } catch {
      // Wishlist remains usable for this session.
    }
  }, [favoriteIds]);

  // MODAL SCROLL LOCK
  useEffect(() => {
    document.body.style.overflow =
      cartOpen || checkoutOpen || order || accountOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, checkoutOpen, order, accountOpen]);

  // KEYBOARD AND OUTSIDE CLICK
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        setSearchFocused(false);
        setCategoryOpen(false);
        setAccountOpen(false);
        setCartOpen(false);
      }
    };

    const onDown = (event) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target)
      ) {
        setSearchFocused(false);
      }

      if (
        categoryRef.current &&
        !categoryRef.current.contains(event.target)
      ) {
        setCategoryOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const scrollTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // WISHLIST: TOGGLE FAVORITE
  const toggleFavorite = (productId) => {
    if (isAdminUser || isModeratorUser) {
      showNotice(
        lang === "bn"
          ? "à¦à¦‡ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿà§‡ à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤"
          : "Wishlist is not available for this account."
      );
      return;
    }

    const token = getAccessToken();

    if (!accountUser || !token) {
      showNotice(
        lang === "bn" ? "à¦†à¦—à§‡ à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨!" : "Please login first!"
      );
      setAccountMode("login");
      setAccountOpen(true);
      return;
    }

    setFavoriteIds((currentIds) => {
      const id = String(productId);
      const exists = currentIds.some((savedId) => String(savedId) === id);

      return exists
        ? currentIds.filter((savedId) => String(savedId) !== id)
        : [...currentIds, id];
    });
  };

  // WISHLIST: OPEN PAGE
  const openWishlist = () => {
    if (isAdminUser || isModeratorUser) {
      showNotice(
        lang === "bn"
          ? "à¦à¦‡ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿà§‡ à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤"
          : "Wishlist is not available for this account."
      );
      return;
    }

    setSelectedProduct(null);
    setShowCatalogPage(true);
    setShowWishlist(true);
    navigate("/wishlist");
    setMobileOpen(false);
    setSearchFocused(false);
    scrollTop();
  };

  // NAVIGATION: CLEAR WISHLIST WHEN OPENING OTHER PAGES
  const navigateToCatalog = (value) => {
    setShowWishlist(false);
    setShowCatalogPage(value);
    setSelectedProduct(null);
    navigate(value ? "/products" : "/");
  };


  // ADD TO CART
  const addToCart = (product, amount = 1, selectedOption = null) => {
    if (isAdminUser || isModeratorUser) {
      showNotice(
        lang === "bn"
          ? "à¦à¦‡ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿà§‡ à¦•à¦¾à¦°à§à¦Ÿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾à¥¤"
          : "Cart is not available for this account."
      );
      return;
    }

    // Always use the latest product data from App state.
    const currentProduct =
      products.find(
        (item) => String(item.id) === String(product.id)
      ) || product;

    const optionsEnabled =
      currentProduct.priceOptionsEnabled === true;

    // Resolve selected option from the latest product data.
    const latestOption = optionsEnabled
      ? (currentProduct.priceOptions || []).find(
        (option) =>
          String(option.id) === String(selectedOption?.optionId)
      )
      : null;

    if (optionsEnabled && !latestOption) {
      showNotice(
        lang === "bn"
          ? "à¦•à¦¾à¦°à§à¦Ÿà§‡ à¦¯à§‹à¦— à¦•à¦°à¦¾à¦° à¦†à¦—à§‡ à¦à¦•à¦Ÿà¦¿ à¦¸à¦ à¦¿à¦• Price Option à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨à¥¤"
          : "Please select a valid price option."
      );
      return;
    }

    // Main product price OR latest selected option price.
    const selectedPrice = optionsEnabled
      ? Number(latestOption.price)
      : Number(currentProduct.price);

    if (!Number.isFinite(selectedPrice) || selectedPrice < 0) {
      showNotice(
        lang === "bn"
          ? "à¦ªà¦£à§à¦¯à§‡à¦° à¦¦à¦¾à¦® à¦¸à¦ à¦¿à¦• à¦¨à¦¯à¦¼à¥¤"
          : "The product price is invalid."
      );
      return;
    }

    const optionId = optionsEnabled
      ? String(latestOption.id)
      : "";

    const cartKey = `${currentProduct.id}:${optionId || "default"}`;

    const currentProductQty = cartItems
      .filter(
        (item) => String(item.id) === String(currentProduct.id)
      )
      .reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

    const available = Math.max(
      0,
      Number(currentProduct.stock || 0) - currentProductQty
    );

    if (available <= 0) {
      showNotice(t.maxStock);
      return;
    }

    const requestedQty = Math.max(1, Number(amount) || 1);
    const addQty = Math.min(requestedQty, available);

    const optionSnapshot = latestOption
      ? {
        optionId,
        groupTitle: currentProduct.priceOptionsTitle || "",
        optionText: latestOption.text || "",
        selectedPrice,
        selectedOriginalPrice:
          latestOption.originalPrice != null
            ? Number(latestOption.originalPrice)
            : null,
      }
      : null;

    setCartItems((items) => {
      const existing = items.find(
        (item) => (item.cartKey || getCartKey(item)) === cartKey
      );

      if (existing) {
        return items.map((item) =>
          (item.cartKey || getCartKey(item)) === cartKey
            ? {
              ...item,
              ...currentProduct,
              price: selectedPrice,
              quantity: Number(item.quantity || 0) + addQty,
              selectedPriceOption: optionSnapshot,
              cartKey,
            }
            : item
        );
      }

      return [
        ...items,
        {
          ...currentProduct,
          price: selectedPrice,
          quantity: addQty,
          selectedPriceOption: optionSnapshot,
          cartKey,
        },
      ];
    });

    const name = getTitle(currentProduct, lang);

    showNotice(
      addQty < requestedQty
        ? `${name} â€” ${lang === "bn"
          ? `à¦®à¦¾à¦¤à§à¦° ${addQty}à¦Ÿà¦¿ à¦¯à§‹à¦— à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡; à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š à¦¸à§à¦Ÿà¦•à§‡à¦° à¦¸à§€à¦®à¦¾à¦¯à¦¼ à¦ªà§Œà¦à¦›à§‡à¦›à§‡à¥¤`
          : `only ${addQty} added; maximum stock reached.`
        }`
        : `${name} â€” ${t.added}`
    );
  };

  // PRODUCT DETAILS
  const openProduct = (product) => {
    setSelectedProduct(product);
    navigate(`/products/${encodeURIComponent(product.id)}`);
    setShowCatalogPage(false);
    setShowWishlist(false);

    setRecentIds((ids) =>
      [
        product.id,
        ...ids.filter((id) => String(id) !== String(product.id)),
      ].slice(0, 4)
    );

    setSearchFocused(false);
    scrollTop();
  };

  const handleProductBack = useCallback(() => {
    setSelectedProduct(null);
    setShowCatalogPage(false);
    setShowWishlist(false);
    setAccountOpen(false);

    navigate("/", { replace: true });

    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [navigate]);

  const goSection = (id) => {
    setMobileOpen(false);
    setSelectedProduct(null);
    setShowCatalogPage(false);
    setShowWishlist(false);

    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  };

  const chooseCategory = (value) => {
    setCategory(value);
    setCategoryOpen(false);
    goSection("projects");
  };

  // IMAGE SEARCH
  const clearImageSearch = () => {
    setImageStatus("idle");
    setImageMatches([]);

    setImagePreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return "";
    });
  };

  const handleImageSearch = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    const url = URL.createObjectURL(file);

    setImagePreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });

    setImageMatches([]);
    setImageStatus("loading");
    setSearchFocused(true);

    try {
      const image = await resizeImage(file);

      const response = await fetch(`${API_BASE_URL}/api/image-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image,
          catalog: products.map(({ id, title, category }) => ({
            id,
            title,
            category,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const { matches = [] } = await response.json();

      const list = matches
        .map((match) => ({
          product: products.find((product) => product.id === match.id),
          score: Number(match.confidence) || 0,
        }))
        .filter((match) => match.product)
        .slice(0, 5);

      setImageMatches(list);
      setImageStatus("done");
    } catch (error) {
      console.error("Image search failed:", error);
      setImageStatus("error");
    }
  };

  // CART QUANTITY
  const changeQuantity = (cartKey, delta) => {
    setCartItems((items) => {
      const target = items.find(
        (item) => (item.cartKey || getCartKey(item)) === cartKey
      );

      if (!target) return items;

      const currentProductQty = items
        .filter((item) => Number(item.id) === Number(target.id))
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      const nextQty = target.quantity + delta;

      if (delta > 0 && currentProductQty >= Number(target.stock)) {
        showNotice(t.maxStock);
        return items;
      }

      return items.map((item) => {
        if ((item.cartKey || getCartKey(item)) !== cartKey) return item;

        return {
          ...item,
          quantity: Math.max(1, Math.min(Number(item.stock), nextQty)),
        };
      });
    });
  };

  const removeItem = (cartKey) => {
    setCartItems((items) =>
      items.filter(
        (item) => (item.cartKey || getCartKey(item)) !== cartKey
      )
    );
  };

  // CHECKOUT - SAVE ORDER THROUGH AUTHENTICATED API
  const completeOrder = async (payload) => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      throw new Error(
        lang === "bn"
          ? "à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦ªà§à¦°à¦¥à¦®à§‡ à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨à¥¤"
          : "Please log in before placing your order."
      );
    }

    const response = await authFetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        form: payload.form,
        items: payload.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          priceOptionId:
            item.priceOptionId ||
            item.selectedPriceOption?.optionId ||
            "",
        })),
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Place order failed:", {
        status: response.status,
        message: result.message,
      });

      throw new Error(
        result.message ||
          (lang === "bn"
            ? `à¦…à¦°à§à¦¡à¦¾à¦° à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤ Error: ${response.status}`
            : `Could not place order. Error: ${response.status}`)
      );
    }

    const savedOrder = result.order;

    if (!savedOrder?.orderNumber || !Array.isArray(savedOrder.items)) {
      throw new Error(
        lang === "bn"
          ? "à¦¸à¦¾à¦°à§à¦­à¦¾à¦° à¦¥à§‡à¦•à§‡ à¦…à¦°à§à¦¡à¦¾à¦°à¦Ÿà¦¿ à¦¸à¦ à¦¿à¦•à¦­à¦¾à¦¬à§‡ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤"
          : "The server did not return a valid order confirmation."
      );
    }

    // Immediately update product stock after checkout.
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        const orderedItem = savedOrder.items.find(
          (item) => Number(item.productId) === Number(product.id)
        );

        if (!orderedItem) return product;

        return {
          ...product,
          stock: Math.max(0, product.stock - Number(orderedItem.quantity)),
        };
      })
    );

    const newOrder = {
      number: savedOrder.orderNumber,
      createdAt: savedOrder.createdAt,
      subtotal: savedOrder.subtotal,
      deliveryFee: savedOrder.deliveryFee,
      codFee: savedOrder.codFee,
      total: savedOrder.total,

      items: savedOrder.items.map((item) => ({
        id: item.productId,
        title: item.title,
        bn: item.title,
        price: Number(item.price),
        quantity: Number(item.quantity),

        selectedPriceOption: item.selectedPriceOption?.optionId
          ? {
            optionId: item.selectedPriceOption.optionId,
            groupTitle: item.selectedPriceOption.groupTitle || "",
            optionText: item.selectedPriceOption.optionText || "",
            selectedPrice: Number(item.selectedPriceOption.selectedPrice),
            selectedOriginalPrice:
              item.selectedPriceOption.selectedOriginalPrice != null
                ? Number(item.selectedPriceOption.selectedOriginalPrice)
                : null,
          }
          : null,
      })),
    };

    // Clear only the current user's saved cart after order success.
    const cartKey = getAccountStorageKey(
      "prebotix-cart-v1",
      accountUser
    );

    if (cartKey) {
      try {
        localStorage.setItem(cartKey, "[]");
      } catch (error) {
        console.error("Could not clear saved cart:", error);
      }
    }

    // Clear the in-memory cart and close checkout.
    setCartItems([]);
    setOrder(newOrder);
    setCheckoutOpen(false);
    setCartOpen(false);
  };

  const closeOrder = () => {
    setOrder(null);
    setSearchQuery("");
    setCategory("all");
    setSelectedProduct(null);
    setShowCatalogPage(false);
    setShowWishlist(false);
    scrollTop();
  };

  // LOAD AUTHENTICATED CUSTOMER'S ORDERS
  const loadMyOrders = useCallback(async ({ silent = false } = {}) => {
    const token = getAccessToken();

    if (!token) {
      setMyOrders([]);
      setOrdersError("Please log in again.");
      setOrdersLoading(false);
      return;
    }

    if (!silent) setOrdersLoading(true);
    if (!silent) setOrdersError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/api/orders/my`, {
        method: "GET",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not load your orders.");
      }

      const orders = Array.isArray(data.orders) ? data.orders : [];
      setMyOrders(orders);

      // RESTORE CART ITEMS FROM CANCELLED ORDERS
      if (productsLoaded && accountUser) {
        const cartKey = getAccountStorageKey(
          "prebotix-cart-v1",
          accountUser
        );

        const identity = accountUser._id || accountUser.id || accountUser.email;
        const restoredKey = identity
          ? `prebotix-cart-restored-orders-v1:${encodeURIComponent(
              String(identity).trim().toLowerCase()
            )}`
          : "";

        if (cartKey && restoredKey) {
          try {
            const savedCart = JSON.parse(
              localStorage.getItem(cartKey) || "[]"
            );

            const cart = Array.isArray(savedCart) ? savedCart : [];
            const processed = JSON.parse(
              localStorage.getItem(restoredKey) || "[]"
            );
            const processedIds = new Set(
              Array.isArray(processed) ? processed.map(String) : []
            );

            const pendingOrders = orders.filter((order) => {
              const orderId = String(order._id || order.id || "");
              return (
                order.cartRestorePending === true &&
                orderId
              );
            });

            const mergedCart = [...cart];
            const acknowledgedIds = [];

            for (const order of pendingOrders) {
              const orderId = String(order._id || order.id || "");

              // Already added to cart earlier: retry only backend acknowledgement.
              if (processedIds.has(orderId)) {
                acknowledgedIds.push(orderId);
                continue;
              }

              const orderItems = Array.isArray(order.items) ? order.items : [];

              if (!orderId || orderItems.length === 0) continue;

              // Work on a temporary cart. Commit only if every item is valid.
              const orderCart = [...mergedCart];
              let orderComplete = true;

              for (const item of orderItems) {
                const productId = item.productId ?? item.id;
                const product = products.find(
                  (p) => String(p.id) === String(productId)
                );

                if (!product) {
                  orderComplete = false;
                  break;
                }

                const snapshot = item.selectedPriceOption || {};
                let optionId = String(
                  snapshot.optionId || item.priceOptionId || ""
                );

                let selectedOption = optionId
                  ? (product.priceOptions || []).find(
                      (option) => String(option.id) === optionId
                    )
                  : null;

                if (!selectedOption && snapshot.optionText) {
                  selectedOption = (product.priceOptions || []).find(
                    (option) =>
                      String(option.text || "") ===
                        String(snapshot.optionText) &&
                      Number(option.price) === Number(snapshot.selectedPrice)
                  );

                  if (selectedOption) {
                    optionId = String(selectedOption.id);
                  }
                }

                if (optionId && !selectedOption) {
                  orderComplete = false;
                  break;
                }

                if (product.priceOptionsEnabled && !selectedOption) {
                  orderComplete = false;
                  break;
                }

                const quantity = Math.max(1, Number(item.quantity) || 1);

                const existingIndex = orderCart.findIndex((saved) => {
                  return (
                    String(saved.id) === String(product.id) &&
                    String(saved.priceOptionId || "") === optionId
                  );
                });

                if (existingIndex >= 0) {
                  orderCart[existingIndex] = {
                    ...orderCart[existingIndex],
                    quantity:
                      (Number(orderCart[existingIndex].quantity) || 0) +
                      quantity,
                  };
                } else {
                  orderCart.push({
                    id: product.id,
                    quantity,
                    priceOptionId: optionId,
                  });
                }
              }

              if (orderComplete) {
                mergedCart.splice(0, mergedCart.length, ...orderCart);
                acknowledgedIds.push(orderId);
              } else {
                console.warn(
                  "Cart restoration skipped because an order item is unavailable:",
                  orderId
                );
              }
            }

            if (acknowledgedIds.length > 0) {
              // Save cart first, then mark these orders as processed.
              localStorage.setItem(cartKey, JSON.stringify(mergedCart));

              const updatedProcessed = [
                ...processedIds,
                ...acknowledgedIds,
              ];

              localStorage.setItem(
                restoredKey,
                JSON.stringify([...new Set(updatedProcessed)])
              );

              // Rebuild the in-memory cart from the saved cart.
              const restoredItems = mergedCart
                .map((saved) => {
                  const product = products.find(
                    (p) => String(p.id) === String(saved.id)
                  );

                  if (!product) return null;

                  const savedOptionId = String(saved.priceOptionId || "");
                  const option = savedOptionId
                    ? (product.priceOptions || []).find(
                        (entry) => String(entry.id) === savedOptionId
                      )
                    : null;

                  if (savedOptionId && !option) return null;
                  if (product.priceOptionsEnabled && !option) return null;

                  const quantity = Math.max(
                    1,
                    Number(saved.quantity) || 1
                  );

                  return {
                    ...product,
                    price: option
                      ? Number(option.price)
                      : Number(product.price),
                    quantity,
                    selectedPriceOption: option
                      ? {
                          optionId: String(option.id),
                          groupTitle: product.priceOptionsTitle || "",
                          optionText: option.text || "",
                          selectedPrice: Number(option.price),
                        }
                      : null,
                    cartKey: `${product.id}:${savedOptionId || "default"}`,
                  };
                })
                .filter(Boolean);

              setCartItems(restoredItems);

              // Acknowledge restoration to the backend.
              for (const orderId of acknowledgedIds) {
                try {
                  await authFetch(
                    `${API_BASE_URL}/api/orders/${encodeURIComponent(
                      orderId
                    )}/cart-restored`,
                    {
                      method: "POST",
                    }
                  );
                } catch (ackError) {
                  console.error(
                    "Cart restoration acknowledgement failed:",
                    ackError
                  );
                }
              }
            }
          } catch (restoreError) {
            console.error("Cart restoration failed:", restoreError);
          }
        }
      }
    } catch (error) {
      console.error("Loading orders failed:", error);
      if (!silent) setOrdersError(error.message || "Could not load your orders.");
    } finally {
      if (!silent) setOrdersLoading(false);
    }
  }, [lang, accountUser, products, productsLoaded]);

  // OPEN ACCOUNT (navbar account icon, user clicks on purpose)
  const openAccount = () => {
    setMobileOpen(false);
    setShowCatalogPage(false);
    setShowWishlist(false);
    setAccountMessage("");

    const user = getAuthUser();
    const token = getAccessToken();

    if (!user || !token) {
      setAccountUser(null);
      setAccountMode("login");
      setAccountOpen(true);
      return;
    }

    setAccountUser(user);
    const role = getRoleOfUser(user);

    if (role === "admin") {
      setAccountOpen(false);
      navigate("/admin");
      return;
    }

    if (role === "moderator") {
      setAccountOpen(false);
      navigate("/moderator");
      return;
    }

    setAccountMode("dashboard");
    setAccountOpen(true);
  };

  // AUTH API HELPER
  const apiRequest = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || data.error || `Request failed (${response.status}).`
      );
    }

    return data;
  };

  // REGISTER AND PASSWORD LOGIN: STEP 1
  const submitAccount = async (event) => {
    event.preventDefault();
    setAccountMessage("");

    const email = accountEmail.trim().toLowerCase();

    if (
      !email ||
      !accountPassword.trim() ||
      (accountMode === "register" && !accountName.trim())
    ) {
      setAccountMessage(
        lang === "bn"
          ? "à¦¸à¦¬ à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨à§€à¦¯à¦¼ à¦¤à¦¥à§à¦¯ à¦ªà§‚à¦°à¦£ à¦•à¦°à§à¦¨à¥¤"
          : "Please fill in all required fields."
      );
      return;
    }

    setAccountLoading(true);

    try {
      if (accountMode === "register") {
        const data = await apiRequest("/register", {
          name: accountName.trim(),
          email,
          password: accountPassword,
        });

        setAccountEmail(email);
        setAccountOtpExpiresAt(data.otpExpiresAt || null);
        setAccountPassword("");
        setAccountOtp("");
        setAccountMode("verify-registration");

        setAccountMessage(
          data.message ||
            (lang === "bn"
              ? "à¦‡à¦®à§‡à¦‡à¦²à§‡ à¦ªà¦¾à¦ à¦¾à¦¨à§‹ OTP à¦¦à¦¿à¦¯à¦¼à§‡ à¦¯à¦¾à¦šà¦¾à¦‡ à¦•à¦°à§à¦¨à¥¤"
              : "Check your email for the verification code.")
        );
      } else if (accountMode === "login") {
        const data = await apiRequest("/login", {
          email,
          password: accountPassword,
        });

        setAccountEmail(email);
        setAccountOtpExpiresAt(data.otpExpiresAt || null);
        setAccountPassword("");
        setAccountOtp("");
        setAccountMode("verify-login");

        setAccountMessage(
          data.message ||
            (lang === "bn"
              ? "à¦‡à¦®à§‡à¦‡à¦²à§‡ à¦ªà¦¾à¦ à¦¾à¦¨à§‹ OTP à¦¦à¦¿à¦¯à¦¼à§‡ à¦²à¦—à¦‡à¦¨ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦•à¦°à§à¦¨à¥¤"
              : "Check your email for the login code.")
        );
      }
    } catch (error) {
      setAccountMessage(error.message);
    } finally {
      setAccountLoading(false);
    }
  };

  // VERIFY REGISTRATION OR LOGIN OTP: STEP 2
  const verifyAccountOtp = async (event) => {
    event.preventDefault();

    setAccountMessage("");
    setAccountLoading(true);

    try {
      const email = accountEmail.trim().toLowerCase();

      if (accountMode === "verify-registration") {
        const data = await apiRequest("/verify-registration", {
          email,
          otp: accountOtp.trim(),
        });

        setAccountOtpExpiresAt(null);
        setAccountOtp("");
        setAccountMode("login");

        setAccountMessage(
          data.message ||
            (lang === "bn"
              ? "à¦‡à¦®à§‡à¦‡à¦² à¦¯à¦¾à¦šà¦¾à¦‡ à¦¸à¦®à§à¦ªà¦¨à§à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ à¦à¦–à¦¨ à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨à¥¤"
              : "Email verified. You can now log in.")
        );
      } else if (accountMode === "verify-login") {
        const data = await apiRequest("/verify-login", {
          email,
          otp: accountOtp.trim(),
          rememberMe: true,
        });

        if (!data.accessToken || !data.refreshToken || !data.user) {
          throw new Error(
            "Login response is missing access token, refresh token or user details."
          );
        }

        saveAuthSession(
          data.accessToken,
          data.user,
          true,
          data.refreshToken
        );

        setAccountUser(data.user);

        // Login done: close the modal and never open the dashboard.
        setAccountOtpExpiresAt(null);
        setAccountOtp("");
        setAccountMessage("");
        setAccountOpen(false);
        setAccountMode("login");

        // Everyone lands on the storefront home. Admin/moderator tools
        // (edit/add/delete) already show there based on role.
        setSelectedProduct(null);
        setShowCatalogPage(false);
        setShowWishlist(false);
        navigate("/", { replace: true });
        scrollTop();

        showNotice(
          data.message ||
            (lang === "bn" ? "à¦²à¦—à¦‡à¦¨ à¦¸à¦«à¦² à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤" : "Login successful.")
        );
      }
    } catch (error) {
      setAccountMessage(error.message);
    } finally {
      setAccountLoading(false);
    }
  };

  // FORGOT PASSWORD
  const requestPasswordReset = async (event) => {
    event.preventDefault();

    setAccountMessage("");
    setAccountLoading(true);

    try {
      const data = await apiRequest("/forgot-password", {
        email: accountEmail.trim().toLowerCase(),
      });

      setAccountOtpExpiresAt(data.otpExpiresAt || null);
      setAccountOtp("");
      setAccountNewPassword("");
      setAccountMode("reset-password");

      setAccountMessage(
        data.message ||
          (lang === "bn"
            ? "à¦¯à§‹à¦—à§à¦¯ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¥à¦¾à¦•à¦²à§‡ à¦‡à¦®à§‡à¦‡à¦²à§‡ OTP à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¬à§‡à¥¤"
            : "If an eligible account exists, a reset code will be sent.")
      );
    } catch (error) {
      setAccountMessage(error.message);
    } finally {
      setAccountLoading(false);
    }
  };

  // RESEND OTP
  const resendAccountOtp = async () => {
    const endpoints = {
      "verify-registration": "/resend-registration-otp",
      "verify-login": "/resend-login-otp",
      "reset-password": "/resend-password-reset-otp",
    };

    const endpoint = endpoints[accountMode];

    if (!endpoint) return false;

    setAccountMessage("");
    setAccountLoading(true);

    try {
      const data = await apiRequest(endpoint, {
        email: accountEmail.trim().toLowerCase(),
      });

      setAccountOtpExpiresAt(data.otpExpiresAt || null);

      setAccountMessage(
        data.message ||
          (lang === "bn"
            ? "à¦¯à§‹à¦—à§à¦¯ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¥à¦¾à¦•à¦²à§‡ à¦¨à¦¤à§à¦¨ OTP à¦ªà¦¾à¦ à¦¾à¦¨à§‹ à¦¹à¦¬à§‡à¥¤"
            : "If eligible, a new OTP will be sent.")
      );

      return true;
    } catch (error) {
      setAccountMessage(error.message);
      return false;
    } finally {
      setAccountLoading(false);
    }
  };

  // RESET PASSWORD
  const resetAccountPassword = async (event) => {
    event.preventDefault();

    setAccountMessage("");

    if (accountNewPassword.length < 8 || accountNewPassword.length > 72) {
      setAccountMessage(
        lang === "bn"
          ? "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à§® à¦¥à§‡à¦•à§‡ à§­à§¨ à¦…à¦•à§à¦·à¦°à§‡à¦° à¦®à¦§à§à¦¯à§‡ à¦¹à¦¤à§‡ à¦¹à¦¬à§‡à¥¤"
          : "Password must be between 8 and 72 characters."
      );
      return;
    }

    setAccountLoading(true);

    try {
      const data = await apiRequest("/reset-password", {
        email: accountEmail.trim().toLowerCase(),
        otp: accountOtp.trim(),
        newPassword: accountNewPassword,
      });

      setAccountOtp("");
      setAccountNewPassword("");
      setAccountPassword("");
      setAccountMode("login");

      setAccountMessage(
        data.message ||
          (lang === "bn"
            ? "à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤ à¦à¦–à¦¨ à¦²à¦—à¦‡à¦¨ à¦•à¦°à§à¦¨à¥¤"
            : "Password reset successful. Please log in.")
      );
    } catch (error) {
      setAccountMessage(error.message);
    } finally {
      setAccountLoading(false);
    }
  };


  // LOGOUT
  const logoutAccount = () => {
    // Stop the previous account's data from being saved again.
    cartStorageAccountRef.current = "";
    skipNextCartSaveRef.current = true;

    clearAuthSession();

    // Hide the previous user's private storefront state.
    setCartItems([]);
    setFavoriteIds([]);
    setAccountUser(null);

    setCartOpen(false);
    setCheckoutOpen(false);
    setShowWishlist(false);

    setAccountOpen(false);
    setAccountMode("login");
    setAccountPassword("");
    setAccountOtp("");
    setAccountNewPassword("");
    setAccountMessage("");

    setMyOrders([]);
    setOrdersError("");
    setRememberMe(false);

    navigate("/", { replace: true });
  };

  // ROUTE PATH: keep existing storefront components intact.
  const routePath = location.pathname.replace(/\/+$/, "") || "/";
  const isKnownStoreRoute =
    [
      "/",
      "/index.html",
      "/products",
      "/shop",
      "/custom",
      "/wishlist",
      "/login",
      "/register",
      "/account",
      "/account/orders",
      "/contact",
      "/apply-moderator",
    ].includes(routePath) || /^\/products\/[^/]+$/.test(routePath);

  if (routePath === "/admin" || routePath.startsWith("/admin/")) {
    if (routePath !== "/admin") return <NotFoundPage />;

    return (
      <Suspense fallback={<div className="pb-route-loading" role="status">Loading dashboardâ€¦</div>}>
        <>
          <RoleGuard allowedRoles={["admin"]}>
            <AdminDashboard
              lang={lang}
              setLang={setLang}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          </RoleGuard>

          <FloatingContactWidget
            onOpenAI={() => setIsAIChatOpen(true)}
          />

          <AIChat
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
            products={products}
            lang={lang}
            onDetails={openProduct}
            onAdd={addToCart}
          />
        </>
      </Suspense>
    );
  }

  if (routePath === "/moderator" || routePath.startsWith("/moderator/")) {
    if (routePath !== "/moderator") return <NotFoundPage />;

    return (
      <Suspense fallback={<div className="pb-route-loading" role="status">Loading dashboardâ€¦</div>}>
        <>
          <RoleGuard allowedRoles={["moderator"]}>
            <ModeratorDashboard
              lang={lang}
              setLang={setLang}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          </RoleGuard>

          <FloatingContactWidget
            onOpenAI={() => setIsAIChatOpen(true)}
          />

          <AIChat
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
            products={products}
            lang={lang}
            onDetails={openProduct}
            onAdd={addToCart}
          />
        </>
      </Suspense>
    );
  }

  if (!isKnownStoreRoute) {
    return <NotFoundPage />;
  }

  return (
    <div className="app-shell">
      {productsError && (
        <div role="alert" className="toast-notice">
          {lang === "bn"
            ? "à¦ªà§à¦°à§‹à¦¡à¦¾à¦•à§à¦Ÿ à¦²à§‹à¦¡ à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿à¥¤ Backend à¦šà¦¾à¦²à§ à¦†à¦›à§‡ à¦•à¦¿ à¦¨à¦¾ à¦¦à§‡à¦–à§à¦¨à¥¤"
            : "Could not load products. Check whether the backend is running."}{" "}
          <button type="button" onClick={() => window.location.reload()}>
            {lang === "bn" ? "à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨" : "Retry"}
          </button>
        </div>
      )}

      {!productsLoaded && !productsError && (
        <div className="toast-notice" role="status">
          {lang === "bn" ? "à¦ªà§à¦°à§‹à¦¡à¦¾à¦•à§à¦Ÿ à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡..." : "Loading products..."}
        </div>
      )}

      {productsLoaded && productsRefreshing && (
        <div className="toast-notice" role="status">
          {lang === "bn" ? "à¦ªà§à¦°à§‹à¦¡à¦¾à¦•à§à¦Ÿ à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡..." : "Loading products..."}
        </div>
      )}

      {notice && (
        <div className="toast-notice" role="status">
          {notice}
        </div>
      )}


      {(lang === "bn"
        ? storefrontSettings?.announcementBn
        : storefrontSettings?.announcement) && (
        <div className="announcement">
          <Zap className="announcement-zap" />
          <span>
            {lang === "bn"
              ? storefrontSettings.announcementBn
              : storefrontSettings.announcement}
          </span>
        </div>
      )}

      {(lang === "bn"
        ? storefrontSettings?.announcement1Bn
        : storefrontSettings?.announcement1) && (
        <div className="announcement1">
          <span>
            {lang === "bn"
              ? storefrontSettings.announcement1Bn
              : storefrontSettings.announcement1}
          </span>
        </div>
      )}
      <Navbar
        lang={lang}
        t={t}
        cartCount={cartCount}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        setShowCatalogPage={navigateToCatalog}
        setSelectedProduct={setSelectedProduct}
        goSection={goSection}
        setCartOpen={setCartOpen}
        openAccount={openAccount}
        setLang={setLang}
        user={accountUser}
        storefrontSettings={storefrontSettings}
      />


      {!["/contact", "/apply-moderator"].includes(routePath) && (
        <StoreSearch
          lang={lang}
          t={t}
          products={products}
          category={category}
          setCategory={setCategory}
          categoryOpen={categoryOpen}
          setCategoryOpen={setCategoryOpen}
          categoryOptions={categoryOptions}
          categoryRef={categoryRef}
          searchBoxRef={searchBoxRef}
          imageSearchRef={imageSearchRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFocused={searchFocused}
          setSearchFocused={setSearchFocused}
          imageStatus={imageStatus}
          imageMatches={imageMatches}
          imagePreview={imagePreview}
          handleImageSearch={handleImageSearch}
          clearImageSearch={clearImageSearch}
          searchSuggestions={searchSuggestions}
          setSelectedProduct={setSelectedProduct}
          setShowCatalogPage={navigateToCatalog}
          openProduct={openProduct}
          chooseCategory={chooseCategory}
        />
      )}


      <main className={showCatalogPage ? "catalog-route-main" : ""}>
        <Suspense fallback={<div className="pb-route-loading" role="status">Loading pageâ€¦</div>}>
        {routePath === "/apply-moderator" ? (
          <ModeratorApplicationPage lang={lang} />
        ) : routePath === "/contact" ? (
          <ContactPage
            onBack={() => {
              navigate("/");
              setShowCatalogPage(false);
              setShowWishlist(false);
              setSelectedProduct(null);
            }}
          />
        ) : routePath === "/custom" ? (
          <CustomProjectPage lang={lang} />
        ) : selectedProduct ? (
          <ProductDetails
            key={selectedProduct.id}
            product={selectedProduct}
            products={products}
            user={accountUser}
            storefrontSettings={storefrontSettings}
            isAdmin={isAdminUser}
            isModerator={isModeratorUser}
            onSelect={openProduct}
            lang={lang}
            t={t}
            qty={cartItems
              .filter(
                (item) => String(item.id) === String(selectedProduct.id)
              )
              .reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
            onAdd={addToCart}
            onBack={handleProductBack}
          />
        ) : showWishlist ? (
          <WishlistPage
            products={products}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onAdd={addToCart}
            onDetails={openProduct}
            cartItems={cartItems}
            lang={lang}
            t={t}
            onBack={() => {
              setShowWishlist(false);
              setShowCatalogPage(false);
              navigate("/");
              scrollTop();
            }}
          />
        ) : showCatalogPage ? (
          <CatalogPage
            recentList={recentList}
            products={products}
            query={searchQuery}
            lang={lang}
            t={t}
            onAdd={addToCart}
            cartItems={cartItems}
            onDetails={openProduct}
            imageMatches={imageMatches}
            imageSearchActive={
              imageStatus === "done" && imageMatches.length > 0
            }
            onImportProducts={() => setProductBulkImportOpen(true)}
            onClearImageSearch={clearImageSearch}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onShowWishlist={openWishlist}
            isAdmin={isAdminUser}
            isModerator={isModeratorUser}
            user={accountUser}
            storefrontSettings={storefrontSettings}
            onEditProduct={(product) => openProductEditor(product)}

            onAddProduct={() => {
              setProductDraftToRestore(null);
              openProductEditor(null);
            }}

            onDeleteProduct={handleProductDeleted}
            onBackHome={(clear = false) => {
              if (clear) {
                setSearchQuery("");
                clearImageSearch();
              }

              setShowCatalogPage(false);
              setShowWishlist(false);
              navigate("/");

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            onProductImageSettled={handleProductImageSettled}
          />
        ) : (
          <HomePage
            lang={lang}
            t={t}
            activeSlide={activeSlide}
            prevSlide={prevSlide}
            slideDir={slideDir}
            goToSlide={goToSlide}
            slideText={slideText}
            products={products}
            category={category}
            setCategory={setCategory}
            categoryOptions={categoryOptions}
            visibleProducts={visibleProducts}
            cartItems={cartItems}
            addToCart={addToCart}
            openProduct={openProduct}
            setSearchQuery={setSearchQuery}
            setShowCatalogPage={navigateToCatalog}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            isAdmin={isAdminUser}
            isModerator={isModeratorUser}
            onEditProduct={(product) => openProductEditor(product)}
            onAddProduct={() => {
              setProductDraftToRestore(null);
              openProductEditor(null);
            }}
            onDeleteProduct={handleProductDeleted}
            onImportProducts={() => setProductBulkImportOpen(true)}
            onProductImageSettled={handleProductImageSettled}
          />
        )}
        </Suspense>
      </main>

      <Footer t={t} />

      <Suspense fallback={null}>
        {accountOpen && (
          <AccountModal
            lang={lang}
            accountMode={accountMode}
            setAccountMode={setAccountMode}
            accountUser={accountUser}
            accountName={accountName}
            setAccountName={setAccountName}
            accountEmail={accountEmail}
            setAccountEmail={setAccountEmail}
            accountPassword={accountPassword}
            setAccountPassword={setAccountPassword}
            accountOtp={accountOtp}
            setAccountOtp={setAccountOtp}
            otpExpiresAt={accountOtpExpiresAt}
            accountNewPassword={accountNewPassword}
            setAccountNewPassword={setAccountNewPassword}
            accountMessage={accountMessage}
            setAccountMessage={setAccountMessage}
            accountLoading={accountLoading}
            setAccountOpen={setAccountOpen}
            submitAccount={submitAccount}
            verifyAccountOtp={verifyAccountOtp}
            resendAccountOtp={resendAccountOtp}
            requestPasswordReset={requestPasswordReset}
            resetAccountPassword={resetAccountPassword}
            logoutAccount={logoutAccount}
            myOrders={myOrders}
            ordersLoading={ordersLoading}
            ordersError={ordersError}
            loadMyOrders={loadMyOrders}
            rememberMe={rememberMe}
            setRememberMe={setRememberMe}
          />
        )}

        {productBulkImportOpen && isAdminUser && (
          <ProductBulkImport
            onClose={() => setProductBulkImportOpen(false)}
            onImported={async () => {
              await handleProductSaved();
            }}
            onRestoreDraft={(draft) => {
              setProductBulkImportOpen(false);
              setProductDraftToRestore(draft);
              openProductEditor(null);
            }}
          />
        )}

        {productEditor !== undefined && isAdminUser && (
          <InlineProductEditor
            key={`product-editor-${productEditorKey}`}
            product={productEditor}
            onClose={handleCloseProductEditor}
            onSaved={handleProductSaved}
            initialDraft={productDraftToRestore}
            onDraftRestored={handleDraftRestored}
          />
        )}

        {cartOpen && (
          <CartPanel
            items={cartItems}
            lang={lang}
            t={t}
            onClose={() => setCartOpen(false)}
            onQuantity={changeQuantity}
            onRemove={removeItem}
            onCheckout={() => {
              setCartOpen(false);
              setCheckoutOpen(true);
            }}
          />
        )}

        {checkoutOpen && (
          <CheckoutPanel
            items={cartItems}
            lang={lang}
            t={t}
            onBack={() => {
              setCheckoutOpen(false);
              setCartOpen(true);
            }}
            onComplete={completeOrder}
          />
        )}


        {order && (
          <OrderSuccess
            order={order}
            lang={lang}
            t={t}
            onClose={closeOrder}
          />
        )}


      </Suspense>

      <BackToTop />

      {/* Floating AI robot + social contact buttons */}
      <FloatingContactWidget
        onOpenAI={() => setIsAIChatOpen(true)}
      />

      {/* AI Chat Panel */}
      <Suspense fallback={null}>
        <AIChat
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          products={products}
          lang={lang}
          onDetails={openProduct}
          onAdd={addToCart}
        />
      </Suspense>

    </div>
  );
}


