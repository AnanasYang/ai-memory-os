import { Header } from '@/components/Header';
import { MemoryCard } from '@/components/MemoryCard';
import { getAllMemories, getMemoriesByLevel } from '@/lib/data';
import { LAYER_CONFIG, LayerKey } from '@/lib/types';

export default function MemoriesPage() {
  const memories = getAllMemories();
  const layers: LayerKey[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'Intent', 'Meta'];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">全部记忆</h1>
          <p className="text-slate-400">
            浏览所有记忆节点，共 {memories.length} 条
          </p>
        </div>

        {layers.map((layer) => {
          const layerMemories = memories.filter((m) => m.level === layer);
          if (layerMemories.length === 0) return null;

          const config = LAYER_CONFIG[layer];

          return (
            <section key={layer} className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <h2 className="text-xl font-semibold text-slate-100">
                  {config.nameZh} ({layer})
                </h2>
                <span className="text-sm text-slate-500">
                  {layerMemories.length} 条
                </span>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {layerMemories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}