import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// REF: for everything, standardize error handling and auth since paulit ulit nmn siya across file
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
