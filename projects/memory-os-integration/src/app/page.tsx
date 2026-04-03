import { Metadata } from 'next';
import HomePage from './home-page';

export const metadata: Metadata = {
  title: 'AI Memory OS - 记忆可视化系统',
  description: '基于 5 层记忆架构的智能可视化系统',
};

export default function Page() {
  return <HomePage />;
}