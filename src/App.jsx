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
import { getTitle, productMatchesQuery } from "./utils/productHelpers";

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
const HomePage = lazy(() => import("./pages/HomePage"));
import NotFoundPage from "./pages/NotFoundPage";
import RoleGuard from "./components/RoleGuard";
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard"));
const ModeratorDashboard = lazy(() => import("./components/moderator/ModeratorDashboard"));
const InlineProductEditor = lazy(() => import("./components/InlineProductEditor"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
import BackToTop from "./components/BackToTop";
const CustomProjectPage = lazy(() => import("./pages/CustomProjectPage"));
import FloatingContactWidget from "./components/FloatingContactWidget";
const AIChat = lazy(() => import("./components/AI-chat"));
import {
  authFetch,
  getRefreshToken,
  getAccessToken,
  getAuthUser,
  saveAuthSession,
  clearAuthSession,
} from "./utils/authSession";
const ProductBulkImport = lazy(() => import("./components/ProductBulkImport"));

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

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

  // PRODUCTS FROM MONGODB API
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productEditor, setProductEditor] = useState(undefined);
  const [productBulkImportOpen, setProductBulkImportOpen] =
    useState(false);
  const [storefrontSettings, setStorefrontSettings] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/storefront-settings`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.settings) setStorefrontSettings(data.settings);
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
        setProductsError(error.message);
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

      if (!getAccessToken()) {
        showNotice("Admin login required to delete products.", 3500);
        return;
      }

      try {
        const response = await authFetch(
          `${API_BASE_URL}/api/admin/products/${Number(productId)}`,
          { method: "DELETE" }
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
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [myOrders, setMyOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

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
  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesSearch = productMatchesQuery(product, searchQuery);

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

        return matchesSearch && matchesCategory;
      }),
    [products, searchQuery, category]
  );

  const searchSuggestions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) return [];

    return products
      .filter((product) => productMatchesQuery(product, query))
      .slice(0, 6);
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
          ? "এই অ্যাকাউন্টে উইশলিস্ট ব্যবহার করা যাবে না।"
          : "Wishlist is not available for this account."
      );
      return;
    }

    const token = getAccessToken();

    if (!accountUser || !token) {
      showNotice(
        lang === "bn" ? "আগে লগইন করুন!" : "Please login first!"
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
          ? "এই অ্যাকাউন্টে উইশলিস্ট ব্যবহার করা যাবে না।"
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
          ? "এই অ্যাকাউন্টে কার্ট ব্যবহার করা যাবে না।"
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
          ? "কার্টে যোগ করার আগে একটি সঠিক Price Option নির্বাচন করুন।"
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
          ? "পণ্যের দাম সঠিক নয়।"
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
        ? `${name} — ${lang === "bn"
          ? `মাত্র ${addQty}টি যোগ করা হয়েছে; সর্বোচ্চ স্টকের সীমায় পৌঁছেছে।`
          : `only ${addQty} added; maximum stock reached.`
        }`
        : `${name} — ${t.added}`
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
          ? "অর্ডার করতে প্রথমে লগইন করুন।"
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
            ? `অর্ডার করা যায়নি। Error: ${response.status}`
            : `Could not place order. Error: ${response.status}`)
      );
    }

    const savedOrder = result.order;

    if (!savedOrder?.orderNumber || !Array.isArray(savedOrder.items)) {
      throw new Error(
        lang === "bn"
          ? "সার্ভার থেকে অর্ডারটি সঠিকভাবে নিশ্চিত করা যায়নি।"
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
  const loadMyOrders = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setMyOrders([]);
      setOrdersError(
        lang === "bn" ? "আবার লগইন করুন।" : "Please log in again."
      );
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    setOrdersError("");

    try {
      const response = await authFetch(`${API_BASE_URL}/api/orders/my`);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {

        throw new Error(
          data.message ||
            (lang === "bn"
              ? "অর্ডার লোড করা যায়নি।"
              : "Could not load your orders.")
        );
      }

      setMyOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      console.error("Loading orders failed:", error);
      setOrdersError(error.message || "Could not load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, [lang]);

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
          ? "সব প্রয়োজনীয় তথ্য পূরণ করুন।"
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
        setAccountPassword("");
        setAccountOtp("");
        setAccountMode("verify-registration");

        setAccountMessage(
          data.message ||
            (lang === "bn"
              ? "ইমেইলে পাঠানো OTP দিয়ে যাচাই করুন।"
              : "Check your email for the verification code.")
        );
      } else if (accountMode === "login") {
        const data = await apiRequest("/login", {
          email,
          password: accountPassword,
        });

        setAccountEmail(email);
        setAccountPassword("");
        setAccountOtp("");
        setAccountMode("verify-login");

        setAccountMessage(
          data.message ||
            (lang === "bn"
              ? "ইমেইলে পাঠানো OTP দিয়ে লগইন সম্পন্ন করুন।"
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

        setAccountOtp("");
        setAccountMode("login");

        setAccountMessage(
          data.message ||
            (lang === "bn"
              ? "ইমেইল যাচাই সম্পন্ন হয়েছে। এখন লগইন করুন।"
              : "Email verified. You can now log in.")
        );
      } else if (accountMode === "verify-login") {
        const data = await apiRequest("/verify-login", {
          email,
          otp: accountOtp.trim(),
          rememberMe,
        });

        if (!data.accessToken || !data.user) {
          throw new Error(
            "The login response is missing the access token or user details."
          );
        }

        saveAuthSession(
          data.accessToken,
          data.user,
          rememberMe,
          data.refreshToken
        );

        setAccountUser(data.user);

        // Login done: close the modal and never open the dashboard.
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
            (lang === "bn" ? "লগইন সফল হয়েছে।" : "Login successful.")
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

      setAccountOtp("");
      setAccountNewPassword("");
      setAccountMode("reset-password");

      setAccountMessage(
        data.message ||
          (lang === "bn"
            ? "যোগ্য অ্যাকাউন্ট থাকলে ইমেইলে OTP পাঠানো হবে।"
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

      setAccountMessage(
        data.message ||
          (lang === "bn"
            ? "যোগ্য অ্যাকাউন্ট থাকলে নতুন OTP পাঠানো হবে।"
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
          ? "পাসওয়ার্ড ৮ থেকে ৭২ অক্ষরের মধ্যে হতে হবে।"
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
            ? "পাসওয়ার্ড পরিবর্তন হয়েছে। এখন লগইন করুন।"
            : "Password reset successful. Please log in.")
      );
    } catch (error) {
      setAccountMessage(error.message);
    } finally {
      setAccountLoading(false);
    }
  };


 // LOGOUT
const logoutAccount = async () => {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.warn("Backend logout request failed:", error);
    }
  }

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
  
  // ROUTE PATH
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
    ].includes(routePath) ||
    /^\/products\/[^/]+$/.test(routePath);

  // ADMIN ROUTE
  if (routePath === "/admin") {
    return (
      <Suspense fallback={<div className="pb-route-loading">Loading dashboard…</div>}>
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

  // MODERATOR ROUTE
  if (routePath === "/moderator") {
    return (
      <Suspense fallback={<div className="pb-route-loading">Loading dashboard…</div>}>
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

  // UNKNOWN ROUTE
  if (!isKnownStoreRoute) {
    return <NotFoundPage />;
  }

  return (
    <div className="app-shell">
      {productsError && (
        <div role="alert" className="toast-notice">
          {lang === "bn"
            ? "প্রোডাক্ট লোড করা যায়নি। Backend চালু আছে কি না দেখুন।"
            : "Could not load products. Check whether the backend is running."}{" "}
          <button type="button" onClick={() => window.location.reload()}>
            {lang === "bn" ? "আবার চেষ্টা করুন" : "Retry"}
          </button>
        </div>
      )}

      {!productsLoaded && !productsError && (
        <div className="toast-notice" role="status">
          {lang === "bn" ? "প্রোডাক্ট লোড হচ্ছে..." : "Loading products..."}
        </div>
      )}

      {notice && (
        <div className="toast-notice" role="status">
          {notice}
        </div>
      )}


      <div className="announcement">
        <Zap className="announcement-zap" />
        <span>
          {lang === "bn"
            ? storefrontSettings?.announcementBn ||
            "আপনারা যদি প্রজেক্ট অর্ডার দেন, তবে শুধু কম্পোনেন্টই (উপাদান) পাবেন না, বরং সম্পূর্ণ তৈরি (build in) অবস্থায় পাবেন। প্রজেক্ট তৈরি করার জন্য আমরা কোনো পারিশ্রমিক লাগবে না।"
            : storefrontSettings?.announcement ||
            "আপনারা যদি প্রজেক্ট অর্ডার দেন, তবে শুধু কম্পোনেন্টই (উপাদান) পাবেন না, বরং সম্পূর্ণ তৈরি (build in) অবস্থায় পাবেন। প্রজেক্ট তৈরি করার জন্য আমরা কোনো পারিশ্রমিক লাগবে না।"}
        </span>
      </div>

      <div className="announcement1">
        <span>
          {lang === "bn"
            ? storefrontSettings?.announcementBn ||
            "আপনারা চাইলে নিজেদের আইডিয়া শেয়ার করে প্রজেক্ট তৈরি (build-in) করতে পারবেন।"
            : storefrontSettings?.announcement ||
            "আপনারা চাইলে নিজেদের আইডিয়া শেয়ার করে প্রজেক্ট তৈরি (build-in) করতে পারবেন।"}
        </span>
      </div>


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


      {routePath !== "/contact" && (
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
        <Suspense fallback={<div className="pb-route-loading" role="status">Loading page…</div>}>
        {routePath === "/contact" ? (
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
            onEditProduct={(product) => setProductEditor(product)}
            onAddProduct={() => setProductEditor(null)}
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
            onEditProduct={(product) => setProductEditor(product)}
            onAddProduct={() => setProductEditor(null)}
            onDeleteProduct={handleProductDeleted}
            onImportProducts={() => setProductBulkImportOpen(true)}
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
        />
      )}

      {productEditor !== undefined && isAdminUser && (
        <InlineProductEditor
          product={productEditor || undefined}
          onClose={() => setProductEditor(undefined)}
          onSaved={handleProductSaved}
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
