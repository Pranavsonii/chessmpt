import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <Brand />
      <div>
        <p className="text-6xl font-extrabold text-primary">404</p>
        <p className="mt-2 text-muted-foreground">This square is empty. The page doesn&apos;t exist.</p>
      </div>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
