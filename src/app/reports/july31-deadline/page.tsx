import { redirect } from "next/navigation";

/** Legacy URL — Site Status deadline list moved to /reports/aug14-deadline. */
export default function July31DeadlineRedirect() {
  redirect("/reports/aug14-deadline");
}
