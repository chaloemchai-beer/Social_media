import NextAuth from 'next-auth';
import { authOptions } from '@/lib/authOptions'; // Assume you've moved `authOptions` to a separate file for cleaner code

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
