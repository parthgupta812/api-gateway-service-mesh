type IconProps = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconShield = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
  </svg>
)

export const IconGrid = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </svg>
)

export const IconActivity = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12h3.5l2.5-6 3.5 12 2.5-6H21" />
  </svg>
)

export const IconLayers = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l8 4.2-8 4.2L4 7.2 12 3z" />
    <path d="M4 12l8 4.2 8-4.2" />
    <path d="M4 16.5l8 4.2 8-4.2" />
  </svg>
)

export const IconCircuit = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="12" r="2.2" />
    <circle cx="18" cy="12" r="2.2" />
    <path d="M8.2 12h2.4l1.6-3 1.6 3h2.4" />
  </svg>
)

export const IconFilter = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 5h16l-6.2 7.4V20l-3.6-2.2v-5.4L4 5z" />
  </svg>
)

export const IconGlobe = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5z" />
  </svg>
)

export const IconList = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4.2" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4.2" cy="18" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconClock = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3.2 2" />
  </svg>
)

export const IconRefresh = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11a8 8 0 10-2.6 6.1" />
    <path d="M20 5.5V11h-5.2" />
  </svg>
)

export const IconUser = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8.6" r="3.4" />
    <path d="M5.5 20c1.1-3.4 3.5-5 6.5-5s5.4 1.6 6.5 5" />
  </svg>
)

export const IconBox = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l8 4.4v9.2L12 21l-8-4.4V7.4L12 3z" />
    <path d="M4 7.4l8 4.4 8-4.4M12 11.8V21" />
  </svg>
)

export const IconBag = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 8h14l-1.1 11.5H6.1L5 8z" />
    <path d="M9 8V6.4A3 3 0 0112 3.5a3 3 0 013 2.9V8" />
  </svg>
)

export const IconDatabase = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <ellipse cx="12" cy="6.2" rx="7" ry="2.9" />
    <path d="M5 6.2v11.6c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9V6.2" />
    <path d="M5 12c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9" />
  </svg>
)

export const IconUsers = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8.4" r="3.1" />
    <path d="M3.5 19.5c.9-3 2.9-4.5 5.5-4.5s4.6 1.5 5.5 4.5" />
    <path d="M16 5.6a3.1 3.1 0 010 5.9M18 15.2c1.4.7 2.3 2 2.8 3.7" />
  </svg>
)

export const IconArrowRight = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h13M13 6.5L18.5 12 13 17.5" />
  </svg>
)

export const IconExternal = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-8.5 8.5" />
    <path d="M18 14.5V19a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 19V7.5A1.5 1.5 0 015 6h4.5" />
  </svg>
)

export const IconGauge = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 17a8.5 8.5 0 1115 0" />
    <path d="M12 17l3.5-4.6" />
  </svg>
)

export const IconAlert = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4.5l8 14H4l8-14z" />
    <path d="M12 10v4M12 16.6v.4" />
  </svg>
)

export const IconChart = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

export const IconBook = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13z" />
    <path d="M20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5A1.5 1.5 0 0020 18.5v-13z" />
  </svg>
)

export const IconPlay = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 4.5v15l13-7.5-13-7.5z" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSend = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21 3L11 13" />
    <path d="M21 3l-7 18-4-8-8-4 19-6z" />
  </svg>
)

export const IconCode = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8.5 8l-4 4 4 4" />
    <path d="M15.5 8l4 4-4 4" />
  </svg>
)

export const IconSearch = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.8-4.8" />
  </svg>
)

export const IconChevronDown = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const IconHeart = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 19.5C7 16.6 4 13.8 4 10.4A3.9 3.9 0 0112 8.2a3.9 3.9 0 018 2.2c0 3.4-3 6.2-8 9.1z" />
  </svg>
)
