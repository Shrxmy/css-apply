"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const role = session?.user?.role;
  const dashboardHref =
    role === "admin" || role === "super_admin" ? "/admin" : "/user";

  const handleLogoNavigation = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    if (pathname === dashboardHref) {
      event.preventDefault();
      return;
    }

    // Keep normal browser behavior for new-tab and modified clicks.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setIsNavigating(true);
    window.requestAnimationFrame(() => router.push(dashboardHref));
  };

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/", redirect: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      {isNavigating && <LoadingScreen message="Opening your dashboard" />}
      <header className="flex h-[72px] shrink-0 items-center justify-between bg-white px-5 shadow-md shadow-black/40 sm:h-[82px]">
      <Link
        href={dashboardHref}
        onClick={handleLogoNavigation}
        aria-label="Go to your CSSApply dashboard"
        className="flex shrink-0 items-center"
      >
        <Image
          src="/assets/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg"
          alt="CSSApply logo"
          width={126}
          height={35}
          sizes="(max-width: 640px) 80px, 110px"
          priority
          className="h-[22px] w-20 sm:h-[31px] sm:w-[110px]"
        />
      </Link>
      <button
        onClick={handleLogout}
        className="h-9 cursor-pointer rounded-sm bg-[#134687] px-4 font-inter text-[11px] leading-none text-white transition-[background-color,transform] duration-150 hover:bg-[#0f3a6b] active:scale-95 sm:h-10 sm:px-8 sm:text-xs"
      >
        Log Out
      </button>
      </header>
    </>
  );
}
