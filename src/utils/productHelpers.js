import {
  productDescriptionBn,
  categoryNamesBn,
  tagNamesBn,
  productTypeNames,
} from "../data/products";

export const getTitle = (product, lang) =>
  lang === "bn" ? product.bn || product.title : product.title;

export const getDescription = (product, lang) =>
  lang === "bn"
    ? product.descriptionBn ||
      productDescriptionBn[product.id] ||
      product.description
    : product.description;

export const categoryLabel = (name, lang) =>
  lang === "bn" ? categoryNamesBn[name] || name : name;

export const tagLabel = (name, lang) =>
  lang === "bn" ? tagNamesBn[name] || name : name;

export const productType = (name, lang) =>
  (productTypeNames[lang] || productTypeNames.en)[name] || name;

const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^\p{L}\p{N}\s.+#_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinWithinOne = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
};

function getSearchFields(product) {
  const category = product?.category || "";
  const tag = product?.tag || "";
  return {
    title: normalizeSearchText(`${product?.title || ""} ${product?.bn || ""}`),
    category: normalizeSearchText(
      `${category} ${categoryNamesBn[category] || ""}`
    ),
    tags: normalizeSearchText(
      `${tag} ${tagNamesBn[tag] || ""} ${(product?.tags || []).join(" ")}`
    ),
    description: normalizeSearchText(
      `${product?.description || ""} ${product?.descriptionBn || ""} ${
        productDescriptionBn[product?.id] || ""
      } ${product?.details || ""} ${product?.detailsBn || ""}`
    ),
    options: normalizeSearchText(
      `${product?.priceOptionsTitle || ""} ${(product?.priceOptions || [])
        .map((option) => option.text)
        .join(" ")}`
    ),
  };
}

/**
 * Relevance score for a product. All query terms must match, but each term
 * may match a title, category, tag, description or option with typo tolerance.
 */
export const productSearchScore = (product, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const fields = getSearchFields(product);
  const allText = Object.values(fields).join(" ");

  if (allText.includes(normalizedQuery)) return 1000 + normalizedQuery.length;

  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const [field, value] of Object.entries(fields)) {
      if (!value) continue;
      const words = value.split(" ");
      if (value.includes(token)) {
        const weight =
          field === "title" ? 100 :
          field === "category" ? 65 :
          field === "tags" ? 55 :
          field === "options" ? 40 : 20;
        best = Math.max(best, weight + (value.startsWith(token) ? 15 : 0));
        continue;
      }
      if (token.length >= 4) {
        const fuzzy = words.some(
          (word) =>
            word.length >= 4 &&
            (word.startsWith(token.slice(0, 3)) ||
              token.startsWith(word.slice(0, 3))) &&
            levenshteinWithinOne(word, token)
        );
        if (fuzzy) best = Math.max(best, field === "title" ? 55 : 15);
      }
    }
    if (!best) return 0;
    score += best;
  }

  return score;
};

export const productMatchesQuery = (product, query) =>
  productSearchScore(product, query) > 0;
