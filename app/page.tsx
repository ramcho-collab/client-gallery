import { redirect } from 'next/navigation';
import GalleriesIndexPage from './gallery/page';

export default function HomePage() {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'admin') {
    redirect('/admin');
  }

  return <GalleriesIndexPage />;
}
