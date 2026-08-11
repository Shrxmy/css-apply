import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

type StorageListItem = {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string;
  metadata?: { size?: number; mimetype?: string } | null;
};

function normalizeStoragePath(fileRef: string | null | undefined) {
  if (!fileRef) return null;
  if (!fileRef.startsWith("http")) return fileRef;

  const urlMatch = fileRef.match(
    /\/storage\/v1\/object\/(?:public|sign)\/[^\/]+\/(.+?)(?:\?|$)/,
  );

  return urlMatch?.[1] ?? null;
}

async function listAllAtPath(bucketName: string, path: string) {
  const items: StorageListItem[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(path, { limit, offset, sortBy: { column: "name", order: "asc" } });

    if (error) {
      throw new Error(
        `Failed to list storage path '${bucketName}/${path}': ${error.message}`,
      );
    }

    const page = (data ?? []) as StorageListItem[];
    items.push(...page);

    if (page.length < limit) break;
    offset += limit;
  }

  return items;
}

function isAdminRole(role: string | undefined) {
  return role === "super_admin" || role === "super-admin";
}

export async function POST(request: NextRequest) {
  try {
    const headerSecret = request.headers.get("x-cleanup-secret");
    const cleanupSecret = process.env.CLEANUP_SECRET;

    const session = await getServerSession(authOptions);
    const isAuthorizedByRole = isAdminRole(session?.user?.role);
    const isAuthorizedBySecret =
      !!cleanupSecret && !!headerSecret && headerSecret === cleanupSecret;

    if (!isAuthorizedByRole && !isAuthorizedBySecret) {
      return NextResponse.json(
        { error: "Forbidden - Super admin or valid cleanup secret required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";
    const maxAgeHours = Number(searchParams.get("maxAgeHours") ?? "24");

    if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
      return NextResponse.json(
        { error: "Invalid maxAgeHours. It must be a positive number." },
        { status: 400 },
      );
    }

    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const [eaApps, committeeApps] = await Promise.all([
      prisma.executiveAssociateApplication.findMany({
        select: {
          supabaseFilePath: true,
          cv: true,
        },
      }),
      prisma.committeeApplication.findMany({
        select: {
          supabaseFilePath: true,
          cv: true,
          portfolioLink: true,
        },
      }),
    ]);

    const referencedPaths = new Set<string>();

    for (const app of eaApps) {
      const refs = [app.supabaseFilePath, app.cv];
      for (const ref of refs) {
        const normalized = normalizeStoragePath(ref);
        if (normalized) referencedPaths.add(normalized);
      }
    }

    for (const app of committeeApps) {
      const refs = [app.supabaseFilePath, app.cv, app.portfolioLink];
      for (const ref of refs) {
        const normalized = normalizeStoragePath(ref);
        if (normalized) referencedPaths.add(normalized);
      }
    }

    const buckets = ["executive-associate-applications", "committee-applications"];
    const candidatesByBucket: Record<string, string[]> = {
      "executive-associate-applications": [],
      "committee-applications": [],
    };

    for (const bucket of buckets) {
      const studentFolders = await listAllAtPath(bucket, "applications");

      for (const folder of studentFolders) {
        if (!folder.name) continue;

        const folderPath = `applications/${folder.name}`;
        const files = await listAllAtPath(bucket, folderPath);

        for (const file of files) {
          const fullPath = `${folderPath}/${file.name}`;

          if (referencedPaths.has(fullPath)) continue;

          const timestamp =
            file.created_at ?? file.updated_at ?? file.last_accessed_at ?? "";
          const createdAt = new Date(timestamp);

          if (Number.isNaN(createdAt.getTime())) continue;
          if (createdAt > cutoff) continue;

          candidatesByBucket[bucket].push(fullPath);
        }
      }
    }

    const deletedByBucket: Record<string, string[]> = {
      "executive-associate-applications": [],
      "committee-applications": [],
    };

    if (!dryRun) {
      for (const bucket of buckets) {
        const candidates = candidatesByBucket[bucket];
        const chunkSize = 100;

        for (let i = 0; i < candidates.length; i += chunkSize) {
          const chunk = candidates.slice(i, i + chunkSize);
          const { error } = await supabase.storage.from(bucket).remove(chunk);

          if (error) {
            throw new Error(
              `Failed to delete stale files from '${bucket}': ${error.message}`,
            );
          }

          deletedByBucket[bucket].push(...chunk);
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      maxAgeHours,
      cutoffIso: cutoff.toISOString(),
      referencedPathCount: referencedPaths.size,
      candidates: {
        ea: candidatesByBucket["executive-associate-applications"].length,
        committee: candidatesByBucket["committee-applications"].length,
      },
      deleted: {
        ea: deletedByBucket["executive-associate-applications"].length,
        committee: deletedByBucket["committee-applications"].length,
      },
      details: {
        candidatePathsByBucket: candidatesByBucket,
        deletedPathsByBucket: deletedByBucket,
      },
    });
  } catch (error) {
    console.error("Cleanup staged uploads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
