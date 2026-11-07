(() => {
  let tip = null;

  function getEventElement(event) {
    const target = event.target;
    return target instanceof Element ? target : target?.parentElement;
  }

  function hideTip() {
    if (tip) tip.remove();
    tip = null;
  }

  function showTip(group) {
    const scope = group.matches("strong")
      ? group.parentElement
      : group;

    if (!scope) return;

    const price = scope.querySelector("strong");
    const oldPrice = scope.querySelector("del, .product-original-price");

    if (!price) return;

    const getPriceDigits = (el) =>
      (el.textContent.match(/\d/g) || []).length;

    const clipped =
      getPriceDigits(price) > 4 ||
      (oldPrice && getPriceDigits(oldPrice) > 4);

    hideTip();

    if (!clipped) return;

    tip = document.createElement("div");
    tip.className = "price-float-tip";

    [price, oldPrice].filter(Boolean).forEach((el) => {
      const node = document.createElement(el.tagName.toLowerCase());
      node.textContent = el.textContent;
      tip.appendChild(node);
    });

    document.body.appendChild(tip);

    const rect = group.getBoundingClientRect();
    const box = tip.getBoundingClientRect();

    tip.style.left =
      Math.max(8, Math.min(rect.left, window.innerWidth - box.width - 8)) + "px";

    let top = rect.top - box.height - 8;
    if (top < 8) top = rect.bottom + 8;

    tip.style.top = top + "px";
  }

  function handlePointer(event) {
    const target = getEventElement(event);

    const group = target?.closest(
      ".product-card .product-price-group, .product-card .product-bottom > :first-child"
    );

    if (group) showTip(group);
    else hideTip();
  }

  document.addEventListener("mouseover", handlePointer);
  document.addEventListener("touchstart", handlePointer, { passive: true });
  document.addEventListener("scroll", hideTip, true);
})();
