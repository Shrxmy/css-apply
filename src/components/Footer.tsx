import React from "react";
import Image from "next/image";

function Footer() {
  return (
    <footer className="w-full py-8 px-5 md:px-20 bg-[#044FAF] text-white flex flex-col md:flex-row gap-8 md:gap-24 items-start border-b-10 border-[#287FEB]">
      <div className="flex flex-col gap-1">
        <Image
          src="/assets/css-apply-static-images/assets/logos/Logo_CSS.webp"
          alt="A descriptive alt text for your image"
          width={60}
          height={60}
        />
        <div className="font-inter text-2xl sm:text-3xl md:text-4xl font-semibold ">
          Computer Science Society
        </div>
        <div className="font-inter text-xs sm:text-sm font-thin italic mb-2">
          The mother organization of the Computer Science Department
        </div>
        <div className="font-inter text-xs sm:text-xs mb-2">
          © {new Date().getFullYear()} Computer Science Society. All rights
          reserved.
        </div>
      </div>

      <div className="flex flex-col mt-6 md:mt-10 font-inter">
        <div className="text-base sm:text-lg font-semibold mb-2">
          Partner with us:
        </div>
        <div className="flex flex-col items-start gap-1">
          <a
            href="mailto:css.cics@ust.edu.ph"
            className="flex items-center gap-2 text-sm font-light hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/icons/email.svg"
              alt="Email"
              width={24}
              height={24}
            />
            <span className="flex items-center h-6">css.cics@ust.edu.ph</span>
          </a>
          <a
            href="https://www.facebook.com/ustcss"
            className="flex items-center gap-2 text-sm font-light hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/icons/facebook.svg"
              alt="Facebook"
              width={25}
              height={25}
            />
            <span className="whitespace-nowrap flex items-center h-6">
              UST Computer Science Society
            </span>
          </a>
          <a
            href="https://www.instagram.com/ustcss"
            className="flex items-center gap-2 text-sm font-light hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/icons/instagram.svg"
              alt="Instagram"
              width={25}
              height={25}
            />
            <span className="flex items-center h-6">@ustcss</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
