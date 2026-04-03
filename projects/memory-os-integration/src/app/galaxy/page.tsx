import { Header } from '@/components/Header';
import { MemoryGalaxy } from '@/components/MemoryGalaxy';
import { getAllMemories } from '@/lib/data';

export default function GalaxyPage() {
  const memories = getAllMemories();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Memory Galaxy</h1>
          <p className="text-slate-400">
            5 层记忆架构的星系可视化，展示记忆之间的层次关系
          </p>
        </div>

        <MemoryGalaxy memories={memories} />

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {['L0', 'L1', 'L2', 'L3', 'L4', 'Intent', 'Meta'].map((level) => {
            const levelMemories = memories.filter((m) => m.level === level);
            return (
              <div key={level} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-100 mb-2">
                  {level} Layer
                </h3>
                <p className="text-sm text-slate-500">
                  {levelMemories.length} 条记忆
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}