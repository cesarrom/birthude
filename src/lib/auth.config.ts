import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // We add providers in auth.ts to avoid importing non-edge-compatible modules here
} satisfies NextAuthConfig;
