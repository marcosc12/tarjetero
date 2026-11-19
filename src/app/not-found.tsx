import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7f4] px-5 py-12">
      <section className="profile-enter w-full max-w-md rounded-[2rem] border border-white bg-white p-8 text-center shadow-[0_24px_70px_rgba(31,53,40,0.09)] sm:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf3ed] text-[#66816b]">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4M8.5 11h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.05em] text-[#25342a]">
          Tarjeta no encontrada
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#778278]">
          No encontramos esta tarjeta digital. Revisa el enlace o vuelve a intentarlo más tarde.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#20372a] px-5 text-sm font-medium text-white transition hover:bg-[#2b4937]"
        >
          Ir al inicio
        </Link>
      </section>
    </main>
  );
}
