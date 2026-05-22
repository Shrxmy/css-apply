"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import { committeeRoles, committeeRolesSubmitted } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";
import { toast } from "sonner";

const getRedirectionDisplayName = (redirection: string): string => {
  if (!redirection) return "";
  if (redirection.startsWith("committee-")) {
    const committeeId = redirection.replace("committee-", "");
    const committee = committeeRolesSubmitted.find((c) => c.id === committeeId);
    return committee ? `${committee.title} Staff` : redirection;
  }
  const committee = committeeRolesSubmitted.find((c) => c.id === redirection);
  if (committee) return committee.title;
  const ebRole = roles.find((r) => r.id === redirection);
  if (ebRole) return ebRole.title;
  if (redirection === "member") return "Member";
  return redirection;
};

const getRedirectionMessage = (redirection: string): string => {
  if (!redirection) return "";
  const ebRole = roles.find((r) => r.id === redirection);
  if (ebRole) return "Committee Applicant Redirected to EA";
  if (redirection.startsWith("committee-"))
    return "EA Applicant Redirected to Staff";
  if (redirection === "member")
    return "Committee Applicant Redirected to Member";
  return "Committee Applicant Redirected";
};

interface CommitteeStaff {
  id: string;
  studentNumber: string;
  user: {
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    section: string;
  };
  firstOptionCommittee: string;
  secondOptionCommittee: string;
  hasAccepted: boolean;
  status?: string;
  redirection?: string;
  interviewSlotDay?: string;
  interviewSlotTimeStart?: string;
  interviewSlotTimeEnd?: string;
  interviewBy?: string;
  cvDownloadUrl?: string;
  portfolioDownloadUrl?: string;
  createdAt: string;
}

const Staffs = () => {
  const { status } = useSession();
  const [staffs, setStaffs] = useState<CommitteeStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<CommitteeStaff | null>(
    null,
  );
  const [redirectTo, setRedirectTo] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "accepted" | "pending" | "rejected" | "no-schedule" | "redirected"
  >("all");
  const [selectedCommittee, setSelectedCommittee] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const fetchStaffs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: "committee",
        page: currentPage.toString(),
        limit: "10",
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedCommittee !== "all" && { committee: selectedCommittee }),
      });

      const response = await fetch(`/api/admin/applications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStaffs(data.applications);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching staffs:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedCommittee, currentPage]);

  useEffect(() => {
    if (status === "loading") return;
    fetchStaffs();
  }, [status, fetchStaffs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedCommittee]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCSVExport = async (committee?: string) => {
    try {
      const params = new URLSearchParams({ type: "committee" });
      if (committee) params.set("committee", committee);
      const response = await fetch(`/api/admin/export/csv?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const contentDisposition = response.headers.get("Content-Disposition");
        link.download = contentDisposition
          ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
          : `committee-staff-applications-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("CSV export error:", error);
    }
  };

  const getStatusBadge = (staff: CommitteeStaff) => {
    if (staff.redirection || staff.status === "redirected") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Redirected
        </span>
      );
    } else if (staff.status === "failed") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#FFE7B4]/40 text-[#5B4515]">
          Rejected
        </span>
      );
    } else if (staff.hasAccepted && staff.status !== null) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Accepted
        </span>
      );
    } else if (staff.status === "evaluating") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Evaluating
        </span>
      );
    } else if (!staff.interviewSlotDay || !staff.interviewSlotTimeStart) {
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

  const handleDownloadCV = async (staff: CommitteeStaff) => {
    try {
      const link = document.createElement("a");
      link.href = `/api/admin/download-pdf?applicationId=${staff.id}&type=cv&applicationType=committee`;
      link.download = `${staff.user.name}_CV.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading CV:", error);
    }
  };

  const handleDownloadPortfolio = async (staff: CommitteeStaff) => {
    try {
      const link = document.createElement("a");
      link.href = `/api/admin/download-pdf?applicationId=${staff.id}&type=portfolio&applicationType=committee`;
      link.download = `${staff.user.name}_Portfolio.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading Portfolio:", error);
    }
  };

  const handleStaffAction = useCallback(
    async (
      applicationId: string,
      action: "evaluate" | "accept" | "reject" | "redirect",
    ) => {
      try {
        setProcessingId(applicationId);

        const body: {
          applicationId: string;
          type: "committee";
          action: "evaluate" | "accept" | "reject" | "redirect";
          redirection?: string;
        } = {
          applicationId,
          type: "committee",
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
          setSelectedStaff(null);
          setRedirectTo("");
          await fetchStaffs();
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
    [fetchStaffs, redirectTo],
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3FD] bg-[url('https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/pictures/background.png')] bg-cover bg-repeat">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#044FAF]"></div>
          <p className="mt-4 text-[#134687]">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F3F3FD] bg-[url('https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/pictures/background.png')] bg-cover bg-repeat overflow-x-hidden">
      <MobileSidebar>
        <SidebarContent activePage="staffs" />
      </MobileSidebar>

      <div className="flex-1 p-6 md:p-8 pt-16 md:pt-12 overflow-y-auto h-screen">
        {/* Header */}
        <div className="mb-8 mt-12 md:mt-8 text-center md:text-left">
          <div className="rounded-[45px] text-white text-lg lg:text-4xl font-poppins font-medium px-6 py-2 lg:py-4 text-center [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] w-fit mb-4">
            Committee Staff
          </div>
          <p className="text-black text-xs lg:text-lg font-Inter font-light leading-5 mb-4 md:mb-6">
            View and manage all committee staff applications and members for CSS
            Apply.
          </p>
          <hr className="border-[#005FD9]" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-5 mb-5">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-[#134687]/50 uppercase tracking-wider font-mono mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as typeof selectedStatus)
                  }
                  className="px-3 py-2 border border-[#005FD9]/15 rounded-lg text-sm text-[#134687] focus:outline-none focus:ring-2 focus:ring-[#044FAF]/20"
                >
                  <option value="all">All Applications</option>
                  <option value="accepted">Accepted</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="no-schedule">No Schedule</option>
                  <option value="redirected">Redirected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#134687]/50 uppercase tracking-wider font-mono mb-1">
                  Committee
                </label>
                <select
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  className="px-3 py-2 border border-[#005FD9]/15 rounded-lg text-sm text-[#134687] focus:outline-none focus:ring-2 focus:ring-[#044FAF]/20"
                >
                  <option value="all">All Committees</option>
                  {committeeRoles.map((committee) => (
                    <option key={committee.id} value={committee.id}>
                      {committee.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCSVExport()}
                className="px-4 py-2 text-sm text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors font-medium"
              >
                Export CSV
              </button>
              {selectedCommittee !== "all" && (
                <button
                  onClick={() => handleCSVExport(selectedCommittee)}
                  className="px-4 py-2 text-sm text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors font-medium"
                >
                  Export Committee
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Staffs List */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-5 mb-5 min-h-[calc(100vh-180px)] md:min-h-[calc(100vh-280px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#044FAF]"></div>
              <p className="mt-3 text-sm text-[#134687]/60">
                Loading applications...
              </p>
            </div>
          ) : staffs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#134687]/40 text-sm">
                No committee staff applications found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {staffs.map((staff) => {
                const firstCommittee = committeeRoles.find(
                  (c) => c.id === staff.firstOptionCommittee,
                );
                const secondCommittee = committeeRolesSubmitted.find(
                  (c) => c.id === staff.secondOptionCommittee,
                );
                return (
                  <div
                    key={staff.id}
                    className="border border-[#005FD9]/10 rounded-lg p-4 hover:bg-[#F3F3FD]/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-[#134687] truncate">
                            {staff.user.name}
                          </h3>
                          {getStatusBadge(staff)}
                        </div>
                        <div className="text-xs text-[#134687]/60 font-mono space-y-0.5">
                          <div>
                            {staff.studentNumber} &middot; {staff.user.section}{" "}
                            &middot; {staff.user.email}
                          </div>
                          <div>
                            1st: {firstCommittee?.title} / 2nd:{" "}
                            {secondCommittee?.title}
                          </div>
                          {staff.interviewSlotDay && (
                            <div>
                              Interview: {staff.interviewSlotDay} at{" "}
                              {staff.interviewSlotTimeStart}
                              {staff.interviewSlotTimeEnd
                                ? ` - ${staff.interviewSlotTimeEnd}`
                                : ""}
                            </div>
                          )}
                          {staff.interviewBy && (
                            <div>Interviewer: {staff.interviewBy}</div>
                          )}
                          {staff.redirection && (
                            <div className="text-[#044FAF]/70">
                              {getRedirectionMessage(staff.redirection)}:{" "}
                              {getRedirectionDisplayName(staff.redirection)}
                            </div>
                          )}
                          <div>
                            Applied:{" "}
                            {new Date(staff.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-3 shrink-0 items-end">
                        <div className="flex gap-1">
                          {staff.cvDownloadUrl && (
                            <button
                              onClick={() => handleDownloadCV(staff)}
                              className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] transition-colors"
                            >
                              CV
                            </button>
                          )}
                          {staff.portfolioDownloadUrl && (
                            <button
                              onClick={() => handleDownloadPortfolio(staff)}
                              className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] transition-colors"
                            >
                              Portfolio
                            </button>
                          )}
                        </div>

                        {(!staff.status || staff.status === "pending") && !staff.hasAccepted && !staff.redirection && (
                          <button
                            onClick={() => handleStaffAction(staff.id, "evaluate")}
                            disabled={processingId === staff.id}
                            className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                          >
                            {processingId === staff.id ? "Processing..." : "Evaluate"}
                          </button>
                        )}

                        {staff.status === "evaluating" && !staff.hasAccepted && !staff.redirection && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStaffAction(staff.id, "accept")}
                              disabled={processingId === staff.id}
                              className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleStaffAction(staff.id, "reject")}
                              disabled={processingId === staff.id}
                              className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => {
                                setShowRedirectModal(true);
                                setSelectedStaff(staff);
                              }}
                              disabled={processingId === staff.id}
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
        {staffs.length > 0 && pagination.totalPages > 1 && (
          <div className="bg-white rounded-xl border border-[#005FD9]/10 p-4 flex items-center justify-between">
            <div className="text-xs text-[#134687]/40 font-mono">
              {(pagination.currentPage - 1) * pagination.limit + 1}&ndash;
              {Math.min(
                pagination.currentPage * pagination.limit,
                pagination.totalCount,
              )}{" "}
              / {pagination.totalCount}
            </div>
            <div className="flex gap-1">
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

      {showRedirectModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#134687]/35 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#005FD9]/15 bg-white p-6 shadow-[0_20px_60px_-15px_rgba(4,79,175,0.35)]">
            <h3 className="text-lg font-semibold text-[#134687] mb-1">Redirect Application</h3>
            <p className="text-sm text-[#134687]/70 mb-4">
              Redirect {selectedStaff.user.name}&apos;s application to:
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
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Committee Staff Roles">
                {committeeRolesSubmitted
                  .filter((role) => role.id !== selectedStaff.firstOptionCommittee)
                  .map((role) => (
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
                  setSelectedStaff(null);
                  setRedirectTo("");
                }}
                className="flex-1 px-4 py-2 text-sm text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStaffAction(selectedStaff.id, "redirect")}
                disabled={!redirectTo || processingId === selectedStaff.id}
                className="flex-1 px-4 py-2 text-sm bg-[#044FAF] text-white rounded-lg hover:bg-[#033c87] disabled:opacity-50 transition-colors"
              >
                {processingId === selectedStaff.id ? "Processing..." : "Redirect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staffs;
