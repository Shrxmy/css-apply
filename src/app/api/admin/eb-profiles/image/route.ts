import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "eb-profile-images";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

async function authorizeSuperAdmin() {
  const session = await getServerSession(authOptions);
  return session && isSuperAdmin(session.user.role);
}

function hasValidImageSignature(bytes: Uint8Array, type: AllowedImageType) {
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET_NAME);
  if (data) {
    const { error } = await supabase.storage.updateBucket(BUCKET_NAME, {
      public: false,
      allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
      fileSizeLimit: MAX_IMAGE_SIZE,
    });
    if (error) throw new Error("Unable to update EB image storage settings");
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: false,
    allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
    fileSizeLimit: MAX_IMAGE_SIZE,
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error("Unable to initialize EB image storage");
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorizeSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const profile = await prisma.eBProfile.findUnique({
      where: { userId },
      select: { imagePath: true },
    });

    if (!profile?.imagePath) {
      return NextResponse.json({ error: "EB image not configured" }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(profile.imagePath);

    if (error || !data) {
      console.error("EB image download failed");
      return NextResponse.json({ error: "EB image not found" }, { status: 404 });
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type || "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Get EB image failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorizeSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const userId = formData.get("userId");
    const file = formData.get("file");

    if (typeof userId !== "string" || !(file instanceof File)) {
      return NextResponse.json(
        { error: "User and image are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Image must be 10MB or smaller" },
        { status: 400 },
      );
    }

    const profile = await prisma.eBProfile.findUnique({
      where: { userId },
      select: { id: true, imagePath: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "EB profile not found" }, { status: 404 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, file.type as AllowedImageType)) {
      return NextResponse.json(
        { error: "The selected file is not a valid image" },
        { status: 400 },
      );
    }

    await ensureBucket();

    const extensionByType: Record<AllowedImageType, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensionByType[file.type as AllowedImageType];
    const imagePath = `profiles/${profile.id}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(imagePath, bytes, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("EB image upload failed");
      return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }

    try {
      await prisma.eBProfile.update({
        where: { userId },
        data: { imagePath },
      });
    } catch (error) {
      await supabase.storage.from(BUCKET_NAME).remove([imagePath]);
      throw error;
    }

    if (profile.imagePath && profile.imagePath !== imagePath) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([profile.imagePath]);
      if (removeError) console.error("Previous EB image cleanup failed");
    }

    return NextResponse.json({
      success: true,
      imageUrl: `/api/admin/eb-profiles/image?userId=${encodeURIComponent(userId)}&v=${encodeURIComponent(imagePath)}`,
    });
  } catch (error) {
    console.error(
      "Update EB image failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await authorizeSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const profile = await prisma.eBProfile.findUnique({
      where: { userId },
      select: { imagePath: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "EB profile not found" }, { status: 404 });
    }

    await prisma.eBProfile.update({
      where: { userId },
      data: { imagePath: null },
    });

    if (profile.imagePath) {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([profile.imagePath]);
      if (error) console.error("EB image cleanup failed");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Remove EB image failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
