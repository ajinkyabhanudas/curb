import { AssessmentApp } from "@/components/AssessmentApp";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Curb: AI compliance assessment</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Describe your AI application. Curb checks it against selected frameworks, separates what it can evaluate from what needs
          evidence or legal interpretation, and gives you a downloadable PDF. Prototype: runs entirely in your browser, nothing is
          sent anywhere.
        </p>
      </header>
      <AssessmentApp />
    </main>
  );
}
