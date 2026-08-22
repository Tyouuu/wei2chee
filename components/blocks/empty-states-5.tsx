import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { IconPlaceholder } from "@/components/blocks/_icon-placeholder"

/** Props a call site may pass through to an icon. */
type IconProps = { className?: string; size?: number | string }

const tips = [
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Upload"
        tabler="IconUpload"
        hugeicons="UploadIcon"
        phosphor="Upload"
        remixicon="RiUploadLine"
        {...p}
      />
    ),
    label: "Import from a file",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="BookOpen"
        tabler="IconBook2"
        hugeicons="BookOpenIcon"
        phosphor="BookOpen"
        remixicon="RiBookOpenLine"
        {...p}
      />
    ),
    label: "Start from a template",
  },
  {
    icon: (p: IconProps) => (
      <IconPlaceholder
        lucide="Plus"
        tabler="IconPlus"
        hugeicons="Add01Icon"
        phosphor="Plus"
        remixicon="RiAddLine"
        {...p}
      />
    ),
    label: "Build from scratch",
  },
]

export default function EmptyStatesBlock() {
  return (
    <section className="flex min-h-svh w-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <Empty className="w-full max-w-md border border-dashed border-border py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconPlaceholder
              lucide="Folder"
              tabler="IconFolder"
              hugeicons="FolderIcon"
              phosphor="Folder"
              remixicon="RiFolder3Line"
              aria-hidden="true"
            />
          </EmptyMedia>
          <EmptyTitle>Create your first project</EmptyTitle>
          <EmptyDescription>
            Projects keep your work organized. Create one to start adding tasks,
            files, and teammates.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button>
              <IconPlaceholder
                lucide="Plus"
                tabler="IconPlus"
                hugeicons="Add01Icon"
                phosphor="Plus"
                remixicon="RiAddLine"
                data-icon="inline-start"
                aria-hidden="true"
              />
              New project
            </Button>
            <Button variant="outline">Import</Button>
          </div>
          <div className="mx-auto mt-6 flex w-fit flex-col gap-2.5">
            {tips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </EmptyContent>
      </Empty>
    </section>
  )
}
