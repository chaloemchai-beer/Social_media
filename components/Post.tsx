import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ChatIcon from "@mui/icons-material/Chat";
import ShareIcon from "@mui/icons-material/Share";
import Image from "next/image";

type PostProps = {
  name: string;
  message: string;
  email: string;
  postImage?: string | null;  // Make postImage optional
  profileImage: string;       // Rename image to profileImage for clarity
  timestamp: string;
};

const Post: React.FC<PostProps> = ({ name, message, email, postImage, profileImage, timestamp }) => {
  // Format the timestamp
  const date = new Date(timestamp);
  const formattedDate = date.toLocaleDateString();

  return (
    <div className="flex flex-col">
      {/* Post Header */}
      <div className="p-5 bg-white mt-5 rounded-t-2xl shadow-sm">
        <div className="flex items-center space-x-2">
          <Image
            className="rounded-full"
            src={profileImage}   // Use profileImage for the user's image
            width={40}
            height={40}
            alt="Profile Picture"
          />
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-xs text-gray-400">{formattedDate}</p>
          </div>
        </div>

        {/* Post Message */}
        <p className="pt-4">{message}</p>
      </div>

      {/* Post Image */}
      {postImage && (
        <div className="relative h-56 md:h-96 bg-white">
          <Image src={postImage} alt="Post Image" layout="fill" objectFit="cover" />
        </div>
      )}

      {/* Post Footer */}
      <div className="flex justify-between items-center rounded-b-2xl bg-white shadow-md text-gray-400 border-t">
        <div className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer">
          <ThumbUpIcon className="h4" />
          <p className="text-xs sm:text-base">Like</p>
        </div>
        <div className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer">
          <ChatIcon className="h4" />
          <p className="text-xs sm:text-base">Comment</p>
        </div>
        <div className="flex items-center space-x-1 hover:bg-gray-100 flex-grow justify-center p-2 rounded-xl cursor-pointer">
          <ShareIcon className="h4" />
          <p className="text-xs sm:text-base">Share</p>
        </div>
      </div>
    </div>
  );
};

export default Post;
