// Adds "pb-scrolled" to <html> after the user scrolls down (used by the floating AI button on mobile)
const THRESHOLD = 200;
let ticking = false;

function update() {
  document.documentElement.classList.toggle("pb-scrolled", window.scrollY > THRESHOLD);
  ticking = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  },
  { passive: true }
);

update();