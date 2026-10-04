(function () {
  "use strict";
  if (typeof document === "undefined") return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var cards = Array.from(document.querySelectorAll("#selected-work .featured-card"));
  if (!cards.length) return;

  var popover = document.createElement("aside");
  popover.className = "project-preview-popover";
  popover.setAttribute("aria-hidden", "true");
  popover.innerHTML =
    '<div class="project-preview-head"><strong>Project preview</strong><span>hover preview</span></div>' +
    '<div class="project-preview-viewport">' +
      '<div class="project-preview-loading">Loading project preview…</div>' +
      '<iframe class="project-preview-frame" title="" tabindex="-1" aria-hidden="true"></iframe>' +
    '</div>';
  document.body.appendChild(popover);

  var frame = popover.querySelector(".project-preview-frame");
  var title = popover.querySelector(".project-preview-head strong");
  var currentCard = null;
  var showTimer = null;
  var hideTimer = null;
  var lastUrl = "";

  function projectLink(card) {
    return card.querySelector('h3 a[href^="projects/"]');
  }

  function position(card) {
    var rect = card.getBoundingClientRect();
    var width = Math.min(470, window.innerWidth - 32);
    var height = 314;
    var gap = 16;
    var left;
    var top;

    if (window.innerWidth - rect.right >= width + gap) {
      left = rect.right + gap;
      top = rect.top + Math.min(18, Math.max(0, rect.height - height) / 2);
    } else if (rect.left >= width + gap) {
      left = rect.left - width - gap;
      top = rect.top + Math.min(18, Math.max(0, rect.height - height) / 2);
    } else {
      left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + (rect.width - width) / 2));
      if (window.innerHeight - rect.bottom >= height + gap) {
        top = rect.bottom + gap;
      } else {
        top = Math.max(16, rect.top - height - gap);
      }
    }

    top = Math.max(16, Math.min(window.innerHeight - height - 16, top));
    popover.style.left = Math.round(left) + "px";
    popover.style.top = Math.round(top) + "px";
  }

  function show(card) {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(function () {
      var link = projectLink(card);
      if (!link) return;
      currentCard = card;
      cards.forEach(function (item) {
        item.classList.toggle("preview-active", item === card);
      });

      var url = link.href;
      title.textContent = link.textContent.trim();
      position(card);

      if (url !== lastUrl) {
        popover.classList.remove("is-loaded");
        lastUrl = url;
        frame.src = url;
      }
      popover.classList.add("is-visible");
    }, 170);
  }

  function hide(card) {
    clearTimeout(showTimer);
    hideTimer = setTimeout(function () {
      if (currentCard && card && currentCard !== card) return;
      popover.classList.remove("is-visible");
      cards.forEach(function (item) { item.classList.remove("preview-active"); });
      currentCard = null;
    }, 80);
  }

  frame.addEventListener("load", function () {
    popover.classList.add("is-loaded");
  });

  cards.forEach(function (card) {
    card.addEventListener("mouseenter", function () { show(card); });
    card.addEventListener("mouseleave", function () { hide(card); });
    card.addEventListener("focusin", function () { show(card); });
    card.addEventListener("focusout", function (event) {
      if (!card.contains(event.relatedTarget)) hide(card);
    });
  });

  window.addEventListener("scroll", function () {
    if (currentCard) position(currentCard);
  }, {passive:true});
  window.addEventListener("resize", function () {
    if (currentCard) position(currentCard);
  });
})();