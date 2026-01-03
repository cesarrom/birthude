import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function Home() {
  const t = useTranslations('home');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center font-sans dark:bg-black dark:text-zinc-100">
      <main className="max-w-2xl space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-black dark:text-white sm:text-6xl">
            {t('title')}
          </h1>
          <h2 className="text-2xl font-medium text-zinc-700 dark:text-zinc-300">
            {t('subtitle')}
          </h2>
          <p className="mx-auto max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
            {t('description')}
          </p>
        </div>

        <div className="flex justify-center">
          <Link
            href="/create"
            className="rounded-full bg-purple-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-purple-700 hover:shadow-lg dark:bg-purple-500 dark:hover:bg-purple-600"
          >
            {t('create')}
          </Link>
        </div>
      </main>
    </div>
  );
}
