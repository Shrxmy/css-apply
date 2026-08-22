// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      dbId: string;
      email: string;
      name: string;
      role: string;
      studentNumber?: string;
      section?: string;
      createdAt: Date;
      updatedAt: Date;
      hasCompletedProfile: boolean;
      hasMemberApplication: boolean;
      memberApplication?: {
        id: string;
        hasAccepted: boolean;
        paymentProof?: string;
        createdAt: Date;
      };
      hasExecutiveAssociateApplication: boolean;
      executiveAssociateApplication?: { id: string; hasAccepted: boolean; status: string };
      hasCommitteeApplication: boolean;
      committeeApplication?: {
        id: string;
        hasAccepted: boolean;
        status: string;
      };
      ebRole?: string;
      committeeId?: string;
      ebProfile?: {
        position: string;
        committees: string[];
        isActive: boolean;
      } | null;
      applicationStatus: {
        member: {
          hasApplication: boolean;
          hasPayment?: boolean;
          isAccepted?: boolean;
          appliedAt?: Date;
        };
        ea: {
          hasApplication: boolean;
          status?: string;
          isAccepted?: boolean;
        };
        committee: {
          hasApplication: boolean;
          status?: string;
          isAccepted?: boolean;
        };
      };
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
  }

  interface JWT {
    id: string;
    role: string;
  }
}
