import { Input } from '@magistra/ui/components/input'

export function SettingsPage() {
  return (
    <section>
      <h1 className="text-4xl font-extrabold tracking-tight text-balance">Impostazioni</h1>
      <div className="mt-8 flex flex-col gap-4">
        <Input placeholder="API Key" />
      </div>
    </section>
  )
}
