(() => {
  let tip = null;

  function hideTip() {
    if (tip) tip.remove();
    tip = null;
  }

  function showTip(group) {
  const scope = group.matches("strong")
    ? group.parentElement
    : group;

  const price = scope.querySelector("strong");
  const oldPrice = scope.querySelector(
    "del, .product-original-price"
  );

  if (!price) return;

  const getPriceDigits = (el) =>
    (el.textContent.match(/\d/g) || []).length;

  const priceDigits = getPriceDigits(price);
  const oldPriceDigits = oldPrice
    ? getPriceDigits(oldPrice)
    : 0;

  // ৪টির বেশি digit না হলে tooltip দেখাবে না
  const clipped =
    priceDigits > 4 || oldPriceDigits > 4;

  hideTip();

  if (!clipped) return;

  tip = document.createElement("div");
  tip.className = "price-float-tip";

  [price, oldPrice].filter(Boolean).forEach((el) => {
    const node = document.createElement(
      el.tagName.toLowerCase()
    );

    node.textContent = el.textContent;
    tip.appendChild(node);
  });

  document.body.appendChild(tip);

  const rect = group.getBoundingClientRect();
  const box = tip.getBoundingClientRect();

  tip.style.left =
    Math.max(
      8,
      Math.min(rect.left, window.innerWidth - box.width - 8)
    ) + "px";

  let top = rect.top - box.height - 8;

  if (top < 8) top = rect.bottom + 8;

  tip.style.top = top + "px";
}

  document.addEventListener("mouseover", (event) => {
    const group = event.target.closest(
      ".product-card .product-price-group, .product-card .product-bottom > :first-child"
    );

    if (group) showTip(group);
    else hideTip();
  });

  document.addEventListener("touchstart", (event) => {
    const group = event.target.closest(
      ".product-card .product-price-group, .product-card .product-bottom > :first-child"
    );

    if (group) showTip(group);
    else hideTip();
  }, { passive: true });

  document.addEventListener("scroll", hideTip, true);
})();
