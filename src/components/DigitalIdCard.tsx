"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Binary,
  Braces,
  Camera,
  Check,
  Code2,
  Copy,
  Cpu,
  Maximize2,
  Printer,
  QrCode,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { generateQRCodeSvg } from "@/lib/qr-generator";
import { generateBarcodeSvg } from "@/lib/barcode-generator";

export interface DigitalIdProps {
  memberId: string;
  schoolYear: string;
  roleTitle?: string;
  issueDate?: string;
  expirationDate?: string;
  user: {
    name: string;
    studentNumber?: string;
    section?: string;
    image?: string | null;
  };
  isEligible?: boolean;
  showBackPreview?: boolean;
  photoUploadEnabled?: boolean;
  onPhotoChange?: (photoUrl: string) => void;
}

export default function DigitalIdCard({
  memberId,
  schoolYear,
  roleTitle = "Official Member",
  issueDate,
  expirationDate,
  user,
  isEligible = true,
  showBackPreview = false,
  photoUploadEnabled = true,
  onPhotoChange,
}: DigitalIdProps) {
  const [photo, setPhoto] = useState<string | null>(user.image || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const formatCardDate = (value: string) => {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;

    return parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const effectiveIssueDate = issueDate
    ? formatCardDate(issueDate)
    : new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  const effectiveExpirationDate = expirationDate
    ? formatCardDate(expirationDate)
    : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isQrZoomed) setIsQrZoomed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQrZoomed]);

  // A generous quiet zone and high-contrast modules improve physical scanning.
  const qrSvg = generateQRCodeSvg(memberId, {
    color: "#0A376D",
    bgColor: "#ffffff",
    margin: 4,
  });

  const qrZoomSvg = generateQRCodeSvg(memberId, {
    color: "#0A376D",
    bgColor: "#ffffff",
    margin: 4,
  });

  const backBarcodeSvg = generateBarcodeSvg(memberId, {
    color: "#ffffff",
    height: 48,
    showText: true,
  });

  const handleCopyId = () => {
    navigator.clipboard.writeText(memberId);
    setCopied(true);
    toast.success("Member ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardPress = (event: React.MouseEvent<HTMLDivElement>) => {
    if (showBackPreview) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, label")) return;
    setIsFlipped((value) => !value);
  };

  const handlePhotoSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file (JPG, PNG, or WebP).");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image file must be under 5MB.");
        return;
      }

      setIsUploading(true);

      try {
        const reader = new FileReader();
        reader.onload = () => {
          const img = document.createElement("img");
          img.onload = async () => {
            const previousPhoto = photo;

            try {
              const canvas = document.createElement("canvas");
              const side = Math.min(img.width, img.height);
              const targetResolution = 500;
              canvas.width = targetResolution;
              canvas.height = targetResolution;

              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Could not initialize image canvas");

              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";

              const offsetX = (img.width - side) / 2;
              const offsetY = (img.height - side) / 2;

              ctx.drawImage(
                img,
                offsetX,
                offsetY,
                side,
                side,
                0,
                0,
                targetResolution,
                targetResolution,
              );

              const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
              setPhoto(croppedDataUrl);

              const response = await fetch("/api/user/digital-id/photo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photo: croppedDataUrl }),
              });
              const result = (await response.json()) as {
                image?: string;
                error?: string;
              };

              if (!response.ok || !result.image) {
                throw new Error(result.error || "Failed to save the ID photo");
              }

              setPhoto(result.image);
              localStorage.removeItem(`css_id_photo_${memberId}`);
              onPhotoChange?.(result.image);
              toast.success("1x1 ID photo updated successfully!");
            } catch (error) {
              setPhoto(previousPhoto);
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to save the ID photo.",
              );
            } finally {
              setIsUploading(false);
              event.target.value = "";
            }
          };
          img.onerror = () => {
            toast.error("Failed to read the selected photo.");
            setIsUploading(false);
            event.target.value = "";
          };
          img.src = reader.result as string;
        };
        reader.onerror = () => {
          toast.error("Failed to read the selected photo.");
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error cropping 1x1 image:", error);
        toast.error("Failed to process photo.");
        setIsUploading(false);
      }
    },
    [memberId, onPhotoChange, photo],
  );

  if (!isEligible) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F0FC] text-[#005FD9]">
          <QrCode className="h-8 w-8" />
        </div>
        <h3 className="mb-2 font-poppins text-xl font-bold text-[#134687]">
          Digital ID Locked
        </h3>
        <p className="text-sm leading-relaxed text-[#4E6580]">
          Your Digital Member ID will be available after your payment receipt is
          approved.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto flex w-full flex-col items-center gap-6 font-poppins ${
        showBackPreview ? "max-w-[780px]" : "max-w-xl"
      }`}
    >
      {photoUploadEnabled && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoSelect}
          accept="image/png,image/jpeg,image/webp,image/jpg"
          className="hidden"
        />
      )}

      <style>{`
        .digital-id-print-page {
          display: contents;
        }

        @media print {
          /* Flatten the application shell so only the two print sheets paginate. */
          body:has(#digital-id-print-layout) > *:has(#digital-id-print-layout),
          body:has(#digital-id-print-layout) > *:has(#digital-id-print-layout) *:has(#digital-id-print-layout) {
            display: contents !important;
          }

          body:has(#digital-id-print-layout) *:not(#digital-id-print-layout):not(#digital-id-print-layout *):not(:has(#digital-id-print-layout)) {
            display: none !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          #digital-id-print-layout,
          #digital-id-print-layout * {
            visibility: visible !important;
          }

          #digital-id-print-layout {
            display: block !important;
            width: 210mm !important;
            max-width: none !important;
            margin: 0 !important;
          }

          #digital-id-flip-inner {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            min-height: 0 !important;
            transform: none !important;
          }

          .digital-id-print-page {
            display: flex !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            align-items: center !important;
            justify-content: center !important;
            break-after: page;
            page-break-after: always;
          }

          .digital-id-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          #printable-digital-id,
          #printable-digital-id-back {
            position: relative !important;
            inset: auto !important;
            flex: none !important;
            width: 370px !important;
            height: 588px !important;
            min-height: 588px !important;
            max-width: none !important;
            margin: 0 !important;
            transform: scale(0.552) !important;
            transform-origin: center center !important;
            box-shadow: none !important;
            backface-visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-digital-id .screen-only {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="digital-id-print-layout"
        className="flex w-full flex-wrap items-start justify-center gap-6 [perspective:1400px]"
      >
        <div
          id="digital-id-flip-inner"
          onClick={handleCardPress}
          title={showBackPreview ? undefined : "Tap to flip the digital ID"}
          className={
            showBackPreview
              ? "contents"
              : `relative min-h-[588px] w-full max-w-[370px] cursor-pointer transition-transform duration-700 motion-reduce:transition-none [transform-style:preserve-3d] ${
                  isFlipped
                    ? "[transform:rotateY(180deg)]"
                    : "[transform:rotateY(0deg)]"
                }`
          }
        >
          <div className="digital-id-print-page">
            <div
              id="printable-digital-id"
              ref={cardRef}
              aria-hidden={!showBackPreview && isFlipped}
              inert={!showBackPreview && isFlipped ? true : undefined}
              className={`w-full max-w-[370px] overflow-hidden rounded-3xl bg-white font-poppins shadow-[0_12px_36px_rgba(4,79,175,0.14),0_2px_8px_rgba(19,70,135,0.06)] ${
                showBackPreview
                  ? "relative print-with-back"
                  : "absolute inset-0 [backface-visibility:hidden]"
              }`}
            >
              <header className="bg-gradient-to-r from-[#134687] via-[#044FAF] to-[#005FD9] px-4 py-3.5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-xs">
                      <Image
                        src="/assets/css-apply-static-images/assets/logos/Logo_CSS_Blue.webp"
                        alt="CSS Logo"
                        width={36}
                        height={36}
                        className="h-8 w-8 object-contain"
                        priority
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8.5px] font-bold uppercase leading-tight tracking-[0.08em] text-white">
                        <span>Computer Science Society</span>
                        <span className="h-3 w-px shrink-0 bg-blue-200/60" />
                        <span className="text-blue-100">UST-CSS</span>
                      </div>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-[#134687]">
                    A.Y. {schoolYear}
                  </span>
                </div>
              </header>

              <div className="flex bg-white">
                <main className="flex min-h-[516px] min-w-0 flex-1 flex-col p-4">
                  <div className="mb-3.5 border-b border-[#005FD9]/15 pb-2">
                    <span className="font-poppins text-xs font-bold uppercase tracking-wider text-[#134687]">
                      Official Member Pass
                    </span>
                  </div>

                  <section className="mb-3.5 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        photoUploadEnabled && fileInputRef.current?.click()
                      }
                      disabled={!photoUploadEnabled || isUploading}
                      className="group relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden border-2 border-[#005FD9] bg-[#F3F8FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#134687] disabled:cursor-default"
                      aria-label={
                        photo ? "Change member photo" : "Upload member photo"
                      }
                    >
                      {photo ? (
                        <Image
                          src={photo}
                          alt={`${user.name} profile photo`}
                          fill
                          sizes="112px"
                          className="object-cover object-center"
                          unoptimized
                        />
                      ) : (
                        <span className="flex flex-col items-center justify-center p-2 text-center">
                          <Camera className="mb-1 h-6 w-6 text-[#005FD9]" />
                          <span className="font-poppins text-[9px] font-bold leading-tight text-[#134687]">
                            1x1 PHOTO
                          </span>
                          <span className="mt-0.5 text-[7.5px] text-[#005FD9]">
                            Click to Upload
                          </span>
                        </span>
                      )}

                      {photoUploadEnabled && (
                        <span className="screen-only absolute inset-0 flex flex-col items-center justify-center bg-[#134687]/80 p-1 text-center text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Upload className="mb-1 h-5 w-5" />
                          <span className="font-poppins text-[8px] font-semibold uppercase tracking-tight">
                            Change Photo
                          </span>
                        </span>
                      )}
                    </button>
                  </section>

                  <section className="my-1.5 overflow-hidden rounded-xl bg-[#F8FAFF] px-4 text-center divide-y divide-[#005FD9]/10">
                    <div className="flex min-h-9 items-center justify-center py-2">
                      <span className="text-[14px] font-bold uppercase leading-snug tracking-wide text-[#134687] [overflow-wrap:anywhere]">
                        {user.name}
                      </span>
                    </div>
                    <div className="flex min-h-7 items-center justify-center py-1.5">
                      <span className="text-[10px] font-semibold leading-snug tracking-wide text-[#134687] [overflow-wrap:anywhere]">
                        {user.studentNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex min-h-7 items-center justify-center py-1.5">
                      <span className="text-[10px] font-bold uppercase leading-snug tracking-normal text-[#005FD9] [overflow-wrap:anywhere]">
                        {roleTitle}
                      </span>
                    </div>
                    <div className="flex min-h-7 items-center justify-center py-1.5">
                      <span className="text-[10px] font-semibold leading-snug tracking-wide text-[#134687] [overflow-wrap:anywhere]">
                        {user.section || "N/A"}
                      </span>
                    </div>
                    <div className="flex min-h-7 items-center justify-center py-1.5">
                      <span className="text-[10px] font-bold leading-snug tracking-wide text-[#005FD9] [overflow-wrap:anywhere]">
                        {memberId}
                      </span>
                    </div>
                  </section>

                  <section className="mt-3 flex items-center gap-3 rounded-xl bg-[#F3F8FF] p-2.5">
                    <button
                      type="button"
                      onClick={() => setIsQrZoomed(true)}
                      className="group relative flex h-[106px] w-[106px] shrink-0 items-center justify-center rounded-[10px] bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FD9]"
                      aria-label="Expand verification QR code"
                    >
                      <span
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                      <span className="screen-only absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#134687] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <Maximize2 className="h-2.5 w-2.5" />
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="font-poppins text-[12px] font-bold text-[#134687]">
                        Scan to verify
                      </p>
                      <p className="mt-1 text-[8.5px] leading-relaxed text-[#134687]/65">
                        Confirm active CSS membership.
                      </p>
                      <p className="mt-2 text-[7px] uppercase tracking-wide text-[#134687]/55">
                        Issued {effectiveIssueDate}
                      </p>
                      {effectiveExpirationDate && (
                        <p className="mt-1 text-[7px] font-bold uppercase tracking-wide text-[#005FD9]">
                          Valid through {effectiveExpirationDate}
                        </p>
                      )}
                    </div>
                  </section>
                </main>

                <aside className="flex w-7 shrink-0 items-center justify-center bg-gradient-to-b from-[#134687] via-[#044FAF] to-[#003875] py-5 text-white sm:w-8">
                  <div className="flex flex-col items-center gap-5 text-blue-100">
                    <Code2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    <Braces className="h-3.5 w-3.5" strokeWidth={1.8} />
                    <Cpu className="h-3.5 w-3.5" strokeWidth={1.8} />
                    <Binary className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </div>
                </aside>
              </div>
            </div>
          </div>

          <div className="digital-id-print-page">
            <div
              id="printable-digital-id-back"
              aria-label="Digital member ID back"
              aria-hidden={!showBackPreview && !isFlipped}
              className={`flex min-h-[588px] w-full max-w-[370px] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#082B59] via-[#0757B8] to-[#2F8EFF] shadow-[0_12px_36px_rgba(4,79,175,0.18)] ${
                showBackPreview
                  ? "relative print-back-preview"
                  : "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
              }`}
            >
              <Image
                src="/assets/css-apply-static-images/assets/logos/Logo_CSS_Blue.webp"
                alt="Computer Science Society logo"
                width={300}
                height={300}
                className="relative z-10 w-[78%] max-w-[300px] -translate-y-8 object-contain brightness-0 invert drop-shadow-[0_14px_30px_rgba(4,25,65,0.22)]"
              />
              <Image
                src="/assets/css-apply-static-images/assets/logos/csar.webp"
                alt="Csar mascot"
                width={82}
                height={82}
                className="absolute right-5 top-5 z-20 h-auto w-[82px] object-contain drop-shadow-[0_8px_14px_rgba(4,25,65,0.25)]"
              />
              <div
                className="absolute bottom-8 left-1/2 z-20 h-12 w-[230px] -translate-x-1/2"
                dangerouslySetInnerHTML={{ __html: backBarcodeSvg }}
              />
            </div>
          </div>
        </div>
      </div>

      {!showBackPreview && (
        <p className="-mt-2 text-center text-[11px] font-medium text-[#134687]/60 print:hidden">
          Tap the ID card or use the button below to view the other side.
        </p>
      )}

      {isQrZoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-dialog-title"
          onClick={() => setIsQrZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1E3B]/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-7"
          >
            <button
              type="button"
              onClick={() => setIsQrZoomed(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#E7F0FC] text-[#134687] transition-colors hover:bg-[#D9E9FF]"
              aria-label="Close QR code"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#0B63CE] px-3 py-1 text-xs font-bold text-white">
              <QrCode className="h-3.5 w-3.5" />
              <span>Member QR</span>
            </div>

            <h3
              id="qr-dialog-title"
              className="px-8 font-poppins text-lg font-bold leading-snug text-[#134687] [overflow-wrap:anywhere]"
            >
              {user.name}
            </h3>
            <p className="mb-4 mt-1 text-xs font-bold tracking-wider text-[#005FD9] [overflow-wrap:anywhere]">
              {memberId}
            </p>

            <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl bg-white p-2 shadow-[0_0_0_1px_#D9E5F2]">
              <div
                className="h-full w-full"
                dangerouslySetInnerHTML={{ __html: qrZoomSvg }}
              />
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[#536D87]">
              Scan to confirm active CSS membership for A.Y. {schoolYear}.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#134687] px-4 py-2 font-poppins text-xs font-medium text-white transition-colors hover:bg-[#0F376B]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? "Copied!" : "Copy Member ID"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQrZoomed(false)}
                className="rounded-xl bg-[#E7F0FC] px-4 py-2 font-poppins text-xs font-medium text-[#134687] transition-colors hover:bg-[#D9E9FF]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full flex-wrap items-center justify-center gap-3">
        {!showBackPreview && (
          <button
            type="button"
            aria-pressed={isFlipped}
            onClick={() => setIsFlipped((value) => !value)}
            className="flex items-center gap-2 rounded-xl bg-[#E7F0FC] px-4 py-2.5 font-poppins text-xs font-semibold text-[#134687] transition-colors hover:bg-[#D9E9FF]"
          >
            <RotateCw
              className={`h-4 w-4 text-[#005FD9] transition-transform duration-500 ${
                isFlipped ? "rotate-180" : ""
              }`}
            />
            <span>{isFlipped ? "Show Front" : "Show Back"}</span>
          </button>
        )}

        {photoUploadEnabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-xl bg-[#E7F0FC] px-4 py-2.5 font-poppins text-xs font-semibold text-[#134687] transition-colors hover:bg-[#D9E9FF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? (
              <RotateCw className="h-4 w-4 animate-spin text-[#005FD9]" />
            ) : (
              <Upload className="h-4 w-4 text-[#005FD9]" />
            )}
            <span>{photo ? "Change Photo" : "Upload Photo"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-[#134687] px-4 py-2.5 font-poppins text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0F376B]"
        >
          <Printer className="h-4 w-4" />
          <span>Print Front &amp; Back</span>
        </button>
      </div>
    </div>
  );
}
