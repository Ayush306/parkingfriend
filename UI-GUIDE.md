# ParkingFriend — UI Layout System

The single source of truth for how screens are built. Every new screen must follow this.

## 1. Design tokens (from `src/theme/`)

All visual values come from `useTheme()` — **never hardcode colors, spacing, radii, or fonts in screens.**

| Token group | Usage |
|---|---|
| `colors.primary` `#0FB57E` (emerald) | Brand actions, active states, links |
| `colors.bg` / `surface` / `surfaceAlt` | Screen background / cards / inset panels |
| `colors.text` / `textSecondary` / `textMuted` | 3-level text hierarchy — never more |
| `colors.border`, `colors.error/success/warning` | Hairline borders, status |
| `spacing.xs…huge` | All margins/paddings (screen edge = `spacing.xl`) |
| `radius.sm/md/lg/pill` | Corners: inputs `md`, cards `lg`, chips/pills `pill` |
| `typography.fonts` | Poppins = headings, Inter = body/UI |
| `shadows.sm/md/lg` | Elevation; cards use `sm`, floating elements `md` |

Dark mode works automatically because everything routes through the theme.

## 2. Screen skeleton

Every screen is one of two shapes:

```tsx
// A) Standard screen (most screens)
<Screen scroll padded>            // SafeArea + ScrollView + spacing.xl padding
  <Header showBack title="…" />   // shared header, never hand-rolled
  …content in Cards/sections…
</Screen>

// B) Tab-root screen (Home, Post, Bookings, Wallet, Profile)
<SafeAreaView edges={["top","left","right"]} style={{flex:1, backgroundColor: colors.bg}}>
  <ScrollView contentContainerStyle={{ paddingBottom: spacing.huge }}>
    …sections, each padded with paddingHorizontal: spacing.xl…
  </ScrollView>
</SafeAreaView>
```

Rules:
- Horizontal screen padding is **always `spacing.xl`** (20). Horizontal carousels break out full-bleed but pad their content with `paddingHorizontal: spacing.xl`.
- Bottom of every scroll view: `paddingBottom: spacing.huge` so content clears the tab bar.
- Text that can be long always gets `numberOfLines`.
- Touch targets ≥ 44px (`hitSlop` when visually smaller).
- Every `Pressable` has `accessibilityRole` + `accessibilityLabel`.

## 3. Shared components (use these, don't reinvent)

| Component | Purpose |
|---|---|
| `Screen`, `Header`, `SectionHeader` | Page scaffold |
| `Card` (`elevated`) | Any boxed content |
| `Button` (primary/outline/ghost/gradient/danger, sm/md/lg) | All buttons |
| `Input`, `Chip`, `Avatar`, `Toast` | Forms & feedback |
| `SpotCard`, `SkeletonCard`, `EmptyState`, `ErrorState` | Lists & states |
| `LiveMap` (read-only) / `MapPicker` (interactive) | Maps (WebView native / iframe web) |
| `ErrorBoundary` | App-level crash guard (already wired in App.tsx) |

## 4. Data states — non-negotiable

Every fetch renders **all four states**: loading (`Skeleton*`), error (`ErrorState` with retry), empty (`EmptyState` with a helpful action), data. Use the `useAsync` hook — it standardizes this.

## 5. Navigation map (current)

```
RootStack
├─ Splash → Onboarding → Welcome → Login → OtpVerification
├─ Main (bottom tabs)
│   ├─ Home        — driver search, recent activity, popular, ad slot
│   ├─ Bookings    — driver bookings list
│   ├─ POST (center button) — host hub: list a space, requests (accept/decline),
│   │                          earnings strip, your spaces
│   ├─ Wallet      — host earnings tracker (no payments)
│   └─ Profile
└─ Pushed screens: Explore (map search), SpotDetail, SearchResults, BookingFlow,
   BookingConfirmation, BookingDetail, ListSpace, HostRequests, Favorites,
   Notifications, Settings, EditProfile, HelpSupport, About, TermsPrivacy,
   Feedback, Reports
```

## 6. Voice & content rules

- Currency is always `formatCurrency` (₹, en-IN). Dates via `formatDate`.
- No payment language anywhere — ParkingFriend never moves money.
- Empty states are encouraging and specific ("Be the first to host here"), never blank.
- Real data only in production: no picsum/pravatar placeholders in user-facing flows once the API is live.
