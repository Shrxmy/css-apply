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
      <div className="pt-12 pb-8 px-6 border-b shrink-0">
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
              <div
                className="w-5 h-5 mr-3 text-[#164e96] bg-current transition-colors duration-300"
                style={{
                  maskImage: "url(/icons/calendar.svg)",
                  WebkitMaskImage: "url(/icons/calendar.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Interview Schedule
              </span>
            </div>
          ) : (
            <Link
              href="/admin"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div
                className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] bg-current transition-all duration-300"
                style={{
                  maskImage: "url(/icons/calendar.svg)",
                  WebkitMaskImage: "url(/icons/calendar.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
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
              <div
                className="w-5 h-5 mr-3 text-[#164e96] bg-current transition-colors duration-300"
                style={{
                  maskImage: "url(/icons/edit.svg)",
                  WebkitMaskImage: "url(/icons/edit.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                All Applications
              </span>
            </div>
          ) : (
            <Link
              href="/admin/applications"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div
                className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] bg-current transition-all duration-300"
                style={{
                  maskImage: "url(/icons/edit.svg)",
                  WebkitMaskImage: "url(/icons/edit.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
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
              <div
                className="w-5 h-5 mr-3 text-[#164e96] bg-current transition-colors duration-300"
                style={{
                  maskImage: "url(/icons/users.svg)",
                  WebkitMaskImage: "url(/icons/users.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Members
              </span>
            </div>
          ) : (
            <Link
              href="/admin/members"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div
                className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] bg-current transition-all duration-300"
                style={{
                  maskImage: "url(/icons/users.svg)",
                  WebkitMaskImage: "url(/icons/users.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
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
              <div
                className="w-5 h-5 mr-3 text-[#164e96] bg-current transition-colors duration-300"
                style={{
                  maskImage: "url(/icons/file-text.svg)",
                  WebkitMaskImage: "url(/icons/file-text.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Committee Staff
              </span>
            </div>
          ) : (
            <Link
              href="/admin/staffs"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div
                className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] bg-current transition-all duration-300"
                style={{
                  maskImage: "url(/icons/file-text.svg)",
                  WebkitMaskImage: "url(/icons/file-text.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Committee Staff
              </span>
            </Link>
          )}

          {/* executive associates */}
          {activePage === "eas" ? (
            <div
              className="flex items-center px-4 py-3 text-gray-600 border border-gray-300 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
              style={{ backgroundColor: "#fefefe" }}
            >
              <div
                className="w-5 h-5 mr-3 text-[#164e96] bg-current transition-colors duration-300"
                style={{
                  maskImage: "url(/icons/briefcase.svg)",
                  WebkitMaskImage: "url(/icons/briefcase.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Executive Associates
              </span>
            </div>
          ) : (
            <Link
              href="/admin/executive-associates"
              className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
            >
              <div
                className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] bg-current transition-all duration-300"
                style={{
                  maskImage: "url(/icons/briefcase.svg)",
                  WebkitMaskImage: "url(/icons/briefcase.svg)",
                  maskSize: "contain",
                  maskRepeat: "no-repeat",
                  maskPosition: "center",
                }}
              />
              <span className="text-sm text-gray-700 transition-colors duration-300">
                Executive Associates
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
                  <div
                    className="w-5 h-5 mr-3 text-[#164e96] bg-current transition-colors duration-300"
                    style={{
                      maskImage: "url(/icons/star.svg)",
                      WebkitMaskImage: "url(/icons/star.svg)",
                      maskSize: "contain",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                    }}
                  />
                  <span className="text-sm text-gray-700 transition-colors duration-300">
                    EB Management
                  </span>
                </div>
              ) : (
                <Link
                  href="/admin/super-admin"
                  className="group flex items-center px-4 py-3 text-gray-600 hover:bg-blue-50 rounded-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
                >
                  <div
                    className="w-5 h-5 mr-3 text-gray-500 group-hover:text-[#164e96] bg-current transition-all duration-300"
                    style={{
                      maskImage: "url(/icons/star.svg)",
                      WebkitMaskImage: "url(/icons/star.svg)",
                      maskSize: "contain",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                    }}
                  />
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
      <div className="p-4 border-t shrink-0">
        <button
          onClick={handleLogout}
          className="group flex items-center w-full px-4 py-3 text-gray-600 hover:bg-red-50 rounded-lg cursor-pointer transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md"
        >
          <div
            className="w-5 h-5 mr-3 text-gray-500 group-hover:text-red-600 bg-current transition-all duration-300"
            style={{
              maskImage: "url(/icons/logout.svg)",
              WebkitMaskImage: "url(/icons/logout.svg)",
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
            }}
          />
          <span className="text-sm text-gray-700 transition-colors duration-300">
            Log Out
          </span>
        </button>
      </div>
    </>
  );
};

export default SidebarContent;
