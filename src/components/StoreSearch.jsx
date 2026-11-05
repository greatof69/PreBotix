import { ArrowRight, X } from "lucide-react";
import SearchBar from "./SearchBar";
import { categoryLabel, getTitle } from "../utils/productHelpers";
import { formatPrice } from "../utils/formatPrice";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function suggestionImage(product) {
  const raw = product?.image || product?.imageUrl || product?.images?.[0] || "";
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL.replace(/\/+$/, "")}${raw}`;
  if (/^(photo-|premium_photo-)/.test(raw)) {
    return `https://images.unsplash.com/${raw}?auto=format&fit=crop&w=120&q=75`;
  }
  return `${API_BASE_URL.replace(/\/+$/, "")}/${raw}`;
}

export default function StoreSearch(p) {
 const { lang,t,searchBoxRef,searchQuery,setSearchQuery,searchFocused,setSearchFocused,imageStatus,imageMatches,imagePreview,clearImageSearch,searchSuggestions,setSelectedProduct,setShowCatalogPage,openProduct,setCategory } = p;
 return <div className="store-search-wrap"><div className="store-search" role="search" ref={searchBoxRef}><SearchBar {...p}/>
  {searchFocused && imageStatus !== "idle" && <div className="search-suggestions" style={{position:"relative"}}>
   <div className="suggestions-heading"><span>{imagePreview && <img src={imagePreview} alt="" style={{width:28,height:28,objectFit:"cover",borderRadius:6,marginRight:8,verticalAlign:"middle"}}/>}{imageStatus === "done" ? t.imgMatches : t.imgSearching}</span><button type="button" className="clear-search-button" style={{position:"static"}} aria-label={t.imgClear} title={t.imgClear} onClick={clearImageSearch}><X size={16}/></button></div>
   {imageStatus === "error" && <p className="suggestion-empty">{t.imgError}</p>}
   {imageStatus === "done" && <>{imageMatches.length ? imageMatches.map(({product,score}) => <button type="button" className="suggestion-item" key={product.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{clearImageSearch();openProduct(product);}}><img src={suggestionImage(product)} alt={getTitle(product,lang)}/><span className="suggestion-copy"><strong>{getTitle(product,lang)}</strong><small>{categoryLabel(product.category,lang)} · {Math.round(score*100)}% {t.imgMatchLabel}</small></span><strong className="suggestion-price">{formatPrice(product.price,lang)}</strong></button>) : <p className="suggestion-empty">{t.imgNoMatch}</p>}<button type="button" className="suggestions-all" onMouseDown={e=>e.preventDefault()} onClick={()=>{setSearchQuery("");setCategory("all");setSelectedProduct(null);setShowCatalogPage(true);setSearchFocused(false);window.scrollTo({top:0,behavior:"smooth"});}}>{lang === "bn" ? "সব মিলে যাওয়া পণ্য দেখুন" : "All Matching Products"}<ArrowRight size={15}/></button></>}
  </div>}
  {searchFocused && imageStatus === "idle" && searchQuery.trim() && <div className="search-suggestions"><div className="suggestions-heading"><span>{lang === "bn" ? "মিলে যাওয়া পণ্য" : "Matching products"}</span><span>{searchSuggestions.length} {t.results}</span></div>{searchSuggestions.length ? searchSuggestions.map(product=><button type="button" className="suggestion-item" key={product.id} onMouseDown={e=>e.preventDefault()} onClick={()=>openProduct(product)}><img src={suggestionImage(product)} alt=""/><span className="suggestion-copy"><strong>{getTitle(product,lang)}</strong><small>{categoryLabel(product.category,lang)}</small></span><strong className="suggestion-price">{formatPrice(product.price,lang)}</strong></button>) : <p className="suggestion-empty">{t.emptySearch}</p>}<button className="suggestions-all" type="button" onClick={()=>{setSearchFocused(false);setSelectedProduct(null);setCategory("all");setShowCatalogPage(true);window.scrollTo({top:0,behavior:"smooth"});}}>{lang === "bn" ? "সব পণ্য দেখুন" : "All products"}<ArrowRight size={15}/></button></div>}
 </div></div>;
}