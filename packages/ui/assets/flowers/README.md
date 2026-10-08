# Shared flower photography

Twelve distinct photographs, reviewed visually on 2026-10-08. Each has 480px and
960px variants in AVIF and WebP: 48 optimized files, about 1.65 MB for the entire
library. A browser requests one appropriate variant per displayed photo, not all
four. The contact sheet is at FE/artifacts/flower-library-contact-sheet.jpg.

Use the shared export from Astro or Vite/React so asset URLs are emitted correctly
in each application's build. Do not hardcode the landing's generated `_astro` URLs
or copy photographs into the portal's public folder.

```tsx
import { flowerPhotos } from '@florabot/ui/flower-photos';

const photo = flowerPhotos.sunflowers;
<picture>
  <source type="image/avif" srcSet={photo.avifSrcSet} sizes="(max-width: 700px) 45vw, 22vw" />
  <img
    src={photo.src}
    srcSet={photo.webpSrcSet}
    sizes="(max-width: 700px) 45vw, 22vw"
    width={photo.width}
    height={photo.height}
    alt={photo.alt}
    loading="lazy"
    decoding="async"
  />
</picture>;
```

Astro uses lowercase `srcset`; landing's FlowerPhoto.astro wraps this pattern.
Choose `sizes` for the actual layout. Keep width/height and use lazy loading only
below the fold. Decorative photos can have an explicit empty alt. Meaningful
photos should use the supplied Vietnamese alt or an accurate contextual variant.

Available IDs: sunflowers, cherryBlossom, roseGarden, pastelBouquet, tulipVase,
stripedTulips, pinkTulip, callaLilies, whiteRose, redRoses, flowerShop, pinkLilies.

`manifest.json` records each exact Unsplash source, license link, dimensions, alt,
caption and filenames. These are illustrative photographs, not FloraBot inventory,
verified shop partners, a product availability claim or manufactured kiosk photos.
Do not use them as payment/refund/incident evidence. No stock photographer name is
invented when not available from the source URL.

Current landing usage: three distinct ribbon photos, eight collection photos,
one shop photo at registration, and species-matched gift-demo results. Existing
hero/cabinet assets are separate. Other sessions should reuse this source library
and export rather than downloading duplicate copies.
