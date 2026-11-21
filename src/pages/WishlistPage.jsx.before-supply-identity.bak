
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
  // Admin ও Moderator Wishlist ব্যবহার করতে পারবে না।
  const canUseWishlist = !isAdmin && !isModerator;

  if (!canUseWishlist) {
    return (
      <section className="catalog-page wishlist-page">
        <div className="wishlist-empty">
          <Heart size={48} />
          <h2>
            {lang === "bn"
              ? "উইশলিস্ট ব্যবহার করা যাবে না"
              : "Wishlist unavailable"}
          </h2>
          <p>
            {lang === "bn"
              ? "এই অ্যাকাউন্টে উইশলিস্ট ব্যবহারের অনুমতি নেই।"
              : "Wishlist is not available for this account."}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={onBack}
          >
            {lang === "bn" ? "পণ্যে ফিরে যান" : "Back to products"}
          </button>
        </div>
      </section>
    );
  }

  const favorites = products.filter((product) =>
    favoriteIds.some((id) => String(id) === String(product.id))
  );

  const getQuantity = (id) =>
    cartItems.find((item) => String(item.id) === String(id))
      ?.quantity || 0;

  return (
    <section className="catalog-page wishlist-page">
      <div className="wishlist-header">
        <button
          type="button"
          className="catalog-back-home"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          {lang === "bn" ? "ফিরে যান" : "Back"}
        </button>

        <div className="wishlist-title-row">
          <div>
            <span className="section-kicker">PREBOTIX / WISHLIST</span>
            <h1>
              <Heart size={25} />
              {lang === "bn" ? "আমার উইশলিস্ট" : "My Wishlist"}
            </h1>
            <p>
              {lang === "bn"
                ? `আপনার পছন্দের পণ্য ${favorites.length}টি`
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
              ? "আপনার উইশলিস্ট খালি"
              : "Your wishlist is empty"}
          </h2>
          <p>
            {lang === "bn"
              ? "পছন্দের পণ্যের হার্ট আইকনে ক্লিক করে এখানে সংরক্ষণ করুন।"
              : "Tap the heart on any product to save it here."}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={onBack}
          >
            {lang === "bn" ? "পণ্য দেখুন" : "Explore products"}
          </button>
        </div>
      ) : (
        <div className="catalog-page-grid wishlist-grid">
          {favorites.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              t={t}
              onAdd={onAdd}
              onDetails={onDetails}
              qty={getQuantity(product.id)}
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
