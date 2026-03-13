import PersonIcon from "@mui/icons-material/Person";
import SidebarRow from "./common/SidebarRow";
import GroupIcon from "@mui/icons-material/Group";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DesktopMacIcon from "@mui/icons-material/DesktopMac";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VideocamIcon from "@mui/icons-material/Videocam";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const Sidebar = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const profileImage = session?.user?.image || '';
  return (
    <div className="hidden md:flex flex-col p-3 mt-2 w-64 flex-shrink-0 gap-1">
      <SidebarRow
        src={profileImage}
        title={session?.user?.email || 'Guest'}
        alt={session?.user?.name || 'Profile'}
      />
      <div className="border-t border-gray-800 my-2" />
      <div onClick={() => router.push('/live/go')}>
        <SidebarRow Icon={VideocamIcon} title="Go Live" />
      </div>
      <div onClick={() => router.push('/friends')}>
        <SidebarRow Icon={PersonIcon} title="Friends" />
      </div>
      <SidebarRow Icon={GroupIcon} title="Groups" />
      <SidebarRow Icon={ShoppingCartIcon} title="Marketplace" />
      <SidebarRow Icon={DesktopMacIcon} title="Watch" />
      <SidebarRow Icon={CalendarMonthIcon} title="Events" />
      <SidebarRow Icon={AccessTimeIcon} title="Memories" />
      <SidebarRow Icon={ExpandMoreIcon} title="See more" />
    </div>
  );
};

export default Sidebar;
