import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import "../pb-focus.css";
import { categoryLabel } from "../utils/productHelpers";
import ProductCard from "../components/ProductCard";
import HeroSlider from "../components/HeroSlider";
import TrustStrip from "../components/TrustStrip";
import CustomProjectSection from "../components/CustomProjectSection";
import HowItWorks from "../components/HowItWorks";

export default function HomePage({
  lang,
  t,
  activeSlide,
  prevSlide,
  slideDir,
  goToSlide,
  slideText,
  products,
  category,
  setCategory,
  categoryOptions,
  visibleProducts,
  cartItems,
  addToCart,
  openProduct,
  setSearchQuery,
  setShowCatalogPage,
  favoriteIds = [],
  onToggleFavorite,
  isAdmin = false,
  isModerator = false,
  onEditProduct,
  onAddProduct,
  onDeleteProduct,
  onImportProducts,
  onProductImageSettled,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [highlightedId, setHighlightedId] = useState(null);
  const focusId = location.state?.focusProductId;

  // Admin "View product" click korle ekhane ashe
  useEffect(() => {
    if (focusId == null) return;
    setSearchQuery("");
    setCategory("all");
    setHighlightedId(String(focusId));
    navigate(location.pathname, { replace: true, state: null });
  }, [focusId]);

  // Card render hole scroll korbe
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => {
      document
        .getElementById(`product-card-${highlightedId.startsWith("supply:") ? "supply-" : ""}${highlightedId.startsWith("supply:") ? highlightedId.slice(7) : highlightedId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightedId, visibleProducts.length]);

  return <>
    <HeroSlider lang={lang} t={t} activeSlide={activeSlide} prevSlide={prevSlide} slideDir={slideDir} goToSlide={goToSlide} slideText={slideText} />
    <TrustStrip lang={lang} />
    <section className="section products-section" id="projects">
      <div className="section-heading">
        <div><span className="section-kicker">{t.catalog} Â· {products.length} {t.results}</span><h2>{t.productsTitle}</h2></div>
        {isAdmin && (
          <div className="pb-product-admin-actions">
            <button
              type="button"
              className="pb-storefront-add"
              onClick={onAddProduct}
            >
              ï¼‹ Add Product
            </button>

            <button
              type="button"
              className="pb-storefront-import"
              onClick={onImportProducts}
            >
              â‡§ Import Products
            </button>
          </div>
        )}
        <button type="button" className="text-link" onClick={() => { setSearchQuery(""); setCategory("all"); setShowCatalogPage(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t.viewAll}<ArrowRight size={17} /></button>
      </div>
      <div className="catalog-toolbar">
        <div className="category-tabs" role="group" aria-label={t.catalog}>
          <button className={category === "all" ? "category-tab active" : "category-tab"} onClick={() => setCategory("all")}>{t.all}</button>
          {categoryOptions.map(option => <button key={option} className={category === option ? "category-tab active" : "category-tab"} onClick={() => setCategory(option)}>{categoryLabel(option, lang)}</button>)}
        </div>
        <span className="catalog-result-count">{visibleProducts.length} {t.results}</span>
      </div>
      <div className="product-grid" id="components">

        {visibleProducts.length ? (
          visibleProducts.map((product, index) => (
            <div
              key={`${product.source || "product"}:${product.id}`}
              id={`product-card-${product.source === "supply" ? "supply-" : ""}${product.id}`}
              onClickCapture={(e) => {
                if (highlightedId === String(product.id) || highlightedId === `supply:${product.supplyProductId || product.id}`) {
                  e.preventDefault();
                  e.stopPropagation(); // ProductCard er onClick/onDetails porjonto jabe na
                  setHighlightedId(null);
                }
              }}
              className={`pb-product-slot${(highlightedId === String(product.id) || highlightedId === `supply:${product.supplyProductId || product.id}`) ? " pb-product-slot--focus" : ""}`}
            >
            <ProductCard
              product={product}
              lang={lang}
              t={t}
              onAdd={addToCart}
              onDetails={openProduct}
              qty={
                cartItems.find(
                  item => product.source === "supply" ? item.source === "supply" && String(item.supplyProductId || item.id) === String(product.supplyProductId || product.id) : item.source !== "supply" && String(item._id || item.productRef || item.id) === String(product._id || product.id)
                )?.quantity || 0
              }
              isFavorite={favoriteIds.some(
                id => String(id) === (product.source === "supply" ? `supply:${product.supplyProductId || product.id}` : String(product._id || product.id))
              )}
              onToggleFavorite={onToggleFavorite}
              isAdmin={isAdmin}
              isModerator={isModerator}
              user={null}
              onAddProduct={onAddProduct}
              onEditProduct={onEditProduct}
              onDeleteProduct={onDeleteProduct}
              imagePriority={index < 2}
              onImageSettled={onProductImageSettled}
            />
            </div>
          ))
        ) : (
          <p className="empty-results">{t.emptySearch}</p>
        )}

      </div>
    </section>
    <CustomProjectSection lang={lang} t={t} />
    <HowItWorks t={t} />
  </>;
}

