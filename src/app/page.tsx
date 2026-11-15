import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import LoginForm from "./login-form";

export default async function Home() {
  const token = (await cookies()).get("mary_session")?.value;
  if (token) { const user = await readSession(token); if (user) redirect("/dashboard"); }
  return <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.02fr_.98fr]">
    <section className="relative flex min-h-[245px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#102653] via-[#16418b] to-[#1d4ed8] px-6 pb-7 pt-6 text-white sm:min-h-[300px] sm:px-10 lg:min-h-screen lg:px-14 lg:py-10 xl:px-20">
      <div aria-hidden="true" className="absolute -right-24 top-8 h-80 w-80 rounded-full border-[45px] border-white/[.06]"/><div aria-hidden="true" className="absolute -bottom-32 left-[42%] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl"/>
      <Link href="/" className="relative z-10 flex w-fit items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-xl bg-white p-1.5 shadow-lg shadow-blue-950/20"><Image src="/mary-royal-logo.png" alt="Mary Royal School logo" width={324} height={245} priority className="h-full w-full object-contain"/></span><span><span className="block text-sm font-extrabold tracking-[.13em]">MARY ROYAL</span><span className="text-[10px] font-medium tracking-[.2em] text-blue-100">SCHOOL · KISUMU</span></span></Link>
      <div className="relative z-10 mt-9 max-w-xl lg:mt-0"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-blue-50 backdrop-blur"><Sparkles size={13}/> School motto · Hard work pays</span><h1 className="mt-4 text-2xl font-bold leading-[1.18] tracking-tight sm:text-3xl lg:text-4xl xl:text-5xl">Every learner.<br/><span className="text-blue-200">Every possibility.</span></h1><p className="mt-3 max-w-md text-xs leading-relaxed text-blue-100 sm:text-sm">Nurturing Excellence Through CBE. A connected school community, built around every child’s growth.</p><div className="mt-5 hidden items-center gap-5 text-xs font-medium text-blue-100 sm:flex"><span className="inline-flex items-center gap-1.5"><BookOpenCheck size={15}/> Competency-based learning</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={15}/> Secure school access</span></div></div>
      <p className="relative z-10 mt-6 hidden text-[11px] text-blue-200 lg:block">© 2026 Mary Royal School · Obunga, Kisumu</p>
      <div aria-hidden="true" className="absolute bottom-0 right-0 hidden h-48 w-48 translate-x-1/3 translate-y-1/3 rounded-full border-[28px] border-white/[.06] lg:block"/>
    </section>
    <section className="relative flex items-start justify-center px-5 pb-10 pt-8 sm:px-10 sm:pt-10 lg:items-center lg:px-12 xl:px-20"><div className="w-full max-w-[420px]"><div className="mb-6 lg:mb-8"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-700">Welcome to your school</p><h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">Sign in to continue</h2><p className="mt-1.5 text-xs text-slate-500">Use the account provided by Mary Royal School.</p></div><LoginForm/><div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] text-slate-400 dark:border-slate-800"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-blue-600"/> Private school access</span><Link href="/privacy" className="font-semibold text-slate-500 underline-offset-4 hover:text-blue-700 hover:underline">Privacy notice</Link></div><p className="mt-6 text-center text-[10px] text-slate-400 lg:hidden">Mary Royal School · Obunga, Kisumu</p></div></section>
  </main>;
}
