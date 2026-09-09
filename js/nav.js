/* Injects the shared header, footer and alert banner.
 *
 * Every page needs:
 *   <html data-page="register.html" data-base="./">   (admin pages use "../")
 *   <div id="site-header"></div> ... <div id="site-footer"></div>
 */

import { NAV, SITE, PRIMARY } from "./nav-config.js";

const root    = document.documentElement;
const BASE    = root.dataset.base || "./";
const CURRENT = root.dataset.page || "index.html";

function headerHTML() {
  const links = NAV.map((item) => {
    const current = item.href === CURRENT ? ' aria-current="page"' : "";
    const soon    = item.built ? "" : " soon";
    const title   = item.built ? "" : ' title="Coming soon"';
    return `<a class="nav-link${soon}" href="${BASE}${item.href}"${current}${title}>${item.label}</a>`;
  }).join("");

  return `
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="${BASE}index.html">
          <span class="brand-logo">
            <img src="${BASE}assets/pal-logo.png" alt=""
                 onerror="this.style.display='none';this.nextElementSibling.style.display='grid';">
            <span class="brand-mark">PAL</span>
          </span>
          <span class="brand-text">
            <b>${SITE.name}</b>
            <span>${SITE.program}</span>
          </span>
        </a>
        <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav">
          Menu
        </button>
        <nav class="site-nav" id="siteNav">${links}</nav>
      </div>
    </header>`;
}

function footerHTML() {
  const quick = NAV.filter(n => n.built)
    .map(n => `<li><a href="${BASE}${n.href}">${n.label}</a></li>`).join("");

  const contacts = SITE.contacts.map(c => `
    <p class="foot-contact">
      <b>${c.name}</b><br>
      <span class="role">${c.role}</span><br>
      <a href="mailto:${c.email}">${c.email}</a><br>
      <a href="tel:${c.tel}">${c.phone}</a>
    </p>`).join("");

  return `
    <footer class="site-footer">
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <h4>${SITE.name}</h4>
            <p>${SITE.program} for ${SITE.grades} in Mountainside, New Jersey.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <ul>${quick}</ul>
          </div>
          <div>
            <h4>Questions?</h4>
            ${contacts}
          </div>
          <div>
            <h4>Follow Along</h4>
            <p>
              <a href="${SITE.instagram.url}" target="_blank" rel="noopener">
                Instagram ${SITE.instagram.handle}
              </a>
            </p>
          </div>
        </div>
        <div class="foot-bottom">
          <span>&copy; ${new Date().getFullYear()} ${SITE.name}</span>
          <span>Mountainside, NJ</span>
        </div>
      </div>
    </footer>`;
}

/** Site-wide alert banner from Firestore config/site.alertBanner (Phase 4). */
async function renderAlertBanner(mount) {
  try {
    const { getFirebase } = await import("./firebase-config.js");
    const fb = await getFirebase();
    if (!fb) return;

    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    );
    const snap = await getDoc(doc(fb.db, "config", "site"));
    const banner = snap.exists() ? snap.data().alertBanner : null;
    if (!banner || !banner.active) return;
    if (banner.expiresAt && banner.expiresAt.toDate() < new Date()) return;

    const cls  = banner.level === "urgent" ? "alert-banner" : "alert-banner alert-banner--info";
    const text = banner.link
      ? `${banner.text} <a href="${banner.link}">More&nbsp;info</a>`
      : banner.text;
    mount.innerHTML = `<div class="${cls}"><div class="wrap">${text}</div></div>`;
  } catch (err) {
    console.warn("[nav] alert banner unavailable:", err.message);
  }
}

function init() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  if (header) header.innerHTML = headerHTML();
  if (footer) footer.innerHTML = footerHTML();

  const toggle = document.getElementById("navToggle");
  const nav    = document.getElementById("siteNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const bannerMount = document.getElementById("alert-banner");
  if (bannerMount) renderAlertBanner(bannerMount);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
