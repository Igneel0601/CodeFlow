import { Navbar } from "@/modules/home/ui/components/navbar";
import { ParticlesBackground } from "@/components/particles-background";

interface Props {
  children: React.ReactNode;
};

const Layout = ({ children }: Props) => {
  return (
    <main className="flex flex-col min-h-screen max-h-screen">
      <Navbar />
      <ParticlesBackground />
      <div className="flex-1 flex flex-col px-4 pb-4">
        {children}
      </div>
    </main>
  );
};
 
export default Layout;
