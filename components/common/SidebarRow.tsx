import Image from "next/image";
import React from "react";

const SidebarRow = ({ src, Icon, title, alt }: any) => {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors group">
      {src && (
        <Image
          className="rounded-full object-cover flex-shrink-0"
          src={src}
          width={32}
          height={32}
          alt={alt}
        />
      )}
      {Icon && (
        <div className="w-8 h-8 bg-gray-800 group-hover:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
          <Icon className="text-violet-400" style={{ fontSize: 18 }} />
        </div>
      )}
      <p className="hidden sm:block text-sm font-medium text-gray-300 group-hover:text-white transition-colors truncate">
        {title}
      </p>
    </div>
  );
};

export default SidebarRow;
