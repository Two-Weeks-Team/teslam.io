import type { Metadata } from "next";
import { PostPage } from "@/components/pages/post";
import { getPost } from "@/lib/posts";
import { postAlternatesFor } from "@/lib/i18n";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const found = await getPost(id);
  if (!found) return { title: "teslam.io", robots: { index: false, follow: true } };

  return {
    title: `${found.post.title} — teslam.io`,
    // The opening of the post itself, not a template. A description that
    // describes the site rather than the page is the same string on every
    // thread, which is worse than none.
    description: found.post.body.slice(0, 160),
    alternates: postAlternatesFor("ko", id),
  };
}

export default async function Page({ params }: Params) {
  const { id } = await params;
  return <PostPage locale="ko" id={id} />;
}
