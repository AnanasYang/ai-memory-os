import { Header } from '@/components/Header';
import { EvolutionTimeline } from '@/components/EvolutionTimeline';
import { getAllMemories } from '@/lib/data';

export default function TimelinePage() {
  const memories = getAllMemories();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Evolution Timeline</h1>
          <p className="text-slate-400">
            记忆系统的演变时间线，追踪每一层记忆的增长历程
          </p>
        </div>

        <div className="max-w-3xl">
          <EvolutionTimeline memories={memories} />
        </div>
      </main>
    </div>
  );
}