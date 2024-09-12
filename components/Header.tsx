import Image from "next/image";
import SearchIcon from "@mui/icons-material/Search";
import HeaderIcon from "./common/HeaderIcon";
import HomeIcon from "@mui/icons-material/Home";
import EmojiFlagsIcon from "@mui/icons-material/EmojiFlags";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PeopleIcon from "@mui/icons-material/People";
import GridViewIcon from "@mui/icons-material/GridView";
import MessageIcon from "@mui/icons-material/Message";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import Dropdown from "./common/Dropdown"; // Import the Dropdown component
import { useRouter } from "next/navigation";

const Header = () => {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSignOut = (options: { callbackUrl: string }) => {
    nextAuthSignOut(options);
  };

  // Provide a default image URL if session.user?.image is undefined
  const profileImage = session?.user?.image || "";

  return (
    <div className="sticky top-0 z-50 bg-white flex items-center p-2 lg:px-5 shadow-sm">
      {/* Left */}
      <div className="flex items-center">
        <Image
          alt="Logo"
          src="https://archive.smashing.media/assets/344dbf88-fdf9-42bb-adb4-46f01eedd629/d0a4481f-e801-4cb7-9daa-17cdae32cc89/icon-design-21-opt.png"
          width={60}
          height={60}
          layout="fixed"
        />
        <div className="flex ml-2 items-center rounded-full bg-gray-100 p-2">
          <SearchIcon className="h-6 text-gray-600" />
          <input
            className="flex ml-2 items-center bg-transparent outline-none placeholder-gray-500 flex-shrink"
            type="text"
            placeholder="Search"
          />
        </div>
      </div>

      {/* Center */}
      <div className="flex justify-center flex-grow">
        <div className="flex space-x-6 md:space-x-2">
          <button onClick={() => router.push("/")}>
            <HeaderIcon active Icon={HomeIcon} />
          </button>
          <HeaderIcon Icon={EmojiFlagsIcon} />
          <HeaderIcon Icon={PlayCircleIcon} />
          <HeaderIcon Icon={ShoppingCartIcon} />
          <HeaderIcon Icon={PeopleIcon} />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center sm:space-x-2 justify-end">
        {/* Profile picture */}
        <Image
          className="rounded-full cursor-pointer"
          src={profileImage}
          width={60}
          height={60}
          alt={session?.user?.name || "Profile"}
          layout="fixed"
        />
        <p className="whitespace-nowrap font-semibold pr-3">
          {session?.user?.email || "Guest"}
        </p>
        <GridViewIcon className="hidden xl:inline-flex p-2 h-10 w-10 bg-gray-200 rounded-full text-gray-700 cursor-pointer hover:bg-gray-300" />
        <MessageIcon className="hidden xl:inline-flex p-2 h-10 w-10 bg-gray-200 rounded-full text-gray-700 cursor-pointer hover:bg-gray-300" />
        <NotificationsIcon className="hidden xl:inline-flex p-2 h-10 w-10 bg-gray-200 rounded-full text-gray-700 cursor-pointer hover:bg-gray-300" />
        <Dropdown signOut={handleSignOut} /> {/* Add Dropdown component */}
      </div>
    </div>
  );
};

export default Header;
