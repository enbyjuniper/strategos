import styles from "./Badge.module.scss";

interface Props {
  children: React.ReactNode;
  color?: string;
  size?: "small" | "regular" | "large";
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  color,
  size = "regular",
  className,
  style,
}: Props) {
  const cssVars: Record<string, string> = {};
  if (color) cssVars["--badge-color"] = color;

  return (
    <span
      className={`${styles.badge} ${styles[size]}${className ? ` ${className}` : ""}`}
      style={{ ...(cssVars as React.CSSProperties), ...style }}
    >
      {children}
    </span>
  );
}
