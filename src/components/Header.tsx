"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";

export default function Header() {
  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/", redirect: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className="flex items-center justify-between bg-white shadow-md shadow-black/40 p-5">
      <Link href="/">
        <Image
          src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS Apply.svg"
          alt="CSS Apply logo"
          width={110}
          height={190}
          sizes="(max-width: 640px) 64px, 110px"
          className="w-20 h-auto sm:w-27.5 cursor-pointer"
        />
      </Link>
      <button
        onClick={handleLogout}
        className="bg-[#134687] font-inter text-[11px] sm:text-xs text-white px-4 py-2 md:py-3 sm:px-8 rounded-sm transition-all duration-150 active:scale-95 hover:bg-[#0f3a6b]"
      >
        Log Out
      </button>
    </header>
  );
}
