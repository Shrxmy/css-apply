"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import DigitalIdCard from "@/components/DigitalIdCard";
import LoadingScreen from "@/components/LoadingScreen";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";

interface DigitalIdResponse {
  isEligible: boolean;
  memberId?: string;
  schoolYear?: string;
  roleTitle?: string;
  issueDate?: string;
  expirationDate?: string;
  reason?: string;
  user?: {
    id: string;
    name: string;
    studentNumber?: string;
    section?: string;
    image?: string | null;
  };
}

export default function AdminDigitalIdPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DigitalIdResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDigitalId = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/user/digital-id", { cache: "no-store" });
      setData((await response.json()) as DigitalIdResponse);
    } catch {
      setData({ isEligible: false, reason: "Unable to load your Digital ID." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    } else if (status === "authenticated") {
      void loadDigitalId();
    }
  }, [status]);

  if (status === "loading" || loading) {
    return <LoadingScreen message="Loading Digital ID" />;
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat">
      <MobileSidebar>
        <SidebarContent activePage="digital-id" />
      </MobileSidebar>

      <main className="min-w-0 flex-1 px-6 pb-10 pt-28 md:px-8 md:pt-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
          <div className="w-full rounded-xl border border-[#005FD9]/10 bg-[#F8FAFF] p-5">
            <div className="inline-flex rounded-full bg-[#E8F2FF] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#044FAF]">
              Admin Profile
            </div>
            <h1 className="mt-2 font-poppins text-2xl font-bold text-[#134687]">
              My CSS Digital ID
            </h1>
            <p className="mt-1 text-sm text-[#134687]/65">
              Your official CSS identity card and generated member ID.
            </p>
          </div>

          <div className="flex w-full max-w-xl items-center justify-between text-xs font-semibold text-[#044FAF]">
            <Link href="/admin" className="hover:underline">Back to Dashboard</Link>
            <button onClick={() => void loadDigitalId()} className="inline-flex items-center gap-1.5 hover:underline">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh ID
            </button>
          </div>

          {data?.isEligible && data.memberId && data.user ? (
            <DigitalIdCard
              memberId={data.memberId}
              schoolYear={data.schoolYear || "2026-2027"}
              roleTitle={data.roleTitle}
              issueDate={data.issueDate}
              expirationDate={data.expirationDate}
              user={data.user}
              isEligible
            />
          ) : (
            <div className="max-w-md rounded-3xl border border-[#005FD9]/15 bg-white p-8 text-center shadow-sm">
              <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[#8A5A00]" />
              <h2 className="font-poppins text-xl font-bold text-[#134687]">Digital ID Unavailable</h2>
              <p className="mt-3 text-sm leading-6 text-[#134687]/70">
                {data?.reason || "Your CSS Digital ID is not available yet."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
