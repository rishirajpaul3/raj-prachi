import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users, candidates, employers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  userType: z.enum(["seeker", "employer"]).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: undefined as never,
    sessionsTable: undefined as never,
    verificationTokensTable: undefined as never,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userType: { label: "User Type", type: "text" },
        isSignUp: { label: "Sign Up", type: "text" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, userType } = parsed.data;
        const isSignUp = credentials.isSignUp === "true";

        if (isSignUp) {
          // Registration: hash password and create user
          const { hashPassword } = await import("@/lib/auth-utils");
          const passwordHash = await hashPassword(password);

          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existing.length > 0) {
            throw new Error("Email already registered");
          }

          const [newUser] = await db
            .insert(users)
            .values({
              email,
              type: userType ?? "seeker",
              // Store hashed password in image field (a common hack; in production use a passwords table)
              image: `hash:${passwordHash}`,
            })
            .returning();

          if (!newUser) throw new Error("Failed to create user");

          // Create the candidate or employer profile row
          if (newUser.type === "seeker") {
            await db.insert(candidates).values({
              userId: newUser.id,
              profile: "{}",
            });
          } else {
            const companyName =
              ((credentials as Record<string, unknown>).companyName as string) || "My Company";
            await db.insert(employers).values({
              userId: newUser.id,
              companyName,
            });
          }

          return { id: newUser.id, email: newUser.email, type: newUser.type };
        }

        // Sign in: verify password
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.image?.startsWith("hash:")) return null;

        const { verifyPassword } = await import("@/lib/auth-utils");
        const passwordHash = user.image.replace("hash:", "");
        const valid = await verifyPassword(password, passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, type: user.type };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.type = (user as { type?: string }).type;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { type?: string }).type = token.type as string;
      }
      return session;
    },
  },
});
