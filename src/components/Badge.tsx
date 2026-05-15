import styles from "./Badge.module.scss";

interface Props {
  children: React.ReactNode;
  color?: string;
  borderColor?: string;
  size?: "small" | "regular" | "large";
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  color,
  borderColor,
  size = "regular",
  className,
  style,
}: Props) {
  const cssVars: Record<string, string> = {};
  if (color) cssVars["--badge-color"] = color;
  if (borderColor) cssVars["--badge-border-color"] = borderColor;

  return (
    <span
      className={`${styles.badge} ${styles[size]}${className ? ` ${className}` : ""}`}
      style={{ ...(cssVars as React.CSSProperties), ...style }}
    >
      {children}
    </span>
  );
}
