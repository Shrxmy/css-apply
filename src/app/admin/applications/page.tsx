"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import MobileSidebar from "@/components/AdminMobileSB";
import SidebarContent from "@/components/AdminSidebar";
import { committeeRolesSubmitted } from "@/data/committeeRoles";
import { roles } from "@/data/ebRoles";
import { truncateToLast7 } from "@/lib/truncate-utils";
import { LucideChevronDown, LucideChevronUp } from "lucide-react";
import { toast } from "sonner";

// Helper function to get committee full name
const getCommitteeFullName = (committeeId: string): string => {
  const committee = committeeRolesSubmitted.find((c) => c.id === committeeId);
  return committee ? committee.title : committeeId;
};

// Helper function to convert redirection value to proper committee name
const getRedirectionDisplayName = (redirection: string): string => {
  if (!redirection) return "";

  // Handle committee-{id} format (from EA to Committee Staff redirection)
  if (redirection.startsWith("committee-")) {
    const committeeId = redirection.replace("committee-", "");
    const committee = committeeRolesSubmitted.find((c) => c.id === committeeId);
    return committee ? `${committee.title} Staff` : redirection;
  }

  // Handle direct committee ID
  const committee = committeeRolesSubmitted.find((c) => c.id === redirection);
  if (committee) {
    return committee.title;
  }

  // Handle EB role
  const ebRole = roles.find((r) => r.id === redirection);
  if (ebRole) {
    return ebRole.title;
  }

  // Handle member redirection
  if (redirection === "member") {
    return "Member";
  }

  // Fallback to original value
  return redirection;
};

// Helper function to get the correct redirection message for Committee applications
const getCommitteeRedirectionMessage = (redirection: string): string => {
  if (!redirection) return "";

  // Check if redirected to EA role
  const ebRole = roles.find((r) => r.id === redirection);
  if (ebRole) {
    return "Committee Applicant Redirected to EA";
  }

  // Check if redirected to committee (from EA)
  if (redirection.startsWith("committee-")) {
    return "EA Applicant Redirected to Staff";
  }

  // Check if redirected to member
  if (redirection === "member") {
    return "Committee Applicant Redirected to Member";
  }

  // Default case (committee to committee)
  return "Committee Applicant Redirected";
};

// Helper function to get the correct redirection message for EA applications
const getEARedirectionMessage = (redirection: string): string => {
  if (!redirection) return "";

  // Check if redirected to committee
  if (redirection.startsWith("committee-")) {
    return "EA Applicant Redirected to Staff";
  }

  // Check if redirected to member
  if (redirection === "member") {
    return "EA Applicant Redirected to Member";
  }

  // Default case (EA to EA)
  return "EA Applicant Redirected";
};

// Helper function to get EB role full name
const getEBRoleFullName = (roleId: string): string => {
  if (!roleId || roleId.trim() === "") return "No choice";
  const role = roles.find((r) => r.id === roleId);
  return role ? role.title : roleId;
};

// Helper function to capitalize first letter
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

interface Application {
  id: string;
  studentNumber: string;
  user: {
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    section: string;
  };
  hasAccepted?: boolean;
  status?: string;
  redirection?: string;
  firstOptionCommittee?: string;
  secondOptionCommittee?: string;
  firstOptionEb?: string;
  secondOptionEb?: string;
  interviewSlotDay?: string;
  interviewSlotTimeStart?: string;
  interviewSlotTimeEnd?: string;
  interviewBy?: string;
  cvUrl?: string;
  cvDownloadUrl?: string;
  portfolioDownloadUrl?: string;
  createdAt: string;
  type: "committee" | "executive-associate" | "member";
  cv?: string;
  paymentProof?: string;
  isAssigned?: boolean;
}

// Cache for EB data to prevent unnecessary API calls
const ebDataCache = new Map<string, { position: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 10;

const Applications = () => {
  const { data: session, status } = useSession();
  const [applications, setApplications] = useState<{
    committee: Application[];
    ea: Application[];
    member: Application[];
  }>({ committee: [], ea: [], member: [] });
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [redirectTo, setRedirectTo] = useState("");
  const [ebData, setEbData] = useState<{ position: string } | null>(null);
  const [showCommitteeApplications, setShowCommitteeApplications] =
    useState(false);
  const [showEaApplications, setShowEaApplications] = useState(false);
  const [showMemberApplications, setShowMemberApplications] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    committee: Application[];
    ea: Application[];
    member: Application[];
  }>({
    committee: [],
    ea: [],
    member: [],
  });
  const [memberPage, setMemberPage] = useState(1);
  const [committeePage, setCommitteePage] = useState(1);
  const [eaPage, setEaPage] = useState(1);

  // Clear EB data cache
  const clearEBCache = useCallback((id: string) => {
    ebDataCache.delete(id);
    console.log(`Cleared EB cache for user ${id}`);
  }, []);

  // Memoized EB data fetching with caching
  const getEBData = useCallback(async (id: string, forceRefresh = false) => {
    // Check cache first (unless force refresh is requested)
    if (!forceRefresh) {
      const cached = ebDataCache.get(id);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setEbData(cached);
        return cached;
      }
    }

    try {
      // Add cache-busting timestamp
      const timestamp = Date.now();
      const response = await fetch(
        `/api/admin/eb-profiles/${id}?t=${timestamp}&force=${forceRefresh}`,
      );
      const data = await response.json();
      const ebProfile = data.ebProfile;

      // Cache the result
      ebDataCache.set(id, { ...ebProfile, timestamp: Date.now() });
      setEbData(ebProfile);
      console.log(
        `Fetched fresh EB data for user ${id}: position=${ebProfile?.position}`,
      );
      return ebProfile;
    } catch (error) {
      console.error("Error fetching EB data:", error);
      return null;
    }
  }, []);

  // Memoized applications fetching with caching
  const fetchApplications = useCallback(async (position: string) => {
    if (!position) return;

    try {
      setLoading(true);

      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(
        `/api/admin/applications/${position}?t=${timestamp}`,
      );
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search applications function
  const searchApplications = useCallback(
    async (query: string, position: string) => {
      if (!query.trim() || !position) {
        setSearchResults({ committee: [], ea: [], member: [] });
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const response = await fetch(
          `/api/admin/applications/search?q=${encodeURIComponent(query)}&position=${encodeURIComponent(position)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.applications);
          console.log("Search results:", data.applications);
        }
      } catch (error) {
        console.error("Error searching applications:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  // Debounce ref for search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle search input change with proper debouncing
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (ebData?.position) {
        searchTimeoutRef.current = setTimeout(() => {
          searchApplications(query, ebData.position);
        }, 300);
      }
    },
    [ebData?.position, searchApplications],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Initialize data on mount
  useEffect(() => {
    if (status === "loading") return;

    if (!isInitialized && session?.user?.dbId) {
      setIsInitialized(true);
      getEBData(session.user.dbId).then((ebProfile) => {
        if (ebProfile?.position) {
          fetchApplications(ebProfile.position);
        }
      });
    }
  }, [
    status,
    session?.user?.dbId,
    isInitialized,
    getEBData,
    fetchApplications,
  ]);

  // Memoized application action handler
  const handleApplicationAction = useCallback(
    async (
      applicationId: string,
      type: "committee" | "executive-associate" | "member",
      action: "accept" | "reject" | "redirect" | "evaluate",
    ) => {
      if (type === "member" && action === "evaluate") {
        return;
      }

      try {
        setProcessingId(applicationId);

        const body: {
          applicationId: string;
          type: string;
          action: string;
          redirection?: string;
        } = {
          applicationId,
          type,
          action,
        };

        if (action === "redirect") {
          body.redirection = redirectTo;
        }

        const response = await fetch("/api/admin/applications", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          // Only refetch if we have EB data
          if (ebData?.position) {
            await fetchApplications(ebData.position);
          }
          setShowRedirectModal(false);
          setSelectedApplication(null);
          setRedirectTo("");
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to update application");
        }
      } catch {
        toast.error("Failed to update application");
      } finally {
        setProcessingId(null);
      }
    },
    [redirectTo, ebData?.position, fetchApplications],
  );

  // Memoized status badge component
  const getStatusBadge = useCallback((application: Application) => {
    if (application.type === "member") {
      if (application.hasAccepted === true) {
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
            Accepted
          </span>
        );
      } else {
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#FFE7B4]/40 text-[#5B4515]">
            Pending
          </span>
        );
      }
    }

    if (
      (application.type === "committee" || application.type === "executive-associate") &&
      (!application.interviewSlotDay || !application.interviewSlotTimeStart)
    ) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-50 text-orange-600">
          No Schedule
        </span>
      );
    }

    if (application.redirection || application.status === "redirected") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Redirected
        </span>
      );
    } else if (application.status === "failed") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#FFE7B4]/40 text-[#5B4515]">
          Rejected
        </span>
      );
    } else if (
      application.status === "passed" ||
      (application.hasAccepted === true && application.status !== null)
    ) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Accepted
        </span>
      );
    } else if (application.status === "evaluating") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#044FAF]/10 text-[#044FAF]">
          Evaluating
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#FFE7B4]/40 text-[#5B4515]">
          Pending
        </span>
      );
    }
  }, []);

  const handleDownloadCV = async (application: Application) => {
    try {
      // Use the new download endpoint that forces download
      const downloadUrl = `/api/admin/download-pdf?applicationId=${application.id}&type=cv&applicationType=${application.type}`;

      // Create a temporary link to download the file
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${application.user.name}_CV.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading CV:", error);
      toast.error("Error downloading CV");
    }
  };

  const handleDownloadPortfolio = async (application: Application) => {
    try {
      // Use the new download endpoint that forces download
      const downloadUrl = `/api/admin/download-pdf?applicationId=${application.id}&type=portfolio&applicationType=${application.type}`;

      // Create a temporary link to download the file
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${application.user.name}_Portfolio.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading Portfolio:", error);
      toast.error("Error downloading Portfolio");
    }
  };

  const renderPaginationControls = (
    page: number,
    totalPages: number,
    onPageChange: (nextPage: number) => void,
  ) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1 text-xs text-[#134687]/80 border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-xs text-[#134687]/60 font-mono">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1 text-xs text-[#134687]/80 border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    );
  };

  const currentApplications = useMemo(
    () => (searchQuery.trim() ? searchResults : applications),
    [searchQuery, searchResults, applications],
  );

  // Memoized application counts
  const applicationCounts = useMemo(() => {
    return {
      member: currentApplications.member.length,
      committee: currentApplications.committee.length,
      ea: currentApplications.ea.length,
      total:
        currentApplications.member.length +
        currentApplications.committee.length +
        currentApplications.ea.length,
    };
  }, [currentApplications]);

  useEffect(() => {
    setMemberPage(1);
    setCommitteePage(1);
    setEaPage(1);
  }, [searchQuery, applicationCounts.member, applicationCounts.committee, applicationCounts.ea]);

  const memberTotalPages = Math.max(
    1,
    Math.ceil(currentApplications.member.length / ITEMS_PER_PAGE),
  );
  const committeeTotalPages = Math.max(
    1,
    Math.ceil(currentApplications.committee.length / ITEMS_PER_PAGE),
  );
  const eaTotalPages = Math.max(
    1,
    Math.ceil(currentApplications.ea.length / ITEMS_PER_PAGE),
  );

  const paginatedMemberApplications = useMemo(() => {
    const startIndex = (memberPage - 1) * ITEMS_PER_PAGE;
    return currentApplications.member.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentApplications.member, memberPage]);

  const paginatedCommitteeApplications = useMemo(() => {
    const startIndex = (committeePage - 1) * ITEMS_PER_PAGE;
    return currentApplications.committee.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );
  }, [currentApplications.committee, committeePage]);

  const paginatedEaApplications = useMemo(() => {
    const startIndex = (eaPage - 1) * ITEMS_PER_PAGE;
    return currentApplications.ea.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentApplications.ea, eaPage]);

  // Show loading for session only (not data fetching)
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
      {/* Sidebar Navigation */}
      <MobileSidebar>
        <SidebarContent activePage="applications" />
      </MobileSidebar>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 md:p-8 pt-16 md:pt-12 overflow-y-auto h-screen">
        {/* PAGE HEADER */}
        <div className="mb-8 mt-12 md:mt-8 text-center md:text-left">
          <div className="flex justify-between items-center mb-4">
            <div className="rounded-[45px] text-white text-lg lg:text-4xl font-poppins font-medium px-6 py-2 lg:py-4 text-center [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] w-fit">
              All Applications
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (session?.user?.id) {
                    clearEBCache(session.user.id);
                    getEBData(session.user.id, true).then((freshEbData) => {
                      if (freshEbData?.position) {
                        fetchApplications(freshEbData.position);
                      }
                    });
                  }
                }}
                className="px-4 py-2 text-sm text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  if (session?.user?.id) {
                    clearEBCache(session.user.id);
                    getEBData(session.user.id, true).then((freshEbData) => {
                      if (freshEbData?.position) {
                        fetchApplications(freshEbData.position);
                      }
                    });
                  }
                }}
                className="px-4 py-2 text-sm text-[#134687]/50 border border-[#005FD9]/10 rounded-lg hover:bg-[#F3F3FD] transition-colors"
                title="Force refresh your position data"
              >
                Refresh Position
              </button>
            </div>
          </div>
          <p className="text-black text-xs lg:text-lg font-Inter font-light leading-5 mb-2">
            Review and manage all applications from students for CSS Apply
          </p>
          {ebData?.position && (
            <p className="text-sm text-gray-600 mb-4">
              Current Position:{" "}
              <span className="font-semibold text-[#044FAF]">
                {ebData.position}
              </span>
            </p>
          )}

          {/* SEARCH BAR */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search by name, student number, or email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#044FAF] focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <div
                  className="h-4 w-4 text-gray-400 bg-current"
                  style={{
                    maskImage: "url(/icons/search.svg)",
                    WebkitMaskImage: "url(/icons/search.svg)",
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                  }}
                />
              </div>
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#044FAF]"></div>
                </div>
              )}
            </div>
            {searchQuery.trim() && (
              <p className="text-sm text-gray-600 mt-2">
                {isSearching
                  ? "Searching..."
                  : `Found ${applicationCounts.total} result(s) for "${searchQuery}"`}
              </p>
            )}
          </div>

          <hr className="border-[#005FD9]" />
        </div>

        {/* APPLICATIONS LIST */}
        <div className="bg-white rounded-xl border border-[#005FD9]/10 p-5 mb-5 min-h-[calc(100vh-180px)] md:min-h-[calc(100vh-280px)]">
          {(() => {
            const hasApplications =
              currentApplications.committee.length > 0 ||
              currentApplications.ea.length > 0 ||
              currentApplications.member.length > 0;

            if (loading) {
              return (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#044FAF]"></div>
                  <p className="mt-3 text-sm text-[#134687]/60">
                    Loading applications...
                  </p>
                </div>
              );
            }

            if (!hasApplications) {
              return (
                <div className="text-center py-12">
                  <p className="text-[#134687]/40 text-sm">
                    {searchQuery.trim()
                      ? `No applications found for "${searchQuery}"`
                      : "No applications found"}
                  </p>
                </div>
              );
            }

            return (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-[#F3F3FD] border border-[#005FD9]/10 px-4 py-2.5 rounded-lg">
                    <div className="flex gap-2 items-center">
                      <h2 className="font-semibold text-xs text-[#134687] uppercase tracking-wider font-mono">
                        Member Applications
                      </h2>
                      <span className="text-[10px] text-[#134687]/40 font-mono">
                        ({applicationCounts.member})
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setShowMemberApplications(!showMemberApplications)
                      }
                    >
                      {!showMemberApplications ? (
                        <LucideChevronUp />
                      ) : (
                        <LucideChevronDown />
                      )}
                    </button>
                  </div>

                  {showMemberApplications &&
                    paginatedMemberApplications.map((application) => (
                      <div
                        key={application.id}
                        className="border border-[#005FD9]/10 rounded-lg p-4 hover:bg-[#F3F3FD]/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-[#134687] truncate">
                                {application.user.name}
                              </h3>
                              {getStatusBadge(application)}
                            </div>
                            <div className="text-xs text-[#134687]/60 font-mono space-y-0.5">
                              <div>
                                {application.studentNumber} &middot;{" "}
                                {application.user.section} &middot;{" "}
                                {application.user.email}
                              </div>
                              <div>
                                {application.interviewSlotDay &&
                                application.interviewSlotTimeStart &&
                                application.interviewSlotTimeEnd ? (
                                  <div>
                                    <div>
                                      Interview:{" "}
                                      {new Date(
                                        application.interviewSlotDay,
                                      ).toLocaleDateString()}
                                    </div>
                                    <div>
                                      Time: {application.interviewSlotTimeStart}{" "}
                                      - {application.interviewSlotTimeEnd}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    Applied:{" "}
                                    {new Date(
                                      application.createdAt,
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                            {!application.hasAccepted && (
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() =>
                                    handleApplicationAction(
                                      application.id,
                                      "member",
                                      "accept",
                                    )
                                  }
                                  disabled={processingId === application.id}
                                  className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                                >
                                  {processingId === application.id
                                    ? "Processing..."
                                    : "Accept"}
                                </button>
                                <button
                                  onClick={() =>
                                    handleApplicationAction(
                                      application.id,
                                      "member",
                                      "reject",
                                    )
                                  }
                                  disabled={processingId === application.id}
                                  className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                                >
                                  {processingId === application.id
                                    ? "Processing..."
                                    : "Reject"}
                                </button>
                              </div>
                            )}
                            {application.hasAccepted && (
                              <div className="text-xs text-[#044FAF]/70 font-semibold text-left sm:text-right">
                                Member ID:{" "}
                                {truncateToLast7(
                                  application.user.id,
                                ).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  {showMemberApplications &&
                    renderPaginationControls(
                      memberPage,
                      memberTotalPages,
                      setMemberPage,
                    )}
                </div>

                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center bg-[#F3F3FD] border border-[#005FD9]/10 px-4 py-2.5 rounded-lg">
                    <div className="flex gap-2 items-center">
                      <h2 className="font-semibold text-xs text-[#134687] uppercase tracking-wider font-mono">
                        Committee Applications
                      </h2>
                      <span className="text-[10px] text-[#134687]/40 font-mono">
                        ({applicationCounts.committee})
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setShowCommitteeApplications(!showCommitteeApplications)
                      }
                    >
                      {!showCommitteeApplications ? (
                        <LucideChevronUp />
                      ) : (
                        <LucideChevronDown />
                      )}
                    </button>
                  </div>

                  {showCommitteeApplications &&
                    paginatedCommitteeApplications.map((application) => (
                      <div
                        key={application.id}
                        className="border border-[#005FD9]/10 rounded-lg p-4 hover:bg-[#F3F3FD]/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-[#134687] truncate">
                                {application.user.name}
                              </h3>
                              {getStatusBadge(application)}
                            </div>
                            <div className="text-xs text-[#134687]/60 font-mono space-y-0.5 mb-2">
                              <div>
                                {application.studentNumber} &middot;{" "}
                                {application.user.section} &middot;{" "}
                                {application.user.email}
                              </div>
                              {(() => {
                                if (application.redirection) {
                                  return (
                                    <>
                                      <div className="text-[#044FAF]/70 font-medium">
                                        {getCommitteeRedirectionMessage(
                                          application.redirection,
                                        )}
                                      </div>
                                      <div className="text-[#044FAF]/70 font-medium">
                                        Redirected to:{" "}
                                        {getRedirectionDisplayName(
                                          application.redirection,
                                        )}
                                      </div>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      {application.firstOptionCommittee && (
                                        <div>
                                          1st:{" "}
                                          {getCommitteeFullName(
                                            application.firstOptionCommittee,
                                          )}
                                        </div>
                                      )}
                                      {application.secondOptionCommittee && (
                                        <div>
                                          2nd:{" "}
                                          {getCommitteeFullName(
                                            application.secondOptionCommittee,
                                          )}
                                        </div>
                                      )}
                                    </>
                                  );
                                }
                              })()}
                              <div>
                                {application.interviewSlotDay &&
                                application.interviewSlotTimeStart &&
                                application.interviewSlotTimeEnd ? (
                                  <div>
                                    <div>
                                      Interview:{" "}
                                      {new Date(
                                        application.interviewSlotDay,
                                      ).toLocaleDateString()}
                                    </div>
                                    <div>
                                      Time: {application.interviewSlotTimeStart}{" "}
                                      - {application.interviewSlotTimeEnd}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    Applied:{" "}
                                    {new Date(
                                      application.createdAt,
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>

                            {application.interviewSlotDay &&
                              application.interviewSlotTimeStart && (
                                <div className="text-xs text-[#134687]/60 font-mono">
                                  <div>
                                    {application.interviewSlotDay} at{" "}
                                    {application.interviewSlotTimeStart} -{" "}
                                    {application.interviewSlotTimeEnd}
                                  </div>
                                  {application.interviewBy && (
                                    <div>
                                      Interviewer: {application.interviewBy}
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>

                          <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                            {/* Download Buttons */}
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => handleDownloadCV(application)}
                                className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] transition-all duration-200"
                              >
                                CV
                              </button>
                              {application.portfolioDownloadUrl && (
                                <button
                                  onClick={() =>
                                    handleDownloadPortfolio(application)
                                  }
                                  className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 transition-all duration-200"
                                >
                                  Portfolio
                                </button>
                              )}
                            </div>

                            {/* Join Meeting Button */}
                            {application.interviewBy ? (
                              <a
                                href={`/api/admin/eb-profiles/${application.interviewBy}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] inline-block text-center w-full sm:w-auto transition-all duration-200"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  try {
                                    const response = await fetch(
                                      `/api/admin/eb-profiles/by-position?position=${encodeURIComponent(application.interviewBy || "")}`,
                                    );
                                    const data = await response.json();
                                    if (
                                      data.success &&
                                      data.ebProfile?.meetingLink
                                    ) {
                                      window.open(
                                        data.ebProfile.meetingLink,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    } else {
                                      toast.info("Meeting link not available");
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error fetching meeting link:",
                                      error,
                                    );
                                    toast.error("Failed to get meeting link");
                                  }
                                }}
                              >
                                Join Meeting
                              </a>
                            ) : (
                              <button
                                className="px-2.5 py-1 text-xs text-[#134687]/25 rounded cursor-not-allowed w-full sm:w-auto border border-[#005FD9]/10 bg-[#F3F3FD]/50"
                                disabled
                              >
                                No Interviewer
                              </button>
                            )}

                            {/* Action Buttons */}
                            {/* Step 1: Initial evaluation - only show Evaluate button */}
                            {(!application.status ||
                              application.status === "pending") && (
                              <div className="flex gap-1 flex-wrap w-full sm:w-auto">
                                <button
                                  onClick={() =>
                                    handleApplicationAction(
                                      application.id,
                                      "committee",
                                      "evaluate",
                                    )
                                  }
                                  disabled={processingId === application.id}
                                  className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                                >
                                  {processingId === application.id
                                    ? "Processing..."
                                    : "Evaluate"}
                                </button>
                              </div>
                            )}
                            {/* Step 2: After evaluation - show Accept, Reject, Redirect buttons */}
                            {application.status === "evaluating" &&
                              !application.hasAccepted && (
                                <div className="flex gap-1 flex-wrap w-full sm:w-auto">
                                  <button
                                    onClick={() =>
                                      handleApplicationAction(
                                        application.id,
                                        "committee",
                                        "accept",
                                      )
                                    }
                                    disabled={processingId === application.id}
                                    className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleApplicationAction(
                                        application.id,
                                        "committee",
                                        "reject",
                                      )
                                    }
                                    disabled={processingId === application.id}
                                    className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowRedirectModal(true);
                                      setSelectedApplication(application);
                                    }}
                                    disabled={processingId === application.id}
                                    className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                                  >
                                    Redirect
                                  </button>
                                </div>
                              )}
                            {application.hasAccepted && (
                              <div className="text-xs text-[#044FAF]/70 font-semibold text-left sm:text-right">
                                Member ID:{" "}
                                {truncateToLast7(
                                  application.user.id,
                                ).toUpperCase()}
                                {application.redirection ? (
                                  <div className="text-blue-600">
                                    Redirected to:{" "}
                                    {getRedirectionDisplayName(
                                      application.redirection,
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[#044FAF]/70">
                                    Accepted at:{" "}
                                    {getCommitteeFullName(
                                      application.firstOptionCommittee || "",
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  {showCommitteeApplications &&
                    renderPaginationControls(
                      committeePage,
                      committeeTotalPages,
                      setCommitteePage,
                    )}
                </div>

                <div className="space-y-3 mt-4">
                  <div className="flex justify-between items-center bg-[#F3F3FD] border border-[#005FD9]/10 px-4 py-2.5 rounded-lg">
                    <div className="flex gap-2 items-center">
                      <h2 className="font-semibold text-xs text-[#134687] uppercase tracking-wider font-mono">
                        Executive Associate Applications
                      </h2>
                      <span className="text-[10px] text-[#134687]/40 font-mono">
                        ({applicationCounts.ea})
                      </span>
                    </div>
                    <button
                      onClick={() => setShowEaApplications(!showEaApplications)}
                    >
                      {!showEaApplications ? (
                        <LucideChevronUp />
                      ) : (
                        <LucideChevronDown />
                      )}
                    </button>
                  </div>

                  {showEaApplications &&
                    paginatedEaApplications.map((application) => (
                      <div
                        key={application.id}
                        className="border border-[#005FD9]/10 rounded-lg p-4 hover:bg-[#F3F3FD]/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-[#134687] truncate">
                                {application.user.name}
                              </h3>
                              {getStatusBadge(application)}
                            </div>
                            <div className="text-xs text-[#134687]/60 font-mono space-y-0.5 mb-2">
                              <div>
                                {application.studentNumber} &middot;{" "}
                                {application.user.section} &middot;{" "}
                                {application.user.email}
                              </div>
                              {(() => {
                                if (application.redirection) {
                                  return (
                                    <>
                                      <div className="text-[#044FAF]/70 font-medium">
                                        {getEARedirectionMessage(
                                          application.redirection,
                                        )}
                                      </div>
                                      <div className="text-[#044FAF]/70 font-medium">
                                        Redirected to:{" "}
                                        {getRedirectionDisplayName(
                                          application.redirection,
                                        )}
                                      </div>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      <div>
                                        1st:{" "}
                                        {capitalizeFirstLetter(
                                          application.firstOptionEb || "",
                                        )}
                                      </div>
                                      <div>
                                        2nd:{" "}
                                        {capitalizeFirstLetter(
                                          application.secondOptionEb || "",
                                        )}
                                      </div>
                                    </>
                                  );
                                }
                              })()}
                              <div>
                                {application.interviewSlotDay &&
                                application.interviewSlotTimeStart &&
                                application.interviewSlotTimeEnd ? (
                                  <div>
                                    <div>
                                      Interview:{" "}
                                      {new Date(
                                        application.interviewSlotDay,
                                      ).toLocaleDateString()}
                                    </div>
                                    <div>
                                      Time: {application.interviewSlotTimeStart}{" "}
                                      - {application.interviewSlotTimeEnd}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    Applied:{" "}
                                    {new Date(
                                      application.createdAt,
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                            {/* Download Buttons */}
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => handleDownloadCV(application)}
                                className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] transition-all duration-200"
                              >
                                CV
                              </button>
                              {application.portfolioDownloadUrl && (
                                <button
                                  onClick={() =>
                                    handleDownloadPortfolio(application)
                                  }
                                  className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 transition-all duration-200"
                                >
                                  Portfolio
                                </button>
                              )}
                            </div>

                            {/* Join Meeting Button */}
                            {application.interviewBy ? (
                              <a
                                href={`/api/admin/eb-profiles/${application.interviewBy}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] inline-block text-center w-full sm:w-auto transition-all duration-200"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  try {
                                    const response = await fetch(
                                      `/api/admin/eb-profiles/by-position?position=${encodeURIComponent(application.interviewBy || "")}`,
                                    );
                                    const data = await response.json();
                                    if (
                                      data.success &&
                                      data.ebProfile?.meetingLink
                                    ) {
                                      window.open(
                                        data.ebProfile.meetingLink,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    } else {
                                      toast.info("Meeting link not available");
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error fetching meeting link:",
                                      error,
                                    );
                                    toast.error("Failed to get meeting link");
                                  }
                                }}
                              >
                                Join Meeting
                              </a>
                            ) : (
                              <button
                                className="px-2.5 py-1 text-xs text-[#134687]/25 rounded cursor-not-allowed w-full sm:w-auto border border-[#005FD9]/10 bg-[#F3F3FD]/50"
                                disabled
                              >
                                No Interviewer
                              </button>
                            )}

                            {/* Action Buttons */}
                            {/* Step 1: Initial evaluation - only show Evaluate button */}
                            {(!application.status ||
                              application.status === "pending") && (
                              <div className="flex gap-1 flex-wrap w-full sm:w-auto">
                                <button
                                  onClick={() =>
                                    handleApplicationAction(
                                      application.id,
                                      "executive-associate",
                                      "evaluate",
                                    )
                                  }
                                  disabled={processingId === application.id}
                                  className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                                >
                                  {processingId === application.id
                                    ? "Processing..."
                                    : "Evaluate"}
                                </button>
                              </div>
                            )}
                            {/* Step 2: After evaluation - show Accept, Reject, Redirect buttons */}
                            {application.status === "evaluating" &&
                              !application.hasAccepted && (
                                <div className="flex gap-1 flex-wrap w-full sm:w-auto">
                                  <button
                                    onClick={() =>
                                      handleApplicationAction(
                                        application.id,
                                        "executive-associate",
                                        "accept",
                                      )
                                    }
                                    disabled={processingId === application.id}
                                    className="px-2.5 py-1 text-xs text-[#134687] border border-[#005FD9]/15 rounded hover:bg-[#F3F3FD] disabled:opacity-50 transition-all duration-200"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleApplicationAction(
                                        application.id,
                                        "executive-associate",
                                        "reject",
                                      )
                                    }
                                    disabled={processingId === application.id}
                                    className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowRedirectModal(true);
                                      setSelectedApplication(application);
                                    }}
                                    disabled={processingId === application.id}
                                    className="px-2.5 py-1 text-xs text-[#134687]/60 border border-[#005FD9]/10 rounded hover:bg-[#F3F3FD]/50 disabled:opacity-50 transition-all duration-200"
                                  >
                                    Redirect
                                  </button>
                                </div>
                              )}
                            {application.hasAccepted && (
                              <div className="text-xs text-[#044FAF]/70 font-semibold text-left sm:text-right">
                                Member ID:{" "}
                                {truncateToLast7(
                                  application.user.id,
                                ).toUpperCase()}
                                {application.redirection ? (
                                  <div className="text-blue-600">
                                    Redirected to:{" "}
                                    {getRedirectionDisplayName(
                                      application.redirection,
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[#044FAF]/70">
                                    Accepted at:{" "}
                                    {getEBRoleFullName(
                                      application.firstOptionEb || "",
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  {showEaApplications &&
                    renderPaginationControls(eaPage, eaTotalPages, setEaPage)}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* REDIRECT MODAL */}
      {showRedirectModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Redirect Application</h3>
            <p className="text-gray-600 mb-4">
              Redirect {selectedApplication.user.name}&apos;s application to:
            </p>
            <select
              value={redirectTo}
              onChange={(e) => setRedirectTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              <option value="">Select committee/role</option>
              {selectedApplication.type === "committee" ? (
                <>
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
                    {committeeRolesSubmitted.map((role) => (
                      <option
                        key={`committee-${role.id}`}
                        value={`committee-${role.id}`}
                      >
                        {role.title} Staff
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : selectedApplication.type === "executive-associate" ? (
                <>
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
                    {committeeRolesSubmitted.map((role) => (
                      <option
                        key={`committee-${role.id}`}
                        value={`committee-${role.id}`}
                      >
                        {role.title} Staff
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))
              )}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRedirectModal(false);
                  setSelectedApplication(null);
                  setRedirectTo("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleApplicationAction(
                    selectedApplication.id,
                    selectedApplication.type,
                    "redirect",
                  )
                }
                disabled={
                  !redirectTo || processingId === selectedApplication.id
                }
                className="flex-1 px-2.5 py-1 text-xs text-white rounded-md"
              >
                {processingId === selectedApplication.id
                  ? "Processing..."
                  : "Redirect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;
