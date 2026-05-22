import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const ALLOWED_SIGNIN_EMAIL_DOMAIN =
  process.env.ALLOWED_SIGNIN_EMAIL_DOMAIN?.trim().toLowerCase() || "ust.edu.ph";

function isAllowedSignInEmail(email?: string | null) {
  if (!email) return false;

  return email.toLowerCase().endsWith(`@${ALLOWED_SIGNIN_EMAIL_DOMAIN}`);
}

interface UserSession {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  dbId?: string;
  studentNumber?: string | null;
  section?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  hasCompletedProfile?: boolean;
  applicationStatus?: {
    member: {
      hasApplication: boolean;
      hasPayment?: boolean;
      isAccepted?: boolean;
      appliedAt?: Date;
    };
    ea: { hasApplication: boolean; status?: string; isAccepted?: boolean };
    committee: {
      hasApplication: boolean;
      status?: string;
      isAccepted?: boolean;
    };
  };
  hasMemberApplication?: boolean;
  hasExecutiveAssociateApplication?: boolean;
  hasCommitteeApplication?: boolean;
  ebRole?: string;
  committeeId?: string;
  ebProfile?: {
    position: string;
    committees: string[];
    isActive: boolean;
  } | null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        if (!isAllowedSignInEmail(user.email)) {
          console.warn("Rejected sign-in for disallowed email domain", {
            email: user.email,
          });
          return false;
        }

        // Check if user exists in database
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser) {
          return true;
        }

        // If new user, create a basic user record
        await prisma.user.create({
          data: {
            email: user.email!,
            name: user.name || "",
            role: "user", // Default role
          },
        });

        return true;
      } catch (error) {
        console.error("SignIn error:", error);
        return false;
      }
    },

    async jwt({ token, user }) {
      if (user) {
        token.role = "user";
      }

      const email =
        typeof token?.email === "string" && token.email.length > 0
          ? token.email
          : null;

      if (email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              role: true,
              name: true,
            },
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.dbId = dbUser.id;
            token.name = dbUser.name;
          }
        } catch (error) {
          console.error("JWT callback database error:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      try {
        if (!session?.user || !token) {
          return session;
        }

        (session.user as UserSession).role = token.role as string;
        (session.user as UserSession).dbId = token.dbId as string;

        const email =
          typeof session.user.email === "string" && session.user.email.length > 0
            ? session.user.email
            : null;

        if (!email) {
          return session;
        }

        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            studentNumber: true,
            section: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            memberApplications: {
              select: {
                id: true,
                hasAccepted: true,
                paymentProof: true,
                createdAt: true,
              },
            },
            executiveAssociateApplications: {
              select: {
                id: true,
                hasAccepted: true,
                status: true,
                firstOptionEb: true,
              },
            },
            committeeApplications: {
              select: {
                id: true,
                hasAccepted: true,
                status: true,
                firstOptionCommittee: true,
              },
            },
            ebProfile: {
              select: {
                position: true,
                committees: true,
                isActive: true,
              },
            },
          },
        });

        if (!dbUser) {
          return session;
        }

        // Add database user details to session
        (session.user as UserSession).dbId = dbUser.id;
        (session.user as UserSession).studentNumber = dbUser.studentNumber;
        (session.user as UserSession).section = dbUser.section;
        (session.user as UserSession).name = dbUser.name;
        (session.user as UserSession).role = dbUser.role;
        (session.user as UserSession).createdAt = dbUser.createdAt;
        (session.user as UserSession).updatedAt = dbUser.updatedAt;
        (session.user as UserSession).ebProfile = dbUser.ebProfile;

        // Add application status information
        (session.user as UserSession).hasMemberApplication =
          !!dbUser.memberApplications?.[0];
        (session.user as UserSession).hasExecutiveAssociateApplication = !!dbUser.executiveAssociateApplications?.[0];
        (session.user as UserSession).hasCommitteeApplication =
          !!dbUser.committeeApplications?.[0];

        // Add redirect information for faster navigation
        (session.user as UserSession).ebRole = dbUser.executiveAssociateApplications?.[0]?.firstOptionEb;
        (session.user as UserSession).committeeId =
          dbUser.committeeApplications?.[0]?.firstOptionCommittee;

        // Check if user has completed their profile
        (session.user as UserSession).hasCompletedProfile =
          !!dbUser.studentNumber && !!dbUser.section;

        // Check application status for routing
        (session.user as UserSession).applicationStatus = {
          member: dbUser.memberApplications?.[0]
            ? {
                hasApplication: true,
                hasPayment: !!dbUser.memberApplications?.[0].paymentProof,
                isAccepted: dbUser.memberApplications?.[0].hasAccepted,
                appliedAt: dbUser.memberApplications?.[0].createdAt,
              }
            : { hasApplication: false },

          ea: dbUser.executiveAssociateApplications?.[0]
            ? {
                hasApplication: true,
                status: dbUser.executiveAssociateApplications?.[0].status ?? undefined,
                isAccepted: dbUser.executiveAssociateApplications?.[0].hasAccepted,
              }
            : { hasApplication: false },

          committee: dbUser.committeeApplications?.[0]
            ? {
                hasApplication: true,
                status: dbUser.committeeApplications?.[0].status ?? undefined,
                isAccepted: dbUser.committeeApplications?.[0].hasAccepted,
              }
            : { hasApplication: false },
        };

        return session;
      } catch (error) {
        console.error("Session callback error:", error);
        // Never throw here. Throwing can cause /api/auth/session to return non-JSON 500 and trigger CLIENT_FETCH_ERROR.
        return session;
      }
    },

    async redirect({ url }) {
      if (url.startsWith("/api/auth")) {
        return url;
      }

      if (url.startsWith("/")) {
        return url;
      }

      return "/";
    },
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
    signOut: "/",
  },
  // Add session strategy for better performance
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    pkceCodeVerifier: {
      name: `next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 15, // 15 minutes
      },
    },
    state: {
      name: `next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 15, // 15 minutes
      },
    },
  },
  // Add additional configuration for OAuth state management
  useSecureCookies: process.env.NODE_ENV === "production",
  debug: process.env.NODE_ENV === "development",
};
