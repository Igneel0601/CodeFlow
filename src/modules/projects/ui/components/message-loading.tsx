import Image from "next/image";
import { useState, useEffect } from "react";
import { SquareIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const ShimmerMessages = () => {
  const messages = [
    "Thinking...",
    "Loading...",
    "Generating...",
    "Analyzing your request...",
    "Building your website...",
    "Crafting components...",
    "Optimizing layout...",
    "Adding final touches...",
    "Almost ready...",
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-base text-muted-foreground animate-pulse">
        {messages[currentMessageIndex]}
      </span>
    </div>
  );
};

interface MessageLoadingProps {
  onStop?: () => void;
}

export const MessageLoading = ({ onStop }: MessageLoadingProps) => {
  return (
    <div className="flex flex-col group px-2 pb-4">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="Vibe"
          width={18}
          height={18}
          className="shrink-0"
        />
        <span className="text-sm font-medium">Vibe</span>
      </div>
      <div className="pl-8.5 flex items-center gap-x-3">
        <ShimmerMessages />
        {onStop && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStop}
            className="h-7 px-2 text-xs gap-1"
          >
            <SquareIcon className="size-3 fill-current" />
            Stop
          </Button>
        )}
      </div>
    </div>
  );
};
