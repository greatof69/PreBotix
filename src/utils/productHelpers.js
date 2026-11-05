import { productDescriptionBn, categoryNamesBn, tagNamesBn, productTypeNames } from "../data/products";

export const getTitle = (product, lang) => (lang === "bn" ? product.bn : product.title);
export const getDescription = (product, lang) => (lang === "bn" ? (product.descriptionBn || productDescriptionBn[product.id] || product.description) : product.description);
export const categoryLabel = (name, lang) => (lang === "bn" ? (categoryNamesBn[name] || name) : name);
export const tagLabel = (name, lang) => (lang === "bn" ? (tagNamesBn[name] || name) : name);
export const productType = (name, lang) => (productTypeNames[lang] || productTypeNames.en)[name] || name;
// One shared search helper: matches English and Bangla title, category, description and tag.
export const productMatchesQuery = (product, query) => {
  const words = String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = `${product.title} ${product.bn} ${product.category} ${categoryNamesBn[product.category] || ""} ${product.description} ${productDescriptionBn[product.id] || ""} ${product.tag || ""} ${tagNamesBn[product.tag] || ""} ${(product.tags || []).join(" ")}`.toLowerCase();
  return words.every(word => text.includes(word));
};
