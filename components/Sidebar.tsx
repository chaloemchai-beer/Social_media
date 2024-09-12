import PersonIcon from "@mui/icons-material/Person";
import SidebarRow from "./common/SidebarRow";
import GroupIcon from "@mui/icons-material/Group";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DesktopMacIcon from "@mui/icons-material/DesktopMac";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSession } from "next-auth/react";

const Sidebar = () => {
  const { data: session } = useSession();
  const profileImage = session?.user?.image || '';
  return (
    <div className="p-2 mt-5 max-w-[600px] xl:min-w-[300px]">
      <SidebarRow
        src={profileImage}
        title={session?.user?.email || 'Guest'}
        alt={session?.user?.name || 'Profile'}
      />
      <SidebarRow Icon={PersonIcon} title="Friends" />
      <SidebarRow Icon={GroupIcon} title="Group" />
      <SidebarRow Icon={ShoppingCartIcon} title="Marketplace" />
      <SidebarRow Icon={DesktopMacIcon} title="Watch" />
      <SidebarRow Icon={CalendarMonthIcon} title="Events" />
      <SidebarRow Icon={AccessTimeIcon} title="Memories" />
      <SidebarRow Icon={ExpandMoreIcon} title="See more" />
    </div>
  );
};

export default Sidebar;
