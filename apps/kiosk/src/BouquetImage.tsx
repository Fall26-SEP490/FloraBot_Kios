import { useState } from 'react';

export function FlowerSvgFallback({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`flower-svg-fallback ${className}`}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Minh họa hoa nhân tạo"
    >
      <rect width="200" height="200" rx="16" fill="#F0F7E9" />
      <circle cx="100" cy="100" r="32" fill="#EAF5E6" stroke="#204B2E" strokeWidth="3" />
      <path
        d="M100 45 C88 68 88 84 100 100 C112 84 112 68 100 45 Z"
        fill="#346D41"
        opacity="0.85"
      />
      <path
        d="M100 155 C88 132 88 116 100 100 C112 116 112 132 100 155 Z"
        fill="#346D41"
        opacity="0.85"
      />
      <path
        d="M45 100 C68 88 84 88 100 100 C84 112 68 112 45 100 Z"
        fill="#346D41"
        opacity="0.85"
      />
      <path
        d="M155 100 C132 88 116 88 100 100 C116 112 132 112 155 100 Z"
        fill="#346D41"
        opacity="0.85"
      />
      <circle cx="100" cy="100" r="14" fill="#E4A834" />
      <circle cx="100" cy="100" r="7" fill="#842323" opacity="0.3" />
    </svg>
  );
}

export default function BouquetImage({
  src,
  alt,
  className = '',
  width = 400,
  height = 300,
}: {
  src?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  // Key error state by src so recovery happens automatically when src changes
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const hasError = Boolean(src && failedSrc === src);

  if (!src || hasError) {
    return <FlowerSvgFallback className={className} />;
  }

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}

export function getBouquetImageUrl(name: string, index = 0): string {
  const lower = name.toLowerCase();
  const base = import.meta.env.BASE_URL;
  // Match mini first to avoid misclassifying mini roses as large bouquets
  if (lower.includes('mini')) {
    return `${base}images/demo-mini-bouquet.png`;
  }
  if (lower.includes('hồng') || lower.includes('rose')) {
    return `${base}images/demo-silk-rose.png`;
  }
  if (lower.includes('tulip') || lower.includes('pastel')) {
    return `${base}images/demo-pastel-bouquet.png`;
  }
  if (lower.includes('hướng dương') || lower.includes('sunflower') || lower.includes('cúc')) {
    return `${base}images/demo-sunflower.png`;
  }
  const fallbackList = [
    `${base}images/demo-silk-rose.png`,
    `${base}images/demo-pastel-bouquet.png`,
    `${base}images/demo-sunflower.png`,
    `${base}images/demo-mini-bouquet.png`,
  ];
  return fallbackList[index % fallbackList.length];
}
