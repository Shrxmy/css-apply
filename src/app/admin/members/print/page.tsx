"use client";

import { useEffect, useState } from "react";
import DigitalIdCard from "@/components/DigitalIdCard";

interface PrintableMember {
  memberId: string;
  schoolYear: string;
  roleTitle: string;
  issueDate: string;
  expirationDate: string | null;
  name: string;
  studentNumber: string;
  section: string;
  photo: string | null;
}

export default function PrintableDigitalIdsPage() {
  const [members, setMembers] = useState<PrintableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/digital-ids/export?format=print-data")
      .then(async (response) => {
        const data = (await response.json()) as {
          members?: PrintableMember[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "IDs could not be loaded");
        if (!cancelled) setMembers(data.members || []);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "IDs could not be loaded",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F3F3FD] p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-poppins text-xl font-bold text-[#134687]">
            Printable Digital IDs
          </h1>
          <p className="text-sm text-[#134687]/70">
            Each ID prints at credit-card size. Front and back are placed on
            consecutive pages for duplex printing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || members.length === 0}
          className="rounded-lg bg-[#134687] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Print / Save as PDF
        </button>
      </div>

      {loading && (
        <p className="py-12 text-center text-sm text-[#134687]/70 print:hidden">
          Preparing printable IDs…
        </p>
      )}
      {error && (
        <p className="py-12 text-center text-sm text-red-600 print:hidden">
          {error}
        </p>
      )}
      {!loading && !error && members.length === 0 && (
        <p className="py-12 text-center text-sm text-[#134687]/70 print:hidden">
          No eligible digital IDs found.
        </p>
      )}

      <div className="space-y-8 print:space-y-0">
        {members.map((member) => (
          <DigitalIdCard
            key={member.memberId}
            memberId={member.memberId}
            schoolYear={member.schoolYear}
            roleTitle={member.roleTitle}
            issueDate={member.issueDate}
            expirationDate={member.expirationDate || undefined}
            user={{
              name: member.name,
              studentNumber: member.studentNumber,
              section: member.section,
              image: member.photo,
            }}
            isEligible={true}
            showBackPreview={true}
            photoUploadEnabled={false}
          />
        ))}
      </div>
    </main>
  );
}
