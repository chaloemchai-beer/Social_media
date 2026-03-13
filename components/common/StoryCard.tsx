import Image from "next/image";

const StoryCard = ({ name, src, profile }: any) => {
  return (
    <div className="relative w-28 h-48 flex-shrink-0 cursor-pointer rounded-2xl overflow-hidden group transition-transform duration-200 hover:scale-105 ring-1 ring-gray-800 hover:ring-violet-500/50">
      {/* Background image */}
      <Image
        className="object-cover brightness-75 group-hover:brightness-90 transition-all duration-200"
        src={src}
        fill
        alt=""
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      {/* Profile avatar */}
      {profile && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full overflow-hidden ring-2 ring-violet-500">
          <Image
            src={profile}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            alt=""
          />
        </div>
      )}
      {/* Name */}
      <p className="absolute bottom-3 left-0 right-0 px-2 text-white text-xs font-semibold text-center truncate">
        {name}
      </p>
    </div>
  );
};

export default StoryCard;
