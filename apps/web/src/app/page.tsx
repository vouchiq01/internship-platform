import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { Tracks } from '@/components/landing/tracks';
import { Process } from '@/components/landing/process';
import { Certificate } from '@/components/landing/certificate';
import { Pricing } from '@/components/landing/pricing';
import { Footer } from '@/components/landing/footer';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Tracks />
        <Process />
        <Certificate />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
