"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Page = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  return (
    status === "authenticated" &&
    session?.user && (
      <>
        <div>Hello</div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Logout
        </button>
      </>
    )
  );
};

export default Page;
