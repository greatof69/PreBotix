const PROTECTED_IMAGE_SELECTOR = `
  img:not([data-allow-image-copy]),
  picture img:not([data-allow-image-copy])
`;

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(PROTECTED_IMAGE_SELECTOR)) {
    event.preventDefault();
  }
});

document.addEventListener("dragstart", (event) => {
  if (event.target.closest(PROTECTED_IMAGE_SELECTOR)) {
    event.preventDefault();
  }
});

document.addEventListener("copy", (event) => {
  const selection = window.getSelection();

  if (selection && selection.toString()) {
    const node = selection.anchorNode;
    const element = node?.nodeType === 1
      ? node
      : node?.parentElement;

    if (element?.closest(PROTECTED_IMAGE_SELECTOR)) {
      event.preventDefault();
    }
  }
});

document.addEventListener("selectstart", (event) => {
  if (event.target.closest(PROTECTED_IMAGE_SELECTOR)) {
    event.preventDefault();
  }
});
