"use client";

import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  card,
  cardHeader,
  pill,
  primary,
  secondary,
  tones,
} from "@/components/admin/ui";

type ScannerState = "idle" | "starting" | "scanning" | "blocked" | "error";

export default function AttendanceQrScanner({
  disabled = false,
  onScan,
}: {
  disabled?: boolean;
  onScan: (credential: string) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const disabledRef = useRef(disabled);
  const onScanRef = useRef(onScan);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [message, setMessage] = useState(
    "Camera access starts only when you press Start scanning.",
  );

  useEffect(() => {
    disabledRef.current = disabled;
    lastScanRef.current = null;
  }, [disabled]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setState("idle");
    setMessage("Camera stopped. Start it again when you are ready.");
  }, []);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    },
    [],
  );

  const startScanner = useCallback(async () => {
    if (disabled || state === "starting" || state === "scanning") return;
    if (!window.isSecureContext) {
      setState("blocked");
      setMessage("Camera scanning requires HTTPS or localhost.");
      return;
    }

    setState("starting");
    setMessage("Requesting camera permission…");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const video = videoRef.current;
      if (!video) throw new Error("VIDEO_UNAVAILABLE");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 800,
      });
      controlsRef.current = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        video,
        (result) => {
          if (!result || disabledRef.current) return;
          const value = result.getText().trim();
          const now = Date.now();
          const previous = lastScanRef.current;
          if (
            !value ||
            (previous?.value === value && now - previous.at < 2_000)
          ) {
            return;
          }
          lastScanRef.current = { value, at: now };
          void onScanRef.current(value);
        },
      );
      setState("scanning");
      setMessage(
        "Scan a CSS digital ID QR or an imported student’s UST QR. Camera frames stay on this device.",
      );
    } catch (error) {
      const permissionDenied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setState(permissionDenied ? "blocked" : "error");
      setMessage(
        permissionDenied
          ? "Camera permission was denied. Allow access or use manual lookup."
          : "The camera could not start. Check whether another app is using it.",
      );
    }
  }, [disabled, state]);

  const live = state === "scanning";
  const failed = state === "error" || state === "blocked";

  return (
    <section className={card}>
      <div className={cardHeader}>
        <h2 className="font-poppins font-semibold text-[#134687]">
          QR scanner
        </h2>
        <span className={`${pill} ${live ? tones.success : tones.neutral}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green-600" : "bg-[#134687]/35"}`}
            aria-hidden="true"
          />
          {live ? "Live" : state === "starting" ? "Starting" : "Camera off"}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[#0F2A4F]">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Live attendance QR scanner"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-white/70 shadow-[0_0_0_999px_rgba(15,42,79,0.45)]" />
          {!live && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/75">
              {state === "starting" ? (
                <LoaderCircle className="h-7 w-7 animate-spin" />
              ) : (
                <CameraOff className="h-7 w-7" aria-hidden="true" />
              )}
              <span className="text-sm font-semibold">
                {state === "starting" ? "Opening camera" : "Camera is off"}
              </span>
            </div>
          )}
        </div>

        <p
          className={`mt-3 flex items-start gap-2 text-xs leading-relaxed ${failed ? "text-red-700" : "text-[#134687]/60"}`}
          role={failed ? "alert" : undefined}
        >
          <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>

        <button
          type="button"
          onClick={live ? stopScanner : startScanner}
          disabled={(disabled && !live) || state === "starting"}
          className={`${live ? secondary : primary} mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5`}
        >
          {state === "starting" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : live ? (
            <CameraOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Camera className="h-4 w-4" aria-hidden="true" />
          )}
          {live ? "Stop camera" : "Start scanning"}
        </button>
      </div>
    </section>
  );
}
