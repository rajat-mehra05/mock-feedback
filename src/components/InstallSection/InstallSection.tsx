import { useMemo, useState } from 'react';
import { detectDownloadTarget, type DownloadTarget } from '@/lib/detectDownloadTarget';
import { DownloadCta } from './DownloadCta';
import { OsWarning } from './OsWarning';

export function InstallSection() {
  const detected = useMemo(
    () => detectDownloadTarget(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    [],
  );
  const [platform, setPlatform] = useState<DownloadTarget>(detected);

  return (
    <section className="border-4 border-black bg-white p-8 shadow-neo-lg sm:p-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
        <DownloadCta platform={platform} onSwitch={setPlatform} />
        <OsWarning platform={platform} />
      </div>
    </section>
  );
}
