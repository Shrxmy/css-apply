import type { Metadata } from "next";
import { Inter, Raleway, Poppins } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import { UserActivityProvider } from "@/contexts/UserActivityContext";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const raleway = Raleway({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-raleway",
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: "CSSApply",
    template: "%s | CSSApply",
  },
  description:
    "CSSApply Recruitment 101 Portal - Apply for positions in the Computer Science Society. Join our team as a member, committee staff, or executive associate.",
  keywords: [
    "CSSApply",
    "Computer Science Society",
    "Recruitment",
    "Application",
    "Student Organization",
    "University",
    "UST",
  ],
  authors: [{ name: "Computer Science Society" }],
  creator: "Computer Science Society",
  publisher: "Computer Science Society",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL!),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CSSApply - Computer Science Society Recruitment Portal",
    description:
      "Apply for positions in the Computer Science Society. Join our team as a member, committee staff, or executive associate.",
    url: "/",
    siteName: "CSSApply",
    images: [
      {
        url: "/assets/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg",
        width: 1200,
        height: 630,
        alt: "CSSApply Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CSSApply - Computer Science Society Recruitment Portal",
    description:
      "Apply for positions in the Computer Science Society. Join our team as a member, committee staff, or executive associate.",
    images: [
      "/assets/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg",
    ],
    creator: "@cssociety", // Replace with actual Twitter handle if available
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/assets/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg",
    shortcut:
      "/assets/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg",
    apple:
      "/assets/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${raleway.variable} ${poppins.variable}`}
    >
      <SessionWrapper>
        <UserActivityProvider
          enableReload={false}
          idleTimeout={300000}
          reloadInterval={60000}
        >
          <body suppressHydrationWarning={true}>
            {children}
            <Toaster
              position="top-right"
              closeButton
              toastOptions={{ className: "css-apply-toast" }}
            />
          </body>
        </UserActivityProvider>
      </SessionWrapper>
    </html>
  );
}
