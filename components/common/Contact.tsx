import Image from "next/image";

const Contact = ({ src, name }: any) => {
  return (
    <div className="flex items-center gap-3 px-2 py-2 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors relative group">
      <div className="relative flex-shrink-0">
        <Image
          className="rounded-full object-cover"
          src={src}
          width={36}
          height={36}
          alt=""
        />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-gray-950" />
      </div>
      <p className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">{name}</p>
    </div>
  );
};

export default Contact;
