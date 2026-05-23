/**
 * TryAura Storefront Widget — works on product pages, home, collection, and custom themes.
 */
(function () {
  "use strict";

  const FALLBACK_API_URL = "https://tryaura-api.onrender.com";

  const CONFIG = {
    BACKEND_URL: "",
    BUTTON_TEXT: "Virtual Try-On ✨",
    BUTTON_COLOR: "#1a1a2e",
    BUTTON_TEXT_COLOR: "#ffffff",
    MODAL_TITLE: "Virtual Try-On",
    MODAL_SUBTITLE: "See how this looks on you!",
    PROCESSING_TEXT: "Creating your look...",
    MAX_FILE_SIZE_MB: 10,
    POLL_INTERVAL_MS: 2500,
    POLL_MAX_MS: 180000,
  };

  let modal = null;
  let productId = null;
  let garmentImageUrl = null;
  let sessionId = null;
  let mountedCardRoots = new WeakSet();

  function normalizeShopDomain(shop) {
    if (!shop) return null;
    var s = String(shop).trim().toLowerCase();
    if (!s) return null;
    if (s.indexOf(".myshopify.com") !== -1) return s;
    if (s.indexOf(".") === -1) return s + ".myshopify.com";
    return s;
  }

  function getShopDomain() {
    var candidates = [
      window.TryOnConfig && window.TryOnConfig.shop,
      window.Shopify && window.Shopify.shop,
      document.querySelector('meta[name="shopify-digital-wallet"]') &&
        document.querySelector('meta[name="shopify-digital-wallet"]').getAttribute("content"),
    ];
    for (var i = 0; i < candidates.length; i++) {
      var normalized = normalizeShopDomain(candidates[i]);
      if (normalized && normalized.indexOf(".myshopify.com") !== -1) return normalized;
    }
    return null;
  }

  function resolveBackendUrl() {
    const fromWindow =
      window.TRYON_BACKEND_URL ||
      (window.TryOnConfig && window.TryOnConfig.apiUrl) ||
      "";
    CONFIG.BACKEND_URL = String(fromWindow || FALLBACK_API_URL).replace(/\/$/, "");
  }

  async function loadStoreSettings() {
    const shop = getShopDomain();
    if (!shop) return true;

    if (!CONFIG.BACKEND_URL) resolveBackendUrl();

    try {
      const res = await fetch(
        CONFIG.BACKEND_URL + "/api/admin/settings/public?shop=" + encodeURIComponent(shop)
      );
      const data = await res.json();
      if (!data.success || !data.settings) return true;
      if (data.settings.enabled === false) return false;
      if (data.settings.buttonText) CONFIG.BUTTON_TEXT = data.settings.buttonText;
      if (data.settings.buttonColor) CONFIG.BUTTON_COLOR = data.settings.buttonColor;
      if (data.settings.processingMessage) CONFIG.PROCESSING_TEXT = data.settings.processingMessage;
    } catch (e) {
      /* use defaults — button still shows */
    }
    return true;
  }

  function normalizeProductId(id) {
    if (id == null || id === "") return null;
    var raw = String(id).trim();
    var gidMatch = raw.match(/^gid:\/\/shopify\/Product\/(\d+)$/i);
    if (gidMatch) return gidMatch[1];
    if (/^\d+$/.test(raw)) return raw;
    return null;
  }

  function applyProductContext(id, imageUrl) {
    var pid = normalizeProductId(id);
    if (pid) productId = pid;
    if (imageUrl) garmentImageUrl = imageUrl;
    if (window.TryOnConfig) {
      if (pid) window.TryOnConfig.productId = pid;
      if (imageUrl) window.TryOnConfig.garmentImageUrl = imageUrl;
    }
  }

  function parseProductJsonScripts() {
    var selectors = [
      'script[type="application/json"][data-product-json]',
      'script[type="application/json"][id*="ProductJson"]',
      'script[type="application/json"][id*="product-json"]',
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (script) {
        try {
          var data = JSON.parse(script.textContent);
          if (data && (data.id || data.product_id)) {
            applyProductContext(
              data.id || data.product_id,
              data.featured_image || (data.featured_image && data.featured_image.src) || data.image
            );
          }
        } catch (e) { /* ignore */ }
      });
    });
  }

  function detectProductFromPage() {
    if (window.TryOnConfig) {
      applyProductContext(window.TryOnConfig.productId, window.TryOnConfig.garmentImageUrl);
    }
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      var p = window.ShopifyAnalytics.meta.product;
      applyProductContext(p.id || p.gid, null);
    }
    if (window.Shopify && window.Shopify.theme && window.Shopify.theme.product) {
      var tp = window.Shopify.theme.product;
      var img =
        tp.featured_image ||
        (tp.featured_image && tp.featured_image.src) ||
        (tp.images && tp.images[0]) ||
        null;
      applyProductContext(tp.id, img);
    }

    parseProductJsonScripts();

    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
      try {
        const data = JSON.parse(script.textContent);
        if (data["@type"] === "Product") {
          applyProductContext(data.productID || data["@id"], null);
        }
      } catch (e) { /* ignore */ }
    });

    const meta =
      document.querySelector('meta[property="og:product_id"]') ||
      document.querySelector('meta[name="product-id"]') ||
      document.querySelector('meta[property="product:id"]');
    if (meta) applyProductContext(meta.getAttribute("content"), null);

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (productForm) {
      var nestedPid = productForm.querySelector("[data-product-id]");
      const pid =
        productForm.getAttribute("data-product-id") ||
        (nestedPid && nestedPid.getAttribute("data-product-id"));
      if (pid) applyProductContext(pid, null);
    }
  }

  function getProductHandleFromPath() {
    var match = window.location.pathname.match(/\/products\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function fetchProductByHandle(handle) {
    if (!handle) return null;
    try {
      var res = await fetch("/products/" + encodeURIComponent(handle) + ".js", {
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function detectProductFromUrl() {
    if (productId) return;
    var handle = getProductHandleFromPath();
    if (!handle) return;
    var data = await fetchProductByHandle(handle);
    if (!data) return;
    var img = data.featured_image || (data.images && data.images[0]) || null;
    applyProductContext(data.id, img);
  }

  function findCartAnchor(root) {
    var scope = root && root.querySelector ? root : document;
    return (
      scope.querySelector('button[type="submit"][name="add"]') ||
      scope.querySelector('form[action*="/cart/add"] button[type="submit"]') ||
      scope.querySelector(".product-form__submit") ||
      scope.querySelector("[data-add-to-cart]") ||
      scope.querySelector("buy-buttons button") ||
      scope.querySelector(".shopify-payment-button") ||
      scope.querySelector('[data-shopify="payment-button"]') ||
      scope.querySelector(".product-form") ||
      scope.querySelector("main product-form") ||
      scope.querySelector(".product__info")
    );
  }

  function createTryOnButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "try-on-button";
    button.textContent = CONFIG.BUTTON_TEXT;
    button.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;" +
      "background:" + CONFIG.BUTTON_COLOR + ";color:" + CONFIG.BUTTON_TEXT_COLOR + ";" +
      "border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-top:12px;" +
      "width:100%;max-width:100%;box-sizing:border-box;";
    button.addEventListener("click", onClick || openModal);
    return button;
  }

  function insertButtonNearAnchor(anchor, button) {
    if (!anchor) return false;
    const parent = anchor.parentNode || anchor;
    if (anchor.tagName === "FORM" || (anchor.classList && anchor.classList.contains("product-form"))) {
      anchor.appendChild(button);
    } else {
      parent.insertBefore(button, anchor.nextSibling);
    }
    return true;
  }

  function addTryOnButton(root) {
    var scope = root && root.querySelector ? root : document;
    if (scope.querySelector && scope.querySelector(".try-on-button")) return false;

    const anchor = findCartAnchor(scope);
    if (!anchor) return false;

    const button = createTryOnButton(openModal);
    return insertButtonNearAnchor(anchor, button);
  }

  function watchForCartButton(root) {
    if (addTryOnButton(root)) return;
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (addTryOnButton(root) || attempts > 40) clearInterval(timer);
    }, 500);
  }

  function findProductCardRoots() {
    var roots = [];
    var seen = new Set();

    function addRoot(el) {
      if (!el || seen.has(el)) return;
      seen.add(el);
      roots.push(el);
    }

    document.querySelectorAll("form[action*='/cart/add'][data-product-id]").forEach(function (form) {
      addRoot(form.closest(".card, .product-card, .grid__item, .product-grid__item, article, li") || form);
    });

    document.querySelectorAll("[data-product-id]").forEach(function (el) {
      var id = normalizeProductId(el.getAttribute("data-product-id"));
      if (!id) return;
      addRoot(el.closest(".card, .product-card, .grid__item, .product-grid__item, article, li, .product-item") || el);
    });

    document.querySelectorAll('a[href*="/products/"]').forEach(function (link) {
      var card = link.closest(".card, .product-card, .grid__item, .product-grid__item, article, li, .product-item");
      if (card) addRoot(card);
    });

    return roots;
  }

  async function mountOnProductCards() {
    var roots = findProductCardRoots();
    if (!roots.length) return false;

    var mounted = false;
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (mountedCardRoots.has(root) || root.querySelector(".try-on-button")) continue;

      var idEl = root.querySelector("[data-product-id]") || root.querySelector("form[action*='/cart/add']");
      var pid = idEl ? normalizeProductId(idEl.getAttribute("data-product-id")) : null;

      var link = root.querySelector('a[href*="/products/"]');
      var handle = null;
      if (link) {
        var m = link.getAttribute("href").match(/\/products\/([^/?#]+)/i);
        if (m) handle = decodeURIComponent(m[1]);
      }

      if (!pid && handle) {
        var data = await fetchProductByHandle(handle);
        if (data) pid = normalizeProductId(data.id);
      }
      if (!pid) continue;

      var anchor =
        findCartAnchor(root) ||
        root.querySelector(".card__content, .product-card__info, .card-information, .product-item__info") ||
        root;

      var button = createTryOnButton(function () {
        if (handle) {
          fetchProductByHandle(handle).then(function (data) {
            var img = data && (data.featured_image || (data.images && data.images[0])) || null;
            applyProductContext(pid, img);
            openModal();
          });
          return;
        }
        applyProductContext(pid, garmentImageUrl);
        openModal();
      });
      button.style.marginTop = "8px";
      button.style.width = "100%";

      if (anchor === root) {
        root.appendChild(button);
      } else {
        insertButtonNearAnchor(anchor, button);
      }

      mountedCardRoots.add(root);
      mounted = true;
    }
    return mounted;
  }

  function observeDomForAnchors() {
    if (typeof MutationObserver === "undefined") return;
    var debounce = null;
    var observer = new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        if (productId) watchForCartButton();
        else mountOnProductCards();
      }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    resolveBackendUrl();
    detectProductFromPage();
    await detectProductFromUrl();

    const enabled = await loadStoreSettings();
    if (!enabled) return;

    if (productId) {
      watchForCartButton();
      observeDomForAnchors();
      return;
    }

    var cardsMounted = await mountOnProductCards();
    if (!cardsMounted) {
      console.warn("[TryAura] No product detected on this page. Try-on appears on product pages and pages with product cards.");
      return;
    }

    observeDomForAnchors();
  }

  function openModal() {
    sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    const shop = getShopDomain();

    if (!productId) {
      alert("Could not detect which product to try on. Open a product page and try again.");
      return;
    }

    if (!CONFIG.BACKEND_URL || CONFIG.BACKEND_URL.indexOf("your-backend") !== -1) {
      alert("Try-On is not configured. Contact the store owner.");
      return;
    }
    if (!shop) {
      alert("Could not detect shop domain.");
      return;
    }

    modal = document.createElement("div");
    modal.className = "tryon-modal-overlay";
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;";

    const panel = document.createElement("div");
    panel.style.cssText =
      "background:#fff;border-radius:16px;max-width:420px;width:100%;padding:24px;" +
      "position:relative;max-height:90vh;overflow:auto;";

    panel.innerHTML = [
      '<button type="button" class="close-modal" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>',
      "<h2 style=\"margin:0 0 8px;font-size:22px;\">" + CONFIG.MODAL_TITLE + "</h2>",
      "<p style=\"color:#666;margin:0 0 20px;\">" + CONFIG.MODAL_SUBTITLE + "</p>",
      '<img class="result-image" alt="Result" style="display:none;max-width:100%;border-radius:12px;margin-bottom:16px;">',
      '<div class="upload-section" style="text-align:center;">',
      '<input type="file" accept="image/*" class="image-input" id="tryon-image-input" style="display:none">',
      '<label for="tryon-image-input" style="display:inline-block;padding:14px 32px;background:#1a1a2e;color:#fff;border-radius:8px;cursor:pointer;font-weight:600;">Upload Your Photo</label>',
      "</div>",
      '<button type="button" class="generate-btn" style="display:none;width:100%;padding:16px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;margin-top:12px;">Generate Try-On</button>',
      '<div class="processing-state" style="display:none;text-align:center;padding:16px;color:#666;">' + CONFIG.PROCESSING_TEXT + "</div>",
      '<div class="error-message" style="display:none;padding:12px;background:#fee2e2;color:#991b1b;border-radius:8px;margin-top:12px;font-size:14px;"></div>',
      '<button type="button" class="reset-btn" style="display:none;width:100%;padding:14px;margin-top:12px;border:none;border-radius:8px;background:#f3f4f6;cursor:pointer;font-weight:600;">Try Another Photo</button>',
    ].join("");

    modal.appendChild(panel);
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeBtn = panel.querySelector(".close-modal");
    const imageInput = panel.querySelector(".image-input");
    const generateBtn = panel.querySelector(".generate-btn");
    const resetBtn = panel.querySelector(".reset-btn");
    const uploadSection = panel.querySelector(".upload-section");
    const processingState = panel.querySelector(".processing-state");
    const resultImage = panel.querySelector(".result-image");
    const errorEl = panel.querySelector(".error-message");

    let selectedFile = null;
    var configImage =
      (window.TryOnConfig && window.TryOnConfig.garmentImageUrl) || garmentImageUrl;

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });

    imageInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.type.indexOf("image/") !== 0) return showError("Please upload an image");
      if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        return showError("Image must be under " + CONFIG.MAX_FILE_SIZE_MB + "MB");
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        if (img.width < 300 || img.height < 400) {
          showError("Photo is too small. Use a clearer full-body photo (at least 300×400px).");
          imageInput.value = "";
          selectedFile = null;
          generateBtn.style.display = "none";
          return;
        }
        selectedFile = file;
        generateBtn.style.display = "block";
        hideError();
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        showError("Could not read this image. Try another photo.");
      };
      img.src = url;
    });

    generateBtn.addEventListener("click", function () {
      if (!selectedFile) return;

      uploadSection.style.display = "none";
      generateBtn.style.display = "none";
      processingState.style.display = "block";
      hideError();

      const customerId = window.ShopifyAnalytics?.meta?.page?.customerId || null;
      const formData = new FormData();
      formData.append("personImage", selectedFile);
      if (productId) formData.append("productId", productId);
      if (configImage) formData.append("garmentImageUrl", configImage);
      formData.append("shop", shop);
      formData.append("sessionId", sessionId);
      if (customerId) formData.append("customerId", String(customerId));

      fetch(
        CONFIG.BACKEND_URL + "/api/tryon?shop=" + encodeURIComponent(shop),
        { method: "POST", body: formData }
      )
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
        .then(function (_ref) {
          var res = _ref.res;
          var data = _ref.data;
          if (!res.ok || !data.success) throw new Error(data.error || "Failed to start try-on");
          var pollPath = data.pollUrl || ("/api/tryon/jobs/" + data.jobId + "?shop=" + encodeURIComponent(shop));
          var pollUrl = pollPath.indexOf("http") === 0 ? pollPath : CONFIG.BACKEND_URL + pollPath;
          return pollJob(pollUrl);
        })
        .then(function (output) {
          resultImage.src = output;
          resultImage.style.display = "block";
          processingState.style.display = "none";
          resetBtn.style.display = "block";
        })
        .catch(function (err) {
          processingState.style.display = "none";
          uploadSection.style.display = "block";
          generateBtn.style.display = "block";
          showError(err.message || "Try-on failed");
        });
    });

    resetBtn.addEventListener("click", function () {
      selectedFile = null;
      imageInput.value = "";
      resultImage.style.display = "none";
      uploadSection.style.display = "block";
      generateBtn.style.display = "none";
      resetBtn.style.display = "none";
      hideError();
    });

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    }
    function hideError() {
      errorEl.style.display = "none";
    }
  }

  function pollJob(pollUrl) {
    var start = Date.now();
    function tick() {
      return fetch(pollUrl)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.success || !data.job) throw new Error(data.error || "Invalid response");
          if (data.job.status === "completed" && data.job.output) return data.job.output;
          if (data.job.status === "failed") throw new Error(data.job.error || "Generation failed");
          if (Date.now() - start >= CONFIG.POLL_MAX_MS) throw new Error("Timed out");
          return new Promise(function (r) { setTimeout(r, CONFIG.POLL_INTERVAL_MS); }).then(tick);
        });
    }
    return tick();
  }

  function closeModal() {
    if (modal) {
      modal.remove();
      modal = null;
    }
    document.body.style.overflow = "";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
