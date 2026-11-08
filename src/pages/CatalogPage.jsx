
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

  // Props অথবা user object—যেখান থেকেই role আসুক, যাচাই করুন।
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
          {isBangla ? "হোমে ফিরুন" : "Back to home"}
        </button>

        <span>PREBOTIX / {isBangla ? "শপ" : "SHOP"}</span>

        {adminView && (
          <button
            type="button"
            className="pb-storefront-add"
            onClick={onAddProduct}
          >
            ＋ {isBangla ? "পণ্য যোগ করুন" : "Add Product"}
          </button>
        )}
      </div>

      <div className="catalog-page-layout">
        <aside className="catalog-sidebar">
          <div className="catalog-filter-card">
            <div className="catalog-sidebar-heading">
              <h2>{isBangla ? "পণ্য ফিল্টার" : "Filter Products"}</h2>

              <button type="button" onClick={handleResetFilters}>
                {isBangla ? "রিসেট" : "Reset"}
              </button>
            </div>

            <label className="catalog-filter-label">
              {isBangla ? "ক্যাটাগরি" : "Category"}
            </label>

            <div className="catalog-category-options">
              <button
                type="button"
                className={activeCategory === "all" ? "active" : ""}
                onClick={() => setActiveCategory("all")}
              >
                <span>{isBangla ? "সব পণ্য" : "All products"}</span>
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
              {isBangla ? "সর্বোচ্চ মূল্য" : "Maximum price"}
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
              <span>৳100</span>
              <span>৳10,00,000</span>
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
                  ? "শুধু স্টকে থাকা পণ্য"
                  : "In-stock products only"}
              </span>
            </label>

            <button
              type="button"
              className="button button-primary catalog-apply-filter"
              onClick={handleApplyFilters}
            >
              {isBangla ? "ফিল্টার প্রয়োগ করুন" : "Apply filters"}
            </button>
          </div>

          <div className="catalog-mini-card">
            <h3>
              {recentList.length
                ? isBangla
                  ? "সম্প্রতি দেখা"
                  : "Recently viewed"
                : isBangla
                  ? "বিশেষ পণ্য"
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
            <h3>{isBangla ? "জনপ্রিয় পণ্য" : "Popular products"}</h3>

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
                {t?.catalog ?? (isBangla ? "ক্যাটালগ" : "Catalog")}
                {" · "}
                {filteredProducts.length}{" "}
                {t?.results ?? (isBangla ? "টি ফলাফল" : "results")}
              </span>

              <h1>
                {normalizedQuery ? (
                  <>
                    {isBangla ? "সার্চের ফলাফল" : "Search results"}:{" "}
                    <bdi dir="ltr" style={{ unicodeBidi: "isolate" }}>
                      {`“${String(query).trim()}”`}
                    </bdi>
                  </>
                ) : (
                  isBangla ? "সব পণ্য" : "All Products"
                )}
              </h1>

              <p>
                {isBangla
                  ? "আপনার পরবর্তী প্রজেক্টের জন্য সঠিক কম্পোনেন্ট ও কিট খুঁজে নিন।"
                  : "Find the right components and kits for your next build."}
              </p>
            </div>

            <div className="catalog-heading-actions">
              {/* Wishlist কেবল Customer-এর জন্য */}
              {canUseWishlist && (
                <button
                  type="button"
                  className="wishlist-open-button"
                  onClick={onShowWishlist}
                >
                  <Heart size={17} />
                  {isBangla ? "উইশলিস্ট" : "Wishlist"}
                  <span className="ml-1">{favoriteIds.length}</span>
                </button>
              )}

              <label className="catalog-sort-label">
                {isBangla ? "সাজান" : "Sort by"}

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="featured">
                    {isBangla ? "বিশেষ" : "Featured"}
                  </option>

                  <option value="price-low">
                    {isBangla ? "দাম: কম থেকে বেশি" : "Price: low to high"}
                  </option>

                  <option value="price-high">
                    {isBangla ? "দাম: বেশি থেকে কম" : "Price: high to low"}
                  </option>

                  <option value="name">
                    {isBangla ? "নাম অনুযায়ী" : "Name"}
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div className="catalog-page-meta">
            <span>
              {isBangla ? "দেখানো হচ্ছে" : "Showing"} {startItem}–{endItem} /{" "}
              {filteredProducts.length}{" "}
              {t?.results ?? (isBangla ? "টি ফলাফল" : "results")}
            </span>

            {normalizedQuery && (
              <button type="button" onClick={handleClearSearch}>
                {isBangla ? "সার্চ মুছুন" : "Clear search"}
                <X size={13} />
              </button>
            )}

            {imageSearchActive && (
              <button type="button" onClick={handleClearImageSearch}>
                {isBangla ? "ছবির সার্চ মুছুন" : "Clear image search"}
                <X size={13} />
              </button>
            )}
          </div>

          <div className="catalog-page-grid">
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
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
                />
              ))
            ) : (
              <div className="catalog-no-results">
                <Search size={28} />

                <h2>
                  {t?.emptySearch ??
                    (isBangla
                      ? "কোনো পণ্য পাওয়া যায়নি"
                      : "No products found")}
                </h2>

                <p>
                  {isBangla
                    ? "অন্য শব্দ দিয়ে খুঁজুন অথবা ফিল্টার পরিবর্তন করুন।"
                    : "Try another search term or adjust your filters."}
                </p>
              </div>
            )}
          </div>

          {filteredProducts.length > PRODUCTS_PER_PAGE && (
            <nav
              className="catalog-pagination"
              aria-label={isBangla ? "পণ্যের পৃষ্ঠা" : "Product pagination"}
            >
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => handlePageChange(safeCurrentPage - 1)}
              >
                {isBangla ? "আগের" : "Previous"}
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
                {isBangla ? "পরের" : "Next"}
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
