import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page space-y-3">
      <h1 className="text-2xl font-semibold">Not in the library</h1>
      <p>
        There is no page at this address. <Link href="/">Browse the library</Link>.
      </p>
    </div>
  );
}
