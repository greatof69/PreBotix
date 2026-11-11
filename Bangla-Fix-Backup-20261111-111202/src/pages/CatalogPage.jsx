
import { useEffect, useMemo, useState } from "react";
import { Search, X, ArrowLeft, Heart } from "lucide-react";

import ProductCard from "../components/ProductCard";
import {
  getTitle,
  productMatchesQuery,
  categoryLabel,
} from "../utils/productHelpers";
import { formatPrice } from "../utils/formatPrice";

const PRODUCTS_PER_PAGE = 30;
const DEFAULT_PRICE_LIMIT = 1000000;

export default function CatalogPage({
  recentList = [],
  products = [],
  query = "",
  lang = "en",
  t = {},
  onAdd,
  onDetails,
  cartItems = [],
  onBackHome,
  imageMatches = [],
  imageSearchActive = false,
  onClearImageSearch,
  favoriteIds = [],
  onToggleFavorite,
  onShowWishlist,
  isAdmin = false,
  isModerator = false,
  user,
  onEditProduct,
  onAddProduct,
  onDeleteProduct,
  onImportProducts,
  onProductImageSettled,
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceLimit, setPriceLimit] = useState(DEFAULT_PRICE_LIMIT);

  const [appliedCategory, setAppliedCategory] = useState("all");
  const [appliedInStockOnly, setAppliedInStockOnly] = useState(false);
  const [appliedPriceLimit, setAppliedPriceLimit] =
    useState(DEFAULT_PRICE_LIMIT);

  const [sortBy, setSortBy] = useState("featured");
  const [currentPage, setCurrentPage] = useState(1);

  const isBangla = lang === "bn";
  const normalizedQuery = String(query).trim().toLowerCase();

  // Props à¦…à¦¥à¦¬à¦¾ user objectâ€”à¦¯à§‡à¦–à¦¾à¦¨ à¦¥à§‡à¦•à§‡à¦‡ role à¦†à¦¸à§à¦•, à¦¯à¦¾à¦šà¦¾à¦‡ à¦•à¦°à§à¦¨à¥¤
  const role = String(user?.role || "").toLowerCase();

  const adminView =
    isAdmin || role === "admin" || user?.isAdmin === true;

  const moderatorView =
    isModerator || role === "moderator";

  const canUseWishlist = !adminView && !moderatorView;

  const imageMatchKey = imageMatches
    .map(({ product }) => product?.id)
    .filter((id) => id != null)
    .join(",");

  const categories = useMemo(
    () => [
      ...new Set(
        products
          .map((product) => product.category)
          .filter(Boolean)
      ),
    ],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const imageMatchIds = new Set(
      imageMatches
        .map(({ product }) => product?.id)
        .filter((id) => id != null)
        .map(String)
    );

    const list = products.filter((product) => {
      const matchesQuery = imageSearchActive
        ? imageMatchIds.has(String(product.id))
        : productMatchesQuery(product, normalizedQuery);

      const matchesCategory =
        appliedCategory === "all" ||
        product.category === appliedCategory;

      const matchesStock =
        !appliedInStockOnly || Number(product.stock) > 0;

      const matchesPrice =
        Number(product.price) <= appliedPriceLimit;

      return (
        matchesQuery &&
        matchesCategory &&
        matchesStock &&
        matchesPrice
      );
    });

    if (sortBy === "price-low") {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === "price-high") {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === "name") {
      list.sort((a, b) =>
        getTitle(a, lang).localeCompare(
          getTitle(b, lang),
          isBangla ? "bn" : "en"
        )
      );
    }

    return list;
  }, [
    products,
    normalizedQuery,
    appliedCategory,
    appliedInStockOnly,
    appliedPriceLimit,
    sortBy,
    lang,
    isBangla,
    imageMatches,
    imageSearchActive,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    normalizedQuery,
    imageSearchActive,
    imageMatchKey,
    appliedCategory,
    appliedInStockOnly,
    appliedPriceLimit,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE;

  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE
  );

  const startItem = filteredProducts.length ? startIndex + 1 : 0;

  const endItem = Math.min(
    startIndex + PRODUCTS_PER_PAGE,
    filteredProducts.length
  );

  const recentProducts = recentList.length
    ? recentList
    : products.slice(0, 4);

  const popularProducts = products
    .filter((product) =>
      ["BEST SELLER", "POPULAR", "MAKER PICK"].includes(
        String(product.tag || "").toUpperCase()
      )
    )
    .slice(0, 4);

  const handleApplyFilters = () => {
    setAppliedCategory(activeCategory);
    setAppliedInStockOnly(inStockOnly);
    setAppliedPriceLimit(priceLimit);
    setCurrentPage(1);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResetFilters = () => {
    setActiveCategory("all");
    setInStockOnly(false);
    setPriceLimit(DEFAULT_PRICE_LIMIT);

    setAppliedCategory("all");
    setAppliedInStockOnly(false);
    setAppliedPriceLimit(DEFAULT_PRICE_LIMIT);

    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClearSearch = () => {
    onBackHome?.(true);
    setCurrentPage(1);
  };

  const handleClearImageSearch = () => {
    onClearImageSearch?.();
    setCurrentPage(1);
  };

  const getImageSrc = (image) => {
    const value = String(image || "");

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (value.startsWith("/")) {
      return `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${value}`;
    }

    return `https://images.unsplash.com/${value}?auto=format&fit=crop&w=100&q=70`;
  };

  return (
    <section className="catalog-page">
      <div className="catalog-page-topline">
        <button
          type="button"
          className="catalog-back-home"
          onClick={() => onBackHome?.()}
        >
          <ArrowLeft size={15} />
          {isBangla ? "à¦¹à§‹à¦®à§‡ à¦«à¦¿à¦°à§à¦¨" : "Back to home"}
        </button>

        <span>PREBOTIX / {isBangla ? "à¦¶à¦ª" : "SHOP"}</span>

        {adminView && (
          <button
            type="button"
            className="pb-storefront-add"
            onClick={onAddProduct}
          >
            ï¼‹ {isBangla ? "à¦ªà¦£à§à¦¯ à¦¯à§‹à¦— à¦•à¦°à§à¦¨" : "Add Product"}
          </button>
        )}
      </div>

      <div className="catalog-page-layout">
        <aside className="catalog-sidebar">
          <div className="catalog-filter-card">
            <div className="catalog-sidebar-heading">
              <h2>{isBangla ? "à¦ªà¦£à§à¦¯ à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦°" : "Filter Products"}</h2>

              <button type="button" onClick={handleResetFilters}>
                {isBangla ? "à¦°à¦¿à¦¸à§‡à¦Ÿ" : "Reset"}
              </button>
            </div>

            <label className="catalog-filter-label">
              {isBangla ? "à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦—à¦°à¦¿" : "Category"}
            </label>

            <div className="catalog-category-options">
              <button
                type="button"
                className={activeCategory === "all" ? "active" : ""}
                onClick={() => setActiveCategory("all")}
              >
                <span>{isBangla ? "à¦¸à¦¬ à¦ªà¦£à§à¦¯" : "All products"}</span>
                <span>{products.length}</span>
              </button>

              {categories.map((categoryName) => (
                <button
                  type="button"
                  key={categoryName}
                  className={
                    activeCategory === categoryName ? "active" : ""
                  }
                  onClick={() => setActiveCategory(categoryName)}
                >
                  <span>{categoryLabel(categoryName, lang)}</span>

                  <span>
                    {
                      products.filter(
                        (product) => product.category === categoryName
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>

            <div className="catalog-filter-divider" />

            <label className="catalog-filter-label" htmlFor="catalog-price">
              {isBangla ? "à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š à¦®à§‚à¦²à§à¦¯" : "Maximum price"}
            </label>

            <div className="catalog-price-value">
              {formatPrice(priceLimit, lang)}
            </div>

            <input
              id="catalog-price"
              className="catalog-price-range"
              type="range"
              min="100"
              max={DEFAULT_PRICE_LIMIT}
              step="50"
              value={priceLimit}
              onChange={(event) =>
                setPriceLimit(Number(event.target.value))
              }
            />

            <div className="catalog-price-bounds">
              <span>à§³100</span>
              <span>à§³10,00,000</span>
            </div>

            <label className="catalog-stock-filter">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(event) =>
                  setInStockOnly(event.target.checked)
                }
              />

              <span>
                {isBangla
                  ? "à¦¶à§à¦§à§ à¦¸à§à¦Ÿà¦•à§‡ à¦¥à¦¾à¦•à¦¾ à¦ªà¦£à§à¦¯"
                  : "In-stock products only"}
              </span>
            </label>

            <button
              type="button"
              className="button button-primary catalog-apply-filter"
              onClick={handleApplyFilters}
            >
              {isBangla ? "à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦° à¦ªà§à¦°à¦¯à¦¼à§‹à¦— à¦•à¦°à§à¦¨" : "Apply filters"}
            </button>
          </div>

          <div className="catalog-mini-card">
            <h3>
              {recentList.length
                ? isBangla
                  ? "à¦¸à¦®à§à¦ªà§à¦°à¦¤à¦¿ à¦¦à§‡à¦–à¦¾"
                  : "Recently viewed"
                : isBangla
                  ? "à¦¬à¦¿à¦¶à§‡à¦· à¦ªà¦£à§à¦¯"
                  : "Featured products"}
            </h3>

            {recentProducts.map((product) => (
              <button
                type="button"
                className="catalog-mini-product"
                key={product.id}
                onClick={() => onDetails?.(product)}
              >
                <img
                  src={getImageSrc(product.image)}
                  alt={getTitle(product, lang)}
                  loading="lazy"
                />

                <span>
                  <strong>{getTitle(product, lang)}</strong>
                  <small>{formatPrice(product.price, lang)}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="catalog-mini-card catalog-popular-card">
            <h3>{isBangla ? "à¦œà¦¨à¦ªà§à¦°à¦¿à¦¯à¦¼ à¦ªà¦£à§à¦¯" : "Popular products"}</h3>

            {popularProducts.map((product) => (
              <button
                type="button"
                className="catalog-mini-product"
                key={product.id}
                onClick={() => onDetails?.(product)}
              >
                <img
                  src={getImageSrc(product.image)}
                  alt={getTitle(product, lang)}
                  loading="lazy"
                />

                <span>
                  <strong>{getTitle(product, lang)}</strong>
                  <small>{formatPrice(product.price, lang)}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="catalog-main">
          <div className="catalog-page-heading">
            <div>
              <span className="section-kicker">
                {t?.catalog ?? (isBangla ? "à¦•à§à¦¯à¦¾à¦Ÿà¦¾à¦²à¦—" : "Catalog")}
                {" Â· "}
                {filteredProducts.length}{" "}
                {t?.results ?? (isBangla ? "à¦Ÿà¦¿ à¦«à¦²à¦¾à¦«à¦²" : "results")}
              </span>

              <h1>
                {normalizedQuery ? (
                  <>
                    {isBangla ? "à¦¸à¦¾à¦°à§à¦šà§‡à¦° à¦«à¦²à¦¾à¦«à¦²" : "Search results"}:{" "}
                    <span dir="ltr" style={{ unicodeBidi: "isolate", direction: "ltr" }}>
                      {"\u201C"}
                      {String(query).trim()}
                      {"\u201D"}
                    </span>
                  </>
                ) : (
                  isBangla ? "à¦¸à¦¬ à¦ªà¦£à§à¦¯" : "All Products"
                )}
              </h1>

              <p>
                {isBangla
                  ? "à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦°à¦¬à¦°à§à¦¤à§€ à¦ªà§à¦°à¦œà§‡à¦•à§à¦Ÿà§‡à¦° à¦œà¦¨à§à¦¯ à¦¸à¦ à¦¿à¦• à¦•à¦®à§à¦ªà§‹à¦¨à§‡à¦¨à§à¦Ÿ à¦“ à¦•à¦¿à¦Ÿ à¦–à§à¦à¦œà§‡ à¦¨à¦¿à¦¨à¥¤"
                  : "Find the right components and kits for your next build."}
              </p>
            </div>

            <div className="catalog-heading-actions">
              {/* Wishlist à¦•à§‡à¦¬à¦² Customer-à¦à¦° à¦œà¦¨à§à¦¯ */}
              {canUseWishlist && (
                <button
                  type="button"
                  className="wishlist-open-button"
                  onClick={onShowWishlist}
                >
                  <Heart size={17} />
                  {isBangla ? "à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ" : "Wishlist"}
                  <span className="ml-1">{favoriteIds.length}</span>
                </button>
              )}

              <label className="catalog-sort-label">
                {isBangla ? "à¦¸à¦¾à¦œà¦¾à¦¨" : "Sort by"}

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="featured">
                    {isBangla ? "à¦¬à¦¿à¦¶à§‡à¦·" : "Featured"}
                  </option>

                  <option value="price-low">
                    {isBangla ? "à¦¦à¦¾à¦®: à¦•à¦® à¦¥à§‡à¦•à§‡ à¦¬à§‡à¦¶à¦¿" : "Price: low to high"}
                  </option>

                  <option value="price-high">
                    {isBangla ? "à¦¦à¦¾à¦®: à¦¬à§‡à¦¶à¦¿ à¦¥à§‡à¦•à§‡ à¦•à¦®" : "Price: high to low"}
                  </option>

                  <option value="name">
                    {isBangla ? "à¦¨à¦¾à¦® à¦…à¦¨à§à¦¯à¦¾à¦¯à¦¼à§€" : "Name"}
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div className="catalog-page-meta">
            <span>
              {isBangla ? "à¦¦à§‡à¦–à¦¾à¦¨à§‹ à¦¹à¦šà§à¦›à§‡" : "Showing"} {startItem}â€“{endItem} /{" "}
              {filteredProducts.length}{" "}
              {t?.results ?? (isBangla ? "à¦Ÿà¦¿ à¦«à¦²à¦¾à¦«à¦²" : "results")}
            </span>

            {normalizedQuery && (
              <button type="button" onClick={handleClearSearch}>
                {isBangla ? "à¦¸à¦¾à¦°à§à¦š à¦®à§à¦›à§à¦¨" : "Clear search"}
                <X size={13} />
              </button>
            )}

            {imageSearchActive && (
              <button type="button" onClick={handleClearImageSearch}>
                {isBangla ? "à¦›à¦¬à¦¿à¦° à¦¸à¦¾à¦°à§à¦š à¦®à§à¦›à§à¦¨" : "Clear image search"}
                <X size={13} />
              </button>
            )}
          </div>

          <div className="catalog-page-grid">
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  imagePriority={index < 2}
                  product={product}
                  lang={lang}
                  t={t}
                  onAdd={onAdd}
                  onDetails={onDetails}
                  onEditProduct={onEditProduct}
                  onDeleteProduct={onDeleteProduct}
                  qty={
                    cartItems.find(
                      (item) =>
                        String(item.id) === String(product.id)
                    )?.quantity || 0
                  }
                  isFavorite={favoriteIds.some(
                    (id) => String(id) === String(product.id)
                  )}
                  onToggleFavorite={onToggleFavorite}
                  isAdmin={adminView}
                  isModerator={moderatorView}
                  user={user}
                  onImageSettled={onProductImageSettled}
                />
              ))
            ) : (
              <div className="catalog-no-results">
                <Search size={28} />

                <h2>
                  {t?.emptySearch ??
                    (isBangla
                      ? "à¦•à§‹à¦¨à§‹ à¦ªà¦£à§à¦¯ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿"
                      : "No products found")}
                </h2>

                <p>
                  {isBangla
                    ? "à¦…à¦¨à§à¦¯ à¦¶à¦¬à§à¦¦ à¦¦à¦¿à¦¯à¦¼à§‡ à¦–à§à¦à¦œà§à¦¨ à¦…à¦¥à¦¬à¦¾ à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦° à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦•à¦°à§à¦¨à¥¤"
                    : "Try another search term or adjust your filters."}
                </p>
              </div>
            )}
          </div>

          {filteredProducts.length > PRODUCTS_PER_PAGE && (
            <nav
              className="catalog-pagination"
              aria-label={isBangla ? "à¦ªà¦£à§à¦¯à§‡à¦° à¦ªà§ƒà¦·à§à¦ à¦¾" : "Product pagination"}
            >
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => handlePageChange(safeCurrentPage - 1)}
              >
                {isBangla ? "à¦†à¦—à§‡à¦°" : "Previous"}
              </button>

              {Array.from(
                { length: totalPages },
                (_, index) => index + 1
              ).map((page) => (
                <button
                  type="button"
                  key={page}
                  className={safeCurrentPage === page ? "active" : ""}
                  aria-current={
                    safeCurrentPage === page ? "page" : undefined
                  }
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => handlePageChange(safeCurrentPage + 1)}
              >
                {isBangla ? "à¦ªà¦°à§‡à¦°" : "Next"}
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}


