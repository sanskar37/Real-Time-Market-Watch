import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Rising bars with a trend arrow: the product mark. */
export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 47 49" fill="none" aria-hidden="true" {...props}>
      <g fill="#5367F8">
        <rect x="0" y="35" width="12" height="13.5" rx="2.5" />
        <rect x="17" y="25" width="12" height="23.5" rx="2.5" />
        <rect x="34" y="14" width="12.5" height="34.5" rx="2.5" />
      </g>
      <path
        d="M1.5 24 L16 12.5 L26 19 L41 5"
        stroke="#5367F8"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M33.5 1.5 H45.5 V13.5 Z" fill="#5367F8" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 29 29" fill="none" aria-hidden="true" {...props}>
      <path d="M24.5 14.5a10 10 0 1 1-3.1-7.2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M25 2.5v7.5h-7.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Up/down triangles beside sortable headings, as in the reference. The
 * triangle for the active direction is drawn darker.
 */
export function SortIcon({ direction, ...props }: IconProps & { direction?: 'asc' | 'desc' }) {
  return (
    <svg viewBox="0 0 10 16" aria-hidden="true" data-direction={direction} {...props}>
      <path d="M5 1.2 9.6 6.6H.4z" fill="currentColor" data-arrow="asc" />
      <path d="M5 14.8 9.6 9.4H.4z" fill="currentColor" data-arrow="desc" />
    </svg>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <svg viewBox="0 0 16 10" fill="none" aria-hidden="true" {...props}>
      <path
        d="M1.5 1.5 8 8l6.5-6.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}>
      <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 12 10" fill="none" aria-hidden="true" {...props}>
      <path
        d="M1.5 5.2 4.6 8.2 10.5 1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowUp(props: IconProps) {
  return (
    <svg viewBox="0 0 12 10" aria-hidden="true" {...props}>
      <path d="M6 1 11.5 9H.5z" fill="currentColor" />
    </svg>
  );
}

export function ArrowDown(props: IconProps) {
  return (
    <svg viewBox="0 0 12 10" aria-hidden="true" {...props}>
      <path d="M6 9 .5 1h11z" fill="currentColor" />
    </svg>
  );
}
