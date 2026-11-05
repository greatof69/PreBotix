import { ChevronDown, Search, Camera, X } from "lucide-react";
import { categoryLabel } from "../utils/productHelpers";
export default function SearchBar(p) {
 const { lang,t,products,category,setCategory,categoryOpen,setCategoryOpen,categoryOptions,categoryRef,imageSearchRef,searchQuery,setSearchQuery,setSearchFocused,imageStatus,clearImageSearch,handleImageSearch,setSelectedProduct,setShowCatalogPage } = p;
 const chooseCategory = p.chooseCategory;
 return <>
  <div className="category-select-wrap" ref={categoryRef}>
   <button type="button" className="category-select-button" aria-expanded={categoryOpen} onClick={() => setCategoryOpen(open => !open)}><span>{category === "all" ? (lang === "bn" ? "সব ক্যাটাগরি" : "All categories") : category === "projects" ? t.projects : category === "components" ? t.components : categoryLabel(category,lang)}</span><ChevronDown size={16}/></button>
   {categoryOpen && <div className="category-dropdown"><button type="button" className={category === "all" ? "selected" : ""} onClick={() => chooseCategory("all")}>{lang === "bn" ? "সব ক্যাটাগরি" : "All categories"}<span>{products.length}</span></button><button type="button" className={category === "projects" ? "selected" : ""} onClick={() => chooseCategory("projects")}>{t.projects}<span>{products.filter(p => p.category === "ROBOTICS KIT").length}</span></button><button type="button" className={category === "components" ? "selected" : ""} onClick={() => chooseCategory("components")}>{t.components}<span>{products.filter(p => p.category !== "ROBOTICS KIT").length}</span></button>{categoryOptions.map(option => <button type="button" key={option} className={category === option ? "selected" : ""} onClick={() => chooseCategory(option)}><span>{categoryLabel(option,lang)}</span><span>{products.filter(p => p.category === option).length}</span></button>)}</div>}
  </div>
  <form className="store-search-form" onSubmit={event => { event.preventDefault(); setSearchFocused(false); setSelectedProduct(null); setCategory("all"); setShowCatalogPage(true); window.scrollTo({top:0,behavior:"smooth"}); }}>
   <input className="store-search-input" placeholder={t.search} aria-label={t.searchLabel} value={searchQuery} onFocus={() => setSearchFocused(true)} onChange={event => {setSearchQuery(event.target.value); if(imageStatus !== "idle") clearImageSearch();}} onKeyDown={event => {if(event.key === "Escape") setSearchFocused(false);}} />
   {searchQuery && <button className="clear-search-button" type="button" aria-label={t.clearSearch} onClick={() => setSearchQuery("")}><X size={16}/></button>}
   <input ref={imageSearchRef} className="image-search-file" type="file" accept="image/*" onChange={handleImageSearch}/>
   <button type="button" className="image-search-button" title={lang === "bn" ? "ছবি দিয়ে খুঁজুন" : "Search by image"} aria-label={lang === "bn" ? "ছবি দিয়ে খুঁজুন" : "Search by image"} onClick={() => imageSearchRef.current?.click()}><Camera size={20}/></button>
   <button type="submit" className="store-search-submit"><Search size={17}/><span>{t.searchBtn}</span></button>
  </form>
 </>;
}
