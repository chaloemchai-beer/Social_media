"use client"

import { faker } from "@faker-js/faker";
import { useEffect, useState } from "react"

type ContactType = {
  id: string;
  src: string;
  name: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
};

const STATUS_COLORS = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-gray-600',
};

const Widgets: React.FC = () => {
  const [contacts, setContacts] = useState<ContactType[]>([]);

  useEffect(() => {
    const statuses: ContactType['status'][] = ['online', 'online', 'online', 'away', 'online', 'offline', 'away', 'online'];
    const lastSeenOptions = ['Just now', '2m ago', '5m ago', '12m ago', '1h ago', 'Yesterday', '30m ago', '3m ago'];
    const generated: ContactType[] = Array.from({ length: 8 }, (_, i) => ({
      id: faker.string.uuid(),
      name: faker.person.firstName(),
      src: faker.image.avatar(),
      status: statuses[i],
      lastSeen: lastSeenOptions[i],
    }));
    setContacts(generated);
  }, []);

  const online = contacts.filter(c => c.status === 'online');
  const others = contacts.filter(c => c.status !== 'online');

  return (
    <div className="hidden lg:flex flex-col w-64 flex-shrink-0 p-3 mt-2 gap-1 overflow-y-auto">

      {/* Online Now */}
      <div className="mb-1">
        <div className="flex items-center justify-between px-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Online Now</h2>
          </div>
          <span className="text-xs text-green-500 font-medium">{online.length}</span>
        </div>
        <div className="space-y-0.5">
          {online.map(contact => (
            <button
              key={contact.id}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-800/70 transition-colors group"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={contact.src}
                  alt={contact.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-800"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${contact.name}&background=7c3aed&color=fff`; }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-gray-900" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-200 group-hover:text-white truncate transition-colors">{contact.name}</p>
                <p className="text-xs text-green-500/80">{contact.lastSeen}</p>
              </div>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800 my-1" />

      {/* Others */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">Recently Active</h2>
        <div className="space-y-0.5">
          {others.map(contact => (
            <button
              key={contact.id}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-800/70 transition-colors group"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={contact.src}
                  alt={contact.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-800 opacity-70 group-hover:opacity-100 transition-opacity"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${contact.name}&background=374151&color=9ca3af`; }}
                />
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${STATUS_COLORS[contact.status]} rounded-full ring-2 ring-gray-900`} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-400 group-hover:text-white truncate transition-colors">{contact.name}</p>
                <p className="text-xs text-gray-600">{contact.lastSeen}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Birthdays / Suggestions */}
      <div className="mt-2 border-t border-gray-800 pt-3">
        <div className="flex items-center gap-2 px-2 mb-2">
          <span className="text-base">🎂</span>
          <p className="text-xs text-gray-400">
            <span className="font-semibold text-white">2 friends</span> have birthdays today
          </p>
        </div>
      </div>
    </div>
  );
};

export default Widgets;
