import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
      />
      <button
        className={`sidebar-toggle-btn${collapsed ? ' collapsed' : ''}`}
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
      <div className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        <Header
          onMenuClick={() => setSidebarOpen(o => !o)}
          sidebarCollapsed={collapsed}
        />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
