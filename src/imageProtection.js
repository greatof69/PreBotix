const PROTECTED_IMAGE_SELECTOR = `
  img:not([data-allow-image-copy]),
  picture img:not([data-allow-image-copy])
`;

function getEventElement(event) {
  const target = event.target;
  return target instanceof Element ? target : target?.parentElement;
}

document.addEventListener("contextmenu", (event) => {
  if (getEventElement(event)?.closest(PROTECTED_IMAGE_SELECTOR)) {
    event.preventDefault();
  }
});

document.addEventListener("dragstart", (event) => {
  if (getEventElement(event)?.closest(PROTECTED_IMAGE_SELECTOR)) {
    event.preventDefault();
  }
});

document.addEventListener("copy", (event) => {
  const selection = window.getSelection();

  if (selection && selection.toString()) {
    const node = selection.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;

    if (element?.closest(PROTECTED_IMAGE_SELECTOR)) {
      event.preventDefault();
    }
  }
});

document.addEventListener("selectstart", (event) => {
  if (getEventElement(event)?.closest(PROTECTED_IMAGE_SELECTOR)) {
    event.preventDefault();
  }
});
