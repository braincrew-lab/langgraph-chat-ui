import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ChatOpenersProps {
  chatOpeners: string[];
  onSelectOpener: (opener: string) => void;
  disabled: boolean;
}

export function ChatOpeners({
  chatOpeners,
  onSelectOpener,
  disabled,
}: ChatOpenersProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(chatOpeners.length / itemsPerPage);
  const shouldShowCarousel = chatOpeners.length > itemsPerPage;

  const currentItems = useMemo(() => {
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return chatOpeners.slice(startIndex, endIndex);
  }, [currentPage, chatOpeners, itemsPerPage]);

  const goToNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const openerButtonHandler = (opener: string) => () => {
    if (disabled) {
      return;
    }
    onSelectOpener(opener);
  };

  return (
    <div className="flex w-[calc(100%_-_12rem)] flex-col gap-3">
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {currentItems.map((opener, index) => (
              <button
                key={`${currentPage}-${index}`}
                onClick={openerButtonHandler(opener)}
                disabled={disabled}
                className={cn(
                  "group border-border bg-card hover:bg-accent hover:border-primary relative flex min-h-[5rem] cursor-pointer items-center overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md",
                  disabled &&
                    "hover:bg-card hover:border-border cursor-not-allowed opacity-50",
                )}
              >
                <p className="text-foreground group-hover:text-primary line-clamp-2 text-sm break-keep transition-colors">
                  {opener}
                </p>
              </button>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {shouldShowCarousel && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={goToPrevPage}
            className="border-border bg-card hover:bg-accent flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  index === currentPage
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2",
                )}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={goToNextPage}
            className="border-border bg-card hover:bg-accent flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
