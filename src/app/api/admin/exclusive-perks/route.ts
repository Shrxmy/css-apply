import { randomUUID } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import {
  EXCLUSIVE_PERK_IMAGE_TYPES,
  EXCLUSIVE_PERKS_BUCKET,
  EXCLUSIVE_PERKS_CONFIG_KEY,
  ExclusivePerkFit,
  ExclusivePerkImageType,
  ExclusivePerkShape,
  ExclusivePerkSize,
  isLocalPerkImagePath,
  MAX_EXCLUSIVE_PERK_IMAGE_SIZE,
  MAX_EXCLUSIVE_PERKS,
  parseExclusivePerks,
  StoredExclusivePerk,
  validatePerkDestinationUrl,
} from "@/lib/exclusive-perks";

const EXTENSION_BY_TYPE: Record<ExclusivePerkImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const BUCKET_CHECK_TTL_MS = 10 * 60 * 1000;

let bucketReadyUntil = 0;
let bucketSetupPromise: Promise<void> | null = null;

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

async function authorizeSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = session.user.dbId
    ? await prisma.user.findUnique({
        where: { id: session.user.dbId },
        select: { role: true },
      })
    : session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { role: true },
        })
      : null;

  return isSuperAdmin(currentUser?.role)
    ? null
    : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function hasValidImageSignature(bytes: Uint8Array, type: ExclusivePerkImageType) {
  if (type === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      bytes.length >= signature.length &&
      signature.every((value, index) => bytes[index] === value)
    );
  }

  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

async function ensureBucket() {
  if (bucketReadyUntil > Date.now()) return;
  if (bucketSetupPromise) return bucketSetupPromise;

  bucketSetupPromise = (async () => {
    const { data } = await supabase.storage.getBucket(EXCLUSIVE_PERKS_BUCKET);
    const settings = {
      public: false,
      allowedMimeTypes: [...EXCLUSIVE_PERK_IMAGE_TYPES],
      fileSizeLimit: MAX_EXCLUSIVE_PERK_IMAGE_SIZE,
    };

    if (data) {
      const { error } = await supabase.storage.updateBucket(
        EXCLUSIVE_PERKS_BUCKET,
        settings,
      );
      if (error) throw new Error("Unable to secure exclusive perks storage");
    } else {
      const { error } = await supabase.storage.createBucket(
        EXCLUSIVE_PERKS_BUCKET,
        settings,
      );
      if (error && !error.message.toLowerCase().includes("already")) {
        throw new Error("Unable to initialize exclusive perks storage");
      }
    }

    bucketReadyUntil = Date.now() + BUCKET_CHECK_TTL_MS;
  })();

  try {
    await bucketSetupPromise;
  } finally {
    bucketSetupPromise = null;
  }
}

async function getConfiguredPerks() {
  const config = await prisma.systemConfig.findUnique({
    where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
    select: { value: true },
  });
  return parseExclusivePerks(config?.value);
}

async function addSignedImageUrls(items: StoredExclusivePerk[]) {
  const storagePaths = items.flatMap((item) =>
    isLocalPerkImagePath(item.imagePath) ? [] : [item.imagePath],
  );
  const signedUrls = new Map<string, string>();

  if (storagePaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(EXCLUSIVE_PERKS_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60);
    if (error) throw new Error("Unable to prepare exclusive perk images");

    for (const image of data) {
      if (image.path && image.signedUrl) {
        signedUrls.set(image.path, image.signedUrl);
      }
    }
  }

  return items.map((item) => ({
    ...item,
    imageUrl: isLocalPerkImagePath(item.imagePath)
      ? item.imagePath
      : signedUrls.get(item.imagePath) || "",
    isLegacy: isLocalPerkImagePath(item.imagePath),
  }));
}

function readPresentationValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export async function GET() {
  try {
    const authorizationError = await authorizeSuperAdmin();
    if (authorizationError) return authorizationError;

    const items = await getConfiguredPerks();
    return NextResponse.json({ items: await addSignedImageUrls(items) });
  } catch (error) {
    console.error(
      "Get exclusive perks failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let stagedImagePath = "";

  try {
    const authorizationError = await authorizeSuperAdmin();
    if (authorizationError) return authorizationError;

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action;

    if (action === "prepare") {
      const fileType = typeof payload.fileType === "string" ? payload.fileType : "";
      const fileSize = typeof payload.fileSize === "number" ? payload.fileSize : 0;
      if (!EXCLUSIVE_PERK_IMAGE_TYPES.includes(fileType as ExclusivePerkImageType)) {
        return NextResponse.json(
          { error: "Only JPEG, PNG, and WebP images are allowed" },
          { status: 400 },
        );
      }
      if (
        !Number.isSafeInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > MAX_EXCLUSIVE_PERK_IMAGE_SIZE
      ) {
        return NextResponse.json(
          { error: "Image must be 10MB or smaller" },
          { status: 400 },
        );
      }

      await ensureBucket();
      const extension = EXTENSION_BY_TYPE[fileType as ExclusivePerkImageType];
      const imagePath = `partners/${randomUUID()}.${extension}`;
      const { data, error } = await supabase.storage
        .from(EXCLUSIVE_PERKS_BUCKET)
        .createSignedUploadUrl(imagePath);
      if (error || !data) {
        return NextResponse.json(
          { error: "Unable to prepare partner image upload" },
          { status: 500 },
        );
      }

      return NextResponse.json({ imagePath, signedUrl: data.signedUrl });
    }

    if (action !== "complete") {
      return NextResponse.json({ error: "Invalid upload action" }, { status: 400 });
    }

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const destinationUrl =
      typeof payload.destinationUrl === "string"
        ? payload.destinationUrl.trim()
        : "";
    const imagePath =
      typeof payload.imagePath === "string" ? payload.imagePath.trim() : "";
    const fileType = typeof payload.fileType === "string" ? payload.fileType : "";
    const shape = readPresentationValue<ExclusivePerkShape>(
      payload.shape,
      ["circle", "rounded"],
      "rounded",
    );
    const fit = readPresentationValue<ExclusivePerkFit>(
      payload.fit,
      ["cover", "contain"],
      "contain",
    );
    const size = readPresentationValue<ExclusivePerkSize>(
      payload.size,
      ["standard", "large"],
      "standard",
    );

    if (!name || name.length > 80) {
      return NextResponse.json(
        { error: "Partner name is required and must be 80 characters or fewer" },
        { status: 400 },
      );
    }
    if (!validatePerkDestinationUrl(destinationUrl)) {
      return NextResponse.json(
        { error: "Enter a valid HTTP or HTTPS partner link" },
        { status: 400 },
      );
    }
    if (
      !imagePath.startsWith("partners/") ||
      imagePath.includes("..") ||
      !EXCLUSIVE_PERK_IMAGE_TYPES.includes(fileType as ExclusivePerkImageType) ||
      !imagePath.endsWith(`.${EXTENSION_BY_TYPE[fileType as ExclusivePerkImageType]}`)
    ) {
      return NextResponse.json({ error: "Invalid uploaded image" }, { status: 400 });
    }
    stagedImagePath = imagePath;

    const storage = supabase.storage.from(EXCLUSIVE_PERKS_BUCKET);
    const { data: uploadedImage, error: downloadError } =
      await storage.download(imagePath);
    if (downloadError || !uploadedImage) {
      return NextResponse.json({ error: "Uploaded image was not found" }, { status: 400 });
    }

    const bytes = new Uint8Array(await uploadedImage.arrayBuffer());
    if (
      bytes.length === 0 ||
      bytes.length > MAX_EXCLUSIVE_PERK_IMAGE_SIZE ||
      !hasValidImageSignature(bytes, fileType as ExclusivePerkImageType)
    ) {
      await storage.remove([imagePath]);
      stagedImagePath = "";
      return NextResponse.json(
        { error: "The uploaded file is not a valid image" },
        { status: 400 },
      );
    }

    const item: StoredExclusivePerk = {
      id: randomUUID(),
      name,
      destinationUrl,
      imagePath,
      shape,
      fit,
      size,
    };

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${EXCLUSIVE_PERKS_CONFIG_KEY}))`;
      const config = await tx.systemConfig.findUnique({
        where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
        select: { value: true },
      });
      const current = parseExclusivePerks(config?.value);
      if (current.length >= MAX_EXCLUSIVE_PERKS) {
        throw new Error(`Only ${MAX_EXCLUSIVE_PERKS} exclusive perks are allowed`);
      }
      const next = [...current, item];
      await tx.systemConfig.upsert({
        where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
        update: { value: JSON.stringify(next) },
        create: {
          key: EXCLUSIVE_PERKS_CONFIG_KEY,
          value: JSON.stringify(next),
          description: "Homepage exclusive perk partner images and links",
        },
      });
    });
    stagedImagePath = "";

    const { data: signedImage } = await storage.createSignedUrl(imagePath, 60 * 60);
    return NextResponse.json({
      item: {
        ...item,
        imageUrl: signedImage?.signedUrl || "",
        isLegacy: false,
      },
    });
  } catch (error) {
    if (stagedImagePath) {
      const path = stagedImagePath;
      after(async () => {
        await supabase.storage.from(EXCLUSIVE_PERKS_BUCKET).remove([path]);
      });
    }
    console.error(
      "Update exclusive perks failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.startsWith("Only ")
            ? error.message
            : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorizationError = await authorizeSuperAdmin();
    if (authorizationError) return authorizationError;

    const body: unknown = await request.json();
    const id =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).id === "string"
        ? ((body as Record<string, unknown>).id as string)
        : "";
    if (!id) {
      return NextResponse.json({ error: "Missing exclusive perk ID" }, { status: 400 });
    }

    const removed = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${EXCLUSIVE_PERKS_CONFIG_KEY}))`;
      const config = await tx.systemConfig.findUnique({
        where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
        select: { value: true },
      });
      const current = parseExclusivePerks(config?.value);
      const item = current.find((perk) => perk.id === id);
      if (!item) return null;
      const next = current.filter((perk) => perk.id !== id);
      await tx.systemConfig.upsert({
        where: { key: EXCLUSIVE_PERKS_CONFIG_KEY },
        update: { value: JSON.stringify(next) },
        create: {
          key: EXCLUSIVE_PERKS_CONFIG_KEY,
          value: JSON.stringify(next),
          description: "Homepage exclusive perk partner images and links",
        },
      });
      return item;
    });

    if (!removed) {
      return NextResponse.json({ error: "Exclusive perk not found" }, { status: 404 });
    }
    if (!isLocalPerkImagePath(removed.imagePath)) {
      after(async () => {
        const { error } = await supabase.storage
          .from(EXCLUSIVE_PERKS_BUCKET)
          .remove([removed.imagePath]);
        if (error) console.error("Exclusive perk image cleanup failed");
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Delete exclusive perk failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
