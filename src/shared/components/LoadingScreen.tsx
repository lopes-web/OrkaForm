import { Loader2 } from 'lucide-react';

const LoadingScreen = () => (
  <main className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0a] flex items-center justify-center">
    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
  </main>
);

export default LoadingScreen;

