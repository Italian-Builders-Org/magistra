import { Outlet } from 'react-router'
import { SidebarInset, SidebarProvider } from '@magistra/ui/components/sidebar'
import { Sidebar } from './components/sidebar'

export default function Layout() {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset>
        <main className="min-h-svh w-full px-6 py-5 md:px-8 md:py-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
