"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import { truncateToLast7 } from "@/lib/truncate-utils";
import { toast } from "sonner";

interface Member {
  id: string;
  studentNumber: string;
  user: {
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    section: string;
  };
  hasAccepted: boolean | null;
  paymentProof: string;
  createdAt: string;
}

const Members = () => {
  const { status } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "accepted" | "pending" | "rejected"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: "member",
        page: currentPage.toString(),
        limit: "10",
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      });

      const response = await fetch(`/api/admin/applications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.applications);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, currentPage]);

  useEffect(() => {
    if (status === "loading") return;
    fetchMembers();
  }, [status, fetchMembers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus]);

  const handleCSVExport = async () => {
    try {
      const response = await fetch(`/api/admin/export/csv?type=member`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const contentDisposition = response.headers.get("Content-Disposition");
        link.download = contentDisposition
          ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
          : `accepted-member-applications-${new Date().toISOString().split("T")[0]}.csv`;
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

  const handleMemberAction = useCallback(
    async (applicationId: string, action: "accept" | "reject") => {
      try {
        setProcessingId(applicationId);
        const response = await fetch("/api/admin/applications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId, type: "member", action }),
        });
        if (response.ok) {
          toast.success(
            action === "accept" ? "Member accepted" : "Member rejected",
          );
          fetchMembers();
        } else {
          const err = await response.json();
          toast.error(err.error || "Failed to update member");
        }
      } catch {
        toast.error("Failed to update member");
      } finally {
        setProcessingId(null);
      }
    },
    [fetchMembers],
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
        <SidebarContent activePage="members" />
      </MobileSidebar>

      <div className="flex-1 p-6 md:p-8 pt-16 md:pt-12 overflow-y-auto h-screen">
        {/* Header */}
        <div className="mb-8 mt-12 md:mt-8 text-center md:text-left">
          <div className="rounded-[45px] text-white text-lg lg:text-4xl font-poppins font-medium px-6 py-2 lg:py-4 text-center [background:linear-gradient(90deg,_#2F7EE3_0%,_#0349A2_100%)] w-fit mb-4">
            Members
          </div>
          <p className="text-black text-xs lg:text-lg font-Inter font-light leading-5 mb-4 md:mb-6">
            View and manage all members of CSS Apply in one place.
          </p>
          <hr className="border-[#005FD9]" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-5 mb-5">
          <div className="flex flex-wrap gap-4 items-center justify-between">
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
                      | "rejected",
                  )
                }
                className="px-3 py-2 border border-[#005FD9]/15 rounded-lg text-sm text-[#134687] focus:outline-none focus:ring-2 focus:ring-[#044FAF]/20"
              >
                <option value="all">All Members</option>
                <option value="accepted">Accepted</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <button
              onClick={handleCSVExport}
              className="px-4 py-2 text-sm text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors font-medium"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-5 mb-5 min-h-[calc(100vh-180px)] md:min-h-[calc(100vh-280px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#044FAF]"></div>
              <p className="mt-3 text-sm text-[#134687]/60">
                Loading members...
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#134687]/40 text-sm">No members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="border border-[#005FD9]/10 rounded-lg p-4 hover:bg-[#F3F3FD]/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-[#134687] truncate">
                          {member.user.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            member.hasAccepted === true
                              ? "bg-[#044FAF]/10 text-[#044FAF]"
                              : "bg-[#FFE7B4]/40 text-[#5B4515]"
                          }`}
                        >
                          {member.hasAccepted === true ? "Accepted" : "Pending"}
                        </span>
                      </div>
                      <div className="text-xs text-[#134687]/60 font-mono space-y-0.5">
                        <div>
                          {member.studentNumber} &middot; {member.user.section}{" "}
                          &middot; {member.user.email}
                        </div>
                        {member.hasAccepted && (
                          <div className="text-[#044FAF]/70">
                            ID: {truncateToLast7(member.user.id).toUpperCase()}
                          </div>
                        )}
                        <div>
                          Applied:{" "}
                          {new Date(member.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start ml-3 flex-shrink-0">
                      {member.hasAccepted !== true && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() =>
                              handleMemberAction(member.id, "accept")
                            }
                            disabled={processingId === member.id}
                            className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-colors"
                          >
                            {processingId === member.id ? "..." : "Accept"}
                          </button>
                          <button
                            onClick={() =>
                              handleMemberAction(member.id, "reject")
                            }
                            disabled={processingId === member.id}
                            className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-colors"
                          >
                            {processingId === member.id ? "..." : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {members.length > 0 && pagination.totalPages > 1 && (
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
    </div>
  );
};

export default Members;
