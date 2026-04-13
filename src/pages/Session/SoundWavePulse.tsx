const BAR_DELAYS = ['0ms', '100ms', '200ms', '100ms', '0ms'];

export function SoundWavePulse() {
  return (
    <div className="flex items-center gap-[3px] h-5" aria-hidden="true">
      {BAR_DELAYS.map((delay, i) => (
        <div
          key={i}
          className="soundwave-bar w-[3px] h-full bg-blue-500 origin-center motion-safe:[animation:soundwave_0.9s_ease-in-out_infinite]"
          style={{ animationDelay: delay }}
        />
      ))}
    </div>
  );
}
