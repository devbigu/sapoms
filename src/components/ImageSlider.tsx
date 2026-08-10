"use client";

/**
 * ImageSlider - homepage banner slider.
 * Fetches active images from the native PostgreSQL slider API.
 */

import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { useEffect, useState, useCallback } from "react";

type SliderImage = { id: string; imageUrl: string; image_url?: string; title?: string | null };

type ImageSliderProps = {
  /** Auto-advance interval in ms (default: 3000) */
  interval?: number;
};

export const ImageSlider = ({ interval = 3000 }: ImageSliderProps) => {
  const [images, setImages] = useState<SliderImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/slider", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) setImages(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const prevImage = useCallback(() => {
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const nextImage = useCallback(() => {
    setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(nextImage, interval);
    return () => clearInterval(timer);
  }, [nextImage, images.length, interval]);

  if (loading) return (
    <div className="w-full bg-gray-100 animate-pulse" style={{ aspectRatio: "16/5" }} />
  );

  if (images.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.imageUrl ?? img.image_url}
            alt={img.title ?? `slide ${i + 1}`}
            className="w-full shrink-0 object-cover"
            style={{ aspectRatio: "16/5" }}
          />
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 h-2 bg-white"
                  : "w-2 h-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}

      {images.length > 1 && (
        <>
          <button onClick={prevImage}
            className="absolute top-1/2 left-3 -translate-y-1/2 z-30 p-2 rounded-full hover:bg-black/20 transition-colors"
            aria-label="Previous image">
            <IoIosArrowBack className="h-10 w-10 text-white/80 hover:text-white" />
          </button>
          <button onClick={nextImage}
            className="absolute top-1/2 right-3 -translate-y-1/2 z-30 p-2 rounded-full hover:bg-black/20 transition-colors"
            aria-label="Next image">
            <IoIosArrowForward className="h-10 w-10 text-white/80 hover:text-white" />
          </button>
        </>
      )}
    </div>
  );
};