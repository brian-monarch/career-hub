import { Empty, PageHeader } from "@/platform/ui/primitives";

export function ComingSoon({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <Empty title="Not built yet">{note}</Empty>
    </>
  );
}
