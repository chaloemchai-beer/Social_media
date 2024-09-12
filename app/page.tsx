"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Feed from "@/components/Feed";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Widgets from "@/components/Widgets";

// Define a type for the page component
const Page: React.FC = () => {
  const { status, data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  return (
    status === "authenticated" &&
    session?.user && (
      <div className="h-screen bg-gray-100 overflow-hidden">
        <Header />
        <main className="flex">
          <Sidebar />
          <Feed />
          <Widgets />
        </main>
      </div>
    )
  );
};

export default Page;
