import logo from "../assets/PreBotix.png";

import {
  ShoppingCart,
  UserRound,
  ChevronDown,
  Menu,
} from "lucide-react";

import { NavLink, useNavigate, useLocation } from "react-router-dom";


export default function Navbar({
  lang,
  t,
  cartCount,
  mobileOpen,
  setMobileOpen,
  setShowCatalogPage,
  setSelectedProduct,
  setCartOpen,
  openAccount,
  setLang,
  user,
  storefrontSettings,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role?.toLowerCase();

  const generalSettings = storefrontSettings?.general || {};
  const websiteName =
    generalSettings.websiteName?.trim() || "PreBotix";

  const customLogo = generalSettings.logo;

  const apiBaseUrl = (
    import.meta.env.VITE_API_URL || "http://localhost:5000"
  ).replace(/\/+$/, "");

  const logoSrc = customLogo
    ? /^https?:\/\//i.test(customLogo)
      ? customLogo
      : `${apiBaseUrl}${customLogo.startsWith("/") ? "" : "/"}${customLogo}`
    : logo;

  const isContactPage = location.pathname
    .replace(/\/+$/, "")
    .endsWith("/contact");

  const isPrivilegedUser =
    role === "admin" ||
    role === "moderator" ||
    user?.isAdmin === true;

  const handleHome = (e) => {
    e.preventDefault();

    setShowCatalogPage(false);
    setSelectedProduct(null);
    setMobileOpen(false);

    navigate("/");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleNavigation = (path) => {
    setMobileOpen(false);
    setSelectedProduct(null);

    if (path === "/projects") {
      setShowCatalogPage(false);
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <header
      className={`site-header ${
        isContactPage ? "contact-page-header" : ""
      }`}
    >
      <a
        className="brand"
        href="/"
        onClick={handleHome}
        aria-label={`${websiteName} home`}
      >
        <span className="brand-icon">
          <img
            className="logo"
            src={logoSrc}
            alt={websiteName}
          />
        </span>

        <span>
          <span className="brand-accent">{websiteName}</span>
          <small>{t.brandTag}</small>
        </span>
      </a>

      <nav
        id="main-navigation"
        className={`main-nav ${mobileOpen ? "open" : ""}`}
        aria-hidden={!mobileOpen}
      >
        <NavLink to="/" onClick={handleHome} end>
          {lang === "bn" ? "হোম" : "Home"}
        </NavLink>

        <NavLink
          to="/shop"
          onClick={() => handleNavigation("/shop")}
        >
          {t.navShop}
        </NavLink>

        <NavLink
          to="/custom"
          onClick={() => handleNavigation("/custom")}
        >
          {t.navCustom}
        </NavLink>

        <NavLink
          to="/contact"
          onClick={() => handleNavigation("/contact")}
        >
          {t.navContact || (lang === "bn" ? "যোগাযোগ" : "Contact")}
        </NavLink>

        {storefrontSettings?.moderatorApplicationsEnabled === true &&
          !isPrivilegedUser && (
            <NavLink
              to="/apply-moderator"
              onClick={() => handleNavigation("/apply-moderator")}
            >
              {lang === "bn" ? "মডারেটর আবেদন" : "Apply for Moderator"}
            </NavLink>
          )}
      </nav>

      <div className="header-actions">
        {!isPrivilegedUser && (
          <button
            type="button"
            className="icon-button cart-button"
            aria-label={`${t.cart}: ${cartCount}`}
            title={`${t.cart}: ${cartCount}`}
            onClick={() => {
              setMobileOpen(false);
              setCartOpen(true);
            }}
          >
            <ShoppingCart size={19} />
            <i>{cartCount}</i>
          </button>
        )}

        <button
          type="button"
          className="icon-button account-button"
          aria-label={
            lang === "bn" ? "আমার অ্যাকাউন্ট" : "My Account"
          }
          title={
            lang === "bn" ? "আমার অ্যাকাউন্ট" : "My Account"
          }
          onClick={() => {
            setMobileOpen(false);
            openAccount();
          }}
        >
          <UserRound size={19} />
        </button>

        <button
          type="button"
          className="language-button"
          onClick={() => setLang(lang === "en" ? "bn" : "en")}
          aria-label={
            lang === "en" ? "বাংলায় পরিবর্তন করুন" : "Switch to English"
          }
        >
          {lang === "en" ? "বাংলা" : "EN"}
          <ChevronDown size={14} />
        </button>

        <button
          type="button"
          className="menu-button"
          aria-label={t.toggleMenu}
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu />
        </button>
      </div>
    </header>
  );
}




