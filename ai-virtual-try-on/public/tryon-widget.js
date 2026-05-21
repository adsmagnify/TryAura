/**
 * TryAura Storefront Widget — async job polling
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
  let sessionId = null;

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

  function detectProductFromPage() {
    if (window.TryOnConfig && window.TryOnConfig.productId) {
      productId = String(window.TryOnConfig.productId);
      return;
    }
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      productId = String(
        window.ShopifyAnalytics.meta.product.id || window.ShopifyAnalytics.meta.product.gid || productId
      );
    }
    if (window.Shopify && window.Shopify.theme && window.Shopify.theme.product) {
      productId = String(window.Shopify.theme.product.id);
    }

    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
      try {
        const data = JSON.parse(script.textContent);
        if (data["@type"] === "Product") {
          productId = String(data.productID || data.sku || productId);
        }
      } catch (e) { /* ignore */ }
    });

    const meta =
      document.querySelector('meta[property="og:product_id"]') ||
      document.querySelector('meta[name="product-id"]') ||
      document.querySelector('meta[property="product:id"]');
    if (meta && !productId) productId = meta.getAttribute("content");

    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (productForm && !productId) {
      const pid = productForm.getAttribute("data-product-id");
      if (pid) productId = String(pid);
    }
  }

  function findCartAnchor() {
    return (
      document.querySelector('button[type="submit"][name="add"]') ||
      document.querySelector('form[action*="/cart/add"] button[type="submit"]') ||
      document.querySelector(".product-form__submit") ||
      document.querySelector("[data-add-to-cart]") ||
      document.querySelector("buy-buttons button") ||
      document.querySelector(".shopify-payment-button") ||
      document.querySelector('[data-shopify="payment-button"]') ||
      document.querySelector(".product-form") ||
      document.querySelector("main product-form") ||
      document.querySelector(".product__info")
    );
  }

  function addTryOnButton() {
    const anchor = findCartAnchor();
    if (!anchor || document.querySelector(".try-on-button")) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "try-on-button";
    button.textContent = CONFIG.BUTTON_TEXT;
    button.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;" +
      "background:" + CONFIG.BUTTON_COLOR + ";color:" + CONFIG.BUTTON_TEXT_COLOR + ";" +
      "border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-top:12px;" +
      "width:100%;max-width:100%;box-sizing:border-box;";

    button.addEventListener("click", openModal);

    const parent = anchor.parentNode || anchor;
    if (anchor.tagName === "FORM" || anchor.classList && anchor.classList.contains("product-form")) {
      anchor.appendChild(button);
    } else {
      parent.insertBefore(button, anchor.nextSibling);
    }
    return true;
  }

  function watchForCartButton() {
    if (addTryOnButton()) return;
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (addTryOnButton() || attempts > 40) clearInterval(timer);
    }, 500);
  }

  async function init() {
    resolveBackendUrl();
    detectProductFromPage();

    if (!productId) {
      detectProductFromPage();
    }

    const enabled = await loadStoreSettings();
    if (!enabled) return;

    if (!productId) {
      console.warn("[TryAura] Could not detect product id on this page.");
      return;
    }

    watchForCartButton();
  }

  function openModal() {
    sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    const shop = getShopDomain();

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
      selectedFile = file;
      generateBtn.style.display = "block";
      hideError();
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
      formData.append("productId", productId);
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
