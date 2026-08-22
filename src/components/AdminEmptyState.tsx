import Image from "next/image";

interface AdminEmptyStateProps {
  title: string;
  description?: string;
}

export default function AdminEmptyState({
  title,
  description,
}: AdminEmptyStateProps) {
  return (
    <div className="flex min-h-[260px] w-full flex-col items-center justify-center px-4 py-8 text-center">
      <Image
        src="/assets/css-apply-static-images/assets/pictures/CSAR_Sad.webp"
        alt="CSAR mascot looking sad"
        width={180}
        height={180}
        className="h-auto w-28 drop-shadow-[0_10px_16px_rgba(19,70,135,0.16)] sm:w-32"
      />
      <h3 className="mt-4 font-poppins text-base font-semibold text-[#134687] sm:text-lg">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-md text-xs leading-5 text-[#134687]/55 sm:text-sm">
          {description}
        </p>
      )}
    </div>
  );
}
