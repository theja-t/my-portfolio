/* =====================================================================
 * Portfolio interactions — refactored for single responsibility.
 *
 * Architecture:
 *   - SiteConfig      : single source of truth for magic values (OCP)
 *   - YearStamp       : tiny feature — updates the copyright year
 *   - TiltEffect      : pointer-tilt behaviour, feature-detected and
 *                       guarded by media queries (SRP, open for
 *                       extension via TiltEffect.attach)
 *   - MobileNav       : menu toggle state machine (SRP, encapsulated
 *                       state — no globals leaking)
 *   - initPortfolio() : composition root — wires concrete elements to
 *                       features (Dependency Inversion: features know
 *                       nothing about the DOM query used to find them)
 * ===================================================================== */

"use strict";

/** Central configuration — no magic strings/values scattered around. */
const SiteConfig = Object.freeze({
  yearElement: "#current-year",
  heroPanel: ".hero-panel",
  projectCard: ".project-card",
  menuToggle: ".menu-toggle",
  nav: "#primary-nav",
  navOpenClass: "is-open",
  tilt: {
    heroMaxAngle: 4,
    cardMaxAngle: 3,
    motionQuery: "(prefers-reduced-motion: reduce)",
    finePointerQuery: "(hover: hover) and (pointer: fine)",
  },
});

/* ---------------------------------------------------------------
 * Feature: stamp the current year into the footer.
 * ------------------------------------------------------------- */
class YearStamp {
  constructor(element, clock = { now: () => new Date() }) {
    this.element = element;
    this.clock = clock; // injected dependency → testable
  }

  init() {
    if (!this.element) return this;
    this.element.textContent = String(this.clock.now().getFullYear());
    return this;
  }
}

/* ---------------------------------------------------------------
 * Feature: subtle pointer-tilt on decorative cards.
 * Self-contained; respects reduced-motion / coarse pointers.
 * ------------------------------------------------------------- */
class TiltEffect {
  constructor(element, maxAngle, media = window.matchMedia.bind(window)) {
    this.element = element;
    this.maxAngle = maxAngle;
    this.enabled =
      !media(SiteConfig.tilt.motionQuery).matches &&
      media(SiteConfig.tilt.finePointerQuery).matches;
  }

  static attachAll(selector, maxAngle) {
    document.querySelectorAll(selector).forEach(
      (el) => new TiltEffect(el, maxAngle).init()
    );
  }

  init() {
    if (!this.enabled || !this.element) return this;
    this.element.addEventListener("pointermove", this);
    this.element.addEventListener("pointerleave", this);
    return this;
  }

  // Event-delegation via a single handler object keeps listeners tidy.
  handleEvent(event) {
    if (event.type === "pointermove") this.#onMove(event);
    else this.#onLeave();
  }

  #onMove(event) {
    const bounds = this.element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const rotateX = (0.5 - y) * this.maxAngle * 2;
    const rotateY = (x - 0.5) * this.maxAngle * 2;

    this.element.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
    this.element.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
  }

  #onLeave() {
    this.element.style.removeProperty("--tilt-x");
    this.element.style.removeProperty("--tilt-y");
  }
}

/* ---------------------------------------------------------------
 * Feature: mobile navigation open/close state machine.
 * ------------------------------------------------------------- */
class MobileNav {
  constructor(toggle, nav, config = SiteConfig) {
    this.toggle = toggle;
    this.nav = nav;
    this.openClass = config.navOpenClass;
  }

  init() {
    if (!this.toggle || !this.nav) return this;

    this.toggle.addEventListener("click", () => this.#toggle());
    // Close when a nav link is chosen (event delegation → one listener).
    this.nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        this.close();
      }
    });
    // Escape closes and restores focus for keyboard users.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen) {
        this.close();
        this.toggle.focus();
      }
    });
    return this;
  }

  get isOpen() {
    return this.toggle.getAttribute("aria-expanded") === "true";
  }

  #toggle() {
    this.isOpen ? this.close() : this.#open();
  }

  #open() {
    this.toggle.setAttribute("aria-expanded", "true");
    this.toggle.setAttribute("aria-label", "Close navigation menu");
    this.nav.classList.add(this.openClass);
  }

  close() {
    this.toggle.setAttribute("aria-expanded", "false");
    this.toggle.setAttribute("aria-label", "Open navigation menu");
    this.nav.classList.remove(this.openClass);
  }
}

/* ---------------------------------------------------------------
 * Composition root — the only place that touches concrete selectors.
 * ------------------------------------------------------------- */
function initPortfolio(root = document, config = SiteConfig) {
  new YearStamp(root.querySelector(config.yearElement)).init();

  new TiltEffect(
    root.querySelector(config.heroPanel),
    config.tilt.heroMaxAngle
  ).init();
  TiltEffect.attachAll(config.projectCard, config.tilt.cardMaxAngle);

  new MobileNav(
    root.querySelector(config.menuToggle),
    root.querySelector(config.nav),
    config
  ).init();
}

initPortfolio();
