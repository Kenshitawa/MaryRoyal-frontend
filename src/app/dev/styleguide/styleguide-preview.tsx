"use client";

import { useEffect, useState } from "react";
import { Bell, ClipboardList, Inbox, Plus, Search, Users } from "lucide-react";
import { BottomActionBar, Card, EmptyState, FormStep, ListRow, PageHeader, Skeleton, SkeletonList, StatCard } from "@/components/ui/primitives";
import { Button, Chip, IconButton } from "@/components/ui/actions";
import { Sheet } from "@/components/ui/sheet";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { StatusPill } from "@/components/design-system/status-pill";

const appearances = [
  { mode: "light", style: "bento", label: "Light · Bento" },
  { mode: "dark", style: "bento", label: "Dark · Bento" },
  { mode: "light", style: "glass", label: "Light · Glass" },
  { mode: "dark", style: "glass", label: "Dark · Glass" },
] as const;

export function StyleguidePreview() {
  return (
    <ToastProvider>
      <StyleguideBody />
    </ToastProvider>
  );
}

function StyleguideBody() {
  const [appearance, setAppearance] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    const { mode, style } = appearances[appearance];
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.style = style;
    localStorage.setItem("mary-theme", mode);
    localStorage.setItem("mary-style", style);
  }, [appearance]);

  return (
    <div className="mx-auto w-full max-w-[360px] px-4 py-4" style={{ background: "var(--canvas)", minHeight: "100vh" }}>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Preview appearance">
        {appearances.map((item, index) => (
          <Button key={item.label} variant={index === appearance ? "primary" : "secondary"} size="sm" aria-pressed={index === appearance} onClick={() => setAppearance(index)}>
            {item.label}
          </Button>
        ))}
      </div>
      <PageHeader title="Design system" meta="Mary Royal School" help="Shared mobile components at 360px." action={<IconButton ariaLabel="Notifications"><Bell size={18} /></IconButton>} />
      <div className="space-y-3">
        <Card title="Stat cards" description="Six sizes, three tones">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Learners" value="482" note="3 grade bands" icon={Users} />
            <StatCard label="Fees collected" value="Ksh 1.2M" tone="success" icon={Plus} />
            <StatCard label="Pending" value="12" tone="warning" icon={ClipboardList} />
            <StatCard label="Overdue" value="4" tone="danger" icon={Bell} />
          </div>
        </Card>
        <Card title="List rows" action={<Chip>New</Chip>}>
          <div className="list">
            <ListRow href="#row" leading={<span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand-ink"><Users size={18} /></span>} title="Achieng Otieno" subtitle="Grade 4 · Active" trailing={<StatusPill status="ACTIVE" />} />
            <ListRow title="Brian Were" subtitle="Grade 6 · Fee balance" trailing={<StatusPill status="OVERDUE" />} />
            <ListRow title="Waiting list" subtitle="No approved learners yet" trailing={<StatusPill status="DRAFT" />} />
          </div>
        </Card>
        <Card title="Actions">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Save changes</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="soft">Filter</Button>
            <IconButton ariaLabel="Search"><Search size={18} /></IconButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip>All</Chip>
            <Chip>Pending</Chip>
            <Chip>Paid</Chip>
            <button type="button" className="btn btn-secondary" onClick={() => setSheetOpen(true)}>Open sheet</button>
            <button type="button" className="btn btn-soft" onClick={() => notify("Changes saved", "success")}>Show toast</button>
          </div>
        </Card>
        <EmptyState icon={Inbox} title="Nothing here yet" description="New items will appear in this list." action={<Button variant="primary">Create one</Button>} />
        <Card title="Loading">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="mt-3"><SkeletonList rows={2} /></div>
        </Card>
        <FormStep step={2} total={3} title="Fee structure" description="Set the term totals." footer={<Button variant="primary" className="w-full">Continue</Button>}>
          <label className="field-label" htmlFor="sg-input">Term name</label>
          <input id="sg-input" className="input" defaultValue="Term 1" />
        </FormStep>
        <BottomActionBar>
          <Button variant="secondary" className="flex-1">Cancel</Button>
          <Button variant="primary" className="flex-1">Save</Button>
        </BottomActionBar>
      </div>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Example sheet" description="Bottom sheet primitives." footer={<Button variant="primary" className="w-full" onClick={() => setSheetOpen(false)}>Done</Button>}>
        <p className="text-body text-ink-2">Sheet content uses the same tokens and 16px padding.</p>
      </Sheet>
    </div>
  );
}
