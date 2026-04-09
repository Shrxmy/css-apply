import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";

interface SidebarContentProps {
  activePage: string;
}

const SidebarContent = ({ activePage }: SidebarContentProps) => {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "super_admin";

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/", redirect: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  return (
    <>
      {/* CSS logo inside sidebar */}
      <div className="pt-12 pb-8 px-6 border-b flex-shrink-0">
        <div className="flex items-center justify-center">
          <Image
            src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS Apply.svg"
            alt="CSS Apply Logo"
            width={120}
            height={40}
          />
        </div>
      </div>

      {/* sidebar links */}
      <nav className="mt-6 flex-1 overflow-y-auto">
        <div className="space-y-2 px-4">
          {/* schedule */}
          {activePage === "schedule" ? (
            <div
              className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              style={{ backgroundColor: "#fefefe" }}
            >
              <div className="w-5 h-5 mr-3 text-[#164e96] transition-colors duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Interview Schedule
              </span>
            </div>
          ) : (
            <Link
              href="/admin"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] transition-all duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Interview Schedule
              </span>
            </Link>
          )}

          {/* applications */}
          {activePage === "applications" ? (
            <div
              className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              style={{ backgroundColor: "#fefefe" }}
            >
              <div className="w-5 h-5 mr-3 text-[#164e96] transition-colors duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                All Applications
              </span>
            </div>
          ) : (
            <Link
              href="/admin/applications"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] transition-all duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                All Applications
              </span>
            </Link>
          )}

          {/* members */}
          {activePage === "members" ? (
            <div
              className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              style={{ backgroundColor: "#fefefe" }}
            >
              <div className="w-5 h-5 mr-3 text-[#164e96] transition-colors duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Members
              </span>
            </div>
          ) : (
            <Link
              href="/admin/members"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] transition-all duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Members
              </span>
            </Link>
          )}

          {/* staffs */}
          {activePage === "staffs" ? (
            <div
              className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              style={{ backgroundColor: "#fefefe" }}
            >
              <div className="w-5 h-5 mr-3 text-[#164e96] transition-colors duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Committee Staff
              </span>
            </div>
          ) : (
            <Link
              href="/admin/staffs"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] transition-all duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Committee Staff
              </span>
            </Link>
          )}

          {/* executive assistants */}
          {activePage === "eas" ? (
            <div
              className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              style={{ backgroundColor: "#fefefe" }}
            >
              <div className="w-5 h-5 mr-3 text-[#164e96] transition-colors duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Executive Assistants
              </span>
            </div>
          ) : (
            <Link
              href="/admin/eas"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] transition-all duration-300">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 transition-all duration-300"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Executive Assistants
              </span>
            </Link>
          )}

          {/* super admin - only visible to super_admin users */}
          {isSuperAdmin && (
            <>
              {activePage === "super-admin" ? (
                <div
                  className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
                  style={{ backgroundColor: "#fefefe" }}
                >
                  <div className="w-5 h-5 mr-3 text-[#164e96] transition-colors duration-300">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-5 h-5 transition-all duration-300"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700 transition-colors duration-300">
                    EB Management
                  </span>
                </div>
              ) : (
                <Link
                  href="/admin/super-admin"
                  className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
                >
                  <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] transition-all duration-300">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-5 h-5 transition-all duration-300"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700 transition-colors duration-300">
                    EB Management
                  </span>
                </Link>
              )}
            </>
          )}
        </div>
      </nav>

      {/* logout button */}
      <div className="p-4 border-t flex-shrink-0">
        <button
          onClick={handleLogout}
          className="group flex items-center w-full px-4 py-3 text-gray-600 hover:bg-red-50 rounded-lg cursor-pointer transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
        >
          <div className="w-5 h-5 mr-3 text-gray-500 group-hover:text-red-600 transition-all duration-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5 transition-all duration-300"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </div>
          <span className="text-sm text-gray-700 transition-colors duration-300">
            Log Out
          </span>
        </button>
      </div>
    </>
  );
};

export default SidebarContent;
