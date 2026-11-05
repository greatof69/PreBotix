import { ArrowRight } from "lucide-react";
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
}) {
  return <>
    <HeroSlider lang={lang} t={t} activeSlide={activeSlide} prevSlide={prevSlide} slideDir={slideDir} goToSlide={goToSlide} slideText={slideText} />
    <TrustStrip lang={lang} />
    <section className="section products-section" id="projects">
      <div className="section-heading">
        <div><span className="section-kicker">{t.catalog} · {products.length} {t.results}</span><h2>{t.productsTitle}</h2></div>
        {isAdmin && (
          <div className="pb-product-admin-actions">
            <button
              type="button"
              className="pb-storefront-add"
              onClick={onAddProduct}
            >
              ＋ Add Product
            </button>

            <button
              type="button"
              className="pb-storefront-import"
              onClick={onImportProducts}
            >
              ⇧ Import Products
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
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              t={t}
              onAdd={addToCart}
              onDetails={openProduct}
              qty={
                cartItems.find(
                  item => String(item.id) === String(product.id)
                )?.quantity || 0
              }
              isFavorite={favoriteIds.some(
                id => String(id) === String(product.id)
              )}
              onToggleFavorite={onToggleFavorite}
              isAdmin={isAdmin}
              isModerator={isModerator}
              user={null}
              onAddProduct={onAddProduct}
              onEditProduct={onEditProduct}
              onDeleteProduct={onDeleteProduct}
            />
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
