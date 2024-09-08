"use client"

import VideocamIcon from '@mui/icons-material/Videocam';
import SearchIcon from '@mui/icons-material/Search';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Contact from './common/Contact';
import { faker } from "@faker-js/faker";
import {useEffect, useState} from "react"

type ContactType = {
  id: string;
  src: string;
  name: string;
};

const Widgets: React.FC = () => {
  const [contact, setContact] = useState<ContactType[]>([]);

  useEffect(() => {
    const generateContacts = (): void => {
      const newContact: ContactType[] = Array.from({ length: 8 }, () => ({
        id: faker.string.uuid(),
        name: faker.person.firstName(),
        src: faker.image.avatar()
      }));
      setContact(newContact);
    };

    generateContacts();
  }, []);
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

      {contact.map(contact => (
        <Contact key={contact.src}
        src={contact.src} name={contact.name} />
      ))}
    </div>
  );
};

export default Widgets;
