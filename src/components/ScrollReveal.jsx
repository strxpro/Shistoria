import React, { useRef, useMemo } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

export function ScrollReveal({
  children,
  containerClassName = "",
  textClassName = "",
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  staggerDelay = 0.05,
  threshold = 0.5,
  duration = 0.8,
  springConfig = {
    damping: 25,
    stiffness: 100,
    mass: 1,
  },
}) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, {
    amount: threshold,
    once: false
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const rotation = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [baseRotation, 0, 0]
  );

  const splitText = useMemo(() => {
    const text = typeof children === "string" ? children : "";
    return text.split(/(\s+)/).map((part, index) => {
      return {
        value: part,
        isSpace: part.match(/^\s+$/) && part.length > 0,
        originalIndex: index,
      };
    }).filter(item => item.value.length > 0);
  }, [children]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: baseOpacity,
      filter: enableBlur ? `blur(${blurStrength}px)` : "blur(0px)",
      y: 20,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        ...springConfig,
        duration,
      },
    },
  };

  return (
    <motion.div
      ref={containerRef}
      style={{ rotate: rotation, transformOrigin: "left center" }}
      className={`scroll-reveal-container ${containerClassName}`}
    >
      <motion.p
        className={`scroll-reveal-text ${textClassName}`}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {splitText.map((item) => (
          item.isSpace ? (
            <span key={`space-${item.originalIndex}`}>{item.value}</span>
          ) : (
            <motion.span
              key={`word-${item.originalIndex}`}
              style={{ display: "inline-block", willChange: "transform, opacity, filter" }}
              variants={wordVariants}
            >
              {item.value}
            </motion.span>
          )
        ))}
      </motion.p>
    </motion.div>
  );
}

export default ScrollReveal;
