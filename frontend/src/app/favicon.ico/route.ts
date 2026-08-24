import { NextResponse } from 'next/server';

export async function GET() {
  // Redirect to the SVG favicon
  return NextResponse.redirect(new URL('/favicon.svg', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'), 302);
}
