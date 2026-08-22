import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

interface NoApplicationFoundProps {
  applicationName: string;
  description: string;
  applyHref: string;
}

export default function NoApplicationFound({
  applicationName,
  description,
  applyHref,
}: NoApplicationFoundProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3f3fd] bg-[url('/assets/css-apply-static-images/assets/pictures/background.webp')] bg-cover bg-center bg-no-repeat">
      <Header />

      <main className="flex grow items-center justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <section className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_70px_rgba(19,70,135,0.18)]">
          <div className="grid md:grid-cols-[0.85fr_1.15fr]">
            <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-[#134687] px-8 py-8 sm:min-h-64 md:min-h-[430px]">
              <div
                aria-hidden="true"
                className="absolute -left-14 -top-16 h-52 w-52 rounded-full border-[34px] border-white/5"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full border-[42px] border-white/5"
              />

              <div className="relative flex flex-col items-center">
                <div className="absolute inset-x-5 bottom-2 h-8 rounded-full bg-[#082d60]/25 blur-xl" />
                <Image
                  src="/assets/css-apply-static-images/assets/pictures/CSAR_Sad.webp"
                  alt="CSAR mascot looking for an application"
                  width={290}
                  height={290}
                  priority
                  className="relative h-auto w-40 drop-shadow-[0_14px_20px_rgba(3,25,58,0.28)] sm:w-48 md:w-60"
                />
                <span className="relative mt-3 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/90 backdrop-blur-sm">
                  CSSAPPLY
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
              <span className="mb-4 w-fit rounded-full bg-[#eaf3ff] px-3 py-1 text-xs font-bold tracking-[0.14em] text-[#134687]">
                APPLICATION STATUS
              </span>

              <h1 className="font-raleway text-3xl font-bold leading-tight text-[#102a4c] sm:text-4xl">
                No active application yet
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {description}
              </p>

              <div className="mt-6 rounded-2xl border border-[#dbe9fb] bg-[#f6faff] p-4">
                <p className="text-sm font-semibold text-[#102a4c]">
                  Ready to join CSS?
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Start a {applicationName} application, or return to your
                  dashboard to explore the other available positions.
                </p>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={applyHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#134687] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(19,70,135,0.2)] transition hover:bg-[#0d3569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7ee3] focus-visible:ring-offset-2"
                >
                  Start application
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="M4.17 10h11.66m-4.16-4.17L15.83 10l-4.16 4.17"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <Link
                  href="/user"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#bfd2ea] bg-white px-6 py-3 text-sm font-semibold text-[#134687] transition hover:border-[#8eafd6] hover:bg-[#f6faff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7ee3] focus-visible:ring-offset-2"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
