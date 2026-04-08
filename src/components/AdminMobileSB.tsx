"use client";
import { useState } from "react";
import Image from "next/image";

interface MobileSidebarProps {
  children: React.ReactNode;
}

const MobileSidebar = ({ children }: MobileSidebarProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* top bar for mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white shadow-sm flex items-center justify-between px-4 py-6 z-20">
        {/* CSS logo */}
        <Image
          src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS Apply.svg"
          alt="CSS Apply Logo"
          width={100}
          height={30}
        />

        {/* hamburger menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-700 transition-transform duration-300 hover:scale-110"
        >
          {/* hamburger menu icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-7 h-7 transition-transform duration-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
      </div>

      {/* SIDEBAR */}
      <div
        className={`fixed md:static top-0 left-0 h-screen md:h-screen w-64 shadow-lg transition-transform duration-300 z-40 overflow-hidden
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{ backgroundColor: "#f6f6fe" }}
      >
        <div className="h-full flex flex-col">{children}</div>
      </div>

      {/* to have a blurred bg when hamburger menu is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-white/20 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default MobileSidebar;
