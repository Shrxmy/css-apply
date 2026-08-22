export const EXCLUSIVE_PERKS_CONFIG_KEY = "homepage_exclusive_perks_v1";
export const EXCLUSIVE_PERKS_BUCKET = "homepage-perks";
export const MAX_EXCLUSIVE_PERK_IMAGE_SIZE = 10 * 1024 * 1024;
export const MAX_EXCLUSIVE_PERKS = 20;

export const EXCLUSIVE_PERK_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ExclusivePerkImageType =
  (typeof EXCLUSIVE_PERK_IMAGE_TYPES)[number];
export type ExclusivePerkShape = "circle" | "rounded";
export type ExclusivePerkFit = "cover" | "contain";
export type ExclusivePerkSize = "standard" | "large";

export interface StoredExclusivePerk {
  id: string;
  name: string;
  destinationUrl: string;
  imagePath: string;
  shape: ExclusivePerkShape;
  fit: ExclusivePerkFit;
  size: ExclusivePerkSize;
}

export interface ExclusivePerkResponseItem extends StoredExclusivePerk {
  imageUrl: string;
  isLegacy: boolean;
}

export const DEFAULT_EXCLUSIVE_PERKS: StoredExclusivePerk[] = [
  {
    id: "legacy-biteslice",
    name: "BiteSlice",
    destinationUrl: "https://www.facebook.com/profile.php?id=100064060713967",
    imagePath: "/assets/css-apply-static-images/assets/partners/BiteSlice.webp",
    shape: "circle",
    fit: "cover",
    size: "standard",
  },
  {
    id: "legacy-homeroom",
    name: "HomeRoom",
    destinationUrl: "https://www.facebook.com/homeroomcoworkingph",
    imagePath: "/assets/css-apply-static-images/assets/partners/HomeRoom.webp",
    shape: "circle",
    fit: "cover",
    size: "standard",
  },
  {
    id: "legacy-mindzone",
    name: "MindZone",
    destinationUrl: "https://www.facebook.com/mindzoneespanaph",
    imagePath: "/assets/css-apply-static-images/assets/partners/MindZone.webp",
    shape: "circle",
    fit: "cover",
    size: "standard",
  },
  {
    id: "legacy-nomucafe",
    name: "NomuCafe",
    destinationUrl: "https://www.facebook.com/nomuPH",
    imagePath: "/assets/css-apply-static-images/assets/partners/NomuCafe.webp",
    shape: "circle",
    fit: "cover",
    size: "standard",
  },
  {
    id: "legacy-catalyst",
    name: "TheCatalyst",
    destinationUrl: "https://www.facebook.com/coworking.thecatalyst",
    imagePath: "/assets/css-apply-static-images/assets/partners/TheCatalyst.webp",
    shape: "rounded",
    fit: "contain",
    size: "large",
  },
  {
    id: "legacy-yorokobi",
    name: "Yorokobi",
    destinationUrl: "https://www.facebook.com/yorokobimnl",
    imagePath: "/assets/css-apply-static-images/assets/partners/Yorokobi.webp",
    shape: "circle",
    fit: "cover",
    size: "standard",
  },
  {
    id: "legacy-zerocafe",
    name: "ZeroCafe",
    destinationUrl: "https://www.facebook.com/ZeroCafePH",
    imagePath: "/assets/css-apply-static-images/assets/partners/ZeroCafe.webp",
    shape: "circle",
    fit: "contain",
    size: "standard",
  },
];

export function isLocalPerkImagePath(path: string) {
  return path.startsWith("/assets/");
}

function isSafeDestinationUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseExclusivePerks(value?: string | null) {
  if (!value?.trim()) return DEFAULT_EXCLUSIVE_PERKS.map((item) => ({ ...item }));

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_EXCLUSIVE_PERKS.map((item) => ({ ...item }));

    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .flatMap((item) => {
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const name = typeof item.name === "string" ? item.name.trim() : "";
        const destinationUrl =
          typeof item.destinationUrl === "string"
            ? item.destinationUrl.trim()
            : "";
        const imagePath =
          typeof item.imagePath === "string" ? item.imagePath.trim() : "";
        if (
          !id ||
          !name ||
          !imagePath ||
          !isSafeDestinationUrl(destinationUrl)
        ) {
          return [];
        }

        return [
          {
            id,
            name: name.slice(0, 80),
            destinationUrl,
            imagePath,
            shape: item.shape === "rounded" ? "rounded" : "circle",
            fit: item.fit === "contain" ? "contain" : "cover",
            size: item.size === "large" ? "large" : "standard",
          } satisfies StoredExclusivePerk,
        ];
      })
      .slice(0, MAX_EXCLUSIVE_PERKS);
  } catch {
    return DEFAULT_EXCLUSIVE_PERKS.map((item) => ({ ...item }));
  }
}

export function validatePerkDestinationUrl(value: string) {
  return isSafeDestinationUrl(value.trim());
}
