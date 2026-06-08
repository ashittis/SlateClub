The biggest mistake when prompting Claude Code is saying:

> "Make it look like this image."

That produces an approximation.

Instead, tell Claude to **reverse engineer the visual system** and recreate the exact design language.

Here's the prompt I would give Claude Code:

You are not designing a new screen.

You are recreating the visual language of the attached reference exactly, but for the Slate movie app onboarding/login screen.

ANALYZE FIRST, THEN IMPLEMENT.

Break the reference down into:

1. Typography
2. Layout
3. Gradient system
4. Lighting system
5. Texture system
6. Depth system
7. CTA styling
8. Motion system

Do not approximate.

Do not redesign.

Do not use generic SaaS onboarding patterns.

The final result should feel visually identical to the reference.

---

LAYOUT

Use a full-screen mobile onboarding page.

Background:

* Pure black (#000000)
* No cards
* No containers
* No glassmorphism

Everything should feel printed directly onto darkness.

Content alignment:

* Left aligned
* Large headline occupying roughly 40% of screen height
* CTA section anchored near bottom

Spacing should feel luxurious and cinematic.

---

TYPOGRAPHY

Use:
font-family: Inter

Weights:

* Logo: Medium (500)
* Headline: Bold (700)
* Supporting text: Regular (400)

Headline characteristics:

* Extremely large
* Tight line-height (~0.92)
* Negative letter spacing
* White (#FFFFFF)

Example:

Discover.
Track.
Remember.

or

Movies That
Stay With
You.

Text should dominate the screen.

---

CENTER SHADER EFFECT

This is the most important part.

The orange glow is NOT a gradient.

It is a layered lighting system.

Create:

Layer 1:
Background radial glow

radial-gradient(
circle at center,
rgba(255,140,0,0.35),
transparent 60%
)

Layer 2:
Vertical ribbed light texture

Use repeating-linear-gradient

repeating-linear-gradient(
90deg,
rgba(255,180,80,0.12) 0px,
rgba(255,180,80,0.12) 8px,
transparent 8px,
transparent 16px
)

Layer 3:
Orange sunset overlay

linear-gradient(
180deg,
#ff8a00 0%,
#ff5e00 40%,
#5c1200 100%
)

Layer 4:
Strong vignette

darken edges heavily.

Center should be bright.

Edges almost black.

Result:
The light appears to emerge from darkness and fade away naturally.

---

TEXTURE

Add subtle film-grain.

Opacity:
2-4%

Blend mode:
overlay

No obvious noise.

Should only be visible on close inspection.

---

BUTTON

Primary CTA:

Height:
56px

Radius:
9999px

Gradient:

#ff4d00
→
#ff9800

No shadow.

Only a subtle glow:

0 0 40px rgba(255,120,0,0.25)

Text:
white
semibold

---

ANIMATION

Use GSAP.

Hero glow:

* Slowly shifts horizontally
* Duration: 15s
* Infinite
* Ease: sine.inOut

Shader texture:

* Moves 10px left-right
* Extremely subtle

Headline:

* Fade up
* 0.8s
* y: 20px

CTA:

* Fade up
* Delay: 0.2s

No bouncing.

No spring animations.

Everything should feel premium like Apple keynotes.

---

SLATE BRANDING

Replace all reference copy with:

Logo:
SLATE

Headline:
Track.
Discover.
Remember.

Subtext:
The home for people who love movies.

Primary CTA:
Get Started

Secondary CTA:
Sign In

Keep the visual hierarchy identical to the reference.

The goal is that if the reference and implementation were shown side-by-side, they feel like the same design system.

One more thing: the "shader" in the middle is not actually an image. For production, I would build it with **3 layered gradients + a repeating-linear-gradient texture + CSS mask + slight GSAP movement**. That gives you the exact premium look while staying fully responsive and lightweight, instead of embedding a static PNG. That's how I'd implement it for Slate.
