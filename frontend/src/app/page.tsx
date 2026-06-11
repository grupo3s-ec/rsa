import { redirect } from "next/navigation";

export default function Home() {
  // El demo principal vive en /routes/demo; la raíz redirige ahí.
  redirect("/routes/demo");
}
