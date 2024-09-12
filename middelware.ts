import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const user = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // Allow access to the login page and public assets
  if (pathname === '/login' || pathname.startsWith('/_next/') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to the login page
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow the request to proceed if the user is authenticated
  return NextResponse.next();
}

// Define which paths the middleware should apply to
export const config = {
  matcher: ['/', '/:path*'], // Apply to all paths
};
