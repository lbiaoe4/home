window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector("[data-carousel-track]");
    const btnPrev = carousel.querySelector("[data-carousel-prev]");
    const btnNext = carousel.querySelector("[data-carousel-next]");
    if (!track || !btnPrev || !btnNext) return;

    // evita init duplicado
    if (carousel.dataset.init === "1") return;
    carousel.dataset.init = "1";

    function getStep() {
      const first = track.children[0];
      if (!first) return 320;
      const gap = parseInt(getComputedStyle(track).gap || "0", 10) || 0;
      return first.getBoundingClientRect().width + gap;
    }

    btnNext.addEventListener("click", () => {
      track.scrollBy({ left: getStep(), behavior: "smooth" });
    });

    btnPrev.addEventListener("click", () => {
      track.scrollBy({ left: -getStep(), behavior: "smooth" });
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const logos = document.querySelectorAll(".sponsor-hero-logo");
  if (!logos.length) return;

  let current = 0;

  setInterval(() => {
    logos[current].classList.remove("active");
    current = (current + 1) % logos.length;
    logos[current].classList.add("active");
  }, 3500); // troca a cada 3.5s
});
