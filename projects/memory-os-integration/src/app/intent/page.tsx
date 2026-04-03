import { Header } from '@/components/Header';
import { IntentOrbit } from '@/components/IntentOrbit';
import { MemoryCard } from '@/components/MemoryCard';
import { getAllMemories } from '@/lib/data';

export default function IntentPage() {
  const memories = getAllMemories();
  const intentMemories = memories.filter((m) => m.level === 'Intent');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Intent Orbit</h1>
          <p className="text-slate-400">
            意图轨道展示用户主动设定的目标、偏好和约束
          </p>
        </div>

        <div className="mb-8">
          <IntentOrbit memories={memories} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {intentMemories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>

        {intentMemories.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p>暂无活跃意图数据</p>
            <p className="text-sm mt-2">请在 ai-memory-system/Intent/ 目录添加意图文件</p>
          </div>
        )}
      </main>
    </div>
  );
}