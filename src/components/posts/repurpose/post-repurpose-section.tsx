import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { posts } from "@/db/schema";
import { listRepurposeOutputsForPost } from "@/lib/adam/repurpose/storage";
import {
  repurposeReaderOutputTypes,
  type RepurposeReaderOutputType,
} from "@/lib/adam/repurpose/types";
import { RepurposeOutputCard } from "./repurpose-output-views";

const readerTypeSet = new Set<string>(repurposeReaderOutputTypes);

function isReaderOutputType(type: string): type is RepurposeReaderOutputType {
  return readerTypeSet.has(type);
}

export async function PostRepurposeSection({ slug }: { slug: string }) {
  const db = getDb();
  const [postRow] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.slug, slug))
    .limit(1);
  if (!postRow) {
    return null;
  }
  const outputs = await listRepurposeOutputsForPost(db, postRow.id);
  const ready = outputs.filter(
    (o) => o.status === "ready" && isReaderOutputType(o.outputType),
  );
  if (ready.length === 0) {
    return null;
  }

  const order = repurposeReaderOutputTypes as readonly string[];
  ready.sort(
    (a, b) => order.indexOf(a.outputType) - order.indexOf(b.outputType),
  );

  return (
    <div className="mt-12 space-y-6 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Explore this dispatch
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          NotebookLM-style companions generated once for this issue.
        </p>
      </div>
      <div className="space-y-6">
        {ready.map((output) => (
          <RepurposeOutputCard key={output.id} output={output} />
        ))}
      </div>
    </div>
  );
}
