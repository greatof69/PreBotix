export const formatPrice = (amount, lang) => `৳${Number(amount).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD")}`;
