
import { ArrowLeft, Heart } from "lucide-react";
import ProductCard from "../components/ProductCard";

export default function WishlistPage({
  products = [],
  favoriteIds = [],
  onToggleFavorite,
  onAdd,
  onDetails,
  cartItems = [],
  lang = "en",
  t = {},
  onBack,
  isAdmin = false,
  isModerator = false,
}) {
  // Admin à¦“ Moderator Wishlist à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡ à¦¨à¦¾à¥¤
  const canUseWishlist = !isAdmin && !isModerator;

  if (!canUseWishlist) {
    return (
      <section className="catalog-page wishlist-page">
        <div className="wishlist-empty">
          <Heart size={48} />
          <h2>
            {lang === "bn"
              ? "à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à¦¾ à¦¯à¦¾à¦¬à§‡ à¦¨à¦¾"
              : "Wishlist unavailable"}
          </h2>
          <p>
            {lang === "bn"
              ? "à¦à¦‡ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿà§‡ à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦°à§‡à¦° à¦…à¦¨à§à¦®à¦¤à¦¿ à¦¨à§‡à¦‡à¥¤"
              : "Wishlist is not available for this account."}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={onBack}
          >
            {lang === "bn" ? "à¦ªà¦£à§à¦¯à§‡ à¦«à¦¿à¦°à§‡ à¦¯à¦¾à¦¨" : "Back to products"}
          </button>
        </div>
      </section>
    );
  }

  const favorites = products.filter((product) =>
    favoriteIds.some((id) =>
      String(id) === (product.source === "supply"
        ? `supply:${product.supplyProductId || product.id}`
        : String(product.id))
    )
  );

  const getQuantity = (product) =>
    cartItems.find((item) =>
      product.source === "supply"
        ? item.source === "supply" &&
          String(item.supplyProductId || item.id) === String(product.supplyProductId || product.id)
        : item.source !== "supply" &&
          String(item.id) === String(product.id)
    )?.quantity || 0;
  return (
    <section className="catalog-page wishlist-page">
      <div className="wishlist-header">
        <button
          type="button"
          className="catalog-back-home"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          {lang === "bn" ? "à¦«à¦¿à¦°à§‡ à¦¯à¦¾à¦¨" : "Back"}
        </button>

        <div className="wishlist-title-row">
          <div>
            <span className="section-kicker">PREBOTIX / WISHLIST</span>
            <h1>
              <Heart size={25} />
              {lang === "bn" ? "à¦†à¦®à¦¾à¦° à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ" : "My Wishlist"}
            </h1>
            <p>
              {lang === "bn"
                ? `à¦†à¦ªà¦¨à¦¾à¦° à¦ªà¦›à¦¨à§à¦¦à§‡à¦° à¦ªà¦£à§à¦¯ ${favorites.length}à¦Ÿà¦¿`
                : `${favorites.length} favorite product${favorites.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="wishlist-empty">
          <Heart size={48} />
          <h2>
            {lang === "bn"
              ? "à¦†à¦ªà¦¨à¦¾à¦° à¦‰à¦‡à¦¶à¦²à¦¿à¦¸à§à¦Ÿ à¦–à¦¾à¦²à¦¿"
              : "Your wishlist is empty"}
          </h2>
          <p>
            {lang === "bn"
              ? "à¦ªà¦›à¦¨à§à¦¦à§‡à¦° à¦ªà¦£à§à¦¯à§‡à¦° à¦¹à¦¾à¦°à§à¦Ÿ à¦†à¦‡à¦•à¦¨à§‡ à¦•à§à¦²à¦¿à¦• à¦•à¦°à§‡ à¦à¦–à¦¾à¦¨à§‡ à¦¸à¦‚à¦°à¦•à§à¦·à¦£ à¦•à¦°à§à¦¨à¥¤"
              : "Tap the heart on any product to save it here."}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={onBack}
          >
            {lang === "bn" ? "à¦ªà¦£à§à¦¯ à¦¦à§‡à¦–à§à¦¨" : "Explore products"}
          </button>
        </div>
      ) : (
        <div className="catalog-page-grid wishlist-grid">
          {favorites.map((product) => (
            <ProductCard
              key={`${product.source || "product"}:${product.id}`}
              product={product}
              lang={lang}
              t={t}
              onAdd={onAdd}
              onDetails={onDetails}
              qty={getQuantity(product)}
              isFavorite
              onToggleFavorite={onToggleFavorite}
              isAdmin={isAdmin}
              isModerator={isModerator}
            />
          ))}
        </div>
      )}
    </section>
  );
}

