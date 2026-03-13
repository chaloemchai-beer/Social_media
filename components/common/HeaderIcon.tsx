const HeaderIcon = ({ Icon, active }: any) => {
  return (
    <div className={`flex items-center cursor-pointer px-6 h-10 rounded-xl transition-colors group
      ${active
        ? "border-b-2 border-violet-500 text-violet-400"
        : "hover:bg-gray-800 text-gray-400 hover:text-white"
      }`}
    >
      <Icon className={`h-5 sm:h-6 mx-auto ${active ? "text-violet-400" : "group-hover:text-white"}`} />
    </div>
  );
};

export default HeaderIcon;
