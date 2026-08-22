"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import AdminContentLoading from "@/components/AdminContentLoading";
import AdminEmptyState from "@/components/AdminEmptyState";
import { committeeRolesSubmitted } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";
import { toast } from "sonner";

interface EA {
  id: string;
  studentNumber: string;
  user: {
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    section: string;
  };
  firstOptionEb: string;
  secondOptionEb: string;
  hasAccepted: boolean;
  status?: string;
  redirection?: string;
  interviewSlotDay?: string;
  interviewSlotTimeStart?: string;
  interviewSlotTimeEnd?: string;
  cvDownloadUrl?: string;
  createdAt: string;
}

const EAs = () => {
  const { status } = useSession();
  const [eas, setEAs] = useState<EA[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [selectedEA, setSelectedEA] = useState<EA | null>(null);
  const [redirectTo, setRedirectTo] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    | "all"
    | "accepted"
    | "pending"
    | "rejected"
    | "redirected"
    | "no-schedule"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const fetchEAs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: "executive-associate",
        page: currentPage.toString(),
        limit: "10",
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      });

      const response = await fetch(`/api/admin/applications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEAs(data.applications);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching EAs:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, currentPage]);

  useEffect(() => {
    if (status === "loading") return;
    fetchEAs();
  }, [status, fetchEAs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus]);

  const handleCSVExport = async () => {
    try {
      const response = await fetch(`/api/admin/export/csv?type=executive-associate`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const contentDisposition = response.headers.get("Content-Disposition");
        link.download = contentDisposition
          ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
          : `accepted-executive-associate-applications-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("CSV export error:", error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStatusBadge = (ea: EA) => {
    if (ea.redirection || ea.status === "redirected") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Redirected
        </span>
      );
    } else if (ea.status === "failed") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#FFE7B4]/40 text-[#5B4515]">
          Rejected
        </span>
      );
    } else if (ea.hasAccepted && ea.status !== null) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Accepted
        </span>
      );
    } else if (!ea.interviewSlotDay || !ea.interviewSlotTimeStart) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-50 text-orange-600">
          No Schedule
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#FFE7B4]/40 text-[#5B4515]">
          Pending
        </span>
      );
    }
  };

  const handleDownloadCV = async (ea: EA) => {
    try {
      const link = document.createElement("a");
      link.href = `/api/admin/download-pdf?applicationId=${ea.id}&type=cv&applicationType=executive-associate`;
      link.download = `${ea.user.name}_CV.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading CV:", error);
    }
  };

  const handleEAAction = useCallback(
    async (
      applicationId: string,
      action: "evaluate" | "accept" | "reject" | "redirect",
    ) => {
      try {
        setProcessingId(applicationId);

        const body: {
          applicationId: string;
          type: "executive-associate";
          action: "evaluate" | "accept" | "reject" | "redirect";
          redirection?: string;
        } = {
          applicationId,
          type: "executive-associate",
          action,
        };

        if (action === "redirect") {
          body.redirection = redirectTo;
        }

        const response = await fetch("/api/admin/applications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          if (action === "evaluate") toast.success("Application set to evaluating");
          if (action === "accept") toast.success("Application accepted");
          if (action === "reject") toast.success("Application rejected");
          if (action === "redirect") toast.success("Application redirected");
          setShowRedirectModal(false);
          setSelectedEA(null);
          setRedirectTo("");
          await fetchEAs();
        } else {
          const err = await response.json();
          toast.error(err.error || "Failed to update application");
        }
      } catch {
        toast.error("Failed to update application");
      } finally {
        setProcessingId(null);
      }
    },
    [fetchEAs, redirectTo],
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat">
        <AdminContentLoading description="Loading admin session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F3F3FD] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-repeat overflow-x-hidden">
      <MobileSidebar>
        <SidebarContent activePage="eas" />
      </MobileSidebar>

      <div className="flex-1 p-6 md:p-8 pt-16 md:pt-12 overflow-y-auto h-screen">
        {/* Header */}
        <div className="mb-8 mt-12 md:mt-8 text-center md:text-left">
          <div className="mb-4 w-fit max-w-full rounded-[45px] px-6 py-2 text-center text-lg font-poppins font-medium text-white [background:linear-gradient(90deg,_#2F7EE3_0%,_#0349A2_100%)] lg:py-4 lg:text-4xl">
            Executive Associates
          </div>
          <p className="text-black text-xs lg:text-lg font-Inter font-light leading-5 mb-4 md:mb-6">
            View and manage all executive associate applications and members for
            CSSApply.
          </p>
          <hr className="border-[#005FD9]" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-5 mb-5">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label className="block text-xs font-medium text-[#134687]/50 uppercase tracking-wider font-mono mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(
                    e.target.value as
                      | "all"
                      | "accepted"
                      | "pending"
                      | "rejected"
                      | "redirected"
                      | "no-schedule",
                  )
                }
                className="w-full rounded-lg border border-[#005FD9]/15 px-3 py-2 text-sm text-[#134687] focus:outline-none focus:ring-2 focus:ring-[#044FAF]/20 sm:w-auto"
              >
                <option value="all">All Applications</option>
                <option value="accepted">Accepted</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="redirected">Redirected</option>
                <option value="no-schedule">No Schedule</option>
              </select>
            </div>
            <button
              onClick={handleCSVExport}
              className="w-full rounded-lg border border-[#005FD9]/15 px-4 py-2 text-sm font-medium text-[#134687] transition-colors hover:bg-[#F3F3FD] sm:w-auto"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* EAs List */}
        <div
          className={`mb-5 min-h-[280px] rounded-xl border border-[#005FD9]/10 bg-white p-5 md:min-h-[max(280px,calc(100dvh-400px))] ${
            loading ? "flex items-center justify-center" : ""
          }`}
        >
          {loading ? (
            <AdminContentLoading description="Loading executive associate data..." />
          ) : eas.length === 0 ? (
            <AdminEmptyState
              title="No executive associate applications found"
              description="There are no Executive Associate records matching the selected status yet."
            />
          ) : (
            <div className="space-y-3">
              {eas.map((ea) => {
                const firstEB = roles.find((r) => r.id === ea.firstOptionEb);
                const secondEB = roles.find((r) => r.id === ea.secondOptionEb);
                return (
                  <div
                    key={ea.id}
                    className="border border-[#005FD9]/10 rounded-lg p-4 hover:bg-[#F3F3FD]/50 transition-colors"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-[#134687] truncate">
                            {ea.user.name}
                          </h3>
                          {getStatusBadge(ea)}
                        </div>
                        <div className="space-y-0.5 break-words text-xs text-[#134687]/60 font-mono">
                          <div>
                            {ea.studentNumber} &middot; {ea.user.section}{" "}
                            &middot; {ea.user.email}
                          </div>
                          <div>
                            {firstEB?.title} / {secondEB?.title}
                          </div>
                          {ea.interviewSlotDay && (
                            <div>
                              Interview: {ea.interviewSlotDay} at{" "}
                              {ea.interviewSlotTimeStart}
                            </div>
                          )}
                          {ea.redirection && (
                            <div>Redirected to: {ea.redirection}</div>
                          )}
                          <div>
                            Applied:{" "}
                            {new Date(ea.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full flex-col items-start gap-2 sm:ml-3 sm:w-auto sm:shrink-0 sm:items-end">
                        {ea.cvDownloadUrl && (
                          <button
                            onClick={() => handleDownloadCV(ea)}
                            className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] transition-colors"
                          >
                            CV
                          </button>
                        )}

                        {(!ea.status || ea.status === "pending") && !ea.hasAccepted && !ea.redirection && (
                          <button
                            onClick={() => handleEAAction(ea.id, "evaluate")}
                            disabled={processingId === ea.id}
                            className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                          >
                            {processingId === ea.id ? "Processing..." : "Evaluate"}
                          </button>
                        )}

                        {ea.status === "evaluating" && !ea.hasAccepted && !ea.redirection && (
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleEAAction(ea.id, "accept")}
                              disabled={processingId === ea.id}
                              className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleEAAction(ea.id, "reject")}
                              disabled={processingId === ea.id}
                              className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => {
                                setShowRedirectModal(true);
                                setSelectedEA(ea);
                              }}
                              disabled={processingId === ea.id}
                              className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                            >
                              Redirect
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {eas.length > 0 && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#005FD9]/10 bg-white p-4">
            <div className="text-xs text-[#134687]/40 font-mono">
              {(pagination.currentPage - 1) * pagination.limit + 1}&ndash;
              {Math.min(
                pagination.currentPage * pagination.limit,
                pagination.totalCount,
              )}{" "}
              / {pagination.totalCount}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className="px-2.5 py-1 text-xs font-mono border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-30 text-[#134687]"
              >
                prev
              </button>
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= pagination.totalPages - 2)
                    pageNum = pagination.totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-2.5 py-1 text-xs font-mono rounded ${currentPage === pageNum ? "bg-[#044FAF] text-white" : "border border-[#005FD9]/15 hover:bg-[#F3F3FD] text-[#134687]"}`}
                    >
                      {pageNum}
                    </button>
                  );
                },
              )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="px-2.5 py-1 text-xs font-mono border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-30 text-[#134687]"
              >
                next
              </button>
            </div>
          </div>
        )}
      </div>

      {showRedirectModal && selectedEA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#134687]/35 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#005FD9]/15 bg-white p-6 shadow-[0_20px_60px_-15px_rgba(4,79,175,0.35)]">
            <h3 className="text-lg font-semibold text-[#134687] mb-1">Redirect Application</h3>
            <p className="text-sm text-[#134687]/70 mb-4">
              Redirect {selectedEA.user.name}&apos;s application to:
            </p>
            <select
              value={redirectTo}
              onChange={(e) => setRedirectTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#005FD9]/15 bg-white text-sm text-[#134687] focus:outline-none focus:ring-2 focus:ring-[#044FAF]/20 mb-4"
            >
              <option value="">Select committee/role</option>
              <optgroup label="Member">
                <option value="member">Member</option>
              </optgroup>
              <optgroup label="Executive Associate Roles">
                {roles
                  .filter((role) => role.id !== selectedEA.firstOptionEb)
                  .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                  ))}
              </optgroup>
              <optgroup label="Committee Staff Roles">
                {committeeRolesSubmitted.map((role) => (
                  <option
                    key={`committee-${role.id}`}
                    value={`committee-${role.id}`}
                  >
                    {role.title} Staff
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRedirectModal(false);
                  setSelectedEA(null);
                  setRedirectTo("");
                }}
                className="flex-1 px-4 py-2 text-sm text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEAAction(selectedEA.id, "redirect")}
                disabled={!redirectTo || processingId === selectedEA.id}
                className="flex-1 px-4 py-2 text-sm bg-[#044FAF] text-white rounded-lg hover:bg-[#033c87] disabled:opacity-50 transition-colors"
              >
                {processingId === selectedEA.id ? "Processing..." : "Redirect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EAs;
