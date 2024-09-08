import Image from "next/image";
import VideocamIcon from "@mui/icons-material/Videocam";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";

const InputBox = () => {
  const name = "Admin test";

  const sendPost = (e: any) => {
    e.preventDefault();
  };
  return (
    <div
      className="bg-white p-2 rounded-2xl shadow-md
    text-gray-500 font-medium mt-6"
    >
      <div className="flex space-x-4 p-4 item-center">
        <Image
          className="rounded-full"
          src="https://archive.smashing.media/assets/344dbf88-fdf9-42bb-adb4-46f01eedd629/d0a4481f-e801-4cb7-9daa-17cdae32cc89/icon-design-21-opt.png"
          width={40}
          height={40}
          layout="fixed"
          alt=""
        />
        <form className="flex flex-1">
          <input
            className="rounded-full h-12 bg-gray-100
          flex-grow px-5 focus:outline-none"
            type="text"
            placeholder={`What's on your mind, ${name}?`}
          />
          <button hidden type="submit" onClick={sendPost}>
            Sumbit
          </button>
        </form>
      </div>

      <div className="flex justify-evenly p-3 border-t">
        <div className="inputIcon">
          <VideocamIcon className="h-7 text-red-500" />
          <p
            className="text-xs sm:text-sm
          xl:text-base"
          >
            Live Video
          </p>
        </div>
        <div className="inputIcon">
          <CameraAltIcon className="h-7 text-green-500" />
          <p
            className="text-xs sm:text-sm
          xl:text-base"
          >
            Photo/Video
          </p>
        </div>
        <div className="inputIcon">
          <EmojiEmotionsIcon className="h-7 text-yellow-500" />
          <p
            className="text-xs sm:text-sm
          xl:text-base"
          >
            Feeling/Activity
          </p>
        </div>
      </div>
    </div>
  );
};

export default InputBox;
