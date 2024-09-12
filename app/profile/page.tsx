"use client"

import Header from "@/components/Header";
import Image from "next/image";

const page = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      {/* Cover Photo */}
      <div className="relative h-48 bg-blue-500">
        <Image
          src=""
          alt="Cover Photo"
          layout="fill"
          objectFit="cover"
          className="absolute top-0 left-0"
        />
      </div>

      {/* Profile Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          {/* Profile Picture and Name */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Image
                src=""
                alt="Profile Picture"
                width={150}
                height={150}
                className="rounded-full border-4 border-white"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">John Doe</h1>
              <p className="text-gray-500">Software Engineer</p>
            </div>
          </div>

          {/* About Section */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold">About</h2>
            <p className="mt-2 text-gray-700">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
          </div>

          {/* Friends Section */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold">Friends</h2>
            <div className="flex space-x-4 mt-2">
              <div className="flex flex-col items-center">
                <Image
                  src=""
                  alt="Friend 1"
                  width={60}
                  height={60}
                  className="rounded-full border-2 border-white"
                />
                <p className="mt-2 text-sm font-semibold">Alice</p>
              </div>
              <div className="flex flex-col items-center">
                <Image
                  src=""
                  alt="Friend 2"
                  width={60}
                  height={60}
                  className="rounded-full border-2 border-white"
                />
                <p className="mt-2 text-sm font-semibold">Bob</p>
              </div>
              {/* Add more friends as needed */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;
