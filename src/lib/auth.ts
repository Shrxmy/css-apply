import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const authLogger = createLogger("auth");
const AUTH_TOKEN_VERSION = 2;

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
          authLogger.warn("sign-in blocked", {
            reason: "email domain is not allowed",
          });
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        // If user exists, update image from Google and return
        if (existingUser) {
          if (user.image && existingUser.image !== user.image) {
            await prisma.user.update({
              where: { email: user.email! },
              data: { image: user.image },
            });
          }
          return true;
        }

        // If new user, create a basic user record
        await prisma.user.create({
          data: {
            email: user.email!,
            name: user.name || "",
            image: user.image || null,
            role: "user", // Default role
          },
        });

        return true;
      } catch (error) {
        authLogger.error("sign-in callback failed", error);
        return false;
      }
    },

    async jwt({ token, user, trigger }) {
      const appToken = token as typeof token & {
        authVersion?: number;
        role?: string;
        dbId?: string;
        studentNumber?: string | null;
        section?: string | null;
        hasCompletedProfile?: boolean;
        ebProfile?: {
          position: string;
          committees: string[];
          isActive: boolean;
        } | null;
      };

      // Stable account data is stored in the signed JWT. Re-query only during
      // sign-in, when an older token lacks database identity, or after an
      // explicit session update. This avoids a database round-trip before
      // every authenticated API request.
      if (
        user ||
        !appToken.dbId ||
        appToken.authVersion !== AUTH_TOKEN_VERSION ||
        trigger === "update"
      ) {
        const email =
          typeof token.email === "string" && token.email.length > 0
            ? token.email
            : user?.email;

        if (email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email },
              select: {
                id: true,
                role: true,
                name: true,
                studentNumber: true,
                section: true,
                ebProfile: {
                  select: {
                    position: true,
                    committees: true,
                    isActive: true,
                  },
                },
              },
            });

            if (dbUser) {
              appToken.authVersion = AUTH_TOKEN_VERSION;
              appToken.role = dbUser.role;
              appToken.dbId = dbUser.id;
              appToken.name = dbUser.name;
              appToken.studentNumber = dbUser.studentNumber;
              appToken.section = dbUser.section;
              appToken.hasCompletedProfile = Boolean(
                dbUser.studentNumber && dbUser.section,
              );
              appToken.ebProfile = dbUser.ebProfile;
            }
          } catch (error) {
            authLogger.error("session token lookup failed", error);
          }
        }
      }

      return appToken;
    },

    async session({ session, token }) {
      if (!session?.user || !token) return session;

      const appToken = token as typeof token & {
        role?: string;
        dbId?: string;
        studentNumber?: string | null;
        section?: string | null;
        hasCompletedProfile?: boolean;
        ebProfile?: {
          position: string;
          committees: string[];
          isActive: boolean;
        } | null;
      };
      const sessionUser = session.user as UserSession;

      sessionUser.id = appToken.dbId;
      sessionUser.dbId = appToken.dbId;
      sessionUser.role = appToken.role ?? "user";
      sessionUser.studentNumber = appToken.studentNumber;
      sessionUser.section = appToken.section;
      sessionUser.hasCompletedProfile = appToken.hasCompletedProfile ?? false;
      sessionUser.ebProfile = appToken.ebProfile ?? null;

      return session;
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
  // Keep NextAuth diagnostics concise. Verbose OAuth metadata can contain
  // long URLs and sensitive values, so debug logging is opt-in only.
  logger: {
    error(code, metadata) {
      const error = metadata instanceof Error ? metadata : metadata?.error;
      authLogger.error(`next-auth ${code}`, error);
    },
    warn(code) {
      authLogger.warn(`next-auth ${code}`);
    },
    debug(code) {
      authLogger.info(`next-auth ${code}`);
    },
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  debug: process.env.NEXTAUTH_DEBUG === "true",
};
