import VideocamIcon from '@mui/icons-material/Videocam';
import SearchIcon from '@mui/icons-material/Search';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Contact from './common/Contact';

const contacts = [
    {
        src: "https://archive.smashing.media/assets/344dbf88-fdf9-42bb-adb4-46f01eedd629/d0a4481f-e801-4cb7-9daa-17cdae32cc89/icon-design-21-opt.png",
        name: "test"
    }
]

const Widgets = () => {
  return (
    <div className="hidden lg:flex flex-col w-60 p-2 mt-5">
      <div className="flex justify-between items-center text-gray-500 mb-5">
        <h2 className="text-xl">Contact</h2>
        <div className="flex space-x-2">
            <VideocamIcon className="h-6" />
            <SearchIcon className="h-6" />
            <MoreHorizIcon className="h-6" />
        </div>
      </div>

      {contacts.map(contact => (
        <Contact key={contact.src}
        src={contact.src} name={contact.name} />
      ))}
    </div>
  );
};

export default Widgets;
