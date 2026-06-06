"use client";

import dynamic from 'next/dynamic';

// Disable SSR for the entire React Three Fiber / GSAP application to prevent hydration mismatches and "window is not defined" errors.
const App = dynamic(() => import('../app'), { ssr: false });

export default function Page() {
  return <App />;
}
