import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    const type = (session.user as { type?: string }).type;
    if (type === "seeker") redirect("/chat");
    if (type === "employer") redirect("/employer/chat");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Raj &amp; Prachi
          </h1>
          <p className="text-lg text-gray-500">
            Raj finds you the right job.
            <br />
            Prachi finds the right hire.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login?type=seeker"
            className="w-full py-3.5 bg-amber-600 text-white font-semibold rounded-2xl hover:bg-amber-700 transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            I'm looking for a job
          </Link>
          <Link
            href="/login?type=employer"
            className="w-full py-3.5 bg-[#1E3A5F] text-white font-semibold rounded-2xl hover:bg-[#162d4a] transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            I'm hiring
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
