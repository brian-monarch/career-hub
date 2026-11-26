import { Empty, PageHeader } from "@/platform/ui/primitives";

export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <>
      <PageHeader eyebrow="Search" title={title} />
      <Empty title="Not built yet">{note}</Empty>
    </>
  );
}
