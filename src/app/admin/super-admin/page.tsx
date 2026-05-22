"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import useSWR from "swr";
import { roles as ebRoles } from "@/data/ebRoles";
import { truncateToLast7 } from "@/lib/truncate-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: string;
  studentNumber?: string;
  section?: string;
  createdAt: string;
  ebProfile?: {
    position: string;
    committees: string[];
    isActive: boolean;
    meetingLink?: string;
  };
}

interface EBProfileForm {
  userId: string;
  position: string;
  committees: string[];
  isActive: boolean;
  meetingLink: string;
}

interface PendingChange {
  userId: string;
  oldRole: string;
  newRole: string;
}

interface RecruitmentCycleForm {
  id?: string;
  schoolYear: string;
  applicationStart: string;
  interviewStart: string;
  interviewEnd: string;
  isActive: boolean;
}

interface RecruitmentCycle {
  id: string;
  schoolYear: string;
  applicationStart: string;
  interviewStart: string;
  interviewEnd: string;
  isActive: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EB_POSITIONS = [
  "President",
  "Internal Vice President",
  "External Vice President",
  "Secretary",
  "Assistant Secretary",
  "Treasurer",
  "Auditor",
  "Public Relations Officer (PRO)",
  "4th Year Representative",
  "3rd Year Representative",
  "2nd Year Representative",
  "1st Year Representative",
  "Chief of Staff",
  "Director for Digital Productions",
  "Director for Community Development",
  "Thomasian Wellness Advocate (TWA)",
] as const;

const EB_COMMITTEES = [
  "academics",
  "community development",
  "creatives and technical",
  "documentation",
  "external affairs",
  "finance",
  "logistics",
  "publicity",
  "sports and talent",
  "technology development",
] as const;

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const swrFetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Components ──────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-[#005FD9]/10">
      <p className="text-[10px] font-medium text-[#134687]/50 uppercase tracking-widest font-mono">
        {label}
      </p>
      <p className="text-2xl font-bold text-[#044FAF] font-mono mt-1">
        {value}
      </p>
    </div>
  );
}

/** Clickable role badge that opens an inline dropdown (rendered via portal) */
function RoleDropdown({
  role,
  pendingRole,
  onChange,
}: {
  role: string;
  pendingRole: string | null;
  onChange: (newRole: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const display = pendingRole || role;

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const color: Record<string, string> = {
    super_admin: "bg-[#044FAF] text-white",
    admin: "bg-[#134687] text-white",
    eb: "bg-[#2F7EE3] text-white",
    user: "bg-[#E8F2FF] text-[#134687]",
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-colors ${color[display] ?? color.user} ${pendingRole ? "ring-2 ring-[#FFBC2B]" : ""}`}
      >
        {display.replace("_", " ")}
        <div
          className="w-3 h-3 opacity-60 bg-current"
          style={{
            maskImage: "url(/icons/chevron-down.svg)",
            WebkitMaskImage: "url(/icons/chevron-down.svg)",
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
          }}
        />
      </button>
      {open &&
        createPortal(
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-9999g-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-30"
          >
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#F3F3FD] transition-colors ${display === opt.value ? "text-[#044FAF] font-semibold bg-[#F3F3FD]" : "text-gray-700"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded bg-[#E8F2FF] text-[#134687] border border-[#005FD9]/15">
      {children}
    </span>
  );
}

function UserAvatar({
  name,
  image,
  size,
}: {
  name: string;
  image?: string | null;
  size: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  if (image) {
    return (
      <Image
        src={image}
        alt={`${name} profile picture`}
        width={size === "sm" ? 32 : 36}
        height={size === "sm" ? 32 : 36}
        className={`${sizeClass} rounded-full object-cover shrink-0 border border-[#005FD9]/15`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full [background:linear-gradient(135deg,#044FAF,#134687)] flex items-center justify-center text-white font-bold shrink-0 font-mono`}
    >
      {name[0]?.toUpperCase() || "U"}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = "users" | "settings";

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const { data: session, status } = useSession();
  const router = useRouter();
  const sessionImage = (session?.user as { image?: string } | undefined)?.image;

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (session?.user?.role !== "super_admin") {
      router.push("/admin");
      return;
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3FD]">
        <div className="animate-spin h-8 w-8 border-2 border-[#044FAF] border-t-transparent rounded-full" />
    </div>
  );
}

// ─── Email Test Tab ───────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  { value: "member_application", label: "Member Application Received" },
  { value: "committee_application", label: "Committee Staff Application Received" },
  { value: "executive_associate_application", label: "Executive Associate Application Received" },
  { value: "member_accepted", label: "Member Accepted" },
  { value: "committee_accepted", label: "Committee Staff Accepted" },
  { value: "executive_associate_accepted", label: "Executive Associate Accepted" },
  { value: "committee_rejected", label: "Committee Staff Rejected" },
  { value: "executive_associate_rejected", label: "Executive Associate Rejected" },
  { value: "committee_redirected", label: "Committee Staff Redirected" },
  { value: "member_id_released", label: "Member ID Released" },
  { value: "payment_reminder", label: "Payment Reminder" },
  { value: "css_group_join", label: "CSS Group Join Invitation" },
];

function EmailTestTab() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { data: session } = useSession();

  const handleSendTest = async (templateType: string) => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateType }),
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        message: data.message || data.error || "Unknown error",
      });
    } catch {
      setResult({ success: false, message: "Network error" });
    } finally {
      setSending(false);
    }
  };

  const recipientEmail = session?.user?.email || "your email";

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#005FD9]/10 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg [background:linear-gradient(135deg,#044FAF,#134687)] flex items-center justify-center">
            <div
              className="w-5 h-5 text-white bg-current"
              style={{
                maskImage: "url(/icons/mail.svg)",
                WebkitMaskImage: "url(/icons/mail.svg)",
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#134687] font-poppins">
              Test Email Sending
            </h2>
            <p className="text-xs text-[#134687]/50 font-mono">
              Send test emails to your registered email: {recipientEmail}
            </p>
          </div>
        </div>

        {result && (
          <div className={`mb-4 p-3 rounded-lg border ${
            result.success
              ? "bg-[#E8F2FF]/50 border-[#044FAF]/20"
              : "bg-red-50 border-red-200"
          }`}>
            <p className={`text-sm ${result.success ? "text-[#044FAF]" : "text-red-600"}`}>
              {result.message}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {EMAIL_TEMPLATES.map((template) => (
            <button
              key={template.value}
              onClick={() => handleSendTest(template.value)}
              disabled={sending}
              className="flex items-center gap-3 p-4 border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors text-left disabled:opacity-50"
            >
              <div className="h-8 w-8 rounded-md [background:linear-gradient(135deg,#2F7EE3,#0349A2)] flex items-center justify-center shrink-0">
                <div
                  className="w-4 h-4 text-white bg-current"
                  style={{
                    maskImage: "url(/icons/send.svg)",
                    WebkitMaskImage: "url(/icons/send.svg)",
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                  }}
                />
              </div>
              <span className="text-sm text-[#134687] font-medium">
                {template.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#E8F2FF]/50 border border-[#005FD9]/10 rounded-xl p-5">
        <div className="text-xs font-mono text-[#134687]/60 space-y-1">
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"all test emails are sent to your registered email address"}
          </p>
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"templates use placeholder data to simulate real emails"}
          </p>
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"check your inbox to verify email delivery and design"}
          </p>
        </div>
      </div>
    </div>
  );
}
  if (status === "unauthenticated" || session?.user?.role !== "super_admin")
    return null;

  return (
    <div className="min-h-screen bg-[#F3F3FD] bg-[url('https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/pictures/background.png')] bg-cover bg-fixed">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-[#005FD9]/10 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="rounded-[45px] text-white text-lg lg:text-2xl font-poppins font-medium px-6 py-2 text-center [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] w-fit">
              Super Admin
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin")}
                className="text-sm text-[#134687] hover:text-[#044FAF] font-medium font-Inter"
              >
                &#8592; Admin
              </button>
              {sessionImage ? (
                <Image
                  src={sessionImage}
                  alt="Admin profile picture"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover border border-[#005FD9]/15"
                />
              ) : (
                <div className="h-8 w-8 rounded-full [background:linear-gradient(135deg,#044FAF,#134687)] flex items-center justify-center text-white text-xs font-bold">
                  {session.user?.name?.[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px">
            {[
              { key: "users" as Tab, label: "user_db" },
              { key: "settings" as Tab, label: "config" },
              { key: "email" as Tab, label: "email_test" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-mono rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#044FAF] text-[#044FAF] bg-[#F3F3FD]"
                    : "border-transparent text-[#134687]/40 hover:text-[#134687]/70 hover:bg-[#F3F3FD]/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "users" ? <UsersTab /> : activeTab === "settings" ? <SettingsTab /> : <EmailTestTab />}
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEbMembers: 0,
    totalAdmins: 0,
    totalApplicants: 0,
  });
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEbForm, setShowEbForm] = useState(false);
  const [ebForm, setEbForm] = useState<EBProfileForm>({
    userId: "",
    position: "",
    committees: [],
    isActive: true,
    meetingLink: "",
  });

  const fetchUsers = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/all?page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
        if (data.stats) setStats(data.stats);
      }
    } catch (_err) {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const handleSearch = useCallback((query: string) => {
    setSearchTerm(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setIsGlobalSearch(false);
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users);
          setIsGlobalSearch(true);
        }
      } catch {
        /* empty */
      }
    }, 300);
  }, []);

  useEffect(() => {
    fetchUsers(currentPage);
  }, [fetchUsers, currentPage]);

  useEffect(() => {
    const source = isGlobalSearch ? searchResults : users;
    const filtered = source.filter(
      (u) =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.studentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.ebProfile?.position?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users, searchResults, isGlobalSearch]);

  const handleMakeEb = (user: User) => {
    setSelectedUser(user);
    setEbForm({
      userId: user.id,
      position: user.ebProfile?.position || "",
      committees: user.ebProfile?.committees || [],
      isActive: user.ebProfile?.isActive ?? true,
      meetingLink: user.ebProfile?.meetingLink || "",
    });
    setShowEbForm(true);
  };

  const handleSubmitEbProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/eb-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ebForm),
      });
      if (res.ok) {
        toast.success("EB profile saved");
        setShowEbForm(false);
        setSelectedUser(null);
        fetchUsers(currentPage);
      } else toast.error("Failed to save");
    } catch {
      toast.error("Error saving EB profile");
    }
  };

  const handleRemoveEb = async (userId: string) => {
    if (!confirm("Remove EB privileges?")) return;
    try {
      const res = await fetch("/api/admin/eb-profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        toast.success("Removed");
        fetchUsers(currentPage);
      } else toast.error("Failed to remove");
    } catch {
      toast.error("Error removing EB");
    }
  };

  const handleRoleChange = (
    userId: string,
    oldRole: string,
    newRole: string,
  ) => {
    const existing = pendingChanges.findIndex((c) => c.userId === userId);
    if (existing >= 0) {
      const updated = [...pendingChanges];
      updated[existing] = { userId, oldRole, newRole };
      setPendingChanges(updated);
    } else {
      setPendingChanges([...pendingChanges, { userId, oldRole, newRole }]);
    }
    setShowConfirmDialog(true);
  };

  const confirmRoleChanges = async () => {
    try {
      await Promise.all(
        pendingChanges.map((c) =>
          fetch("/api/admin/users/role", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: c.userId, role: c.newRole }),
          }),
        ),
      );
      toast.success("Roles updated");
      fetchUsers(currentPage);
      setPendingChanges([]);
      setShowConfirmDialog(false);
    } catch {
      toast.error("Failed to update roles");
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="users" value={stats.totalUsers} />
        <StatCard label="eb" value={stats.totalEbMembers} />
        <StatCard label="admins" value={stats.totalAdmins} />
        <StatCard label="applicants" value={stats.totalApplicants} />
      </div>

      {/* Pending changes */}
      {pendingChanges.length > 0 && (
        <div className="flex items-center gap-3 bg-[#FFE7B4]/40 border border-[#FFBC2B]/30 rounded-lg px-4 py-2.5">
          <span className="text-xs text-[#5B4515] font-mono flex-1">
            {pendingChanges.length} pending role change(s)
          </span>
          <button
            onClick={confirmRoleChanges}
            className="text-xs font-medium text-white bg-[#044FAF] rounded-md px-3 py-1.5 hover:bg-[#0349A2] transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setPendingChanges([]);
              setShowConfirmDialog(false);
            }}
            className="text-xs font-medium text-[#134687] bg-white border border-[#005FD9]/20 rounded-md px-3 py-1.5 hover:bg-[#F3F3FD] transition-colors"
          >
            Discard
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="search users..."
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-4 py-2.5 text-sm font-mono text-[#134687] placeholder-[#134687]/30 bg-white border border-[#005FD9]/15 rounded-lg focus:ring-2 focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40 outline-none"
      />

      {/* Users table */}
      <div className="bg-white border border-[#005FD9]/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-[#044FAF] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F3F3FD] border-b border-[#005FD9]/10">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
                  User
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
                  Member ID
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
                  Position
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
                  Committees
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#005FD9]/5">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-[#F3F3FD]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={user.name} image={user.image} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-[#134687] truncate">
                          {user.name}
                        </p>
                        <p className="text-[11px] text-[#134687]/40 truncate font-mono">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleDropdown
                      role={user.role}
                      pendingRole={
                        pendingChanges.find((c) => c.userId === user.id)
                          ?.newRole ?? null
                      }
                      onChange={(newRole) =>
                        handleRoleChange(user.id, user.role, newRole)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-[#044FAF] font-mono">
                      {truncateToLast7(user.id).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.ebProfile?.position ? (
                      <Tag>{user.ebProfile.position}</Tag>
                    ) : (
                      <span className="text-[11px] text-[#134687]/25">
                        &mdash;
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.ebProfile?.committees.length ? (
                      <div className="flex flex-wrap gap-1">
                        {user.ebProfile.committees.slice(0, 2).map((c) => (
                          <Tag key={c}>{c}</Tag>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#134687]/25">
                        &mdash;
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleMakeEb(user)}
                      className="text-xs text-[#044FAF] font-medium px-2 py-1 rounded hover:bg-[#F3F3FD] transition-colors"
                    >
                      {user.ebProfile ? "edit eb" : "assign eb"}
                    </button>
                    {user.ebProfile && (
                      <button
                        onClick={() => handleRemoveEb(user.id)}
                        className="text-xs text-[#134687]/40 hover:text-red-500 font-medium px-2 py-1 rounded transition-colors"
                      >
                        remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-[#005FD9]/5">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={user.name} image={user.image} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium text-[#134687] truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-[#134687]/40 truncate font-mono">
                      {user.email}
                    </p>
                  </div>
                </div>
                <RoleDropdown
                  role={user.role}
                  pendingRole={
                    pendingChanges.find((c) => c.userId === user.id)?.newRole ??
                    null
                  }
                  onChange={(newRole) =>
                    handleRoleChange(user.id, user.role, newRole)
                  }
                />
              </div>
              <p className="text-[11px] font-mono text-[#044FAF]">
                Member ID: {truncateToLast7(user.id).toUpperCase()}
              </p>
              {(user.ebProfile?.position ||
                user.ebProfile?.committees.length) && (
                <div className="flex flex-wrap gap-1.5">
                  {user.ebProfile?.position && (
                    <Tag>{user.ebProfile.position}</Tag>
                  )}
                  {user.ebProfile?.committees.map((c) => (
                    <Tag key={c}>{c}</Tag>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMakeEb(user)}
                  className="text-xs text-[#044FAF] font-medium px-3 py-1.5 border border-[#005FD9]/15 rounded-md hover:bg-[#F3F3FD] transition-colors"
                >
                  {user.ebProfile ? "edit eb" : "assign eb"}
                </button>
                {user.ebProfile && (
                  <button
                    onClick={() => handleRemoveEb(user.id)}
                    className="text-xs text-[#134687]/40 hover:text-red-500 font-medium px-3 py-1.5 border border-[#005FD9]/10 rounded-md transition-colors"
                  >
                    remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && !isGlobalSearch && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#005FD9]/10 bg-[#F3F3FD]/50">
            <p className="text-[11px] text-[#134687]/40 font-mono">
              {(currentPage - 1) * pagination.limit + 1}&ndash;
              {Math.min(currentPage * pagination.limit, pagination.totalCount)}{" "}
              / {pagination.totalCount}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPreviousPage}
                className="px-2 py-1 text-[11px] font-mono text-[#134687] border border-[#005FD9]/15 rounded hover:bg-white disabled:opacity-30"
              >
                prev
              </button>
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  let page: number;
                  if (pagination.totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= pagination.totalPages - 2)
                    page = pagination.totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-2 py-1 text-[11px] font-mono rounded ${currentPage === page ? "bg-[#044FAF] text-white" : "text-[#134687] border border-[#005FD9]/15 hover:bg-white"}`}
                    >
                      {page}
                    </button>
                  );
                },
              )}
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                className="px-2 py-1 text-[11px] font-mono text-[#134687] border border-[#005FD9]/15 rounded hover:bg-white disabled:opacity-30"
              >
                next
              </button>
            </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* EB Form Modal */}
      {showEbForm && selectedUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#005FD9]/10">
            <h2 className="text-lg font-bold text-[#134687] font-poppins mb-1">
              {selectedUser.ebProfile ? "edit" : "assign"} eb profile
            </h2>
            <p className="text-sm text-[#134687]/50 mb-5 font-mono">
              {selectedUser.name}
            </p>
            <form onSubmit={handleSubmitEbProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
                  Position *
                </label>
                <select
                  required
                  value={ebForm.position}
                  onChange={(e) =>
                    setEbForm({ ...ebForm, position: e.target.value })
                  }
                  className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
                >
                  <option value="">Select</option>
                  {EB_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
                  Committees *
                </label>
                <div className="max-h-32 overflow-y-auto border border-[#005FD9]/15 rounded-lg p-2 space-y-1 bg-[#F3F3FD]/50">
                  {EB_COMMITTEES.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={ebForm.committees.includes(c)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...ebForm.committees, c]
                            : ebForm.committees.filter((x) => x !== c);
                          setEbForm({ ...ebForm, committees: updated });
                        }}
                        className="rounded border-[#005FD9]/20 text-[#044FAF] focus:ring-[#044FAF]/30"
                      />
                      <span className="text-[#134687] text-xs">{c}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-[#134687]/30 font-mono mt-1">
                  {ebForm.committees.length} selected
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
                  Meeting Link
                </label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={ebForm.meetingLink}
                  onChange={(e) =>
                    setEbForm({ ...ebForm, meetingLink: e.target.value })
                  }
                  className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm font-mono focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={ebForm.isActive}
                  onChange={(e) =>
                    setEbForm({ ...ebForm, isActive: e.target.checked })
                  }
                  className="rounded border-[#005FD9]/20 text-[#044FAF] focus:ring-[#044FAF]/30"
                />
                <span className="text-[#134687] text-xs">active</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!ebForm.position || ebForm.committees.length === 0}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {selectedUser.ebProfile ? "update" : "create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEbForm(false)}
                  className="px-4 py-2 text-sm font-medium text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors"
                >
                  cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Role Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-[#005FD9]/10">
            <h3 className="text-lg font-bold text-[#134687] font-poppins mb-3">
              Confirm Changes
            </h3>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {pendingChanges.map((c) => {
                const user = users.find((u) => u.id === c.userId);
                return (
                  <div
                    key={c.userId}
                    className="flex items-center justify-between text-sm bg-[#F3F3FD] rounded-lg px-3 py-2"
                  >
                    <span className="font-medium text-[#134687] truncate mr-2">
                      {user?.name}
                    </span>
                    <span className="text-[11px] text-[#134687]/50 font-mono shrink-0">
                      {c.oldRole.replace("_", " ")} &rarr;{" "}
                      {c.newRole.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmRoleChanges}
                className="flex-1 px-4 py-2 text-sm font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] rounded-lg hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setPendingChanges([]);
                  setShowConfirmDialog(false);
                }}
                className="px-4 py-2 text-sm font-medium text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab() {
  const {
    data: cycleData,
    isLoading,
    mutate,
  } = useSWR<{
    cycles: RecruitmentCycle[];
    activeCycle: RecruitmentCycle | null;
  }>("/api/admin/recruitment-cycle", swrFetcher, { revalidateOnFocus: false });
  const allCycles = cycleData?.cycles ?? [];

  const emptyForm: RecruitmentCycleForm = {
    schoolYear: "",
    applicationStart: "",
    interviewStart: "",
    interviewEnd: "",
    isActive: true,
  };
  const [form, setForm] = useState<RecruitmentCycleForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    data: availabilityData,
    isLoading: isAvailabilityLoading,
    mutate: mutateAvailability,
  } = useSWR<{ availability: Record<string, boolean> }>(
    "/api/admin/available-executive-associate-roles",
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [selectedPaymentQr, setSelectedPaymentQr] = useState<File | null>(null);
  const [savingPaymentQr, setSavingPaymentQr] = useState(false);
  const [selectedReceiptTemplate, setSelectedReceiptTemplate] = useState<File | null>(null);
  const [savingReceiptTemplate, setSavingReceiptTemplate] = useState(false);
  const [communityForm, setCommunityForm] = useState({
    enabled: true,
    url: "",
    label: "",
  });
  const [savingCommunity, setSavingCommunity] = useState(false);
  const {
    data: paymentQrData,
    isLoading: isPaymentQrLoading,
    mutate: mutatePaymentQr,
  } = useSWR<{ url: string }>("/api/admin/payment-qr", swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: receiptTemplateData, mutate: mutateReceiptTemplate } = useSWR<{ url: string }>(
    "/api/admin/payment-receipt-template",
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const { data: communityData, mutate: mutateCommunity } = useSWR<{
    enabled: boolean;
    url: string;
    label: string;
  }>("/api/admin/community-link", swrFetcher, { revalidateOnFocus: false });

  useEffect(() => {
    if (!communityData) return;
    setCommunityForm({
      enabled: communityData.enabled !== false,
      url: communityData.url,
      label: communityData.label,
    });
  }, [communityData]);

  const availability = availabilityData?.availability ?? Object.fromEntries(
    ebRoles.map((role) => [role.id, true]),
  );

  const handleReceiptTemplateUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReceiptTemplate) {
      toast.error("Please select a receipt PDF");
      return;
    }

    setSavingReceiptTemplate(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", selectedReceiptTemplate);
      const res = await fetch("/api/admin/payment-receipt-template", {
        method: "POST",
        body: uploadFormData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload receipt template");

      toast.success("Receipt template updated");
      setSelectedReceiptTemplate(null);
      mutateReceiptTemplate({ url: data.url }, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload receipt template");
    } finally {
      setSavingReceiptTemplate(false);
    }
  };

  const handleCommunitySave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCommunity(true);

    try {
      const res = await fetch("/api/admin/community-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(communityForm),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to save community link");

      toast.success("Community link updated");
      mutateCommunity(data, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save community link");
    } finally {
      setSavingCommunity(false);
    }
  };

  const handlePaymentQrUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPaymentQr) {
      toast.error("Please select a QR image");
      return;
    }

    setSavingPaymentQr(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", selectedPaymentQr);

      const res = await fetch("/api/admin/payment-qr", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload payment QR");
      }

      toast.success("Payment QR updated");
      setSelectedPaymentQr(null);
      mutatePaymentQr({ url: data.url }, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload payment QR");
    } finally {
      setSavingPaymentQr(false);
    }
  };

  const handleToggleAvailability = async (roleId: string, enabled: boolean) => {
    const nextAvailability = { ...availability, [roleId]: enabled };
    mutateAvailability({ availability: nextAvailability }, false);
    setSavingAvailability(true);

    try {
      const res = await fetch("/api/admin/available-executive-associate-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: nextAvailability }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update availability");
      }

      toast.success("Executive Associate role availability updated");
      mutateAvailability();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update availability");
      mutateAvailability();
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleNew = () => {
    setForm({ ...emptyForm, isActive: allCycles.length === 0 });
    setEditingId(null);
  };
  const handleEdit = (cycle: RecruitmentCycle) => {
    setForm({
      id: cycle.id,
      schoolYear: cycle.schoolYear,
      applicationStart: cycle.applicationStart?.split("T")[0] ?? "",
      interviewStart: cycle.interviewStart?.split("T")[0] ?? "",
      interviewEnd: cycle.interviewEnd?.split("T")[0] ?? "",
      isActive: cycle.isActive,
    });
    setEditingId(cycle.id);
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cycle?")) return;
    try {
      const res = await fetch("/api/admin/recruitment-cycle", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Deleted");
        if (editingId === id) handleNew();
        mutate();
      } else toast.error("Failed to delete");
    } catch {
      toast.error("Error deleting");
    }
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/recruitment-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(editingId ? "Updated" : "Created");
        setEditingId(data.cycle.id);
        mutate();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch {
      toast.error("Error saving");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-[#044FAF] border-t-transparent rounded-full" />
      </div>
    );

  const isEditing = !!editingId;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#005FD9]/10 rounded-xl p-6">
        <h2 className="text-sm font-bold text-[#134687] font-poppins mb-1">
          payment qr
        </h2>
        <p className="text-xs text-[#134687]/40 font-mono mb-5">
          upload the QR code shown on accepted applicants&apos; payment instructions
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-start">
          <div className="border border-[#005FD9]/10 rounded-lg bg-[#F3F3FD]/40 min-h-[180px] flex items-center justify-center overflow-hidden">
            {isPaymentQrLoading ? (
              <div className="animate-spin h-5 w-5 border-2 border-[#044FAF] border-t-transparent rounded-full" />
            ) : paymentQrData?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={paymentQrData.url}
                alt="Current payment QR"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-[#134687]/40 font-mono">no qr uploaded</span>
            )}
          </div>

          <form onSubmit={handlePaymentQrUpload} className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedPaymentQr(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#134687] file:mr-4 file:rounded-lg file:border-0 file:bg-[#E8F2FF] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#134687] hover:file:bg-[#DCECFF]"
            />
            {selectedPaymentQr && (
              <p className="text-xs text-[#134687]/50 font-mono">
                selected: {selectedPaymentQr.name}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPaymentQr || !selectedPaymentQr}
              className="px-6 py-2 text-sm font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-poppins"
            >
              {savingPaymentQr ? "uploading..." : "upload qr"}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-[#005FD9]/10 rounded-xl p-6">
        <h2 className="text-sm font-bold text-[#134687] font-poppins mb-1">
          payment acknowledgement receipt
        </h2>
        <p className="text-xs text-[#134687]/40 font-mono mb-5">
          upload the PDF template applicants must fill out and submit as a Google Drive link
        </p>
        <form onSubmit={handleReceiptTemplateUpload} className="space-y-3 max-w-xl">
          {receiptTemplateData?.url && (
            <a href={receiptTemplateData.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-[#044FAF] underline font-mono">
              view current receipt template
            </a>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setSelectedReceiptTemplate(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[#134687] file:mr-4 file:rounded-lg file:border-0 file:bg-[#E8F2FF] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#134687] hover:file:bg-[#DCECFF]"
          />
          {selectedReceiptTemplate && (
            <p className="text-xs text-[#134687]/50 font-mono">selected: {selectedReceiptTemplate.name}</p>
          )}
          <button type="submit" disabled={savingReceiptTemplate || !selectedReceiptTemplate} className="px-6 py-2 text-sm font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-poppins">
            {savingReceiptTemplate ? "uploading..." : "upload receipt pdf"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-[#005FD9]/10 rounded-xl p-6">
        <h2 className="text-sm font-bold text-[#134687] font-poppins mb-1">
          community link
        </h2>
        <p className="text-xs text-[#134687]/40 font-mono mb-5">
          configure the group link shown to accepted applicants
        </p>
        <form onSubmit={handleCommunitySave} className="space-y-3 max-w-xl">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={communityForm.enabled}
              onChange={(e) =>
                setCommunityForm({ ...communityForm, enabled: e.target.checked })
              }
              className="rounded border-[#005FD9]/20 text-[#044FAF] focus:ring-[#044FAF]/30"
            />
            <span className="text-[#134687] text-xs">show community card to accepted applicants</span>
          </label>
          <div>
            <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
              Button Label *
            </label>
            <input
              type="text"
              required
              value={communityForm.label}
              onChange={(e) =>
                setCommunityForm({ ...communityForm, label: e.target.value })
              }
              className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
              placeholder="Join UST CSS Members 26'-27' Group"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
              Group URL *
            </label>
            <input
              type="url"
              required
              value={communityForm.url}
              onChange={(e) =>
                setCommunityForm({ ...communityForm, url: e.target.value })
              }
              className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
              placeholder="https://fb.me/g/..."
            />
          </div>
          <button
            type="submit"
            disabled={savingCommunity}
            className="px-6 py-2 text-sm font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-poppins"
          >
            {savingCommunity ? "saving..." : "save community link"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-[#005FD9]/10 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-bold text-[#134687] font-poppins mb-1">
              executive associate availability
            </h2>
            <p className="text-xs text-[#134687]/40 font-mono">
              choose which EB roles applicants can apply to as Executive Associate
            </p>
          </div>
          {savingAvailability && (
            <span className="text-[11px] text-[#134687]/40 font-mono">saving...</span>
          )}
        </div>

        {isAvailabilityLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-5 w-5 border-2 border-[#044FAF] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ebRoles.map((role) => {
              const enabled = availability[role.id] !== false;

              return (
                <label
                  key={role.id}
                  className={`flex items-center justify-between gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                    enabled
                      ? "border-[#044FAF]/20 bg-[#E8F2FF]/40"
                      : "border-[#005FD9]/10 bg-white"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#134687] font-poppins">
                      {role.title}
                    </p>
                    <p className="text-[11px] text-[#134687]/40 font-mono">
                      {enabled ? "visible to applicants" : "hidden from applicants"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={savingAvailability}
                    onChange={(e) =>
                      handleToggleAvailability(role.id, e.target.checked)
                    }
                    className="h-5 w-5 rounded border-[#005FD9]/20 text-[#044FAF] focus:ring-[#044FAF]/30"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Existing Cycles */}
      {allCycles.length > 0 && (
        <div className="bg-white border border-[#005FD9]/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#005FD9]/10 bg-[#F3F3FD]/50">
            <span className="text-xs font-semibold text-[#134687]/50 uppercase tracking-widest font-mono">
              saved_cycles
            </span>
            <button
              onClick={handleNew}
              className="text-xs text-[#044FAF] font-medium hover:underline font-mono"
            >
              + new
            </button>
          </div>
          <div className="divide-y divide-[#005FD9]/5">
            {allCycles.map((cycle) => (
              <div
                key={cycle.id}
                className={`flex items-center justify-between px-5 py-3 transition-colors ${editingId === cycle.id ? "bg-[#E8F2FF]" : "hover:bg-[#F3F3FD]/50"}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#134687] font-poppins">
                      {cycle.schoolYear}
                    </span>
                    {cycle.isActive && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#044FAF]/10 text-[#044FAF] font-mono">
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#134687]/40 font-mono mt-0.5">
                    {new Date(cycle.interviewStart).toLocaleDateString()}{" "}
                    &ndash; {new Date(cycle.interviewEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button
                    onClick={() => handleEdit(cycle)}
                    className="text-xs text-[#044FAF] font-mono hover:underline"
                  >
                    edit
                  </button>
                  <button
                    onClick={() => handleDelete(cycle.id)}
                    className="text-xs text-[#134687]/30 font-mono hover:text-red-500 hover:underline"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white border border-[#005FD9]/10 rounded-xl p-6">
        <h2 className="text-sm font-bold text-[#134687] font-poppins mb-1">
          {isEditing ? "edit cycle" : "new cycle"}
        </h2>
        <p className="text-xs text-[#134687]/40 font-mono mb-5">
          configure recruitment period dates
        </p>
        <form onSubmit={handleSave} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
              School Year *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2025-2026"
              value={form.schoolYear}
              onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}
              className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm font-mono focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
              Application Start *
            </label>
            <input
              type="date"
              required
              value={form.applicationStart}
              onChange={(e) =>
                setForm({ ...form, applicationStart: e.target.value })
              }
              className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
                Interview Start *
              </label>
              <input
                type="date"
                required
                value={form.interviewStart}
                onChange={(e) =>
                  setForm({ ...form, interviewStart: e.target.value })
                }
                className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#134687]/60 uppercase tracking-wider font-mono mb-1">
                Interview End *
              </label>
              <input
                type="date"
                required
                value={form.interviewEnd}
                onChange={(e) =>
                  setForm({ ...form, interviewEnd: e.target.value })
                }
                className="w-full border border-[#005FD9]/15 rounded-lg px-3 py-2 text-sm focus:ring-[#044FAF]/20 focus:border-[#044FAF]/40"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-[#005FD9]/20 text-[#044FAF] focus:ring-[#044FAF]/30"
            />
            <span className="text-[#134687] text-xs">set as active</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white [background:linear-gradient(90deg,#2F7EE3_0%,#0349A2_100%)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity font-poppins"
            >
              {saving ? "saving..." : isEditing ? "update" : "create"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleNew}
                className="px-6 py-2 text-sm font-medium text-[#134687] border border-[#005FD9]/15 rounded-lg hover:bg-[#F3F3FD] transition-colors"
              >
                cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Help */}
      <div className="bg-[#E8F2FF]/50 border border-[#005FD9]/10 rounded-xl p-5">
        <div className="text-xs font-mono text-[#134687]/60 space-y-1">
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"click + new to create a cycle"}
          </p>
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"active cycle controls interview dates across the app"}
          </p>
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"only one cycle can be active at a time"}
          </p>
          <p>
            <span className="text-[#044FAF]">{"// "}</span>
            {"meeting links are set per-eb in user_db"}
          </p>
        </div>
      </div>
    </div>
  );
}
