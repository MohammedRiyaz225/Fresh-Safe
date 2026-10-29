/**
 * Fresh & Safe — client product image catalog (local assets for reliable delivery).
 */
(function (global) {
  const BASE = 'assets/products/';
  const FALLBACK = BASE + 'product-image-unavailable.svg';

  function fromPhotoId(photoId) {
    if (!photoId) return FALLBACK;
    const id = photoId.startsWith('photo-') ? photoId : 'photo-' + photoId;
    return BASE + id + '.jpg';
  }

  function enhanceProductImages() {
    document.querySelectorAll('.product-img-wrap img, .page-hero-img, .cat-card > img, .hero-slide img').forEach(function (img) {
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.onerror) {
        img.onerror = function () {
          if (this.src.indexOf(FALLBACK) === -1) this.src = FALLBACK;
        };
      }
    });
  }

  global.FS_PRODUCT_IMAGES = {
    BASE,
    FALLBACK,
    fromPhotoId,
    enhanceProductImages
  };

  document.addEventListener('DOMContentLoaded', enhanceProductImages);
})(window);
