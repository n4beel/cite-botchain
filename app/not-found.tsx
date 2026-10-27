import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";

export default function NotFound() {
  return (
    <PageShell>
      <div className="max-w-[500px] mx-auto py-16 text-center">
        <Panel variant="scholarly" className="p-8">
          <div className="w-12 h-12 rounded-full bg-[#F3EAFF] text-[#B5179E] flex items-center justify-center font-serif text-[24px] font-bold mx-auto mb-4">
            §
          </div>
          <h2 className="font-serif text-[24px] font-bold text-[#1E1233] mb-2">
            Work Not Found (404)
          </h2>
          <p className="text-[13px] text-[#5B4A78] leading-relaxed mb-6">
            The referenced citation or page does not exist in the on-chain bibliography.
          </p>
          <Link href="/">
            <Button variant="primary" size="md">
              Return to Bibliography
            </Button>
          </Link>
        </Panel>
      </div>
    </PageShell>
  );
}
