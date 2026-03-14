import HeroSection from "@/components/HeroSection";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="relative flex flex-col items-center justify-center min-h-screen bg-white overflow-hidden">
        <HeroSection />
      </main>
      <Footer />
    </>
  );
}
