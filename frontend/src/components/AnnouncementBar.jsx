export default function AnnouncementBar() {
  const message = "Free delivery on orders above Rs. 2000";

  return (
    <div className="bg-[#121212] text-neutral-300 text-xs sm:text-sm tracking-wide py-2.5 border-b border-hairline overflow-hidden select-none">
      <div className="flex w-full overflow-hidden">
        {/* Track 1 */}
        <div className="animate-marquee flex items-center shrink-0 whitespace-nowrap">
          {[...Array(4)].map((_, i) => (
            <span key={i} className="inline-flex items-center mx-8 sm:mx-14">
              <span className="hover:text-white transition-colors">
                {message}
              </span>
            </span>
          ))}
        </div>

        {/* Track 2 (Seamless loop twin) */}
        <div className="animate-marquee flex items-center shrink-0 whitespace-nowrap" aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <span key={`dup-${i}`} className="inline-flex items-center mx-8 sm:mx-14">
              <span className="hover:text-white transition-colors">
                {message}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
