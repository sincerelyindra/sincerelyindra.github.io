(function () {
  "use strict";
  if (typeof document === "undefined") return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var cards = Array.from(document.querySelectorAll("#selected-work .featured-card"));
  if (!cards.length) return;

  var showTimer = null;

  function projectLink(card) {
    return card.querySelector('h3 a[href^="projects/"]');
  }

  function ensurePreview(card) {
    var existing = card.querySelector(".project-card-preview");
    if (existing) return existing;

    var link = projectLink(card);
    if (!link) return null;

    var preview = document.createElement("div");
    preview.className = "project-card-preview";
    preview.setAttribute("aria-hidden", "true");
    preview.innerHTML =
      '<div class="project-card-preview-loading">Loading project preview…</div>' +
      '<iframe class="project-card-preview-frame" tabindex="-1" aria-hidden="true" title=""></iframe>' +
      '<span class="project-card-preview-badge">Project preview</span>';

    var frame = preview.querySelector(".project-card-preview-frame");
    frame.title = link.textContent.trim() + " preview";
    frame.addEventListener("load", function () {
      preview.classList.add("is-loaded");
    }, { once: true });
    frame.src = link.href;

    card.appendChild(preview);
    return preview;
  }

  function sizePreview(card) {
    var preview = card.querySelector(".project-card-preview");
    if (!preview) return;
    var sourceWidth = 1280;
    var scale = card.clientWidth / sourceWidth;
    preview.style.setProperty("--project-preview-scale", scale.toFixed(4));
  }

  function show(card) {
    clearTimeout(showTimer);
    showTimer = window.setTimeout(function () {
      ensurePreview(card);
      sizePreview(card);
      cards.forEach(function (item) {
        item.classList.toggle("preview-active", item === card);
      });
    }, 140);
  }

  function hide(card) {
    clearTimeout(showTimer);
    card.classList.remove("preview-active");
  }

  cards.forEach(function (card) {
    card.addEventListener("mouseenter", function () { show(card); });
    card.addEventListener("mouseleave", function () { hide(card); });
  });

  window.addEventListener("resize", function () {
    cards.forEach(sizePreview);
  });
})();