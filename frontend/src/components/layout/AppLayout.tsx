import { Outlet } from 'react-router-dom'
import { Sidebar, MobileNav } from './Sidebar'

export function AppLayout() {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 scrollbar-thin sm:px-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
