import type { Metadata } from 'next';

import { PhotosAppView } from './photos-app-view';

export const metadata: Metadata = {
  title: 'Photos app example',
  description:
    'A macOS Photos-style React image gallery: a square grid under a sticky blurred toolbar that opens into a morphing lightbox, built with ramka.',
};

export default function PhotosAppPage() {
  return <PhotosAppView />;
}
