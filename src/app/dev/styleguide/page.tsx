import { notFound } from "next/navigation";
import { StyleguidePreview } from "./styleguide-preview";

export const dynamic = "force-dynamic";

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StyleguidePreview />;
}
